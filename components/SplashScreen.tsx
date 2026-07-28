
import React from 'react';
import { Loader2 } from 'lucide-react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-brand-500 flex flex-col items-center justify-center overflow-hidden">
      <div className="relative flex flex-col items-center mt-[-40px]">
        {/* Logo Representation */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-[2.5rem] flex items-center justify-center relative overflow-hidden mb-8 p-6">
          <img 
            src="/logo.png" 
            alt="BILLMAX Logo" 
            className="w-full h-full object-contain" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-white"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><path d="M4 14.5 12 3l1 9h7L12 21l-1-9H4Z"/></svg></div>';
            }}
          />
        </div>

        <div className="flex flex-col items-center">
          <img 
            src="/Textbillmax.png" 
            alt="BILLMAX" 
            className="h-10 object-contain w-auto mb-2" 
            referrerPolicy="no-referrer"
          />
          <p className="text-white/50 font-bold text-[10px] uppercase tracking-[0.4em] mt-1">By JAISLINC</p>
        </div>
      </div>

      {/* Loading Indicator - Rotating Spinner */}
      <div className="absolute bottom-28 flex flex-col items-center">
        <Loader2 className="w-7 h-7 text-white animate-spin opacity-50" />
      </div>
      
      <div className="absolute bottom-10 flex items-center gap-2 opacity-30">
        <span className="text-[8px] font-bold text-white uppercase tracking-widest">Powered By</span>
        <span className="text-[11px] font-black text-white tracking-tight uppercase">BILLMAX <span className="font-medium text-white/50 lowercase italic">by Jaislinc</span></span>
      </div>
    </div>
  );
};

export default SplashScreen;
