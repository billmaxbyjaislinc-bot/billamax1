import React, { useState, useEffect, useRef } from 'react';
import { InvoiceTheme } from '../types';
import { 
  ArrowLeft, 
  Check,
  Crown,
  Eye,
  EyeOff,
  Type,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layout,
  Palette,
  Volume2,
  Play,
  Upload,
  Trash2,
  PenTool,
  Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppConfig } from '../types';
import SignaturePad from './SignaturePad';

interface InvoiceSettingsProps {
  onClose: () => void;
  config: AppConfig;
  onUpdate: (updates: Partial<AppConfig>) => void;
}

const InvoiceSettings: React.FC<InvoiceSettingsProps> = ({ 
  onClose, 
  config, 
  onUpdate 
}) => {
  const [scale, setScale] = useState(0.65);
  const [showSignPad, setShowSignPad] = useState(false);
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFullScreenPreview) return;
    const updateScale = () => {
      if (previewContainerRef.current) {
        const width = previewContainerRef.current.offsetWidth;
        const height = previewContainerRef.current.offsetHeight;
        // Padding around preview
        const padding = 32;
        const availableWidth = width - padding;
        const availableHeight = height - padding;
        
        // Dynamic scale calculation based on dimensions of standard 800x1131 A4 page
        const widthScale = availableWidth / 800;
        const heightScale = availableHeight / 1131;
        const newScale = Math.min(widthScale, heightScale, 1.2); // Cap scale at 1.2x
        setPreviewScale(Math.max(newScale, 0.3)); // Prevent scale from dropping below 0.3
      }
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (previewContainerRef.current) ro.observe(previewContainerRef.current);
    return () => ro.disconnect();
  }, [showFullScreenPreview]);

  const handleUpdateLocal = (updates: Partial<AppConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  const colors = [
    { name: 'Professional Blue', hex: '#3553CD' },
    { name: 'Royal Gold', hex: '#ca8a04' },
    { name: 'Forest Green', hex: '#1b5e20' },
    { name: 'Modern Black', hex: '#111827' },
    { name: 'Business Indigo', hex: '#4338ca' },
    { name: 'Vibrant Purple', hex: '#6b21a8' },
    { name: 'Classic Red', hex: '#b91c1c' },
  ];

  const themes = [
    { id: InvoiceTheme.MODERN, label: 'Modern' },
    { id: InvoiceTheme.CLASSIC, label: 'Classic' },
    { id: InvoiceTheme.ELEGANT, label: 'Elegant' },
    { id: InvoiceTheme.MINIMAL, label: 'Minimal' },
  ];

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      const base64 = readerEvent.target?.result as string;
      if (base64) {
        handleUpdateLocal({ businessLogo: base64, showLogo: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      const base64 = readerEvent.target?.result as string;
      if (base64) {
        handleUpdateLocal({ signatureImage: base64, showSignature: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (confirm("Are you sure you want to remove the business logo?")) {
      handleUpdateLocal({ businessLogo: "", showLogo: false });
    }
  };

  const handleRemoveSignature = () => {
    if (confirm("Are you sure you want to remove the signature image?")) {
      handleUpdateLocal({ signatureImage: "", showSignature: false });
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-slate-950 h-screen overflow-hidden">
      {/* Ultra Compact Header with Premium Save Button */}
      <div className="p-2.5 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-50 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 text-brand-500 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5" strokeWidth={3} />
          </button>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Invoice Branding</h3>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFullScreenPreview(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 text-brand-500 animate-pulse" /> Full Preview
          </button>
          
          <button 
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md"
          >
            <Check className="w-3.5 h-3.5" /> Save settings
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Invoice Preview: Scaled Down with Zoom controls */}
        <div className="flex-[0.5] relative overflow-hidden flex justify-center items-center bg-slate-100/50 dark:bg-slate-950/20 p-4">
           {/* Zoom Controls Overlay */}
           <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <button 
                onClick={() => setScale(prev => Math.min(prev + 0.1, 1.5))}
                className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full text-slate-600 dark:text-slate-300 active:scale-90 transition-all border border-slate-200 dark:border-slate-700"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setScale(prev => Math.max(prev - 0.1, 0.3))}
                className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full text-slate-600 dark:text-slate-300 active:scale-90 transition-all border border-slate-200 dark:border-slate-700"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setScale(0.65)}
                className="p-1.5 bg-white/90 dark:bg-slate-800/90 rounded-full text-slate-600 dark:text-slate-300 active:scale-90 transition-all border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
           </div>

           <motion.div 
             animate={{ scale }}
             transition={{ type: 'spring', stiffness: 300, damping: 30 }}
             className="w-[200px] origin-center touch-none border border-slate-100 dark:border-slate-800"
           >
              <MiniProfessionalInvoice config={localConfig} />
           </motion.div>
        </div>

        {/* Controls Section */}
        <div className="flex-[0.5] bg-white dark:bg-slate-900 rounded-t-[1.5rem] px-4 py-5 space-y-6 overflow-y-auto no-scrollbar border-t dark:border-slate-800">
          
          {/* Layout Themes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layout className="w-3.5 h-3.5 text-brand-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-fade-in">Select Theme Layout</p>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleUpdateLocal({ invoiceTheme: t.id })}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl border-2 transition-all active:scale-95 text-[11px] font-bold uppercase tracking-tight
                    ${localConfig.invoiceTheme === t.id || (!localConfig.invoiceTheme && t.id === InvoiceTheme.MODERN)
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:border-slate-200'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-3.5 h-3.5 text-brand-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Color Theme</p>
            </div>
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
               {colors.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => handleUpdateLocal({ invoicePrimaryColor: c.hex })}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-all relative border-4 border-white dark:border-slate-900"
                    style={{ backgroundColor: c.hex }}
                  >
                    {(localConfig.invoicePrimaryColor === c.hex || (!localConfig.invoicePrimaryColor && c.hex === '#3553CD')) && (
                      <div className="absolute -inset-1 border-2 border-brand-500 rounded-full" />
                    )}
                    {(localConfig.invoicePrimaryColor === c.hex || (!localConfig.invoicePrimaryColor && c.hex === '#3553CD')) && (
                      <Check className="w-4 h-4 text-white stroke-[4px]" />
                    )}
                  </button>
               ))}
            </div>
          </div>

          {/* Visibility Toggles */}
          <div className="grid grid-cols-2 gap-3">
             <ToggleOption 
                label="HSN Column" 
                active={localConfig.showHsnColumn !== false} 
                onClick={() => handleUpdateLocal({ showHsnColumn: !localConfig.showHsnColumn })}
             />
             <ToggleOption 
                label="Branding" 
                active={localConfig.showFooterBranding !== false} 
                onClick={() => handleUpdateLocal({ showFooterBranding: !localConfig.showFooterBranding })}
             />
             <ToggleOption 
                label="Terms" 
                active={localConfig.showTerms !== false} 
                onClick={() => handleUpdateLocal({ showTerms: !localConfig.showTerms })}
             />
             <ToggleOption 
                label="Classic Style" 
                active={localConfig.invoiceTheme === InvoiceTheme.CLASSIC} 
                onClick={() => handleUpdateLocal({ invoiceTheme: InvoiceTheme.CLASSIC })}
             />
          </div>

          {/* Logo Customization Option */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-brand-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-[9px]">Logo Option</p>
              </div>
              <ToggleOption 
                label="Show Logo" 
                active={localConfig.showLogo !== false} 
                onClick={() => handleUpdateLocal({ showLogo: localConfig.showLogo === undefined ? false : !localConfig.showLogo })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-all active:scale-95 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider text-center">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Logo</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>

              {localConfig.businessLogo && (
                <button 
                  type="button"
                  onClick={handleRemoveLogo}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-all active:scale-95 font-semibold text-[10px] uppercase tracking-wider border border-red-100 dark:border-red-900/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            {localConfig.businessLogo ? (
              <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded bg-white overflow-hidden p-1 border flex items-center justify-center flex-shrink-0">
                  <img src={localConfig.businessLogo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Logo Connected</p>
                  <p className="text-[8px] text-slate-400">Press save above to apply</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-2.5 bg-slate-50/20 dark:bg-slate-800/10 rounded-lg border border-dashed border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">No business logo configured</p>
              </div>
            )}
          </div>

          {/* Signature Customization Option */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3 pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-3.5 h-3.5 text-brand-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-[9px]">Signature Option</p>
              </div>
              <ToggleOption 
                label="Show Signature" 
                active={localConfig.showSignature !== false} 
                onClick={() => handleUpdateLocal({ showSignature: localConfig.showSignature === undefined ? false : !localConfig.showSignature })}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSignPad(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-all active:scale-95 font-semibold text-[10px] uppercase tracking-wider text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-center"
              >
                <PenTool className="w-3.5 h-3.5" />
                Draw
              </button>

              <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-all active:scale-95 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider text-center">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>

              {localConfig.signatureImage && (
                <button 
                  type="button"
                  onClick={handleRemoveSignature}
                  className="flex-shrink-0 flex items-center justify-center gap-2 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {localConfig.signatureImage ? (
              <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded bg-white overflow-hidden p-1 border flex items-center justify-center flex-shrink-0">
                  <img src={localConfig.signatureImage} alt="Signature preview" className="max-w-full max-h-full object-contain mix-multiply" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Signature Connected</p>
                  <p className="text-[8px] text-slate-400">Press save above to apply</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-2.5 bg-slate-50/20 dark:bg-slate-800/10 rounded-lg border border-dashed border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">No signature configured</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSignPad && (
        <SignaturePad 
          onSave={(base64) => {
            handleUpdateLocal({ signatureImage: base64, showSignature: true });
            setShowSignPad(false);
          }}
          onCancel={() => setShowSignPad(false)}
        />
      )}

      {/* Full Screen Live Preview Modal */}
      <AnimatePresence>
        {showFullScreenPreview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden text-slate-900"
          >
            {/* Header */}
            <div className="p-3 flex items-center justify-between bg-slate-900 border-b border-slate-800 text-white shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowFullScreenPreview(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl active:scale-95 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-left">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Full Invoice Live Preview</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
                    Theme: {themes.find(t => t.id === localConfig.invoiceTheme)?.label || 'Modern'} • GST Enabled
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowFullScreenPreview(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all border border-slate-700 font-bold"
                >
                  <PenTool className="w-3.5 h-3.5 text-brand-400 animate-bounce" /> Edit branding
                </button>
                
                <button 
                  onClick={() => {
                    handleSave();
                    setShowFullScreenPreview(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md font-bold"
                >
                  <Check className="w-3.5 h-3.5" /> Save settings
                </button>
              </div>
            </div>

            {/* Scrollable Preview Canvas with dynamically adjusted scale */}
            <div 
              ref={previewContainerRef} 
              className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-center no-scrollbar bg-slate-900/40 relative"
            >
              <div 
                style={{
                  width: `${800 * previewScale}px`,
                  height: `${1131 * previewScale}px`,
                  position: 'relative',
                }}
                className="shadow-2xl rounded-2xl"
              >
                <div 
                  className="bg-white p-1 absolute top-0 left-0 flex flex-col overflow-hidden origin-top-left"
                  style={{ 
                    width: '800px', 
                    minWidth: '800px',
                    maxWidth: '800px',
                    height: '1131px',
                    fontFamily: 'Inter, sans-serif', 
                    transform: `scale(${previewScale})`,
                  }}
                >
                  {/* Ornate corners */}
                  {((localConfig.invoiceTheme || InvoiceTheme.MODERN) === InvoiceTheme.MODERN || localConfig.invoiceTheme === InvoiceTheme.CLASSIC) && (
                    <>
                      <LocalOrnateCorner position="top-left" color={localConfig.invoicePrimaryColor || '#3553CD'} />
                      <LocalOrnateCorner position="top-right" color={localConfig.invoicePrimaryColor || '#3553CD'} />
                      <LocalOrnateCorner position="bottom-left" color={localConfig.invoicePrimaryColor || '#3553CD'} />
                      <LocalOrnateCorner position="bottom-right" color={localConfig.invoicePrimaryColor || '#3553CD'} />
                    </>
                  )}

                  {/* Main Content Area */}
                  <div className={`m-8 border flex-1 flex flex-col relative z-20 bg-white ${
                    localConfig.invoiceTheme === InvoiceTheme.MINIMAL ? 'border-transparent' : 'border-slate-200'
                  }`}>
                    {/* Header Row */}
                    <div className={`p-6 flex justify-between items-start border-b-2 ${
                      localConfig.invoiceTheme === InvoiceTheme.ELEGANT ? 'flex-col items-center text-center space-y-4' : ''
                    }`} style={{ borderColor: localConfig.invoiceTheme === InvoiceTheme.MINIMAL ? 'transparent' : (localConfig.invoicePrimaryColor || '#3553CD') }}>
                      <div className={`flex gap-4 ${localConfig.invoiceTheme === InvoiceTheme.ELEGANT ? 'flex-col items-center' : ''}`}>
                        {localConfig.showLogo !== false && localConfig.businessLogo && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                            <img src={localConfig.businessLogo} alt="Logo" className="w-full h-full object-cover animate-fade-in" />
                          </div>
                        )}
                        <div className="space-y-1 text-left">
                          <h1 className="text-4xl font-serif font-bold tracking-tight" style={{ color: localConfig.invoicePrimaryColor || '#3553CD' }}>{localConfig.shopName || 'My Business'}</h1>
                          <div className={`flex items-center gap-2 font-bold ${localConfig.invoiceTheme === InvoiceTheme.ELEGANT ? 'justify-center' : ''}`} style={{ color: localConfig.invoicePrimaryColor || '#3553CD' }}>
                             <span className="text-lg text-slate-700">📞 {localConfig.shopMobile || '9876543210'}</span>
                          </div>
                        </div>
                      </div>
                      <div className={localConfig.invoiceTheme === InvoiceTheme.ELEGANT ? 'w-full' : 'text-right'}>
                        <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: localConfig.invoicePrimaryColor || '#3553CD' }}>TAX INVOICE</h2>
                        <div className="inline-block border border-slate-300 px-3 py-1 mt-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">ORIGINAL FOR RECIPIENT</p>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 border-b border-slate-200 text-left">
                      <div className="p-4 border-r border-slate-200 bg-slate-50/20">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Invoice No.</span>
                        <span className="text-sm font-bold text-slate-900">TX-100249</span>
                      </div>
                      <div className="p-4 bg-slate-50/20">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Invoice Date</span>
                        <span className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>

                    {/* Billing Grid */}
                    <div className="grid grid-cols-2 border-b border-slate-200 text-left">
                      <div className="p-5 border-r border-slate-200 space-y-2 h-full">
                        <p className="text-sm font-black text-slate-900">Bill To</p>
                        <div className="space-y-1">
                          <p className="text-base font-bold text-slate-800 leading-tight">Rahul Sharma</p>
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                            12, MG Road, Bengaluru, Karnataka - 560001
                          </p>
                          <div className="pt-2 space-y-1">
                            <p className="text-[11px] font-bold text-slate-800">Mobile <span className="ml-1 text-slate-600 font-medium">9876543210</span></p>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 text-[11px] font-medium text-slate-600 bg-slate-50/30 flex justify-end text-right items-start">
                         <div className="max-w-[200px] space-y-1">
                           {localConfig.shopAddress && <p>{localConfig.shopAddress}</p>}
                           {localConfig.gstNumber && <p className="font-bold text-slate-900 uppercase">GSTIN: {localConfig.gstNumber}</p>}
                         </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 overflow-hidden text-left">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f2efe6] border-b border-slate-300">
                          <tr className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                            <th className="py-2 px-3 border-r border-slate-300 w-10">No</th>
                            <th className="py-2 px-3 border-r border-slate-300">Items</th>
                            {localConfig.showHsnColumn !== false && <th className="py-2 px-3 border-r border-slate-300 w-20 text-center">HSN</th>}
                            <th className="py-2 px-3 border-r border-slate-300 w-24 text-center">Qty.</th>
                            <th className="py-2 px-3 border-r border-slate-300 w-32 text-center">Rate</th>
                            <th className="py-2 px-3 w-32 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="py-4 px-3 text-xs text-slate-700 border-r border-slate-200 align-top">1</td>
                            <td className="py-4 px-3 border-r border-slate-200 align-top">
                              <p className="text-xs font-bold text-slate-900">Product A Premium Pack</p>
                            </td>
                            {localConfig.showHsnColumn !== false && <td className="py-4 px-3 text-xs text-slate-500 border-r border-slate-200 text-center align-top">2103</td>}
                            <td className="py-4 px-3 text-xs font-bold text-slate-900 border-r border-slate-200 align-top text-center tracking-tighter">2 PCS</td>
                            <td className="py-4 px-3 text-xs font-bold text-slate-900 border-r border-slate-200 align-top text-center tracking-tighter">450</td>
                            <td className="py-4 px-3 text-xs font-black text-slate-900 align-top text-right tracking-tighter">₹ 900</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="py-4 px-3 text-xs text-slate-700 border-r border-slate-200 align-top">2</td>
                            <td className="py-4 px-3 border-r border-slate-200 align-top">
                              <p className="text-xs font-bold text-slate-900">Professional Consultation Service</p>
                            </td>
                            {localConfig.showHsnColumn !== false && <td className="py-4 px-3 text-xs text-slate-500 border-r border-slate-200 text-center align-top">9983</td>}
                            <td className="py-4 px-3 text-xs font-bold text-slate-900 border-r border-slate-200 align-top text-center tracking-tighter">1 PCS</td>
                            <td className="py-4 px-3 text-xs font-bold text-slate-900 border-r border-slate-200 align-top text-center tracking-tighter">1,500</td>
                            <td className="py-4 px-3 text-xs font-black text-slate-900 align-top text-right tracking-tighter">₹ 1,500</td>
                          </tr>
                          {/* Filler spaces for height */}
                          <tr className="h-16">
                             <td className="border-r border-slate-200"></td>
                             <td className="border-r border-slate-200"></td>
                             {localConfig.showHsnColumn !== false && <td className="border-r border-slate-200"></td>}
                             <td className="border-r border-slate-200"></td>
                             <td className="border-r border-slate-200"></td>
                             <td className=""></td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-slate-50 border-y border-slate-300">
                          <tr className="text-xs font-black text-white" style={{ backgroundColor: localConfig.invoicePrimaryColor || '#3553CD' }}>
                            <td className="py-2 px-3 border-r border-white/20" colSpan={localConfig.showHsnColumn !== false ? 3 : 2}>TOTALS</td>
                            <td className="py-2 px-3 border-r border-white/20 text-center">3 PCS</td>
                            <td className="py-2 px-3 border-r border-white/20 text-center tracking-tighter">₹ 2,400</td>
                            <td className="py-2 px-3 text-right tracking-tighter">₹ 2,400</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Bottom Section */}
                    <div className="grid grid-cols-2 p-6 gap-12 mt-auto text-left">
                       <div className="space-y-10">
                          <div className="space-y-1">
                             <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Notes</p>
                             <p className="text-xs font-medium text-slate-500">Thank you for your business!</p>
                          </div>
                          {localConfig.showTerms !== false && (
                            <div className="space-y-1">
                               <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Terms & Conditions</p>
                               <ol className="text-[10px] text-slate-500 list-decimal ml-3 space-y-0.5">
                                  <li>Goods once sold will not be taken back or exchanged</li>
                                  <li>All disputes are subject to local jurisdiction only</li>
                               </ol>
                            </div>
                          )}
                       </div>
                       <div className="space-y-3">
                          <div className="space-y-1.5 text-xs font-bold text-slate-600">
                             <div className="flex justify-between"><span>Taxable Amount</span><span>₹ 2,400</span></div>
                             <div className="flex justify-between text-slate-400"><span>Round Off</span><span>₹ 0</span></div>
                          </div>
                          <div className="border-t-2 pt-3 flex justify-between items-center" style={{ borderColor: localConfig.invoicePrimaryColor || '#3553CD', color: localConfig.invoicePrimaryColor || '#3553CD' }}>
                             <span className="text-lg font-black uppercase tracking-tight">Total Amount</span>
                             <span className="text-2xl font-black tracking-tighter">₹ 2,400</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-emerald-600 border-t border-slate-100 pt-1">
                             <span>Paid Amount</span>
                             <span>₹ 2,400</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-red-500 border-t border-slate-100 pt-1">
                             <span>Balance Due</span>
                             <span>₹ 0</span>
                          </div>
                          <div className="pt-6">
                             <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Total Amount (in words)</p>
                             <p className="text-[11px] font-bold text-slate-400 lowercase italic">two thousand four hundred rupees only</p>
                          </div>
                          {localConfig.showSignature !== false && localConfig.signatureImage && (
                            <div className="pt-6 flex flex-col items-end">
                              <div className="w-32 h-16 border-b border-slate-200 flex items-center justify-center p-1">
                                <img src={localConfig.signatureImage} alt="Signature" className="max-w-full max-h-full object-contain mix-multiply animate-fade-in" />
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Signatory</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Footer Branding */}
                    {localConfig.showFooterBranding !== false && (
                      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center mt-auto">
                         <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice created using</span>
                            <div className="flex items-center">
                               <span className="text-[14px] font-black" style={{ color: localConfig.invoicePrimaryColor || '#3553CD' }}>BillMax</span>
                            </div>
                            <div className="h-4 w-px bg-slate-200 mx-2" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Download now at</span>
                            <div className="flex gap-2">
                               <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Play Store" className="h-5" />
                               <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-5" />
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LocalOrnateCorner = ({ position, color }: { position: string, color: string }) => {
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

const ToggleOption = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex items-center justify-between p-1.5 rounded-md border transition-all active:scale-95 ${
      active 
      ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/20 text-brand-600 dark:text-brand-400' 
      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400'
    }`}
  >
    <span className="text-[8px] font-black uppercase tracking-tight truncate">{label}</span>
    {active ? <Eye className="w-2.5 h-2.5 ml-1" /> : <EyeOff className="w-2.5 h-2.5 ml-1" />}
  </button>
);

// A scaled-down, static version of the professional invoice for preview
const MiniProfessionalInvoice: React.FC<{ config: AppConfig }> = ({ config }) => {
  const primaryColor = config.invoicePrimaryColor || '#3553CD';
  const theme = config.invoiceTheme || InvoiceTheme.MODERN;
  
  return (
    <div className="bg-white border-4 border-white relative flex flex-col p-0.5 pointer-events-none" style={{ aspectRatio: '1/1.4' }}>
      {/* Decorative corners */}
      {(theme === InvoiceTheme.MODERN || theme === InvoiceTheme.CLASSIC) && (
        <>
          <div className="absolute top-1 left-1 w-2 h-2 border-t border-l opacity-50" style={{ borderColor: primaryColor }} />
          <div className="absolute top-1 right-1 w-2 h-2 border-t border-r opacity-50" style={{ borderColor: primaryColor }} />
          <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l opacity-50" style={{ borderColor: primaryColor }} />
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r opacity-50" style={{ borderColor: primaryColor }} />
        </>
      )}

      <div className={`m-1 border flex-1 flex flex-col relative z-20 bg-white ${
        theme === InvoiceTheme.MINIMAL ? 'border-transparent' : 'border-slate-200'
      }`}>
        {/* Header section adapted to theme layout */}
        <div 
          className={`p-1 flex justify-between items-start border-b ${
            theme === InvoiceTheme.ELEGANT ? 'flex-col items-center text-center space-y-1' : ''
          }`} 
          style={{ borderColor: theme === InvoiceTheme.MINIMAL ? 'transparent' : `${primaryColor}40` }}
        >
          <div className={`flex gap-1 ${theme === InvoiceTheme.ELEGANT ? 'flex-col items-center' : ''}`}>
            {config.showLogo !== false && config.businessLogo && (
              <div className="w-4 h-4 rounded-xs overflow-hidden border border-slate-100 flex-shrink-0 bg-slate-50 flex items-center justify-center">
                <img src={config.businessLogo} alt="Logo" className="w-[85%] h-[85%] object-cover" />
              </div>
            )}
            <div className="space-y-[1px]">
              <h1 className="text-[7px] font-bold leading-tight" style={{ color: primaryColor }}>{config.shopName || 'Business Name'}</h1>
              <p className="text-[4px] text-slate-500 font-bold leading-none">📞 {config.shopMobile || 'Contact'}</p>
            </div>
          </div>
          <div className={theme === InvoiceTheme.ELEGANT ? 'w-full' : 'text-right'}>
            <h2 className="text-[6px] font-black uppercase tracking-tight" style={{ color: primaryColor }}>Tax Invoice</h2>
            <div className="inline-block border border-slate-300 px-[2px] py-[1px] mt-[1px]">
               <span className="text-[3px] font-black text-slate-400 uppercase tracking-widest leading-none block">ORIGINAL</span>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 border-b border-slate-200 text-[3.5px]">
          <div className="p-[2px] border-r border-slate-200 bg-slate-50/20">
            <span className="text-slate-400 block text-[2.5px] uppercase font-bold tracking-widest">Bill No</span>
            <span className="font-bold text-slate-900 leading-none">TX-697559</span>
          </div>
          <div className="p-[2px] bg-slate-50/20">
            <span className="text-slate-400 block text-[2.5px] uppercase font-bold tracking-widest">Date</span>
            <span className="font-bold text-slate-900 leading-none">02/06/2026</span>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 border-b border-slate-200">
           <div className="grid grid-cols-8 bg-slate-50 text-[2.5px] font-black p-0.5 border-b border-slate-200 uppercase">
              <span className="col-span-1 text-center font-black">No</span>
              <span className="col-span-2 font-black">Items</span>
              {config.showHsnColumn !== false && <span className="col-span-1 text-center font-black">HSN</span>}
              <span className={config.showHsnColumn === false ? 'col-span-2 text-center font-black' : 'col-span-1 text-center font-black'}>Qty</span>
              <span className="col-span-1 text-center font-black">Rate</span>
              <span className="col-span-2 text-right font-black">Total</span>
           </div>
           <div className="grid grid-cols-8 text-[3px] font-bold p-0.5 border-b border-slate-100 items-center">
              <span className="col-span-1 text-center text-slate-400">1</span>
              <span className="col-span-2 text-slate-900 truncate">Sauce Extra Chef</span>
              {config.showHsnColumn !== false && <span className="col-span-1 text-center text-slate-500">2103</span>}
              <span className={config.showHsnColumn === false ? 'col-span-2 text-center' : 'col-span-1 text-center'}>1 PCS</span>
              <span className="col-span-1 text-center">15</span>
              <span className="col-span-2 text-right text-slate-900">₹ 15</span>
           </div>
        </div>

        {/* Totals & Signatures */}
        <div className="p-1.5 grid grid-cols-2 gap-2 mt-auto border-t border-slate-100">
           <div className="space-y-1">
              {config.showTerms !== false && (
                <div className="space-y-[1px]">
                   <p className="text-[3px] font-black text-slate-900 uppercase">Terms</p>
                   <p className="text-[2px] text-slate-400 leading-none font-bold">Thank you for your business!</p>
                </div>
              )}
              {config.showSignature !== false && config.signatureImage && (
                <div className="pt-1 flex flex-col items-end animate-fade-in">
                  <div className="w-8 h-4 border-b border-slate-200 flex items-center justify-center p-[1px]">
                    <img src={config.signatureImage} alt="Sig" className="max-w-full max-h-full object-contain mix-multiply" />
                  </div>
                  <p className="text-[2px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Auth Signatory</p>
                </div>
              )}
           </div>
           <div className="text-right space-y-[1px]">
              <div className="flex justify-between text-[3px] font-bold text-slate-500">
                <span>Subtotal:</span>
                <span>₹ 15</span>
              </div>
              <div className="flex justify-between text-[3.5px] font-black" style={{ color: primaryColor }}>
                <span>Total:</span>
                <span>₹ 15</span>
              </div>
           </div>
        </div>
        
        {config.showFooterBranding !== false && (
          <div className="p-0.5 bg-slate-50 text-center border-t border-slate-100">
            <span className="text-[2.5px] font-black text-slate-300 uppercase tracking-widest block font-bold">Powered by BillMax</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceSettings;
