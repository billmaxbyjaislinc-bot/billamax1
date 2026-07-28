import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  PhoneCall, 
  Loader2, 
  PhoneForwarded,
  PhoneOff,
  User,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { Client, AppConfig } from '../types';
import { formatCurrency } from '../utils/helpers';
import { motion, AnimatePresence } from 'motion/react';

interface CallAlertManagerProps {
  onClose: () => void;
  unpaidClients: Client[];
  config: AppConfig;
}

const CallAlertManager: React.FC<CallAlertManagerProps> = ({ onClose, unpaidClients, config }) => {
  const [step, setStep] = useState<'SELECT' | 'CALLING'>('SELECT');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(unpaidClients.map(c => c.id)));
  const [callingIndex, setCallingIndex] = useState(0);
  const [callStatus, setCallStatus] = useState<'CONNECTING' | 'SPEAKING' | 'COMPLETED' | 'IDLE'>('IDLE');

  const selectedClients = unpaidClients.filter(c => selectedIds.has(c.id));

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === unpaidClients.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(unpaidClients.map(c => c.id)));
  };

  const startCalling = () => {
    if (selectedClients.length === 0) return;
    setStep('CALLING');
    processNextCall(0);
  };

  const processNextCall = async (index: number) => {
    if (index >= selectedClients.length) {
      setCallStatus('COMPLETED');
      return;
    }

    setCallingIndex(index);
    setCallStatus('CONNECTING');
    
    // Simulate connection
    await new Promise(r => setTimeout(r, 2000));
    setCallStatus('SPEAKING');

    // Simulate AI Speaking
    await new Promise(r => setTimeout(r, 4000));
    
    // Move to next
    processNextCall(index + 1);
  };

  return (
    <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-white dark:bg-slate-950 z-[300] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90">
             {step === 'SELECT' ? <X className="w-4 h-4" /> : <PhoneOff className="w-4 h-4" />}
          </button>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              {step === 'SELECT' ? 'Select Customers' : 'AI Call Alert'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {step === 'SELECT' ? 'Choose who to notify' : 'AI Calling in progress'}
            </p>
          </div>
        </div>
        {step === 'SELECT' && (
           <button 
             onClick={toggleAll}
             className="text-[10px] font-black text-brand-500 uppercase tracking-widest"
           >
             {selectedIds.size === unpaidClients.length ? 'Clear All' : 'Select All'}
           </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {step === 'SELECT' ? (
          <div className="p-4 space-y-3">
            {unpaidClients.map(client => (
              <button 
                key={client.id}
                onClick={() => toggleSelect(client.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  selectedIds.has(client.id) 
                  ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    selectedIds.has(client.id) ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {selectedIds.has(client.id) ? <Check className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{client.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{client.mobile || 'No Mobile'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{formatCurrency(client.totalBorrowed)}</p>
                  <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest mt-1">Unpaid Balance</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 space-y-12">
             <div className="relative">
                <div className="relative w-32 h-32 bg-brand-500 rounded-full flex items-center justify-center border-4 border-white/20">
                   <AnimatePresence mode="wait">
                      {callStatus === 'CONNECTING' ? (
                        <motion.div key="loading" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                           <Loader2 className="w-12 h-12 text-white animate-spin" />
                        </motion.div>
                      ) : callStatus === 'SPEAKING' ? (
                         <motion.div key="speaking" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="flex gap-1 items-center">
                            {[1, 2, 3, 4].map(i => (
                              <motion.div 
                                key={i}
                                animate={{ height: [12, 32, 12] }}
                                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                                className="w-1.5 bg-white rounded-full"
                              />
                            ))}
                         </motion.div>
                      ) : (
                         <motion.div key="phone" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                            <PhoneForwarded className="w-12 h-12 text-white" />
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>
             </div>

             <div className="text-center space-y-3">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Kore AI Voice</h2>
                <div className="flex items-center justify-center gap-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <p className="text-[12px] font-bold text-emerald-500 uppercase tracking-[0.2em]">CAllING STARTED</p>
                </div>
                <div className="pt-8">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Calling Customer ({callingIndex + 1}/{selectedClients.length})</p>
                   <p className="text-lg font-black text-slate-900 dark:text-white mt-2">{selectedClients[callingIndex]?.name}</p>
                   <p className="text-sm font-bold text-slate-500 mt-1">{selectedClients[callingIndex]?.mobile}</p>
                </div>
             </div>

             <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-900 p-6 rounded-3xl space-y-4 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">AI Announcement Script</p>
                <div className="text-center italic text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                   "Hello! I am an AI assistant from <span className="font-bold text-brand-500">{config.shopName}</span>. This is a polite reminder regarding your pending balance of <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(selectedClients[callingIndex]?.totalBorrowed || 0)}</span>. Please settle this amount at your earliest convenience."
                </div>
             </div>

             {callStatus === 'COMPLETED' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                   <p className="text-emerald-500 font-bold mb-4">All Calls Completed Successfully!</p>
                   <button onClick={onClose} className="px-12 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs">Close Panel</button>
                </motion.div>
             )}
          </div>
        )}
      </div>

      {/* Footer Button for Selection */}
      {step === 'SELECT' && (
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-10">
          <button 
            onClick={startCalling}
            disabled={selectedIds.size === 0}
            className="w-full bg-brand-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 border border-brand-400"
          >
            Next ({selectedIds.size}) <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CallAlertManager;
