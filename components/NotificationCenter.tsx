import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Check, X, AlertTriangle, Package, FileText, ArrowRight, Volume2, ShieldCheck, RefreshCw, BellOff, BellRing } from 'lucide-react';
import { Product, Invoice, Tab, AppConfig, PaymentMethod, NotificationItem } from '../types';
import { requestNotificationPermission, getNotificationPermissionStatus, triggerWebNotification, playNotificationSound, showToast } from '../utils/notifications';
import { formatCurrency } from '../utils/helpers';

interface NotificationCenterProps {
  products: Product[];
  invoices: Invoice[];
  config: AppConfig;
  onNavigate: (tab: Tab, targetId?: string) => void;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  products,
  invoices,
  config,
  onNavigate,
  onClose,
}) => {
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermissionStatus());
  const [clearedIds, setClearedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cleared_notification_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'unpaid'>('all');

  const lowStockThreshold = config.lowStockThreshold || 5;

  // Auto-generate notifications from system state
  const computedNotifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    // 1. Low Stock Products
    products.forEach((p) => {
      if (p.type === 'PRODUCT' && p.stock !== null && p.stock <= lowStockThreshold) {
        const notifId = `stock-${p.id}-${p.stock}`;
        list.push({
          id: notifId,
          title: p.stock === 0 ? `OUT OF STOCK: ${p.name}` : `LOW STOCK: ${p.name}`,
          message: p.stock === 0 ? `Stock exhausted (0 PCS). Restock urgently!` : `Only ${p.stock} PCS left in inventory.`,
          timestamp: p.createdAt || Date.now(),
          type: p.stock === 0 ? 'error' : 'warning',
          read: clearedIds.includes(notifId),
          linkTab: Tab.INVENTORY,
          targetId: p.id,
        });
      }
    });

    // 2. Unpaid / Borrowed Invoices
    invoices.forEach((inv) => {
      if ((inv.paymentMethod === PaymentMethod.BORROW || inv.pendingAmount > 0) && inv.pendingAmount > 0) {
        const notifId = `borrow-${inv.id}-${inv.pendingAmount}`;
        list.push({
          id: notifId,
          title: `Pending Payment: ${inv.clientName}`,
          message: `Bill #${inv.id} has unpaid balance of ${formatCurrency(inv.pendingAmount)}.`,
          timestamp: new Date(inv.date).getTime() || Date.now(),
          type: 'alert',
          read: clearedIds.includes(notifId),
          linkTab: Tab.INVOICES,
          targetId: inv.id,
        });
      }
    });

    // Sort by newest timestamp
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [products, invoices, lowStockThreshold, clearedIds]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'stock') return computedNotifications.filter((n) => n.id.startsWith('stock-'));
    if (activeTab === 'unpaid') return computedNotifications.filter((n) => n.id.startsWith('borrow-'));
    return computedNotifications;
  }, [computedNotifications, activeTab]);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
  };

  const handleClearAll = () => {
    const allIds = computedNotifications.map((n) => n.id);
    setClearedIds(allIds);
    try {
      localStorage.setItem('cleared_notification_ids', JSON.stringify(allIds));
    } catch {}
    showToast('All notifications marked as read', 'info', false);
  };

  const handleItemClick = (n: NotificationItem) => {
    if (!clearedIds.includes(n.id)) {
      const next = [...clearedIds, n.id];
      setClearedIds(next);
      try {
        localStorage.setItem('cleared_notification_ids', JSON.stringify(next));
      } catch {}
    }
    onClose();
    if (n.linkTab) {
      onNavigate(n.linkTab, n.targetId);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] flex justify-end animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-100 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Notifications & Alerts</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">नोटीफिकेशन्स Center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Web Push Permission Banner */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Phone/Device Notifications
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${permissionStatus === 'granted' ? 'bg-emerald-100 text-emerald-600' : permissionStatus === 'denied' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              {permissionStatus === 'granted' ? 'ACTIVE' : permissionStatus === 'denied' ? 'BLOCKED' : 'NOT ENABLED'}
            </span>
          </div>

          {permissionStatus !== 'granted' ? (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-2xl space-y-2">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                Aapko important low-stock warnings aur payment alerts phone par milne ke liye browser notification enable karein.
              </p>
              <button
                onClick={handleRequestPermission}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold uppercase tracking-widest text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
              >
                <Bell className="w-3.5 h-3.5" /> Turn On Phone Notifications / ऑन करें
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Device notifications enabled for stock & payment alerts.</span>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-3 gap-2 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'all' ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-400'}`}
          >
            All ({computedNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'stock' ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-400'}`}
          >
            Stock Alerts ({computedNotifications.filter(n => n.id.startsWith('stock-')).length})
          </button>
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'unpaid' ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-400'}`}
          >
            Pending Due ({computedNotifications.filter(n => n.id.startsWith('borrow-')).length})
          </button>

          {computedNotifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pb-2.5"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => {
              const isRead = n.read;
              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                    isRead
                      ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 opacity-60'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      n.type === 'error' ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : n.type === 'warning' ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' : 'bg-orange-50 text-orange-500 dark:bg-orange-500/10'
                    }`}>
                      {n.id.startsWith('stock-') ? <Package className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">{n.title}</h4>
                        {!isRead && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest flex items-center gap-1">
                          View Details <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center opacity-40 p-6 space-y-3">
              <BellOff className="w-12 h-12 text-slate-400" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">No active notifications</p>
                <p className="text-[10px] text-slate-400 mt-1">Stock alerts and pending payment reminders will show up here.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default NotificationCenter;
