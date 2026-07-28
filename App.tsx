
import React, { useState, useEffect, useMemo, lazy, Suspense, Component, ErrorInfo } from 'react';
import { 
  ReceiptIndianRupee, 
  PackageSearch, 
  Clock7, 
  UserCircle2,
  LockKeyhole,
  Moon,
  Sun,
  Plus,
  LogIn,
  LogOut,
  Sparkles,
  ShieldCheck,
  Zap,
  Cloud,
  Loader2,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  WifiOff,
  Bell,
  Copy,
  ExternalLink,
  ShieldAlert,
  X,
  Mail,
  KeyRound,
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser, signInAnonymously } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, query, orderBy } from 'firebase/firestore';
import { auth, db, loginWithGoogle, signUpWithEmail, loginWithEmail, sendUserVerificationEmail, logout, handleFirestoreError, OperationType, resetPasswordForEmail, checkSignInMethods } from './firebase';
import { AppConfig, Tab, Product, Client, Invoice, InvoiceItem, PaymentMethod, Business } from './types';
import { safeFetchJson } from './utils/helpers';

// Lazy load views
const Dashboard = lazy(() => import('./views/Dashboard'));
const Billing = lazy(() => import('./views/Billing'));
const Inventory = lazy(() => import('./views/Inventory'));
const Invoices = lazy(() => import('./views/Invoices'));
const Settings = lazy(() => import('./views/Settings'));

