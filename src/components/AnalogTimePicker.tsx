import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface AnalogTimePickerProps {
  value: string; // HH:mm format
  onChange: (value: string) => void;
  onClose: () => void;
  label: string;
}

export default function AnalogTimePicker({ value, onChange, onClose, label }: AnalogTimePickerProps) {
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  const initialH = parseInt(value.split(':')[0]);
  const [tempHours, setTempHours] = useState(initialH % 12 || 12);
  const [tempMinutes, setTempMinutes] = useState(parseInt(value.split(':')[1]) || 0);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialH >= 12 ? 'PM' : 'AM');
  const [isDragging, setIsDragging] = useState(false);
  
  const clockRef = useRef<HTMLDivElement>(null);

  const calculateTimeFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!clockRef.current) return;
    
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const x = clientX - centerX;
    const y = clientY - centerY;
    
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = (angle + 450) % 360;

    if (mode === 'hours') {
      let h = Math.round(angle / 30) % 12;
      if (h === 0) h = 12;
      setTempHours(h);
    } else {
      const m = Math.round(angle / 6) % 60;
      setTempMinutes(m);
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    calculateTimeFromEvent(e);
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging) calculateTimeFromEvent(e);
    };
    const handleGlobalUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (mode === 'hours') {
          setTimeout(() => setMode('minutes'), 300);
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, mode]);

  const handleSave = () => {
    let h = tempHours % 12;
    if (period === 'PM') h += 12;
    const formattedH = h.toString().padStart(2, '0');
    const formattedM = tempMinutes.toString().padStart(2, '0');
    onChange(`${formattedH}:${formattedM}`);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md transition-all"
    >
      <div className="bg-white rounded-[48px] w-full max-w-md overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="bg-slate-900 p-8 text-white relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-singer-red" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">{label}</span>
            </div>
            
            <div className="flex bg-white/5 p-1 rounded-xl">
              <button 
                onClick={() => setPeriod('AM')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                  period === 'AM' ? "bg-singer-red text-white" : "text-white/30"
                )}
              >AM</button>
              <button 
                onClick={() => setPeriod('PM')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                  period === 'PM' ? "bg-singer-red text-white" : "text-white/30"
                )}
              >PM</button>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={() => setMode('hours')}
              className={cn(
                "text-7xl font-black tabular-nums transition-all",
                mode === 'hours' ? "text-singer-red scale-110" : "text-white/20"
              )}
            >
              {tempHours.toString().padStart(2, '0')}
            </button>
            <span className="text-7xl font-black text-white/10">:</span>
            <button 
              onClick={() => setMode('minutes')}
              className={cn(
                "text-7xl font-black tabular-nums transition-all",
                mode === 'minutes' ? "text-singer-red scale-110" : "text-white/20"
              )}
            >
              {tempMinutes.toString().padStart(2, '0')}
            </button>
          </div>
        </div>

        {/* Clock Face */}
        <div className="p-10 flex flex-col items-center gap-10">
          <div 
            ref={clockRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            className="group relative w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-slate-50 border-8 border-white shadow-inner cursor-pointer flex items-center justify-center select-none"
          >
            {/* Center Dot */}
            <div className="absolute w-4 h-4 bg-slate-900 rounded-full z-30" />
            
            {/* Clock Hand */}
            <motion.div 
              className="absolute bottom-1/2 left-1/2 w-1.5 bg-singer-red rounded-full origin-bottom z-20 pointer-events-none"
              style={{ 
                height: mode === 'hours' ? '35%' : '45%',
                rotate: mode === 'hours' ? tempHours * 30 : tempMinutes * 6,
              }}
              transition={isDragging ? { type: 'tween', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-singer-red rounded-full shadow-lg shadow-singer-red/40" />
            </motion.div>

            {/* Numbers */}
            {mode === 'hours' ? (
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => {
                const angle = (h * 30 - 90) * (Math.PI / 180);
                const x = Math.cos(angle) * 100;
                const y = Math.sin(angle) * 100;
                return (
                  <div 
                    key={h}
                    className={cn(
                      "absolute font-black text-lg transition-colors",
                      tempHours === h ? "text-singer-red" : "text-slate-300"
                    )}
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                  >
                    {h}
                  </div>
                );
              })
            ) : (
              [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => {
                const angle = (m * 6 - 90) * (Math.PI / 180);
                const x = Math.cos(angle) * 105;
                const y = Math.sin(angle) * 105;
                return (
                  <div 
                    key={m}
                    className={cn(
                      "absolute font-black text-sm transition-colors",
                      tempMinutes === m ? "text-singer-red" : "text-slate-300"
                    )}
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                  >
                    {m.toString().padStart(2, '0')}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <button 
              onClick={onClose}
              className="flex-1 h-16 rounded-2xl font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest text-xs"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex-3 h-16 bg-singer-red text-white rounded-2xl font-black shadow-xl shadow-singer-red/20 hover:bg-slate-900 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs italic"
            >
              <Check size={18} /> Confirm Time
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
