
import React, { useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  Banknote, 
  CreditCard, 
  Clock, 
  Calendar,
  ArrowLeft,
  IndianRupee
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Invoice, PaymentMethod } from '../types';
import { formatCurrency } from '../utils/helpers';
import DateRangePicker, { DateRange } from './DateRangePicker';
import { useState } from 'react';

interface RevenueDetailViewProps {
  invoices: Invoice[];
  dateRange: string;
  onClose: () => void;
}

const RevenueDetailView: React.FC<RevenueDetailViewProps> = ({ invoices: allInvoices, dateRange: initialRange, onClose }) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentRange, setCurrentRange] = useState<DateRange>({
    from: '',
    to: '',
    label: initialRange
  });

  const filteredInvoices = useMemo(() => {
    if (currentRange.label === 'All Time' || !currentRange.from) return allInvoices;
    
    const getLocalDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return allInvoices.filter(inv => {
      const invLocalDate = getLocalDateString(new Date(inv.date));
      const matchesFrom = !currentRange.from || invLocalDate >= currentRange.from;
      const matchesTo = !currentRange.to || invLocalDate <= currentRange.to;
      return matchesFrom && matchesTo;
    });
  }, [allInvoices, currentRange]);

  const breakdown = useMemo(() => {
    let cash = 0;
    let online = 0;
    let pending = 0;

    filteredInvoices.forEach(inv => {
      if (inv.paymentMethod === PaymentMethod.ONLINE) {
        online += inv.paidAmount;
      } else if (inv.paymentMethod === PaymentMethod.CASH) {
        cash += inv.paidAmount;
      } else if (inv.paymentMethod === PaymentMethod.BORROW) {
        // Partial payments in BORROW are typically cash in this app's context
        cash += inv.paidAmount;
      }
      pending += inv.pendingAmount;
    });

    return { cash, online, pending, total: cash + online + pending };
  }, [filteredInvoices]);

  const chartData = useMemo(() => {
    // Group invoices by date (hour if today, day if range)
    const groups: Record<string, number> = {};
    
    filteredInvoices.forEach(inv => {
      const date = new Date(inv.date);
      const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      groups[label] = (groups[label] || 0) + inv.grandTotal;
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-50 dark:bg-slate-950 z-[150] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Revenue Analysis</h2>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3 h-3" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{currentRange.label}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsDatePickerOpen(true)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-brand-500 rounded-xl active:scale-90 transition-all"
          >
            <Calendar className="w-5 h-5" />
          </button>
          <div className="p-2.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      <DateRangePicker 
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onSelect={(range) => setCurrentRange(range)}
        currentRange={currentRange}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 sm:pb-24">
        {/* Chart Section */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Revenue Trend</h3>
            <p className="text-xs font-bold text-brand-500">{formatCurrency(breakdown.total)} Total</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3553CD" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3553CD" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: 'none',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3553CD" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Section */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Payment Breakdown</h4>
          
          <BreakdownCard 
            icon={<Banknote className="w-5 h-5" />}
            label="Cash Collection"
            value={breakdown.cash}
            color="text-emerald-500"
            bg="bg-emerald-50 dark:bg-emerald-500/10"
            percentage={breakdown.total > 0 ? (breakdown.cash / breakdown.total) * 100 : 0}
          />

          <BreakdownCard 
            icon={<CreditCard className="w-5 h-5" />}
            label="Online / Bank"
            value={breakdown.online}
            color="text-brand-500"
            bg="bg-brand-50 dark:bg-brand-500/10"
            percentage={breakdown.total > 0 ? (breakdown.online / breakdown.total) * 100 : 0}
          />

          <BreakdownCard 
            icon={<Clock className="w-5 h-5" />}
            label="Unpaid"
            value={breakdown.pending}
            color="text-orange-500"
            bg="bg-orange-50 dark:bg-orange-500/10"
            percentage={breakdown.total > 0 ? (breakdown.pending / breakdown.total) * 100 : 0}
          />
        </div>

        {/* Total Summary */}
        <div className="bg-slate-900 dark:bg-brand-500 p-6 rounded-3xl text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50 mb-1">Total Business</p>
              <h3 className="text-3xl font-bold tracking-tighter">{formatCurrency(breakdown.total)}</h3>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BreakdownCard = ({ icon, label, value, color, bg, percentage }: any) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 ${bg} ${color} rounded-xl`}>{icon}</div>
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{label}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{percentage.toFixed(1)}% of total</p>
        </div>
      </div>
      <p className={`text-base font-bold ${color}`}>{formatCurrency(value)}</p>
    </div>
    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color.replace('text-', 'bg-')} transition-all duration-1000`} 
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

export default RevenueDetailView;
