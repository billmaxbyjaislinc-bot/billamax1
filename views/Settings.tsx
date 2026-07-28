
import React, { useState } from 'react';
import { 
  Shield, 
  Trash2, 
  HelpCircle, 
  Info,
  AlertCircle,
  ChevronRight,
  Camera,
  PenTool,
  Palette,
  Check,
  Moon,
  Sun,
  Lock,
  Globe,
  Settings2,
  Pencil,
  Plus,
  Minus,
  Image as ImageIcon,
  LogOut,
  Key,
  Mail,
  Loader2,
  X as XIcon,
  FileEdit,
  Volume2,
  Play,
  ArrowLeft,
  Users,
  Contact,
  Bell,
  BellRing,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { AppConfig, InvoiceTheme, Client } from '../types';
import { safeFetchJson } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { requestNotificationPermission, getNotificationPermissionStatus, triggerWebNotification, playNotificationSound, showToast } from '../utils/notifications';
import { fileToBase64 } from '../utils/helpers';
import SignaturePad from '../components/SignaturePad';
import InvoiceSettings from '../components/InvoiceSettings';

import { ShopIcon } from '../components/ShopIcon';
import { RotateCcw } from 'lucide-react';

const DEFAULT_WELCOME_SCRIPT = `नमस्ते! [shop] में आपका स्वागत है। हमें आज आपकी सेवा करके और आपसे मिलकर बहुत खुशी हुई। [client], आपकी डिजिटल इनवॉइस सफलता पूर्वक तैयार कर दी गई है। आपका कुल बिल [amount] रुपये है। हम आशा करते हैं कि आपको हमारी सेवा पसंद आई होगी। बिलमैक्स टीम और [shop] की तरफ से हम आपकी अगली यात्रा का बहुत ही उत्सुकता से इंतज़ार करेंगे। आपके विश्वास और सहयोग के लिए हम आपके आभारी हैं। हमारे साथ खरीदारी करने के लिए आपका दिल से बहुत-बहुत धन्यवाद। आपका दिन मंगलमय, सुखद और बहुत ही शुभ हो। नमस्ते! फिर मिलेंगे!`;
const DEFAULT_REMINDER_SCRIPT = `[shop] में आपका [amount] रुपये बकाया शेष है। कृपया जल्द से जल्द भुगतान सुनिश्चित करें। धन्यवाद!`;

interface SettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  onLogout: () => void;
  businessId: string;
  version?: string;
  isInstallable?: boolean;
  onInstall?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, onLogout, businessId, version = '1.8.0', isInstallable, onInstall }) => {
  const t = getTranslation(config?.language || 'hinglish');
  const [showSignPad, setShowSignPad] = useState(false);
  const [showInvoiceSettings, setShowInvoiceSettings] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState({ 
    shopName: config.shopName, 
    ownerName: config.ownerName,
    shopAddress: config.shopAddress || '',
    gstNumber: config.gstNumber || ''
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [pinStep, setPinStep] = useState<'NEW_PIN' | 'OTP'>('NEW_PIN');
  const [newPin, setNewPin] = useState('');
  const [otp, setOtp] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [otpError, setOtpError] = useState('');

  useEffect(() => {
    const handlePopState = () => {
      if (showInvoiceSettings) setShowInvoiceSettings(false);
      if (showSignPad) setShowSignPad(false);
      if (showLanguageModal) setShowLanguageModal(false);
      if (showPinModal) {
        setShowPinModal(false);
        setPinStep('NEW_PIN');
        setNewPin('');
        setOtp('');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showInvoiceSettings, showSignPad, showLanguageModal, showPinModal]);

  const openModal = (setter: (v: boolean) => void) => {
    setter(true);
    window.history.pushState({ ...window.history.state, sub: true }, '');
  };

  const sendOtp = async () => {
    if (newPin.length !== 4) return alert("PIN must be 4 digits");
    setIsProcessing(true);
    try {
      const email = auth.currentUser?.email;
      const { ok } = await safeFetchJson('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (ok) {
        setPinStep('OTP');
      } else {
        alert("Failed to send OTP. Please try again.");
      }
    } catch (err: any) {
      alert(err.message || "Network error. Check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyOtpAndSavePin = async () => {
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
        handleUpdate({ pin: newPin });
        alert("Security PIN updated successfully!");
        setShowPinModal(false);
        setNewPin('');
        setOtp('');
        setPinStep('NEW_PIN');
      } else {
        setOtpError(data.error || "Invalid OTP");
      }
    } catch (err: any) {
      setOtpError(err.message || "Verification failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdate = (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
  };

  const saveProfile = () => {
    handleUpdate({ 
      shopName: tempProfile.shopName, 
      ownerName: tempProfile.ownerName,
      shopAddress: tempProfile.shopAddress,
      gstNumber: tempProfile.gstNumber
    });
    setIsEditingProfile(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'qr' | 'logo') => {
     if (e.target.files && e.target.files[0]) {
       const base64 = await fileToBase64(e.target.files[0]);
       if (type === 'qr') handleUpdate({ qrCodeImage: base64 });
       if (type === 'logo') handleUpdate({ businessLogo: base64 });
     }
  };

  const themes = [
    { id: InvoiceTheme.MODERN, name: 'Modern', desc: 'Blue & Bold', color: 'bg-brand-500' },
    { id: InvoiceTheme.CLASSIC, name: 'Classic', desc: 'Tradition B&W', color: 'bg-slate-900' },
    { id: InvoiceTheme.ELEGANT, name: 'Elegant', desc: 'Brand & Dark', color: 'bg-brand-700' },
    { id: InvoiceTheme.MINIMAL, name: 'Minimal', desc: 'Clean & Simple', color: 'bg-slate-400' },
  ];

  const syncPhoneContacts = async () => {
    if (!('contacts' in navigator && typeof (navigator as any).contacts?.select === 'function')) {
      alert("Your browser or app view does not support direct phone contact picking. Please use the Add Customer form or upload contacts.");
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const contacts = await (navigator as any).contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        setIsProcessing(true);
        const user = auth.currentUser;
        if (user) {
          const businessRef = businessId === 'default' 
            ? doc(db, 'users', user.uid) 
            : doc(db, 'users', user.uid, 'businesses', businessId);
          
          let addedCount = 0;
          await Promise.all(contacts.map(async (contact: any) => {
            const name = contact.name?.[0] || 'Unknown';
            const mobile = contact.tel?.[0]?.replace(/[^0-9]/g, '') || '';
            
            if (mobile) {
              const newClient: Client = {
                id: Math.random().toString(36).substring(2, 9),
                name,
                mobile,
                totalBorrowed: 0
              };
              await setDoc(doc(businessRef, 'clients', newClient.id), newClient);
              addedCount++;
            }
          }));
          alert(`${addedCount} contacts synced to your clients list!`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const voices = [
    { id: 'female', label: 'Female', desc: 'Pleasant & Soft' },
    { id: 'male', label: 'Male', desc: 'Bold & Clear' },
    { id: 'classic', label: 'Classic', desc: 'Deep & Slow' },
    { id: 'cheerful', label: 'Cheerful', desc: 'Bright & Fast' },
  ];

  const playPreview = (voiceId: string, isReminder: boolean = false) => {
    window.speechSynthesis.cancel();
    
    let text = isReminder 
      ? (config.reminderGreetingText || DEFAULT_REMINDER_SCRIPT)
      : (config.welcomeGreetingText || DEFAULT_WELCOME_SCRIPT);
    
    // Variable substitution
    text = text
      .replace(/\[shop\]/g, config.shopName)
      .replace(/\[client\]/g, "ग्राहक")
      .replace(/\[amount\]/g, "100");
    
    // Find voices
    const allVoices = window.speechSynthesis.getVoices();
    const isFemale = voiceId === 'female' || voiceId === 'cheerful';
    
    // 1. Try to find a Hindi voice with preferred gender
    let targetVoice = allVoices.find(v => 
      v.lang.startsWith('hi') && 
      (isFemale ? (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google hindi')) : (v.name.toLowerCase().includes('male')))
    );

    // 2. Fallback to any Hindi voice
    if (!targetVoice) {
      targetVoice = allVoices.find(v => v.lang.startsWith('hi'));
    }

    // 3. Fallback to Indian English with preferred gender
    if (!targetVoice) {
      targetVoice = allVoices.find(v => 
        (v.lang.startsWith('en-IN') || v.lang.startsWith('en-in')) && 
        (isFemale ? v.name.toLowerCase().includes('female') : v.name.toLowerCase().includes('male'))
      );
    }

    // 4. Fallback to any Indian English
    if (!targetVoice) {
      targetVoice = allVoices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('en-in'));
    }

    // LANGUAGE BRIDGE: If we picked an English voice, we MUST use Romanized Hindi
    const isHindiVoice = targetVoice?.lang.startsWith('hi');
    let utteranceText = text;

    if (!isHindiVoice) {
      // Very basic transliteration for common terms if no custom text was provided 
      // or if we want to ensure it "sounds" Hindi.
      // For simplicity, if it's an English voice, we'll just try to read whatever is there, 
      // but the user might want perfect Hinglish if it's the default.
      if (text === DEFAULT_WELCOME_SCRIPT || text === DEFAULT_REMINDER_SCRIPT) {
        if (isReminder) {
          utteranceText = `${config.shopName} mein aapka 100 rupaye bakaya hai, kripya bhugtan karein.`;
        } else {
          utteranceText = `Namaste! BillMax mein aapka swagat hai. Aapka bill taiyaar hai. Dhanyawad!`;
        }
      }
    }
    
    const utterance = new SpeechSynthesisUtterance(utteranceText);
    utterance.lang = targetVoice?.lang || 'hi-IN';
    
    if (targetVoice) utterance.voice = targetVoice;

    switch(voiceId) {
      case 'male': utterance.pitch = 0.8; utterance.rate = 1.0; break;
      case 'classic': utterance.pitch = 0.9; utterance.rate = 0.8; break;
      case 'cheerful': utterance.pitch = 1.2; utterance.rate = 1.1; break;
      default: utterance.pitch = 1.1; utterance.rate = 0.9; break;
    }

    window.speechSynthesis.speak(utterance);
  };

  if (showInvoiceSettings) {
    return (
      <InvoiceSettings 
        onClose={() => setShowInvoiceSettings(false)}
        config={config}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Profile Header - Solid Color, No Gradient */}
      <div className={`p-6 rounded-3xl text-white relative overflow-hidden transition-all duration-700 bg-brand-500 border border-brand-400`}>
        <div className="absolute top-6 right-6 z-20">
          {isEditingProfile ? (
            <button onClick={saveProfile} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition-all">
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setIsEditingProfile(true)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition-all">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-transparent rounded-2xl flex items-center justify-center mb-5 backdrop-blur-sm overflow-hidden">
            {config.businessLogo ? (
              <img src={config.businessLogo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="App" 
                  className="w-full h-full object-contain p-2 opacity-50"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const icon = parent.querySelector('.shop-icon-fallback') as HTMLElement;
                      if (icon) icon.classList.remove('hidden');
                    }
                  }}
                />
                <div className="shop-icon-fallback hidden">
                  <ShopIcon className="w-10 h-10" />
                </div>
              </div>
            )}
          </div>
          {isEditingProfile ? (
            <div className="space-y-3 w-full max-w-[200px]">
              <input 
                type="text" 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-bold text-center outline-none focus:bg-white/20"
                value={tempProfile.shopName ?? ''}
                onChange={e => setTempProfile({...tempProfile, shopName: e.target.value})}
                placeholder="Shop Name"
              />
              <input 
                type="text" 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-bold text-center text-xs outline-none focus:bg-white/20"
                value={tempProfile.ownerName ?? ''}
                onChange={e => setTempProfile({...tempProfile, ownerName: e.target.value})}
                placeholder="Owner Name"
              />
              <textarea 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-bold text-center text-[10px] outline-none focus:bg-white/20 min-h-[60px]"
                value={tempProfile.shopAddress ?? ''}
                onChange={e => setTempProfile({...tempProfile, shopAddress: e.target.value})}
                placeholder="Shop Address"
              />
              <input 
                type="text" 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-bold text-center text-[10px] outline-none focus:bg-white/20 uppercase"
                value={tempProfile.gstNumber ?? ''}
                onChange={e => setTempProfile({...tempProfile, gstNumber: e.target.value.toUpperCase()})}
                placeholder="GSTIN (Optional)"
              />
            </div>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none truncate max-w-full px-4">{config.shopName}</h2>
              <div className="flex items-center gap-2 mt-3 opacity-80 max-w-full px-4">
                <p className="text-[9px] font-bold uppercase tracking-widest truncate">{config.ownerName}</p>
                <span className="w-1 h-1 bg-white rounded-full flex-shrink-0"></span>
                <p className="text-[9px] font-bold tracking-widest truncate">+91 {config.shopMobile}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Theme Selection - Dark/Light */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl ${config.isDarkMode ? 'bg-brand-900/40 text-brand-400' : 'bg-brand-50 text-brand-500'}`}>
              {config.isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">{t.appTheme}</h4>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">{t.darkLightMode}</p>
            </div>
          </div>
          <button 
            onClick={() => handleUpdate({ isDarkMode: !config.isDarkMode })}
            className={`w-14 h-8 rounded-full relative transition-all duration-300 ${config.isDarkMode ? 'bg-brand-500' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all transform ${config.isDarkMode ? 'translate-x-7' : 'translate-x-1'}`}>
              <div className="w-full h-full flex items-center justify-center">
                {config.isDarkMode ? <Moon className="w-2.5 h-2.5 text-brand-500" /> : <Sun className="w-2.5 h-2.5 text-slate-400" />}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Invoice Settings Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 space-y-5">
        <div className="grid grid-cols-1 gap-3">
           <button 
             onClick={() => openModal(setShowInvoiceSettings)}
             className="w-full flex items-center justify-between p-4 bg-brand-500 text-white rounded-2xl active:scale-[0.98] transition-all border border-brand-400 group"
           >
             <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-xl"><FileEdit className="w-5 h-5 text-white" /></div>
                <div className="text-left">
                  <p className="font-bold text-xs uppercase tracking-widest text-white">{t.invoiceEditing}</p>
                  <p className="text-[7px] font-bold text-white/60 uppercase tracking-widest mt-0.5">{t.customizeTemplates}</p>
                </div>
             </div>
             <ChevronRight className="w-5 h-5 text-white/40 group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
      </div>

      {/* Media Management */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl"><ImageIcon className="w-5 h-5" /></div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs">{t.businessLogo}</h4>
            </div>
            <label className="text-[9px] font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-500 px-3 py-1.5 rounded-full uppercase cursor-pointer">
              {t.uploadBtn} <input type="file" className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'logo')} />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl"><PenTool className="w-5 h-5" /></div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs">{t.digitalSignature}</h4>
            </div>
            <button onClick={() => openModal(setShowSignPad)} className="text-[9px] font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-500 px-3 py-1.5 rounded-full uppercase">{t.updateBtn}</button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl"><Camera className="w-5 h-5" /></div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs">{t.paymentQrCode}</h4>
            </div>
            <label className="text-[9px] font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-500 px-3 py-1.5 rounded-full uppercase cursor-pointer">
              {t.uploadBtn} <input type="file" className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'qr')} />
            </label>
          </div>
      </div>

      {/* Low Stock Threshold Control */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4 mb-5">
          <div className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-2xl"><AlertCircle className="w-5 h-5" /></div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs">{t.lowStockAlert}</h4>
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">{t.thresholdAdjustment}</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
          <button 
            onClick={() => handleUpdate({ lowStockThreshold: Math.max(0, config.lowStockThreshold - 1) })}
            className="p-2 bg-white dark:bg-slate-700 rounded-xl active:scale-90 transition-all border border-slate-100 dark:border-slate-600"
          >
            <Minus className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{config.lowStockThreshold}</span>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t.itemsCount}</p>
          </div>
          <button 
            onClick={() => handleUpdate({ lowStockThreshold: config.lowStockThreshold + 1 })}
            className="p-2 bg-white dark:bg-slate-700 rounded-xl active:scale-90 transition-all border border-slate-100 dark:border-slate-600"
          >
            <Plus className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* Notifications & Device Alerts Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-2xl">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">Notifications & Device Alerts</h4>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">नोटीफिकेशन सेटिंग्स</p>
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await requestNotificationPermission();
              if (res === 'granted') {
                handleUpdate({ enableNotifications: true });
                showToast('Phone Notifications Active! 🔔', 'success');
              } else {
                showToast('Notification permission not granted', 'warning');
              }
            }}
            className="text-[9px] font-black bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Bell className="w-3.5 h-3.5" /> Enable Push
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Low Stock Warning Alerts</p>
              <p className="text-[9px] text-slate-400 font-medium">Get notified when product stock drops below threshold</p>
            </div>
            <button
              onClick={() => handleUpdate({ enableLowStockAlerts: config.enableLowStockAlerts !== false ? false : true })}
              className={`w-12 h-7 rounded-full relative transition-all duration-300 ${config.enableLowStockAlerts !== false ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all transform ${config.enableLowStockAlerts !== false ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Pending Due & Borrow Reminders</p>
              <p className="text-[9px] text-slate-400 font-medium">Automatic alerts for client unpaid balances</p>
            </div>
            <button
              onClick={() => handleUpdate({ enablePaymentReminders: config.enablePaymentReminders !== false ? false : true })}
              className={`w-12 h-7 rounded-full relative transition-all duration-300 ${config.enablePaymentReminders !== false ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all transform ${config.enablePaymentReminders !== false ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <button
            onClick={() => {
              playNotificationSound();
              triggerWebNotification('BillMax Notification Test', 'Aapka alert system bilkul ready hai!');
              showToast('Test Notification Sound & Chime Sent! 🔔', 'success', false);
            }}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Volume2 className="w-3.5 h-3.5 text-brand-500" /> Test Notification Sound & Push
          </button>
        </div>
      </div>

      {/* Audio Greeting Toggle */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl ${config.enableAudioGreeting ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">{t.audioGreeting}</h4>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">{t.voiceOnInvoice}</p>
            </div>
          </div>
          <button 
            onClick={() => handleUpdate({ enableAudioGreeting: !config.enableAudioGreeting })}
            className={`w-14 h-8 rounded-full relative transition-all duration-300 ${config.enableAudioGreeting ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all transform ${config.enableAudioGreeting ? 'translate-x-7' : 'translate-x-1'}`}>
              <div className="w-full h-full flex items-center justify-center">
                {config.enableAudioGreeting ? <Volume2 className="w-2.5 h-2.5 text-emerald-500" /> : <Play className="w-2.5 h-2.5 text-slate-400" />}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl"><Users className="w-5 h-5" /></div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-widest">{t.dataSync}</h4>
        </div>
        <div className="space-y-3">
          <button 
            onClick={syncPhoneContacts}
            disabled={isProcessing}
            className="w-full flex items-center justify-between p-4 bg-brand-50 dark:bg-brand-900/20 rounded-2xl active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-400 rounded-xl">
                <Contact className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 dark:text-white text-xs">{t.importPhoneContacts}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t.quickBulkSync}</p>
              </div>
            </div>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-brand-500" /> : <Plus className="w-4 h-4 text-brand-500" />}
          </button>
        </div>
      </div>

      {/* PWA Install Block */}
      {isInstallable && onInstall && (
        <div className="bg-gradient-to-br from-brand-50 to-indigo-50 dark:from-indigo-950/20 dark:to-brand-950/20 rounded-3xl p-5 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-brand-500 text-white rounded-2xl shadow-md"><Globe className="w-5 h-5" /></div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">{t.runAsMobileApp}</h4>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{t.installHomeScreen}</p>
            </div>
          </div>
          <button 
            onClick={onInstall}
            className="text-[9px] font-black bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-full uppercase active:scale-95 transition-all shadow-sm flex-shrink-0 border border-brand-400"
          >
            {t.installButton}
          </button>
        </div>
      )}

      {/* Security */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl"><Settings2 className="w-5 h-5" /></div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-widest">{t.settingsHeader}</h4>
        </div>
        <div className="space-y-2">
          <SettingItem 
            icon={<Lock className="w-4 h-4" />} 
            bg="bg-slate-100 dark:bg-slate-800 text-slate-500"
            label={t.securityPinSettings}
            onClick={() => openModal(setShowPinModal)}
          />
          <SettingItem 
            icon={<Globe className="w-4 h-4" />} 
            bg="bg-slate-100 dark:bg-slate-800 text-slate-500"
            label={t.changeLanguage}
            onClick={() => openModal(setShowLanguageModal)}
          />
          <SettingItem 
            icon={<Info className="w-4 h-4" />} 
            bg="bg-slate-100 dark:bg-slate-800 text-slate-500"
            label="Replay Walkthrough"
            onClick={() => {
              try {
                localStorage.removeItem('hasCompletedOnboarding');
              } catch {}
              window.location.reload();
            }}
          />
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 p-4 text-red-500 font-bold text-[11px] bg-red-50 dark:bg-red-900/10 rounded-2xl active:scale-95 transition-all mt-4 border border-red-100 dark:border-red-900/20"
          >
            <LogOut className="w-4 h-4" /> {t.logout}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-2 py-8 mt-6 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900 dark:text-white">BILLMAX</p>
        <p className="text-[9px] text-slate-500 font-bold leading-tight">
          A Premium Product of <span className="text-brand-500 font-black">JAISLINC</span>
        </p>
        <p className="text-[7px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest mt-1">Version {version} • Made in India</p>
      </div>

      {showSignPad && (
        <SignaturePad 
          onSave={(base64) => { handleUpdate({ signatureImage: base64 }); setShowSignPad(false); }}
          onCancel={() => setShowSignPad(false)}
        />
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-[320px] bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 relative">
            <button 
              onClick={() => { setShowPinModal(false); setPinStep('NEW_PIN'); setNewPin(''); setOtp(''); }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                {pinStep === 'NEW_PIN' ? <Key className="w-8 h-8 text-brand-500" /> : <Mail className="w-8 h-8 text-brand-500" />}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {pinStep === 'NEW_PIN' ? 'Set New PIN' : 'Verify Email'}
              </h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                {pinStep === 'NEW_PIN' ? 'Choose a 4-digit code' : `OTP sent to ${auth.currentUser?.email?.slice(0, 3)}***@***`}
              </p>
            </div>

            {pinStep === 'NEW_PIN' ? (
              <div className="space-y-6">
                <input 
                  type="password"
                  maxLength={4}
                  placeholder="0000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-center text-2xl font-black tracking-[0.8em] outline-none focus:ring-2 ring-brand-500/20 text-slate-900 dark:text-white"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
                <button 
                  onClick={sendOtp}
                  disabled={newPin.length !== 4 || isProcessing}
                  className="w-full bg-brand-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 border border-brand-400"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : 'Request OTP'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <input 
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-center text-2xl font-black tracking-[0.4em] outline-none focus:ring-2 ring-brand-500/20 text-slate-900 dark:text-white"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
                {otpError && <p className="text-red-500 text-[9px] font-bold text-center uppercase tracking-widest">{otpError}</p>}
                <button 
                  onClick={verifyOtpAndSavePin}
                  disabled={otp.length !== 6 || isProcessing}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 border border-emerald-500"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : 'Verify & Save'}
                </button>
                <button 
                  onClick={() => setPinStep('NEW_PIN')}
                  className="w-full text-slate-400 text-[9px] font-bold uppercase tracking-widest"
                >
                  Back to PIN
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showLanguageModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-[320px] bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 relative">
            <button 
              onClick={() => setShowLanguageModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-brand-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.changeLanguage}
              </h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                {t.preferredLanguage}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {(['en', 'hi', 'hinglish'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    // Determine new greetings if changing language
                    let welcomeText = '';
                    let reminderText = '';
                    if (lang === 'en') {
                      welcomeText = "Welcome! Thank you for visiting [shop]. We are delighted to serve you. [client], your digital invoice has been successfully generated. Your total bill is Rs. [amount]. We hope you enjoyed our service. Thank you for your support, and have a wonderful day! Please visit us again.";
                      reminderText = "This is a payment reminder from [shop]. You have a pending balance of Rs. [amount]. Please clear it at your earliest convenience. Thank you!";
                    } else if (lang === 'hi') {
                      welcomeText = "नमस्ते! [shop] में आपका स्वागत है। हमें आज आपकी सेवा करके और आपसे मिलकर बहुत खुशी हुई। [client], आपकी डिजिटल इनवॉइस सफलता पूर्वक तैयार कर दी गई है। आपका कुल बिल [amount] रुपये है। हम आशा करते हैं कि आपको हमारी सेवा पसंद आई होगी। बिलमैक्स टीम और [shop] की तरफ से हम आपकी अगली यात्रा का बहुत ही उत्सुकता से इंतज़ार करेंगे। आपके विश्वास और सहयोग के लिए हम आपके आभारी हैं। हमारे साथ खरीदारी करने के लिए आपका दिल से बहुत-बहुत धन्यवाद। आपका दिन मंगलमय, सुखद और बहुत ही शुभ हो। नमस्ते! फिर मिलेंगे!";
                      reminderText = "[shop] में आपका [amount] रुपये बकाया शेष है। कृपया जल्द से जल्द भुगतान सुनिश्चित करें। धन्यवाद!";
                    } else { // hinglish
                      welcomeText = "Namaste! [shop] mein aapka swagat hai. Humein aaj aapki seva karke aur aap se milkar bahut khushi hui. [client], aapki digital invoice successfully taiyaar kar di gayi hai. Aapka total bill [amount] rupaye hai. Hum aasha karte hain ki aapko hamari service pasand aayi hogi. Billmax team aur [shop] ki taraf se hum aapki next visit ka wait karenge. Aapke trust aur support ke liye hum aapke grateful hain. Hamare sath shopping karne ke liye aapka dil se bahut-bahut dhanyawad. Aapka din shubh aur mangalmay ho. Namaste! Phir milenge!";
                      reminderText = "[shop] mein aapka [amount] rupaye balance pending hai. Please jaldi se jaldi payment clear karein. Dhanyawad!";
                    }

                    handleUpdate({ 
                      language: lang,
                      welcomeGreetingText: welcomeText,
                      reminderGreetingText: reminderText
                    });
                    setShowLanguageModal(false);
                  }}
                  className={`py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border ${
                    (config.language || 'hinglish') === lang
                      ? 'bg-brand-500 text-white border-brand-400 shadow-md shadow-brand-500/10'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi (हिन्दी)' : 'Hinglish'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingItem: React.FC<{ icon: React.ReactNode, bg: string, label: string, onClick: () => void }> = ({ icon, bg, label, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl active:scale-[0.98] transition-all group"
  >
    <div className="flex items-center gap-4">
      <div className={`p-2 ${bg} rounded-xl`}>{icon}</div>
      <p className="font-bold text-slate-900 dark:text-white text-xs">{label}</p>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-300" />
  </button>
);

export default Settings;
