import React, { useState } from 'react';
import { User, JobRole } from '../types';
import { INITIAL_USERS } from '../constants';
import SingerLogo from './SingerLogo';
import { User as UserIcon, Briefcase, ChevronRight, AlertCircle, LogIn, Lock, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Login({ 
  onLogin, 
  onBack,
  onEnterTVMode
}: { 
  onLogin: (user: User) => void, 
  onBack: () => void,
  onEnterTVMode?: () => void
}) {
  const [role, setRole] = useState<JobRole>('Maintainer');
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const roles: { id: JobRole; label: string; desc: string }[] = [
    { id: 'Admin', label: 'Admin Controller', desc: 'Full System Audit Access' },
    { id: 'Supervisor', label: 'Supervisor', desc: 'Factory Oversight' },
    { id: 'Maintainer', label: 'Machine Maintainer', desc: 'Standard Operational Logging' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const ROLE_PASSWORDS: Record<JobRole, string> = {
      'Admin': '0000',
      'Supervisor': '1234',
      'Maintainer': '1111'
    };

    if (password !== ROLE_PASSWORDS[role]) {
      setError(`Invalid Security Key for ${role}.`);
      return;
    }

    if (name.trim()) {
      onLogin({
        id: Math.random().toString(36).substr(2, 9),
        name,
        role,
      });
    } else {
      setError('Please enter your name.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Background Motif */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none overflow-hidden flex items-center justify-center -z-10">
        <SingerLogo className="scale-[5] rotate-12" />
      </div>

      {/* Header Branding - Full Width Edge-to-Edge */}
      <div className="bg-singer-red pt-16 pb-12 px-8 flex flex-col items-center justify-center text-center relative overflow-hidden w-full shadow-lg">
        {/* Back Button - Floating on Header */}
        <button 
          type="button" 
          onClick={onBack}
          className="absolute top-6 left-6 z-20 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-singer-red transition-all group"
        >
          <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
        </button>

        <SingerLogo variant="white" className="scale-[1.2] mb-6 relative z-10" />
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-white font-black text-xl sm:text-2xl tracking-[0.2em] leading-none uppercase mb-2">Maintenance</h2>
          <h3 className="text-white font-black text-lg sm:text-xl tracking-[0.3em] leading-none uppercase opacity-90">E-Report</h3>
        </div>
        {/* Subtle noise/texture */}
        <div className="absolute inset-0 bg-black opacity-[0.03] pointer-events-none" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col items-center py-12 px-6 w-full"
      >
        <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-8">
          {error && (
            <div className="bg-singer-red p-4 rounded-2xl text-white text-[10px] sm:text-xs font-black uppercase tracking-tight flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Establish Protocol Role</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className="w-full pl-14 sm:pl-16 pr-6 py-4 sm:py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl sm:rounded-2xl outline-none transition-all flex items-center justify-between text-slate-800 font-black text-base sm:text-lg uppercase tracking-tight text-left"
                >
                  <Briefcase className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <span>{roles.find(r => r.id === role)?.label}</span>
                  <ChevronRight size={20} className={cn("text-slate-300 transition-transform", isOpen ? "rotate-90" : "rotate-0")} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 5, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-50 top-full left-0 right-0 bg-white border-2 border-slate-900 rounded-3xl shadow-2xl overflow-hidden mt-1 p-2 space-y-1"
                    >
                      {roles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setRole(r.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full p-4 rounded-2xl text-left transition-all group flex items-center justify-between",
                            role === r.id ? "bg-singer-red text-white" : "hover:bg-slate-50 text-slate-800"
                          )}
                        >
                          <div>
                            <div className="font-black text-sm uppercase tracking-widest">{r.label}</div>
                            <div className={cn("text-[8px] font-bold uppercase tracking-widest opacity-60", role === r.id ? "text-white" : "text-slate-400")}>{r.desc}</div>
                          </div>
                          {role === r.id && <LogIn size={16} />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Personnel Name</label>
              <div className="relative">
                <UserIcon className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full pl-14 sm:pl-16 pr-6 py-4 sm:py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl sm:rounded-2xl outline-none transition-all text-slate-800 font-black text-base sm:text-lg placeholder:text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Security Key</label>
              <div className="relative">
                <Lock className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter key"
                  className="w-full pl-14 sm:pl-16 pr-6 py-4 sm:py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl sm:rounded-2xl outline-none transition-all text-slate-800 font-black text-base sm:text-lg placeholder:text-slate-200"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-singer-red text-white py-5 sm:py-6 rounded-[20px] sm:rounded-[24px] font-black text-lg sm:text-xl italic tracking-tighter flex items-center justify-center gap-3 hover:bg-slate-900 transition-all shadow-[0px_10px_20px_rgba(211,47,47,0.2)] sm:shadow-[0px_20px_40px_rgba(211,47,47,0.2)] hover:shadow-slate-900/20 active:scale-95"
          >
            LOGIN
            <ChevronRight size={24} />
          </button>

          {onEnterTVMode && (
            <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                Alternative Operations Access
              </div>
              <button
                type="button"
                onClick={onEnterTVMode}
                className="w-full bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all border-2 border-transparent hover:border-slate-800 shadow-sm active:scale-95 cursor-pointer duration-200"
              >
                <Tv size={16} />
                Open Workshop TV Display Mode
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
