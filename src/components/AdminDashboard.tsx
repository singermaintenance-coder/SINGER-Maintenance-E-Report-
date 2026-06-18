import React, { useState } from 'react';
import { MaintenanceRecord, User, Department, Machine } from '../types';
import { DEPARTMENTS, INITIAL_USERS } from '../constants';
import { motion } from 'motion/react';
import { Users, LayoutGrid, FileText, Plus, Trash2, Edit2, Search, Settings, LogOut, ChevronLeft, ImagePlus, X } from 'lucide-react';
import { formatTime, formatDate, cn, formatTimeRange } from '../lib/utils';

export default function AdminDashboard({ 
  records, 
  machines, 
  onAddMachine, 
  onDeleteMachine, 
  onLogout 
}: { 
  records: MaintenanceRecord[], 
  machines: Machine[],
  onAddMachine: (m: Machine) => Promise<void>,
  onDeleteMachine: (id: string) => Promise<void>,
  onLogout: () => void 
}) {
  const [activeTab, setActiveTab] = useState<'users' | 'structure' | 'records'>('records');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [newMachine, setNewMachine] = useState<Partial<Machine>>({ department: 'Modular' });

  const filteredRecords = records.filter(r => 
    (r.maintainerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.machineName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEditMachine = (machine: Machine) => {
    setNewMachine(machine);
    setEditingMachineId(machine.id);
    setIsAddingMachine(true);
  };

  const closeMachineModal = () => {
    setIsAddingMachine(false);
    setEditingMachineId(null);
    setNewMachine({ department: 'Modular' });
  };

  const submitMachine = async () => {
    const trimmedName = newMachine.name?.trim();
    if (!trimmedName || !newMachine.department) return;
    
    const machine: Machine = {
      id: editingMachineId || Math.random().toString(36).substr(2, 9),
      name: trimmedName,
      department: newMachine.department as any,
      image: newMachine.image?.trim() || ''
    };
    await onAddMachine(machine);
    closeMachineModal();
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
            <span>ADMIN</span>
            <span className="text-singer-red">ORCHESTRA</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-xs">Primary System Configuration Panel</p>
        </div>
        
        <div className="flex flex-wrap bg-slate-200 p-1.5 rounded-2xl w-full lg:w-auto shrink-0 shadow-inner gap-1">
          {[
            { id: 'records', label: 'Logs', icon: FileText },
            { id: 'users', label: 'Personnel', icon: Users },
            { id: 'structure', label: 'Dynamics', icon: LayoutGrid }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 min-w-[90px] px-4 sm:px-8 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                activeTab === tab.id ? "bg-white text-singer-red shadow-lg" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.charAt(0)}</span>
            </button>
          ))}
          <button 
            onClick={onLogout}
            className="px-4 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-singer-red"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Terminate</span>
          </button>
        </div>
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[24px] sm:rounded-[40px] shadow-[20px_20px_40px_rgba(0,0,0,0.03)] sm:shadow-[40px_40px_80px_rgba(0,0,0,0.03)] border-2 border-slate-100 overflow-hidden"
      >
        {activeTab === 'records' && (
          <div className="flex flex-col">
            <div className="p-6 sm:p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Operational Records</h2>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="FILTER LOGS..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 sm:pl-16 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl text-xs sm:text-sm font-black outline-none transition-all placeholder:text-slate-200 uppercase tracking-widest"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 sm:px-10 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Timeline</th>
                    <th className="px-6 sm:px-10 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Operator</th>
                    <th className="px-6 sm:px-10 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Division</th>
                    <th className="px-6 sm:px-10 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Asset ID</th>
                    <th className="px-6 sm:px-10 py-4 sm:py-6 text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 sm:px-10 py-6 sm:py-8 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm sm:text-base font-black text-slate-800 tracking-tight">{formatDate(record.date)}</span>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{formatTimeRange(record.startTime, record.finishTime)}</span>
                          </div>
                        </td>
                        <td className="px-6 sm:px-10 py-6 sm:py-8 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 text-[10px] sm:text-xs">{(record.maintainerName || '?').charAt(0)}</div>
                            <span className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-tight">{record.maintainerName || 'Anonymous'}</span>
                          </div>
                        </td>
                        <td className="px-6 sm:px-10 py-6 sm:py-8 whitespace-nowrap">
                          <span className="text-[9px] sm:text-[10px] font-black px-2 sm:px-3 py-1 bg-slate-900 text-white rounded uppercase tracking-widest">
                            {record.department}
                          </span>
                        </td>
                        <td className="px-6 sm:px-10 py-6 sm:py-8 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tighter underline decoration-singer-red decoration-2 underline-offset-4" dangerouslySetInnerHTML={{ __html: record.machineName }} />
                            <span className="text-[9px] sm:text-[10px] font-bold text-singer-red uppercase tracking-[0.1em] mt-1">{record.workType}</span>
                            {record.shift && (
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">Shift: {record.shift}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 sm:px-10 py-6 sm:py-8 whitespace-nowrap">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{record.duration}<span className="text-xs text-slate-300 ml-1">M</span></span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-10 py-24 text-center">
                        <div className="text-slate-200 uppercase font-black tracking-[0.3em] sm:tracking-[0.5em] text-2xl sm:text-4xl italic opacity-50">Null records Found</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-6 sm:p-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 sm:mb-12 gap-6">
              <div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Personnel Directory</h2>
                <p className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest mt-2">Authenticated Biological Assets</p>
              </div>
              <button className="btn-primary flex items-center gap-2 group w-full sm:w-auto justify-center">
                <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                REGISTER PERSONNEL
              </button>
            </div>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {INITIAL_USERS.map((user) => (
                <div key={user.id} className="p-6 sm:p-8 border-2 border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col justify-between group hover:border-slate-900 hover:bg-white transition-all">
                  <div className="mb-4 sm:mb-6 flex justify-between items-start">
                    <div className="p-3 sm:p-4 bg-white rounded-2xl shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all text-slate-300">
                      <Users size={20} />
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 size={18} /></button>
                      <button className="p-2 text-slate-400 hover:text-singer-red transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{user.name}</h3>
                    <p className="text-[10px] sm:text-xs text-singer-red font-black uppercase tracking-[0.2em]">{user.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="p-6 sm:p-12 space-y-12 sm:space-y-16">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-8 border-b-2 border-slate-100 pb-4 gap-4">
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Divisions</h2>
                <button className="text-singer-red font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center gap-1 hover:underline">
                  <Plus size={16} /> ADD DIVISION
                </button>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {DEPARTMENTS.map(dept => (
                  <span key={dept} className="px-5 sm:px-8 py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-sm font-black uppercase tracking-widest hover:bg-singer-red cursor-default transition-all shadow-lg active:scale-95 text-center flex-1 sm:flex-none min-w-[120px]">
                    {dept}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-8 border-b-2 border-slate-100 pb-4 gap-4">
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Asset Inventory</h2>
                <button 
                  onClick={() => setIsAddingMachine(true)}
                  className="bg-slate-900 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-singer-red transition-all shadow-xl w-full sm:w-auto justify-center"
                >
                  <Plus size={18} />
                  REGISTER ASSET UNIT
                </button>
              </div>
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {machines.map(machine => (
                  <div key={machine.id} className="p-5 sm:p-6 border-2 border-slate-100 rounded-2xl text-sm bg-white shadow-sm flex flex-col gap-3 group hover:border-slate-900 transition-all relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button 
                        onClick={() => startEditMachine(machine)}
                        className="p-2 text-slate-300 hover:text-blue-500 transition-colors bg-white border border-slate-100 rounded-lg shadow-sm"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDeleteMachine(machine.id)}
                        className="p-2 text-slate-300 hover:text-singer-red transition-colors bg-white border border-slate-100 rounded-lg shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="w-full aspect-video bg-slate-50 flex items-center justify-center rounded-xl overflow-hidden group-hover:bg-singer-red transition-all text-slate-300">
                      {machine.image ? (
                        <img src={machine.image} alt={machine.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Settings size={24} />
                      )}
                    </div>
                    <div>
                      <span className="font-black text-slate-800 uppercase tracking-tight text-sm sm:text-base mb-1 block leading-tight" dangerouslySetInnerHTML={{ __html: machine.name }} />
                      <span className="text-[9px] sm:text-[10px] text-singer-red uppercase font-black tracking-widest">{machine.department}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Machine Modal */}
            {isAddingMachine && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-[40px] w-full max-w-xl p-8 sm:p-12 relative overflow-hidden"
                >
                  <button 
                    onClick={() => setIsAddingMachine(false)}
                    className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"
                  >
                    <X size={32} />
                  </button>
                  
                  <div className="mb-10">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">
                      {editingMachineId ? 'Update Asset' : 'New Asset'}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-bold">
                      Protocol 04: {editingMachineId ? 'Hardware Revision' : 'Hardware Registration'}
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-bold">Step 01: Host Asset Visualization (URL)</label>
                       <div className="flex flex-col sm:flex-row gap-4">
                         <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                           {newMachine.image ? (
                             <img src={newMachine.image} alt="Preview" className="w-full h-full object-cover" />
                           ) : (
                             <ImagePlus className="text-slate-300" size={24} />
                           )}
                         </div>
                         <div className="flex-1">
                           <div className="relative h-full">
                             <input 
                               type="text" 
                               placeholder="PASTE IMAGE URL (GITHUB/WEB)..."
                               value={newMachine.image || ''}
                               onChange={(e) => setNewMachine(prev => ({ ...prev, image: e.target.value }))}
                               className="w-full h-full bg-slate-50 border-2 border-slate-100 focus:border-slate-900 rounded-2xl px-6 text-[10px] font-black outline-none transition-all placeholder:text-slate-200 uppercase"
                             />
                           </div>
                         </div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Designation</label>
                       <input 
                         type="text" 
                         placeholder="E.G., BEAM SAW SCM"
                         value={newMachine.name || ''}
                         onChange={(e) => setNewMachine(prev => ({ ...prev, name: e.target.value }))}
                         className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl p-6 text-sm font-black outline-none transition-all placeholder:text-slate-200 uppercase"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deployment Division</label>
                       <div className="grid grid-cols-2 gap-2">
                         {DEPARTMENTS.map(dept => (
                           <button 
                             key={dept}
                             onClick={() => setNewMachine(prev => ({ ...prev, department: dept }))}
                             className={cn(
                               "py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                               newMachine.department === dept ? "bg-slate-900 border-slate-900 text-white" : "border-slate-100 text-slate-400 hover:border-slate-900"
                             )}
                           >
                             {dept}
                           </button>
                         ))}
                       </div>
                    </div>

                    <button 
                      onClick={submitMachine}
                      disabled={!newMachine.name}
                      className="w-full h-20 bg-singer-red text-white rounded-[24px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-singer-red/20 hover:bg-slate-900 transition-all disabled:opacity-50 disabled:grayscale italic"
                    >
                      {editingMachineId ? 'REVISE CORE REGISTRY' : 'COMMIT TO CORE REGISTRY'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
