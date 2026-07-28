
import React from 'react';
import { motion } from 'motion/react';
import { Download, ShieldAlert, ExternalLink, RefreshCcw } from 'lucide-react';

interface UpdateRequiredOverlayProps {
  latestVersion: string;
  updateUrl: string;
  currentVersion: string;
}

const UpdateRequiredOverlay: React.FC<UpdateRequiredOverlayProps> = ({ latestVersion, updateUrl, currentVersion }) => {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // 1. Unregister all service workers to ensure fresh code downloads
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // 2. Delete all Cache Storage instances in the browser
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }

      // 3. Clear session storage
      sessionStorage.clear();

      // 4. Force reload with dynamic timestamp cache buster
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.set('v_update', Date.now().toString());
      window.location.href = cleanUrl.toString();
    } catch (err) {
      console.error("Force update cache clear failed:", err);
      // Fallback reload
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm relative z-10 flex flex-col items-center text-center"
      >
        {/* Icon Container */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center border border-slate-100 rotate-6 transform transition-transform hover:rotate-0 p-4">
             <img 
               src="/logo.png" 
               alt="BILLMAX Logo" 
               className="w-full h-full object-contain"
               referrerPolicy="no-referrer"
               onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 (e.target as HTMLImageElement).parentElement!.className = "w-24 h-24 bg-brand-500 rounded-3xl flex items-center justify-center relative overflow-hidden p-5 border border-white/20";
                 (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-white"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><path d="M4 14.5 12 3l1 9h7L12 21l-1-9H4Z"/></svg></div>';
               }}
             />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full border-4 border-slate-950 flex items-center justify-center animate-bounce">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="mb-2">
          <img 
            src="/Textbillmax.png" 
            alt="BILLMAX" 
            className="h-8 object-contain invert brightness-0" 
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-xl font-black tracking-tighter mb-2 uppercase text-white/90">Update Required</h1>
        <div className="flex items-center gap-2 mb-6">
          <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-400">Current: v{currentVersion}</span>
          <div className="w-4 h-[1px] bg-white/20" />
          <span className="px-3 py-1 bg-brand-500 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">Latest: {latestVersion}</span>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed mb-10 px-4">
          A new version of BillMax is available with important fixes and exciting new features. Please update to continue.
        </p>

        <div className="w-full space-y-4">
          <button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full bg-[#25D366] hover:bg-[#20ba5a] disabled:bg-slate-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2.5 active:scale-95 transition-all shadow-md"
          >
            {isUpdating ? (
              <>
                <RefreshCcw className="w-4 h-4 animate-spin" />
                Updating Code...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 animate-bounce" />
                Load Updated Code Now
              </>
            )}
          </button>
          
          <div className="flex items-center justify-center gap-1.5 text-slate-500">
            <RefreshCcw className="w-3 h-3 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Clearing cache & reloading source</span>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 w-full flex flex-col items-center">
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.4em] mb-4">Official Release Site</p>
            <a 
              href="https://billmax.jaislinc.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-brand-500 font-bold text-xs hover:underline"
            >
              billmax.jaislinc.in
              <ExternalLink className="w-3 h-3" />
            </a>
        </div>
      </motion.div>
    </div>
  );
};

export default UpdateRequiredOverlay;
