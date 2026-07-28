import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Shield, Mail, X as XIcon, LogOut, Delete, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { safeFetchJson } from '../utils/helpers';

interface PinLockProps {
  correctPin: string;
  onUnlock: () => void;
  shopName: string;
}

const PinLock: React.FC<PinLockProps> = ({ correctPin, onUnlock, shopName }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handlePress = useCallback((num: string) => {
    setPin(prevPin => {
      if (prevPin.length < 4) {
        const newPin = prevPin + num;
        if (newPin.length === 4) {
          if (newPin === correctPin) {
            onUnlock();
          } else {
            setError(true);
            setTimeout(() => {
              setPin('');
              setError(false);
            }, 600);
          }
        }
        return newPin;
      }
      return prevPin;
    });
  }, [correctPin, onUnlock]);

  const handleBackspace = useCallback(() => {
    setPin(prevPin => prevPin.slice(0, -1));
  }, []);

  useEffect(() => {
    if (showResetModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showResetModal, handlePress, handleBackspace]);

  const sendOtp = async () => {
    setIsProcessing(true);
    try {
      const email = auth.currentUser?.email;
      const { ok } = await safeFetchJson('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (ok) {
        setOtpSent(true);
      } else {
        alert("Failed to send OTP.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyOtpAndUnlock = async () => {
    if (otp.length !== 6) return;
    setIsProcessing(true);
    setOtpError('');
    try {
      const email = auth.currentUser?.email;
      const { data } = await safeFetchJson('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      if (data.success) {
        onUnlock();
      } else {
        setOtpError(data.error || "Invalid OTP");
      }
    } catch (err: any) {
      setOtpError(err.message || "Verification failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      auth.signOut();
    }
  };

  return (
    <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-slate-950 z-[999] flex flex-col items-center justify-center p-6 font-sans overflow-hidden pt-[env(safe-area-inset-top)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-20 h-20 bg-brand-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-brand-500/30">
          <Shield className="w-10 h-10 text-brand-500" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">{shopName}</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">Security Protocol Active</p>
      </motion.div>

      <div className="w-full max-w-[280px]">
        <div className={`flex justify-center gap-4 mb-12 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                pin.length > i 
                  ? 'bg-brand-500 border-brand-500' 
                  : 'border-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handlePress(n.toString())}
              className="w-16 h-16 rounded-2xl bg-slate-900/50 border border-slate-800 text-white text-2xl font-bold hover:bg-slate-800 active:scale-90 transition-all"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handlePress('0')}
            className="w-16 h-16 rounded-2xl bg-slate-900/50 border border-slate-800 text-white text-2xl font-bold hover:bg-slate-800 active:scale-90 transition-all"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 flex items-center justify-center text-slate-500 hover:text-white"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          <button 
            onClick={() => { setShowResetModal(true); sendOtp(); }}
            className="text-[10px] font-bold text-brand-500 uppercase tracking-widest hover:text-brand-400 transition-colors"
          >
            Forgot PIN? Reset via OTP
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-colors"
          >
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showResetModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-screen top-0 left-0 bg-slate-950/90 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 pt-[env(safe-area-inset-top)]"
          >
            <div className="w-full max-w-[320px] bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 relative">
              <button 
                onClick={() => { setShowResetModal(false); setOtp(''); setOtpSent(false); }}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-slate-300"
              >
                <XIcon className="w-5 h-5" />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                   <Mail className="w-8 h-8 text-brand-500" />
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">PIN Recovery</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center justify-center gap-2">
                  {otpSent ? `OTP sent to your email` : (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-6">
                <input 
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full bg-slate-800 border-none rounded-2xl p-5 text-center text-2xl font-black tracking-[0.4em] outline-none focus:ring-2 ring-brand-500/20 text-white"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
                {otpError && <p className="text-red-500 text-[9px] font-bold text-center uppercase tracking-widest">{otpError}</p>}
                <button 
                  onClick={verifyOtpAndUnlock}
                  disabled={otp.length !== 6 || isProcessing}
                  className="w-full bg-brand-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : 'Verify & Unlock'}
                </button>
                <p className="text-[8px] text-slate-500 text-center font-bold uppercase leading-relaxed">
                  Verification will grant temporary access. <br/>Please update your PIN in settings.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default PinLock;
