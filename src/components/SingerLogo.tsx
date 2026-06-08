import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function SingerLogo({ className, variant = 'default' }: { className?: string, variant?: 'default' | 'white' }) {
  return (
    <div className={cn("flex flex-col items-center text-center group", className)}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-[inherit] text-[inherit] font-sans gap-0"
      >
        <span className={cn(
          "text-4xl sm:text-6xl font-black tracking-tighter leading-none italic",
          variant === 'white' ? "text-white" : "text-singer-red"
        )}>
          SINGER
        </span>
        <span className={cn(
          "text-[9px] sm:text-xs font-black tracking-[0.2em] sm:tracking-[0.3em] uppercase mt-1",
          variant === 'white' ? "text-white/80" : "text-slate-400"
        )}>
          Maintenance<br />E-Report
        </span>
      </motion.div>
    </div>
  );
}
