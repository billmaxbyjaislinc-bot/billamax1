
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  UserPlus, 
  Phone, 
  MapPin, 
  ChevronRight, 
  ArrowLeft,
  User,
  Wallet2,
  Contact2,
  ExternalLink,
  Check,
  CheckCircle
} from 'lucide-react';
import { Client, Invoice, AppConfig, ItemType, PaymentMethod } from '../types';
import { generateId, formatCurrency } from '../utils/helpers';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import ClientProfile from './ClientProfile';
import InvoiceDetail from './InvoiceDetail';

interface ClientSelectorProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  invoices?: Invoice[];
  setInvoices?: React.Dispatch<React.SetStateAction<Invoice[]>>;
  config?: AppConfig;
  onSelect?: (client: Client) => void;
  onClose: () => void;
  title?: string;
  directSelect?: boolean;
  businessId?: string;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({ 
  clients, 
  setClients, 
  invoices = [],
  setInvoices,
  config,
  onSelect, 
  onClose, 
  title = "Select Customer",
  directSelect = false,
  businessId = 'default'
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'contacts'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', mobile: '', address: '' });
  const [phoneContacts, setPhoneContacts] = useState<any[]>([]);
  const [isFetchingContacts, setIsFetchingContacts] = useState(false);
  const [hasFetchedOnMount, setHasFetchedOnMount] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [importStatus, setImportStatus] = useState<{ count: number; visible: boolean } | null>(null);

  const [adjustingClient, setAdjustingClient] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [lastPaymentInvoice, setLastPaymentInvoice] = useState<Invoice | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  useEffect(() => {
    setIsIframe(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'contacts' && phoneContacts.length === 0 && !hasFetchedOnMount) {
      fetchPhoneContacts();
      setHasFetchedOnMount(true);
    }
  }, [activeTab, phoneContacts.length, hasFetchedOnMount]);

  const filteredClients = useMemo(() => {
    const filtered = clients.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.mobile && c.mobile.includes(searchQuery))
    );
    return [...filtered].sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeB - timeA;
    });
  }, [searchQuery, clients]);

  const filteredPhoneContacts = useMemo(() => 
    phoneContacts.filter(c => 
      (c.name?.[0] || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.tel?.[0] || '').includes(searchQuery)
    ),
    [searchQuery, phoneContacts]
  );

  const fetchPhoneContacts = async () => {
    try {
      setIsFetchingContacts(true);
      let contacts: any[] = [];

      if ('contacts' in navigator && typeof (navigator as any).contacts?.select === 'function') {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        contacts = await (navigator as any).contacts.select(props, opts);
      } else {
        // Fallback or warning if device doesn't support Web Contacts API
        setShowAddForm(true);
        setIsFetchingContacts(false);
        return;
      }
      
      if (!contacts || contacts.length === 0) {
        setIsFetchingContacts(false);
        return;
      }

      setPhoneContacts(contacts);

      // Save new contacts to Firestore automatically
      const user = auth.currentUser;
      if (user && contacts.length > 0) {
        const newContactsToSave = contacts.filter((contact: any) => {
          const mobile = contact.tel?.[0]?.replace(/[^0-9]/g, '') || '';
          return mobile && !clients.some(c => c.mobile === mobile);
        });

        if (newContactsToSave.length > 0) {
          const businessRef = businessId === 'default' 
            ? doc(db, 'users', user.uid) 
            : doc(db, 'users', user.uid, 'businesses', businessId);

          await Promise.all(newContactsToSave.map((contact: any) => {
            const name = contact.name?.[0] || 'Unknown';
            const mobile = contact.tel?.[0]?.replace(/[^0-9]/g, '') || '';
            const newClient: Client = {
              id: generateId(),
              name,
              mobile,
              totalBorrowed: 0
            };
            return setDoc(doc(businessRef, 'clients', newClient.id), newClient);
          }));

          setImportStatus({ count: newContactsToSave.length, visible: true });
          setTimeout(() => setImportStatus(null), 3000);
        } else {
          setImportStatus({ count: 0, visible: true });
          setTimeout(() => setImportStatus(null), 2000);
        }
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setIsFetchingContacts(false);
    }
  };

  const handleContactSelect = (contact: any) => {
    const name = contact.name?.[0] || 'Unknown';
    const mobile = contact.tel?.[0]?.replace(/[^0-9]/g, '') || '';
    
    const client: Client = {
      id: generateId(),
      name,
      mobile,
      totalBorrowed: 0,
      createdAt: Date.now()
    };

    if (directSelect && onSelect) {
      onSelect(client);
      onClose();
    } else {
      setSelectedClient(client);
    }
  };

  const handleClientClick = (client: Client) => {
    if (directSelect && onSelect) {
      onSelect(client);
      onClose();
    } else {
      setSelectedClient(client);
    }
  };

  const handleAddClient = async () => {
    if (!formData.name) return;
    const user = auth.currentUser;
    if (!user) return;

    const businessRef = businessId === 'default' 
      ? doc(db, 'users', user.uid) 
      : doc(db, 'users', user.uid, 'businesses', businessId);

    const newClient: Client = {
      id: generateId(),
      name: formData.name,
      mobile: formData.mobile,
      address: formData.address,
      totalBorrowed: 0,
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(businessRef, 'clients', newClient.id), newClient);
      setShowAddForm(false);
      setFormData({ name: '', mobile: '', address: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/clients/${newClient.id}`);
    }
  };

  if (showAddForm) {
    return (
      <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-white dark:bg-slate-900 z-[200] flex flex-col animate-in-view pt-[env(safe-area-inset-top)]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setShowAddForm(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><ArrowLeft className="w-4 h-4" /></button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Add New Customer</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar bg-slate-50 dark:bg-slate-950">
          <div className="space-y-5">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
              <input 
                type="text"
                placeholder="Enter full name"
                className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                autoFocus
              />
            </div>
            
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
              <input 
                type="tel"
                placeholder="Enter 10-digit number"
                className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                value={formData.mobile}
                onChange={e => setFormData({...formData, mobile: e.target.value.replace(/[^0-9]/g, '')})}
              />
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Address</label>
              <textarea 
                placeholder="Enter full address"
                rows={3}
                className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all resize-none"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={handleAddClient}
            className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-[10px] border border-brand-400"
          >
            <UserPlus className="w-4 h-4" /> Save Customer
          </button>
        </div>
      </div>
    );
  }

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

          <InvoiceDetail invoice={lastPaymentInvoice} config={config!} />

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

  if (selectedClient) {
    return (
      <ClientProfile 
        client={selectedClient}
        invoices={invoices}
        config={config!}
        onClose={() => setSelectedClient(null)}
        onSelect={(client) => {
          if (onSelect) onSelect(client);
          onClose();
        }}
        onRecordPayment={setAdjustingClient}
      />
    );
  }

  return (
    <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-white dark:bg-slate-900 z-[200] flex flex-col animate-in-view pt-[env(safe-area-inset-top)]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90"><X className="w-4 h-4" /></button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-1 flex sticky top-[calc(env(safe-area-inset-top)+60px)] z-10">
        <button 
          onClick={() => setActiveTab('clients')}
          className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'clients' ? 'bg-brand-500 text-white' : 'text-slate-400'}`}
        >
          Clients
        </button>
        <button 
          onClick={() => {
            setActiveTab('contacts');
            if (phoneContacts.length === 0) fetchPhoneContacts();
          }}
          className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg flex items-center justify-center gap-2 ${activeTab === 'contacts' ? 'bg-brand-500 text-white' : 'text-slate-400'}`}
        >
          <Contact2 className="w-3.5 h-3.5" />
          Contacts
        </button>
      </div>

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

      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar bg-slate-50 dark:bg-slate-950">
        {importStatus?.visible && (
          <div className="bg-emerald-500 text-white p-3 rounded-xl mb-4 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 animate-in slide-in-from-top-4">
             {importStatus.count > 0 ? (
               <><UserPlus className="w-4 h-4" /> {importStatus.count} Contacts Sync Successfully</>
             ) : (
               <><Check className="w-4 h-4" /> All contacts already up to date</>
             )}
          </div>
        )}

        {activeTab === 'clients' ? (
          <>
            {filteredClients.map(client => (
              <div 
                key={client.id} 
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 active:scale-[0.99] transition-all"
                onClick={() => handleClientClick(client)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-bold text-xs text-slate-900 dark:text-white tracking-tight truncate">{client.name}</p>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">{client.mobile || 'No Mobile'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            ))}
            {filteredClients.length === 0 && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No customers found</p>
                {!isIframe && (
                  <button 
                    onClick={() => setActiveTab('contacts')}
                    className="mt-6 flex items-center gap-2 px-6 py-3 bg-brand-50 rounded-xl font-bold text-[10px] uppercase tracking-widest text-brand-500 mx-auto active:scale-95 transition-all"
                  >
                    <Contact2 className="w-3.5 h-3.5" /> Import from Phone
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {isIframe ? (
              <div className="py-16 px-8 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
                  <Contact2 className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Feature Restricted</h4>
                <p className="text-[10px] font-semibold text-slate-400 leading-relaxed uppercase tracking-widest">
                  Browser security prevents contact access while in preview mode. Please open the app in a new tab to import your contacts.
                </p>
                  <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mt-6 flex items-center gap-2 px-6 py-3 bg-brand-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-brand-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                </button>
              </div>
            ) : isFetchingContacts ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fetching contacts...</p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-brand-50 dark:bg-brand-900/10 rounded-2xl border border-brand-100 dark:border-brand-800/30">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-400 rounded-xl">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-brand-900 dark:text-brand-400 uppercase tracking-widest">Sync Tip</h4>
                      <p className="text-[10px] font-semibold text-brand-600/70 dark:text-brand-400/60 mt-1 leading-relaxed">
                        To import all contacts at once, click "Select All" in the system contact picker.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={fetchPhoneContacts}
                    className="w-full mt-4 bg-brand-600 text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all outline-none ring-1 ring-brand-400"
                  >
                    Sync Device Contacts
                  </button>
                </div>

                {filteredPhoneContacts.map((contact, idx) => (
                  <div 
                    key={idx} 
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 active:scale-[0.99] transition-all"
                    onClick={() => handleContactSelect(contact)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-bold text-xs text-slate-900 dark:text-white tracking-tight truncate">{contact.name?.[0] || 'Unknown'}</p>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">{contact.tel?.[0] || 'No Number'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
                {filteredPhoneContacts.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                      <Contact2 className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No contacts found</p>
                    <button 
                      onClick={fetchPhoneContacts}
                      className="mt-4 text-[10px] font-bold text-brand-500 uppercase tracking-widest"
                    >
                      Retry Fetch
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => setShowAddForm(true)}
          className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
        >
          <Plus className="w-4 h-4" /> Add New Customer
        </button>
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
                <p className="text-xs font-bold text-red-500 mt-1">Unpaid: {formatCurrency(adjustingClient.totalBorrowed || 0)}</p>
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
              <CheckCircle className="w-5 h-5" /> Confirm Unpaid Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;
