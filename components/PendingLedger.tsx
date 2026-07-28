
import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Phone, 
  ArrowLeft,
  User,
  Wallet2,
  CheckCircle2,
  ChevronRight,
  CheckCircle,
  Calendar,
  MessageCircle
} from 'lucide-react';
import { Client, Invoice, PaymentMethod, ItemType, AppConfig } from '../types';
import { formatCurrency, generateId, formatWhatsAppNumber, getInvoiceShareUrl } from '../utils/helpers';
import InvoiceDetail from './InvoiceDetail';
import DateRangePicker, { DateRange } from './DateRangePicker';
import CallAlertManager from './CallAlertManager';
import ClientProfile from './ClientProfile';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';

interface PendingLedgerProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  config: AppConfig;
  onClose: () => void;
  businessId?: string;
}

const PendingLedger: React.FC<PendingLedgerProps> = ({ clients, setClients, invoices, setInvoices, config, onClose, businessId = 'default' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustingClient, setAdjustingClient] = useState<Client | null>(null);
  const [selectedClientProfile, setSelectedClientProfile] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [lastPaymentInvoice, setLastPaymentInvoice] = useState<Invoice | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentRange, setCurrentRange] = useState<DateRange>({
    from: '',
    to: '',
    label: 'All Time'
  });
  const [showCallAlert, setShowCallAlert] = useState(false);

  const pendingClients = useMemo(() => {
    return clients.map(client => {
      // Calculate pending amount for this client in the selected range
      const clientInvoices = invoices.filter(inv => inv.clientName === client.name);
      
      const filteredInvoices = clientInvoices.filter(inv => {
        const invDate = inv.date.split('T')[0];
        const matchesFrom = !currentRange.from || invDate >= currentRange.from;
        const matchesTo = !currentRange.to || invDate <= currentRange.to;
        return matchesFrom && matchesTo;
      });

      const rangePending = filteredInvoices.reduce((acc, inv) => acc + (inv.pendingAmount || 0), 0);
      
      return {
        ...client,
        displayPending: currentRange.label === 'All Time' ? client.totalBorrowed : rangePending
      };
    }).filter(c => 
      c.displayPending > 0 && 
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.mobile && c.mobile.includes(searchQuery)))
    );
  }, [searchQuery, clients, invoices, currentRange]);

  const handleAdjustPayment = async () => {
    if (!adjustingClient || !paymentAmount) return;
    const user = auth.currentUser;
    if (!user) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const paymentInvoice: Invoice = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      clientId: adjustingClient.id,
      clientName: adjustingClient.name,
      clientMobile: adjustingClient.mobile,
      items: [{
        id: 'PAYMENT_ADJ',
        name: 'Unpaid Payment Received',
        quantity: 1,
        price: amount,
        total: amount,
        type: ItemType.SERVICE
      }],
      discount: 0,
      discountType: 'AMOUNT',
      discountAmount: 0,
      subtotal: amount,
      grandTotal: amount,
      paymentMethod: PaymentMethod.CASH,
      paidAmount: amount,
      pendingAmount: 0
    };

    try {
      const businessRef = businessId === 'default' 
        ? doc(db, 'users', user.uid) 
        : doc(db, 'users', user.uid, 'businesses', businessId);
      
      // 1. Save Payment Invoice
      await setDoc(doc(businessRef, 'invoices', paymentInvoice.id), paymentInvoice);

      // 2. Update Client Borrowed Amount
      await updateDoc(doc(businessRef, 'clients', adjustingClient.id), {
        totalBorrowed: Math.max(0, (adjustingClient.totalBorrowed || 0) - amount)
      });

      setLastPaymentInvoice(paymentInvoice);
      setIsSuccess(true);
      setAdjustingClient(null);
      setPaymentAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/invoices/${paymentInvoice.id}`);
    }
  };

  const handleCall = (mobile: string | undefined) => {
    if (!mobile) return;
    window.location.href = `tel:${mobile}`;
  };

  const handleWhatsAppShare = (client: Client) => {
    if (!client.mobile) return;
    const user = auth.currentUser;
    if (!user) return;

    // Find the latest unpaid invoice for this client
    const clientInvoices = invoices.filter(inv => 
      inv.clientName === client.name && inv.paymentMethod === PaymentMethod.BORROW
    );
    
    if (clientInvoices.length === 0) return;
    
    const latestInvoice = clientInvoices[0];
    const shareUrl = getInvoiceShareUrl(user.uid, latestInvoice.id, latestInvoice.businessId);
    const message = `Hello ${client.name}, you have an unpaid invoice of ${formatCurrency(client.totalBorrowed)} from ${config.shopName}. You can view the details here: ${shareUrl}`;
    
    const whatsappUrl = `https://wa.me/${formatWhatsAppNumber(client.mobile)}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (isSuccess && lastPaymentInvoice) {
    return (
      <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-slate-50 dark:bg-slate-950 z-[200] flex flex-col animate-in-view overflow-y-auto no-scrollbar pt-[env(safe-area-inset-top)]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
          <button onClick={() => { setIsSuccess(false); setLastPaymentInvoice(null); }} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><ArrowLeft className="w-4 h-4" /></button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Payment Receipt</h3>
        </div>
        
        <div className="flex-1 p-4 space-y-6">
          <div className="flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-4 border border-white/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">PAYMENT RECORDED</h2>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest mt-1">Receipt ID: {lastPaymentInvoice.id}</p>
          </div>

          <InvoiceDetail invoice={lastPaymentInvoice} config={config} />

          <button 
            onClick={() => { setIsSuccess(false); setLastPaymentInvoice(null); }}
            className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all outline-none ring-1 ring-brand-400"
          >
            Back to Ledger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-slate-50 dark:bg-slate-950 z-[200] flex flex-col animate-in-view pt-[env(safe-area-inset-top)]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><ArrowLeft className="w-4 h-4" /></button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Unpaid Ledger</h3>
        </div>
        <div className="flex items-center gap-2">
          {pendingClients.length > 0 && (
            <button 
              onClick={() => alert('Function coming soon')}
              className="p-2 bg-brand-500 text-white rounded-xl active:scale-90 transition-all flex items-center gap-2 border border-brand-400"
            >
              <Phone className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest pr-1">Call Alert</span>
            </button>
          )}
          <button 
            onClick={() => setIsDatePickerOpen(true)}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-brand-500 rounded-xl active:scale-90 transition-all"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      <DateRangePicker 
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onSelect={(range) => setCurrentRange(range)}
        currentRange={currentRange}
      />

      <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Search by name or mobile..." 
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold outline-none text-xs" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            autoFocus 
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-slate-50 dark:bg-slate-950">
        {pendingClients.map(client => (
          <div 
            key={client.id} 
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in-view"
          >
            <div className="flex-1 min-w-0 text-left" onClick={() => setSelectedClientProfile(client)}>
              <p className="font-bold text-sm text-slate-900 dark:text-white tracking-tight truncate">{client.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{client.mobile || 'No Mobile'}</p>
              <p className="text-xs font-bold text-red-500 mt-1">Unpaid: {formatCurrency(client.displayPending)}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(client); }}
                className="text-[8px] font-bold text-brand-500 uppercase tracking-widest mt-1 flex items-center gap-1 justify-start active:scale-95 transition-all"
              >
                <img src="/WhatsApp.pn.png" alt="WA" referrerPolicy="no-referrer" className="w-2.5 h-2.5" />
                Send Reminder
              </button>
            </div>
            <div className="flex flex-row gap-2" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => handleCall(client.mobile)}
                className={`p-2.5 rounded-xl transition-all active:scale-90 ${client.mobile ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-slate-100 text-slate-300 dark:bg-slate-800'}`}
                disabled={!client.mobile}
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {pendingClients.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Wallet2 className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">No Unpaid amounts</p>
          </div>
        )}
      </div>

      {adjustingClient && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[210] flex items-end justify-center px-4 pb-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl p-6 animate-in-view border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-xl"><Wallet2 className="w-4 h-4" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Unpaid Adjustment</h3>
              </div>
              <button onClick={() => setAdjustingClient(null)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full active:scale-90"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                <p className="font-bold text-slate-900 dark:text-white">{adjustingClient.name}</p>
                <p className="text-xs font-bold text-red-500 mt-1">Unpaid: {formatCurrency(adjustingClient.totalBorrowed)}</p>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Payment Amount (₹)</label>
                <input 
                  type="number" 
                  placeholder="Enter amount received"
                  className="w-full mt-2 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white text-lg ring-2 ring-transparent focus:ring-brand-500 transition-all"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <button 
              onClick={handleAdjustPayment}
              className="w-full bg-brand-500 text-white py-4 rounded-2xl font-bold uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2 border border-brand-400"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirm Unpaid Payment
            </button>
          </div>
        </div>
      )}

      {showCallAlert && (
         <CallAlertManager 
           onClose={() => setShowCallAlert(false)}
           unpaidClients={pendingClients}
           config={config}
         />
      )}

      {selectedClientProfile && (
        <ClientProfile 
          client={selectedClientProfile}
          invoices={invoices}
          config={config}
          onClose={() => setSelectedClientProfile(null)}
          onRecordPayment={setAdjustingClient}
          onSelect={(client) => {
            if (onClose) onClose();
            // We need to pass this up to App.tsx to change tab and pre-fill
            const billingTab = document.querySelector('button[aria-label="Billing"]') as HTMLButtonElement;
            if (billingTab) billingTab.click(); 
          }}
        />
      )}
    </div>
  );
};

export default PendingLedger;
