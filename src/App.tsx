/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import React from 'react';
import { User, MaintenanceRecord, MachineReport, Machine, Notification } from './types';
import { INITIAL_USERS, MACHINES } from './constants';
import Splash from './components/Splash';
import { LogOut, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import SingerLogo from './components/SingerLogo';
import { db } from './lib/firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/utils';
import { translateToEnglish } from './services/geminiService';

// Lazy loaded components
const Login = lazy(() => import('./components/Login'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const SupervisorDashboard = lazy(() => import('./components/SupervisorDashboard'));
const MaintainerWorkflow = lazy(() => import('./components/MaintainerWorkflow'));
const FactorySelection = lazy(() => import('./components/DepartmentSelection'));
const ModularFactoryFlow = lazy(() => import('./components/ModularDepartmentFlow'));
const WorkshopTVMode = lazy(() => import('./components/WorkshopTVMode'));

// Loading Fallback
function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-singer-red"
        >
          <Loader2 size={40} />
        </motion.div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Initializing Interface...</p>
      </div>
    </div>
  );
}

// Global Error Boundary Component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    const handleError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const msg = 'reason' in event ? event.reason : event.message;
      const errorMsg = String(msg || '');

      // Ignore benign development, WebSocket, HMR, and transport connection-related errors, plus ResizeObserver notifications
      if (
        errorMsg.toLowerCase().includes('websocket') ||
        errorMsg.toLowerCase().includes('hmr') ||
        errorMsg.toLowerCase().includes('vite') ||
        errorMsg.toLowerCase().includes('failed to fetch') ||
        errorMsg.toLowerCase().includes('connection') ||
        errorMsg.toLowerCase().includes('resizeobserver') ||
        errorMsg.toLowerCase().includes('resize observer') ||
        errorMsg.toLowerCase().includes('loop completed with undelivered notifications') ||
        errorMsg.toLowerCase().includes('loop limit exceeded')
      ) {
        console.warn("[ErrorBoundary] Ignored benign runtime event/ResizeObserver:", errorMsg);
        return;
      }

      setHasError(true);
      setErrorDetails(errorMsg);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-white rounded-[40px] p-12 text-center border-b-8 border-singer-red shadow-2xl">
          <div className="w-20 h-20 bg-singer-red/10 rounded-3xl flex items-center justify-center text-singer-red mx-auto mb-8">
            <LogOut size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4 italic">System Fault Detected</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8 italic">Operational Protocol Aborted Due to Runtime Exception</p>
          <div className="bg-slate-50 p-6 rounded-2xl text-left font-mono text-[10px] text-slate-400 mb-8 max-h-48 overflow-auto border-2 border-slate-100 shadow-inner">
            {errorDetails}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-singer-red transition-all shadow-xl"
          >
            Refresh System Instance
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

type Page = 'splash' | 'factory-selection' | 'login' | 'admin' | 'supervisor' | 'maintainer' | 'modular-factory' | 'tv-mode';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('splash');
  const [selectedDept, setSelectedDept] = useState<string>('Modular');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [reports, setReports] = useState<MachineReport[]>([]);
  const [machines, setMachines] = useState<Machine[]>(MACHINES);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 1. Real-time sync for machines (seed if empty)
  useEffect(() => {
    console.log("[Sync] Establishing real-time sync for machines...");
    const q = query(collection(db, 'machines'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log(`[Sync] Received machines update. Documents count: ${snapshot.size}`);
      if (snapshot.empty) {
        console.log("[Sync] 'machines' collection is empty. Seeding with default machines...");
        for (const m of MACHINES) {
          try {
            await setDoc(doc(db, 'machines', m.id), m);
          } catch (err) {
            console.error(`[Sync] Seeding machine ${m.id} failed:`, err);
          }
        }
      } else {
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Machine));
        setMachines(docs);
      }
    }, (error) => {
      console.error("[Sync] Machines sync error:", error);
      handleFirestoreError(error, OperationType.LIST, 'machines');
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time sync for machine_reports
  useEffect(() => {
    console.log("[Sync] Establishing real-time sync for machine_reports...");
    const q = query(collection(db, 'machine_reports'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Sync] Received machine_reports update. Documents count: ${snapshot.size}`);
      const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MachineReport));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(docs);
    }, (error) => {
      console.error("[Sync] Reports sync error:", error);
      handleFirestoreError(error, OperationType.LIST, 'machine_reports');
    });

    return () => unsubscribe();
  }, []);

  // 3. Real-time sync for maintenance records
  useEffect(() => {
    console.log("[Sync] Establishing real-time sync for records...");
    const q = query(collection(db, 'records'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Sync] Received records update. Documents count: ${snapshot.size}`);
      const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceRecord));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(docs);
    }, (error) => {
      console.error("[Sync] Records sync error:", error);
      handleFirestoreError(error, OperationType.LIST, 'records');
    });

    return () => unsubscribe();
  }, []);

  // 4. Real-time notifications sync & Badge Update
  useEffect(() => {
    if (!currentUser) return;

    console.log("[Sync] Establishing real-time sync for notifications...");
    const qNotifications = query(collection(db, 'notifications'));
    const unsubscribeNotifications = onSnapshot(qNotifications,
      (snapshot) => {
        console.log(`[Sync] Received notifications update. Documents count: ${snapshot.size}`);
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Notification));
        docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(docs);

        // Update App Badge
        const unreadCount = docs.filter(n => !n.readBy.includes(currentUser.id)).length;
        if ('setAppBadge' in navigator) {
          if (unreadCount > 0) {
            (navigator as any).setAppBadge(unreadCount).catch((err: any) => console.error("Badge error:", err));
          } else {
            (navigator as any).clearAppBadge().catch((err: any) => console.error("Badge clear error:", err));
          }
        }
      },
      (error) => {
        console.error("Notifications sync error:", error);
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    return () => unsubscribeNotifications();
  }, [currentUser]);

  // Sync session user on mount
  useEffect(() => {
    const savedUser = sessionStorage.getItem('singer_current_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.role) {
          setCurrentUser(user);
          if (user.role === 'Admin') setCurrentPage('admin');
          else if (user.role === 'Supervisor') setCurrentPage('supervisor');
          else if (user.role === 'Maintainer') setCurrentPage('maintainer');
        }
      } catch (err) {
        console.error("Session sync error", err);
        sessionStorage.removeItem('singer_current_user');
      }
    }
  }, []);

  // Save records to Firestore and update local state
  const addRecord = async (newRecord: MaintenanceRecord) => {
    try {
      console.log("[FirestoreWrite] Saving record:", newRecord.id);
      if (newRecord.description) {
        newRecord.description = await translateToEnglish(newRecord.description);
      }
      await setDoc(doc(db, 'records', newRecord.id), newRecord);
      console.log("[FirestoreWrite] Saved record successfully:", newRecord.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `records/${newRecord.id}`);
    }
  };

  // Save reports to Firestore and update local state
  const addReport = async (newReport: MachineReport) => {
    try {
      console.log("[FirestoreWrite] Saving report:", newReport.id);
      const data = { ...newReport };
      if (data.scheduledAt === undefined) delete data.scheduledAt;
      if (data.description) {
        data.description = await translateToEnglish(data.description);
      }
      await setDoc(doc(db, 'machine_reports', data.id), data);
      console.log("[FirestoreWrite] Saved report successfully:", newReport.id);

      // Create notification
      const notifId = doc(collection(db, 'notifications')).id;
      const cleanMachineName = newReport.machineName.replace(/<br\s*\/?>/gi, ' ');
      
      let title = `${newReport.department} ${newReport.workType} Reported`;
      let message = `${cleanMachineName} in ${newReport.department} requires ${newReport.workType.toLowerCase()} attention.`;

      if (newReport.scheduledAt && newReport.workType === 'Service') {
        const scheduledDate = new Date(newReport.scheduledAt);
        const dateStr = scheduledDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        title = `Service Scheduled: ${cleanMachineName}`;
        message = `Service for this machine is scheduled for ${dateStr} at ${timeStr}.`;
      }

      const newNotif: Notification = {
        id: notifId,
        title,
        message,
        type: newReport.workType,
        department: newReport.department,
        machineId: newReport.machineId,
        machineName: cleanMachineName,
        createdAt: new Date().toISOString(),
        readBy: []
      };

      await setDoc(doc(db, 'notifications', notifId), newNotif);
      console.log("[FirestoreWrite] Created notification successfully:", notifId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `machine_reports/${newReport.id}`);
    }
  };

  const markNotificationAsRead = async (id: string, userId: string) => {
    try {
      const notif = notifications.find(n => n.id === id);
      if (notif && !notif.readBy.includes(userId)) {
        await setDoc(doc(db, 'notifications', id), {
          readBy: [...notif.readBy, userId]
        }, { merge: true });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: [...n.readBy, userId] } : n));
      }
    } catch (error) {
      console.error("Mark notification read error", error);
    }
  };

  const updateReport = async (reportId: string, updates: Partial<MachineReport>) => {
    try {
      console.log("[FirestoreWrite] Updating report:", reportId, updates);
      const data = { ...updates };
      if (data.scheduledAt === undefined) delete data.scheduledAt;
      if (data.description) {
        data.description = await translateToEnglish(data.description);
      }
      await setDoc(doc(db, 'machine_reports', reportId), data, { merge: true });
      console.log("[FirestoreWrite] Updated report successfully:", reportId);

      // If scheduledAt is being updated, create a notification
      if (updates.scheduledAt) {
        const report = reports.find(r => r.id === reportId) || reports.find(r => r.id === reportId);
        if (report) {
          const notifId = doc(collection(db, 'notifications')).id;
          const cleanMachineName = report.machineName.replace(/<br\s*\/?>/gi, ' ');
          const scheduledDate = new Date(updates.scheduledAt);
          const dateStr = scheduledDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
          
          const newNotif: Notification = {
            id: notifId,
            title: `Service Scheduled: ${cleanMachineName}`,
            message: `Service for this machine is scheduled for ${dateStr} at ${timeStr}.`,
            type: 'Service',
            department: report.department,
            machineId: report.machineId,
            machineName: cleanMachineName,
            createdAt: new Date().toISOString(),
            readBy: []
          };

          await setDoc(doc(db, 'notifications', notifId), newNotif);
          console.log("[FirestoreWrite] Created schedule notification successfully:", notifId);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `machine_reports/${reportId}`);
    }
  };

  const deleteReport = async (reportId: string) => {
    console.log("Attempting to delete report:", reportId);
    try {
      await deleteDoc(doc(db, 'machine_reports', reportId));
      console.log("Successfully deleted report:", reportId);
    } catch (error) {
      console.error("Delete report error", error);
      handleFirestoreError(error, OperationType.DELETE, `machine_reports/${reportId}`);
    }
  };

  const deleteRecord = async (recordId: string) => {
    console.log("Attempting to delete record:", recordId);
    try {
      await deleteDoc(doc(db, 'records', recordId));
      console.log("Successfully deleted record:", recordId);
    } catch (error) {
      console.error("Delete record error", error);
      handleFirestoreError(error, OperationType.DELETE, `records/${recordId}`);
    }
  };

  const updateRecord = async (recordId: string, updates: Partial<MaintenanceRecord>) => {
    try {
      console.log("[FirestoreWrite] Updating record:", recordId, updates);
      const data = { ...updates };
      if (data.description) {
        data.description = await translateToEnglish(data.description);
      }
      await setDoc(doc(db, 'records', recordId), data, { merge: true });
      console.log("[FirestoreWrite] Updated record successfully:", recordId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `records/${recordId}`);
    }
  };

  const addMachine = async (newMachine: Machine) => {
    try {
      console.log("[FirestoreWrite] Adding machine:", newMachine.id);
      await setDoc(doc(db, 'machines', newMachine.id), newMachine);
      console.log("[FirestoreWrite] Added machine successfully:", newMachine.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `machines/${newMachine.id}`);
    }
  };

  const deleteMachine = async (machineId: string) => {
    try {
      console.log("[FirestoreWrite] Deleting machine:", machineId);
      await deleteDoc(doc(db, 'machines', machineId));
      console.log("[FirestoreWrite] Deleted machine successfully:", machineId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `machines/${machineId}`);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Delete notification error", error);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('singer_current_user', JSON.stringify(user));
    
    if (user.role === 'Admin') setCurrentPage('admin');
    else if (user.role === 'Supervisor') setCurrentPage('supervisor');
    else if (user.role === 'Maintainer') setCurrentPage('maintainer');
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    sessionStorage.removeItem('singer_current_user');
    setCurrentPage('factory-selection');
  };

  const renderPage = () => {
    return (
      <Suspense fallback={<LoadingScreen />}>
        {(() => {
          switch (currentPage) {
            case 'splash':
              return <Splash onComplete={() => setCurrentPage('factory-selection')} />;
            case 'factory-selection':
              return (
                <FactorySelection 
                  machines={machines}
                  reports={reports}
                  onBack={() => setCurrentPage('splash')}
                  onSelect={(deptId) => {
                    if (deptId === 'maintenance') {
                      setCurrentPage('login');
                    } else {
                      setSelectedDept(deptId);
                      setCurrentPage('modular-factory');
                    }
                  }} 
                />
              );
            case 'modular-factory':
              return (
                <ModularFactoryFlow 
                  onBack={() => setCurrentPage('factory-selection')} 
                  onReport={addReport}
                  machines={machines}
                  reports={reports}
                  departmentName={selectedDept}
                />
              );
            case 'login':
              return (
                <Login 
                  onLogin={handleLogin} 
                  onBack={() => setCurrentPage('factory-selection')} 
                  onEnterTVMode={() => setCurrentPage('tv-mode')}
                />
              );
            case 'tv-mode':
              return (
                <WorkshopTVMode 
                  machines={machines}
                  reports={reports}
                  records={records}
                  onExit={() => setCurrentPage('login')}
                />
              );
            case 'admin':
              return (
                <AdminDashboard 
                  records={records} 
                  machines={machines}
                  onAddMachine={addMachine}
                  onDeleteMachine={deleteMachine}
                  onLogout={handleLogout} 
                />
              );
            case 'supervisor':
              return (
                <SupervisorDashboard 
                  records={records} 
                  reports={reports}
                  machines={machines}
                  onUpdateReport={updateReport}
                  onDeleteReport={deleteReport}
                  onUpdateRecord={updateRecord}
                  onDeleteRecord={deleteRecord}
                  onLogout={handleLogout} 
                  notifications={notifications}
                  onMarkNotificationAsRead={markNotificationAsRead}
                  onDeleteNotification={deleteNotification}
                />
              );
            case 'maintainer':
              return (
                <MaintainerWorkflow 
                  user={currentUser!} 
                  onSave={addRecord} 
                  onLogout={handleLogout} 
                  machines={machines}
                  reports={reports}
                  onUpdateReport={updateReport}
                  notifications={notifications}
                  onMarkNotificationAsRead={markNotificationAsRead}
                  onDeleteNotification={deleteNotification}
                />
              );
            default:
              return <div>Error: Page not found</div>;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Header (Hidden on splash, login, and factory selection) */}
        {currentPage !== 'splash' && currentPage !== 'login' && currentPage !== 'factory-selection' && currentPage !== 'tv-mode' && (
          <header className="bg-singer-red text-white px-4 py-8 sm:px-8 sm:py-10 flex justify-center items-center shrink-0 shadow-lg relative z-50">
            <SingerLogo variant="white" className="scale-110 sm:scale-125" />
          </header>
        )}

        <main className="flex-1 flex flex-col min-h-0">
          {renderPage()}
        </main>

        {/* Basic Footer */}
        {currentPage !== 'splash' && currentPage !== 'factory-selection' && currentPage !== 'modular-factory' && currentPage !== 'tv-mode' && (
          <footer className="py-8 sm:py-12 px-4 sm:px-8 text-center bg-slate-50 border-t border-slate-200">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] sm:tracking-[0.4em] leading-relaxed">
              © {new Date().getFullYear()} SINGER (Sri Lanka) PLC <br className="sm:hidden" /> // INDUSTRIAL MAINTENANCE PROTOCOL
            </p>
          </footer>
        )}
      </div>
    </ErrorBoundary>
  );
}
