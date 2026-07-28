
import React, { useState, useMemo } from 'react';
import { X, Calendar, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTranslation } from '../utils/translations';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (range: DateRange) => void;
  currentRange?: DateRange;
  language?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ isOpen, onClose, onSelect, currentRange, language = 'hinglish' }) => {
  const t = getTranslation(language);
  const [customFrom, setCustomFrom] = useState(currentRange?.from || '');
  const [customTo, setCustomTo] = useState(currentRange?.to || '');
  const [showCustom, setShowCustom] = useState(false);

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

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const displayFormat = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const options = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Today
    const todayRange = { from: formatDate(today), to: formatDate(today), label: 'Today' };
    
    // Yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayRange = { from: formatDate(yesterday), to: formatDate(yesterday), label: 'Yesterday' };
    
    // This week (Monday to Sunday)
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const thisWeekRange = { from: formatDate(monday), to: formatDate(sunday), label: 'This week' };
    
    // Last Week
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    const lastWeekRange = { from: formatDate(lastMonday), to: formatDate(lastSunday), label: 'Last Week' };
    
    // Last 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const last7DaysRange = { from: formatDate(sevenDaysAgo), to: formatDate(today), label: 'Last 7 days' };
    
    // This month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const thisMonthRange = { from: formatDate(firstDayOfMonth), to: formatDate(lastDayOfMonth), label: 'This month' };
    
    // Last Month
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthRange = { from: formatDate(firstDayOfLastMonth), to: formatDate(lastDayOfLastMonth), label: 'Last Month' };
    
    // This quarter
    const currentQuarter = Math.floor(today.getMonth() / 3);
    const firstDayOfQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
    const lastDayOfQuarter = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
    const thisQuarterRange = { from: formatDate(firstDayOfQuarter), to: formatDate(lastDayOfQuarter), label: 'This quarter' };
    
    // Last quarter
    const firstDayOfLastQuarter = new Date(today.getFullYear(), (currentQuarter - 1) * 3, 1);
    const lastDayOfLastQuarter = new Date(today.getFullYear(), currentQuarter * 3, 0);
    const lastQuarterRange = { from: formatDate(firstDayOfLastQuarter), to: formatDate(lastDayOfLastQuarter), label: 'Last quarter' };
    
    // Current fiscal year (April 1st to March 31st)
    let fiscalYearStart;
    if (today.getMonth() < 3) { // Jan, Feb, Mar
      fiscalYearStart = new Date(today.getFullYear() - 1, 3, 1);
    } else {
      fiscalYearStart = new Date(today.getFullYear(), 3, 1);
    }
    const fiscalYearEnd = new Date(fiscalYearStart.getFullYear() + 1, 2, 31);
    const currentFiscalYearRange = { from: formatDate(fiscalYearStart), to: formatDate(fiscalYearEnd), label: 'Current fiscal year' };
    
    // Previous fiscal year
    const prevFiscalYearStart = new Date(fiscalYearStart.getFullYear() - 1, 3, 1);
    const prevFiscalYearEnd = new Date(fiscalYearStart.getFullYear(), 2, 31);
    const previousFiscalYearRange = { from: formatDate(prevFiscalYearStart), to: formatDate(prevFiscalYearEnd), label: 'Previous fiscal year' };
    
    // Last 365 Days
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(today.getDate() - 364);
    const last365DaysRange = { from: formatDate(oneYearAgo), to: formatDate(today), label: 'Last 365 Days' };

    return [
      todayRange,
      yesterdayRange,
      thisWeekRange,
      lastWeekRange,
      last7DaysRange,
      thisMonthRange,
      lastMonthRange,
      thisQuarterRange,
      lastQuarterRange,
      currentFiscalYearRange,
      previousFiscalYearRange,
      last365DaysRange
    ];
  }, []);

  const isSelected = (range: DateRange) => {
    return currentRange?.from === range.from && currentRange?.to === range.to;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 w-full h-screen top-0 left-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)]">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] border-t sm:border border-slate-100 dark:border-slate-800"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-2xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t.selectDate}</h3>
              </div>
              <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl active:scale-90 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelect(option);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                    isSelected(option) 
                      ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30' 
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-bold ${isSelected(option) ? 'text-brand-500 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                      {getLocalizedLabel(option.label)}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {displayFormat(option.from)} - {displayFormat(option.to)}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected(option) ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    {isSelected(option) && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>
              ))}

              {/* Custom Option */}
              <div className={`rounded-2xl border transition-all ${
                showCustom || (currentRange?.label === 'Custom')
                  ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
              }`}>
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="text-left">
                    <p className={`text-sm font-bold ${(showCustom || currentRange?.label === 'Custom') ? 'text-brand-500 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                      {t.customRange || 'Custom'}
                    </p>
                    {currentRange?.label === 'Custom' && (
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {displayFormat(currentRange.from)} - {displayFormat(currentRange.to)}
                      </p>
                    )}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    currentRange?.label === 'Custom' ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    {currentRange?.label === 'Custom' && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {showCustom && (
                  <div className="p-4 pt-0 space-y-4 animate-in-view">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.fromLabel || 'From'}</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                          <input 
                            type="date" 
                            className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none" 
                            value={customFrom} 
                            onChange={e => setCustomFrom(e.target.value)} 
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.toLabel || 'To'}</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                          <input 
                            type="date" 
                            className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none" 
                            value={customTo} 
                            onChange={e => setCustomTo(e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={!customFrom || !customTo}
                      onClick={() => {
                        onSelect({ from: customFrom, to: customTo, label: 'Custom' });
                        onClose();
                      }}
                      className="w-full py-3.5 bg-brand-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all disabled:opacity-50 border border-brand-400"
                    >
                      {t.applyCustomRange || 'Apply Custom Range'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DateRangePicker;
