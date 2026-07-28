
import React, { useMemo } from 'react';
import { 
  X, 
  Phone, 
  MapPin, 
  History, 
  ArrowLeft,
  User,
  Wallet2,
  Calendar,
  MessageCircle,
  FileText,
  Send
} from 'lucide-react';
import { Client, Invoice, AppConfig, PaymentMethod } from '../types';
import { formatCurrency, formatWhatsAppNumber, getInvoiceShareUrl } from '../utils/helpers';
import { auth } from '../firebase';
import InvoiceDetail from './InvoiceDetail';

interface ClientProfileProps {
  client: Client;
  invoices: Invoice[];
  config: AppConfig;
  onClose: () => void;
  onRecordPayment?: (client: Client) => void;
  onSelect?: (client: Client) => void;
  isUnpaidView?: boolean;
}

const ClientProfile: React.FC<ClientProfileProps> = ({ client, invoices, config, onClose, onRecordPayment, onSelect, isUnpaidView }) => {
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);

  const clientInvoices = useMemo(() => {
    return invoices.filter(inv => inv.clientName === client.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, client.name]);

  const stats = useMemo(() => {
    const totalSpent = clientInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    const unpaidCount = clientInvoices.filter(inv => inv.paymentMethod === PaymentMethod.BORROW).length;
    return { totalSpent, unpaidCount };
  }, [clientInvoices]);

  const handleWhatsAppReminder = (inv: Invoice) => {
    if (!client.mobile) return;
    const user = auth.currentUser;
    if (!user) return;

    const shareUrl = getInvoiceShareUrl(user.uid, inv.id, inv.businessId);
    const message = `Hello ${client.name}, this is a reminder for your unpaid bill #${inv.id} of ${formatCurrency(inv.pendingAmount || inv.grandTotal)} from ${config.shopName}. You can view the details here: ${shareUrl}`;
    
    const whatsappUrl = `https://wa.me/${formatWhatsAppNumber(client.mobile)}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (selectedInvoice) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[250] flex flex-col animate-in-view overflow-y-auto no-scrollbar pt-[env(safe-area-inset-top)]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
          <button onClick={() => setSelectedInvoice(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><ArrowLeft className="w-4 h-4" /></button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Invoice Details</h3>
        </div>
        <div className="p-4">
          <InvoiceDetail invoice={selectedInvoice} config={config} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[220] flex flex-col animate-in-view pt-[env(safe-area-inset-top)]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><ArrowLeft className="w-4 h-4" /></button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Client Profile</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Header/Info */}
        <div className="bg-white dark:bg-slate-900 p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-brand-500 text-white rounded-[2rem] flex items-center justify-center mb-4 border-2 border-white/20">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase px-4">{client.name}</h2>
            {client.mobile && (
              <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400">
                <Phone className="w-3 h-3 text-brand-500" />
                <p className="text-xs font-bold tracking-widest">{client.mobile}</p>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 mt-1 text-slate-400">
                <MapPin className="w-3 h-3" />
                <p className="text-[10px] font-semibold tracking-wide uppercase">{client.address}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <Wallet2 className="w-3.5 h-3.5 text-brand-500" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Unpaid</p>
              </div>
              <p className="text-lg font-black text-red-500 tracking-tight">{formatCurrency(client.totalBorrowed || 0)}</p>
              <p className="text-[8px] font-bold text-red-500/50 uppercase tracking-widest mt-1">{stats.unpaidCount} Pending Bills</p>
            </div>
            <div className="bg-brand-50 dark:bg-brand-500/10 p-4 rounded-2xl border border-brand-100 dark:border-brand-500/10">
              <div className="flex items-center gap-2 mb-1">
                <History className="w-3.5 h-3.5 text-brand-500" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Spending</p>
              </div>
              <p className="text-lg font-black text-brand-500 tracking-tight">{formatCurrency(stats.totalSpent)}</p>
              <p className="text-[8px] font-bold text-brand-500/50 uppercase tracking-widest mt-1">{clientInvoices.length} Total Bills</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button 
              onClick={() => {
                if (onSelect) onSelect(client);
                onClose();
              }}
              className="w-full bg-brand-500 text-white py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:ring-0 focus:outline-none"
            >
              <FileText className="w-4 h-4" /> Create Bill
            </button>
            
            {(client.totalBorrowed || 0) > 0 && onRecordPayment && (
              <button 
                onClick={() => {
                  onRecordPayment(client);
                  onClose();
                }}
                className="w-full bg-brand-500 text-white py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:ring-0 focus:outline-none"
              >
                <Wallet2 className="w-4 h-4" /> Receive Payment
              </button>
            )}
          </div>
        </div>

        {/* Transaction History */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Transaction History</h4>
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>

          <div className="space-y-3">
            {clientInvoices.map(inv => (
              <div 
                key={inv.id}
                onClick={() => setSelectedInvoice(inv)}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-all flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inv.paymentMethod === PaymentMethod.BORROW ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-tight truncate">Bill #{inv.id}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Calendar className="w-2.5 h-2.5 text-slate-400" />
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(inv.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(inv.grandTotal)}</p>
                  <div className="flex flex-col items-end gap-1 mt-1">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block ${inv.paymentMethod === PaymentMethod.BORROW ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {inv.paymentMethod}
                    </span>
                    {inv.paymentMethod === PaymentMethod.BORROW && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(inv); }}
                        className="flex items-center gap-1 text-[8px] font-bold text-brand-500 uppercase tracking-widest hover:text-brand-600 active:scale-95 transition-all"
                      >
                        <img src="/WhatsApp.pn.png" alt="WA" referrerPolicy="no-referrer" className="w-2.5 h-2.5" />
                        Send Reminder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {clientInvoices.length === 0 && (
              <div className="py-20 text-center opacity-30">
                <History className="w-12 h-12 mx-auto mb-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No transactions found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;
