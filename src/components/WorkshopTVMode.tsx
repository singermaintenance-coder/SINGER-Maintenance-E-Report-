import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tv, 
  Wrench, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  ArrowLeft, 
  Gauge, 
  Users, 
  Maximize, 
  Minimize, 
  Hammer, 
  Cog, 
  Shield,
  Activity,
  Sparkles,
  ChevronRight,
  Tv2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Machine, MachineReport, MaintenanceRecord } from '../types';

interface WorkshopTVModeProps {
  machines: Machine[];
  reports: MachineReport[];
  records: MaintenanceRecord[];
  onExit: () => void;
}

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

// Safe Web Audio API synthesizer for an authentic industrial workshop alert chime pulse
function playSirenSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const now = ctx.currentTime;
    
    // First high-contrast beep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(850, now);
    osc1.frequency.linearRampToValueAtTime(1050, now + 0.15);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.38);

    // Low harmonic for rich depth
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(425, now);
    gain2.gain.setValueAtTime(0.10, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.38);

    // Second overlapping beep 0.22s later for authentic double-pulse chime
    const delayedTime = now + 0.22;
    const osc1d = ctx.createOscillator();
    const gain1d = ctx.createGain();
    osc1d.type = 'sawtooth';
    osc1d.frequency.setValueAtTime(850, delayedTime);
    osc1d.frequency.linearRampToValueAtTime(1050, delayedTime + 0.15);
    gain1d.gain.setValueAtTime(0.12, delayedTime);
    gain1d.gain.exponentialRampToValueAtTime(0.01, delayedTime + 0.35);
    osc1d.connect(gain1d);
    gain1d.connect(ctx.destination);
    osc1d.start(delayedTime);
    osc1d.stop(delayedTime + 0.38);

    const osc2d = ctx.createOscillator();
    const gain2d = ctx.createGain();
    osc2d.type = 'triangle';
    osc2d.frequency.setValueAtTime(425, delayedTime);
    gain2d.gain.setValueAtTime(0.10, delayedTime);
    gain2d.gain.exponentialRampToValueAtTime(0.01, delayedTime + 0.35);
    osc2d.connect(gain2d);
    gain2d.connect(ctx.destination);
    osc2d.start(delayedTime);
    osc2d.stop(delayedTime + 0.38);
  } catch (err) {
    console.error("Sirens Web Audio failed:", err);
  }
}

