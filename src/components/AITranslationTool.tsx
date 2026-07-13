import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Check, Languages, AlertCircle } from 'lucide-react';
import { translateToEnglish } from '../services/geminiService';
import { cn } from '../lib/utils';

interface AITranslationToolProps {
  value: string;
  onTranslated: (translatedText: string) => void;
  className?: string;
}

export default function AITranslationTool({ value, onTranslated, className }: AITranslationToolProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!value.trim() || isTranslating) return;

    setIsTranslating(true);
    setErrorMessage(null);
    try {
      console.log(`[UI] Translation triggered for: "${value.substring(0, 40)}..."`);
      // We pass true to throwOnError so we can capture and display any failures explicitly requested by the user
      const translated = await translateToEnglish(value, true);
      onTranslated(translated);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 2000);
    } catch (error: any) {
      console.error("[UI] Translation error caught in component:", error);
      const errMsg = error?.message || "Translation failed";
      setErrorMessage(errMsg);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleTranslate}
        disabled={isTranslating || !value.trim()}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
          isTranslating 
            ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
            : errorMessage
              ? "bg-amber-100 text-amber-700 border border-amber-300"
              : showStatus
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-singer-red/10 text-singer-red border border-singer-red/20 hover:bg-singer-red hover:text-white"
        )}
      >
        <AnimatePresence mode="wait">
          {isTranslating ? (
            <motion.div
              key="translating"
              initial={{ opacity: 0, rotate: -180 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 180 }}
            >
              <Loader2 size={12} className="animate-spin" />
            </motion.div>
          ) : errorMessage ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <AlertCircle size={12} className="text-amber-600 animate-pulse" />
            </motion.div>
          ) : showStatus ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Check size={12} />
            </motion.div>
          ) : (
            <motion.div
              key="sparkle"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="flex items-center gap-1.5"
            >
              <Sparkles size={12} />
              <span>Convert to English</span>
            </motion.div>
          )}
        </AnimatePresence>
        {isTranslating && <span className="ml-1">Analyzing...</span>}
        {errorMessage && <span className="ml-1 normal-case font-bold">{errorMessage.length > 22 ? errorMessage.substring(0, 20) + "..." : errorMessage}</span>}
        {showStatus && <span className="ml-1">Optimized</span>}
      </motion.button>

      {!isTranslating && !showStatus && !errorMessage && value.trim() && (
        <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          <div className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Languages size={10} className="text-singer-red" />
            Sinhala to English AI
          </div>
          <div className="absolute left-0 top-1/2 -translate-x-1 w-2 h-2 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  );
}