import Setup from './components/Setup';
import Onboarding from './components/Onboarding';
import { getTranslation } from './utils/translations';
import PinLock from './components/PinLock';
import SplashScreen from './components/SplashScreen';
const ClientSelector = lazy(() => import('./components/ClientSelector'));
const PendingLedger = lazy(() => import('./components/PendingLedger'));
import PublicInvoice from './components/PublicInvoice';
const BusinessSwitcher = lazy(() => import('./components/BusinessSwitcher'));
const UpdateRequiredOverlay = lazy(() => import('./components/UpdateRequiredOverlay'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
import ToastContainer from './components/ToastContainer';
const PullToRefresh = lazy(() => import('./components/PullToRefresh').then(m => ({ default: m.PullToRefresh })));
import { DashboardIcon } from './components/DashboardIcon';

const ViewSkeleton = () => (
  <div className="space-y-6 pt-4 animate-pulse">
    <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl w-3/4" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
    </div>
    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
    <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
  </div>
);

const CURRENT_VERSION = '1.8.0';

// Robust Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-brand-500 p-8 text-white text-center font-sans">
          <AlertCircle className="w-16 h-16 mb-4 text-white" />
          <h1 className="text-3xl font-black mb-4 tracking-tight">Invoice Display Error</h1>
          <div className="bg-black/20 p-6 rounded-2xl text-left max-w-md w-full overflow-hidden mb-6">
            <p className="text-xs font-mono break-all opacity-80">{this.state.error?.message || "Internal Rendering Error"}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-brand-500 rounded-2xl font-black active:scale-95 transition-all outline-none ring-2 ring-white/20"
          >
            REFRESH PAGE
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const SIGNIN_TOP_IMAGES = ["/signin1.png", "/signin11.png", "/signin3.png", "/signin4.png"];
const SIGNIN_BOTTOM_IMAGES = ["/signin5.png", "/signin6.png", "/signin7.png", "/signin8.png"];

const MarqueeRow = React.memo(({ images, direction }: { images: string[], direction: 'left' | 'right' }) => {
  // Two sets is enough for a seamless loop if we translate by exactly 50%
  const duplicated = [...images, ...images];
  return (
    <div className="overflow-hidden">
      <div className={`flex ${direction === 'left' ? 'animate-left' : 'animate-right'}`} style={{ width: 'max-content' }}>
        {duplicated.map((src, index) => (
          <div 
            className="w-[180px] h-[125px] rounded-[24px] overflow-hidden flex-shrink-0 mr-[16px]" 
            key={`${direction}-${index}`}
          >
            <img 
              src={src} 
              alt="img" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const sig = direction === 'left' ? index : index + 10;
                target.src = `https://picsum.photos/400/300?sig=${sig}`;
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

const SignInScreenView = React.memo(({ authError, onLogin }: { authError: string | null, onLogin: () => void }) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Email / Password Auth States
  const [authMethod, setAuthMethod] = useState<'GOOGLE' | 'EMAIL'>('GOOGLE');
  const [emailMode, setEmailMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailAuthError, setEmailAuthError] = useState<string | null>(null);

  // Email OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);
  const [receivedDevOtp, setReceivedDevOtp] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpTimer]);

  const isUnauthorizedDomain = authError && (
    authError.toLowerCase().includes('unauthorized-domain') || 
    authError.toLowerCase().includes('unauthorized')
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(text);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleGoogleClick = async () => {
    setIsSigningIn(true);
    setEmailAuthError(null);
    try {
      const user = await loginWithGoogle();
      if (user && user.email) {
        try {
          const methods = await checkSignInMethods(user.email);
          if (methods.includes('password') && !methods.includes('google.com')) {
            await logout();
            setEmailAuthError('This account is registered with Email & Password. Please sign in using the "Email & Password" tab.');
            return;
          }
        } catch (checkErr) {
          console.warn('Check sign in methods failed:', checkErr);
        }
      }
      await onLogin();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setEmailAuthError('This account is registered with Email & Password. Please sign in using the Email & Password tab.');
      } else {
        setEmailAuthError(err.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Direct Sign In (No OTP required for Login)
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailAuthError(null);
    setOtpSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setEmailAuthError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setEmailAuthError('Please enter your password.');
      return;
    }

    setEmailLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error('Direct Login Error:', err);
      try {
        const methods = await checkSignInMethods(email.trim());
        if (methods.includes('google.com') && !methods.includes('password')) {
          setEmailAuthError('You registered using Google Sign-In. Please sign in with Google.');
          return;
        }
      } catch (checkErr) {
        console.warn('Check sign in methods failed:', checkErr);
      }

      let msg = 'Incorrect email or password.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email. Please click "Create Account" to register.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Incorrect email or password. Please verify your credentials.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please try again later or click Forgot Password.';
      }
      setEmailAuthError(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  // Send OTP for Registration
  const handleRegisterSendOtp = async () => {
    setEmailAuthError(null);
    setOtpSuccessMsg(null);

    if (otpTimer > 0) {
      setEmailAuthError(`Please wait ${otpTimer} seconds before requesting a new OTP.`);
      return;
    }

    if (!fullName.trim()) {
      setEmailAuthError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setEmailAuthError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setEmailAuthError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const methods = await checkSignInMethods(email.trim());
      if (methods.includes('google.com')) {
        setEmailAuthError('An account with this email already exists via Google Sign-In. Please sign in with Google.');
        return;
      } else if (methods.includes('password')) {
        setEmailAuthError('An account with this email already exists. Please Sign In.');
        return;
      }
    } catch (checkErr) {
      console.warn('Check methods error:', checkErr);
    }

    setSendingOtp(true);
    try {
      const { ok, data } = await safeFetchJson('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      if (ok && data.success) {
        setOtpSent(true);
        setOtpTimer(60);
        setOtpSuccessMsg(`A verification OTP code has been sent to ${email}. Please check your Inbox or Spam folder.`);
      } else {
        setEmailAuthError(data.error || 'Failed to send OTP code. Please try again.');
      }
    } catch (e: any) {
      setEmailAuthError(e.message || 'Server error while sending OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP and Create Account
  const handleRegisterVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailAuthError(null);

    if (!otpSent) {
      await handleRegisterSendOtp();
      return;
    }

    if (!otpCode || otpCode.trim().length !== 6) {
      setEmailAuthError('Please enter the 6-digit OTP code.');
      return;
    }

    setEmailLoading(true);
    try {
      const { ok, data: verifyData } = await safeFetchJson('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otpCode.trim() })
      });
      if (!ok || !verifyData.success) {
        throw new Error(verifyData.error || 'OTP verification failed.');
      }

      await signUpWithEmail(email, password, fullName);
    } catch (err: any) {
      console.error('Register Error:', err);
      let msg = err.message || 'Account registration failed.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email ID already exists. Please Sign In.';
      }
      setEmailAuthError(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  // Forgot Password: Send OTP
  const handleForgotSendOtp = async () => {
    setEmailAuthError(null);
    setOtpSuccessMsg(null);

    if (otpTimer > 0) {
      setEmailAuthError(`Please wait ${otpTimer} seconds before requesting a new OTP.`);
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setEmailAuthError('Please enter a valid email address.');
      return;
    }

    try {
      const methods = await checkSignInMethods(email.trim());
      if (methods.includes('google.com') && !methods.includes('password')) {
        setEmailAuthError('This email is registered via Google Sign-In. Password reset is not needed, please sign in with Google.');
        return;
      } else if (methods.length === 0) {
        setEmailAuthError('No account found with this email address.');
        return;
      }
    } catch (err) {
      console.warn('Check sign in methods failed:', err);
    }

    setSendingOtp(true);
    try {
      const { ok, data } = await safeFetchJson('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      if (ok && data.success) {
        setOtpSent(true);
        setOtpTimer(60);
        setOtpSuccessMsg(`Password reset OTP has been sent to your email (${email}). Please check your inbox.`);
      } else {
        setEmailAuthError(data.error || 'Failed to send password reset OTP.');
      }
    } catch (e: any) {
      setEmailAuthError(e.message || 'Server error while sending OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Forgot Password: Verify OTP & Send Reset Email
  const handleForgotVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailAuthError(null);

    if (!otpSent) {
      await handleForgotSendOtp();
      return;
    }

    if (!otpCode || otpCode.trim().length !== 6) {
      setEmailAuthError('Please enter the 6-digit OTP code.');
      return;
    }

    setEmailLoading(true);
    try {
      const { ok, data: verifyData } = await safeFetchJson('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otpCode.trim() })
      });
      if (!ok || !verifyData.success) {
        throw new Error(verifyData.error || 'OTP verification failed.');
      }

      await resetPasswordForEmail(email);
      setOtpSuccessMsg('OTP verified successfully! A password reset link has been sent to your email. Please check your inbox.');
      setOtpSent(false);
    } catch (err: any) {
      console.error('Forgot Password Error:', err);
      setEmailAuthError(err.message || 'Password reset request failed.');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between py-8 px-6 overflow-hidden font-poppins relative">
      <div className="max-w-lg mx-auto w-full pt-8">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <h2 className="text-4xl font-black text-slate-900 leading-[1.15] tracking-tight">
            The partner of<br />
            your <span className="text-brand-500">business life.</span>
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-3">Sign in to manage invoices, inventory and business ledger</p>
        </motion.div>

        <div className="space-y-[14px] mt-10 scale-100">
          <MarqueeRow images={SIGNIN_TOP_IMAGES} direction="left" />
          <MarqueeRow images={SIGNIN_BOTTOM_IMAGES} direction="right" />
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full space-y-5 my-6">
        {/* Method Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => { setAuthMethod('GOOGLE'); setEmailAuthError(null); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              authMethod === 'GOOGLE'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <img src="/Google.png" alt="G" className="w-3.5 h-3.5 object-contain" />
            <span>Google Login</span>
          </button>
          
          <button
            type="button"
            onClick={() => { setAuthMethod('EMAIL'); setEmailAuthError(null); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              authMethod === 'EMAIL'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-brand-600" />
            <span>Email & Password</span>
          </button>
        </div>

        {(emailAuthError || (authError && !isUnauthorizedDomain)) && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-semibold text-center animate-in fade-in zoom-in duration-300">
            {emailAuthError || authError}
          </div>
        )}

        {isUnauthorizedDomain && (
          <div className="p-5 bg-red-50/90 border border-red-200 rounded-3xl space-y-3 text-slate-900 animate-in fade-in zoom-in duration-300 shadow-xl shadow-red-500/10">
            <div className="flex items-center gap-2.5 text-red-600 font-extrabold text-xs uppercase tracking-wider">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>Firebase Domain Fix Required</span>
            </div>
            
            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
              Google login enable karne ke liye Firebase Console mein domains add karein:
            </p>

            <div className="bg-white p-3 rounded-2xl border border-red-100 space-y-2">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Step 1: Authorized Domains</p>
              
              <div className="space-y-1.5 pt-1">
                {['capacitor://localhost', 'localhost', 'http://localhost'].map((domain) => (
                  <div key={domain} className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                    <code className="text-[10px] font-mono font-bold text-brand-600">{domain}</code>
                    <button
                      onClick={() => handleCopy(domain)}
                      className="p-1 text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 text-[9px] font-bold"
                    >
                      {copiedItem === domain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedItem === domain ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {authMethod === 'GOOGLE' ? (
          /* Primary Google Sign-In Button */
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleClick}
            disabled={isSigningIn}
            className="group w-full h-[58px] bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-2xl font-bold text-base shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  <img 
                    src="/Google.png" 
                    alt="Google Logo" 
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 object-contain" 
                  />
                </div>
                <span>Sign in with Google</span>
              </>
            )}
          </motion.button>
        ) : (
          /* Email & Password Form with Direct Sign In / OTP Register / Forgot Password */
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {emailMode === 'LOGIN' ? 'Sign In with Email' : emailMode === 'REGISTER' ? 'Create New Account' : 'Forgot Password'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (emailMode === 'LOGIN') {
                    setEmailMode('REGISTER');
                  } else {
                    setEmailMode('LOGIN');
                  }
                  setEmailAuthError(null);
                  setOtpSuccessMsg(null);
                  setOtpSent(false);
                  setOtpCode('');
                  setReceivedDevOtp(null);
                }}
                className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
              >
                {emailMode === 'LOGIN' ? 'Create Account' : 'Back to Sign In'}
              </button>
            </div>

            {otpSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold text-center animate-in fade-in zoom-in duration-200 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            {/* --- MODE 1: LOGIN (Direct Email & Password - No OTP required) --- */}
            {emailMode === 'LOGIN' && (
              <form onSubmit={handleDirectLogin} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@business.com"
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 pl-10 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('FORGOT_PASSWORD');
                        setEmailAuthError(null);
                        setOtpSuccessMsg(null);
                        setOtpSent(false);
                        setOtpCode('');
                        setReceivedDevOtp(null);
                      }}
                      className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 pl-10 pr-10 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm"
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={emailLoading}
                  className="w-full h-[52px] bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer mt-3"
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </>
                  )}
                </motion.button>
              </form>
            )}

            {/* --- MODE 2: REGISTER (Account creation with OTP) --- */}
            {emailMode === 'REGISTER' && (
              <form onSubmit={handleRegisterVerifyAndSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      disabled={otpSent}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 pl-10 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm disabled:bg-slate-100"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@business.com"
                      disabled={otpSent}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 pl-10 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm disabled:bg-slate-100"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={otpSent}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 pl-10 pr-10 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm disabled:bg-slate-100"
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <div className="p-3.5 bg-brand-500/5 border border-brand-500/20 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-brand-700 uppercase tracking-wider">
                        Enter 6-Digit Email OTP
                      </label>
                      <button
                        type="button"
                        onClick={handleRegisterSendOtp}
                        disabled={sendingOtp || otpTimer > 0}
                        className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                      >
                        {sendingOtp ? 'Sending...' : otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full h-12 bg-white border border-brand-300 rounded-xl px-3.5 text-center text-slate-900 font-black tracking-[8px] text-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {!otpSent ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleRegisterSendOtp}
                    disabled={sendingOtp || otpTimer > 0}
                    className="w-full h-[52px] bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer mt-2"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : otpTimer > 0 ? (
                      <span>Resend available in {otpTimer}s</span>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send OTP to Email</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="space-y-2 pt-1">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={emailLoading}
                      className="w-full h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {emailLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying & Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Verify OTP & Create Account</span>
                        </>
                      )}
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setOtpSuccessMsg(null);
                      }}
                      className="w-full py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
                    >
                      Edit Email / Change Details
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* --- MODE 3: FORGOT PASSWORD (OTP Verification & Reset Email) --- */}
            {emailMode === 'FORGOT_PASSWORD' && (
              <form onSubmit={handleForgotVerifyAndReset} className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">
                  Enter your registered email address to receive a 6-digit verification code.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@business.com"
                      disabled={otpSent}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-3.5 pl-10 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm disabled:bg-slate-100"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {otpSent && (
                  <div className="p-3.5 bg-brand-500/5 border border-brand-500/20 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-brand-700 uppercase tracking-wider">
                        Enter 6-Digit Email OTP
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotSendOtp}
                        disabled={sendingOtp || otpTimer > 0}
                        className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                      >
                        {sendingOtp ? 'Sending...' : otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full h-12 bg-white border border-brand-300 rounded-xl px-3.5 text-center text-slate-900 font-black tracking-[8px] text-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {!otpSent ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleForgotSendOtp}
                    disabled={sendingOtp || otpTimer > 0}
                    className="w-full h-[52px] bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer mt-2"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Reset OTP...</span>
                      </>
                    ) : otpTimer > 0 ? (
                      <span>Resend available in {otpTimer}s</span>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send Reset OTP to Email</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="space-y-2 pt-1">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={emailLoading}
                      className="w-full h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {emailLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying & Sending Reset Link...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Verify OTP & Send Password Reset Link</span>
                        </>
                      )}
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setOtpSuccessMsg(null);
                      }}
                      className="w-full py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
                    >
                      Change Email Address
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        <p className="text-[12px] text-[#666] text-center leading-relaxed px-4">
          By continuing, you agree to our{" "}
          <span className="text-brand-500 font-semibold cursor-pointer">Terms of Service</span> and{" "}
          <span className="text-brand-500 font-semibold cursor-pointer">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
});

const EmailVerificationView: React.FC<{ user: FirebaseUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCheckVerification = async () => {
    setChecking(true);
    setStatusMsg(null);
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        window.location.reload();
      } else {
        setStatusMsg({
          type: 'error',
          text: 'Email abhi tak verify nahi hua hai. Kripya apne email inbox/spam folder mein verification link par click karein.'
        });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Status check fail ho gaya.' });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setStatusMsg(null);
    try {
      await sendUserVerificationEmail(user);
      setStatusMsg({
        type: 'success',
        text: 'Verification link aapke email par dobara bhej diya gaya hai (Check Inbox & Spam).'
      });
    } catch (e: any) {
      setStatusMsg({
        type: 'error',
        text: e.message || 'Resend karne me error aaya. Thodi der baad try karein.'
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-poppins relative">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl text-center">
        <div className="w-20 h-20 bg-brand-500/10 border border-brand-500/20 rounded-3xl flex items-center justify-center mx-auto">
          <Mail className="w-10 h-10 text-brand-500 animate-bounce" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white tracking-tight">Verify Your Email</h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Humne ek verification email link <span className="text-brand-400 font-bold">{user.email}</span> par bhej diya hai.
          </p>
          <p className="text-[11px] text-slate-500 font-normal">
            Kripya apna Inbox ya Spam folder check karke link par click karein.
          </p>
        </div>

        {statusMsg && (
          <div className={`p-4 rounded-2xl text-xs font-semibold ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {statusMsg.text}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleCheckVerification}
            disabled={checking}
            className="w-full h-12 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Status...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>I've Verified My Email</span>
              </>
            )}
          </button>

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm border border-slate-700/80 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {resending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resending Link...</span>
              </>
            ) : (
              <span>Resend Verification Email</span>
            )}
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Logout & Use Different Email
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [systemUpdateConfig, setSystemUpdateConfig] = useState<{ isUpdateRequired: boolean; latestVersion: string; updateUrl: string } | null>(null);

  const [showSplash, setShowSplash] = useState(true);
  const [showGlobalClientSelector, setShowGlobalClientSelector] = useState(false);
  const [showPendingLedger, setShowPendingLedger] = useState(false);
  const [isRevenueDetailOpen, setIsRevenueDetailOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const prevUserRef = React.useRef<any>(null);

  useEffect(() => {
    if (isAuthReady) {
      if (prevUserRef.current && !user) {
        // User logged out - reset onboarding and show it
        setShowOnboarding(true);
      }
      prevUserRef.current = user;
    }
  }, [user, isAuthReady]);

  const t = getTranslation(config?.language || 'hinglish');

  // Public View State
  const [publicParams, setPublicParams] = useState<{ u: string; i: string; b: string | null } | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const u = params.get('u');
      const i = params.get('i');
      const b = params.get('b');
      if (u && i) {
        console.log('Detected Public params:', { u, i, b });
        return { u, i, b };
      }
    } catch (e) {
      console.error('Error parsing public params:', e);
    }
    return null;
  });

  useEffect(() => {
    // Check for params if URL changes without reload (some browsers/apps)
    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      const u = params.get('u');
      const i = params.get('i');
      const b = params.get('b');
      if (u && i) {
        setPublicParams({ u, i, b });
      }
    };
    window.addEventListener('popstate', checkParams);
    return () => window.removeEventListener('popstate', checkParams);
  }, []);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstallable, setIsAppInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsAppInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already running in standalone (PWA) mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsAppInstallable(false);
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (evt: MediaQueryListEvent) => {
      if (evt.matches) {
        setIsAppInstallable(false);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const triggerInstallPrompt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice for PWA install: ${outcome}`);
    if (outcome === 'accepted') {
      setIsAppInstallable(false);
      setDeferredPrompt(null);
    }
  };

  // Billing Persistence State
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'AMOUNT'>('PERCENTAGE');
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [partialPaidAmount, setPartialPaidAmount] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);
  const [selectedClientForBilling, setSelectedClientForBilling] = useState<Client | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string>(() => {
    try {
      return localStorage.getItem('currentBusinessId') || 'default';
    } catch {
      return 'default';
    }
  });
  const [showBusinessSwitcher, setShowBusinessSwitcher] = useState(false);
  const [showNewBusinessSetup, setShowNewBusinessSetup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const unreadNotificationCount = useMemo(() => {
    const threshold = config?.lowStockThreshold || 5;
    const lowStockCount = products.filter(p => p.type === 'PRODUCT' && p.stock !== null && p.stock <= threshold).length;
    const pendingCount = invoices.filter(inv => (inv.paymentMethod === PaymentMethod.BORROW || inv.pendingAmount > 0) && inv.pendingAmount > 0).length;
    return lowStockCount + pendingCount;
  }, [products, invoices, config?.lowStockThreshold]);

  // Handle Browser Back Button for Navigation
  useEffect(() => {
    // Set initial state
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      // Close modals first if any are open
      if (showGlobalClientSelector) { setShowGlobalClientSelector(false); return; }
      if (showPendingLedger) { setShowPendingLedger(false); return; }
      if (showBusinessSwitcher) { setShowBusinessSwitcher(false); return; }
      if (showNotifications) { setShowNotifications(false); return; }
      if (isRevenueDetailOpen) { setIsRevenueDetailOpen(false); return; }
      if (showCheckout) { setShowCheckout(false); return; }
      if (isSuccess) { setIsSuccess(false); setLastInvoice(null); return; }

      if (event.state?.tab) {
        setActiveTab(event.state.tab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, showGlobalClientSelector, showPendingLedger, showBusinessSwitcher, isRevenueDetailOpen, showCheckout, isSuccess]);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    window.history.pushState({ tab: newTab }, '');
    window.scrollTo(0, 0);
  };

  const openModal = (setter: (v: boolean) => void) => {
    setter(true);
    window.history.pushState({ ...window.history.state, modal: true }, '');
  };

  const features = [
    {
      title: "Smart Billing",
      desc: "Generate professional bills in seconds with automated inventory sync.",
      icon: <ReceiptIndianRupee className="w-8 h-8 text-brand-500" />,
      bg: "bg-brand-500/10"
    },
    {
      title: "Inventory Control",
      desc: "Track stock levels, low-stock alerts, and manage products effortlessly.",
      icon: <PackageSearch className="w-8 h-8 text-emerald-500" />,
      bg: "bg-emerald-500/10"
    },
    {
      title: "Cloud Sync",
      desc: "Your data is always safe and accessible across all your devices.",
      icon: <Cloud className="w-8 h-8 text-purple-500" />,
      bg: "bg-purple-500/10"
    },
    {
      title: "Secure & Fast",
      desc: "PIN protection and lightning-fast performance for your daily operations.",
      icon: <ShieldCheck className="w-8 h-8 text-orange-500" />,
      bg: "bg-orange-500/10"
    }
  ];

  useEffect(() => {
    if (!user) {
      const interval = setInterval(() => {
        setFeatureIndex((prev) => (prev + 1) % features.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    // Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });

    // Auth Readiness Safety Timeout
    const authTimeout = setTimeout(() => {
      if (!isAuthReady) {
        setIsAuthReady(true);
      }
    }, 10000);

    // Sync Global Update Config
    const unsubUpdate = onSnapshot(doc(db, 'app_updates', 'config'), (snap) => {
      if (snap.exists()) {
        setSystemUpdateConfig(snap.data() as any);
      } else if (user) {
        // Only attempt to initialize if logged in and it doesn't exist
        setDoc(doc(db, 'app_updates', 'config'), {
          isUpdateRequired: false,
          latestVersion: CURRENT_VERSION,
          updateUrl: 'billmax.jaislinc.in'
        }, { merge: true }).catch(() => {});
      }
    }, (err) => {
      console.warn("Global update config access limited:", err.message);
    });

    return () => {
      unsubscribe();
      unsubUpdate();
      clearTimeout(authTimeout);
    };
  }, []);

  // Helper to compare semver versions dynamically
  const isNewerVersion = (local: string, remote: string): boolean => {
    const localParts = local.split('.').map(Number);
    const remoteParts = remote.split('.').map(Number);
    for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
      const l = localParts[i] || 0;
      const r = remoteParts[i] || 0;
      if (l > r) return true;
      if (l < r) return false;
    }
    return false;
  };

  // Auto-sync remote database version for lead developer/admin
  useEffect(() => {
    if (user && user.email === 'anubhav45lt@gmail.com' && systemUpdateConfig) {
      const remoteVersion = systemUpdateConfig.latestVersion || '';
      if (remoteVersion.trim() !== CURRENT_VERSION.trim() && isNewerVersion(CURRENT_VERSION, remoteVersion)) {
        setDoc(doc(db, 'app_updates', 'config'), {
          latestVersion: CURRENT_VERSION
        }, { merge: true })
          .then(() => {
            console.log(`Database version auto-updated to latest: ${CURRENT_VERSION}`);
          })
          .catch((err) => {
            console.error("Failed to auto-update database version:", err);
          });
      }
    }
  }, [user, systemUpdateConfig]);

  useEffect(() => {
    // Splash screen timer
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;

    setIsDataLoading(true); // Start loading when business changes
    localStorage.setItem('currentBusinessId', currentBusinessId);

    const userRef = doc(db, 'users', user.uid);
    const businessRef = currentBusinessId === 'default' 
      ? userRef 
      : doc(userRef, 'businesses', currentBusinessId);
    
    // Sync Config
    const unsubConfig = onSnapshot(doc(businessRef, 'config', 'app'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppConfig;
        if (!data.businessLogo) {
          data.businessLogo = '/logo.png';
        }
        setConfig(data);
        if (data.isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        setConfig(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/config/app`));

    // Sync Products
    const unsubProducts = onSnapshot(collection(businessRef, 'products'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/products`));

    // Sync Clients
    const unsubClients = onSnapshot(collection(businessRef, 'clients'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setClients(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/clients`));

    // Sync Invoices
    const unsubInvoices = onSnapshot(query(collection(businessRef, 'invoices'), orderBy('date', 'desc')), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      setInvoices(list);
      setIsDataLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/invoices`);
      setIsDataLoading(false);
    });

    return () => {
      unsubConfig();
      unsubProducts();
      unsubClients();
      unsubInvoices();
    };
  }, [user, currentBusinessId, refreshVersion]);

  // Ensure public config exists for existing users
  useEffect(() => {
    if (user && config && config.setupComplete) {
      const syncPublic = async () => {
        try {
          await setDoc(doc(db, 'users', user.uid, 'config', 'public'), {
            shopName: config.shopName,
            businessLogo: config.businessLogo || null,
            shopMobile: config.shopMobile,
            ownerName: config.ownerName,
            invoiceTheme: config.invoiceTheme || null,
            invoicePrimaryColor: config.invoicePrimaryColor || null
          }, { merge: true });
        } catch (err) {
          console.error('Error syncing public config:', err);
        }
      };
      syncPublic();
    }
  }, [user, config?.shopName]); // Only sync when shop name changes or on initial load

  const handleQuickAddBusiness = async (name: string) => {
    if (!user || !config) return;
    setIsQuickAdding(true);
    const businessId = generateId();
    const businessRef = doc(db, 'users', user.uid, 'businesses', businessId);

    try {
      // Create a basic config based on current one
      const newConfig: AppConfig = {
        ...config,
        shopName: name,
        setupComplete: true,
        // Reset some business specific assets
        signatureImage: '',
        qrCodeImage: '',
      };

      await setDoc(doc(businessRef, 'config', 'app'), newConfig);
      
      // Update business profile
      await setDoc(doc(db, 'users', user.uid, 'businesses', businessId), {
        id: businessId,
        name: name,
        ownerName: config.ownerName,
        logo: '/logo.png',
        createdAt: Date.now()
      });

      // Sync Public Config
      await setDoc(doc(businessRef, 'config', 'public'), {
        shopName: name,
        businessLogo: '/logo.png',
        shopMobile: config.shopMobile,
        ownerName: config.ownerName
      });

      setCurrentBusinessId(businessId);
      setShowBusinessSwitcher(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/businesses/${businessId}`);
    } finally {
      setIsQuickAdding(false);
    }
  };
  const handleSetupComplete = async (newConfig: AppConfig) => {
    if (!user) return;
    const businessId = showNewBusinessSetup ? generateId() : currentBusinessId;
    const businessRef = businessId === 'default' 
      ? doc(db, 'users', user.uid) 
      : doc(db, 'users', user.uid, 'businesses', businessId);

    try {
      await setDoc(doc(businessRef, 'config', 'app'), newConfig);
      
      // Update business profile
      await setDoc(doc(db, 'users', user.uid, 'businesses', businessId), {
        id: businessId,
        name: newConfig.shopName,
        ownerName: newConfig.ownerName,
        logo: newConfig.businessLogo || '/logo.png',
        createdAt: Date.now()
      }, { merge: true });

      // Sync Public Config
      await setDoc(doc(businessRef, 'config', 'public'), {
        shopName: newConfig.shopName,
        businessLogo: newConfig.businessLogo || null,
        shopMobile: newConfig.shopMobile,
        ownerName: newConfig.ownerName,
        welcomeGreetingText: newConfig.welcomeGreetingText || null,
        reminderGreetingText: newConfig.reminderGreetingText || null,
        reminderGreetingVoice: newConfig.reminderGreetingVoice || null,
        invoiceGreetingVoice: newConfig.invoiceGreetingVoice || null,
        invoiceTheme: newConfig.invoiceTheme || null,
        invoicePrimaryColor: newConfig.invoicePrimaryColor || null,
        language: newConfig.language || null
      });

      if (showNewBusinessSetup) {
        setCurrentBusinessId(businessId);
        setShowNewBusinessSetup(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/config/app`);
    }
  };

  const updateConfig = async (newConfig: AppConfig) => {
    if (!user) return;
    const businessRef = currentBusinessId === 'default' 
      ? doc(db, 'users', user.uid) 
      : doc(db, 'users', user.uid, 'businesses', currentBusinessId);

    try {
      await setDoc(doc(businessRef, 'config', 'app'), newConfig);
      
      // Update business profile
      await setDoc(doc(db, 'users', user.uid, 'businesses', currentBusinessId), {
        id: currentBusinessId,
        name: newConfig.shopName,
        ownerName: newConfig.ownerName,
        logo: newConfig.businessLogo || '/logo.png',
        createdAt: Date.now()
      }, { merge: true });

      // Sync Public Config
      await setDoc(doc(businessRef, 'config', 'public'), {
        shopName: newConfig.shopName,
        businessLogo: newConfig.businessLogo || null,
        shopMobile: newConfig.shopMobile,
        ownerName: newConfig.ownerName,
        welcomeGreetingText: newConfig.welcomeGreetingText || null,
        reminderGreetingText: newConfig.reminderGreetingText || null,
        reminderGreetingVoice: newConfig.reminderGreetingVoice || null,
        invoiceGreetingVoice: newConfig.invoiceGreetingVoice || null,
        invoiceTheme: newConfig.invoiceTheme || null,
        invoicePrimaryColor: newConfig.invoicePrimaryColor || null,
        language: newConfig.language || null
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/config/app`);
    }
  };

  const handleUpdateConfigPartial = async (updates: Partial<AppConfig>) => {
    if (!config) return;
    await updateConfig({ ...config, ...updates });
  };

  const generateId = () => Math.random().toString(36).substring(2, 15);

  if (isOffline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center font-sans">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <WifiOff className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase mb-2">No Internet Connection</h1>
        <p className="text-sm font-semibold text-slate-400 max-w-sm mb-6 leading-relaxed">
          इंटरनेट कनेक्शन बंद है। This app requires an active internet connection to process transactions, manage inventory, and synchronize data.
        </p>
        <button 
          onClick={() => setIsOffline(!navigator.onLine)}
          className="bg-brand-500 hover:bg-brand-600 text-white font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-2xl transition-all active:scale-95 border border-brand-400 shadow-lg shadow-brand-500/20"
        >
          Check Again / दोबारा जांचें
        </button>
      </div>
    );
  }

  if (publicParams) return (
    <ErrorBoundary>
      <PublicInvoice uid={publicParams.u} invoiceId={publicParams.i} businessId={publicParams.b || 'default'} />
    </ErrorBoundary>
  );

  // Global Update Check - automatically prompt whenever the loaded code does not match the latest version
  if (systemUpdateConfig && systemUpdateConfig.latestVersion.trim() !== CURRENT_VERSION.trim()) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <UpdateRequiredOverlay 
          latestVersion={systemUpdateConfig.latestVersion} 
          updateUrl={systemUpdateConfig.updateUrl} 
          currentVersion={CURRENT_VERSION}
        />
      </Suspense>
    );
  }

  if (showSplash) return (
    <SplashScreen />
  );

  if (!isAuthReady) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      <span className="font-bold uppercase tracking-widest text-[10px] opacity-50">Loading Workspace...</span>
    </div>
  );

  if (!user) {
    if (showOnboarding) {
      return (
        <Onboarding 
          onComplete={() => {
            setShowOnboarding(false);
          }} 
        />
      );
    }

    return (
      <SignInScreenView 
        authError={authError} 
        onLogin={async () => {
          try {
            setAuthError(null);
            await loginWithGoogle();
          } catch (err: any) {
            const isCancelled = err.code === 'auth/popup-closed-by-user' || 
                                err.code === 'auth/cancelled-popup-request' || 
                                (err.message && err.message.includes('auth/cancelled-popup-request')) ||
                                (err.message && err.message.includes('auth/popup-closed-by-user'));
            if (!isCancelled) {
              setAuthError(err.message || 'Login failed. Please try again.');
            }
          }
        }} 
      />
    );
  }

  if (!config || !config.setupComplete || showNewBusinessSetup) return (
    <Setup onComplete={handleSetupComplete} onCancel={showNewBusinessSetup ? () => setShowNewBusinessSetup(false) : undefined} />
  );

  if (config.pin && !isUnlocked) {
    return (
      <PinLock 
        correctPin={config.pin} 
        onUnlock={() => setIsUnlocked(true)} 
        shopName={config.shopName} 
      />
    );
  }

  const handleRefresh = async () => {
    setIsDataLoading(true);
    setRefreshVersion(prev => prev + 1);
    
    // Smooth, responsive, instant 300ms feedback transition
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 300);
    });
  };

  const renderView = () => {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.985 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<ViewSkeleton />}>
              {(() => {
                switch (activeTab) {
                  case Tab.DASHBOARD: return (
                  <Dashboard 
                    invoices={invoices} 
                    clients={clients} 
                    setClients={setClients} 
                    products={products} 
                    config={config!} 
                    onNavigate={handleTabChange} 
                    setConfig={updateConfig} 
                    onOpenClients={() => openModal(setShowGlobalClientSelector)} 
                    onOpenPendingLedger={() => openModal(setShowPendingLedger)} 
                    onToggleDetail={(v) => {
                      setIsRevenueDetailOpen(v);
                      if (v) window.history.pushState({ ...window.history.state, modal: true }, '');
                    }}
                    onSelectInvoice={(id) => {
                      setTargetInvoiceId(id);
                      handleTabChange(Tab.INVOICES);
                    }}
                    isLoading={isDataLoading}
                    businessId={currentBusinessId}
                    isInstallable={isAppInstallable}
                    onInstall={triggerInstallPrompt}
                  />
                );
                case Tab.BILLING: return (
                  <Billing 
                    products={products} 
                    clients={clients} 
                    invoices={invoices}
                    setInvoices={setInvoices} 
                    setProducts={setProducts} 
                    setClients={setClients} 
                    config={config!}
                    cart={cart}
                    setCart={setCart}
                    custName={custName}
                    setCustName={setCustName}
                    custMobile={custMobile}
                    setCustMobile={setCustMobile}
                    custAddress={custAddress}
                    setCustAddress={setCustAddress}
                    discount={discount}
                    setDiscount={setDiscount}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    showCheckout={showCheckout}
                    setShowCheckout={(v) => {
                      setShowCheckout(v);
                      if (v) window.history.pushState({ ...window.history.state, modal: true }, '');
                    }}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    partialPaidAmount={partialPaidAmount}
                    setPartialPaidAmount={setPartialPaidAmount}
                    isSuccess={isSuccess}
                    setIsSuccess={(v) => {
                      setIsSuccess(v);
                      if (v) window.history.pushState({ ...window.history.state, modal: true }, '');
                    }}
                    lastInvoice={lastInvoice}
                    setLastInvoice={setLastInvoice}
                    user={user}
                    businessId={currentBusinessId}
                    selectedClient={selectedClientForBilling}
                    clearSelectedClient={() => setSelectedClientForBilling(null)}
                    onUpdateConfig={handleUpdateConfigPartial}
                  />
                );
                case Tab.INVOICES: return (
                  <Invoices 
                    invoices={invoices} 
                    config={config!} 
                    setInvoices={setInvoices} 
                    user={user} 
                    targetInvoiceId={targetInvoiceId}
                    onClearTarget={() => setTargetInvoiceId(null)}
                    isLoading={isDataLoading}
                    businessId={currentBusinessId}
                    onUpdateConfig={handleUpdateConfigPartial}
                  />
                );
                case Tab.INVENTORY: return <Inventory products={products} setProducts={setProducts} config={config!} isLoading={isDataLoading} onNavigate={handleTabChange} businessId={currentBusinessId} invoices={invoices} />;
                case Tab.SETTINGS: return <Settings config={config!} setConfig={updateConfig} onLogout={logout} businessId={currentBusinessId} version={CURRENT_VERSION} isInstallable={isAppInstallable} onInstall={triggerInstallPrompt} />;
                default: return null;
              }
            })()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </PullToRefresh>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-500 ${config?.isDarkMode ? 'bg-slate-950' : 'bg-white'} pb-[95px] md:pb-0`}>
      
      {/* SIDEBAR FOR DESKTOP / LANDSCAPE */}
      {config && (
        <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-slate-900/95 dark:bg-slate-950/95 border-r border-white/5 flex-col py-6 z-[100] text-white">
          <div className="px-6 mb-8 flex flex-col">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => openModal(setShowBusinessSwitcher)}>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white flex items-center justify-center p-0.5 border border-white/10">
                <img 
                  src={config.businessLogo || '/logo.png'} 
                  alt="Logo" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.png';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1">
                  <h1 className="text-sm font-black tracking-tight text-white truncate">{config.shopName}</h1>
                  <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Active Workspace</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6 p-2 bg-white/5 rounded-xl border border-white/5">
              <button 
                onClick={handleRefresh} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-brand-400 transition-colors"
                title="Refresh App"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => openModal(setShowNotifications)}
                className="relative p-1.5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => updateConfig({ ...config, isDarkMode: !config.isDarkMode })} 
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="Toggle Theme"
              >
                {config.isDarkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
              </button>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1.5 flex flex-col">
            <SidebarNavItem active={activeTab === Tab.DASHBOARD} onClick={() => handleTabChange(Tab.DASHBOARD)} icon={<DashboardIcon active={activeTab === Tab.DASHBOARD} className="w-5 h-5" />} label={t.dashboard} />
            <SidebarNavItem active={activeTab === Tab.BILLING} onClick={() => handleTabChange(Tab.BILLING)} icon={<ReceiptIndianRupee className="w-5 h-5" />} label={t.billing} />
            <SidebarNavItem active={activeTab === Tab.INVENTORY} onClick={() => handleTabChange(Tab.INVENTORY)} icon={<PackageSearch className="w-5 h-5" />} label={t.inventory} />
            <SidebarNavItem active={activeTab === Tab.INVOICES} onClick={() => handleTabChange(Tab.INVOICES)} icon={<Clock7 className="w-5 h-5" />} label={t.invoices} />
            <SidebarNavItem active={activeTab === Tab.SETTINGS} onClick={() => handleTabChange(Tab.SETTINGS)} icon={<UserCircle2 className="w-5 h-5" />} label={t.settings} />
          </nav>
          
          <div className="px-4 mt-auto border-t border-white/5 pt-4 flex flex-col gap-3">
            <div className="px-2 flex flex-col gap-0.5 text-[10px] text-slate-400">
              <span className="font-black text-white tracking-widest uppercase">BILLMAX</span>
              <span className="text-[9px] text-slate-500 font-bold leading-none">A Product of <span className="text-brand-400 font-bold">JAISLINC</span></span>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-bold text-xs transition-colors"
            >
              <LogOut className="w-4 h-4" />
              LOG OUT
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        
        {/* Mobile-Only Header Row */}
        {config && activeTab === Tab.DASHBOARD && !showGlobalClientSelector && !showPendingLedger && !isRevenueDetailOpen && (
          <header className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-3 md:hidden animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center max-w-lg mx-auto w-full">
              <div 
                onClick={() => openModal(setShowBusinessSwitcher)}
                className="flex flex-col cursor-pointer active:scale-95 transition-all"
              >
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">{config.shopName}</h1>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Active Workspace</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleRefresh} 
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all active:scale-90 border border-transparent dark:border-slate-700 text-brand-500"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openModal(setShowNotifications)}
                  className="relative p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all active:scale-90 border border-transparent dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </button>
                <button onClick={() => updateConfig({ ...config, isDarkMode: !config.isDarkMode })} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all active:scale-90 border border-transparent dark:border-slate-700">
                  {config.isDarkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                </button>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 max-w-lg md:max-w-4xl lg:max-w-6xl landscape:max-w-4xl landscape:md:max-w-4xl landscape:lg:max-w-6xl mx-auto w-full px-4 pt-5 pb-10">
          <Suspense fallback={null}>
            {renderView()}
          </Suspense>
        </main>
      </div>

      {showGlobalClientSelector && (
        <Suspense fallback={null}>
          <ClientSelector 
            clients={clients}
            setClients={setClients}
            invoices={invoices}
            setInvoices={setInvoices}
            config={config!}
            onClose={() => setShowGlobalClientSelector(false)}
            title="Clients Ledger"
            businessId={currentBusinessId}
            onSelect={(client) => {
              setSelectedClientForBilling(client);
              handleTabChange(Tab.BILLING);
            }}
          />
        </Suspense>
      )}

      {showPendingLedger && config && (
        <Suspense fallback={null}>
          <PendingLedger 
            clients={clients}
            setClients={setClients}
            invoices={invoices}
            setInvoices={setInvoices}
            config={config}
            onClose={() => setShowPendingLedger(false)}
            businessId={currentBusinessId}
          />
        </Suspense>
      )}

      {showBusinessSwitcher && config && (
        <Suspense fallback={null}>
          <BusinessSwitcher 
            isOpen={showBusinessSwitcher}
            onClose={() => setShowBusinessSwitcher(false)}
            currentBusinessId={currentBusinessId}
            onSelect={setCurrentBusinessId}
            onAddNew={() => {
              setShowBusinessSwitcher(false);
              setShowNewBusinessSetup(true);
            }}
            onEdit={(biz) => {
              // For now, edit just switches and opens settings
              setCurrentBusinessId(biz.id);
              setShowBusinessSwitcher(false);
              handleTabChange(Tab.SETTINGS);
            }}
            config={config}
            onQuickAdd={handleQuickAddBusiness}
            isAdding={isQuickAdding}
          />
        </Suspense>
      )}

      {showNotifications && config && (
        <Suspense fallback={null}>
          <NotificationCenter
            products={products}
            invoices={invoices}
            config={config}
            onNavigate={(tab, targetId) => {
              setShowNotifications(false);
              handleTabChange(tab);
              if (targetId && tab === Tab.INVOICES) {
                setTargetInvoiceId(targetId);
              }
            }}
            onClose={() => setShowNotifications(false)}
          />
        </Suspense>
      )}

      <ToastContainer />

      <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none md:hidden">
        <div className="pointer-events-auto">
          <div className="bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-white/10 flex justify-between items-center px-1 h-16 sm:px-6">
            <NavItem active={activeTab === Tab.DASHBOARD} onClick={() => handleTabChange(Tab.DASHBOARD)} icon={<DashboardIcon active={activeTab === Tab.DASHBOARD} className="w-5 h-5" />} label={t.dashboard} />
            <NavItem active={activeTab === Tab.BILLING} onClick={() => handleTabChange(Tab.BILLING)} icon={<ReceiptIndianRupee className="w-5 h-5" />} label={t.billing} ariaLabel="Billing" />
            <NavItem active={activeTab === Tab.INVENTORY} onClick={() => handleTabChange(Tab.INVENTORY)} icon={<PackageSearch className="w-5 h-5" />} label={t.inventory} />
            <NavItem active={activeTab === Tab.INVOICES} onClick={() => handleTabChange(Tab.INVOICES)} icon={<Clock7 className="w-5 h-5" />} label={t.invoices} />
            <NavItem active={activeTab === Tab.SETTINGS} onClick={() => handleTabChange(Tab.SETTINGS)} icon={<UserCircle2 className="w-5 h-5" />} label={t.settings} />
          </div>
        </div>
      </nav>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label, ariaLabel }: any) => (
  <button 
    onClick={onClick} 
    aria-label={ariaLabel}
    className="relative flex flex-col items-center justify-center flex-1 h-full outline-none group cursor-pointer"
  >
    <AnimatePresence>
      {active && (
        <motion.div 
          layoutId="nav-bg"
          className="absolute inset-x-1.5 inset-y-0.5 bg-white/10 rounded-xl z-0"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
        />
      )}
    </AnimatePresence>
    
    <motion.div 
      animate={{ 
        y: active ? -1 : 0,
        scale: active ? 1.1 : 1
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}
    >
      {icon}
    </motion.div>
    
    <AnimatePresence mode="wait">
      {active && (
        <motion.span 
          initial={{ opacity: 0, scale: 0.8, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 2 }}
          className="relative z-10 text-[9px] font-black uppercase tracking-tighter text-white/90 mt-0.5"
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>

      {active && (
      <motion.div 
        layoutId="nav-glow"
        className="absolute top-0 w-8 h-1 bg-brand-500 rounded-full z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
    )}
  </button>
);

const SidebarNavItem = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick} 
    className="relative w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all duration-300 group outline-none cursor-pointer z-10"
  >
    <AnimatePresence>
      {active && (
        <motion.div 
          layoutId="sidebar-nav-bg"
          className="absolute inset-0 bg-white/10 rounded-2xl z-0 border border-white/5"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
    </AnimatePresence>
    
    <div className={`relative z-10 transition-transform duration-300 ${active ? 'scale-110 text-white' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-105'}`}>
      {icon}
    </div>
    
    <span className={`relative z-10 text-xs font-bold tracking-wide transition-colors duration-300 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
      {label}
    </span>
    
    {active && (
      <motion.div 
        layoutId="sidebar-nav-glow"
        className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
    )}
  </button>
);

export default App;