function getElapsedDuration(createdAt: string, systemTime: Date): string {
  try {
    const elapsedMs = systemTime.getTime() - new Date(createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    if (elapsedMins <= 0) return 'Just now';
    
    const hrs = Math.floor(elapsedMins / 60);
    const residualMin = elapsedMins % 60;
    if (hrs > 24) {
      const days = Math.floor(hrs / 24);
      return `${days}d ${hrs % 24}h ago`;
    }
    return hrs > 0 ? `${hrs}h ${residualMin}m ago` : `${residualMin}m ago`;
  } catch (e) {
    return '0m ago';
  }
}

export default function WorkshopTVMode({
  machines,
  reports,
  records,
  onExit,
}: WorkshopTVModeProps) {
  const [selectedFactory, setSelectedFactory] = useState<string | null>('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [systemTime, setSystemTime] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState(0);

  // Keep track of which reports we have already acknowledged on mount or seen
  const [knownReportIds, setKnownReportIds] = useState<Set<string>>(() => new Set(reports.map(r => r.id)));
  const [activeAlert, setActiveAlert] = useState<MachineReport | null>(null);
  const [alertTimer, setAlertTimer] = useState<number | null>(null);

  // Sync System clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync and listen to newly created reports in real time to trigger the alert popup
  useEffect(() => {
    const activeReportsList = reports.filter(r => r.status === 'pending' || r.status === 'in-progress');
    const newlyAdded = activeReportsList.find(r => !knownReportIds.has(r.id));

    if (newlyAdded) {
      // Set to trigger center screen alert flash modal
      setActiveAlert(newlyAdded);

      // Add to known IDs
      setKnownReportIds(prev => {
        const next = new Set(prev);
        next.add(newlyAdded.id);
        return next;
      });

      // Clear existing automatic reset timers
      if (alertTimer) window.clearTimeout(alertTimer);

      const closeTimer = window.setTimeout(() => {
        setActiveAlert(null);
      }, 30000); // 30 seconds auto duration count

      setAlertTimer(closeTimer);
    } else {
      // Keep state in sync with all current reported entries
      setKnownReportIds(prev => {
        let changed = false;
        const next = new Set(prev);
        for (const r of reports) {
          if (!next.has(r.id)) {
            next.add(r.id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [reports, knownReportIds]);

  // Audio alarm playback control hook: Play alert for exactly 10 seconds total and stop if dismissed
  useEffect(() => {
    if (!activeAlert) return;

    // Play immediate chime
    playSirenSound();

    // Trigger repeating pulse every 1.5 seconds
    const intervalId = window.setInterval(() => {
      playSirenSound();
    }, 1500);

    // Stop alarm sound after exactly 10 seconds
    const stopAudioTimeout = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(stopAudioTimeout);
    };
  }, [activeAlert]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (alertTimer) window.clearTimeout(alertTimer);
    };
  }, [alertTimer]);

  // Compute shift information based on current system hours
  const currentShiftDetails = useMemo(() => {
    const hours = systemTime.getHours();
    const minutes = systemTime.getMinutes();
    const currentTimeFraction = hours + minutes / 60;

    let shift = 'SHIFT B (4.30PM-7.30AM)';
    let supervisor = 'MR SUPUN';
    let color = 'text-amber-400 bg-amber-950/40 border-amber-850';

    if (currentTimeFraction >= 7.5 && currentTimeFraction < 16.5) {
      shift = 'SHIFT A (7.30am-4.30pm)';
      supervisor = 'MR SUPUN';
      color = 'text-sky-400 bg-sky-950/40 border-sky-850';
    }

    return { shift, supervisor, color };
  }, [systemTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error requesting fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // 1. Filtered Dataset of current factory
  const factoryMachines = useMemo(() => {
    if (!selectedFactory || selectedFactory === 'ALL') return machines;
    return machines.filter(m => m.department === selectedFactory);
  }, [machines, selectedFactory]);

  const activeReports = useMemo(() => {
    const relevantReports = !selectedFactory || selectedFactory === 'ALL'
      ? reports
      : reports.filter(r => r.department === selectedFactory);
    
    // Filters out finalized status
    return relevantReports.filter(r => r.status === 'pending' || r.status === 'in-progress');
  }, [reports, selectedFactory]);

  // Sort reports: Urgent (Break Down + pending) -> Pending -> In-Progress
  const sortedReports = useMemo(() => {
    return [...activeReports].sort((a, b) => {
      const aUrgent = a.status === 'pending' && a.workType === 'Break Down';
      const bUrgent = b.status === 'pending' && b.workType === 'Break Down';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      
      const aPending = a.status === 'pending';
      const bPending = b.status === 'pending';
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeReports]);

  // Reset activeIndex when the factory selection changes
  useEffect(() => {
    setActiveIndex(0);
  }, [selectedFactory]);

  // 2. Carousel rotation logic. Time limit: 5 seconds per slide.
  const slideDurationMs = 5000;
  const rotationLength = sortedReports.length > 0 ? sortedReports.length : factoryMachines.length;

  useEffect(() => {
    if (rotationLength <= 1) {
      setActiveIndex(0);
      return;
    }
    const slider = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % rotationLength);
    }, slideDurationMs);
    
    return () => clearInterval(slider);
  }, [rotationLength]);

  // Progress bar ticker calculation for active card transition
  const [percentElapsed, setPercentElapsed] = useState(0);
  useEffect(() => {
    setPercentElapsed(0);
    const stepMs = 100;
    const totalSteps = slideDurationMs / stepMs;
    let elapsedSteps = 0;

    const interval = setInterval(() => {
      elapsedSteps++;
      setPercentElapsed(Math.min(100, (elapsedSteps / totalSteps) * 100));
    }, stepMs);

    return () => clearInterval(interval);
  }, [activeIndex, rotationLength]);

  // 3. Selection portal view
  if (selectedFactory === null) {
    const options = [
      { id: 'ALL', name: 'GLOBAL FACTORY OVERVIEW', subtitle: 'TV Monitor for all factory departments', icon: Tv, color: 'bg-slate-900 border-slate-700 hover:border-red-600' },
      { id: 'Solid', name: 'SOLID WOOD WORKSHOP', subtitle: 'TV Monitor for solid wood line', icon: Hammer, color: 'bg-emerald-950/40 border-emerald-800 hover:border-emerald-400' },
      { id: 'Modular', name: 'MODULAR WORKSHOP', subtitle: 'TV Monitor for board processing line', icon: Cog, color: 'bg-indigo-950/40 border-indigo-800 hover:border-indigo-400' },
      { id: 'Agro', name: 'AGRO WATER PUMP', subtitle: 'TV Monitor for pump assembly and welding', icon: Gauge, color: 'bg-sky-950/40 border-sky-800 hover:border-sky-400' },
      { id: 'Sofa', name: 'SOFA & UPHOLSTERY', subtitle: 'TV Monitor for upholstery systems & sawing', icon: Shield, color: 'bg-pink-950/40 border-pink-800 hover:border-pink-400' },
      { id: 'Other', name: 'MISC WORKSHOPS', subtitle: 'TV Monitor for power grid, compressors & light repair', icon: Wrench, color: 'bg-amber-950/40 border-amber-800 hover:border-amber-400' },
    ];

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
        
        <div className="max-w-4xl w-full relative z-10 space-y-10">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-[0.2em] text-[#d32f2f] shadow-lg">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
              SINGER INDUSTRIAL LIVE BROADCAST
            </div>
            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter italic leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
              WORKSHOP TV DASHBOARD
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-widest max-w-xl mx-auto">
              Select division to deploy a hands-free rotating television dashboard view.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedFactory(opt.id)}
                  className={cn(
                    "group text-left p-6 rounded-3xl border-2 transition-all duration-300 transform hover:-translate-y-1 flex items-start gap-4 hover:shadow-[0px_20px_40px_rgba(211,47,47,0.06)] cursor-pointer",
                    opt.color
                  )}
                >
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
                    <Icon size={24} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-black uppercase text-sm tracking-widest text-slate-200 group-hover:text-white transition-colors">{opt.name}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate leading-normal">{opt.subtitle}</p>
                    <div className="pt-1.5 flex items-center gap-1.5 text-[8px] font-black tracking-widest text-red-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      Launch TV Dashboard <ChevronRight size={10} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-center pt-6 border-t border-slate-900">
            <button
              onClick={onExit}
              className="flex items-center gap-2.5 text-xs font-black text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-900 px-8 py-4 rounded-2xl border border-slate-800 uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={16} /> Exit TV Display Configuration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active TV Mode layout datasets
  const hasJobs = sortedReports.length > 0;
  
  // Choose item based on current active index safely
  const currentItem = hasJobs 
    ? sortedReports[activeIndex % sortedReports.length]
    : factoryMachines[activeIndex % factoryMachines.length];

  // Lookup machine model
  const currentMachine = currentItem 
    ? (hasJobs 
        ? machines.find(m => m.id === (currentItem as MachineReport).machineId) 
        : (currentItem as Machine))
    : null;

  // Build upcoming queue list (up to 4 items) for preview side panel
  const previewItems = (() => {
    if (rotationLength <= 1) return [];
    
    const items: Array<{ id: string; name: string; info: string; isUrgent?: boolean; isService?: boolean; isRepair?: boolean; isInProgress?: boolean }> = [];
    for (let i = 1; i <= Math.min(4, rotationLength - 1); i++) {
      const idx = (activeIndex + i) % rotationLength;
      if (hasJobs) {
        const report = sortedReports[idx];
        const isUrgent = report.status === 'pending' && report.workType === 'Break Down';
        const isService = report.status === 'pending' && report.workType === 'Service';
        const isRepair = report.status === 'pending' && report.workType === 'Repair';
        const isInProgress = report.status === 'in-progress';
        
        items.push({
          id: report.id,
          name: report.machineName.replace(/<br\s*\/?>/gi, ' '),
          info: report.workType.toUpperCase(),
          isUrgent,
          isService,
          isRepair,
          isInProgress
        });
      } else {
        const mach = factoryMachines[idx];
        items.push({
          id: mach.id,
          name: mach.name.replace(/<br\s*\/?>/gi, ' '),
          info: 'ONLINE & HEALTHY'
        });
      }
    }
    return items;
  })();

  // Visual status details computation
  const statusDetails = (() => {
    if (hasJobs && currentItem) {
      const job = currentItem as MachineReport;
      const isUrgent = job.status === 'pending' && job.workType === 'Break Down';
      const isService = job.status === 'pending' && job.workType === 'Service';
      const isRepair = job.status === 'pending' && job.workType === 'Repair';
      const isInProgress = job.status === 'in-progress';

      if (isUrgent) {
        return {
          title: "URGENT BREAKDOWN",
          subtitle: "Immediate Maintenance Response Dispatched",
          themeColor: "text-red-500",
          bgColor: "bg-red-950/20",
          glowColor: "shadow-[0_0_50px_rgba(239,68,68,0.3)] border-red-700/60",
          iconBg: "bg-red-500",
          statusTheme: "RED",
          accentLine: "bg-red-600"
        };
      } else if (isService) {
        return {
          title: "SERVICE WORK PENDING",
          subtitle: "Preventative Health Audit Scheduled & Pending",
          themeColor: "text-blue-500",
          bgColor: "bg-blue-950/20",
          glowColor: "shadow-[0_0_50px_rgba(59,130,246,0.3)] border-blue-700/60",
          iconBg: "bg-blue-500",
          statusTheme: "BLUE",
          accentLine: "bg-blue-600"
        };
      } else if (isRepair) {
        return {
          title: "REPAIR WORK PENDING",
          subtitle: "Symptom Correction Registered & Pending",
          themeColor: "text-yellow-400",
          bgColor: "bg-yellow-950/20",
          glowColor: "shadow-[0_0_50px_rgba(234,179,8,0.25)] border-yellow-700/50",
          iconBg: "bg-yellow-500",
          statusTheme: "YELLOW",
          accentLine: "bg-yellow-500"
        };
      } else if (isInProgress) {
        return {
          title: "REPAIR IN PROGRESS",
          subtitle: "Technician Currently Addressing Workstation",
          themeColor: "text-orange-400",
          bgColor: "bg-orange-950/20",
          glowColor: "shadow-[0_0_50px_rgba(249,115,22,0.25)] border-orange-700/50",
          iconBg: "bg-orange-500",
          statusTheme: "ORANGE",
          accentLine: "bg-orange-500"
        };
      } else {
        return {
          title: "COMPLETED",
          subtitle: "Maintenance Complete & Audited",
          themeColor: "text-emerald-400",
          bgColor: "bg-emerald-950/15",
          glowColor: "shadow-[0_0_40px_rgba(16,185,129,0.15)] border-slate-900",
          iconBg: "bg-emerald-500",
          statusTheme: "GREEN",
          accentLine: "bg-emerald-500"
        };
      }
    } else {
      // Normal healthy operational machine
      return {
        title: "SYSTEM HEALTHY",
        subtitle: "Workstation Operating Normally",
        themeColor: "text-emerald-400",
        bgColor: "bg-emerald-950/15",
        glowColor: "shadow-[0_0_40px_rgba(16,185,129,0.15)] border-slate-900",
        iconBg: "bg-emerald-500",
        statusTheme: "GREEN",
        accentLine: "bg-emerald-500/40"
      };
    }
  })();

  // Calculate elapsed time formatted for active jobs
  const elapsedText = (() => {
    if (!hasJobs || !currentItem) return '';
    try {
      const job = currentItem as MachineReport;
      const elapsedMs = systemTime.getTime() - new Date(job.createdAt).getTime();
      const elapsedMins = Math.floor(elapsedMs / 60000);
      if (elapsedMins <= 0) return 'Just now';
      
      const hrs = Math.floor(elapsedMins / 60);
      const residualMin = elapsedMins % 60;
      return hrs > 0 ? `${hrs} hrs ${residualMin} mins ago` : `${residualMin} mins ago`;
    } catch (e) {
      return '';
    }
  })();

  // Beautiful stylized Machine image or illustration component mapping
  const MachineDisplayImage = ({ className, altName, imgUrl }: { className?: string; altName: string; imgUrl?: string }) => {
    if (imgUrl) {
      return (
        <div className={cn("relative overflow-hidden w-full h-full rounded-2xl bg-black/40 flex items-center justify-center p-3 border border-white/5", className)}>
          <img 
            src={imgUrl} 
            alt={altName} 
            className="w-full h-full object-contain max-h-[380px] filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] brightness-95 select-none" 
            referrerPolicy="no-referrer"
          />
          {/* Subtle overlay grid inside image */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 to-transparent pointer-events-none" />
        </div>
      );
    }

    // High quality illustration placeholder if empty link
    return (
      <div className={cn("w-full h-full rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden", className)}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/10 via-slate-950/20 to-slate-950/60 opacity-60 pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="w-20 h-20 bg-slate-955 border border-slate-800 rounded-3xl m-auto flex items-center justify-center text-slate-500 shadow-inner">
            <Activity size={40} className="text-slate-400 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h5 className="font-black text-xs text-slate-400 uppercase tracking-widest">SINGER TELEMETRY ACTIVE</h5>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">No photorealistic graphics registered</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#02050c] text-slate-100 flex flex-col font-sans relative overflow-hidden select-none">
      
      {/* Dynamic Digital Scanlines pattern backdrop to make it feel like a real screen */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)+50%,rgba(0,0,0,0.25)+50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[size:100%_4px,6px_100%] z-50 opacity-40" />

      {/* 1. Master Emergency Indicator Header ticker */}
      <div className="shrink-0">
        <AnimatePresence mode="wait">
          {sortedReports.some(r => r.status === 'pending' && r.workType === 'Break Down') ? (
            <motion.div 
              key="emergency-header"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#d32f2f] text-white py-3 px-6 text-center text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 animate-pulse border-b border-red-800 shadow-2xl relative z-40"
            >
              <AlertTriangle className="animate-bounce" size={16} />
              <span>
                CRITICAL BREAKDOWN ACTIVE IN WORKSHOP // ALL MAINTENANCE PERSONNELS DEPLOYED
              </span>
            </motion.div>
          ) : (
            <div className="bg-[#042e15] text-emerald-400 border-b border-emerald-900/60 py-3 px-6 text-center text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-sm relative z-40">
              <CheckCircle size={14} className="text-emerald-400 animate-pulse" />
              <span>SINGER PLANT OPERATIONS HEALTHY // SECURE MONITOR BROADCAST LINK STABLE</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Television Header */}
      <header className="shrink-0 bg-[#040813] border-b border-slate-900 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-40">
        
        {/* Brand Information */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#d32f2f] flex items-center justify-center rounded-2xl p-1 shadow-lg border border-red-700 font-serif">
            <span className="text-white font-black italic text-2xl leading-none">S</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black italic tracking-widest text-[#d32f2f] leading-none uppercase">
                SINGER INDUSTRIAL BROADCAST
              </h2>
              <span className="text-[8px] font-black px-2 py-0.5 rounded bg-red-950/40 border border-red-800 text-red-500 animate-pulse">
                TV MONITOR
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                {selectedFactory === 'ALL' ? 'GLOBAL LINE ACTIVE' : `${selectedFactory.toUpperCase()} WORKSHOP TELEMETRY`}
              </span>
              <span className="text-[10px] text-slate-600 font-extrabold">•</span>
              <button 
                onClick={() => setSelectedFactory(null)}
                className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest underline underline-offset-2 cursor-pointer transition-colors"
              >
                Change Section
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Clocks & Active shift info */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Duty supervisor */}
          <div className="bg-[#091124] border border-slate-850 p-2.5 px-4 rounded-2xl flex items-center gap-2.5">
            <Users size={16} className="text-slate-400 shrink-0" />
            <div className="text-left min-w-[110px]">
              <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">DUTY SUPERVISOR</span>
              <span className="block text-xs font-black text-slate-350 uppercase mt-1 tracking-tight leading-none truncate">
                {currentShiftDetails.supervisor}
              </span>
            </div>
          </div>

          {/* Active Shift */}
          <div className={cn("bg-[#091124] border p-2.5 px-4 rounded-2xl flex items-center gap-2.5", currentShiftDetails.color)}>
            <div className="text-left">
              <span className="block text-[8px] font-black opacity-60 uppercase tracking-widest leading-none">ACTIVE CREW</span>
              <span className="block text-xs font-black uppercase mt-1 tracking-tight leading-none">
                {currentShiftDetails.shift}
              </span>
            </div>
          </div>

          {/* High visibility clock */}
          <div className="bg-slate-900/60 border border-slate-800 p-2.5 px-6 rounded-2xl flex items-center justify-center gap-3.5 min-w-[160px]">
            <Clock size={18} className="text-slate-400 animate-pulse shrink-0" />
            <div className="text-right">
              <div className="text-lg font-mono font-black text-slate-100 leading-none select-all">
                {systemTime.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1 text-right leading-none">
                {systemTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Screen tools */}
          <div className="flex gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-3 bg-[#091124] hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-2xl transition-all cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button
              onClick={() => setSelectedFactory(null)}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-950 border border-slate-800 text-slate-300 hover:text-rose-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
            >
              EXIT TV
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Rotating TV Display Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row p-6 gap-6 relative z-15 overflow-hidden">
        
        {/* LEFT/CENTRAL DISPLAY: Large interactive revolving cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 relative">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={`dashboard-slide-${currentItem ? currentItem.id : 'empty'}`}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className={cn(
                "flex-1 bg-[#050b16] border-2 rounded-[36px] p-8 flex flex-col md:flex-row gap-8 relative overflow-hidden",
                statusDetails.glowColor
              )}
            >
              {/* Outer status decorative absolute indicator corner badge */}
              <div className={cn(
                "absolute top-0 right-0 py-1.5 px-6 font-black uppercase tracking-[0.2em] text-[9px] rounded-bl-3xl border-l border-b border-black/10 text-white shadow-md z-30",
                statusDetails.iconBg
              )}>
                SLIDE {activeIndex + 1} / {rotationLength}
              </div>

              {currentItem ? (
                <>
                  {/* Left Side: Photo/Illustration Box of machine */}
                  <div className="w-full md:w-1/2 flex flex-col justify-between h-full min-h-[280px] md:min-h-0">
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2">TELEMETRY GRAPHICS FEED</h4>
                      <MachineDisplayImage 
                        className="flex-1 max-h-[390px]"
                        altName={currentMachine?.name || 'Machine'}
                        imgUrl={currentMachine?.image}
                      />
                    </div>

                    {/* Left footer specifications data sheet display */}
                    <div className="mt-4 pt-4 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                      <span>WIDGET ID: {(currentMachine?.id || 'N/A').toUpperCase()}</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        STREAMED DISPATCH DATA OK
                      </span>
                    </div>
                  </div>

                  {/* Right Side: Machine telemetry, status and problem descriptions */}
                  <div className="w-full md:w-1/2 flex flex-col justify-between h-full space-y-6">
                    
                    {/* Upper content section */}
                    <div className="space-y-4">
                      
                      {/* Section, Factory department tags */}
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {selectedFactory === 'ALL' && currentMachine ? `${currentMachine.department.toUpperCase()} DIVISION` : `${(selectedFactory || '').toUpperCase()} DIVISION`}
                        </span>
                        <span className="px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {currentMachine ? getSolidSection(currentMachine) : 'Auxiliary Section'}
                        </span>
                      </div>

                      {/* Bold Machine Name */}
                      <div className="space-y-1">
                        <h1 className="text-3xl sm:text-5xl font-black italic tracking-tighter uppercase leading-none text-white select-all">
                          {currentMachine ? currentMachine.name.replace(/<br\s*\/?>/gi, ' ') : 'AUXILIARY SYSTEM'}
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Registered Singer Production Workstation
                        </p>
                      </div>

                      {/* Separator Accent status line */}
                      <div className="h-1.5 w-24 rounded-full overflow-hidden bg-slate-900">
                        <div className={cn("h-full", statusDetails.accentLine)} />
                      </div>

                      {/* Interactive Telemetry Log content */}
                      <div className="pt-2 space-y-4">
                        
                        {/* Status glowing header banner */}
                        <div className={cn("p-5 rounded-2xl flex items-center gap-4 border", statusDetails.bgColor, statusDetails.glowColor)}>
                          <div className={cn("w-3.5 h-3.5 rounded-full animate-ping shrink-0", statusDetails.iconBg)} />
                          <div>
                            <h3 className={cn("text-base font-black uppercase tracking-widest leading-none", statusDetails.themeColor)}>
                              {statusDetails.title}
                            </h3>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 leading-none">
                              {statusDetails.subtitle}
                            </span>
                          </div>
                        </div>

                        {/* If breakdown job active, describe problems */}
                        {hasJobs ? (
                          <div className="space-y-3.5">
                            <div className="space-y-1">
                              <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">REPORTED FAULT</span>
                              <p className="text-slate-200 text-lg sm:text-xl font-bold uppercase leading-relaxed max-w-xl">
                                "{(currentItem as MachineReport).description || 'NO ADDITIONAL DETAILED COMMENT PROVIDED'}"
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                              <div className="space-y-0.5">
                                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">WORK CATEGORY</span>
                                <span className="block font-black text-[13px] text-slate-350 uppercase">
                                  {(currentItem as MachineReport).workType.toUpperCase()}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">LOGGED DURATION</span>
                                <span className="block font-black text-[13px] text-rose-500 uppercase">
                                  {elapsedText}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Healthy standby mode documentation
                          <div className="space-y-3 p-5 rounded-2xl bg-slate-900/40 border border-slate-850">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Sparkles size={16} />
                              <span className="font-extrabold uppercase text-xs tracking-wider">ALL INTERNAL DIAGNOSTICS NORMAL</span>
                            </div>
                            <p className="text-xs font-bold leading-relaxed text-slate-400 uppercase tracking-wide">
                              This production station is registered as completely functional. No outstanding breakdown requests, maintenance orders, or service reports cataloged.
                            </p>
                          </div>
                        )}

                      </div>

                    </div>

                    {/* Bottom Rotation progression slider timing */}
                    <div className="pt-4 border-t border-slate-900 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        <span>EST NEXT TV SWEEP</span>
                        <span>{Math.round((slideDurationMs - (percentElapsed / 100) * slideDurationMs) / 1000)} SEC.</span>
                      </div>
                      
                      {/* Progress ticking horizontal slot */}
                      <div className="h-1 bg-slate-900 rounded-full w-full overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-100 ease-linear", statusDetails.accentLine)}
                          style={{ width: `${percentElapsed}%` }}
                        />
                      </div>
                    </div>

                  </div>
                </>
              ) : (
                // Safe empty feedback fallback should there be NO machines at all in dataset
                <div className="m-auto text-center space-y-4 max-w-sm py-12">
                  <Tv className="m-auto text-slate-700 animate-pulse" size={50} />
                  <div className="space-y-2">
                    <h3 className="font-black uppercase text-sm tracking-widest text-[#f1f5f9]">FACTORY CLASSIFICATIONS EMPTY</h3>
                    <p className="text-[10px] text-slate-400 leading-normal uppercase font-semibold">No operational machine registrations exist inside this specific database selection.</p>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </div>        {/* RIGHT PREVIEW COLUMN: Compact Queue sidebar */}
        <aside className="w-full lg:w-[380px] shrink-0 bg-[#040813] border border-slate-900 rounded-[36px] p-6 flex flex-col justify-between shadow-xl">
          
          <div className="space-y-5 flex-1 flex flex-col min-h-0">
            
            {/* Queue title banner and job tally */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div>
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-100">
                  ALL PENDING JOBS BOARD
                </h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.18em] mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping shrink-0" />
                  Live Operational Queue
                </p>
              </div>
              
              <div className="text-right">
                <span className="text-xs font-black italic tracking-tighter text-[#d32f2f] bg-red-950/20 px-3 py-1 rounded-full border border-red-900 shadow-inner">
                  {sortedReports.length} JOB{sortedReports.length !== 1 ? 'S' : ''}
                </span>
              </div>
            </div>

            {/* List sequence queue item view */}
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-850">
                
                {sortedReports.length > 0 ? (
                  sortedReports.map((report, idx) => {
                    const mach = machines.find(m => m.id === report.machineId);
                    const isUrgent = report.status === 'pending' && report.workType === 'Break Down';
                    const isService = report.status === 'pending' && report.workType === 'Service';
                    const isRepair = report.status === 'pending' && report.workType === 'Repair';
                    const isInProgress = report.status === 'in-progress';
                    const elapsed = getElapsedDuration(report.createdAt, systemTime);
                    const sectionName = mach ? getSolidSection(mach) : 'Line Unit';

                    return (
                      <button
                        key={`queue-compact-${report.id}`}
                        onClick={() => setActiveIndex(idx)}
                        className={cn(
                          "w-full text-left p-3.5 rounded-2xl flex gap-3 border relative overflow-hidden transition-all duration-205 cursor-pointer hover:bg-slate-900/35 hover:scale-[1.01] active:scale-[0.98]",
                          activeIndex === idx 
                            ? isUrgent 
                              ? "bg-slate-900 border-[#d32f2f] ring-1 ring-[#d32f2f]/40"
                              : isService
                                ? "bg-slate-900 border-blue-500 ring-1 ring-blue-500/40"
                                : isRepair
                                  ? "bg-slate-900 border-yellow-500 ring-1 ring-yellow-500/40"
                                  : "bg-slate-900 border-orange-500 ring-1 ring-orange-500/40"
                            : isUrgent 
                              ? "bg-red-950/10 border-red-950/40 hover:border-red-900/65" 
                              : isService
                                ? "bg-blue-950/10 border-blue-950/40 hover:border-blue-900/65"
                                : isRepair
                                  ? "bg-yellow-950/10 border-yellow-950/40 hover:border-yellow-900/65"
                                  : "bg-orange-950/10 border-orange-950/40 hover:border-orange-900/65"
                        )}
                      >
                        {/* Highlight edge color vertical rail */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1.5",
                          isUrgent ? "bg-[#d32f2f] animate-pulse" :
                          isService ? "bg-blue-500" :
                          isRepair ? "bg-yellow-500" :
                          "bg-orange-500"
                        )} />

                        {/* Machine Image (avatar) */}
                        {mach?.image ? (
                          <img 
                            src={mach.image} 
                            alt={mach.name} 
                            className="w-12 h-12 rounded-xl object-contain bg-black/40 border border-slate-800 shrink-0 select-none"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            <Activity size={18} />
                          </div>
                        )}

                        {/* Details content of the job */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="font-extrabold text-[12px] truncate text-slate-200 uppercase tracking-tight leading-none">
                              {report.machineName.replace(/<br\s*\/?>/gi, ' ')}
                            </h4>
                            
                            <span className={cn(
                              "shrink-0 font-mono text-[7px] font-black px-1.5 py-0.5 rounded uppercase border leading-none",
                              isUrgent 
                                ? "text-red-500 bg-red-950/50 border-red-500/30" 
                                : isService
                                  ? "text-blue-400 bg-blue-950/50 border-blue-500/30"
                                  : isRepair
                                    ? "text-yellow-400 bg-yellow-950/50 border-yellow-500/30"
                                    : "text-orange-400 bg-orange-950/50 border-orange-500/30"
                            )}>
                              {isUrgent ? 'URGENT' : isService ? 'SERVICE PENDING' : isRepair ? 'REPAIR PENDING' : 'IN PROGRESS'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>SECTION: {sectionName}</span>
                            <span className={cn(
                              isUrgent ? "text-red-500" : 
                              isService ? "text-blue-500" : 
                              isRepair ? "text-yellow-500" : 
                              "text-orange-500"
                            )}>
                              {report.workType.toUpperCase()}
                            </span>
                          </div>

                          {/* Trouble detail & live ticker */}
                          <div className="pt-1.5 flex items-center justify-between gap-1 text-[8px] font-bold text-slate-500 tracking-wider border-t border-slate-900/50">
                            <span className="truncate max-w-[150px] italic">
                              "{report.description || 'NO ADDITIONAL DETAILS'}"
                            </span>
                            <span className="shrink-0 text-slate-450 font-mono select-all">
                              {elapsed}
                            </span>
                          </div>
                        </div>

                      </button>
                    );
                  })
                ) : (
                  // Standing idle loops
                  <div className="flex flex-col items-center justify-center text-center text-slate-600 uppercase tracking-widest text-[11px] py-20 h-full scale-100">
                    <Tv2 className="text-slate-800 mb-2 animate-pulse" size={36} />
                    <p className="font-black text-slate-400">ALL SYSTEMS HEALTHY</p>
                    <p className="text-[9px] text-slate-500 mt-1 uppercase">No pending workshop jobs registered.</p>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Static bottom instructions */}
          <div className="shrink-0 mt-4 pt-4 border-t border-slate-900 text-[8px] font-black text-slate-600 uppercase tracking-[0.15em] leading-normal">
            * This display is hands-free and refreshes live parameters via high-security cloud listeners automatically.
          </div>
        </aside>
      </div>

      {/* 4. Footer */}
      <footer className="shrink-0 bg-[#02050c] border-t border-slate-900/40 px-6 py-3 flex flex-col sm:flex-row justify-between items-center text-[8px] font-black text-slate-500 uppercase tracking-widest gap-2 relative z-40">
        <span>© SINGER (SRI LANKA) PLC // TELEMETRY BROADCAST PROTOCOL v4.3</span>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
          <span>BROADCAST CONSOLE LIVE & DYNAMICALLY LINKED</span>
        </div>
      </footer>

      {/* 5. Center Emergency Alert Popup Overlay */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 md:p-12 bg-black/95 backdrop-blur-md"
          >
            {/* Pulsing hazard lights backdrop */}
            <div className={cn(
              "absolute inset-x-0 top-0 h-16 animate-pulse opacity-90 flex items-center justify-center text-[13px] md:text-sm font-black uppercase tracking-[0.25em] text-white z-10",
              activeAlert.workType === 'Break Down' ? "bg-[#d32f2f]" :
              activeAlert.workType === 'Service' ? "bg-blue-600" : "bg-yellow-600"
            )}>
              {activeAlert.workType === 'Break Down' ? '🚨 NEW CRITICAL BREAKDOWN LOGGED 🚨' :
               activeAlert.workType === 'Service' ? '🔧 NEW PREVENTATIVE HEALTH AUDIT ASSIGNED 🔧' :
               '🛠️ NEW MAINTENANCE REPAIR DISPATCHED 🛠️'}
            </div>

            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: -30, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className={cn(
                "w-full max-w-5xl bg-slate-950 rounded-[44px] overflow-hidden border-4 p-10 md:p-14 relative flex flex-col gap-8",
                activeAlert.workType === 'Break Down'
                  ? "border-[#d32f2f] shadow-[0_0_100px_rgba(239,68,68,0.55)]"
                  : activeAlert.workType === 'Service'
                    ? "border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.45)]"
                    : "border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.45)]"
              )}
            >
              {/* Flashing border pulsing animation bar if Breakdown */}
              {activeAlert.workType === 'Break Down' && (
                <div className="absolute inset-0 border-4 border-[#d32f2f] animate-pulse rounded-[40px] pointer-events-none" />
              )}

              {/* Popup Header with warning icon */}
              <div className="flex items-center gap-5 border-b border-slate-900 pb-5 mt-4 shrink-0">
                <div className={cn(
                  "p-4 rounded-full animate-bounce shrink-0 text-white",
                  activeAlert.workType === 'Break Down' ? "bg-[#d32f2f]" :
                  activeAlert.workType === 'Service' ? "bg-blue-600" : "bg-yellow-500"
                )}>
                  <AlertTriangle size={36} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white leading-none">
                    {activeAlert.workType === 'Break Down' ? 'NEW CRITICAL BREAKDOWN LOGGED' :
                     activeAlert.workType === 'Service' ? 'NEW SERVICE WORK PENDING' :
                     'NEW MAINTENANCE REPAIR ORDER'}
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-450 uppercase tracking-widest mt-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                    DISPATCH TIME: {new Date(activeAlert.createdAt).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Main alert card details */}
              <div className="flex flex-col lg:flex-row gap-8 my-4">
                
                {/* Machine View */}
                <div className="w-full lg:w-1/2 shrink-0">
                  {(() => {
                    const mach = machines.find(m => m.id === activeAlert.machineId);
                    return mach?.image ? (
                      <div className="w-full h-64 lg:h-72 rounded-2xl bg-black/45 flex items-center justify-center p-4 border border-white/5 overflow-hidden">
                        <img 
                          src={mach.image} 
                          alt={mach.name} 
                          className="w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] brightness-95"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-64 lg:h-72 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                        <Activity className="text-slate-500 animate-pulse mb-3 animate-bounce" size={48} />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">SINGER TELEMETRY BROADCAST</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Machine Description */}
                <div className="flex-1 space-y-6">
                  {(() => {
                    const mach = machines.find(m => m.id === activeAlert.machineId);
                    const sectionName = mach ? getSolidSection(mach) : 'Main Solid';
                    
                    const priorityLabel = 
                      activeAlert.workType === 'Break Down' ? 'CRITICAL (PRIORITY 1) - SYSTEM STOPPAGE' :
                      activeAlert.workType === 'Repair' ? 'URGENT (PRIORITY 2) - SYMPTOM REPAIR' :
                      'ROUTINE (PRIORITY 3) - PREVENTATIVE HEALTH AUDIT';

                    const priorityColor = 
                      activeAlert.workType === 'Break Down' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
                      activeAlert.workType === 'Repair' ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' :
                      'text-blue-500 bg-blue-500/10 border-blue-500/20';

                    return (
                      <>
                        <div>
                          <span className="block text-xs font-black text-slate-500 uppercase tracking-widest">WORKSTATION / LINE</span>
                          <h3 className="text-2xl sm:text-3xl font-black italic tracking-tight uppercase text-white leading-tight mt-1.5">
                            {activeAlert.machineName.replace(/<br\s*\/?>/gi, ' ')}
                          </h3>
                          
                          <div className="flex flex-wrap items-center gap-3 mt-3">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-300 uppercase tracking-wider">
                              SECTION: {sectionName.toUpperCase()}
                            </span>
                            <span className="text-slate-700 font-bold">•</span>
                            <span className="text-xs sm:text-sm font-extrabold text-slate-300 uppercase tracking-wider">
                              LOCATION: {activeAlert.department.toUpperCase()}
                            </span>
                          </div>

                          <div className="mt-4">
                            <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">PRIORITY STATUS</span>
                            <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs sm:text-sm font-black uppercase tracking-wider", priorityColor)}>
                              <span className="w-2.5 h-2.5 bg-current rounded-full animate-pulse" />
                              {priorityLabel}
                            </div>
                          </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-900 shadow-inner">
                          <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">ISSUE DETAILS & TROUBLESHOOTING LOG</span>
                          <p className="text-slate-200 font-bold uppercase text-sm sm:text-base lg:text-lg leading-relaxed italic">
                            "{activeAlert.description || 'No descriptive comments logged.'}"
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

              </div>

              {/* Progress feedback block and auto manual buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-900 pt-6 gap-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 bg-red-500 rounded-full animate-ping" />
                  <span className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-[0.15em]">
                    AUTO DISMISS IN 30S // ASSIGNMENT DEPLOYED LIVE TO TERMINAL
                  </span>
                </div>
                
                <button
                  onClick={() => setActiveAlert(null)}
                  className={cn(
                    "px-8 py-4 sm:py-5 text-white border font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer max-sm:w-full",
                    activeAlert.workType === 'Break Down' 
                      ? "bg-[#d32f2f] hover:bg-red-750 border-[#d32f2f]" 
                      : activeAlert.workType === 'Service'
                        ? "bg-blue-600 hover:bg-blue-700 border-blue-600"
                        : "bg-yellow-600 hover:bg-yellow-700 border-yellow-600"
                  )}
                >
                  ACKNOWLEDGE & DISMISS (OK)
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
