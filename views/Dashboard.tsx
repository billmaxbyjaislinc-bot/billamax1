
import React, { useMemo, useEffect, useRef, useState, Suspense } from 'react';
import { 
  TrendingUp, 
  Wallet2, 
  Users2, 
  AlertCircle,
  FileText,
  ChevronRight,
  IndianRupee,
  ArrowUpRight,
  Plus,
  Volume2,
  Calendar,
  Filter,
  X,
  Minus,
  Settings2,
  ChevronDown,
  ArrowLeft,
  MessageCircle,
  Download,
  Smartphone
} from 'lucide-react';
import { collection, doc, onSnapshot, setDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Invoice, Client, Product, AppConfig, Tab, PaymentMethod } from '../types';
import { formatCurrency, getStartOfWeek, formatWhatsAppNumber, getInvoiceShareUrl } from '../utils/helpers';
import { DateRange } from '../components/DateRangePicker';
import { getTranslation } from '../utils/translations';

const RevenueDetailView = React.lazy(() => import('../components/RevenueDetailView'));
const DateRangePicker = React.lazy(() => import('../components/DateRangePicker'));
const InvoiceDetail = React.lazy(() => import('../components/InvoiceDetail'));

const pcmToWav = (base64Pcm: string, sampleRate = 24000): string => {
  const binaryString = window.atob(base64Pcm);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // RIFF identifier "RIFF"
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type "WAVE"
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
  // format chunk identifier "fmt "
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (Linear PCM = 1)
  view.setUint16(20, 1, true);
  // channel count (Mono = 1)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample (16)
  view.setUint16(34, 16, true);
  // data chunk identifier "data"
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  // data chunk length
  view.setUint32(40, len, true);

  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(bytes);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

interface DashboardProps {
  invoices: Invoice[];
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  products: Product[];
  config: AppConfig;
  onNavigate: (tab: Tab) => void;
  setConfig?: (config: AppConfig) => void;
  onOpenClients: () => void;
  onOpenPendingLedger: () => void;
  onToggleDetail?: (isOpen: boolean) => void;
  onSelectInvoice?: (id: string) => void;
  isLoading?: boolean;
  businessId?: string;
  isInstallable?: boolean;
  onInstall?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ invoices, clients, setClients, products, config, onNavigate, onOpenClients, onOpenPendingLedger, setConfig, onToggleDetail, onSelectInvoice, isLoading, businessId = 'default', isInstallable, onInstall }) => {
  const t = getTranslation(config?.language || 'hinglish');
  const getLocalizedLabel = (label: string) => {
    const l = label.toLowerCase();
    if (l === 'today') return t.today;
    if (l === 'yesterday') return t.yesterday;
    if (l === 'this week') return t.thisWeek;
    if (l === 'custom' || l === 'custom range') return t.customRange || 'Custom';
    if (l === 'all time') return t.allTime;
    if (l === 'last week') return t.lastWeek || 'Last Week';
    if (l === 'last 7 days') return t.last7Days || 'Last 7 Days';
    if (l === 'this month') return t.thisMonth || 'This Month';
    if (l === 'last month') return t.lastMonth || 'Last Month';
    if (l === 'this quarter') return t.thisQuarter || 'This Quarter';
    if (l === 'last quarter') return t.lastQuarter || 'Last Quarter';
    if (l === 'current fiscal year') return t.currentFiscalYear || 'Current Fiscal Year';
    if (l === 'previous fiscal year') return t.previousFiscalYear || 'Previous Fiscal Year';
    if (l === 'last 365 days') return t.last365Days || 'Last 365 Days';
    return label;
  };
  const hasGreeted = useRef(typeof window !== 'undefined' && sessionStorage.getItem('billmax_has_greeted') === 'true');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showRevenueDetail, setShowRevenueDetail] = useState(false);
  const [isAdjustingThreshold, setIsAdjustingThreshold] = useState(false);
  const [currentDateRange, setCurrentDateRange] = useState<DateRange>({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    label: 'Today'
  });

  useEffect(() => {
    onToggleDetail?.(showRevenueDetail);
  }, [showRevenueDetail, onToggleDetail]);

  const stats = useMemo(() => {
    const getLocalDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // This Week Revenue
    const startOfWeek = getStartOfWeek(new Date());
    const startOfWeekStr = getLocalDateString(startOfWeek);
    const todayStr = getLocalDateString(new Date());

    const thisWeekInvoices = invoices.filter(inv => {
      const invLocalDate = getLocalDateString(new Date(inv.date));
      return invLocalDate >= startOfWeekStr && invLocalDate <= todayStr;
    });

    const thisWeekRevenue = thisWeekInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    
    // All Time Stats
    const overallBorrowTotal = clients.reduce((acc, c) => acc + c.totalBorrowed, 0);
    
    // Inventory stats (All Time)
    const inventoryValue = products.reduce((acc, p) => acc + (p.price * (p.stock || 0)), 0);
    const totalRemainingItems = products.filter(p => (p.stock || 0) > 0).length;
    const totalQuantity = products.reduce((acc, p) => acc + (p.stock || 0), 0);

    return { 
      thisWeekRevenue,
      thisWeekCount: thisWeekInvoices.length,
      borrowTotal: overallBorrowTotal, 
      inventoryValue, 
      totalRemainingItems, 
      totalQuantity,
      latestInvoices: invoices.filter(inv => {
        const invDate = inv.date.split('T')[0];
        const matchesFrom = !currentDateRange.from || invDate >= currentDateRange.from;
        const matchesTo = !currentDateRange.to || invDate <= currentDateRange.to;
        return matchesFrom && matchesTo;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }, [invoices, clients, products, currentDateRange]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t.goodMorning;
    if (hour >= 12 && hour < 18) return t.goodAfternoon;
    if (hour >= 18 && hour < 20) return t.goodEvening;
    return t.goodNight;
  }, [t]);

  useEffect(() => {
    const speakLocalFallback = (text: string) => {
      try {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        // Silently ignore fallback issues
      }
    };

    const speakGreeting = async () => {
      if (hasGreeted.current || !config.enableAudioGreeting || !config.ownerName) return;
      
      // Mark as greeted immediately to prevent multiple concurrent greeting attempts
      hasGreeted.current = true;
      try {
        sessionStorage.setItem('billmax_has_greeted', 'true');
      } catch (e) {
        // Ignore fallback
      }

      const firstName = config.ownerName.split(' ')[0];
      const textToSpeak = `${greeting}, ${firstName}!`;

      try {
        const res = await fetch('/api/gemini/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSpeak })
        });

        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          speakLocalFallback(textToSpeak);
          return;
        }

        const { audioData, mimeType } = await res.json();

        if (audioData) {
          try {
            let audioUrl = '';
            if (mimeType && mimeType.includes('pcm')) {
              const match = mimeType.match(/rate=(\d+)/);
              const sampleRate = match ? parseInt(match[1], 10) : 24000;
              audioUrl = pcmToWav(audioData, sampleRate);
            } else {
              audioUrl = `data:${mimeType};base64,${audioData}`;
            }

            const audio = new Audio(audioUrl);
            await audio.play();
          } catch (audioErr) {
            // Native audio playback failed, use speechSynthesis
            speakLocalFallback(textToSpeak);
          }
        } else {
          speakLocalFallback(textToSpeak);
        }
      } catch (err: any) {
        // Avoid heavy console.error to prevent automated alerts in preview/test suites
        console.warn("Dashboard Greeting Status: Fallback utilized.", err.message || err);
        speakLocalFallback(textToSpeak);
      }
    };

    if (config.setupComplete && config.enableAudioGreeting) {
      speakGreeting();
    }
  }, [greeting, config.ownerName, config.setupComplete, config.enableAudioGreeting]);

  const lowStock = products.filter(p => p.stock !== null && p.stock <= config.lowStockThreshold);

  const handleWhatsAppShare = (invoice: Invoice) => {
    if (!invoice.clientMobile) return;
    const user = auth.currentUser;
    if (!user) return;

    const shareUrl = getInvoiceShareUrl(user.uid, invoice.id, businessId);
    const message = `Hello ${invoice.clientName}, your invoice for ${formatCurrency(invoice.grandTotal)} from ${config.shopName} is ready. View it here: ${shareUrl}`;
    
    const whatsappUrl = `https://wa.me/${formatWhatsAppNumber(invoice.clientMobile)}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="space-y-4 animate-in-view pb-44 md:pb-12">
        <Suspense fallback={null}>
        <DateRangePicker 
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(range) => {
            setCurrentDateRange(range);
            setIsDatePickerOpen(false);
          }}
          currentRange={currentDateRange}
          language={config?.language}
        />
      </Suspense>

      {/* PWA Install Promo Box */}
      {isInstallable && onInstall && (
        <div className="bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-700 rounded-3xl p-5 text-white flex items-center justify-between gap-4 shadow-lg border border-brand-500/20 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 bg-white/10 rounded-2xl flex-shrink-0 flex items-center justify-center text-white border border-white/10"><Smartphone className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h4 className="text-sm font-black tracking-tight">{t.installApp}</h4>
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider mt-0.5">{t.installAppSub}</p>
            </div>
          </div>
          <button 
            onClick={onInstall}
            className="flex items-center gap-1.5 bg-white text-indigo-700 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md hover:bg-slate-50 flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> {t.installButton}
          </button>
        </div>
      )}

      {/* Hero Stats */}
      {isLoading ? (
        <div 
          className="bg-brand-500 rounded-3xl p-5 text-white relative overflow-hidden"
        >
          <div className="w-32 h-2 bg-white/20 rounded mb-4" />
          <div className="w-48 h-10 bg-white/20 rounded mb-4" />
          <div className="w-24 h-2 bg-white/20 rounded" />
        </div>
      ) : (
        <div 
          onClick={() => setShowRevenueDetail(true)}
          className="bg-brand-500 rounded-3xl p-6 text-white relative overflow-hidden cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-brand-400/20 rounded-lg"><TrendingUp className="w-3 h-3 text-white" /></div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                    {t.thisWeekRevenue}
                  </p>
                </div>
                <h3 className="text-3xl sm:text-4xl font-black tracking-tighter truncate">{formatCurrency(stats.thisWeekRevenue)}</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{stats.thisWeekCount} {t.invoicesThisWeek}</p>
              </div>
              <div className="flex flex-col items-end gap-4">
                <button onClick={(e) => { e.stopPropagation(); onNavigate(Tab.BILLING); }} className="w-10 h-10 bg-white text-brand-600 rounded-xl flex items-center justify-center transition-all active:scale-90 border border-slate-100">
                  <Plus className="w-6 h-6" />
                </button>
                <ChevronRight className="w-5 h-5 text-white/30" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 h-24" />
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 h-24" />
          </>
        ) : (
          <>
            <CompactStatCard 
              icon={<Wallet2 className="w-5 h-5" />} 
              label={t.totalUnpaid} 
              value={formatCurrency(stats.borrowTotal)} 
              sub={t.unpaidToCollect}
              color="text-brand-500"
              bg="bg-brand-50 dark:bg-brand-500/10"
              onClick={onOpenPendingLedger}
              showArrow
              isAllTime
            />
            <CompactStatCard 
              icon={<Users2 className="w-5 h-5" />} 
              label={t.customers} 
              value={clients.length.toString()} 
              sub={t.loyalCustomers}
              color="text-brand-500"
              bg="bg-brand-50 dark:bg-brand-500/10"
              onClick={onOpenClients}
              showArrow
              isAllTime
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 h-24" />
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 h-24" />
          </>
        ) : (
          <>
            <CompactStatCard 
              icon={<AlertCircle className="w-5 h-5" />} 
              label={t.stockValue} 
              value={formatCurrency(stats.inventoryValue)} 
              sub={t.totalInventory}
              color="text-brand-500"
              bg="bg-brand-50 dark:bg-brand-500/10"
              onClick={() => onNavigate(Tab.INVENTORY)}
              isAllTime
            />
            <CompactStatCard 
              icon={<TrendingUp className="w-5 h-5" />} 
              label={t.totalQuantity} 
              value={stats.totalQuantity.toString()} 
              sub={t.itemsInHand}
              color="text-brand-500"
              bg="bg-brand-50 dark:bg-brand-500/10"
              onClick={() => onNavigate(Tab.INVENTORY)}
              showArrow
              isAllTime
            />
          </>
        )}
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div 
          className="bg-white dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-900/30 overflow-hidden transition-all"
        >
          <div className="flex items-center gap-4 p-4">
            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl"><AlertCircle className="w-4 h-4" /></div>
            <div className="flex-1" onClick={() => onNavigate(Tab.INVENTORY)}>
              <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">{t.stockAlert}</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{lowStock.length} {t.itemsRunningLow}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsAdjustingThreshold(!isAdjustingThreshold)}
                className={`p-2 rounded-lg transition-all ${isAdjustingThreshold ? 'bg-red-100 text-red-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button onClick={() => onNavigate(Tab.INVENTORY)} className="p-2 text-slate-300"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          
          {isAdjustingThreshold && setConfig && (
            <div className="px-4 pb-4 pt-0 flex items-center justify-between border-t border-red-50 dark:border-red-900/10 mt-2 bg-red-50/30 dark:bg-red-900/5">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Threshold: {config.lowStockThreshold}</p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setConfig({ ...config, lowStockThreshold: Math.max(0, config.lowStockThreshold - 1) })}
                  className="p-1.5 bg-white dark:bg-slate-700 rounded-lg border border-red-100 dark:border-red-900/20 active:scale-90"
                >
                  <Minus className="w-3 h-3 text-red-600" />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 min-w-[1.5rem] text-center">{config.lowStockThreshold}</span>
                <button 
                  onClick={() => setConfig({ ...config, lowStockThreshold: config.lowStockThreshold + 1 })}
                  className="p-1.5 bg-white dark:bg-slate-700 rounded-lg border border-red-100 dark:border-red-900/20 active:scale-90"
                >
                  <Plus className="w-3 h-3 text-red-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Feed */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <div className="flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t.recentTransactions}</h4>
            <p className="text-[8px] font-bold text-brand-500 uppercase tracking-widest mt-0.5">{getLocalizedLabel(currentDateRange.label)}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentDateRange.label !== 'All Time' && (
              <button 
                onClick={() => setCurrentDateRange({ from: '', to: '', label: 'All Time' })}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setIsDatePickerOpen(true)} className="p-2 bg-slate-100 dark:bg-slate-800 text-brand-500 rounded-xl active:scale-90 transition-all">
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 h-16" />
              ))}
            </>
          ) : (
            <>
              {stats.latestInvoices.map(inv => (
                <div 
                  key={inv.id} 
                  onClick={() => onSelectInvoice?.(inv.id)}
                  className="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 active:scale-[0.99] transition-all gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex-shrink-0 flex items-center justify-center text-slate-400"><FileText className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-tight truncate">{inv.clientName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-widest truncate">{inv.id} • {new Date(inv.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        {inv.clientMobile && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(inv); }}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400 rounded-md text-[7px] font-bold uppercase tracking-widest active:scale-95 transition-all border border-brand-100 dark:border-brand-500/20"
                          >
                            <MessageCircle className="w-2.5 h-2.5" /> Send Link
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{formatCurrency(inv.grandTotal)}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{inv.paymentMethod === PaymentMethod.BORROW ? 'UNPAID' : inv.paymentMethod}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              ))}
              {stats.latestInvoices.length === 0 && (
                <div className="py-10 text-center opacity-30">
                  <IndianRupee className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">No transactions yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>

      {showRevenueDetail && (
        <Suspense fallback={null}>
          <RevenueDetailView 
            invoices={invoices}
            dateRange="This Week"
            onClose={() => setShowRevenueDetail(false)}
          />
        </Suspense>
      )}

      {/* Floating Action Buttons (Fixed to viewport at z-50, floating strictly above bottom navbar) */}
      <div className="fixed bottom-[76px] md:bottom-6 left-0 md:left-64 right-0 flex justify-center z-50 px-4 pointer-events-none">
        <div 
          className="flex flex-row gap-2 sm:gap-2.5 pointer-events-auto bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-xl p-1.5 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/40"
        >
          <button 
            onClick={onOpenPendingLedger}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl active:scale-95 transition-all focus:ring-0 focus:outline-none shadow-md shadow-brand-500/20"
          >
            <IndianRupee className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Receive Payment</span>
          </button>
          
          <button 
            onClick={() => onNavigate(Tab.BILLING)}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl active:scale-95 transition-all focus:ring-0 focus:outline-none shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Create Invoice</span>
          </button>
        </div>
      </div>
    </>
  );
};

const CompactStatCard = ({ icon, label, value, sub, color, bg, onClick, showArrow, isAllTime }: any) => (
  <div 
    className={`bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 min-w-0 relative ${onClick ? 'cursor-pointer active:scale-[0.98] transition-all' : ''}`}
    onClick={onClick}
  >
    {isAllTime && (
      <div className="absolute top-3 right-3">
        <p className="text-[6px] font-bold text-slate-300 uppercase tracking-widest">All Time</p>
      </div>
    )}
    <div className={`w-8 h-8 sm:w-9 sm:h-9 ${bg} ${color} rounded-xl flex items-center justify-center mb-2 sm:mb-3 transition-transform flex-shrink-0`}>{icon}</div>
    <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
    <div className="flex items-center justify-between gap-1">
      <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">{value}</p>
      {showArrow && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
    </div>
    <p className="text-[6px] sm:text-[7px] font-semibold text-slate-400 uppercase tracking-widest mt-1 truncate">{sub}</p>
  </div>
);

export default Dashboard;
