
import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Invoice, AppConfig, InvoiceTheme } from '../types';
import { numberToWords } from '../utils/helpers';
import { Loader2, AlertCircle, Phone, Download, Volume2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { safeHtml2Canvas } from '../utils/pdfSafe';
import { jsPDF } from 'jspdf';

interface PublicInvoiceProps {
  uid: string;
  invoiceId: string;
  businessId: string;
}

const PublicInvoice: React.FC<PublicInvoiceProps> = ({ uid, invoiceId, businessId }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [shopConfig, setShopConfig] = useState<Partial<AppConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const invoiceContentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState<number>(0.4); 
  const [scaleReady, setScaleReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!loading && !error && invoice && !isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, loading, error, invoice]);

  useEffect(() => {
    if (loading) return;

    const updateScale = () => {
      try {
        if (containerRef.current) {
          const winWidth = window.innerWidth;
          const docWidth = document.documentElement.clientWidth;
          const containerWidth = containerRef.current.offsetWidth || docWidth || winWidth;
          
          const targetWidth = 800;
          // Substantial padding to prevent edge cropping on narrow devices
          const isMobile = containerWidth < 640;
          const padding = isMobile ? 80 : 100; 
          const availableWidth = Math.min(containerWidth, winWidth) - padding;
          
          let newScale = availableWidth / targetWidth;
          
          // Clamp scale: never zoom in past 1.0, minimum 0.05
          newScale = Math.max(0.05, Math.min(1, newScale)); 
          
          // Safer mobile limit to prevent layout breaking on narrow devices
          if (isMobile) {
            newScale = Math.min(newScale, 0.36);
          }
          
          console.log('Scaling Debug:', { containerWidth, winWidth, availableWidth, newScale });
          setBaseScale(newScale);
          setScaleReady(true);
        }
      } catch (err) {
        console.error('Scale calculation failed:', err);
        setBaseScale(0.35); // Very safe mobile default
        setScaleReady(true);
      }
    };

    // Multiple triggers to ensure layout is captured
    const timer1 = setTimeout(updateScale, 100);
    const timer2 = setTimeout(updateScale, 500);
    const timer3 = setTimeout(updateScale, 1500);
    updateScale();

    const observer = new ResizeObserver(() => {
      // Debounce slightly to prevent flickering during resize
      requestAnimationFrame(updateScale);
    });
    if (containerRef.current) observer.observe(containerRef.current);
    
    // Also trigger on window resize
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);

    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
      observer.disconnect();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [loading]);

  const playGreeting = () => {
    if (!invoice || !shopConfig) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Set loading state to show visual feedback
    setIsAudioLoading(true);
    window.speechSynthesis.cancel();
    
    const shopName = shopConfig.shopName || 'हमारी दुकान';
    const clientName = invoice.clientName || 'प्रिय ग्राहक';
    const pendingAmount = invoice.pendingAmount || 0;
    const paidAmount = invoice.paidAmount || 0;
    const grandTotal = invoice.grandTotal || 0;
    const balanceDue = grandTotal - paidAmount;
    
    const isPartial = paidAmount > 0 && balanceDue > 0;
    const isReminder = balanceDue > 0 && !isPartial;
    
    // Requested scripts
    const PAID_GREETING_HINDI = `${shopName} से खरीदारी करने के लिए धन्यवाद ${clientName} जी, आपका इनवॉइस नीचे उपलब्ध है। आपका दिन शुभ हो।`;
    const PAID_GREETING_ROMAN = `${shopName} se kharidari karne ke liye dhanyvad ${clientName} ji, aapka invoice niche uplabdh hai. Aapka din shubh ho.`;
    
    const PARTIAL_GREETING_HINDI = `${shopName} से खरीदारी करने के लिए आपका धन्यवाद आपका इनवॉइस नीचे उपलब्ध है जिसमें आपने पे किया है ${paidAmount} और आपका बकाया अमाउंट ${balanceDue} है... इसे आप जल्द से जल्द पे करें.. ${shopName} से खरीदारी करने के लिए आपके धन्यवाद ${clientName} जी।`;
    const PARTIAL_GREETING_ROMAN = `${shopName} se kharidari karne ke liye aapka dhanyvad apka invoice niche uplabdh hai jismein aapne pay kiya hai ${paidAmount} aur aapka bkaya amount ${balanceDue} hai... ise aap jald se jald pay karen.. ${shopName} se kharidari karne ke liye apke dhanyawad ${clientName} ji.`;

    const DEFAULT_REMINDER_HINDI = `नमस्ते ${clientName} जी, ${shopName} में आपका ${balanceDue} रुपये बकाया है। कृपया भुगतान पूरा करें। धन्यवाद!`;
    const DEFAULT_REMINDER_ROMAN = `Namaste ${clientName} ji, ${shopName} mein aapka ${balanceDue} rupaye bakaya hai. Kripya bhugtan karein. Dhanyawad!`;

    const allVoices = window.speechSynthesis.getVoices();
    const character = (isReminder || isPartial) ? (shopConfig.reminderGreetingVoice || 'female') : (shopConfig.invoiceGreetingVoice || 'female');
    const isFemalePreferred = character === 'female' || character === 'cheerful';
    
    let targetVoice = allVoices.find(v => v.lang.startsWith('hi') && (isFemalePreferred ? (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google hindi')) : (v.name.toLowerCase().includes('male'))));
    if (!targetVoice) targetVoice = allVoices.find(v => v.lang.startsWith('hi'));

    const isHindiVoice = !!targetVoice;
    
    let utteranceText = "";
    if (isPartial) {
      utteranceText = isHindiVoice ? PARTIAL_GREETING_HINDI : PARTIAL_GREETING_ROMAN;
    } else if (isReminder) {
      utteranceText = isHindiVoice ? DEFAULT_REMINDER_HINDI : DEFAULT_REMINDER_ROMAN;
    } else {
      utteranceText = isHindiVoice ? PAID_GREETING_HINDI : PAID_GREETING_ROMAN;
    }
    
    const utterance = new SpeechSynthesisUtterance(utteranceText);
    utterance.lang = targetVoice?.lang || 'hi-IN';
    if (targetVoice) utterance.voice = targetVoice;
    
    // Adjusted rate for slower, clearer speech
    utterance.rate = 0.8;
    utterance.pitch = character === 'male' ? 0.8 : character === 'cheerful' ? 1.2 : 1.1;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      setIsAudioLoading(false);
      setHasPlayedAudio(true);
    };

    utterance.onend = () => {
      setIsAudioLoading(false);
    };

    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      setIsAudioLoading(false);
    };
    
    try {
      window.speechSynthesis.speak(utterance);
      // Immediately mark as loading/trying
      if (allVoices.length === 0) {
        // If voices were empty, the browser might take a second to speak. 
        // We still call it because lang="hi-IN" might be enough for the default engine.
      }
    } catch (err) {
      console.error('Speak failed:', err);
      setIsAudioLoading(false);
    }
  };

  // --- AUDIO GREETING ROBUST LOGIC ---
  useEffect(() => {
    // Warm up voices as soon as possible, even before loading is finished
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      }
    }
  }, []);

  useEffect(() => {
    if (loading || !invoice || !shopConfig || !shopConfig.enableAudioGreeting || hasPlayedAudio || !isOpen) return;

    const triggerAudio = () => {
      if (hasPlayedAudio) return;
      playGreeting();
    };

    // Attempt autoplay immediately
    triggerAudio();

    // Secondary attempt with minimal delay
    const autoPlayTimer = setTimeout(triggerAudio, 300);

    // Fallback: Play on ANY user interaction
    const handleInteraction = (e: Event) => {
      console.log('Interaction caught:', e.type);
      if (!hasPlayedAudio) {
        // Force synchronous play call in the event loop of the gesture
        playGreeting();
      }
    };

    const cleanup = () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };

    // Use capturing phase and no 'once' to ensure we capture it correctly
    // We will manually cleanup once hasPlayedAudio is true
    window.addEventListener('click', handleInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
    window.addEventListener('mousedown', handleInteraction, { capture: true, passive: true });
    window.addEventListener('pointerdown', handleInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', handleInteraction, { capture: true, passive: true });

    return () => {
      clearTimeout(autoPlayTimer);
      cleanup();
    };
  }, [loading, invoice, shopConfig, hasPlayedAudio, isOpen]);

  // --- AUTOMATIC SCROLL EFFECT ---
  useEffect(() => {
    if (!loading && invoice && scaleReady && isOpen) {
      const scrollTimer = setTimeout(() => {
        // Jump to bottom to show footer/branding
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
        // Smoothly glide back to top
        setTimeout(() => { 
          window.scrollTo({ top: 0, behavior: 'smooth' }); 
        }, 400);
      }, 800);
      return () => clearTimeout(scrollTimer);
    }
  }, [loading, invoice, scaleReady, isOpen]);

  const handleDownloadPDF = async () => {
    if (!invoiceContentRef.current || !invoice) return;
    try {
      setIsDownloading(true);
      
      const element = invoiceContentRef.current;
      const canvas = await safeHtml2Canvas(element, { 
        scale: 2, // 2x scale for crisp text & high printing clarity 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('public-invoice-pdf-content') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.position = 'relative';
            clonedElement.style.left = '0';
            clonedElement.style.top = '0';
            clonedElement.style.margin = '0';
            clonedElement.style.width = '800px';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm for A4

      let heightLeft = pdfHeight;
      let position = 0;

      // Draw the first page image
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Splitting into safe multi-page document spans if it surpasses 297mm height
      while (heightLeft > 0.1) {
         position = position - pageHeight;
         pdf.addPage();
         pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
         heightLeft -= pageHeight;
      }

      const fileName = `Invoice-${invoice.id}.pdf`;
      pdf.save(fileName);
    } catch (err: any) {
      console.error('Error generating/exporting PDF:', err);
      alert('Could not download invoice PDF. Reason: ' + (err?.message || String(err)));
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const safetyTimeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setError('Loading took too long. Please refresh.');
      }
    }, 12000);

    const fetchData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        const cleanUid = uid.trim();
        const cleanInvoiceId = invoiceId.trim();
        const cleanBusinessId = businessId?.trim() || 'default';

        const userRef = doc(db, 'users', cleanUid);
        const businessRef = cleanBusinessId === 'default' ? userRef : doc(userRef, 'businesses', cleanBusinessId);
        
        const invoiceRef = doc(businessRef, 'invoices', cleanInvoiceId);
        const configRef = doc(businessRef, 'config', 'public');

        const [invoiceSnap, configSnap] = await Promise.all([
          getDoc(invoiceRef),
          getDoc(configRef)
        ]);
        
        if (!isMounted) return;

        if (invoiceSnap.exists()) {
          setInvoice(invoiceSnap.data() as Invoice);
          if (configSnap.exists()) {
            setShopConfig(configSnap.data());
          }
        } else {
          setError('This invoice link is invalid or has expired.');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (isMounted) setError('Network error. Please check your internet.');
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(safetyTimeoutId);
        }
      }
    };
    
    if (uid && invoiceId) {
      fetchData();
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeoutId);
    };
  }, [uid, invoiceId, businessId]);

  // Formatting helpers
  const primaryColor = invoice?.invoicePrimaryColor || shopConfig?.invoicePrimaryColor || '#3553CD';
  const theme = invoice?.invoiceTheme || shopConfig?.invoiceTheme || InvoiceTheme.MODERN;
  
  // State checks to prevent crashes
  const items = invoice?.items || [];
  const grandTotal = invoice?.grandTotal || 0;
  const paidAmount = invoice?.paidAmount || 0;
  const subtotal = invoice?.subtotal || 0;

  // Formatted Date
  const formattedDate = React.useMemo(() => {
    try {
      const dateStr = invoice?.date || '';
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  }, [invoice?.date]);

  // Safe Total Words - FIXED: MOVED ABOVE EARLY RETURNS
  const totalInWords = React.useMemo(() => {
    try {
      if (grandTotal === undefined || grandTotal === null || isNaN(grandTotal)) return 'Zero Rupees Only';
      return numberToWords(grandTotal);
    } catch (e) {
      console.warn('numberToWords failed:', e);
      return 'Rupees Only';
    }
  }, [grandTotal]);

  return (
    <div className="relative min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center overflow-x-hidden">
      <div className={`w-full flex-1 flex flex-col items-center transition-all duration-500 ${!isOpen ? 'blur-[16px] pointer-events-none select-none' : ''}`}>
      {/* 1. TOP NAVIGATION */}
      {!loading && !error && invoice && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full bg-white dark:bg-slate-900 border-b px-4 py-3 sticky top-0 z-[100] flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight">{invoice?.id || 'Invoice'}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${(paidAmount >= grandTotal) ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
              {(paidAmount >= grandTotal) ? 'Paid' : 'Unpaid'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <motion.span 
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-[10px] font-black text-brand-500 uppercase tracking-tighter"
              >
                यह दबाएँ
              </motion.span>
              <button 
                onClick={() => playGreeting()} 
                disabled={isAudioLoading}
                className="p-2.5 bg-brand-500 text-white rounded-full active:scale-95 transition-all disabled:opacity-50"
                title="Play Greeting"
              >
                {isAudioLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            </div>
            <button 
              onClick={handleDownloadPDF} 
              disabled={isDownloading} 
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90 transition-all hover:bg-slate-200 self-end"
              title="Download PDF"
            >
              {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
          </div>
        </motion.div>
      )}

      {/* 2. MAIN CONTENT AREA */}
      <div className="w-full flex-1 flex flex-col items-center justify-start py-4">
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 py-40"
          >
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center border border-slate-300">
              <img src="/logo.png" className="w-12 h-12 object-contain" alt="Logo" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col items-center gap-4">
              <img src="/Textbillmax.png" className="h-8 object-contain brightness-0 dark:invert" alt="BillMax" />
              <div className="h-1 w-32 bg-slate-200 dark:bg-white/20 rounded-full overflow-hidden relative">
                <motion.div 
                  className="absolute top-0 left-0 h-full bg-brand-500 dark:bg-white"
                  initial={{ left: "-100%", width: "100%" }}
                  animate={{ left: "100%" }}
                  transition={{ duration: 1.0, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Loading Secure Invoice</p>
            </div>
          </motion.div>
        ) : error || !invoice ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 py-40">
            <AlertCircle className="w-16 h-16 text-brand-500 mb-2" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{error || 'Invoice Not Found'}</h2>
            <p className="text-slate-500 text-sm max-w-xs">This link might be broken or the invoice was deleted.</p>
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-8 py-3 bg-brand-500 text-white rounded-2xl font-black active:scale-95 transition-all mt-4"
            >
              <RefreshCw className="w-4 h-4" /> RETRY
            </button>
          </div>
        ) : (
          <motion.div 
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full flex flex-col items-center px-4"
          >
            {/* Perfectly Centered Scaled Wrapper */}
            <div 
              style={{ 
                width: `${800 * (baseScale || 1)}px`, 
                maxWidth: '96vw', // Slightly more room
                height: `${1131 * (baseScale || 1)}px`,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: 'white'
              }}
              className="rounded-2xl overflow-hidden self-center border border-slate-200"
            >
              <div 
                ref={invoiceContentRef}
                id="public-invoice-pdf-content"
                className="bg-white absolute top-0 left-0 origin-top-left flex flex-col"
                style={{ 
                  width: '800px', 
                  minWidth: '800px',
                  maxWidth: '800px',
                  height: '1131px',
                  minHeight: '1131px',
                  maxHeight: '1131px',
                  transform: `scale(${baseScale || 1})`,
                  transformOrigin: 'top left'
                }}
              >
                {/* Decorative Elements */}
                {(theme === InvoiceTheme.MODERN || theme === InvoiceTheme.CLASSIC) && (
                  <>
                    <OrnateCorner position="top-left" color={primaryColor} />
                    <OrnateCorner position="top-right" color={primaryColor} />
                    <OrnateCorner position="bottom-left" color={primaryColor} />
                    <OrnateCorner position="bottom-right" color={primaryColor} />
                  </>
                )}

                <div className={`m-8 border flex-1 flex flex-col relative z-20 bg-white ${
                  theme === InvoiceTheme.MINIMAL ? 'border-transparent' : 'border-slate-200'
                }`}>
                  
                  {/* Header Row */}
                  <div className={`p-6 flex justify-between items-start border-b-2 ${
                    theme === InvoiceTheme.ELEGANT ? 'flex-col items-center text-center space-y-4' : ''
                  }`} style={{ borderColor: theme === InvoiceTheme.MINIMAL ? 'transparent' : primaryColor }}>
                    <div className={`flex gap-4 ${theme === InvoiceTheme.ELEGANT ? 'flex-col items-center' : ''}`}>
                      {invoice.showLogo !== false && shopConfig?.businessLogo && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                          <img src={shopConfig.businessLogo} alt="Logo" className="w-full h-full object-cover" crossOrigin="anonymous" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <h1 className="text-4xl font-serif font-bold tracking-tight" style={{ color: primaryColor }}>{shopConfig?.shopName || 'Business Name'}</h1>
                        <div className={`flex items-center gap-2 font-bold ${theme === InvoiceTheme.ELEGANT ? 'justify-center' : ''}`} style={{ color: primaryColor }}>
                           <Phone className="w-5 h-5" style={{ fill: primaryColor }} strokeWidth={0} />
                           <span className="text-lg text-slate-700">{shopConfig?.shopMobile}</span>
                        </div>
                      </div>
                    </div>
                    <div className={theme === InvoiceTheme.ELEGANT ? 'w-full' : 'text-right'}>
                      <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: primaryColor }}>TAX INVOICE</h2>
                      <div className="inline-block border border-slate-300 px-3 py-1 mt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">ORIGINAL FOR RECIPIENT</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 border-b border-slate-200">
                    <div className="p-4 border-r border-slate-200 bg-slate-50/20">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Invoice No.</span>
                      <span className="text-sm font-bold text-slate-900">{invoice.id}</span>
                    </div>
                    <div className="p-4 bg-slate-50/20">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Invoice Date</span>
                      <span className="text-sm font-bold text-slate-900">{formattedDate}</span>
                    </div>
                  </div>

                  {/* Billing Grid */}
                  <div className="grid grid-cols-2 border-b border-slate-200">
                    <div className="p-5 border-r border-slate-200 space-y-2 h-full">
                      <p className="text-sm font-black text-slate-900">Bill To</p>
                      <div className="space-y-1">
                        <p className="text-base font-bold text-slate-800 leading-tight">{invoice.clientName || 'Cash Sale'}</p>
                        {invoice.clientAddress && (
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                            {invoice.clientAddress}
                          </p>
                        )}
                        <div className="pt-2 space-y-1">
                          <p className="text-[11px] font-bold text-slate-800">Mobile <span className="ml-1 text-slate-600 font-medium">{invoice.clientMobile || 'Not Provided'}</span></p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 text-[11px] font-medium text-slate-600 bg-slate-50/30 flex justify-end text-right items-start">
                       <div className="max-w-[200px] space-y-1">
                         {shopConfig?.shopAddress && <p>{shopConfig.shopAddress}</p>}
                         {shopConfig?.gstNumber && <p className="font-bold text-slate-900 uppercase">GSTIN: {shopConfig.gstNumber}</p>}
                       </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="flex-1 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#f2efe6] border-b border-slate-300">
                        <tr className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                          <th className="py-2 px-3 border-r border-slate-300 w-10">No</th>
                          <th className="py-2 px-3 border-r border-slate-300">Items</th>
                          <th className="py-2 px-3 border-r border-slate-300 w-24 text-center">Qty.</th>
                          <th className="py-2 px-3 border-r border-slate-300 w-32 text-center">Rate</th>
                          <th className="py-2 px-3 w-32 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="py-4 px-3 text-xs text-slate-700 border-r border-slate-200 align-top">{idx + 1}</td>
                            <td className="py-4 px-3 border-r border-slate-200 align-top">
                              <p className="text-xs font-bold text-slate-900">{item.name}</p>
                            </td>
                            <td className="py-4 px-3 text-xs font-bold text-slate-900 border-r border-slate-200 align-top text-center tracking-tighter">{item.quantity} PCS</td>
                            <td className="py-4 px-3 text-xs font-bold text-slate-900 border-r border-slate-200 align-top text-center tracking-tighter">{item.price.toLocaleString()}</td>
                            <td className="py-4 px-3 text-xs font-black text-slate-900 align-top text-right tracking-tighter">₹ {item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                        {/* Filler spaces for height */}
                        <tr className="h-16">
                           <td className="border-r border-slate-200"></td>
                           <td className="border-r border-slate-200"></td>
                           <td className="border-r border-slate-200"></td>
                           <td className="border-r border-slate-200"></td>
                           <td className=""></td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-50 border-y border-slate-300">
                        <tr className="text-xs font-black text-white" style={{ backgroundColor: primaryColor }}>
                          <td className="py-2 px-3 border-r border-white/20" colSpan={2}>TOTALS</td>
                          <td className="py-2 px-3 border-r border-white/20 text-center">{items.reduce((a,c)=>a+c.quantity,0)} PCS</td>
                          <td className="py-2 px-3 border-r border-white/20 text-center tracking-tighter">₹ {subtotal.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right tracking-tighter">₹ {subtotal.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Bottom Section */}
                  <div className="grid grid-cols-2 p-6 gap-12 mt-auto border-t border-slate-100">
                     <div className="space-y-10">
                        <div className="space-y-1">
                           <p className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">Notes</p>
                           <p className="text-xs font-medium text-slate-500">Thank you for your business!</p>
                        </div>
                        {shopConfig?.showTerms !== false && (
                          <div className="space-y-1">
                             <p className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">Terms & Conditions</p>
                             <ol className="text-[10px] text-slate-500 list-decimal ml-3 space-y-0.5">
                                <li>Goods once sold will not be taken back or exchanged</li>
                                <li>All disputes are subject to local jurisdiction only</li>
                             </ol>
                          </div>
                        )}
                     </div>
                     <div className="space-y-3">
                        <div className="space-y-1.5 text-xs font-bold text-slate-600">
                           <div className="flex justify-between"><span>Taxable Amount</span><span>₹ {subtotal.toLocaleString()}</span></div>
                           {invoice.discountAmount > 0 && (
                             <div className="flex justify-between text-red-500">
                               <span>Discount {invoice.discountType === 'PERCENTAGE' ? `(${invoice.discount}%)` : ''}</span>
                               <span>- ₹ {invoice.discountAmount.toLocaleString()}</span>
                             </div>
                           )}
                           {invoice.additionalCharges && invoice.additionalCharges > 0 ? (
                             <div className="flex justify-between text-slate-500">
                               <span>Additional Charges</span>
                               <span>+ ₹ {invoice.additionalCharges.toLocaleString()}</span>
                             </div>
                           ) : null}
                           {invoice.roundOff !== undefined && invoice.roundOff !== 0 ? (
                             <div className="flex justify-between text-slate-400">
                               <span>Round Off</span>
                               <span>{invoice.roundOff > 0 ? '+' : ''} ₹ {invoice.roundOff.toLocaleString()}</span>
                             </div>
                           ) : (
                             <div className="flex justify-between text-slate-400"><span>Round Off</span><span>₹ 0</span></div>
                           )}
                        </div>
                        <div className="border-t-2 pt-3 flex justify-between items-center" style={{ borderColor: primaryColor, color: primaryColor }}>
                           <span className="text-lg font-black uppercase tracking-tight">Total Amount</span>
                           <span className="text-2xl font-black tracking-tighter">₹ {grandTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-emerald-600 border-t border-slate-100 pt-1">
                           <span>Paid Amount</span>
                           <span>₹ {invoice.paidAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-red-500 border-t border-slate-100 pt-1">
                           <span>Balance Due</span>
                           <span>₹ {(invoice.grandTotal - invoice.paidAmount).toLocaleString()}</span>
                        </div>
                        <div className="pt-6">
                           <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Total Amount (in words)</p>
                           <p className="text-[11px] font-bold text-slate-400 lowercase italic">{totalInWords}</p>
                        </div>
                        {invoice.showSignature !== false && shopConfig?.signatureImage && (
                          <div className="pt-6 flex flex-col items-end">
                            <div className="w-32 h-16 border-b border-slate-200 flex items-center justify-center p-1">
                              <img src={shopConfig.signatureImage} alt="Signature" className="max-w-full max-h-full object-contain mix-multiply" crossOrigin="anonymous" />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Signatory</p>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Footer Branding */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                     <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice created using</span>
                        <div className="flex items-center">
                           <span className="text-[14px] font-black" style={{ color: primaryColor }}>BillMax</span>
                        </div>
                        <div className="h-4 w-px bg-slate-200 mx-2" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Download now at</span>
                        <div className="flex gap-2" data-html2canvas-ignore="true">
                           <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Play Store" className="h-5" />
                           <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-5" />
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Thanks for Shopping Banner */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="w-full max-w-[500px] bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 mt-4 mb-4 border border-slate-100 dark:border-white/5 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Thanks for shopping!</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm px-4">
                  We appreciate your business with <span className="font-bold text-emerald-600">{shopConfig?.shopName || 'us'}</span>.
                </p>
              </div>
              <div className="w-full h-px bg-slate-100 dark:bg-white/5 my-2" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-600">Secure Digital Invoice</p>
            </motion.div>

            {/* App Promotion Banner */}
            <div className="w-full max-w-[400px] px-4 pb-12 mb-10">
              <div className="bg-slate-900 dark:bg-brand-600 rounded-3xl p-5 flex items-center justify-between border border-white/10 text-white">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                      <Phone className="text-white w-5 h-5" />
                   </div>
                   <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-tight">Generate your own bills</h4>
                      <span className="text-brand-400 dark:text-white/80 text-[10px] font-black uppercase">Get BillMax Today</span>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      </div>

      {/* 4. BLURRED OVERLAY ON TOP OF FULL INVOICE */}
      {!loading && !error && invoice && !isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-100/30 dark:bg-slate-950/30 flex items-center justify-center p-6 select-none pointer-events-auto">
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setIsOpen(true);
              playGreeting();
            }}
            style={{ 
              backgroundColor: invoice?.invoicePrimaryColor || shopConfig?.invoicePrimaryColor || '#3553CD',
              boxShadow: `0 20px 40px -10px ${(invoice?.invoicePrimaryColor || shopConfig?.invoicePrimaryColor || '#3553CD')}60`
            }}
            className="px-10 py-5 text-white font-black rounded-3xl active:scale-95 transition-all text-base tracking-[0.2em] uppercase flex items-center justify-center gap-3 relative overflow-hidden group shadow-2xl scale-110"
          >
            <span>OPEN INVOICE</span>
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  );
};

const OrnateCorner = ({ position, color }: { position: string, color: string }) => {
  const isTop = position.includes('top');
  const isLeft = position.includes('left');
  
  return (
    <div className={`absolute ${position.replace('-', ' ')} w-16 h-16 pointer-events-none p-2`}>
       <div className={`w-full h-full border-${isTop ? 't' : 'b'}-2 border-${isLeft ? 'l' : 'r'}-2 relative`} style={{ borderColor: `${color}40` }}>
          <div className={`absolute ${isTop ? '-top-1' : '-bottom-1'} ${isLeft ? '-left-1' : '-right-1'} w-3 h-3 rotate-45`} style={{ backgroundColor: color }} />
          <div className={`absolute ${isTop ? '-top-0.5' : '-bottom-0.5'} ${isLeft ? 'left-6' : 'right-6'} w-1 h-1 rounded-full`} style={{ backgroundColor: color }} />
          <div className={`absolute ${isTop ? 'top-6' : 'bottom-6'} ${isLeft ? '-left-0.5' : '-right-0.5'} w-1 h-1 rounded-full`} style={{ backgroundColor: color }} />
       </div>
    </div>
  );
};

export default PublicInvoice;
