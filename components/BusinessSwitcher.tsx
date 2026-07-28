
import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Check, Loader2 } from 'lucide-react';
import { ShopIcon } from './ShopIcon';
import { Business, AppConfig } from '../types';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface BusinessSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentBusinessId: string;
  onSelect: (businessId: string) => void;
  onAddNew: () => void;
  onEdit: (business: Business) => void;
  config: AppConfig;
  onQuickAdd?: (name: string) => Promise<void>;
  isAdding?: boolean;
}

const BusinessSwitcher: React.FC<BusinessSwitcherProps> = ({ 
  isOpen, 
  onClose, 
  currentBusinessId, 
  onSelect, 
  onAddNew,
  onEdit,
  config,
  onQuickAdd,
  isAdding
}) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [newBizName, setNewBizName] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !isOpen) return;

    const q = query(collection(db, 'users', user.uid, 'businesses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
      
      // If no businesses found, add the current one as default if it's not there
      if (list.length === 0) {
        // This is a fallback for existing users
        const defaultBiz: Business = {
          id: 'default',
          name: config.shopName,
          ownerName: config.ownerName,
          logo: config.businessLogo,
          createdAt: Date.now()
        };
        setBusinesses([defaultBiz]);
      } else {
        setBusinesses(list);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [isOpen, config]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/20 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] overflow-hidden animate-in slide-in-from-bottom-full duration-500 border-t border-slate-100 dark:border-slate-800">
        <div className="p-5 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50">
          <div className="pl-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Switch Workspace</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Manage multiple stores</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 active:scale-90 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Syncing Stores...</p>
            </div>
          ) : (
            <>
              {businesses.map((biz) => (
                <div 
                  key={biz.id}
                  onClick={() => {
                    onSelect(biz.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    currentBusinessId === biz.id 
                      ? 'bg-brand-50/30 dark:bg-brand-500/5 border-brand-500/30' 
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden ${
                      currentBusinessId === biz.id ? 'bg-brand-500' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700'
                    }`}>
                      {biz.logo ? (
                        <img src={biz.logo} alt={biz.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img 
                            src="/logo.png" 
                            alt={biz.name} 
                            className="w-full h-full object-contain p-1 opacity-80"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.char-fallback') as HTMLElement;
                                if (fallback) fallback.classList.remove('hidden');
                              }
                            }}
                          />
                          <span className={`char-fallback hidden text-lg font-bold ${currentBusinessId === biz.id ? 'text-white' : 'text-slate-400'}`}>
                            {biz.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm tracking-tight ${
                        currentBusinessId === biz.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}>{biz.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1 h-1 rounded-full ${currentBusinessId === biz.id ? 'bg-brand-500' : 'bg-slate-300'}`} />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{biz.ownerName}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {currentBusinessId === biz.id ? (
                      <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center border border-white/20">
                        <Check className="w-3 h-3 text-white" strokeWidth={4} />
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(biz);
                        }}
                        className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isQuickAddMode ? (
                <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><ShopIcon className="w-4 h-4" /></div>
                    <input 
                      type="text"
                      placeholder="Enter Business Name"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none transition-all font-bold text-sm text-slate-900 dark:text-white ring-2 ring-transparent focus:ring-brand-500"
                      value={newBizName}
                      onChange={(e) => setNewBizName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsQuickAddMode(false)}
                      className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={async () => {
                        if (newBizName.trim() && onQuickAdd) {
                          await onQuickAdd(newBizName);
                          setIsQuickAddMode(false);
                          setNewBizName('');
                        }
                      }}
                      disabled={!newBizName.trim() || isAdding}
                      className="flex-[2] py-3.5 rounded-2xl bg-brand-500 text-white font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create Store
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsQuickAddMode(true)}
                  className="w-full mt-2 py-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3 text-slate-400 hover:text-brand-500 hover:border-brand-500/30 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-bold text-[11px] uppercase tracking-widest">Add New Store</span>
                </button>
              )}
            </>
          )}
        </div>
        
        <div className="h-6 bg-white dark:bg-slate-900" />
      </div>
    </div>
  );
};

export default BusinessSwitcher;
