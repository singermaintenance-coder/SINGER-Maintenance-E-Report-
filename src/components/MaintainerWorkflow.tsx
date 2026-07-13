import { useState, useEffect, useMemo } from 'react';
import { User, MaintenanceRecord, Factory, Machine, WorkType, TimeType, MachineReport, Notification } from '../types';
import { FACTORIES, SUB_LOCATIONS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Settings, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Square,
  Wrench,
  Stethoscope,
  LayoutGrid,
  Layers,
  Droplets,
  TreeDeciduous,
  Sofa,
  Wind,
  Zap,
  ClipboardList,
  Save,
  ArrowRight,
  ArrowLeft,
  Edit2,
  AlertTriangle,
  Languages,
  Loader2,
  Calendar,
  LogOut,
  Hammer,
  Cog,
  Paintbrush,
  X
} from 'lucide-react';
import { cn, formatTime, formatTimeRange, calculateShiftDuration } from '../lib/utils';
import { format } from 'date-fns';
import { translateToEnglish } from '../services/geminiService';
import AnalogTimePicker from './AnalogTimePicker';
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

export default function MaintainerWorkflow({ 
  user, 
  onSave, 
  onLogout, 
  machines,
  reports = [],
  records = [],
  onUpdateReport,
  notifications = [],
  onMarkNotificationAsRead,
  onDeleteNotification
}: { 
  user: User, 
  onSave: (r: MaintenanceRecord) => void, 
  onLogout: () => void, 
  machines: Machine[],
  reports?: MachineReport[],
  records?: MaintenanceRecord[],
  onUpdateReport?: (id: string, updates: Partial<MachineReport>) => Promise<void>,
  notifications?: Notification[],
  onMarkNotificationAsRead: (id: string, userId: string) => Promise<void>,
  onDeleteNotification?: (id: string) => Promise<void>
}) {
  const [step, setStep] = useState(1);
  const [department, setDepartment] = useState<Factory | null>(null);
  const [selectedSolidSection, setSelectedSolidSection] = useState<'Main Solid' | 'Machine Section' | 'Paint Section' | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [timeType, setTimeType] = useState<TimeType | null>('Now');
  const [startTime, setStartTime] = useState<string>('');
  const [finishTime, setFinishTime] = useState<string>('');
  const [manualStartDate, setManualStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [manualFinishDate, setManualFinishDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'final' | null>(null);

  const [selectedCompletedRecord, setSelectedCompletedRecord] = useState<MaintenanceRecord | null>(null);

  const handleNotificationClick = (notif: Notification) => {
    // 1. Find the associated machine
    const matchedMachine = machines.find(m => m.id === notif.machineId);
    if (!matchedMachine) return;

    // 2. Identify the matching report (MachineReport)
    let report = reports && notif.reportId ? reports.find(r => r.id === notif.reportId) : null;
    
    if (!report && reports) {
      report = reports.find(r => 
        r.machineId === notif.machineId && 
        r.workType === notif.type
      ) || null;
    }

    // 3. Check if the task is already completed (addressed)
    if (report && report.status === 'addressed') {
      const matchRecord = records?.find(rec => 
        rec.machineId === notif.machineId && 
        rec.workType === notif.type &&
        new Date(rec.date).toDateString() === new Date(report!.createdAt).toDateString()
      ) || records?.find(rec => 
        rec.machineId === notif.machineId && 
        rec.workType === notif.type
      );

      if (matchRecord) {
        setSelectedCompletedRecord(matchRecord);
      } else {
        const mockRecord: MaintenanceRecord = {
          id: report.id,
          maintainerName: 'Maintainer',
          role: 'Maintainer',
          department: report.department,
          machineId: report.machineId,
          machineName: report.machineName,
          workType: report.workType,
          timeType: 'Now',
          date: report.createdAt,
          startTime: report.createdAt,
          finishTime: report.createdAt,
          duration: 0,
          description: report.description || 'Completed Maintenance Task',
          createdAt: report.createdAt
        };
        setSelectedCompletedRecord(mockRecord);
      }
      return;
    }

    if (!report && records) {
      const matchRecord = records.find(rec => 
        rec.machineId === notif.machineId && 
        rec.workType === notif.type
      );
      if (matchRecord) {
        setSelectedCompletedRecord(matchRecord);
        return;
      }
    }

    // 4. If the report is active/unfinished, navigate directly!
    if (report) {
      setDepartment(matchedMachine.department);
      
      if (matchedMachine.department === 'Solid') {
        const section = getSolidSection(matchedMachine);
        setSelectedSolidSection(section);
      }

      setMachine(matchedMachine);
      
      if (report.department && report.department !== matchedMachine.department) {
        setSelectedLocation(report.department);
      } else {
        setSelectedLocation(null);
      }

      setWorkType(report.workType);
      
      // Auto transition to time stop / work completion screen 
      setStep(4);

      if (report.status === 'in-progress') {
        setIsTimerRunning(true);
      } else if (report.status === 'pending') {
        setIsTimerRunning(false);
      }
    }
  };
  
  const machinesInDept = useMemo(() => {
    const getPriority = (m: Machine) => {
      const activeReport = reports.find(r => r.machineId === m.id && r.status === 'pending');
      if (!activeReport) return 4;
      if (activeReport.workType === 'Break Down') return 1;
      if (activeReport.workType === 'Repair') return 2;
      if (activeReport.workType === 'Service') return 3;
      return 4;
    };

    let base = machines.filter(m => m.department === department);

    if (department === 'Solid' && selectedSolidSection) {
      base = base.filter(m => getSolidSection(m) === selectedSolidSection);
    }

    return base.sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.name.localeCompare(b.name);
    });
  }, [machines, department, reports, selectedSolidSection]);

  const countForSection = (sec: 'Main Solid' | 'Machine Section' | 'Paint Section') => {
    return machines.filter(m => m.department === 'Solid' && getSolidSection(m) === sec).length;
  };

  const alertsForSection = (sec: 'Main Solid' | 'Machine Section' | 'Paint Section') => {
    return reports.filter(r => {
      if (r.status !== 'pending') return false;
      const m = machines.find(mach => mach.id === r.machineId);
      return m && m.department === 'Solid' && getSolidSection(m) === sec;
    }).length;
  };

  // Initialize times for manual entry
  useEffect(() => {
    if (step === 4 && workType === 'Service' && !startTime) {
      const st = new Date();
      const [syr, smo, sdy] = manualStartDate.split('-').map(Number);
      st.setFullYear(syr, smo - 1, sdy);
      st.setHours(9, 0, 0, 0); // default to 09:00 AM as per example
      setStartTime(st.toISOString());
      setFinishTime(st.toISOString());
    } else if (step === 4 && timeType === 'Previous' && !startTime) {
      const st = new Date();
      const [syr, smo, sdy] = manualStartDate.split('-').map(Number);
      st.setFullYear(syr, smo - 1, sdy);
      
      const ft = new Date();
      const [fyr, fmo, fdy] = manualFinishDate.split('-').map(Number);
      ft.setFullYear(fyr, fmo - 1, fdy);

      setStartTime(st.toISOString());
      setFinishTime(ft.toISOString());
    }
  }, [step, workType, timeType, startTime, manualStartDate, manualFinishDate]);

  const pendingReportForMachine = useMemo(() => {
    if (!machine) return null;
    return reports.find(r => r.machineId === machine.id && r.status === 'pending');
  }, [machine, reports]);

  const activeReport = useMemo(() => {
    if (!machine) return null;
    return reports.find(r => r.machineId === machine.id && r.status === 'in-progress');
  }, [machine, reports]);

  const matchedReport = useMemo(() => {
    if (!machine) return null;
    // 1. Look for a pending or in-progress report matching machine and workType
    let match = reports.find(r => r.machineId === machine.id && r.workType === workType && (r.status === 'pending' || r.status === 'in-progress'));
    if (match) return match;

    // 2. Look for any pending or in-progress report for this machine
    match = reports.find(r => r.machineId === machine.id && (r.status === 'pending' || r.status === 'in-progress'));
    if (match) return match;

    // 3. Look for any report for this machine and workType sorted by creation date descending
    const sortedMachineWorkTypeReports = [...reports]
      .filter(r => r.machineId === machine.id && r.workType === workType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortedMachineWorkTypeReports.length > 0) return sortedMachineWorkTypeReports[0];

    // 4. Look for any report for this machine sorted by creation date descending
    const sortedMachineReports = [...reports]
      .filter(r => r.machineId === machine.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortedMachineReports.length > 0) return sortedMachineReports[0];

    return null;
  }, [machine, workType, reports]);

  const selectedShift = useMemo(() => {
    if (department === 'Other' || machine?.department === 'Other') {
      return '7:30 AM - 7:30 AM (24 Hours)';
    }
    return matchedReport?.shift || '7:30 AM - 4:30 PM';
  }, [matchedReport, department, machine]);

  const calculateDuration = (start: string, finish: string) => {
    if (!start || !finish) return 0;
    const currentShift = selectedShift || 'None Shift';
    return calculateShiftDuration(start, finish, currentShift);
  };

  const isTimeInvalid = useMemo(() => {
    if (timeType !== 'Previous' || !startTime || !finishTime) return false;
    return new Date(finishTime).getTime() <= new Date(startTime).getTime();
  }, [timeType, startTime, finishTime]);

  // Automatically start timer / retrieve start time for Break Down and Repair records
  useEffect(() => {
    if (step === 4 && timeType === 'Now' && (workType === 'Break Down' || workType === 'Repair')) {
      const originalTime = activeReport?.createdAt || pendingReportForMachine?.createdAt || matchedReport?.createdAt || new Date().toISOString();
      if (startTime !== originalTime) {
        setStartTime(originalTime);
      }
      if (!isTimerRunning) {
        setIsTimerRunning(true);
      }
      
      // Upgrade status to in-progress automatically
      if (pendingReportForMachine && onUpdateReport) {
        onUpdateReport(pendingReportForMachine.id, { status: 'in-progress' });
      }
    }
  }, [step, timeType, workType, activeReport, pendingReportForMachine, matchedReport, startTime, isTimerRunning, onUpdateReport]);

  // Clean timer when returning/leaving steps to prevent carryover
  useEffect(() => {
    if (step === 3) {
      setStartTime('');
      setFinishTime('');
      setIsTimerRunning(false);
    }
  }, [step]);

  const handleStartNow = async () => {
    const now = new Date().toISOString();
    setStartTime(now);
    setIsTimerRunning(true);

    // If there is a pending report, set it to in-progress
    if (pendingReportForMachine && onUpdateReport) {
      await onUpdateReport(pendingReportForMachine.id, { status: 'in-progress' });
    }
  };

  const handleFinishNow = () => {
    setFinishTime(new Date().toISOString());
    setIsTimerRunning(false);
  };

  const handleSave = async () => {
    const isService = workType === 'Service';
    if (!department || !machine || !workType || (!isService && (!timeType || !startTime || !finishTime)) || (isService && !startTime)) {
      alert("Please complete all fields before saving.");
      return;
    }

    const reportToClose = activeReport || pendingReportForMachine;
    const associatedReport = reportToClose || matchedReport;

    const finalStartTime = startTime;
    const finalFinishTime = isService ? startTime : finishTime;
    const finalDuration = isService ? 0 : calculateDuration(startTime, finishTime);

    const record: MaintenanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      maintainerName: user.name,
      role: user.role,
      department: selectedLocation || department,
      machineId: machine.id,
      machineName: machine.name,
      workType,
      timeType: isService ? 'Now' : timeType,
      date: isService ? startTime : (timeType === 'Now' ? startTime : new Date(manualStartDate).toISOString()),
      startTime: finalStartTime,
      finishTime: finalFinishTime,
      duration: finalDuration,
      description: isService ? 'Routine Service Completed' : description,
      shift: (department === 'Other' || machine?.department === 'Other' || selectedLocation)
        ? '7:30 AM - 7:30 AM (24 Hours)'
        : (activeReport?.shift || pendingReportForMachine?.shift || selectedShift || 'None Shift'),
      createdAt: new Date().toISOString(),
      ...(associatedReport?.id ? { reportId: associatedReport.id } : {}),
      ...(associatedReport?.description ? { problemDescription: associatedReport.description } : {})
    };

    onSave(record);

    // Finalize report if one was active
    if (reportToClose && onUpdateReport) {
      await onUpdateReport(reportToClose.id, { status: 'addressed' });
    }

    resetFlow();
  };

  const resetFlow = () => {
    setStep(1);
    setDepartment(null);
    setSelectedSolidSection(null);
    setMachine(null);
    setSelectedLocation(null);
    setWorkType(null);
    setTimeType('Now');
    setStartTime('');
    setFinishTime('');
    setDescription('');
    setIsTimerRunning(false);
  };

  const handleServiceAction = async () => {
    if (!department || !machine) return;

    const now = new Date().toISOString();
    const associatedReport = pendingReportForMachine || matchedReport;

    const record: MaintenanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      maintainerName: user.name,
      role: user.role,
      department: selectedLocation || department,
      machineId: machine.id,
      machineName: machine.name,
      workType: 'Service',
      timeType: 'Now',
      date: now,
      startTime: now,
      finishTime: now,
      duration: 0,
      description: 'Service Requested',
      createdAt: now,
      ...(associatedReport?.id ? { reportId: associatedReport.id } : {}),
      ...(associatedReport?.description ? { problemDescription: associatedReport.description } : {})
    };

    onSave(record);

    // If there is a pending report, set it to addressed
    if (pendingReportForMachine && onUpdateReport) {
      await onUpdateReport(pendingReportForMachine.id, { status: 'addressed' });
    }

    resetFlow();
  };

  const handleFinishWork = async () => {
    if (!description.trim()) return;
    
    setIsTranslating(true);
    try {
      const translated = await translateToEnglish(description);
      setDescription(translated);
      
      // Directly commit instead of going to step 6
      if (!department || !machine || !workType || !timeType || !startTime || !finishTime) {
        alert("Temporal data missing. Please check timing.");
        setStep(4);
        return;
      }

      const reportToClose = activeReport || pendingReportForMachine;
      const associatedReport = reportToClose || matchedReport;

      const record: MaintenanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        maintainerName: user.name,
        role: user.role,
        department: selectedLocation || department,
        machineId: machine.id,
        machineName: machine.name,
        workType,
        timeType,
        date: timeType === 'Now' ? startTime : new Date(manualStartDate).toISOString(),
        startTime,
        finishTime,
        duration: calculateDuration(startTime, finishTime),
        description: translated,
        shift: (department === 'Other' || machine?.department === 'Other' || selectedLocation)
          ? '7:30 AM - 7:30 AM (24 Hours)'
          : (activeReport?.shift || pendingReportForMachine?.shift || selectedShift || 'None Shift'),
        createdAt: new Date().toISOString(),
        ...(associatedReport?.id ? { reportId: associatedReport.id } : {}),
        ...(associatedReport?.description ? { problemDescription: associatedReport.description } : {})
      };

      onSave(record);

      // Finalize report
      if (reportToClose && onUpdateReport) {
        await onUpdateReport(reportToClose.id, { status: 'addressed' });
      }

      resetFlow();
    } catch (error) {
       // ... error logic

      console.error("Transmission fail", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const getDeptIcon = (dept: string) => {
    switch (dept) {
      case 'Agro': return Droplets;
      case 'Modular': return Layers;
      case 'Solid': return TreeDeciduous;
      case 'Sofa': return Sofa;
      case 'Other': return Wind;
      default: return LayoutGrid;
    }
  };

  const renderProgress = () => {
    const totalSteps = 5;
    return (
      <div className="flex gap-1 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500",
              step > i + 1 ? "bg-singer-red" : step === i + 1 ? "bg-black" : "bg-gray-200"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-full">
      {/* Sidebar - Bold Typography Style (Desktop only) */}
      <aside className="w-80 bg-white border-r border-slate-200 p-8 hidden lg:flex flex-col shrink-0 overflow-y-auto">
        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6 border-b border-slate-50 pb-4">Workflow Logic Control</div>
        <div className="space-y-6">
          {[
            { id: 1, label: 'Sector Selection' },
            { id: 2, label: 'Asset Identification' },
            { id: 3, label: 'Protocol Class' },
            { id: 4, label: 'Temporal Entry' },
            { id: 5, label: 'Analysis Report & Commit' }
          ].map((s) => (
            <div key={s.id} className={cn("flex gap-4 items-center transition-all duration-500", step < s.id && "opacity-20")}>
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-all shadow-inner",
                step > s.id ? "bg-slate-900 text-white" : step === s.id ? "bg-singer-red text-white scale-110 shadow-lg shadow-singer-red/20" : "bg-slate-100 text-slate-400"
              )}>
                {step > s.id ? '✓' : s.id}
              </div>
              <div className="flex flex-col">
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                   step === s.id ? "text-singer-red" : "text-slate-500"
                )}>
                  SYSTEM PHASE {s.id}
                </div>
                <div className={cn(
                  "text-sm font-black uppercase tracking-tight",
                  step === s.id ? "text-slate-900" : "text-slate-400"
                )}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-10">
          <div className="bg-slate-900 p-8 rounded-[32px] border-2 border-singer-red shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-white">
              <Zap size={40} />
            </div>
            <div className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Cycle Efficiency</div>
            <div className="text-4xl font-black text-white tracking-tighter italic tabular-nums">{Math.round((step / 5) * 100)}%</div>
            <div className="w-full bg-white/10 h-2 mt-4 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(step / 5) * 100}%` }}
                className="bg-singer-red h-full shadow-[0_0_15px_rgba(211,47,47,0.8)]"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <button 
            onClick={onLogout}
            className="w-full h-12 bg-slate-100 text-slate-400 hover:bg-singer-red hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
          >
            <LogOut size={16} className="group-hover:rotate-12 transition-transform" />
            Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 relative min-h-0">
        <div className="absolute top-6 right-6 flex items-center gap-4 z-[60]">
          <NotificationTray 
            notifications={notifications} 
            user={user} 
            onMarkRead={onMarkNotificationAsRead} 
            onDelete={onDeleteNotification}
            reports={reports}
            onNotificationClick={handleNotificationClick}
          />
        </div>

        {/* Back Button (Floating) */}
        <button 
          onClick={step === 1 ? onLogout : () => {
            if (step === 3 && department === 'Other' && selectedLocation) {
              setSelectedLocation(null);
            } else if (step === 2 && department === 'Solid' && selectedSolidSection) {
              setSelectedSolidSection(null);
            } else {
              setStep(step - 1);
            }
          }}
          className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl hover:border-slate-900 transition-all text-slate-900 z-[60] shadow-sm group hidden lg:flex"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Mobile Progress Bar (Visible on < LG) */}
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
          <button 
            onClick={step === 1 ? onLogout : () => {
              if (step === 3 && department === 'Other' && selectedLocation) {
                setSelectedLocation(null);
              } else if (step === 2 && department === 'Solid' && selectedSolidSection) {
                setSelectedSolidSection(null);
              } else {
                setStep(step - 1);
              }
            }}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic leading-none">Phase {step}</span>
              <span className={cn(
                "text-[10px] font-black text-singer-red uppercase tracking-widest leading-none"
              )}>{Math.round((step / 6) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${(step / 6) * 100}%` }}
                className="bg-singer-red h-full"
              />
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-12 xl:p-20">
          <AnimatePresence mode="wait">
            {/* Step 1: Factory Selection */}
            {step === 1 && (
              <motion.div 
                key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-8 sm:space-y-12 max-w-4xl"
              >
                <header>
                  <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase flex flex-col">
                    <span>SELECT</span>
                    <span className="text-singer-red">OPERATIONAL FACTORY</span>
                  </h1>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs">Establish localized system anchor for logging</p>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {FACTORIES.map((dept) => {
                    const pendingReports = reports.filter(r => 
                      r.status === 'pending' && 
                      (r.department === dept || (dept === 'Other' && SUB_LOCATIONS.includes(r.department)))
                    );
                    return (
                      <button
                        key={dept}
                        onClick={() => { setDepartment(dept); setStep(2); }}
                        className="group bg-white border-2 border-slate-200 rounded-[32px] p-8 sm:p-12 flex flex-col items-start justify-center gap-6 hover:border-slate-900 hover:shadow-[40px_40px_80px_rgba(0,0,0,0.05)] hover:-translate-y-2 transition-all text-left relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8 text-slate-50 text-6xl font-black opacity-0 group-hover:opacity-100 transition-opacity select-none">{dept.charAt(0)}</div>
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner relative z-10">
                          {(() => {
                            const Icon = getDeptIcon(dept);
                            return <Icon size={32} />;
                          })()}
                        </div>
                        <div className="relative z-10 w-full">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block group-hover:text-singer-red transition-colors">Sector ID: 00{FACTORIES.indexOf(dept) + 1}</span>
                          <span className="text-2xl sm:text-3xl font-black uppercase text-slate-800 tracking-tighter group-hover:text-slate-900">{dept === 'Other' ? dept : dept + ' Factory'}</span>
                        </div>

                        {/* Pending Tasks Section */}
                        {pendingReports.length > 0 && (
                          <div className="w-full space-y-3 relative z-10 pt-4 border-t border-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-singer-red uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle size={12} className="animate-pulse" /> Pending Tasks
                              </span>
                              <span className="bg-singer-red text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-singer-red/20">{pendingReports.length}</span>
                            </div>
                            <div className="space-y-1.5">
                              {pendingReports.slice(0, 2).map((r) => (
                                <div key={r.id} className="bg-slate-50 px-4 py-2 rounded-xl flex items-center justify-between group-hover:bg-slate-100 transition-colors border border-transparent group-hover:border-slate-200">
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[10px] font-black text-slate-900 truncate uppercase" dangerouslySetInnerHTML={{ __html: r.machineName.replace(/<br\s*\/?>/gi, ' ') }} />
                                      <span className="bg-red-600 text-[8px] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest scale-[0.8] origin-left">
                                        {r.department === 'Other' ? 'OTHER' : (r.department.includes('FACTORY') ? r.department.replace(' FACTORY', '') : r.department)}
                                      </span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider flex flex-wrap items-center gap-x-2">
                                      <span className="text-singer-red font-black">{r.workType}</span>
                                      <span>Date: {format(new Date(r.createdAt), 'yyyy-MM-dd')}</span>
                                      <span>Time: {formatTime(r.createdAt)}</span>
                                      {r.scheduledAt && (
                                        <span className="text-amber-500 font-extrabold">• PLANNED</span>
                                      )}
                                    </span>
                                  </div>
                                  <ChevronRight size={14} className="text-slate-300 group-hover:text-singer-red transition-colors" />
                                </div>
                              ))}
                              {pendingReports.length > 2 && (
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center pt-2 italic">
                                  + {pendingReports.length - 2} additional alerts
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2: Machine Selection */}
            {step === 2 && (
              <motion.div 
                key={department === 'Solid' && selectedSolidSection === null ? "step2-solid" : "step2-machines"}
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 sm:space-y-12 max-w-6xl"
              >
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b-4 border-slate-900 pb-10">
                  <div>
                    {department === 'Solid' && selectedSolidSection === null ? (
                      <h1 className="text-5xl sm:text-7xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase flex flex-col">
                        <span>SELECT</span>
                        <span className="text-singer-red">SECTOR</span>
                      </h1>
                    ) : (
                      <h1 className="text-5xl sm:text-7xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase flex flex-col">
                        <span>IDENTIFY</span>
                        <span className="text-singer-red">MACHINE</span>
                      </h1>
                    )}
                    <div className="flex gap-4 items-center flex-wrap">
                      {department === 'Solid' && selectedSolidSection ? (
                        <div className="flex items-center gap-1.5 px-4 py-1 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-widest">
                          <span>{department} Division</span>
                          <span className="text-slate-400 font-normal">/</span>
                          <span className="inline-flex items-center gap-1 text-slate-300">
                            {selectedSolidSection === 'Main Solid' ? (
                              <Hammer size={10} className="text-emerald-400 animate-pulse" />
                            ) : selectedSolidSection === 'Machine Section' ? (
                              <Cog size={10} className="text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
                            ) : (
                              <Paintbrush size={10} className="text-amber-400" />
                            )}
                            {selectedSolidSection}
                          </span>
                        </div>
                      ) : (
                        <div className="px-4 py-1 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-widest">{department} Division</div>
                      )}
                      
                      {department === 'Solid' && selectedSolidSection === null ? (
                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">AUTHORIZED SECTOR ENTRY DIRECTIVE</p>
                      ) : (
                        <p className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px]">Filter: Sub-system nodes</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (department === 'Solid' && selectedSolidSection) {
                        setSelectedSolidSection(null);
                      } else {
                        setStep(1);
                      }
                    }} 
                    className="flex items-center gap-2 bg-singer-red text-white font-black uppercase text-[10px] sm:text-xs tracking-widest px-8 py-3 rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95 transition-all"
                  >
                    <ArrowLeft size={16} /> BACK
                  </button>
                </header>
                
                {department === 'Solid' && selectedSolidSection === null ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      {
                        id: 'Main Solid' as const,
                        name: 'Main Solid',
                        tagline: 'WOOD ASSEMBLY & CORE PROCESS',
                        desc: 'Spindle moulders, borer, bandsaw machines, and core wooden processes.',
                        color: 'bg-emerald-600',
                        icon: Hammer,
                      },
                      {
                        id: 'Machine Section' as const,
                        name: 'Machine Section',
                        tagline: 'HEAVY FORMATTING & CUTTING',
                        desc: 'Heavy cutting machines, rip saws, planner units, and cross cutters.',
                        color: 'bg-indigo-600',
                        icon: Cog,
                      },
                      {
                        id: 'Paint Section' as const,
                        name: 'Paint Section',
                        tagline: 'PREMIUM COATING & OVEN SYSTEMS',
                        desc: 'Oven drying systems, spray booths, and specialized exterior paint machinery.',
                        color: 'bg-amber-600',
                        icon: Paintbrush,
                      }
                    ].map((sec) => {
                      const mCount = countForSection(sec.id);
                      const aCount = alertsForSection(sec.id);
                      return (
                        <button
                          key={sec.id}
                          onClick={() => setSelectedSolidSection(sec.id)}
                          className="group relative bg-white border-2 border-slate-200 rounded-[32px] p-8 flex flex-col items-start text-left gap-6 hover:border-slate-900 hover:shadow-[30px_30px_60px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-1 overflow-hidden animate-pulse-[dur:3s]"
                        >
                          <div className="absolute top-0 right-0 p-8 text-slate-100/50 text-6xl font-black opacity-0 group-hover:opacity-100 transition-opacity select-none italic pointer-events-none">
                            {sec.name.charAt(0)}
                          </div>

                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner relative z-10 transition-transform group-hover:scale-110",
                            sec.color
                          )}>
                            <sec.icon className="w-5 h-5" />
                            {aCount > 0 && (
                              <div className="absolute -top-2 -right-2 w-6 h-6 bg-singer-red rounded-full flex items-center justify-center text-[9px] font-black border-4 border-white shadow-lg animate-bounce text-white">
                                {aCount}
                              </div>
                            )}
                          </div>

                          <div className="relative z-10 space-y-2 w-full">
                            <div className="flex items-center justify-between gap-4">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-singer-red transition-colors">
                                {sec.tagline}
                              </div>
                            </div>
                            <h3 className="text-xl font-black uppercase text-slate-800 tracking-tighter group-hover:text-slate-950 border-b-2 border-slate-50 pb-2 mb-2">
                              {sec.name}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed min-h-[48px]">
                              {sec.desc}
                            </p>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-slate-50 w-full text-[9px] font-black uppercase tracking-wider">
                              <span className="text-slate-400">
                                {mCount} Machine{mCount !== 1 ? 's' : ''}
                              </span>
                              <span className="text-slate-900 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                Access <ChevronRight size={12} />
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {machinesInDept.map((m) => {
                      const machineReport = reports.find(r => r.machineId === m.id && r.status === 'pending');
                      return (
                        <button
                          key={m.id}
                          onClick={() => { setMachine(m); setStep(3); }}
                          className={cn(
                            "group bg-white rounded-[40px] p-10 flex flex-col items-center transition-all duration-300 relative border-2",
                            machine?.id === m.id 
                              ? "border-singer-red shadow-[0_20px_50px_rgba(211,47,47,0.15)] scale-[1.02]" 
                              : machineReport
                                ? machineReport.workType === 'Break Down'
                                  ? "border-red-500 shadow-[0_15px_40px_rgba(239,68,68,0.06)] bg-red-50/10"
                                  : machineReport.workType === 'Service'
                                    ? "border-blue-500 shadow-[0_15px_40px_rgba(37,99,235,0.06)] bg-blue-50/10"
                                    : "border-yellow-500 shadow-[0_15px_40px_rgba(234,179,8,0.06)] bg-yellow-50/10"
                                : "border-transparent shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-slate-100"
                          )}
                        >
                          {/* Status Badge */}
                          {machineReport && (
                            <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-1">
                              <div className={cn(
                                "flex items-center gap-2 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg animate-pulse",
                                machineReport.workType === 'Break Down' ? "bg-[#d32f2f] shadow-[#d32f2f]/20" :
                                machineReport.workType === 'Service' ? "bg-blue-600 shadow-blue-600/20" :
                                "bg-yellow-500 shadow-yellow-500/20"
                              )}>
                                <AlertCircle size={10} /> {machineReport.workType}
                              </div>
                              {machineReport.scheduledAt && (
                                <div className="bg-amber-500 text-slate-900 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-amber-500/20">
                                  {new Date(machineReport.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Image/Icon Area */}
                          <div className="relative w-full aspect-video flex items-center justify-center mb-8 bg-slate-50 rounded-[24px] overflow-hidden group-hover:bg-singer-red transition-colors shadow-inner">
                            {m.image ? (
                              <img 
                                src={m.image} 
                                alt={m.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <div className="w-20 h-20 bg-singer-red rounded-full flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                                <Settings size={40} className="text-white group-hover:rotate-90 transition-transform duration-700" />
                              </div>
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {/* Divider */}
                          <div className="w-12 h-1 bg-singer-red rounded-full mb-6" />

                          {/* Info Area */}
                          <div className="space-y-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ID: {m.id}</div>
                              {machineReport && SUB_LOCATIONS.includes(machineReport.department) && (
                                <div className="bg-singer-red text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                                  {machineReport.department}
                                </div>
                              )}
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-tight" dangerouslySetInnerHTML={{ __html: m.name }} />
                          </div>

                          {/* Selection Indicator (Dot) */}
                          <div className={cn(
                            "absolute top-6 right-6 w-3 h-3 rounded-full transition-all duration-300",
                            machine?.id === m.id ? "bg-singer-red scale-100" : "bg-slate-100 scale-50 opacity-0"
                          )} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && department === 'Other' && !selectedLocation && (
              <motion.div 
                key="location-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-4xl"
              >
                <header>
                  <h1 className="text-6xl sm:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase">LOCATION</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">IDENTIFY OPERATIONAL ZONE FOR OTHER ASSETS</p>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SUB_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setSelectedLocation(loc)}
                      className="group bg-white border-2 border-slate-200 rounded-[32px] p-8 flex items-center justify-between hover:border-slate-900 hover:shadow-xl transition-all"
                    >
                      <span className="text-xl font-black uppercase text-slate-800">{loc}</span>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-singer-red transition-all" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Work Type */}
            {step === 3 && (department !== 'Other' || selectedLocation) && (
              <motion.div 
                key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-4xl"
              >
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b-4 border-slate-900 pb-10">
                  <div>
                    <h1 className="text-6xl sm:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase">WORK TYPE</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Node: <span dangerouslySetInnerHTML={{ __html: machine?.name || '' }} /> // Division: {selectedLocation || department}</p>
                  </div>
                  <button 
                    onClick={() => {
                        if (department === 'Other') setSelectedLocation(null);
                        else setStep(2);
                    }} 
                    className="flex items-center gap-2 bg-singer-red text-white font-black uppercase text-[10px] sm:text-xs tracking-widest px-8 py-3 rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95 transition-all"
                  >
                    <ArrowLeft size={16} /> BACK
                  </button>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-2xl text-left">
                  <button
                    onClick={() => { setWorkType('Repair'); setStep(4); }}
                    className={cn(
                      "group p-8 sm:p-10 bg-white border-4 rounded-[40px] text-left transition-all flex flex-col gap-8",
                      workType === 'Repair' ? "border-yellow-500 shadow-2xl shadow-yellow-500/20" : "border-slate-50 hover:border-yellow-500 hover:shadow-[30px_30px_60px_rgba(234,179,8,0.05)]"
                    )}
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-[20px] flex items-center justify-center text-white transition-all shadow-xl group-hover:rotate-12",
                      workType === 'Repair' ? "bg-yellow-500" : "bg-slate-900 group-hover:bg-yellow-500"
                    )}>
                      <Wrench size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-2 uppercase tracking-tighter italic">REPAIR</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Symptom Correction & Restoration</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setWorkType('Service'); setStep(4); }}
                    className={cn(
                      "group p-8 sm:p-10 bg-white border-4 rounded-[40px] text-left transition-all flex flex-col gap-8",
                      workType === 'Service' ? "border-blue-600 shadow-2xl shadow-blue-600/20" : "border-slate-50 hover:border-blue-600 hover:shadow-[30px_30px_60px_rgba(37,99,235,0.05)]"
                    )}
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-[20px] flex items-center justify-center text-white transition-all shadow-xl group-hover:-rotate-12",
                      workType === 'Service' ? "bg-blue-600" : "bg-slate-900 group-hover:bg-blue-600"
                    )}>
                      <Stethoscope size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-2 uppercase tracking-tighter italic">SERVICE</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Preventative Health Audit</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setWorkType('Break Down'); setStep(4); }}
                    className={cn(
                      "group p-8 sm:p-10 bg-white border-4 rounded-[40px] text-left transition-all flex flex-col gap-8",
                      workType === 'Break Down' ? "border-singer-red shadow-2xl" : "border-slate-50 hover:border-singer-red hover:shadow-[30px_30px_60px_rgba(211,47,47,0.05)]"
                    )}
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-[20px] flex items-center justify-center text-white transition-all shadow-xl group-hover:scale-110",
                      workType === 'Break Down' ? "bg-singer-red" : "bg-slate-900 group-hover:bg-singer-red"
                    )}>
                      <AlertTriangle size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-2 uppercase tracking-tighter italic">BREAK DOWN</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Critical Failure Response</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Time Selection */}
            {step === 4 && workType === 'Service' && (
              <motion.div 
                key="step4-service" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-4xl"
              >
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h1 className="text-6xl sm:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase">SERVICE DATE & TIME</h1>
                    <div className="w-32 h-1.5 bg-blue-600 mb-4"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs underline decoration-slate-200 underline-offset-8 decoration-4">Preventative Audit Schedule Coordinates</p>
                  </div>
                  <button 
                    onClick={() => setStep(3)} 
                    className="flex items-center gap-2 bg-slate-900 text-white font-black uppercase text-[10px] sm:text-xs tracking-widest px-8 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 self-start sm:self-center"
                  >
                    <ArrowLeft size={16} /> BACK
                  </button>
                </header>

                <div className="bg-white p-10 sm:p-16 rounded-[48px] shadow-2xl border-2 border-slate-50 space-y-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 text-slate-50 select-none pointer-events-none">
                    <Stethoscope size={120} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    {/* SERVICE DATE SECTION */}
                    <div className="space-y-6 p-6 rounded-[32px] bg-slate-50/50 border border-slate-100">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] block ml-2">Execution Coordinates</span>
                      
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">
                          <Calendar size={12} className="text-slate-300" /> Service Date
                        </label>
                        <div className="relative group">
                          <input 
                            type="date" 
                            value={manualStartDate} 
                            onChange={(e) => {
                              const newDateStr = e.target.value;
                              setManualStartDate(newDateStr);
                              const currentST = startTime ? new Date(startTime) : new Date();
                              const [yr, mo, dy] = newDateStr.split('-').map(Number);
                              currentST.setFullYear(yr, mo - 1, dy);
                              setStartTime(currentST.toISOString());
                              setFinishTime(currentST.toISOString());
                            }} 
                            className="w-full p-8 bg-white border-4 border-slate-100 focus:border-slate-900 rounded-[24px] text-2xl font-black outline-none transition-all shadow-inner relative z-10 appearance-none" 
                          />
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 z-0 text-slate-200 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                            <Calendar size={32} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* START ASSIGNMENT TIME SECTION */}
                    <div className="space-y-6 p-6 rounded-[32px] bg-slate-50/50 border border-slate-100">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] block ml-2">Temporal Coordinates</span>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">
                          <Clock size={12} className="text-slate-300" /> Start Assignment Time
                        </label>
                        <div className="relative group">
                          <button 
                            onClick={() => setActivePicker('start')}
                            className="w-full p-8 bg-white border-4 border-slate-100 hover:border-blue-600 focus:border-slate-900 rounded-[24px] text-2xl font-black outline-none transition-all shadow-inner relative z-10 flex items-center justify-start text-slate-800"
                          >
                            {startTime ? format(new Date(startTime), 'hh:mm a') : '09:00 AM'}
                          </button>
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 z-0 text-slate-200 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                            <Clock size={32} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Coordinates</span>
                      <p className="text-sm font-black text-slate-800 font-mono">
                        {manualStartDate ? format(new Date(manualStartDate), 'dd MMM yyyy') : '--'} at {startTime ? format(new Date(startTime), 'hh:mm a') : '09:00 AM'}
                      </p>
                    </div>

                    <button 
                      onClick={handleSave}
                      className="bg-blue-600 text-white font-black text-xl tracking-tighter px-12 py-6 rounded-[24px] hover:bg-slate-900 transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-3 uppercase italic"
                    >
                      COMPLETE SERVICE <CheckCircle2 size={24} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Time Selection */}
            {step === 4 && workType !== 'Service' && (
              <motion.div 
                key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-4xl"
              >
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h1 className="text-6xl sm:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase">TIME TYPE</h1>
                    <div className="w-32 h-1.5 bg-singer-red mb-4"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs underline decoration-slate-200 underline-offset-8 decoration-4">Primary Time Extraction Phase</p>
                  </div>
                  <button 
                    onClick={() => setStep(3)} 
                    className="flex items-center gap-2 bg-singer-red text-white font-black uppercase text-[10px] sm:text-xs tracking-widest px-8 py-3 rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95 transition-all self-start sm:self-center"
                  >
                    <ArrowLeft size={16} /> BACK
                  </button>
                </header>

                <div className="p-2 sm:p-3 rounded-[32px] bg-slate-200 flex gap-2">
                  <button 
                    onClick={() => setTimeType('Now')}
                    className={cn(
                      "flex-1 py-6 rounded-[24px] font-black uppercase text-xs sm:text-sm tracking-widest transition-all", 
                      timeType === 'Now' ? "bg-white text-singer-red shadow-2xl scale-[1.02]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    LIVE TIME
                  </button>
                  <button 
                    onClick={() => { setTimeType('Previous'); setStartTime(''); setFinishTime(''); }}
                    className={cn(
                      "flex-1 py-6 rounded-[24px] font-black uppercase text-xs sm:text-sm tracking-widest transition-all", 
                      timeType === 'Previous' ? "bg-white text-singer-red shadow-2xl scale-[1.02]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    PREVIOUS WORK
                  </button>
                </div>

                {timeType === 'Now' && (
                  <div className="bg-white p-10 sm:p-20 rounded-[48px] border-2 border-slate-50 shadow-[40px_40px_100px_rgba(0,0,0,0.03)] space-y-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-slate-50">
                       <motion.div 
                         animate={isTimerRunning ? { x: ['-100%', '100%'] } : {}}
                         transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                         className="w-1/3 h-full bg-singer-red opacity-50"
                       />
                    </div>

                    <div className="flex justify-center relative">
                      <div className={cn(
                        "w-56 h-56 sm:w-80 sm:h-80 rounded-full border-[12px] flex items-center justify-center transition-all duration-1000",
                        isTimerRunning ? "border-slate-900 border-t-singer-red italic" : "border-slate-50"
                      )}>
                        <div className="flex flex-col items-center">
                          <motion.div animate={isTimerRunning ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
                            <Clock size={64} className={cn(isTimerRunning ? "text-singer-red" : "text-slate-100")} />
                          </motion.div>
                          <div className="mt-6 flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-2">Clock Time</span>
                            <span className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tighter tabular-nums bg-slate-50 px-6 py-2 rounded-2xl">
                              {startTime ? formatTime(startTime) : "--:--"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-w-md mx-auto">
                      {!startTime && (
                        <button onClick={handleStartNow} className="w-full bg-singer-red text-white h-24 rounded-[24px] font-black text-2xl tracking-tighter hover:bg-slate-900 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 uppercase italic">
                          <Play fill="currentColor" /> START
                        </button>
                      )}

                      {startTime && !finishTime && (
                        <button onClick={handleFinishNow} className="w-full bg-slate-900 text-white h-24 rounded-[24px] font-black text-2xl tracking-tighter hover:bg-singer-red shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 uppercase italic">
                          <Square fill="currentColor" /> {(workType === 'Break Down' || workType === 'Repair') ? 'STOP' : 'FINISH'}
                        </button>
                      )}

                      {finishTime && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pt-10 border-t-4 border-slate-50">
                          <div className="flex items-center justify-between px-10">
                            <div className="text-left">
                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Total Elapsed</span>
                              <span className="text-6xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">{calculateDuration(startTime, finishTime)}</span>
                              <span className="text-xs font-black text-singer-red uppercase tracking-widest ml-2 italic">Minutes</span>
                            </div>
                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-singer-red shadow-inner">
                              <CheckCircle2 size={40} />
                            </div>
                          </div>
                          <button onClick={() => setStep(5)} className="btn-primary w-full h-20 text-xl flex items-center justify-center gap-4 group">
                            FINISH WORK <ChevronRight className="group-hover:translate-x-2 transition-transform" />
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {timeType === 'Previous' && (
                  <div className="bg-white p-10 sm:p-16 rounded-[48px] shadow-2xl border-2 border-slate-50 space-y-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 text-slate-50 select-none pointer-events-none">
                      <Zap size={120} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                      {/* START DATE & TIME SECTION */}
                      <div className="space-y-6 p-6 rounded-[32px] bg-slate-50/50 border border-slate-100">
                        <span className="text-[10px] font-black text-singer-red uppercase tracking-[0.3em] block ml-2">Start Assignment</span>
                        
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">
                            <Calendar size={12} className="text-slate-300" /> Start Date
                          </label>
                          <div className="relative group">
                            <input 
                              type="date" 
                              value={manualStartDate} 
                              onChange={(e) => {
                                const newDateStr = e.target.value;
                                setManualStartDate(newDateStr);
                                if (startTime) {
                                  const currentST = new Date(startTime);
                                  const [yr, mo, dy] = newDateStr.split('-').map(Number);
                                  currentST.setFullYear(yr, mo - 1, dy);
                                  setStartTime(currentST.toISOString());
                                }
                              }} 
                              className="w-full p-8 bg-white border-4 border-slate-100 focus:border-slate-900 rounded-[24px] text-2xl font-black outline-none transition-all shadow-inner relative z-10 appearance-none" 
                            />
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 z-0 text-slate-200 group-focus-within:text-singer-red transition-colors pointer-events-none">
                              <Calendar size={32} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">
                            <Clock size={12} className="text-slate-300" /> Start Time
                          </label>
                          <div className="relative group">
                            <button 
                              onClick={() => setActivePicker('start')}
                              className="w-full p-8 bg-white border-4 border-slate-100 hover:border-singer-red focus:border-slate-900 rounded-[24px] text-2xl font-black outline-none transition-all shadow-inner relative z-10 flex items-center justify-start text-slate-800"
                            >
                              {startTime ? format(new Date(startTime), 'HH:mm') : '00:00'}
                            </button>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 z-0 text-slate-200 group-focus-within:text-singer-red transition-colors pointer-events-none">
                              <Clock size={32} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* FINISH DATE & TIME SECTION */}
                      <div className="space-y-6 p-6 rounded-[32px] bg-slate-50/50 border border-slate-100">
                        <span className="text-[10px] font-black text-singer-red uppercase tracking-[0.3em] block ml-2">Finish Assignment</span>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">
                            <Calendar size={12} className="text-slate-300" /> Finish Date
                          </label>
                          <div className="relative group">
                            <input 
                              type="date" 
                              value={manualFinishDate} 
                              onChange={(e) => {
                                const newDateStr = e.target.value;
                                setManualFinishDate(newDateStr);
                                if (finishTime) {
                                  const currentFT = new Date(finishTime);
                                  const [yr, mo, dy] = newDateStr.split('-').map(Number);
                                  currentFT.setFullYear(yr, mo - 1, dy);
                                  setFinishTime(currentFT.toISOString());
                                }
                              }} 
                              className="w-full p-8 bg-white border-4 border-slate-100 focus:border-slate-900 rounded-[24px] text-2xl font-black outline-none transition-all shadow-inner relative z-10 appearance-none" 
                            />
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 z-0 text-slate-200 group-focus-within:text-singer-red transition-colors pointer-events-none">
                              <Calendar size={32} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-6">
                            <Clock size={12} className="text-slate-300" /> Finish Time
                          </label>
                          <div className="relative group">
                            <button 
                              onClick={() => setActivePicker('final')}
                              className="w-full p-8 bg-white border-4 border-slate-100 hover:border-singer-red focus:border-slate-900 rounded-[24px] text-2xl font-black outline-none transition-all shadow-inner relative z-10 flex items-center justify-start text-slate-800"
                            >
                              {finishTime ? format(new Date(finishTime), 'HH:mm') : '00:00'}
                            </button>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 z-0 text-slate-200 group-focus-within:text-singer-red transition-colors pointer-events-none">
                              <Clock size={32} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {startTime && finishTime && (() => {
                      const startD = new Date(startTime);
                      const finishD = new Date(finishTime);
                      const totalDiffMs = finishD.getTime() - startD.getTime();
                      const totalDiffMins = totalDiffMs > 0 ? Math.floor(totalDiffMs / 60000) : 0;
                      const totalDiffHours = (totalDiffMins / 60).toFixed(1);

                      const actualMins = calculateDuration(startTime, finishTime);
                      const actualHours = (actualMins / 60).toFixed(1);

                      return (
                        <div className="space-y-6">
                          {isTimeInvalid && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              className="p-8 bg-amber-50 border-2 border-amber-300 rounded-[28px] flex items-center gap-4 text-amber-800"
                            >
                              <AlertTriangle className="text-amber-500 shrink-0" size={32} />
                              <div className="text-left">
                                <h4 className="font-bold text-sm tracking-tight text-amber-950">Validation Warning</h4>
                                <p className="text-xs text-amber-700 font-medium leading-relaxed mt-0.5">
                                  Finish Date/Time must be later than Start Date/Time. Please check your selections.
                                </p>
                              </div>
                            </motion.div>
                          )}

                          {/* Comprehensive Calculation Breakdown */}
                          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] space-y-6 text-left">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block border-b border-slate-200/60 pb-3">DOWNTIME & DURATION ANALYSIS</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                              {/* Date Ranges */}
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Entered Start Date/Time</span>
                                  <span className="text-sm font-black text-slate-800 font-mono">
                                    {format(startD, 'dd MMM yyyy, hh:mm a')}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Entered Finish Date/Time</span>
                                  <span className="text-sm font-black text-slate-800 font-mono">
                                    {format(finishD, 'dd MMM yyyy, hh:mm a')}
                                  </span>
                                </div>
                              </div>

                              {/* Breakdown Statistics */}
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Raw Calendar Period</span>
                                  <span className="text-sm font-bold text-slate-500 font-mono">
                                    {totalDiffMins} mins ({totalDiffHours} hrs)
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Applied Shift Rule</span>
                                  <span className="text-xs font-bold text-singer-red font-mono bg-red-50 border border-red-100 px-2 py-0.5 rounded inline-block">
                                    {selectedShift}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Actual Maintenance Working Duration</span>
                                <p className="text-xs text-slate-500 font-medium mt-1">Non-working hours and overnight factory closures are automatically excluded from this duration.</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-2xl font-black text-slate-900 font-mono italic">
                                  {actualHours} <span className="text-xs uppercase not-italic text-slate-400 font-bold">hrs</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-10 bg-slate-900 rounded-[32px] flex justify-between items-center text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 uppercase font-black text-9xl group-hover:scale-150 transition-transform duration-1000">T</div>
                            <div className="relative z-10">
                              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1">Calculated Duration</span>
                              <span className="text-5xl font-black text-white tracking-tighter tabular-nums">{actualMins} <span className="text-singer-red italic">MIN</span></span>
                            </div>
                            <button 
                              disabled={isTimeInvalid}
                              onClick={() => {
                                if (!isTimeInvalid) setStep(5);
                              }} 
                              className={cn(
                                "relative z-10 w-20 h-20 p-0 rounded-full flex items-center justify-center transition-all shadow-xl",
                                isTimeInvalid 
                                  ? "bg-slate-700 text-slate-500 cursor-not-allowed shadow-none" 
                                  : "bg-singer-red text-white hover:scale-110 active:scale-90 shadow-singer-red/20"
                              )}
                            >
                              <CheckCircle2 size={40} />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Description */}
            {step === 5 && (
              <motion.div 
                key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-5xl"
              >
                <header>
                  <h1 className="text-6xl sm:text-8xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-6 uppercase">ANALYSIS<br />REPORT</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Exposition of tasks executed within the operational window</p>
                </header>
                
                <div className="bg-white p-6 sm:p-8 rounded-[48px] border-4 border-slate-50 shadow-2xl flex flex-col gap-4 relative">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="p-2 bg-slate-100 rounded text-slate-400"><ClipboardList size={20} /></div>
                    <AITranslationTool 
                      value={description} 
                      onTranslated={(translated) => setDescription(translated)} 
                    />
                  </div>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Input technical summary. Focus on quantitative data and part identifiers..."
                    className="w-full h-80 sm:h-[350px] p-4 bg-transparent text-xl sm:text-2xl font-medium outline-none resize-none placeholder:text-slate-200 font-sans leading-relaxed text-slate-800"
                  />
                  <div className="absolute bottom-6 right-8 flex gap-2">
                     <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Character Pool: {description.length}</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                  <button onClick={() => setStep(4)} className="text-slate-300 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 transition-all flex items-center gap-2">
                    <ArrowLeft size={16} /> REVISE TEMPORAL DATA
                  </button>
                  <button 
                    onClick={handleFinishWork}
                    disabled={!description.trim() || isTranslating}
                    className="btn-primary w-full sm:w-auto px-16 h-20 text-lg disabled:opacity-20 flex items-center justify-center gap-4 group shadow-2xl relative"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="animate-spin" size={24} />
                        TRANSLATING TO ENGLISH...
                      </>
                    ) : (
                      <>
                        FINISH WORK <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time Picker Modal */}
          <AnimatePresence>
            {activePicker && (
              <AnalogTimePicker 
                label={activePicker === 'start' ? 'Start Hour' : 'Final Hour'}
                value={activePicker === 'start' 
                  ? (startTime ? format(new Date(startTime), 'HH:mm') : '00:00')
                  : (finishTime ? format(new Date(finishTime), 'HH:mm') : '00:00')
                }
                onClose={() => setActivePicker(null)}
                onChange={(val) => {
                  const [hours, minutes] = val.split(':');
                  if (activePicker === 'start') {
                    const d = new Date(startTime || new Date());
                    const [yr, mo, dy] = manualStartDate.split('-').map(Number);
                    d.setFullYear(yr, mo - 1, dy);
                    d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    setStartTime(d.toISOString());
                  } else {
                    const d = new Date(finishTime || new Date());
                    const [yr, mo, dy] = manualFinishDate.split('-').map(Number);
                    d.setFullYear(yr, mo - 1, dy);
                    d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    setFinishTime(d.toISOString());
                  }
                }}
              />
            )}
          </AnimatePresence>

          {/* Read-Only Completed Record Modal */}
          <AnimatePresence>
            {selectedCompletedRecord && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
              >
                <motion.div 
                  initial={{ scale: 0.95, y: 30 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 30 }}
                  className="bg-white rounded-[40px] border-4 border-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden flex flex-col"
                >
                  {/* Modal Header */}
                  <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-white pointer-events-none select-none">
                      <CheckCircle2 size={120} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-green-500 text-white rounded-full text-[8.5px] font-black uppercase tracking-[0.2em]">Closed / Resolved</span>
                        <span className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-[8.5px] font-black uppercase tracking-[0.2em] font-mono">Record ID: {selectedCompletedRecord.id}</span>
                      </div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter italic leading-none">Completed Task Log</h2>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.3em] mt-2">Singer Maintenance Archives</p>
                    </div>
                    <button 
                      onClick={() => setSelectedCompletedRecord(null)}
                      className="p-3 bg-white/10 hover:bg-singer-red hover:text-white rounded-2xl transition-all z-20"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Modal Scrollable Body */}
                  <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Machine Details */}
                      <div className="p-5 bg-white border border-slate-100 rounded-2xl">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Target Asset / Node</span>
                        <span className="font-mono text-slate-900 font-bold text-sm block" dangerouslySetInnerHTML={{ __html: selectedCompletedRecord.machineName }} />
                        <span className="block text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{selectedCompletedRecord.department} Division</span>
                      </div>

                      {/* Work Category */}
                      <div className="p-5 bg-white border border-slate-100 rounded-2xl">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Incident Category</span>
                        <span className="font-black text-singer-red text-base uppercase block tracking-wider italic">{selectedCompletedRecord.workType}</span>
                        <span className="block text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Priority Resolution Code</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Maintainer */}
                      <div className="p-4 bg-white border border-slate-100 rounded-xl">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Assigned Operator</span>
                        <span className="text-slate-800 font-bold text-xs uppercase block">{selectedCompletedRecord.maintainerName}</span>
                        <span className="block text-[9px] text-slate-400 uppercase tracking-wider">{selectedCompletedRecord.role} ID</span>
                      </div>

                      {/* Date */}
                      <div className="p-4 bg-white border border-slate-100 rounded-xl">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Filing Timestamp</span>
                        <span className="text-slate-800 font-mono text-xs font-bold block">{selectedCompletedRecord.date?.split('T')[0] || selectedCompletedRecord.date}</span>
                      </div>

                      {/* Duration */}
                      {selectedCompletedRecord.workType !== 'Service' ? (
                        <div className="p-4 bg-white border border-slate-100 rounded-xl">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Activity Duration</span>
                          <span className="text-slate-800 font-black text-base italic block">{selectedCompletedRecord.duration} <span className="font-sans text-xs uppercase text-slate-400 not-italic font-medium">min</span></span>
                        </div>
                      ) : (
                        <div className="p-4 bg-white border border-slate-100 rounded-xl">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Execution Time</span>
                          <span className="text-blue-600 font-black text-xs uppercase italic block mt-1">Scheduled</span>
                        </div>
                      )}
                    </div>

                    {/* Task Description */}
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl space-y-2">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest select-none">Service Action Log / Narrative</span>
                      <p className="text-slate-700 text-xs font-normal leading-relaxed whitespace-pre-wrap uppercase tracking-tight">
                        {selectedCompletedRecord.description || 'No maintenance summary provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 rounded-b-[40px]">
                    <button 
                      onClick={() => setSelectedCompletedRecord(null)}
                      className="flex-1 py-4 bg-slate-900 hover:bg-singer-red text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      Confirm & Dismiss Registry
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
