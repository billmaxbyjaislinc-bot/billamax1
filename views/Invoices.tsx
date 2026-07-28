
import React, { useState } from 'react';
import { Search, History, Calendar, ChevronRight, X, MessageSquare, Download, Share2, ArrowLeft, Trash2, ChevronDown, Filter, Copy, ExternalLink, Check, MoreVertical, Loader2 } from 'lucide-react';
import { Invoice, AppConfig, PaymentMethod } from '../types';
import { formatCurrency, formatWhatsAppNumber, getInvoiceShareUrl } from '../utils/helpers';
import InvoiceDetail from '../components/InvoiceDetail';
import { getTranslation } from '../utils/translations';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { User } from 'firebase/auth';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import { safeHtml2Canvas } from '../utils/pdfSafe';
import { jsPDF } from 'jspdf';

interface InvoicesProps {
  invoices: Invoice[];
  config: AppConfig;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  user: User | null;
  targetInvoiceId?: string | null;
  onClearTarget?: () => void;
  isLoading?: boolean;
  businessId?: string;
  onUpdateConfig?: (updates: Partial<AppConfig>) => void;
}

const Invoices: React.FC<InvoicesProps> = ({ invoices, config, setInvoices, user, targetInvoiceId, onClearTarget, isLoading, businessId = 'default', onUpdateConfig }) => {
  const t = getTranslation(config?.language || 'hinglish');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentRange, setCurrentRange] = useState<DateRange | null>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const triggerDownloadOfInvoice = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    
    // Give React a small tick to render the hidden container
    setTimeout(async () => {
      const element = document.getElementById(`download-target-${inv.id}`);
      if (!element) {
        setDownloadingId(null);
        return;
      }

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

        const fileName = `Invoice_${inv.id}.pdf`;
        pdf.save(fileName);
      } catch (err: any) {
        console.error("PDF Export failed from history list", err);
        alert("Failed to generate PDF: " + (err?.message || String(err)));
      } finally {
        setDownloadingId(null);
      }
    }, 600);
  };

  const handleCopyLink = async (inv: Invoice) => {
    if (!user) return;
    const shareUrl = getInvoiceShareUrl(user.uid, inv.id, businessId);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = shareUrl;
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedInvoiceId(inv.id);
      setTimeout(() => setCopiedInvoiceId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  React.useEffect(() => {
    if (targetInvoiceId) {
      const inv = invoices.find(i => i.id === targetInvoiceId);
      if (inv) {
        setSelectedInvoice(inv);
      }
    }
  }, [targetInvoiceId, invoices]);

  React.useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = () => {
      setOpenMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openMenuId]);

  const handleSelect = (inv: Invoice) => {
    setSelectedInvoice(inv);
    window.history.pushState({ ...window.history.state, sub: true }, '');
  };

  const handleUpdate = async (id: string, updates: Partial<Invoice>) => {
    if (!user) return;
    const businessRef = businessId === 'default' 
      ? doc(db, 'users', user.uid) 
      : doc(db, 'users', user.uid, 'businesses', businessId);
    
    try {
      await setDoc(doc(businessRef, 'invoices', id), updates, { merge: true });
      // The invoice in state will be updated via onSnapshot in App.tsx
      // But we should update the locally selected invoice to reflect changes immediately
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice({ ...selectedInvoice, ...updates });
      }

      // Sync edited properties to the global config so future generated invoices match
      if (onUpdateConfig) {
        const configUpdates: Partial<AppConfig> = {};
        if (updates.invoiceTheme !== undefined) configUpdates.invoiceTheme = updates.invoiceTheme;
        if (updates.invoicePrimaryColor !== undefined) configUpdates.invoicePrimaryColor = updates.invoicePrimaryColor;
        if (updates.showLogo !== undefined) configUpdates.showLogo = updates.showLogo;
        if (updates.showSignature !== undefined) configUpdates.showSignature = updates.showSignature;

        if (Object.keys(configUpdates).length > 0) {
          onUpdateConfig(configUpdates);
        }
      }
    } catch (err) {
      console.error('Error updating invoice:', err);
    }
  };

  React.useEffect(() => {
    const handlePopState = () => {
      if (selectedInvoice) {
        setSelectedInvoice(null);
        onClearTarget?.();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedInvoice, onClearTarget]);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         inv.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const invDate = inv.date.split('T')[0];
    const matchesFrom = !currentRange?.from || invDate >= currentRange.from;
    const matchesTo = !currentRange?.to || invDate <= currentRange.to;
    
    return matchesSearch && matchesFrom && matchesTo;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleWhatsApp = async (inv: Invoice) => {
    if (!user) return;
    const shareUrl = getInvoiceShareUrl(user.uid, inv.id, businessId);
    const message = `Hello! Your bill from ${config.shopName}.\nBill No: ${inv.id}\nAmount: ${formatCurrency(inv.grandTotal)}\nView Bill: ${shareUrl}\nThank you!`;

    // 1. Try native share first (since clicking the button should also share)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bill from ${config.shopName}`,
          text: message,
          url: shareUrl,
        });
        return; // Successfully shared or handled natively
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError' || shareErr?.message?.toLowerCase().includes('cancel') || shareErr?.message?.toLowerCase().includes('abort')) {
          console.log("Send Link cancelled by user");
          return; // Exit cleanly without falling back to WhatsApp
        }
        console.warn("Native share failed on Send Link, falling back to WhatsApp", shareErr);
      }
    }

    // 2. Fallback: Send link via WhatsApp
    let mobile = inv.clientMobile;
    if (!mobile) {
      const enteredMobile = prompt("Please enter the WhatsApp mobile number (with country code, e.g., 919876543210):");
      if (!enteredMobile) return;
      mobile = enteredMobile;
    }
    const url = `https://wa.me/${formatWhatsAppNumber(mobile)}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-20">
      {selectedInvoice ? (
        <div className="space-y-4">
           <button 
             onClick={() => {
               setSelectedInvoice(null);
               onClearTarget?.();
             }} 
             className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs mb-4"
           >
             <ArrowLeft className="w-4 h-4" /> {t.goBack}
           </button>
           <InvoiceDetail onUpdateConfig={onUpdateConfig} 
             invoice={selectedInvoice} 
             config={config} 
             shareUrl={user ? getInvoiceShareUrl(user.uid, selectedInvoice.id, businessId) : undefined}
             onUpdate={handleUpdate}
             onDelete={async (id) => {
               const user = auth.currentUser;
               if (!user) return;
               try {
                 const businessRef = businessId === 'default' 
                   ? doc(db, 'users', user.uid) 
                   : doc(db, 'users', user.uid, 'businesses', businessId);
                 await deleteDoc(doc(businessRef, 'invoices', id));
                 setInvoices(prev => prev.filter(inv => inv.id !== id));
                 setSelectedInvoice(null);
                 onClearTarget?.();
               } catch (err) {
                 const businessRef = businessId === 'default' 
                   ? doc(db, 'users', user.uid) 
                   : doc(db, 'users', user.uid, 'businesses', businessId);
                 handleFirestoreError(err, OperationType.DELETE, `${businessRef.path}/invoices/${id}`);
               }
             }}
           />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder={t.searchInvoicePlaceholder} className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white font-semibold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800">
              <button 
                onClick={() => setIsDatePickerOpen(true)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-brand-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.dateFilter}</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {currentRange ? `${currentRange.from} to ${currentRange.to}` : t.allTime}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t.recentBills} ({filteredInvoices.length})</h3>
              {currentRange && (
                <button onClick={() => setCurrentRange(null)} className="text-[9px] font-bold text-brand-500 uppercase tracking-widest">{t.clearFilter}</button>
              )}
            </div>
            
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.loadingBills}</p>
              </div>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => (
                <div 
                  key={inv.id} 
                  onClick={() => handleSelect(inv)}
                  className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-all group relative cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${inv.paymentMethod === PaymentMethod.BORROW ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        <History className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs tracking-tight truncate">{inv.clientName}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{inv.id} • {new Date(inv.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-black text-slate-900 dark:text-white text-sm leading-none">{formatCurrency(inv.grandTotal)}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1.5 inline-block leading-none ${inv.paymentMethod === PaymentMethod.BORROW ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {inv.paymentMethod === PaymentMethod.BORROW ? 'UNPAID' : inv.paymentMethod}
                        </span>
                      </div>
                      
                      {/* Three-dots Dropdown Menu Trigger */}
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === inv.id ? null : inv.id);
                          }}
                          className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          <MoreVertical className="w-4.5 h-4.5" />
                        </button>                         {/* Dropdown Options */}
                        {openMenuId === inv.id && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-150"
                          >
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLink(inv);
                                setTimeout(() => setOpenMenuId(null), 1000);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                            >
                              {copiedInvoiceId === inv.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedInvoiceId === inv.id ? "Copied" : "Copy Link"}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWhatsApp(inv);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Send Link
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (user) {
                                  const shareUrl = getInvoiceShareUrl(user.uid, inv.id, businessId);
                                  window.open(shareUrl, '_blank');
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open in new tab
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerDownloadOfInvoice(inv);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400 border-t border-slate-50 dark:border-slate-700/50 mt-1 pt-2"
                            >
                              {downloadingId === inv.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              Download Invoice
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))
            ) : (
              <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <History className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No bills found</p>
              </div>
            )}
          </div>
        </>
      )}

      {downloadingId && (
        <div style={{ position: 'fixed', left: '0', top: '0', width: '800px', height: '1131px', zIndex: -9999, overflow: 'hidden', pointerEvents: 'none' }} onClick={(e) => e.stopPropagation()}>
          {(() => {
            const inv = invoices.find(i => i.id === downloadingId);
            return inv ? (
              <div id={`download-target-${inv.id}`}>
                <InvoiceDetail invoice={inv} config={config} isExportMode={true} />
              </div>
            ) : null;
          })()}
        </div>
      )}

      {isDatePickerOpen && (
        <DateRangePicker 
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(range) => {
            setCurrentRange(range);
            setIsDatePickerOpen(false);
          }}
          currentRange={currentRange}
          language={config?.language}
        />
      )}
    </div>
  );
};

export default Invoices;
