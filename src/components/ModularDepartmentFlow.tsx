import React, { useState, useMemo, useEffect } from 'react';
import { FACTORIES, SUB_LOCATIONS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Machine, WorkType, MachineReport } from '../types';
import SingerLogo from './SingerLogo';
import AITranslationTool from './AITranslationTool';
import { 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  AlertTriangle, 
  Hammer, 
  Cog, 
  Paintbrush,
  Activity,
  ClipboardPen,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Calendar,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { cn, formatTime, getSriLankanHoliday, isSunday } from '../lib/utils';
import { translateToEnglish } from '../services/geminiService';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';
import AnalogTimePicker from './AnalogTimePicker';

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

export default function ModularFactoryFlow({ 
  onBack, 
  onReport,
  machines,
  reports = [],
  departmentName = 'Modular'
}: { 
  onBack: () => void, 
  onReport: (report: MachineReport) => Promise<void>,
  machines: Machine[],
  reports?: MachineReport[],
  departmentName?: string
}) {
  const [selectedSolidSection, setSelectedSolidSection] = useState<'Main Solid' | 'Machine Section' | 'Paint Section' | null>(null);
  const [step, setStep] = useState<'machines' | 'location' | 'work-types' | 'shift' | 'description' | 'scheduling'>('machines');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [scheduledMonth, setScheduledMonth] = useState(new Date());
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [scheduledTime, setScheduledTime] = useState(format(new Date(), 'HH:mm'));
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const filteredMachines = useMemo(() => {
    const getPriority = (m: Machine) => {
      const activeReports = reports.filter(r => r.machineId === m.id && r.status === 'pending');
      if (activeReports.some(r => r.workType === 'Break Down')) return 1;
      if (activeReports.some(r => r.workType === 'Repair')) return 2;
      if (activeReports.some(r => r.workType === 'Service')) return 3;
      return 4;
    };

    let base = machines.filter(m => m.department === departmentName);

    if (departmentName === 'Solid' && selectedSolidSection) {
      base = base.filter(m => getSolidSection(m) === selectedSolidSection);
    }

    return base.sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.name.localeCompare(b.name);
    });
  }, [machines, departmentName, reports, selectedSolidSection]);

  const pendingReportsInDept = useMemo(() => 
    reports.filter(r => 
      r.status === 'pending' && 
      (r.department === departmentName || (departmentName === 'Other' && SUB_LOCATIONS.includes(r.department)))
    ),
    [reports, departmentName]
  );

  const workTypes: { type: WorkType; icon: any; color: string; desc: string }[] = [
    { type: 'Repair', icon: Hammer, color: 'bg-amber-500', desc: 'Fix physical damage or failure' },
    { type: 'Service', icon: Cog, color: 'bg-blue-500', desc: 'Routine maintenance & inspection' },
    { type: 'Break Down', icon: AlertTriangle, color: 'bg-singer-red', desc: 'Critical system interruption' },
  ];

  const triggerReport = async (wType: WorkType, desc: string, scheduledDate?: string) => {
    if (!selectedMachine) return;

    setIsSubmitting(true);
    const report: MachineReport = {
      id: Math.random().toString(36).substr(2, 9),
      department: (selectedLocation as any) || (selectedMachine.department as any) || departmentName,
      machineId: selectedMachine.id,
      machineName: selectedMachine.name,
      workType: wType,
      description: desc,
      status: 'pending',
      createdAt: new Date().toISOString(),
      shift: selectedShift || 'None Shift',
      ...(scheduledDate && { scheduledAt: scheduledDate })
    };

    try {
      await onReport(report);
      setStep('machines');
      setSelectedMachine(null);
      setSelectedWorkType(null);
      setDescription('');
      setSelectedShift('');
    } catch (error) {
      console.error("Report submission failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMachineSelect = (m: Machine) => {
    setSelectedMachine(m);
    if (departmentName === 'Other') {
      setStep('location');
    } else {
      setStep('work-types');
    }
  };

  const handleLocationSelect = (loc: string) => {
    setSelectedLocation(loc);
    setStep('work-types');
  };

  // Initialize scheduling state
  useEffect(() => {
    if (step === 'scheduling') {
      const now = new Date();
      setScheduledDate(now);
      setScheduledTime(format(now, 'HH:mm'));
      setScheduledMonth(now);
    }
  }, [step]);

  const handleWorkTypeSelect = async (type: WorkType) => {
    setSelectedWorkType(type);
    setStep('shift');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine || !selectedWorkType || !description.trim()) return;

    setIsTranslating(true);
    try {
      const translated = await translateToEnglish(description);
      setDescription(translated);
      await triggerReport(selectedWorkType, translated);
    } catch (error) {
      console.error("Auto translation failed, submitting original", error);
      await triggerReport(selectedWorkType, description.trim());
    } finally {
      setIsTranslating(false);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-slate-50 min-h-0 overflow-hidden">
      {/* Pending Alerts Sidebar (Left Side) */}
      <aside className="w-full lg:w-80 bg-white border-r-2 border-slate-100 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-8 space-y-8">
          <header>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-2 leading-none">Operational Status</div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-2">
              <AlertCircle size={24} className="text-singer-red" />
              Pending Alerts
            </h2>
          </header>

          <div className="space-y-4">
            {pendingReportsInDept.length > 0 ? (
              pendingReportsInDept.map((report) => (
                <div key={report.id} className="p-6 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-singer-red transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-singer-red group-hover:scale-150 transition-transform">
                    <Zap size={32} />
                  </div>
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-singer-red bg-singer-red/5 px-2 py-0.5 rounded-full border border-singer-red/10">
                        {report.workType}
                      </span>
                      {report.scheduledAt && (
                        <span className="text-[8px] font-black text-amber-500 flex items-center gap-1 animate-pulse bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Calendar size={10} /> PLANNED
                        </span>
                      )}
                    </div>

                    {/* Date and Time block matching user instructions */}
                    <div className="grid grid-cols-2 gap-2 bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-bold text-slate-600 shadow-sm relative z-10">
                      <div>
                        <span className="text-slate-400 block uppercase text-[8px] font-black leading-none mb-1">Date</span>
                        <span className="font-mono text-slate-900 font-extrabold text-xs">{format(new Date(report.createdAt), 'yyyy-MM-dd')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase text-[8px] font-black leading-none mb-1">Time</span>
                        <span className="font-mono text-slate-900 font-extrabold text-xs">{formatTime(report.createdAt)}</span>
                      </div>
                    </div>

                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2" dangerouslySetInnerHTML={{ __html: report.machineName.replace('<br>', ' ') }} />
                    <div className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit">
                      {report.department === 'Other' ? 'OTHER' : (report.department.includes('FACTORY') ? report.department.replace(' FACTORY', '') : report.department)}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 italic leading-snug break-words">"{report.description}"</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 px-6 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                <CheckCircle2 className="mx-auto text-green-500 mb-2 opacity-50" size={32} />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sector Clear</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Reporting Flow */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-8 md:p-12 flex-1 flex flex-col">
        {/* Header - Centered Titles */}
        <header className="flex flex-col items-center mb-12 relative pt-8 sm:pt-0">
          <button 
            onClick={() => {
              if (step === 'machines') {
                if (departmentName === 'Solid' && selectedSolidSection !== null) {
                  setSelectedSolidSection(null);
                } else {
                  onBack();
                }
              }
              else if (step === 'location') setStep('machines');
              else if (step === 'work-types') {
                if (departmentName === 'Other') setStep('location');
                else setStep('machines');
              }
              else if (step === 'shift') setStep('work-types');
              else if (step === 'description') setStep('shift');
              else if (step === 'scheduling') setStep('shift');
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl hover:border-slate-900 transition-all text-slate-900 z-10 shadow-sm"
            disabled={isSubmitting}
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-center">
            <h2 className="flex items-center justify-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-2">
              {departmentName === 'Solid' && selectedSolidSection ? (
                <span className="flex items-center gap-1.5">
                  <span>Solid Factory</span>
                  <span className="text-slate-300 font-normal">/</span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    {selectedSolidSection === 'Main Solid' ? (
                      <Hammer size={12} className="text-emerald-600 animate-pulse" />
                    ) : selectedSolidSection === 'Machine Section' ? (
                      <Cog size={12} className="text-indigo-600 animate-spin" style={{ animationDuration: '4s' }} />
                    ) : (
                      <Paintbrush size={12} className="text-amber-600" />
                    )}
                    {selectedSolidSection}
                  </span>
                </span>
              ) : (
                departmentName === 'Other' ? departmentName : departmentName + ' Factory'
              )}
            </h2>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
              {step === 'machines' ? (departmentName === 'Solid' && !selectedSolidSection ? 'Location Selection' : 'Machine Selection') : 
               step === 'location' ? 'Location Assignment' :
               step === 'work-types' ? 'Operation Protocol' :
               step === 'shift' ? 'Work Shift Selection' :
               step === 'description' ? 'Operational Narrative' : 
               step === 'scheduling' ? 'Service Scheduling' : 'Report Logged'}
            </h1>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {departmentName === 'Solid' && selectedSolidSection === null ? (
            <motion.div
              key="solid-sections"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full py-6 space-y-8"
            >
              <div className="text-center max-w-lg mx-auto pb-4">
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs">
                  AUTHORIZED SECTOR ENTRY DIRECTIVE
                </p>
              </div>

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
                      className="group relative bg-white border-2 border-slate-200 rounded-[32px] p-8 flex flex-col items-start text-left gap-6 hover:border-slate-900 hover:shadow-[30px_30px_60px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-1 overflow-hidden"
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
            </motion.div>
          ) : step === 'machines' ? (
            <motion.div 
              key="machines"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-wrap justify-center gap-8"
            >
              {filteredMachines.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => handleMachineSelect(m)}
                  className="group bg-white border-2 border-slate-100 rounded-[40px] p-10 text-center hover:border-singer-red hover:shadow-2xl transition-all relative overflow-hidden w-full sm:w-[320px]"
                >
                  <div className="w-48 h-48 bg-slate-50 text-slate-300 rounded-[48px] flex items-center justify-center mb-10 mx-auto group-hover:bg-singer-red group-hover:text-white transition-all overflow-hidden ring-[12px] ring-slate-50 group-hover:ring-singer-red/10 shadow-inner">
                    {m.image ? (
                      <img src={m.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Settings size={64} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest leading-none block">Operational Unit 0{idx + 1}</span>
                    <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight tracking-tighter group-hover:text-singer-red transition-colors italic" dangerouslySetInnerHTML={{ __html: m.name }} />
                  </div>
                </button>
              ))}
            </motion.div>
          ) : step === 'location' ? (
            <motion.div
              key="location"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto w-full"
            >
              <div className="bg-white rounded-[40px] shadow-2xl border-2 border-slate-900 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white border-b-4 border-singer-red flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-singer-red rounded-xl">
                      <Activity size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic">Area Identification</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Operational Zone</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SUB_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => handleLocationSelect(loc)}
                      className="group bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 text-left hover:border-slate-900 hover:bg-white transition-all flex items-center justify-between"
                    >
                      <span className="text-sm font-black uppercase tracking-tight text-slate-900">{loc}</span>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-singer-red transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : step === 'work-types' ? (
            <motion.div 
              key="work-types"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-4 border-singer-red shadow-2xl">
                <div>
                  <span className="text-[10px] font-black text-singer-red uppercase tracking-[0.2em] mb-2 block">Active Target Unit</span>
                  <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter" dangerouslySetInnerHTML={{ __html: selectedMachine?.name || '' }} />
                </div>
                <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest">Unit Operational</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {workTypes.map((wt) => (
                  <button
                    key={wt.type}
                    onClick={() => handleWorkTypeSelect(wt.type)}
                    className="group bg-white border-2 border-slate-200 rounded-[32px] p-8 text-left hover:border-slate-900 hover:shadow-2xl transition-all flex flex-col gap-6"
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform",
                      wt.color
                    )}>
                      <wt.icon size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-1 group-hover:text-slate-900">{wt.type}</h3>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-tight leading-tight">{wt.desc}</p>
                    </div>
                    <div className="mt-auto pt-4 flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Initiate Protocol <ChevronRight size={16} />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : step === 'shift' ? (
            <motion.div 
              key="shift"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12 max-w-4xl w-full"
            >
              <div className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-4 border-singer-red shadow-2xl">
                <div>
                  <span className="text-[10px] font-black text-singer-red uppercase tracking-[0.2em] mb-2 block">Active Target Unit</span>
                  <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter" dangerouslySetInnerHTML={{ __html: selectedMachine?.name || '' }} />
                </div>
                <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-1">Work Type</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-singer-red">{selectedWorkType}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-10 bg-white p-8 sm:p-12 rounded-[40px] border-2 border-slate-100 shadow-2xl">
                {/* Weekday Shifts */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Weekday Shifts (Monday - Friday)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      '7:30 AM - 4:30 PM',
                      '7:30 AM - 8:30 PM',
                      '7:30 AM - 10:30 PM',
                      '7:30 AM - 12:30 AM',
                      '7:30 AM - 7:30 AM'
                    ].map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setSelectedShift(sh)}
                        className={cn(
                          "p-5 border-2 rounded-2xl text-left transition-all font-sans font-black uppercase tracking-tight relative overflow-hidden min-h-[50px] cursor-pointer",
                          selectedShift === sh
                            ? "border-singer-red bg-red-50/50 text-singer-red scale-[1.02]"
                            : "border-slate-100 hover:border-slate-300 text-slate-700 bg-slate-50/20 hover:bg-white"
                        )}
                      >
                        <span className="block text-sm font-black text-slate-900">{sh}</span>
                        <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">WEEKDAY CYCLE</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saturday Shifts */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Saturday Shifts</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      '7:30 AM - 1:00 PM',
                      '7:30 AM - 9:40 PM'
                    ].map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setSelectedShift(sh)}
                        className={cn(
                          "p-5 border-2 rounded-2xl text-left transition-all font-sans font-black uppercase tracking-tight relative overflow-hidden min-h-[50px] cursor-pointer",
                          selectedShift === sh
                            ? "border-singer-red bg-red-50/50 text-singer-red scale-[1.02]"
                            : "border-slate-100 hover:border-slate-300 text-slate-700 bg-slate-50/20 hover:bg-white"
                        )}
                      >
                        <span className="block text-sm font-black text-slate-900">{sh}</span>
                        <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">SATURDAY CYCLE</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sunday Shifts */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Sunday Shifts</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      '7:30 AM - 4:30 PM'
                    ].map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setSelectedShift(sh)}
                        className={cn(
                          "p-5 border-2 rounded-2xl text-left transition-all font-sans font-black uppercase tracking-tight relative overflow-hidden min-h-[50px] cursor-pointer",
                          selectedShift === sh
                            ? "border-singer-red bg-red-50/50 text-singer-red scale-[1.02]"
                            : "border-slate-100 hover:border-slate-300 text-slate-700 bg-slate-50/20 hover:bg-white"
                        )}
                      >
                        <span className="block text-sm font-black text-slate-900">{sh}</span>
                        <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">SUNDAY CYCLE</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Option */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Additional Option</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      'None Shift'
                    ].map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setSelectedShift(sh)}
                        className={cn(
                          "p-5 border-2 rounded-2xl text-left transition-all font-sans font-black uppercase tracking-tight relative overflow-hidden min-h-[50px] cursor-pointer",
                          selectedShift === sh
                            ? "border-singer-red bg-red-50/50 text-singer-red scale-[1.02]"
                            : "border-slate-100 hover:border-slate-300 text-slate-700 bg-slate-50/20 hover:bg-white"
                        )}
                      >
                        <span className="block text-sm font-black text-slate-900">{sh}</span>
                        <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">NO SHIFT ASSIGNED</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-8 border-t border-slate-100">
                  <button
                    disabled={!selectedShift}
                    onClick={() => {
                      if (selectedShift) {
                        if (selectedWorkType === 'Service') {
                          setStep('scheduling');
                        } else {
                          setStep('description');
                        }
                      }
                    }}
                    type="button"
                    className={cn(
                      "w-full sm:w-auto h-16 px-12 rounded-2xl flex items-center justify-center gap-2 border-2 text-sm font-black uppercase tracking-widest transition-all shadow-xl font-sans cursor-pointer",
                      selectedShift
                        ? "bg-slate-900 text-white border-slate-900 hover:bg-singer-red hover:border-singer-red"
                        : "bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed shadow-none"
                    )}
                  >
                    CONTINUE TO NEXT STEP <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : step === 'scheduling' ? (
            <motion.div
              key="scheduling"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto w-full"
            >
              <div className="bg-white rounded-[40px] shadow-2xl border-2 border-slate-900 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white border-b-4 border-amber-500 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500 text-slate-900 rounded-xl">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic text-amber-500">Service Schedule</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Assignment: Service</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Modern Calendar */}
                  <div className="space-y-6">
                    <header className="flex items-center justify-between px-2">
                       <h4 className="text-lg font-black uppercase tracking-tighter text-slate-900 italic">
                         {format(scheduledMonth, 'MMMM yyyy')}
                       </h4>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => setScheduledMonth(subMonths(scheduledMonth, 1))}
                           className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                         >
                           <ChevronLeft size={20} />
                         </button>
                         <button 
                           onClick={() => setScheduledMonth(addMonths(scheduledMonth, 1))}
                           className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                         >
                           <ChevronRight size={20} />
                         </button>
                       </div>
                    </header>

                    <div className="grid grid-cols-7 gap-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <div key={d} className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-2">{d}</div>
                      ))}
                      {(() => {
                        const start = startOfWeek(startOfMonth(scheduledMonth), { weekStartsOn: 1 });
                        const end = endOfWeek(endOfMonth(scheduledMonth), { weekStartsOn: 1 });
                        const days = eachDayOfInterval({ start, end });
                        
                        return days.map(day => {
                          const holiday = getSriLankanHoliday(day);
                          const isSun = isSunday(day);
                          const isSelected = isSameDay(day, scheduledDate);
                          
                          let bgClass = "hover:bg-slate-50";
                          let textClass = !isSameMonth(day, scheduledMonth) ? "text-slate-200" : "text-slate-900";
                          
                          if (isSameMonth(day, scheduledMonth)) {
                            if (holiday) {
                              bgClass = "bg-amber-100/80 hover:bg-amber-200 border border-amber-300";
                              textClass = "text-amber-950 font-bold";
                            } else if (isSun) {
                              bgClass = "bg-blue-50 hover:bg-blue-100 border border-blue-200";
                              textClass = "text-blue-700 font-bold";
                            }
                          } else {
                            if (holiday) {
                              bgClass = "bg-amber-50/30 border border-amber-100/30";
                              textClass = "text-amber-300/40";
                            } else if (isSun) {
                              bgClass = "bg-blue-50/20 border border-blue-100/20";
                              textClass = "text-blue-300/30";
                            }
                          }
                          
                          if (isSelected) {
                            bgClass = "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 z-10 scale-110";
                            textClass = "text-slate-900 font-black";
                          }
                          
                          return (
                            <button
                              key={day.toString()}
                              onClick={() => setScheduledDate(day)}
                              title={holiday ? `${holiday.name} (${holiday.type})` : isSun ? "Sunday" : undefined}
                              className={cn(
                                "aspect-square flex flex-col items-center justify-center rounded-2xl text-sm font-black transition-all relative group",
                                bgClass,
                                textClass,
                                isToday(day) && !isSelected && "text-singer-red after:content-[''] after:absolute after:bottom-2 after:w-1 after:h-1 after:bg-singer-red after:rounded-full"
                              )}
                            >
                              {format(day, 'd')}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Time & Confirmation */}
                  <div className="space-y-8 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Date</span>
                          <span className="text-sm font-black uppercase text-slate-900 italic">
                            {format(scheduledDate, 'EEEE, MMM do')}
                          </span>
                        </div>
                        {(() => {
                          const holiday = getSriLankanHoliday(scheduledDate);
                          if (holiday) {
                            return (
                              <div className="flex justify-between items-center bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-amber-950 text-xs font-bold gap-2">
                                <span className="uppercase text-[8px] tracking-widest bg-amber-200 px-1.5 py-0.5 rounded text-amber-800 shrink-0">
                                  {holiday.type} HOLIDAY
                                </span>
                                <span className="text-right truncate">{holiday.name}</span>
                              </div>
                            );
                          }
                          if (isSunday(scheduledDate)) {
                            return (
                              <div className="flex justify-between items-center bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-blue-950 text-xs font-bold gap-2">
                                <span className="uppercase text-[8px] tracking-widest bg-blue-200 px-1.5 py-0.5 rounded text-blue-800 shrink-0">
                                  WEEKEND
                                </span>
                                <span className="text-right">Sunday (Non-Working)</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Unit Identity</span>
                          <span className="text-sm font-black text-slate-900 text-right" dangerouslySetInnerHTML={{ __html: selectedMachine?.name || '' }} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] block ml-4 leading-none">Temporal Coordinate</label>
                        <button 
                          onClick={() => setIsTimePickerOpen(true)}
                          className="w-full bg-slate-50 border-4 border-transparent hover:border-amber-500 rounded-[32px] p-8 transition-all flex items-center justify-between group shadow-inner"
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm group-hover:bg-amber-500 group-hover:text-white transition-all">
                              <Clock size={32} />
                            </div>
                            <div className="text-left">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Service Time</div>
                              <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
                                {scheduledTime}
                              </div>
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all">
                            <ChevronRight size={24} />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setStep('work-types')}
                        className="flex-1 bg-slate-100 text-slate-400 py-6 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all border-2 border-transparent"
                      >
                        Abort
                      </button>
                      <button 
                        onClick={async () => {
                          const [hours, minutes] = scheduledTime.split(':');
                          const finalDate = new Date(scheduledDate);
                          finalDate.setHours(parseInt(hours), parseInt(minutes));
                          
                          const dateStr = format(finalDate, 'dd MMM yyyy');
                          const timeStr = format(finalDate, 'hh:mm a');
                          await triggerReport('Service', `Service Scheduled for ${dateStr} at ${timeStr}`, finalDate.toISOString());
                        }}
                        disabled={isSubmitting}
                        className="flex-[2] bg-amber-500 text-slate-900 py-6 rounded-[24px] font-black text-xl italic tracking-tighter flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={24} className="animate-spin" />
                            Logging...
                          </>
                        ) : (
                          <>
                            Log Schedule
                            <Send size={24} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isTimePickerOpen && (
                  <AnalogTimePicker 
                    label="Service Execution Time"
                    value={scheduledTime}
                    onClose={() => setIsTimePickerOpen(false)}
                    onChange={(val) => setScheduledTime(val)}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          ) : step === 'description' ? (
            <motion.div
              key="description"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto w-full"
            >
              <form onSubmit={handleSubmit} className="bg-white rounded-[40px] shadow-2xl border-2 border-slate-900 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white border-b-4 border-singer-red flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-singer-red rounded-xl">
                      <ClipboardPen size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic">Anomaly Description</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Assignment: {selectedWorkType}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-4">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Incident Log Narrative</label>
                      <AITranslationTool 
                        value={description} 
                        onTranslated={(translated) => setDescription(translated)} 
                      />
                    </div>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the machine status or failure in detail..."
                      className="w-full h-48 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-[24px] p-6 outline-none transition-all text-slate-800 font-bold text-lg placeholder:text-slate-200 resize-none"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting || isTranslating || !description.trim()}
                    className="w-full bg-singer-red text-white py-6 rounded-[24px] font-black text-xl italic tracking-tighter flex items-center justify-center gap-3 hover:bg-slate-900 transition-all shadow-[0px_20px_40px_rgba(211,47,47,0.2)] disabled:opacity-50 disabled:grayscale group"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        TRANSLATING TO ENGLISH...
                      </>
                    ) : isSubmitting ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        UPLOADING LOG...
                      </>
                    ) : (
                      <>
                        TRANSMIT TO MAINTENANCE
                        <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  </div>
  );
}
