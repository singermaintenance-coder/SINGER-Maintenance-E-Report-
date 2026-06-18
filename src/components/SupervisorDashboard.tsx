import { useState, useMemo } from 'react';
import { MaintenanceRecord, Factory, MachineReport, Machine, Notification, User } from '../types';
import { FACTORIES, DEPARTMENTS, SUB_LOCATIONS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Filter, Download, ChevronLeft, ChevronRight, 
  Bell, CheckCircle2, MessageSquareWarning, X, LogOut, Edit2, Save,
  BarChart3, Map as MapIcon, Settings, Activity, Layers, Users, Cpu, Maximize,
  Trash2, AlertCircle, Loader2, Hammer, Cog, Paintbrush, ArrowLeft, TrendingUp, Gauge, Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, startOfYear, endOfYear, eachMonthOfInterval, isSameMonth } from 'date-fns';
import { cn, formatDate, formatTime, formatTimeRange, formatDateTime, getSriLankanHoliday, isSunday } from '../lib/utils';
import { translateToEnglish } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import NotificationTray from './NotificationTray';
import AITranslationTool from './AITranslationTool';

function getSolidSection(machine: Machine): 'Main Solid' | 'Machine Section' | 'Paint Section' {
  const name = machine.name.toUpperCase();
  
  if (
    name.includes('CROSS CUTTER 3') || 
    name.includes('CROSS CUTTER 4') || 
    name.includes('CROSS CUTTER 5') || 
    name.includes('MULTI RIP SAW') || 
    name.includes('RIP SAW (MULTI)') || 
    name.includes('TWO SIDE PLANNER NEW') || 
    name.includes('TWO SIDE PLANNER OLD')
  ) {
    return 'Machine Section';
  }
  
  if (
    name.includes('CURTAINE COATER') ||
    name.includes('DIGITAL WEIGHT') ||
    name.includes('OVEN') ||
    name.includes('PAINT BOOTH') ||
    name.includes('PAINT MACHINE')
  ) {
    return 'Paint Section';
  }
  
  return 'Main Solid';
}

