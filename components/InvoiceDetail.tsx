
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Printer, Download, Share2, Trash2, Phone, Loader2 } from 'lucide-react';
import { Invoice, AppConfig, PaymentMethod, ItemType, InvoiceTheme } from '../types';
import { formatCurrency, numberToWords, formatWhatsAppNumber, getInvoiceShareUrl, PUBLIC_APP_URL } from '../utils/helpers';
import { showToast } from '../utils/notifications';

import { safeHtml2Canvas } from '../utils/pdfSafe';
import { jsPDF } from 'jspdf';

interface InvoiceDetailProps {
  invoice: Invoice;
  config: AppConfig;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Invoice>) => void;
  shareUrl?: string;
  isExportMode?: boolean;
  onUpdateConfig?: (updates: Partial<AppConfig>) => void;
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, config, onDelete, onUpdate, shareUrl, isExportMode, onUpdateConfig }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(isExportMode ? 1 : 1);
  const [scaleReady, setScaleReady] = useState(!!isExportMode);

  const [isSharing, setIsSharing] = useState(false);

  React.useEffect(() => {
    if (isExportMode) return;
    
    const updateScale = () => {
      if (containerRef.current && containerRef.current.offsetWidth > 0) {
        const containerWidth = containerRef.current.offsetWidth;
        const targetWidth = 800;
        // Fill the width completely on mobile, subtract only 4px for tiny margin
        const availableWidth = containerWidth - 4;
        const newScale = availableWidth / targetWidth;
        setScale(newScale);
        setScaleReady(true);
      }
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);

  const primaryColor = invoice.invoicePrimaryColor || config.invoicePrimaryColor || '#1a237e'; 
  const theme = invoice.invoiceTheme || config.invoiceTheme || InvoiceTheme.MODERN;
  const A4_HEIGHT = 1131; // Exact A4 aspect ratio height for 800px width (800 * 1.414)

  const invoiceType = useMemo(() => {
    const hasProduct = invoice.items.some(i => i.type === ItemType.PRODUCT);
    const hasService = invoice.items.some(i => i.type === ItemType.SERVICE);
    if (hasProduct && hasService) return "Mixed Invoice";
    if (hasProduct) return "Product Invoice";
    if (hasService) return "Service Invoice";
    return "Tax Invoice";
  }, [invoice.items]);

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = () => {
    if (onDelete && confirm("Are you sure you want to delete this invoice?")) {
      onDelete(invoice.id);
    }
  };

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    
    const element = invoiceRef.current;
    
    try {
      const canvas = await safeHtml2Canvas(element, {
        scale: 2, // 2x scale for crisp text & high printing clarity
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('.invoice-container') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.margin = '0';
            clonedElement.style.marginBottom = '0';
            clonedElement.style.width = '800px';
            clonedElement.style.position = 'relative';
            clonedElement.style.top = '0';
            clonedElement.style.left = '0';
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

      const fileName = `Invoice_${invoice.id}.pdf`;
      pdf.save(fileName);
    } catch (err: any) {
      console.error("PDF Export failed", err);
      alert("Failed to generate PDF: " + (err?.message || String(err)));
    }
  };

  const handleShare = async () => {
    if (!invoiceRef.current || isSharing) return;
    setIsSharing(true);

    try {
      const shareUrlActual = shareUrl || getInvoiceShareUrl(invoice?.userId, invoice?.id, invoice?.businessId);
      const shareText = `Hello! Your bill from ${config.shopName}.\nBill No: ${invoice.id}\nAmount: ${formatCurrency(invoice.grandTotal)}\nView Bill: ${shareUrlActual}`;

      // 1. Generate multi-page PDF for sharing
      const canvas = await safeHtml2Canvas(invoiceRef.current, {
        scale: 2, // 2x scale for crisp text & high printing clarity
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('.invoice-container') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.margin = '0';
            clonedElement.style.marginBottom = '0';
            clonedElement.style.width = '800px';
            clonedElement.style.position = 'relative';
            clonedElement.style.top = '0';
            clonedElement.style.left = '0';
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

      // Draw first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Add pages sequentially
      while (heightLeft > 0.1) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `Invoice_${invoice.id}.pdf`, { type: 'application/pdf' });

      // 2. Try sharing with file if supported
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Invoice ${invoice.id}`,
            text: shareText,
          });
          return;
        } catch (shareErr: any) {
          // If the user cancelled, aborted, or it failed, we return immediately 
          // to prevent opening WhatsApp fallback.
          console.log("File share interaction complete or cancelled:", shareErr);
          return;
        }
      } 
      
      // 3. Fallback to text share if files not supported
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Bill from ${config.shopName}`,
            text: shareText,
            url: shareUrlActual,
          });
          return;
        } catch (shareErr: any) {
          console.log("Text share interaction complete or cancelled:", shareErr);
          return;
        }
      }
      
      // 4. Ultimate fallback to WhatsApp (only if navigator.share is completely unavailable)
      const url = `https://wa.me/${formatWhatsAppNumber(invoice.clientMobile || '')}?text=${encodeURIComponent(shareText)}`;
      window.open(url, '_blank');
    } catch (err: any) {
      console.error("Share failed:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleWhatsAppLinkShare = () => {
    const shareUrlActual = shareUrl || getInvoiceShareUrl(invoice?.userId, invoice?.id, invoice?.businessId);
    const shareText = `Hello! Your bill from ${config.shopName}.\nBill No: ${invoice.id}\nAmount: ${formatCurrency(invoice.grandTotal)}\nView Bill: ${shareUrlActual}`;

    let mobile = invoice.clientMobile;
    if (!mobile) {
      const enteredMobile = prompt("Please enter the WhatsApp mobile number (with country code, e.g., 919876543210):");
      if (!enteredMobile) return;
      mobile = enteredMobile;
    }

    const url = `https://wa.me/${formatWhatsAppNumber(mobile)}?text=${encodeURIComponent(shareText)}`;
    showToast("Opening WhatsApp... 📲", "success");
    window.open(url, '_blank');
  };

  const formattedDate = new Date(invoice.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="space-y-4 relative">
      {/* Floating Sticky Top Bar: WhatsApp Share & Actions */}
      <div className="sticky top-0 z-30 space-y-2 no-print bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md pt-1 pb-2">
        {/* Green Send link to WhatsApp Button */}
        <button
          onClick={handleWhatsAppLinkShare}
          className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white py-3.5 px-5 rounded-2xl font-extrabold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2.5 shadow-lg shadow-[#25D366]/20 active:scale-[0.98] transition-all border border-emerald-400/30"
        >
          <svg 
            className="w-5 h-5 fill-current" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Send link to WhatsApp
        </button>

        {/* Action Buttons Overlay */}
        <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl flex justify-around border border-slate-100 dark:border-slate-800 shadow-sm">
          <button onClick={handlePrint} className="flex flex-col items-center gap-1.5 font-semibold text-[9px] p-2 hover:opacity-80 transition-all text-slate-600 dark:text-slate-400">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><Printer className="w-4 h-4" /></div> Print
          </button>
          <button onClick={handleDownload} className="flex flex-col items-center gap-1.5 font-semibold text-[9px] p-2 hover:opacity-80 transition-all text-slate-600 dark:text-slate-400">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><Download className="w-4 h-4" /></div> Download
          </button>
          <button 
            onClick={handleShare} 
            disabled={isSharing}
            className="flex flex-col items-center gap-1.5 text-brand-600 font-semibold text-[9px] p-2 hover:opacity-80 transition-all disabled:opacity-50"
          >
            <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg">
              {isSharing ? <Share2 className="w-4 h-4 opacity-50" /> : <Share2 className="w-4 h-4" />}
            </div> 
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
          {onDelete && (
            <button onClick={handleDelete} className="flex flex-col items-center gap-1.5 text-red-600 font-semibold text-[9px] p-2 hover:opacity-80 transition-all">
              <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4" /></div> Delete
            </button>
          )}
        </div>
      </div>

      {/* Main Invoice Container - Exactly as screenshot */}
      <div ref={containerRef} className="w-full flex justify-center">
        {!scaleReady ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div 
            style={{
              width: `${800 * scale}px`,
              height: `${A4_HEIGHT * scale}px`,
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: 'white'
            }}
            className="invoice-print-wrapper rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <div 
              ref={invoiceRef}
              className="invoice-container bg-white p-1 absolute top-0 left-0 flex flex-col print:shadow-none overflow-hidden"
              style={{ 
                width: '800px', 
                minWidth: '800px',
                maxWidth: '800px',
                height: `${A4_HEIGHT}px`,
                fontFamily: 'Inter, sans-serif', 
                transform: `scale(${scale})`,
                transformOrigin: 'top left'
              }}
            >
        {/* Ornate Decorative Corners - Only in Modern/Classic */}
        {(theme === InvoiceTheme.MODERN || theme === InvoiceTheme.CLASSIC) && (
          <>
            <OrnateCorner position="top-left" color={primaryColor} />
            <OrnateCorner position="top-right" color={primaryColor} />
            <OrnateCorner position="bottom-left" color={primaryColor} />
            <OrnateCorner position="bottom-right" color={primaryColor} />
          </>
        )}
        
        {/* Main Content Area */}
        <div className={`m-8 border flex-1 flex flex-col relative z-20 bg-white ${
          theme === InvoiceTheme.MINIMAL ? 'border-transparent' : 'border-slate-200'
        }`}>
          
          {/* Header Row */}
          <div className={`p-6 flex justify-between items-start border-b-2 ${
            theme === InvoiceTheme.ELEGANT ? 'flex-col items-center text-center space-y-4' : ''
          }`} style={{ borderColor: theme === InvoiceTheme.MINIMAL ? 'transparent' : primaryColor }}>
            <div className={`flex gap-4 ${theme === InvoiceTheme.ELEGANT ? 'flex-col items-center' : ''}`}>
              {invoice.showLogo !== false && config.businessLogo && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                  <img src={config.businessLogo} alt="Logo" className="w-full h-full object-cover" crossOrigin="anonymous" />
                </div>
              )}
              <div className="space-y-1">
                <h1 className="text-4xl font-serif font-bold tracking-tight" style={{ color: primaryColor }}>{config.shopName}</h1>
                <div className={`flex items-center gap-2 font-bold ${theme === InvoiceTheme.ELEGANT ? 'justify-center' : ''}`} style={{ color: primaryColor }}>
                   <Phone className="w-5 h-5" style={{ fill: primaryColor }} strokeWidth={0} />
                   <span className="text-lg text-slate-700">{config.shopMobile}</span>
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
                <p className="text-base font-bold text-slate-800 leading-tight">{invoice.clientName}</p>
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
                 {config.shopAddress && <p>{config.shopAddress}</p>}
                 {config.gstNumber && <p className="font-bold text-slate-900 uppercase">GSTIN: {config.gstNumber}</p>}
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
                {invoice.items.map((item, idx) => (
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
                  <td className="py-2 px-3 border-r border-white/20 text-center">{invoice.items.reduce((a,c)=>a+c.quantity,0)} PCS</td>
                  <td className="py-2 px-3 border-r border-white/20 text-center tracking-tighter">₹ {invoice.subtotal.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tracking-tighter">₹ {invoice.subtotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-2 p-6 gap-12 mt-auto">
             <div className="space-y-10">
                <div className="space-y-1">
                   <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Notes</p>
                   <p className="text-xs font-medium text-slate-500">Thank you for your business!</p>
                </div>
                {config.showTerms !== false && (
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
                   <div className="flex justify-between"><span>Taxable Amount</span><span>₹ {invoice.subtotal.toLocaleString()}</span></div>
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
                   <span className="text-2xl font-black tracking-tighter">₹ {invoice.grandTotal.toLocaleString()}</span>
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
                   <p className="text-[11px] font-bold text-slate-400 lowercase italic">{numberToWords(invoice.grandTotal)}</p>
                </div>
                {invoice.showSignature !== false && config.signatureImage && (
                  <div className="pt-6 flex flex-col items-end">
                    <div className="w-32 h-16 border-b border-slate-200 flex items-center justify-center p-1">
                      <img src={config.signatureImage} alt="Signature" className="max-w-full max-h-full object-contain mix-multiply" crossOrigin="anonymous" />
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
        )}
      </div>

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

export default InvoiceDetail;
