import React, { useMemo, useState } from 'react';
import { 
  X, 
  ArrowLeft,
  Box,
  TrendingUp,
  Tag,
  History,
  AlertTriangle,
  Barcode,
  Plus,
  Minus,
  Save,
  Loader2,
  Calendar,
  FileText,
  DollarSign,
  Edit2
} from 'lucide-react';
import { Product, Invoice, AppConfig, ItemType } from '../types';
import { formatCurrency } from '../utils/helpers';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';

interface ProductProfileProps {
  product: Product;
  invoices: Invoice[];
  config: AppConfig;
  onClose: () => void;
  onUpdateProduct: (updatedProduct: Product) => void;
  onEdit?: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
  businessId?: string;
}

const ProductProfile: React.FC<ProductProfileProps> = ({ 
  product, 
  invoices, 
  config, 
  onClose, 
  onUpdateProduct,
  onEdit,
  onViewInvoice,
  businessId = 'default' 
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'details'>('timeline');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADD' | 'REDUCE' | 'SET'>('ADD');
  const [isSaving, setIsSaving] = useState(false);

  // Find all sales of this product from invoices
  const salesHistory = useMemo(() => {
    const history: { date: string; invoiceId: string; clientName: string; qty: number; price: number }[] = [];
    
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        // Match by item ID or name
        if (item.id === product.id || item.name.toLowerCase() === product.name.toLowerCase()) {
          history.push({
            date: inv.date,
            invoiceId: inv.id,
            clientName: inv.clientName,
            qty: item.quantity,
            price: item.price
          });
        }
      });
    });

    // Sort by date descending
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, product]);

  const stats = useMemo(() => {
    const totalSoldQty = salesHistory.reduce((acc, curr) => acc + curr.qty, 0);
    const totalRevenue = salesHistory.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
    const stockValue = product.stock !== null ? (product.stock * product.price) : 0;
    
    return {
      totalSoldQty,
      totalRevenue,
      stockValue
    };
  }, [salesHistory, product]);

  const handleAdjustStock = async () => {
    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const currentStock = product.stock || 0;
    const newStock = adjustType === 'ADD' 
      ? currentStock + qty 
      : adjustType === 'REDUCE' 
        ? Math.max(0, currentStock - qty) 
        : qty;

    const user = auth.currentUser;
    if (!user) return;

    setIsSaving(true);
    const businessRef = businessId === 'default'
      ? doc(db, 'users', user.uid)
      : doc(db, 'users', user.uid, 'businesses', businessId);

    const path = `${businessRef.path}/products/${product.id}`;
    const updatedProduct = {
      ...product,
      stock: newStock
    };

    try {
      await setDoc(doc(businessRef, 'products', product.id), updatedProduct);
      onUpdateProduct(updatedProduct);
      setShowAdjustModal(false);
      setAdjustQty('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const isLowStock = product.type === ItemType.PRODUCT && product.stock !== null && product.stock <= config.lowStockThreshold;

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[220] flex flex-col animate-in-view pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Product Profile</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest ${product.type === ItemType.SERVICE ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'}`}>
            {product.type}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Main Details Section */}
        <div className="bg-white dark:bg-slate-900 p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-4 border-2 border-white/20 shadow-sm overflow-hidden ${product.image ? '' : product.type === ItemType.SERVICE ? 'bg-purple-500 text-white' : isLowStock ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'}`}>
              {product.image ? (
                <img src={product.image} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <Box className="w-8 h-8" />
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase px-4">{product.name}</h2>
            {product.barcode && (
              <div className="flex items-center gap-1.5 mt-2 text-slate-400 font-mono text-[10px]">
                <Barcode className="w-3.5 h-3.5 text-brand-500" />
                <span>#{product.barcode}</span>
              </div>
            )}
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mt-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sales Price</p>
              <p className="text-base font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(product.price)}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Without Tax</p>
            </div>

            {product.type === ItemType.PRODUCT && (
              <>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stock Quantity</p>
                  <p className={`text-base font-black tracking-tight ${isLowStock ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                    {product.stock === null ? '∞' : `${product.stock}.0 PCS`}
                  </p>
                  <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${isLowStock ? 'text-red-400' : 'text-slate-400'}`}>
                    {isLowStock ? 'Low Stock Alert' : 'Available'}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-brand-50 dark:bg-brand-500/10 p-4 rounded-2xl border border-brand-100 dark:border-brand-500/10">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stock Value</p>
                  <p className="text-base font-black text-brand-500 dark:text-brand-400 tracking-tight">{formatCurrency(stats.stockValue)}</p>
                  <p className="text-[8px] font-bold text-brand-500/50 uppercase tracking-widest mt-1">Asset Value</p>
                </div>
              </>
            )}
          </div>

          {/* Action Button for Adjust Stock & Edit Details */}
          {product.type === ItemType.PRODUCT ? (
            <div className="mt-5 flex flex-col gap-2">
              <button 
                onClick={() => {
                  setAdjustType('ADD');
                  setAdjustQty('');
                  setShowAdjustModal(true);
                }}
                className="w-full bg-brand-500 text-white py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:ring-0 focus:outline-none shadow-sm"
              >
                <Plus className="w-4 h-4" /> Adjust Stock
              </button>
              <button 
                onClick={() => {
                  onEdit?.();
                }}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:ring-0 focus:outline-none border border-slate-200 dark:border-slate-700"
              >
                <Edit2 className="w-4 h-4 text-brand-500" /> Edit Item Details / बदलाव करें
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <button 
                onClick={() => {
                  onEdit?.();
                }}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:ring-0 focus:outline-none border border-slate-200 dark:border-slate-700"
              >
                <Edit2 className="w-4 h-4 text-brand-500" /> Edit Service Details / बदलाव करें
              </button>
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="px-4 mt-6">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 pb-3 text-center text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'timeline' ? 'text-brand-500 border-b-2 border-brand-500' : 'text-slate-400'}`}
            >
              Item Timeline
            </button>
            <button 
              onClick={() => setActiveTab('details')}
              className={`flex-1 pb-3 text-center text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'details' ? 'text-brand-500 border-b-2 border-brand-500' : 'text-slate-400'}`}
            >
              Details
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'timeline' ? (
            <div className="space-y-3.5">
              {salesHistory.map((historyItem, idx) => {
                const targetInvoice = invoices.find(inv => inv.id === historyItem.invoiceId);
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (targetInvoice && onViewInvoice) {
                        onViewInvoice(targetInvoice);
                      }
                    }}
                    className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 transition-all ${targetInvoice && onViewInvoice ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98]' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          Sales Invoice to {historyItem.clientName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(historyItem.date).toLocaleDateString()} | Bill #{historyItem.invoiceId}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-red-500 tracking-tight">
                        -{historyItem.qty}.0 PCS
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {formatCurrency(historyItem.price)} / pc
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Baseline Creation Entry */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center flex-shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">Opening Stock / Created</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-slate-500 tracking-tight">
                    Created
                  </p>
                </div>
              </div>

              {salesHistory.length === 0 && (
                <div className="py-12 text-center opacity-40">
                  <History className="w-10 h-10 mx-auto mb-2.5 text-slate-300" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">No sales history yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Item ID</p>
                  <p className="font-bold text-slate-900 dark:text-white font-mono break-all">{product.id}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Created At</p>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {product.createdAt ? new Date(product.createdAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Sold Qty</p>
                  <p className="font-bold text-slate-900 dark:text-white">{stats.totalSoldQty}.0 PCS</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lifetime Revenue</p>
                  <p className="font-bold text-brand-500 dark:text-brand-400">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#2D2D3F] dark:text-white uppercase tracking-tight">Adjust Stock</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Type selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={() => setAdjustType('ADD')}
                  className={`flex-1 py-3 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${adjustType === 'ADD' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400'}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button 
                  onClick={() => setAdjustType('REDUCE')}
                  className={`flex-1 py-3 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${adjustType === 'REDUCE' ? 'bg-white dark:bg-slate-700 text-red-500 dark:text-red-400 shadow-sm' : 'text-slate-400'}`}
                >
                  <Minus className="w-3.5 h-3.5" /> Reduce
                </button>
                <button 
                  onClick={() => setAdjustType('SET')}
                  className={`flex-1 py-3 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${adjustType === 'SET' ? 'bg-white dark:bg-slate-700 text-brand-500 dark:text-brand-400 shadow-sm' : 'text-slate-400'}`}
                >
                  <Edit2 className="w-3.5 h-3.5" /> Set Direct
                </button>
              </div>

              {/* Quantity input */}
              <div className="space-y-2 font-sans">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  {adjustType === 'SET' ? 'Exact Stock Quantity' : 'Quantity'}
                </label>
                <input 
                  type="number"
                  placeholder={adjustType === 'SET' ? "Enter exact stock" : "Enter quantity to adjust"}
                  className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-2xl p-4 outline-none font-black text-slate-900 dark:text-white text-base ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all text-center"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  autoFocus
                />
              </div>

              <button 
                onClick={handleAdjustStock}
                disabled={isSaving}
                className="w-full bg-brand-500 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 border border-brand-400"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving...' : 'Confirm Adjust'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductProfile;
