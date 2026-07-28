
import React, { useState } from 'react';
import { Camera, ShieldCheck, User, Phone, PenTool, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Loader2, X, Languages, Globe } from 'lucide-react';
import { ShopIcon } from './ShopIcon';
import { motion, AnimatePresence } from 'motion/react';
import { AppConfig } from '../types';
import { fileToBase64 } from '../utils/helpers';
import SignaturePad from './SignaturePad';
import { getTranslation } from '../utils/translations';

interface SetupProps {
  onComplete: (config: AppConfig) => void;
  onCancel?: () => void;
}

enum SetupStep {
  LANGUAGE = 0,
  MOBILE = 1,
  SHOP_NAME = 2,
  SHOP_ADDRESS = 3,
  OWNER_NAME = 4,
  PIN = 5,
  ASSETS = 6
}

const Setup: React.FC<SetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<SetupStep>(SetupStep.LANGUAGE);
  const [formData, setFormData] = useState({
    language: 'hinglish',
    ownerName: '',
    shopName: '',
    shopAddress: '',
    shopMobile: '',
    gstNumber: '',
    pin: '',
    confirmPin: '',
    lowStockThreshold: 5,
    isDarkMode: false,
    isAdminMode: false
  });
  const [signature, setSignature] = useState<string>('');
  const [businessLogo, setBusinessLogo] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [error, setError] = useState('');
  const [showSignPad, setShowSignPad] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'qr' | 'logo') => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      if (type === 'qr') setQrCode(base64);
      else setBusinessLogo(base64);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === SetupStep.LANGUAGE && !formData.language) {
      setError('Please select a language');
      return;
    }
    if (step === SetupStep.MOBILE && !formData.shopMobile.match(/^[0-9]{10}$/)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (step === SetupStep.SHOP_NAME && !formData.shopName.trim()) {
      setError('Shop name is required');
      return;
    }
    if (step === SetupStep.SHOP_ADDRESS && !formData.shopAddress.trim()) {
      setError('Shop address is required');
      return;
    }
    if (step === SetupStep.OWNER_NAME && !formData.ownerName.trim()) {
      setError('Owner name is required');
      return;
    }
    if (step === SetupStep.PIN) {
      if (formData.pin.length !== 4) {
        setError('PIN must be 4 digits');
        return;
      }
      if (formData.pin !== formData.confirmPin) {
        setError('PINs do not match');
        return;
      }
    }
    
    if (step < SetupStep.ASSETS) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!signature) {
      setError('Please draw your signature');
      return;
    }

    setIsProcessing(true);
    try {
      const { confirmPin, isAdminMode, ...configData } = formData;
      
      // Determine default greeting texts based on selected language
      let welcomeText = '';
      let reminderText = '';
      if (formData.language === 'en') {
        welcomeText = "Welcome! Thank you for visiting [shop]. We are delighted to serve you. [client], your digital invoice has been successfully generated. Your total bill is Rs. [amount]. We hope you enjoyed our service. Thank you for your support, and have a wonderful day! Please visit us again.";
        reminderText = "This is a payment reminder from [shop]. You have a pending balance of Rs. [amount]. Please clear it at your earliest convenience. Thank you!";
      } else if (formData.language === 'hi') {
        welcomeText = "नमस्ते! [shop] में आपका स्वागत है। हमें आज आपकी सेवा करके और आपसे मिलकर बहुत खुशी हुई। [client], आपकी डिजिटल इनवॉइस सफलता पूर्वक तैयार कर दी गई है। आपका कुल बिल [amount] रुपये है। हम आशा करते हैं कि आपको हमारी सेवा पसंद आई होगी। बिलमैक्स टीम और [shop] की तरफ से हम आपकी अगली यात्रा का बहुत ही उत्सुकता से इंतज़ार करेंगे। आपके विश्वास और सहयोग के लिए हम आपके आभारी हैं। हमारे साथ खरीदारी करने के लिए आपका दिल से बहुत-बहुत धन्यवाद। आपका दिन मंगलमय, सुखद और बहुत ही शुभ हो। नमस्ते! फिर मिलेंगे!";
        reminderText = "[shop] में आपका [amount] रुपये बकाया शेष है। कृपया जल्द से जल्द भुगतान सुनिश्चित करें। धन्यवाद!";
      } else { // hinglish
        welcomeText = "Namaste! [shop] mein aapka swagat hai. Humein aaj aapki seva karke aur aap se milkar bahut khushi hui. [client], aapki digital invoice successfully taiyaar kar di gayi hai. Aapka total bill [amount] rupaye hai. Hum aasha karte hain ki aapko hamari service pasand aayi hogi. Billmax team aur [shop] ki taraf se hum aapki next visit ka wait karenge. Aapke trust aur support ke liye hum aapke grateful hain. Hamare sath shopping karne ke liye aapka dil se bahut-bahut dhanyawad. Aapka din shubh aur mangalmay ho. Namaste! Phir milenge!";
        reminderText = "[shop] mein aapka [amount] rupaye balance pending hai. Please jaldi se jaldi payment clear karein. Dhanyawad!";
      }

      await onComplete({
        ...configData,
        welcomeGreetingText: welcomeText,
        reminderGreetingText: reminderText,
        signatureImage: signature,
        qrCodeImage: qrCode,
        businessLogo: businessLogo || '/logo.png',
        setupComplete: true,
      } as AppConfig);
    } catch (err) {
      setError('Failed to save configuration. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const t = getTranslation(formData.language);

  const progress = ((step + 1) / (Object.keys(SetupStep).length / 2)) * 100;

  const renderIllustration = (icon: React.ReactNode, color: string) => (
    <motion.div 
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center mx-auto mb-2.5 border border-brand-500/10 relative overflow-hidden`}
    >
      <motion.div>
        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5 text-brand-500 dark:text-brand-400" })}
      </motion.div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center py-2 px-4 relative overflow-y-auto no-scrollbar">
      {onCancel && (
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="w-full max-w-[280px] py-2">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t.step} {step + 1} {t.of} 7</span>
            <span className="text-[8px] font-bold text-brand-500 uppercase tracking-[0.2em]">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-brand-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mb-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 rounded-lg text-[8px] font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-2.5 h-2.5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {step === SetupStep.LANGUAGE && (
              <div className="space-y-3">
                {renderIllustration(<Languages />, "bg-brand-50 dark:bg-brand-900/30")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.chooseLanguage}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.preferredLanguage}</p>
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, language: 'en'})}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${formData.language === 'en' ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-brand-500'}`}
                  >
                    <div>
                      <h4 className="font-bold text-xs">English</h4>
                      <p className={`text-[8px] uppercase tracking-wider font-bold mt-0.5 ${formData.language === 'en' ? 'text-white/70' : 'text-slate-400'}`}>Use English throughout the app</p>
                    </div>
                    {formData.language === 'en' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({...formData, language: 'hi'})}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${formData.language === 'hi' ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-brand-500'}`}
                  >
                    <div>
                      <h4 className="font-bold text-xs">हिन्दी (Hindi)</h4>
                      <p className={`text-[8px] uppercase tracking-wider font-bold mt-0.5 ${formData.language === 'hi' ? 'text-white/70' : 'text-slate-400'}`}>ऐप में हिन्दी भाषा का उपयोग करें</p>
                    </div>
                    {formData.language === 'hi' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({...formData, language: 'hinglish'})}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${formData.language === 'hinglish' ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-brand-500'}`}
                  >
                    <div>
                      <h4 className="font-bold text-xs">Hinglish</h4>
                      <p className={`text-[8px] uppercase tracking-wider font-bold mt-0.5 ${formData.language === 'hinglish' ? 'text-white/70' : 'text-slate-400'}`}>English script me likhi hui Hindi</p>
                    </div>
                    {formData.language === 'hinglish' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
              </div>
            )}

            {step === SetupStep.MOBILE && (
              <div className="space-y-3">
                {renderIllustration(<Phone />, "bg-brand-50 dark:bg-brand-900/30")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.whatsYourNumber}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.numberSub}</p>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone className="w-3.5 h-3.5" /></div>
                  <input 
                    type="tel"
                    placeholder="10 digit mobile number"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none transition-all font-bold text-xs text-slate-900 dark:text-white"
                    value={formData.shopMobile}
                    onChange={e => setFormData({...formData, shopMobile: e.target.value.replace(/[^0-9]/g, '').slice(0, 10)})}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === SetupStep.SHOP_NAME && (
              <div className="space-y-3">
                {renderIllustration(<ShopIcon />, "bg-brand-50 dark:bg-brand-900/30")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.shopNameLabel}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.shopNameSub}</p>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><ShopIcon className="w-3.5 h-3.5" /></div>
                  <input 
                    type="text"
                    placeholder="e.g. BillMax General Store"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none transition-all font-bold text-xs text-slate-900 dark:text-white"
                    value={formData.shopName}
                    onChange={e => setFormData({...formData, shopName: e.target.value})}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === SetupStep.SHOP_ADDRESS && (
              <div className="space-y-3">
                {renderIllustration(<ShopIcon />, "bg-brand-50 dark:bg-brand-900/30")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.addressAndGst}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.professionalInvoice}</p>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <textarea 
                      placeholder="Enter Shop Address"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none transition-all font-bold text-xs text-slate-900 dark:text-white min-h-[55px]"
                      value={formData.shopAddress}
                      onChange={e => setFormData({...formData, shopAddress: e.target.value})}
                      autoFocus
                    />
                  </div>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="GSTIN (Optional)"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none transition-all font-bold text-xs text-slate-900 dark:text-white uppercase"
                      value={formData.gstNumber}
                      onChange={e => setFormData({...formData, gstNumber: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === SetupStep.OWNER_NAME && (
              <div className="space-y-3">
                {renderIllustration(<User />, "bg-brand-50 dark:bg-brand-900/30")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.whoAreYou}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.ownerNameSub}</p>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User className="w-3.5 h-3.5" /></div>
                  <input 
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none transition-all font-bold text-xs text-slate-900 dark:text-white"
                    value={formData.ownerName}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === SetupStep.PIN && (
              <div className="space-y-3">
                {renderIllustration(<ShieldCheck />, "bg-brand-50 dark:bg-brand-900/30")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.secureYourApp}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.createPinSub}</p>
                </div>
                <div className="space-y-1.5">
                  <input 
                    type="password"
                    maxLength={4}
                    placeholder="Set PIN"
                    className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none text-center tracking-[0.8em] font-black text-sm text-slate-900 dark:text-white"
                    value={formData.pin}
                    onChange={e => setFormData({...formData, pin: e.target.value.replace(/[^0-9]/g, '')})}
                    autoFocus
                  />
                  <input 
                    type="password"
                    maxLength={4}
                    placeholder="Confirm PIN"
                    className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-brand-500 rounded-xl outline-none text-center tracking-[0.8em] font-black text-sm text-slate-900 dark:text-white"
                    value={formData.confirmPin}
                    onChange={e => setFormData({...formData, confirmPin: e.target.value.replace(/[^0-9]/g, '')})}
                  />
                </div>
              </div>
            )}

            {step === SetupStep.ASSETS && (
              <div className="space-y-3">
                {renderIllustration(<Sparkles />, "bg-brand-50 dark:bg-brand-500/10")}
                <div className="text-center">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-0.5">{t.finalTouches}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-[9px] font-medium leading-tight">{t.logoSignSub}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-center block">{t.drawSign}</label>
                    <button 
                      type="button"
                      onClick={() => setShowSignPad(true)}
                      className="w-full h-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-0.5 overflow-hidden group hover:border-brand-500 transition-colors"
                    >
                      {signature ? (
                        <img src={signature} alt="Sign" className="w-full h-full object-contain p-1" />
                      ) : (
                        <>
                          <PenTool className="w-4 h-4 text-slate-400 group-hover:text-brand-500" />
                          <span className="text-[7px] font-bold text-slate-500 uppercase">{t.drawSign}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-center block">{t.addLogo}</label>
                    <label className="w-full h-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-0.5 overflow-hidden group hover:border-brand-500 transition-colors cursor-pointer">
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                      {businessLogo ? (
                        <img src={businessLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-slate-400 group-hover:text-brand-500" />
                          <span className="text-[7px] font-bold text-slate-500 uppercase">{t.addLogo}</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3.5 flex gap-1.5">
              {step > 0 && (
                <button 
                  onClick={prevStep}
                  className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg active:scale-90 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button 
                onClick={nextStep}
                disabled={isProcessing}
                className="flex-1 bg-brand-500 text-white py-2 rounded-lg font-black text-[8px] uppercase tracking-[0.2em] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  step === SetupStep.ASSETS ? (
                    <>{t.finish} <CheckCircle2 className="w-3 h-3" /></>
                  ) : (
                    <>{t.continue} <ArrowRight className="w-3 h-3" /></>
                  )
                )}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {showSignPad && (
        <SignaturePad 
          onSave={(base64) => { setSignature(base64); setShowSignPad(false); }}
          onCancel={() => setShowSignPad(false)}
        />
      )}
    </div>
  );
};

export default Setup;