function formatHoursDisplay(hours: number): string {
  const roundedMinutesTotal = Math.round(hours * 60);
  const h = Math.floor(roundedMinutesTotal / 60);
  const m = roundedMinutesTotal % 60;
  if (h === 0 && m === 0) return '0h';
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function SupervisorDashboard({ 
  records, 
  reports = [], 
  machines = [],
  onUpdateReport,
  onDeleteReport,
  onUpdateRecord,
  onDeleteRecord,
  onLogout,
  notifications = [],
  onMarkNotificationAsRead,
  onDeleteNotification
}: { 
  records: MaintenanceRecord[], 
  reports: MachineReport[],
  machines: Machine[],
  onUpdateReport: (id: string, updates: Partial<MachineReport>) => Promise<void>,
  onDeleteReport?: (id: string) => Promise<void>,
  onUpdateRecord: (id: string, updates: Partial<MaintenanceRecord>) => Promise<void>,
  onDeleteRecord?: (id: string) => Promise<void>,
  onLogout: () => void,
  notifications?: Notification[],
  onMarkNotificationAsRead: (id: string, userId: string) => Promise<void>,
  onDeleteNotification?: (id: string) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'analysis' | 'map'>('pending');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterDept, setFilterDept] = useState<Factory | 'All'>('All');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [confirmingReportId, setConfirmingReportId] = useState<string | null>(null);
  const [confirmingRecordId, setConfirmingRecordId] = useState<string | null>(null);
  const [confirmingClearDate, setConfirmingClearDate] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [showAddressed, setShowAddressed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingDateRecordId, setEditingDateRecordId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');

  const [selectedAnalysisDept, setSelectedAnalysisDept] = useState<Factory>(FACTORIES[0]);
  const [selectedAnalysisSection, setSelectedAnalysisSection] = useState<'All' | 'Main Solid' | 'Machine Section' | 'Paint Section'>('All');
  const [focusedMachineDetailId, setFocusedMachineDetailId] = useState<string | null>(null);

  const [customMachineTargetHours, setCustomMachineTargetHours] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('custom_machine_target_hours');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const saveCustomTargetHours = (machineId: string, hours: number) => {
    const updated = { ...customMachineTargetHours, [machineId]: hours };
    setCustomMachineTargetHours(updated);
    try {
      localStorage.setItem('custom_machine_target_hours', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving custom target hours:', e);
    }
  };

  const monthlyRecords = useMemo(() => {
    return records.filter(r => isSameMonth(new Date(r.date), currentMonth));
  }, [records, currentMonth]);

  const analyzedMachines = useMemo(() => {
    let deptMachines = machines.filter(m => m.department === selectedAnalysisDept);
    
    // If Solid factory, filter by selected section
    if (selectedAnalysisDept === 'Solid' && selectedAnalysisSection !== 'All') {
      deptMachines = deptMachines.filter(m => getSolidSection(m) === selectedAnalysisSection);
    }
    
    return deptMachines.map(machine => {
      const machineRecords = monthlyRecords.filter(r => r.machineId === machine.id);
      const breakDowns = machineRecords.filter(r => r.workType === 'Break Down');
      const services = machineRecords.filter(r => r.workType === 'Service');
      const repairs = machineRecords.filter(r => r.workType === 'Repair');
      
      const maintenanceCount = machineRecords.length;
      
      // Calculate downtime in hours
      const downtimeMinutes = machineRecords.reduce((sum, r) => sum + r.duration, 0);
      const downtimeHours = parseFloat((downtimeMinutes / 60).toFixed(1));
      
      // Standard monthly available hours = custom value or defaults to 200
      const baseHours = customMachineTargetHours[machine.id] ?? 200;
      const runningHours = Math.max(0, parseFloat((baseHours - downtimeHours).toFixed(1)));
      const efficiencyPercentage = Math.round((runningHours / baseHours) * 100);
      
      const name = machine.name.replace(/<br\s*\/?>/gi, ' ');
      
      return {
        id: machine.id,
        name: name,
        fullName: machine.name,
        image: machine.image,
        section: selectedAnalysisDept === 'Solid' ? getSolidSection(machine) : 'Main Area',
        maintenanceCount,
        downtimeHours,
        runningHours,
        baseHours,
        efficiencyPercentage,
        "Broke Down": breakDowns.length,
        "Serviced": services.length,
        "Repaired": repairs.length,
        records: machineRecords,
      };
    });
  }, [machines, selectedAnalysisDept, selectedAnalysisSection, monthlyRecords, customMachineTargetHours]);

  const factorySummaryStats = useMemo(() => {
    const deptMachines = machines.filter(m => m.department === selectedAnalysisDept);
    const deptRecords = monthlyRecords.filter(r => {
      const mach = machines.find(m => m.id === r.machineId);
      return mach && mach.department === selectedAnalysisDept;
    });

    const totalMachines = deptMachines.length;
    const totalMaintenanceCount = deptRecords.length;
    
    const totalDowntimeMinutes = deptRecords.reduce((sum, r) => sum + r.duration, 0);
    const totalDowntimeHours = parseFloat((totalDowntimeMinutes / 60).toFixed(1));
    
    // Sum individual target hours for the department
    const totalPossibleHours = deptMachines.reduce((sum, m) => sum + (customMachineTargetHours[m.id] ?? 200), 0);
    const totalRunningHours = Math.max(0, parseFloat((totalPossibleHours - totalDowntimeHours).toFixed(1)));
    const averageEfficiency = totalPossibleHours > 0 ? Math.round((totalRunningHours / totalPossibleHours) * 100) : 100;
    
    const totalBreakdowns = deptRecords.filter(r => r.workType === 'Break Down').length;
    const totalServices = deptRecords.filter(r => r.workType === 'Service').length;
    const totalRepairs = deptRecords.filter(r => r.workType === 'Repair').length;

    return {
      totalMachines,
      totalMaintenanceCount,
      totalDowntimeHours,
      totalPossibleHours,
      averageEfficiency,
      totalBreakdowns,
      totalServices,
      totalRepairs
    };
  }, [machines, selectedAnalysisDept, monthlyRecords, customMachineTargetHours]);

  // Keep compatibility fields so we don't break compile before replacing the activeTab JSX
  const selectedAnalysisMachineId = 'all';
  const analysisData: any[] = [];
  const selectedMachineStats = null;
  const filteredMachinesForDept = machines.filter(m => m.department === selectedAnalysisDept);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const dailyRecords = records.filter(r => {
    const rDate = new Date(r.date);
    const dateMatch = selectedDate 
      ? isSameDay(rDate, selectedDate)
      : isSameMonth(rDate, currentMonth);
    return dateMatch && (filterDept === 'All' || r.department === filterDept || (filterDept === 'Other' && SUB_LOCATIONS.includes(r.department)));
  });

  const pendingReports = reports.filter(r => {
    const rDate = new Date(r.createdAt);
    const dateMatch = selectedDate
      ? isSameDay(rDate, selectedDate)
      : isSameMonth(rDate, currentMonth);
    return (showAddressed ? (r.status === 'pending' || r.status === 'addressed') : r.status === 'pending') &&
      dateMatch &&
      (filterDept === 'All' || r.department === filterDept || (filterDept === 'Other' && SUB_LOCATIONS.includes(r.department)));
  });

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const exportToCSV = () => {
    const headers = [
      'Factory',
      'Machine',
      'Work Type',
      'Work Shift',
      'Reported Date',
      'Reported By',
      'Problem Description',
      'Maintenance Action',
      'Start Time',
      'Finish Time',
      'Calculated Duration',
      'Status'
    ];

    const escapeCSVValue = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map(r => {
      const matchingReport = reports.find(rep => rep.id === r.reportId || (rep.machineId === r.machineId && rep.workType === r.workType));
      const problemDescription = r.problemDescription || matchingReport?.description || 'N/A';
      const reportedDate = matchingReport ? formatDateTime(matchingReport.createdAt) : formatDate(r.date);
      const reportedBy = 'Factory Manager';

      return [
        escapeCSVValue(r.department),
        escapeCSVValue(r.machineName.replace(/<br\s*\/?>/gi, ' ')),
        escapeCSVValue(r.workType),
        escapeCSVValue(r.shift || 'None Shift'),
        escapeCSVValue(reportedDate),
        escapeCSVValue(reportedBy),
        escapeCSVValue(problemDescription),
        escapeCSVValue(r.description),
        escapeCSVValue(formatDateTime(r.startTime)),
        escapeCSVValue(formatDateTime(r.finishTime)),
        escapeCSVValue(`${r.duration}m`),
        escapeCSVValue('Resolved')
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `singer_maintenance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 md:p-12 space-y-8 sm:space-y-12 max-w-7xl mx-auto w-full bg-slate-50 min-h-screen relative">
      {/* Back Button */}
      <button 
        onClick={onLogout}
        className="absolute top-4 left-4 sm:top-12 sm:left-12 w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl hover:border-slate-900 transition-all text-slate-900 z-10 shadow-sm group"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b-4 border-slate-900 pb-10 mt-8 sm:mt-0">
        <div>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] uppercase flex flex-col">
            <span>SHIFT</span>
            <span className="text-singer-red">OVERVIEW</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[8px] sm:text-[10px]">Division Oversight & Performance Tracking</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-white p-1.5 rounded-2xl border-2 border-slate-900 shadow-lg overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'pending' ? "bg-singer-red text-white" : "text-slate-400 hover:text-slate-900"
              )}
            >
              <Bell size={16} />
              Pending
              {pendingReports.length > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[8px]",
                  activeTab === 'pending' ? "bg-white text-singer-red" : "bg-singer-red text-white"
                )}>
                  {pendingReports.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={cn(
                "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'completed' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900"
              )}
            >
              <CheckCircle2 size={16} />
              Completed
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={cn(
                "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'analysis' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900"
              )}
            >
              <BarChart3 size={16} />
              Analysis
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={cn(
                "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'map' ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900"
              )}
            >
              <MapIcon size={16} />
              Map
            </button>
          </div>
          <button 
            onClick={exportToCSV}
            className="btn-primary flex items-center gap-2 group whitespace-nowrap justify-center h-16 sm:h-auto"
          >
            <Download size={20} className="group-hover:-translate-y-1 transition-transform" />
            EXPORT MASTER LOG (.CSV)
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pending' && (
          <motion.div
            key="pending-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"
          >
            {/* Calendar & Filter Column */}
            <div className="lg:col-span-4 space-y-6 sm:space-y-8">
              {/* Pending Activity Summary */}
              <div className="bg-white p-8 rounded-[32px] border-2 border-slate-900 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 text-slate-100/50 text-7xl font-black italic select-none">!</div>
                <div className="relative z-10 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-2">
                      <AlertCircle className="text-singer-red" size={20} />
                      Pending Alerts
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Live Operational Disruptions</p>
                  </div>
                  
                  <div className="space-y-4">
                    {DEPARTMENTS.map(dept => {
                      const count = reports.filter(r => 
                        (r.department === dept || (dept === 'Other' && SUB_LOCATIONS.includes(r.department))) && 
                        r.status === 'pending'
                      ).length;
                      if (count === 0) return null;
                      return (
                        <div key={dept} className="flex items-center justify-between group/item">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-tight group-hover/item:text-singer-red transition-colors">{dept} Sector</span>
                          <div className="flex items-center gap-2">
                            <div className="h-px w-8 bg-slate-100 group-hover/item:w-12 transition-all group-hover/item:bg-singer-red/20" />
                            <span className="bg-singer-red text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg shadow-singer-red/20">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {reports.filter(r => r.status === 'pending').length === 0 && (
                      <div className="py-4 text-center">
                        <CheckCircle2 className="mx-auto text-green-500 mb-2" size={24} />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Active Alerts</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-xl sm:shadow-2xl border-2 border-slate-100 overflow-hidden">
                <div className="p-6 sm:p-8 bg-slate-900 text-white flex justify-between items-center border-b-4 border-singer-red">
                  <h2 className="font-black text-xl sm:text-2xl uppercase tracking-tighter italic">{format(currentMonth, 'MMMM yyyy')}</h2>
                  <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-2 sm:p-3 hover:bg-white/10 rounded-xl transition-all"><ChevronLeft size={20}/></button>
                    <button onClick={nextMonth} className="p-2 sm:p-3 hover:bg-white/10 rounded-xl transition-all"><ChevronRight size={20}/></button>
                  </div>
                </div>
                
                <div className="p-4 sm:p-8 bg-white">
                  <div className="grid grid-cols-7 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center text-[9px] sm:text-[10px] font-black text-slate-300 uppercase py-2 tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                      <div key={`p-${i}`} className="aspect-square" />
                    ))}
                    {days.map(day => {
                      const hasPending = reports.some(r => r.status === 'pending' && isSameDay(new Date(r.createdAt), day));
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const holiday = getSriLankanHoliday(day);
                      const isSun = isSunday(day);

                      let bgClass = "hover:bg-slate-50 text-slate-700";
                      
                      if (holiday) {
                        bgClass = "bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold border border-amber-300";
                      } else if (isSun) {
                        bgClass = "bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200";
                      }

                      if (isSelected) {
                        bgClass = "bg-singer-red text-white shadow-lg sm:shadow-xl shadow-singer-red/20 scale-105 sm:scale-110 z-10";
                      }

                      return (
                        <button
                          key={day.toString()}
                          onClick={() => setSelectedDate(day)}
                          title={holiday ? `${holiday.name} (${holiday.type})` : isSun ? "Sunday" : undefined}
                          className={cn(
                            "relative flex items-center justify-center aspect-square rounded-xl sm:rounded-2xl text-sm sm:text-base font-black transition-all",
                            bgClass,
                            isToday(day) && !isSelected && "ring-2 ring-singer-red/20",
                          )}
                        >
                          {format(day, 'd')}
                          {hasPending && !isSelected && (
                            <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-1 sm:h-1.5 sm:w-1.5 h-1 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Calendar Color Legend */}
                  <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-wider relative z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-lg bg-blue-50 border border-blue-200 block" />
                      <span className="text-slate-500">Sunday (Blue)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-lg bg-amber-100 border border-amber-300 block" />
                      <span className="text-slate-500">Holiday (Yellow)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border-2 border-slate-100 overflow-x-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Filter size={18} /></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Division Filter</span>
                </div>
                
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <button 
                    onClick={() => setShowAddressed(!showAddressed)}
                    className={cn(
                      "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                      showAddressed ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-400"
                    )}
                  >
                    {showAddressed ? "Hide Addressed" : "Show Addressed"}
                  </button>
                </div>

                <div className="flex sm:grid sm:grid-cols-1 gap-2 pb-2 sm:pb-0 overflow-x-auto sm:overflow-x-visible no-scrollbar">
                  <button 
                    onClick={() => setFilterDept('All')}
                    className={cn(
                      "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-left transition-all whitespace-nowrap min-w-[120px] sm:min-w-0 flex-shrink-0",
                      filterDept === 'All' ? "bg-slate-900 text-white shadow-lg sm:translate-x-1" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    Global Audit
                  </button>
                  {FACTORIES.map(dept => (
                    <button 
                      key={dept}
                      onClick={() => setFilterDept(dept)}
                      className={cn(
                        "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-left transition-all whitespace-nowrap min-w-[120px] sm:min-w-0 flex-shrink-0",
                        filterDept === dept ? "bg-singer-red text-white shadow-lg sm:translate-x-1" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      {dept} Sector
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reports List Column */}
            <div className="lg:col-span-8 space-y-12">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-l-4 border-amber-500 pl-4 sm:pl-6 py-2 mb-6">
                <div>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
                    {selectedDate ? format(selectedDate, 'MMM do') : `${format(currentMonth, 'MMMM yyyy')} Overview`}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest leading-none">
                      {selectedDate ? format(selectedDate, 'EEEE, yyyy') : "All Monthly Active Alerts & Incidents"}
                    </p>
                    {selectedDate && (() => {
                      const holiday = getSriLankanHoliday(selectedDate);
                      if (holiday) {
                        return (
                          <span className="px-2 py-0.5 text-[8px] font-black tracking-widest uppercase bg-amber-100 text-amber-800 border border-amber-200 rounded leading-none">
                            {holiday.name} ({holiday.type})
                          </span>
                        );
                      }
                      if (isSunday(selectedDate)) {
                        return (
                          <span className="px-2 py-0.5 text-[8px] font-black tracking-widest uppercase bg-blue-50 text-blue-800 border border-blue-200 rounded leading-none">
                            Sunday (Non-Working)
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
                      {pendingReports.length} 
                    </span>
                    <span className="text-[10px] sm:text-xs font-black text-slate-300 uppercase tracking-widest leading-none">Pending Alerts</span>
                  </div>
                  {selectedDate && (
                    <button 
                      onClick={() => setSelectedDate(null)}
                      className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
                    >
                      Show Full Month
                    </button>
                  )}
                </div>
              </div>

              {FACTORIES.map(dept => {
                const deptReports = pendingReports.filter(r => 
                  r.department === dept || (dept === 'Other' && SUB_LOCATIONS.includes(r.department))
                );
                if (deptReports.length === 0) return null;

                return (
                  <div key={dept} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-slate-200" />
                      <h2 className="text-2xl font-black text-slate-400 uppercase tracking-[0.2em]">{dept === 'Other' ? dept : dept + ' Factory'}</h2>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {deptReports.map((report) => (
                        <motion.div 
                          key={report.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white border-2 border-slate-900 rounded-[32px] p-8 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-all"
                        >
                          <div className="absolute top-0 right-0 p-6 opacity-5 text-slate-900 text-7xl font-black italic select-none">
                            !
                          </div>
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="bg-singer-red text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                  {report.workType}
                                </span>
                                {!selectedDate && (
                                  <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest font-mono">
                                    {format(new Date(report.createdAt), 'yyyy-MM-dd')}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tighter mt-1" dangerouslySetInnerHTML={{ __html: report.machineName || 'Unknown Machine' }} />
                            </div>
                            <div className="flex gap-2">
                              {editingReportId === report.id ? (
                                <button 
                                  onClick={async () => {
                                    setIsTranslating(true);
                                    try {
                                      const translated = await translateToEnglish(editDescription);
                                      setEditDescription(translated);
                                      await onUpdateReport(report.id, { description: translated });
                                    } catch (error) {
                                      console.error("Auto translation failed", error);
                                      await onUpdateReport(report.id, { description: editDescription });
                                    } finally {
                                      setIsTranslating(false);
                                      setEditingReportId(null);
                                    }
                                  }}
                                  disabled={isTranslating}
                                  className="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all border-2 border-blue-100 hover:border-slate-900 shadow-sm disabled:opacity-50"
                                  title="Save Changes"
                                >
                                  {isTranslating ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                                </button>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setEditingReportId(report.id);
                                    setEditDescription(report.description);
                                  }}
                                  className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-2xl transition-all border-2 border-slate-100 hover:border-slate-900 shadow-sm"
                                  title="Edit Description"
                                >
                                  <Edit2 size={24} />
                                </button>
                              )}
                              <button 
                                onClick={() => onUpdateReport(report.id, { status: 'addressed' })}
                                className="w-12 h-12 flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-2xl transition-all border-2 border-green-100 hover:border-slate-900 shadow-sm group/check"
                                title="Mark as Addressed"
                              >
                                <CheckCircle2 size={24} className="group-hover/check:scale-110 transition-transform" />
                              </button>
                              {onDeleteReport && (
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirmingReportId === report.id) {
                                      try {
                                        await onDeleteReport(report.id);
                                        setConfirmingReportId(null);
                                      } catch (err) {
                                        console.error("Failed to delete report:", err);
                                      }
                                    } else {
                                      setConfirmingReportId(report.id);
                                      // Reset after 3 seconds
                                      setTimeout(() => setConfirmingReportId(null), 3000);
                                    }
                                  }}
                                  className={cn(
                                    "w-12 h-12 flex items-center justify-center rounded-2xl transition-all border-2 shadow-sm group/trash",
                                    confirmingReportId === report.id 
                                      ? "bg-red-600 text-white border-slate-900 scale-110" 
                                      : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white hover:border-slate-900"
                                  )}
                                  title={confirmingReportId === report.id ? "Click Again to Delete" : "Delete Report"}
                                >
                                  <Trash2 size={20} className={cn("transition-transform", confirmingReportId === report.id ? "rotate-12 scale-110" : "group-hover/trash:scale-110")} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Record Creation Date and Time Metadata Block */}
                          <div className="grid grid-cols-2 gap-4 mb-4 bg-amber-50 border-2 border-amber-200 p-4 rounded-[20px] relative z-10 shadow-sm">
                            <div>
                              <span className="block text-[9px] font-black uppercase text-amber-800 tracking-wider mb-0.5 leading-none">Date</span>
                              <span className="block font-mono font-black text-slate-900 text-sm">
                                {format(new Date(report.createdAt), 'yyyy-MM-dd')}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase text-amber-800 tracking-wider mb-0.5 leading-none">Time</span>
                              <span className="block font-mono font-black text-slate-900 text-sm font-bold">
                                {formatTime(report.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Department Display */}
                          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-500 relative z-10">
                            <span className="uppercase tracking-wider text-[9px] text-slate-400">Department:</span>
                            <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                              {report.department}
                            </span>
                          </div>
                          
                          <div className="bg-slate-50 rounded-[24px] p-6 mb-6 relative z-10 border-2 border-transparent group-hover:border-slate-100 transition-colors">
                            {editingReportId === report.id ? (
                              <div className="space-y-4">
                                <div className="flex justify-end p-2 pb-0">
                                  <AITranslationTool 
                                    value={editDescription} 
                                    onTranslated={(translated) => setEditDescription(translated)} 
                                  />
                                </div>
                                <textarea
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 font-sans text-base focus:border-singer-red outline-none min-h-[100px] resize-none"
                                  autoFocus
                                />
                                {report.shift && report.shift !== 'None Shift' && (
                                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <span className="uppercase tracking-wider text-[10px] text-slate-400">Work Shift:</span>
                                    <span className="font-mono bg-slate-200/60 px-2.5 py-0.5 rounded text-slate-700">{report.shift}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-base font-bold text-slate-600 italic leading-relaxed">"{report.description}"</p>
                                {report.shift && report.shift !== 'None Shift' && (
                                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <span className="uppercase tracking-wider text-[10px] text-slate-400">Work Shift:</span>
                                    <span className="font-mono bg-slate-200/60 px-2.5 py-0.5 rounded text-slate-700">{report.shift}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-300 relative z-10">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-singer-red rounded-full animate-pulse" />
                              Logged: {selectedDate ? '' : `${format(new Date(report.createdAt), 'yyyy-MM-dd')} @ `}{formatTime(report.createdAt)}
                            </div>
                            <span>ID: {report.id.toUpperCase()}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {pendingReports.length === 0 && (
                <div className="py-24 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-6">
                    <CheckCircle2 size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-300 uppercase tracking-widest">No Pending Tasks</h3>
                  <p className="text-slate-400 font-medium italic mt-2 text-sm">No operational reports found for this selection.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'completed' && (
          <motion.div
            key="completed-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"
          >
            {/* Calendar Column */}
            <div className="lg:col-span-4 space-y-6 sm:space-y-8">
              <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-xl sm:shadow-2xl border-2 border-slate-100 overflow-hidden">
                <div className="p-6 sm:p-8 bg-slate-900 text-white flex justify-between items-center border-b-4 border-singer-red">
                  <h2 className="font-black text-xl sm:text-2xl uppercase tracking-tighter italic">{format(currentMonth, 'MMMM yyyy')}</h2>
                  <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-2 sm:p-3 hover:bg-white/10 rounded-xl transition-all"><ChevronLeft size={20}/></button>
                    <button onClick={nextMonth} className="p-2 sm:p-3 hover:bg-white/10 rounded-xl transition-all"><ChevronRight size={20}/></button>
                  </div>
                </div>
                
                <div className="p-4 sm:p-8 bg-white">
                  <div className="grid grid-cols-7 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center text-[9px] sm:text-[10px] font-black text-slate-300 uppercase py-2 tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                      <div key={`p-${i}`} className="aspect-square" />
                    ))}
                    {days.map(day => {
                      const hasRecords = records.some(r => isSameDay(new Date(r.date), day));
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const holiday = getSriLankanHoliday(day);
                      const isSun = isSunday(day);

                      let bgClass = "hover:bg-slate-50 text-slate-700";
                      
                      if (holiday) {
                        bgClass = "bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold border border-amber-300";
                      } else if (isSun) {
                        bgClass = "bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200";
                      }

                      if (isSelected) {
                        bgClass = "bg-singer-red text-white shadow-lg sm:shadow-xl shadow-singer-red/20 scale-105 sm:scale-110 z-10";
                      }

                      return (
                        <button
                          key={day.toString()}
                          onClick={() => setSelectedDate(day)}
                          title={holiday ? `${holiday.name} (${holiday.type})` : isSun ? "Sunday" : undefined}
                          className={cn(
                            "relative flex items-center justify-center aspect-square rounded-xl sm:rounded-2xl text-sm sm:text-base font-black transition-all",
                            bgClass,
                            isToday(day) && !isSelected && "ring-2 ring-singer-red/20",
                          )}
                        >
                          {format(day, 'd')}
                          {hasRecords && !isSelected && (
                            <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-1 sm:h-1.5 sm:w-1.5 h-1 bg-singer-red rounded-full shadow-[0_0_8px_rgba(211,47,47,0.5)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Calendar Color Legend */}
                  <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-wider relative z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-lg bg-blue-50 border border-blue-200 block" />
                      <span className="text-slate-500">Sunday (Blue)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-lg bg-amber-100 border border-amber-300 block" />
                      <span className="text-slate-500">Holiday (Yellow)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border-2 border-slate-100 overflow-x-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Filter size={18} /></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Division Filter</span>
                </div>
                <div className="flex sm:grid sm:grid-cols-1 gap-2 pb-2 sm:pb-0 overflow-x-auto sm:overflow-x-visible no-scrollbar">
                  <button 
                    onClick={() => setFilterDept('All')}
                    className={cn(
                      "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-left transition-all whitespace-nowrap min-w-[120px] sm:min-w-0 flex-shrink-0",
                      filterDept === 'All' ? "bg-slate-900 text-white shadow-lg sm:translate-x-1" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    Global Audit
                  </button>
                  {FACTORIES.map(dept => (
                    <button 
                      key={dept}
                      onClick={() => setFilterDept(dept)}
                      className={cn(
                        "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-left transition-all whitespace-nowrap min-w-[120px] sm:min-w-0 flex-shrink-0",
                        filterDept === dept ? "bg-singer-red text-white shadow-lg sm:translate-x-1" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      {dept} Sector
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Records Detail Column */}
            <div className="lg:col-span-8">
              <motion.div 
                key={(selectedDate?.toString() || 'all-month') + filterDept}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                  <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-l-4 border-singer-red pl-4 sm:pl-6 py-2">
                  <div>
                    <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
                      {selectedDate ? format(selectedDate, 'MMM do') : `${format(currentMonth, 'MMMM yyyy')} Overview`}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest leading-none">
                        {selectedDate ? format(selectedDate, 'EEEE, yyyy') : "Full Month Records Archive"}
                      </p>
                        {selectedDate && (() => {
                          const holiday = getSriLankanHoliday(selectedDate);
                          if (holiday) {
                            return (
                              <span className="px-2 py-0.5 text-[8px] font-black tracking-widest uppercase bg-amber-100 text-amber-800 border border-amber-200 rounded leading-none">
                                {holiday.name} ({holiday.type})
                              </span>
                            );
                          }
                          if (isSunday(selectedDate)) {
                            return (
                              <span className="px-2 py-0.5 text-[8px] font-black tracking-widest uppercase bg-blue-50 text-blue-800 border border-blue-200 rounded leading-none">
                                Sunday (Non-Working)
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
                          {dailyRecords.length} 
                        </span>
                        <span className="text-[10px] sm:text-xs font-black text-slate-300 uppercase tracking-widest leading-none">Events Logged</span>
                      </div>
                      {selectedDate && dailyRecords.length > 0 && onDeleteRecord && (
                        <button 
                          onClick={async () => {
                            if (confirmingClearDate) {
                              for (const record of dailyRecords) {
                                await onDeleteRecord(record.id);
                              }
                              setConfirmingClearDate(false);
                            } else {
                              setConfirmingClearDate(true);
                              setTimeout(() => setConfirmingClearDate(false), 3000);
                            }
                          }}
                          className={cn(
                            "px-4 py-2 border-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm",
                            confirmingClearDate 
                              ? "bg-red-600 text-white border-slate-900 scale-105" 
                              : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white"
                          )}
                        >
                          {confirmingClearDate ? "Confirm Wipe Out?" : "Clear Date"}
                        </button>
                      )}
                      {selectedDate && (
                        <button 
                          onClick={() => setSelectedDate(null)}
                          className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          Show Full Month
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                    {dailyRecords.length > 0 ? (
                      dailyRecords.map(record => (
                        <div key={record.id} className="group bg-white p-6 sm:p-10 rounded-[24px] sm:rounded-[40px] shadow-lg border-2 border-slate-50 hover:border-slate-900 hover:shadow-2xl transition-all relative overflow-hidden">
                          <div className="flex flex-col md:flex-row justify-between gap-6 sm:gap-8 relative z-10">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="bg-slate-900 text-white px-2 sm:px-3 py-1 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                                    {record.department}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] sm:text-[10px] font-black px-2 sm:px-3 py-1 rounded uppercase tracking-widest",
                                    "bg-singer-red/10 text-singer-red"
                                  )}>
                                    {record.workType}
                                  </span>
                                  {!selectedDate && (
                                    <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 sm:px-3 py-1 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-widest font-mono">
                                      {format(new Date(record.date), 'yyyy-MM-dd')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {editingDateRecordId === record.id ? (
                                    <div className="flex items-center gap-2 bg-white border-2 border-slate-900 p-1.5 rounded-xl shadow-lg animate-in fade-in zoom-in duration-200">
                                      <input 
                                        type="date" 
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="bg-slate-50 border-none rounded-lg px-3 py-1.5 font-bold text-xs uppercase tracking-wider outline-none focus:ring-2 ring-singer-red/20"
                                      />
                                      <button 
                                        onClick={async () => {
                                          if (!editDate) return;
                                          const newDate = new Date(editDate);
                                          await onUpdateRecord(record.id, { date: newDate.toISOString() });
                                          setEditingDateRecordId(null);
                                        }}
                                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-slate-900 transition-colors"
                                        title="Save Date"
                                      >
                                        <Save size={16} />
                                      </button>
                                      <button 
                                        onClick={() => setEditingDateRecordId(null)}
                                        className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                                        title="Cancel"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setEditingDateRecordId(record.id);
                                        setEditDate(format(new Date(record.date), 'yyyy-MM-dd'));
                                      }}
                                      className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-xl transition-all border-2 border-slate-100 hover:border-slate-900 shadow-sm"
                                      title="Change Date"
                                    >
                                      <CalendarIcon size={20} />
                                    </button>
                                  )}

                                  {editingRecordId === record.id ? (
                                    <button 
                                      onClick={async () => {
                                        setIsTranslating(true);
                                        try {
                                          const translated = await translateToEnglish(editDescription);
                                          setEditDescription(translated);
                                          await onUpdateRecord(record.id, { description: translated });
                                        } catch (error) {
                                          console.error("Auto translation failed", error);
                                          await onUpdateRecord(record.id, { description: editDescription });
                                        } finally {
                                          setIsTranslating(false);
                                          setEditingRecordId(null);
                                        }
                                      }}
                                      disabled={isTranslating}
                                      className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all border-2 border-blue-100 hover:border-slate-900 shadow-sm disabled:opacity-50"
                                      title="Save Changes"
                                    >
                                      {isTranslating ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setEditingRecordId(record.id);
                                        setEditDescription(record.description);
                                      }}
                                      className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-xl transition-all border-2 border-slate-100 hover:border-slate-900 shadow-sm"
                                      title="Edit Description"
                                    >
                                      <Edit2 size={20} />
                                    </button>
                                  )}
                                  {onDeleteRecord && (
                                    <button 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirmingRecordId === record.id) {
                                          try {
                                            await onDeleteRecord(record.id);
                                            setConfirmingRecordId(null);
                                          } catch (err) {
                                            console.error("Failed to delete record:", err);
                                          }
                                        } else {
                                          setConfirmingRecordId(record.id);
                                          setTimeout(() => setConfirmingRecordId(null), 3000);
                                        }
                                      }}
                                      className={cn(
                                        "w-10 h-10 flex items-center justify-center rounded-xl transition-all border-2 shadow-sm group/trash",
                                        confirmingRecordId === record.id 
                                          ? "bg-red-600 text-white border-slate-900 scale-110" 
                                          : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white"
                                      )}
                                      title={confirmingRecordId === record.id ? "Confirm Delete" : "Delete Record"}
                                    >
                                      <Trash2 size={18} className={cn("transition-transform", confirmingRecordId === record.id ? "rotate-12 scale-110" : "group-hover/trash:scale-110")} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase group-hover:text-singer-red transition-colors italic leading-tight" dangerouslySetInnerHTML={{ __html: record.machineName || 'Unknown Machine' }} />
                              <div className="bg-slate-50 rounded-[20px] p-6 relative z-10 border-2 border-transparent group-hover:border-slate-100 transition-colors">
                                {editingRecordId === record.id ? (
                                  <div className="space-y-4">
                                    <div className="flex justify-end p-2 pb-0">
                                      <AITranslationTool 
                                        value={editDescription} 
                                        onTranslated={(translated) => setEditDescription(translated)} 
                                      />
                                    </div>
                                    <textarea
                                      value={editDescription}
                                      onChange={(e) => setEditDescription(e.target.value)}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 font-sans text-base focus:border-singer-red outline-none min-h-[100px] resize-none"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <p className="text-slate-500 font-medium text-base sm:text-lg leading-relaxed border-l-2 border-slate-100 pl-4 sm:pl-6 italic">"{record.description}"</p>
                                )}
                              </div>
                            </div>

                            <div className="md:text-right flex flex-row md:flex-col justify-between shrink-0 items-end md:items-stretch border-t md:border-t-0 md:border-l border-slate-50 pt-4 md:pt-0 md:pl-8">
                              <div>
                                <div className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">{record.duration}</div>
                                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Net Minutes</div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{formatTimeRange(record.startTime, record.finishTime)}</div>
                                <div className="text-[10px] sm:text-sm font-black text-slate-900 uppercase italic tracking-tight">LOGGED BY {record.maintainerName}</div>
                                {record.shift && (
                                  <div className="text-[9px] font-black text-singer-red uppercase tracking-widest mt-1">SHIFT: {record.shift}</div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Decorative background element */}
                          <div className="absolute bottom-0 right-0 text-slate-50 text-6xl sm:text-8xl font-black translate-x-1/4 translate-y-1/4 group-hover:text-singer-red/5 select-none pointer-events-none transition-colors">
                            {record.id.substr(0, 3).toUpperCase()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-[32px] sm:rounded-[40px] p-12 sm:p-24 text-center border-4 border-dashed border-slate-100">
                        <CalendarIcon size={48} className="mx-auto text-slate-100 mb-4 sm:mb-6" />
                        <p className="text-slate-300 font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] text-base sm:text-lg">No Operational Data</p>
                        <p className="text-slate-400 font-medium mt-2 text-xs sm:text-sm italic">Historical records show silence on this selection.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analysis' && (
          <motion.div
            key="analysis-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            {/* Header and Month Controls */}
            <div className="bg-white p-8 rounded-[32px] border-2 border-slate-900 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
                    <Activity className="text-singer-red animate-pulse" size={32} />
                    Machine Analysis
                  </h2>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">OPERATIONAL HEALTH & RELIABILITY DIAGNOSTICS</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-slate-200">
                  <button onClick={prevMonth} className="p-3 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"><ChevronLeft size={20}/></button>
                  <span className="font-black uppercase tracking-tighter text-slate-900 px-4 min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                  <button onClick={nextMonth} className="p-3 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"><ChevronRight size={20}/></button>
                </div>
              </div>

              {/* Grid 1: Select Factory */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">1. Select Factory Portal</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {FACTORIES.map(dept => (
                    <button
                      key={dept}
                      onClick={() => {
                        setSelectedAnalysisDept(dept);
                        setSelectedAnalysisSection('All');
                        setFocusedMachineDetailId(null);
                      }}
                      className={cn(
                        "px-4 py-3.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-1.5",
                        selectedAnalysisDept === dept 
                          ? "bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.03]" 
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900 shadow-sm"
                      )}
                    >
                      <span className="text-[9px] text-slate-400 group-hover:text-amber-500 font-bold">DEPT</span>
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Factory Summary Statistics Area (UX Step 1) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-[28px] border-2 border-slate-100 shadow-md flex items-center justify-between"
              >
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Machines Registered</h4>
                  <p className="text-4xl font-black italic text-slate-900 tracking-tighter">{factorySummaryStats.totalMachines}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Operational Nodes</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Settings className="animate-spin-slow w-6 h-6" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-[28px] border-2 border-slate-100 shadow-md flex items-center justify-between"
              >
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Downtime</h4>
                  <p className="text-4xl font-black italic text-slate-900 tracking-tighter">{formatHoursDisplay(factorySummaryStats.totalDowntimeHours)}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Accumulated Repair/Service Hours</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-[28px] border-2 border-slate-100 shadow-md flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Maintenance Spikes</h4>
                  <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">{factorySummaryStats.totalMaintenanceCount} Logged</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                  <div className="bg-red-50 p-1.5 rounded-lg border border-red-100">
                    <span className="block text-[8px] font-black text-red-500 uppercase leading-none">Break</span>
                    <span className="text-xs font-black text-red-700">{factorySummaryStats.totalBreakdowns}</span>
                  </div>
                  <div className="bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                    <span className="block text-[8px] font-black text-blue-500 uppercase leading-none">Serv</span>
                    <span className="text-xs font-black text-blue-700">{factorySummaryStats.totalServices}</span>
                  </div>
                  <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                    <span className="block text-[8px] font-black text-amber-500 uppercase leading-none">Rep</span>
                    <span className="text-xs font-black text-amber-700">{factorySummaryStats.totalRepairs}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Section Breakdown Category Filter (UX Step 2) */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Category breakdown & Selection</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Select specific diagnostic sector to narrow focus</p>
                </div>
                <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider px-3 py-1 bg-slate-50 rounded-lg">
                  Scope: {selectedAnalysisDept === 'Solid' ? `${selectedAnalysisDept} Factory Sub-Sectors` : `${selectedAnalysisDept} Division All`}
                </div>
              </div>

              {selectedAnalysisDept === 'Solid' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'All' as const, label: 'All Sectors', count: machines.filter(m => m.department === 'Solid').length, icon: Layers, color: 'border-slate-300 text-slate-800' },
                    { id: 'Main Solid' as const, label: 'Main Solid', count: machines.filter(m => m.department === 'Solid' && getSolidSection(m) === 'Main Solid').length, icon: Hammer, color: 'border-emerald-300 text-emerald-800' },
                    { id: 'Machine Section' as const, label: 'Machine Section', count: machines.filter(m => m.department === 'Solid' && getSolidSection(m) === 'Machine Section').length, icon: Cog, color: 'border-indigo-300 text-indigo-800' },
                    { id: 'Paint Section' as const, label: 'Paint Section', count: machines.filter(m => m.department === 'Solid' && getSolidSection(m) === 'Paint Section').length, icon: Paintbrush, color: 'border-amber-300 text-amber-800' },
                  ].map(sec => {
                    const isSelected = selectedAnalysisSection === sec.id;
                    const Icon = sec.icon;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => {
                          setSelectedAnalysisSection(sec.id);
                          setFocusedMachineDetailId(null);
                        }}
                        className={cn(
                          "group p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between gap-3 min-h-[72px]",
                          isSelected 
                            ? "border-slate-950 bg-slate-950 text-white shadow-lg scale-102" 
                            : "border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white text-slate-600"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                            isSelected ? "bg-slate-800 border-slate-700 text-white" : "bg-white text-slate-800"
                          )}>
                            <Icon size={18} className={cn(isSelected && sec.id === 'Machine Section' && "animate-spin-slow")} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider">{sec.label}</div>
                            <div className="text-xs font-bold opacity-60 mt-0.5">{sec.count} Machine{sec.count !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-singer-red" : "bg-transparent")} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Division contains standard workspace layout</p>
                  <p className="text-slate-500 font-semibold italic text-xs mt-1">Showing all operational sub-systems for {selectedAnalysisDept} factory.</p>
                </div>
              )}
            </div>

            {/* Grid 2: Machine-wise Cards (UX Step 3) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Machine Nodes List</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Select a diagnostic node for live history analysis</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{analyzedMachines.length} nodes resolved</span>
              </div>

              {analyzedMachines.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {analyzedMachines.map(mach => {
                    const hasAlert = reports.some(r => r.machineId === mach.id && r.status === 'pending');
                    
                    // Efficiency color coding
                    let effColor = "text-emerald-600 bg-emerald-50 border-emerald-200";
                    let effStatus = "EXCELLENT";
                    if (mach.efficiencyPercentage < 80) {
                      effColor = "text-red-500 bg-red-50 border-red-200";
                      effStatus = "UNDER REPAIR";
                    } else if (mach.efficiencyPercentage < 95) {
                      effColor = "text-amber-500 bg-amber-50 border-amber-200";
                      effStatus = "OPTIMAL";
                    }

                    return (
                      <motion.div
                        key={mach.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setFocusedMachineDetailId(mach.id)}
                        className="group bg-white rounded-[32px] p-6 border-2 border-slate-100 hover:border-slate-900 shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden text-left"
                      >
                        {/* Status Alert Pulsing bar */}
                        {hasAlert && (
                          <div className="absolute top-0 left-0 right-0 h-1.5 bg-singer-red animate-pulse" />
                        )}

                        <div className="space-y-4">
                          {/* Top part: Image and efficiency wheel */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center shadow-inner relative">
                              {mach.image ? (
                                <img 
                                  src={mach.image} 
                                  alt={mach.name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Settings className="text-slate-300 w-8 h-8 group-hover:rotate-45 transition-transform" />
                              )}
                              {hasAlert && (
                                <div className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-singer-red rounded-full flex items-center justify-center text-white border-2 border-white animate-bounce">
                                  <AlertCircle size={8} />
                                </div>
                              )}
                            </div>

                            <div className={cn("px-3.5 py-2.5 rounded-2xl border text-center font-black flex flex-col items-center justify-center min-w-[70px]", effColor)}>
                              <span className="text-xl tabular-nums leading-none tracking-tighter">{mach.efficiencyPercentage}%</span>
                              <span className="text-[7.5px] tracking-widest mt-0.5 leading-none">{effStatus}</span>
                            </div>
                          </div>

                          {/* Machine Meta */}
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center flex-wrap gap-1.5">
                              <span>ID: {mach.id.substring(0, 8)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[#3b82f6]">{mach.section}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">Goal: {mach.baseHours}h</span>
                            </div>
                            <h4 className="text-lg font-black text-slate-900 group-hover:text-singer-red transition-colors uppercase tracking-tight leading-tight mt-1 truncate" dangerouslySetInnerHTML={{ __html: mach.name }} />
                          </div>

                          {/* Key Statistics Grid */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                            <div>
                              <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Operational</div>
                              <div className="text-[13px] font-black text-slate-800 tracking-tight mt-0.5">{formatHoursDisplay(mach.runningHours)}</div>
                            </div>
                            <div>
                              <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Downtime</div>
                              <div className={cn("text-[13px] font-black tracking-tight mt-0.5", mach.downtimeHours > 0 ? "text-red-600" : "text-slate-800")}>{formatHoursDisplay(mach.downtimeHours)}</div>
                            </div>
                            <div>
                              <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Events</div>
                              <div className="text-[13px] font-black text-slate-800 tracking-tight mt-0.5">{mach.maintenanceCount}</div>
                            </div>
                          </div>

                          {/* Compact Stacked Heatmap Bar (Mini chart) */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest px-0.5">
                              <span>Event Ratio Chart</span>
                              <span>Total: {mach.maintenanceCount}</span>
                            </div>
                            {mach.maintenanceCount > 0 ? (
                              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                                {mach["Broke Down"] > 0 && (
                                  <div 
                                    className="h-full bg-red-500 transition-all duration-300 relative group/seg" 
                                    style={{ width: `${(mach["Broke Down"] / mach.maintenanceCount) * 100}%` }}
                                    title={`Breakdowns: ${mach["Broke Down"]}`}
                                  />
                                )}
                                {mach["Serviced"] > 0 && (
                                  <div 
                                    className="h-full bg-blue-500 transition-all duration-300" 
                                    style={{ width: `${(mach["Serviced"] / mach.maintenanceCount) * 100}%` }}
                                    title={`Services: ${mach["Serviced"]}`}
                                  />
                                )}
                                {mach["Repaired"] > 0 && (
                                  <div 
                                    className="h-full bg-amber-500 transition-all duration-300" 
                                    style={{ width: `${(mach["Repaired"] / mach.maintenanceCount) * 100}%` }}
                                    title={`Repairs: ${mach["Repaired"]}`}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="h-2 w-full rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-semibold text-slate-300 tracking-widest uppercase">
                                SILENT NODE
                              </div>
                            )}
                            <div className="flex gap-2 text-[7.5px] font-bold text-slate-400 uppercase tracking-wider justify-center pt-1">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Break: {mach["Broke Down"]}</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Serv: {mach["Serviced"]}</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Rep: {mach["Repaired"]}</span>
                            </div>
                          </div>
                        </div>

                        {/* Diagnose Action Footer */}
                        <div className="mt-5 border-t border-slate-50 pt-3 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 group-hover:text-singer-red transition-colors pt-4 w-full">
                          <span>Diagnostic Health Check</span>
                          <span className="group-hover:translate-x-1.5 transition-transform flex items-center gap-1 text-slate-900 group-hover:text-singer-red">
                            DIAGNOSE <ChevronRight size={14} />
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-24 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                    <BarChart3 size={36} />
                  </div>
                  <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">No matching diagnostic nodes</h3>
                  <p className="text-slate-400 font-medium italic mt-1.5 text-xs">Try selecting a different filter segment or factory division.</p>
                </div>
              )}
            </div>

            {/* UX Step 4: Diagnostic Modal (AnimatePresence Overlay) */}
            <AnimatePresence>
              {focusedMachineDetailId && (() => {
                const fMach = analyzedMachines.find(m => m.id === focusedMachineDetailId);
                if (!fMach) return null;
                
                // Detailed data for the specific machine Recharts chart
                const chartData = [
                  { name: 'Break Down', count: fMach["Broke Down"], fill: '#ef4444' },
                  { name: 'Service', count: fMach["Serviced"], fill: '#3b82f6' },
                  { name: 'Repair', count: fMach["Repaired"], fill: '#f59e0b' },
                ];

                return (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                    onClick={() => setFocusedMachineDetailId(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.95, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 20 }}
                      transition={{ type: 'spring', duration: 0.5 }}
                      className="bg-white border-2 border-slate-950 w-full max-w-5xl rounded-[36px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="bg-slate-900 p-6 sm:p-8 text-white flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-singer-red flex items-center justify-center text-white">
                            <Activity size={24} className="animate-pulse" />
                          </div>
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Telemetry Unit Diagnostic</div>
                            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white mt-1" dangerouslySetInnerHTML={{ __html: fMach.name }} />
                          </div>
                        </div>
                        <button 
                          onClick={() => setFocusedMachineDetailId(null)}
                          className="p-3 bg-slate-800 hover:bg-singer-red text-white transition-all rounded-full border border-slate-700"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Modal Scrollable Body */}
                      <div className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-1">
                        
                        {/* Summary Bento Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Primary Efficiency</span>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-4xl font-black text-slate-900 italic">{fMach.efficiencyPercentage}%</span>
                            </div>
                            <span className="text-[8px] font-medium text-slate-400 mt-1 uppercase">Standard operational uptime</span>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Active Run Hours</span>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-4xl font-black text-slate-900 italic">{formatHoursDisplay(fMach.runningHours)}</span>
                            </div>
                            <span className="text-[8px] font-medium text-slate-400 mt-1 uppercase">Estimated productive nodes</span>
                          </div>

                          <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex flex-col justify-between">
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">Maintenance Downtime</span>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-4xl font-black text-red-600 italic">{formatHoursDisplay(fMach.downtimeHours)}</span>
                            </div>
                            <span className="text-[8px] font-medium text-red-400 mt-1 uppercase">Uptime deflection hours</span>
                          </div>

                          <div className="p-4 bg-slate-900 rounded-2xl text-white flex flex-col justify-between relative overflow-hidden">
                            <Settings className="absolute -bottom-6 -right-6 w-24 h-24 text-slate-800 opacity-20 animate-spin-slow" />
                            <div className="relative z-10">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Service Frequency</span>
                              <div className="mt-2">
                                <span className="text-4xl font-black text-white italic">{fMach.maintenanceCount}</span>
                              </div>
                            </div>
                            <span className="text-[8px] font-medium text-slate-400 mt-1 uppercase relative z-10">Maintenance logs resolved</span>
                          </div>
                        </div>

                        {/* Main Analysis Visual Block */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                          
                          {/* Recharts chart on the left */}
                          <div className="lg:col-span-3 border border-slate-200/80 rounded-3xl p-6 bg-white space-y-4">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                              <TrendingUp size={16} className="text-singer-red" />
                              Uptime Deflection Breakdown
                            </h4>
                            <div className="h-64 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                                  <Tooltip 
                                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                                    contentStyle={{ 
                                      borderRadius: '12px', 
                                      border: '2px solid #0f172a',
                                      fontSize: '11px',
                                      fontWeight: '900',
                                      textTransform: 'uppercase'
                                    }}
                                  />
                                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={45}>
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Mini Details card */}
                          <div className="lg:col-span-2 border border-slate-200/80 rounded-3xl p-6 bg-slate-50 flex flex-col justify-between">
                            <div className="space-y-4">
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2">Unit Blueprint Overview</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs pb-1 border-b border-white">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">ID Record</span>
                                  <span className="font-semibold text-slate-800">{fMach.id}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pb-1 border-b border-white">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">Factory Segment</span>
                                  <span className="font-semibold text-slate-800">{selectedAnalysisDept} Factory</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pb-1 border-b border-white">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">Sub Area Node</span>
                                  <span className="font-semibold text-[#2563eb]">{fMach.section}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pb-1 border-b border-white">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">Active Alerts</span>
                                  <span className={cn(
                                    "font-black px-2.5 py-0.5 rounded-full text-[10px]",
                                    reports.some(r => r.machineId === fMach.id && r.status === 'pending')
                                      ? "bg-red-100 text-red-600 animate-pulse" 
                                      : "bg-emerald-100 text-emerald-600"
                                  )}>
                                    {reports.some(r => r.machineId === fMach.id && r.status === 'pending') ? 'PENDING DISPATCH' : 'SYSTEM HEALTHY'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-xs pb-1 border-b border-white pt-1">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">Expected Target</span>
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="number"
                                      min="1"
                                      max="720"
                                      value={customMachineTargetHours[fMach.id] ?? 200}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val > 0) {
                                          saveCustomTargetHours(fMach.id, val);
                                        }
                                      }}
                                      className="w-16 text-right bg-white border-2 border-slate-300 rounded-lg px-2 py-0.5 text-xs font-black text-slate-800 focus:outline-none focus:border-slate-800"
                                    />
                                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">hrs</span>
                                  </div>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-slate-100/55">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Target Hours Presets:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[80, 120, 160, 200, 240, 300].map((h) => (
                                      <button
                                        key={h}
                                        onClick={() => saveCustomTargetHours(fMach.id, h)}
                                        className={cn(
                                          "px-2.5 py-1 rounded-xl text-[9px] font-black border-2 transition-all shadow-sm",
                                          (customMachineTargetHours[fMach.id] ?? 200) === h
                                            ? "bg-slate-900 border-slate-900 text-white font-extrabold scale-105"
                                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-900 hover:text-slate-900"
                                        )}
                                      >
                                        {h}h
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => setFocusedMachineDetailId(null)}
                              className="w-full bg-slate-900 hover:bg-singer-red text-white py-3 border border-transparent rounded-xl text-xs font-black uppercase tracking-wider transition-colors mt-6 shadow-md"
                            >
                              DISMISS METRIC LOGS
                            </button>
                          </div>
                        </div>

                        {/* Scrollable Timeline logs of actual records */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b pb-2">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                              <CalendarIcon size={16} />
                              Historical Maintenance Logs Timeline ({format(currentMonth, 'MMMM')})
                            </h4>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{fMach.records.length} Records</span>
                          </div>

                          <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                            {fMach.records.length > 0 ? (
                              fMach.records.map((record) => (
                                <div 
                                  key={record.id}
                                  className="p-4 bg-white border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-900 transition-colors"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white",
                                        record.workType === 'Break Down' ? "bg-red-500" :
                                        record.workType === 'Service' ? "bg-blue-500" : "bg-amber-500"
                                      )}>
                                        {record.workType}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(record.date)}</span>
                                      {record.shift && (
                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{record.shift}</span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-700 italic">" {record.description} "</p>
                                  </div>

                                  <div className="flex sm:flex-col items-end gap-x-3 text-right shrink-0">
                                    <span className="text-sm font-black text-slate-900">{record.duration} mins</span>
                                    <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">By {record.maintainerName}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs italic">
                                No historical downtime elements registered for this machine in the operational envelope.
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'map' && (
          <motion.div
            key="factory-floor-map-dev"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            <div className="bg-white p-12 rounded-[40px] border-2 border-slate-100 shadow-xl relative overflow-hidden text-center max-w-2xl mx-auto my-12">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-slate-900 text-6xl sm:text-[10rem] font-black italic select-none pointer-events-none">
                SOON
              </div>
              <div className="relative z-10 flex flex-col items-center space-y-6 py-6">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center animate-pulse">
                  <MapIcon size={32} />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-singer-red uppercase leading-none block">
                    Feature Under Development
                  </span>
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tighter uppercase italic leading-tight">
                    Interactive <span className="text-singer-red">Floor Map</span>
                  </h2>
                </div>
                <div className="w-12 h-1 bg-slate-200" />
                <p className="text-base font-semibold text-slate-500 leading-relaxed max-w-md">
                  We are actively developing and improving the spatial floor mapping feature. This system will offer real-time machine layouts and interactive telemetry. It will be available in a future system update.
                </p>
                <div className="text-[10px] font-black text-slate-350 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                  Singer Maintenance System © 2026
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
