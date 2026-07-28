import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { ToastEventDetail, ToastType } from '../utils/notifications';

interface ToastItem extends ToastEventDetail {
  createdAt: number;
}

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventDetail>;
      if (customEvent.detail) {
        const newToast: ToastItem = {
          ...customEvent.detail,
          createdAt: Date.now(),
        };
        setToasts((prev) => {
          // Prevent showing duplicate toast messages on screen
          if (prev.some((t) => t.message === newToast.message)) return prev;
          return [newToast, ...prev].slice(0, 2); // Keep max 2 visible
        });
      }
    };

    window.addEventListener('billmax-toast', handleToastEvent);
    return () => window.removeEventListener('billmax-toast', handleToastEvent);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < 2500));
    }, 400);
    return () => clearInterval(interval);
  }, [toasts]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 pointer-events-none flex flex-col gap-2">
      {toasts.map((toast) => {
        let bgClass = 'bg-slate-900 text-white dark:bg-slate-800 border-slate-700';
        let icon = <Info className="w-4 h-4 text-brand-400 flex-shrink-0" />;

        if (toast.type === 'success') {
          bgClass = 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20';
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-100 flex-shrink-0" />;
        } else if (toast.type === 'warning') {
          bgClass = 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20';
          icon = <AlertTriangle className="w-4 h-4 text-amber-100 flex-shrink-0" />;
        } else if (toast.type === 'error') {
          bgClass = 'bg-red-600 text-white border-red-500 shadow-red-600/20';
          icon = <XCircle className="w-4 h-4 text-red-100 flex-shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-lg flex items-center justify-between gap-3 text-xs font-bold tracking-tight animate-in slide-in-from-top-3 duration-300 backdrop-blur-md ${bgClass}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              <p className="truncate leading-tight">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
