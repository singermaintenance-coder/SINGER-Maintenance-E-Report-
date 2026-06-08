import { motion } from 'motion/react';
import { Machine, MachineReport } from '../types';
import { Settings, Info, AlertTriangle, Play } from 'lucide-react';
import { cn } from '../lib/utils';

interface MachineNode extends Machine {
  x: number;
  y: number;
}

const MODULAR_LAYOUT: Record<string, { x: number; y: number }> = {
  'xrho4kkgs': { x: 15, y: 15 },    // BEAM SAW SCM
  'tto2ztppb': { x: 15, y: 32 },    // BEAM SAW SELCO
  'vfpfzbsc6': { x: 48, y: 14 },    // EDGE BAND OLD JADE (Top row)
  'm70zi93ar': { x: 48, y: 28 },    // EDGE BAND NEW JADE (Bottom row)
  'sp9nvciik': { x: 74, y: 18 },    // SKIPPER 100
  '1b0eh4p4a': { x: 19, y: 56 },    // PROFILE EDGE BANDING
  'p6acbc2ru': { x: 7, y: 65 },     // HINGE DRILLING
  'clg5d4bt2': { x: 7, y: 77 },     // GROOVING CUTTING
  'owoy5b835': { x: 40, y: 74 },    // RAIL BORER
  'jfq16inm5': { x: 51, y: 74 },    // DOWEL MILLING
  '5j0898k83': { x: 61, y: 74 },    // MANUAL EDGE BANDER
  '1rxaelkla': { x: 79, y: 51 },    // ROVER GOLD NEW
  'u10s9yllm': { x: 79, y: 64 },    // ROVER GOLD OLD
  'ss2oknf13': { x: 79, y: 77 },    // ROVER 22
};

interface ModularMapProps {
  machines: Machine[];
  reports: MachineReport[];
}

export default function ModularMap({ machines, reports }: ModularMapProps) {
  const modularMachines = machines.filter(m => m.department === 'Modular');

  return (
    <div className="w-full h-full relative bg-[#5b8cc3] rounded-[40px] border-8 border-slate-300 overflow-hidden shadow-2xl min-h-[700px]">
      {/* Supplier Roads (Dark Paths) */}
      <div className="absolute inset-x-0 bottom-[10%] h-[12%] bg-[#1a1c18] z-0 flex items-center justify-around">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Supplier Road</span>
        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Supplier Road</span>
      </div>
      <div className="absolute left-[27%] inset-y-0 w-[8%] bg-[#1a1c18] z-0 flex flex-col items-center justify-center gap-24">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] rotate-90 whitespace-nowrap">Supplier Road</span>
      </div>
      <div className="absolute left-[35%] top-[35%] right-0 h-[10%] bg-[#1a1c18] z-0 flex items-center justify-around">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Supplier Road</span>
        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Supplier Road</span>
      </div>
      <div className="absolute left-[66%] top-[35%] bottom-[10%] w-[5%] bg-[#1a1c18] z-0" />

      {/* Static Areas */}
      {/* Panel Storage */}
      <div className="absolute left-[36%] top-[46%] w-[28.5%] h-[21%] bg-[#ff0000] border-4 border-slate-900 rounded-sm shadow-inner flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-black text-black uppercase tracking-[0.4em]">Panel Storage</span>
      </div>

      {/* Office */}
      <div className="absolute right-[3%] top-[12%] w-[10%] h-[11%] bg-[#ffff00] border-2 border-slate-900 flex items-center justify-center">
        <span className="text-[10px] font-black text-black uppercase tracking-widest">Office</span>
      </div>

      {/* Map Content */}
      <div className="absolute inset-0">
        {modularMachines.map((machine) => {
          const layout = MODULAR_LAYOUT[machine.id];
          if (!layout) return null;
          
          const machineReports = reports.filter(r => r.machineId === machine.id && r.status !== 'addressed');
          const isPending = machineReports.some(r => r.status === 'pending');
          const isInProgress = machineReports.some(r => r.status === 'in-progress');

          return (
            <motion.div
              key={machine.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
            >
              {/* Ray/Light Effects */}
              {isPending && (
                <div className="absolute inset-0 pointer-events-none scale-150">
                  <div className="absolute inset-0 bg-yellow-400 opacity-30 rounded-full animate-ping scale-150" />
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 bg-gradient-to-t from-yellow-400 via-yellow-200 to-transparent w-[2px] h-48 left-1/2 -top-24 origin-bottom shadow-[0_0_15px_#facc15]"
                      animate={{ 
                        rotate: i * 45, 
                        opacity: [0.1, 0.6, 0.1], 
                        scaleY: [0.8, 1.4, 0.8] 
                      }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </div>
              )}

              {isInProgress && (
                <div className="absolute inset-0 pointer-events-none scale-150">
                  <div className="absolute inset-0 bg-singer-red opacity-40 rounded-full animate-pulse scale-150" />
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 bg-gradient-to-t from-singer-red via-red-400 to-transparent w-[3px] h-56 left-1/2 -top-28 origin-bottom shadow-[0_0_20px_#ef4444]"
                      animate={{ 
                        rotate: i * 30, 
                        opacity: [0.2, 0.8, 0.2], 
                        scaleY: [0.5, 1.8, 0.5] 
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}

              {/* Machine Icon Card */}
              <div className={cn(
                "relative z-20 w-20 h-20 sm:w-24 sm:h-24 bg-[#ffff00] border-2 border-slate-900 flex flex-col items-center justify-center p-2 transition-all shadow-lg",
                isPending ? "border-yellow-600 ring-4 ring-yellow-400/50" : isInProgress ? "border-red-600 ring-4 ring-singer-red/50" : "hover:scale-110"
              )}>
                {machine.image ? (
                  <div className="w-full h-full relative group-hover:brightness-110">
                    <img src={machine.image} alt={machine.name} className="w-full h-full object-cover rounded-sm grayscale-[0.2]" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-slate-900/5" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-1">
                    <span className="text-[8px] font-black text-black leading-none uppercase">
                      {machine.name.split('<br>')[0]}
                    </span>
                    {machine.name.split('<br>')[1] && (
                      <span className="text-[7px] font-bold text-black/70 mt-1 uppercase">
                        {machine.name.split('<br>')[1]}
                      </span>
                    )}
                  </div>
                )}

                {/* Status Badges */}
                <div className="absolute -top-3 -right-3 flex gap-1 scale-90">
                  {isPending && (
                    <div className="bg-yellow-400 text-slate-900 p-2 rounded-xl shadow-lg border-2 border-slate-900 animate-bounce">
                      <AlertTriangle size={14} />
                    </div>
                  )}
                  {isInProgress && (
                    <div className="bg-singer-red text-white p-2 rounded-xl shadow-lg border-2 border-white">
                      <Play size={14} className="fill-current" />
                    </div>
                  )}
                </div>

                {/* Label Tooltip */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transform translate-y-1 group-hover:translate-y-0 transition-all z-30 shadow-2xl">
                  {machine.name.replace(/<br\s*\/?>/gi, ' ')}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-6 bg-white/95 px-6 py-3 rounded-2xl border-2 border-slate-900 flex flex-col gap-2 z-40 shadow-2xl font-black uppercase tracking-widest text-[8px] sm:text-[9px]">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_#facc15]" />
          <span className="text-slate-600">Pending Breakdown</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-singer-red rounded-full shadow-[0_0_10px_#ef4444]" />
          <span className="text-slate-600">Work In Progress</span>
        </div>
      </div>
    </div>
  );
}
