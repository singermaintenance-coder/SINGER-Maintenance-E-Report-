import { useEffect } from 'react';
import { motion } from 'motion/react';
import SingerLogo from './SingerLogo';

export default function Splash({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-singer-red flex items-center justify-center z-[100]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <SingerLogo variant="white" className="scale-150" />
        <div className="mt-20 relative px-10">
          <div className="text-[10px] text-white font-black uppercase tracking-[0.4em] mb-4 text-center">
            Establishing Industrial Link
          </div>
          <div className="w-[300px] bg-white/20 h-1 rounded-full overflow-hidden mx-auto">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-1/2 h-full bg-white"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
