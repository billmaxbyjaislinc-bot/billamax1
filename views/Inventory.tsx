
import React, { useState, useMemo, Suspense } from 'react';
import { Package, Search, Plus, Edit2, Trash2, Save, X, AlertTriangle, ScanLine, Box, Briefcase, Loader2, FolderUp, PlusCircle, Settings, ChevronDown, Filter, ArrowDownAZ, ArrowUpAZ, ArrowDown10, ArrowUp10, Check, Camera, Upload, ArrowLeft } from 'lucide-react';
import { doc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Product, AppConfig, ItemType, Tab, Invoice } from '../types';
import { generateId, formatCurrency, getInvoiceShareUrl } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import ProductProfile from '../components/ProductProfile';
import InvoiceDetail from '../components/InvoiceDetail';

const BarcodeScanner = React.lazy(() => import('../components/BarcodeScanner'));

interface InventoryProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  config: AppConfig;
  isLoading?: boolean;
  onNavigate?: (tab: Tab) => void;
  businessId?: string;
  invoices?: Invoice[];
}

const Inventory: React.FC<InventoryProps> = ({ products, setProducts, config, isLoading, onNavigate, businessId = 'default', invoices = [] }) => {
  const t = getTranslation(config?.language || 'hinglish');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | ItemType>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProductForProfile, setSelectedProductForProfile] = useState<Product | null>(null);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({ 
    type: ItemType.PRODUCT, 
    name: '', 
    price: undefined, 
    stock: null, 
    barcode: '',
    image: undefined
  });

  const compressAndSetImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, image: compressedDataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState<'NAME_ASC' | 'NAME_DESC' | 'QTY_ASC' | 'QTY_DESC'>('NAME_ASC');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => 
        (activeTab === 'ALL' || p.type === activeTab) &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.barcode && p.barcode.includes(searchTerm))) &&
        (stockFilter === 'ALL' || 
          (stockFilter === 'LOW_STOCK' && p.type === ItemType.PRODUCT && p.stock !== null && p.stock <= config.lowStockThreshold) ||
          (stockFilter === 'IN_STOCK' && p.type === ItemType.PRODUCT && p.stock !== null && p.stock > 0) ||
          (stockFilter === 'OUT_OF_STOCK' && p.type === ItemType.PRODUCT && (p.stock === null || p.stock <= 0))
        )
      )
      .sort((a, b) => {
        if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
        if (sortBy === 'NAME_DESC') return b.name.localeCompare(a.name);
        if (sortBy === 'QTY_ASC') return (a.stock || 0) - (b.stock || 0);
        if (sortBy === 'QTY_DESC') return (b.stock || 0) - (a.stock || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [products, activeTab, searchTerm, stockFilter, sortBy, config.lowStockThreshold]);

  const handleSave = async () => {
    if (!formData.name || (formData.price || 0) <= 0) {
      alert("Please enter a name and a valid price!");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    const id = editingId || generateId();
    const productData = { 
      ...formData, 
      id,
      createdAt: editingId ? (formData.createdAt || Date.now()) : Date.now()
    } as Product;
    
    const businessRef = businessId === 'default' 
      ? doc(db, 'users', user.uid) 
      : doc(db, 'users', user.uid, 'businesses', businessId);
    
    const path = `${businessRef.path}/products/${id}`;

    setIsProcessing(true);
    try {
      await setDoc(doc(businessRef, 'products', id), productData);
      setEditingId(null);
      setShowAdd(false);
      setFormData({ type: ItemType.PRODUCT, name: '', price: undefined, stock: null, barcode: '', image: undefined });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;
    if (!confirm("Delete this item?")) return;

    const businessRef = businessId === 'default' 
      ? doc(db, 'users', user.uid) 
      : doc(db, 'users', user.uid, 'businesses', businessId);
    
    const path = `${businessRef.path}/products/${id}`;
    setDeletingId(id);
    try {
      await deleteDoc(doc(businessRef, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData(product);
  };

  const handleBarcodeScanned = (barcode: string) => {
    setShowScanner(false);
    const existing = products.find(p => p.barcode === barcode);
    if (existing) {
      startEdit(existing);
    } else {
      setFormData({ type: ItemType.PRODUCT, name: '', price: undefined, stock: null, barcode, image: undefined });
      setShowAdd(true);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Refined Header Design */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h1 className="text-2xl font-bold text-[#2D2D3F] dark:text-white tracking-tight">Items</h1>
          <div className="flex items-center gap-5">
            <button 
              onClick={() => setShowScanner(true)}
              className="text-slate-400 hover:text-brand-500 active:scale-90 transition-all"
            >
              <Search className="w-6 h-6" strokeWidth={2} />
            </button>
            <button 
              onClick={() => onNavigate?.(Tab.SETTINGS)}
              className="text-slate-400 hover:text-brand-500 active:scale-90 transition-all"
            >
              <Settings className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
            className={`flex-shrink-0 px-5 py-2.5 rounded-full font-bold text-xs transition-all border ${stockFilter === 'LOW_STOCK' ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100/70 dark:bg-slate-900 text-[#2D2D3F] dark:text-slate-300 border-transparent'}`}
          >
            Low Stock
          </button>

          <div className="relative flex-shrink-0">
            <select 
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="appearance-none bg-slate-100/70 dark:bg-slate-900 text-[#2D2D3F] dark:text-slate-300 px-5 py-2.5 pr-10 rounded-full font-bold text-xs border border-transparent outline-none cursor-pointer"
            >
              <option value="ALL">Select Category</option>
              <option value={ItemType.PRODUCT}>Products</option>
              <option value={ItemType.SERVICE}>Services</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D3F] dark:text-slate-400 pointer-events-none" />
          </div>

          <button 
            onClick={() => setShowFilterModal(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-slate-100/70 dark:bg-slate-900 text-[#2D2D3F] dark:text-slate-300 px-5 py-2.5 rounded-full font-bold text-xs border border-transparent active:scale-95 transition-all"
          >
            Filter By
            <Filter className="w-4 h-4 text-brand-500" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Search Input (Conditional or Integrated) */}
      {searchTerm && (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 animate-in fade-in duration-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Searching..."
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white font-bold text-xs"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button onClick={() => setSearchTerm('')} className="text-slate-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 h-20" />
            ))}
          </>
        ) : (
          <>
            {filteredProducts.map(p => {
          const isLow = p.type === ItemType.PRODUCT && p.stock !== null && p.stock <= config.lowStockThreshold;
          return (
             <div key={p.id} className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group gap-3">
              <div 
                onClick={() => setSelectedProductForProfile(p)}
                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              >
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden ${p.image ? '' : p.type === ItemType.SERVICE ? 'bg-purple-50 text-purple-600' : isLow ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-500'}`}>
                  {p.image ? (
                    <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : p.type === ItemType.SERVICE ? (
                    <Briefcase className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  ) : isLow ? (
                    <AlertTriangle className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  ) : (
                    <Box className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm tracking-tight truncate">{p.name}</h4>
                    <span className={`text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest flex-shrink-0 ${p.type === ItemType.SERVICE ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'}`}>
                      {p.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate">{formatCurrency(p.price)}</p>
                    {p.type === ItemType.PRODUCT && (
                      <>
                        <span className="text-[10px] text-slate-300">•</span>
                        <p className={`text-[9px] sm:text-[10px] font-bold truncate ${isLow ? 'text-red-500' : 'text-slate-400'}`}>
                          स्टॉक (Stock): {p.stock === null ? '∞' : `${Math.max(0, p.stock)}.0 PCS`}
                        </p>
                      </>
                    )}
                    {p.type === ItemType.PRODUCT && p.barcode && (
                      <>
                        <span className="text-[10px] text-slate-300">•</span>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">#{p.barcode}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex gap-0.5">
                  <button onClick={() => startEdit(p)} className="p-2 text-slate-300 hover:text-brand-500 transition-colors">
                    <Edit2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    disabled={deletingId === p.id}
                    className="p-2 text-slate-300 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === p.id ? (
                      <Loader2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
             <Package className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">No results found</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* Add/Edit Form Overlay */}
      {(showAdd || editingId) && (
        <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-white dark:bg-slate-900 z-[9999] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 sticky top-0 z-10">
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90 transition-transform"><X className="w-5 h-5" /></button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">{editingId ? 'Edit Item' : 'Add Product / Service'}</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar pb-20 bg-slate-50 dark:bg-slate-950">
            {/* Type Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setFormData({...formData, type: ItemType.PRODUCT})}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${formData.type === ItemType.PRODUCT ? 'bg-white dark:bg-slate-700 text-brand-500' : 'text-slate-400'}`}
              >
                <Box className="w-4 h-4" /> Product
              </button>
              <button 
                onClick={() => setFormData({...formData, type: ItemType.SERVICE, barcode: '', stock: null, image: undefined})}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${formData.type === ItemType.SERVICE ? 'bg-white dark:bg-slate-700 text-brand-500' : 'text-slate-400'}`}
              >
                <Briefcase className="w-4 h-4" /> Service
              </button>
            </div>

            <div className="space-y-5">
              {/* Product Image Upload */}
              {formData.type === ItemType.PRODUCT && (
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Image (फोटो)</label>
                  <div className="mt-1.5 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden relative group">
                      {formData.image ? (
                        <>
                          <img src={formData.image} alt="Product" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, image: undefined }))}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <Camera className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 font-sans">
                      <input 
                        type="file"
                        id="product-image-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            compressAndSetImage(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="product-image-upload"
                        className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#2D2D3F] dark:text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5 text-brand-500" /> Upload Photo
                      </label>
                      <p className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">JPEG or PNG, Auto-compressed to fit</p>
                    </div>
                  </div>
                </div>
              )}

              {formData.type === ItemType.PRODUCT && (
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Barcode / Item ID</label>
                  <div className="relative mt-1.5">
                    <input 
                      type="text"
                      placeholder="Scan or enter barcode"
                      className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                      value={formData.barcode || ''}
                      onChange={e => setFormData({...formData, barcode: e.target.value})}
                    />
                    <button 
                      onClick={() => setShowScanner(true)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-500 active:scale-90 transition-transform"
                    >
                      <ScanLine className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{formData.type === ItemType.PRODUCT ? 'Product Name' : 'Service Name'}</label>
                <input 
                  type="text"
                  placeholder="Enter name"
                  className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                  value={formData.name ?? ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className={`grid gap-5 ${formData.type === ItemType.PRODUCT ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rate / Price (₹)</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                    value={formData.price === undefined || formData.price === null ? '' : formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value === '' ? undefined : parseFloat(e.target.value)})}
                  />
                </div>
                {formData.type === ItemType.PRODUCT && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Available Stock</label>
                    <input 
                      type="number"
                      placeholder="∞ Unlimited"
                      className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                      value={formData.stock === null || formData.stock === undefined ? '' : formData.stock}
                      onChange={e => setFormData({...formData, stock: e.target.value === '' ? null : parseInt(e.target.value)})}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-8 sm:pb-5">
            <button 
              onClick={handleSave}
              disabled={isProcessing}
              className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-[11px] disabled:opacity-50 border border-brand-400"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isProcessing ? 'Processing...' : (editingId ? 'Update Detail' : 'Save Item')}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons - Replacing FAB */}
      <div className="fixed bottom-20 left-0 md:left-64 right-0 p-3 z-[60]">
        <div className="max-w-md mx-auto flex gap-2">
          <button 
            onClick={() => setShowAdd(true)}
            className="flex-[1.2] bg-brand-500 text-white py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/10"
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={3} />
            <span className="font-bold text-[10px] uppercase tracking-wider truncate">Create New Item</span>
          </button>
          
          <button 
            onClick={() => alert("Bulk Action functionality coming soon!")}
            className="flex-1 bg-brand-50 dark:bg-brand-500/10 text-brand-500 py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 border border-brand-100 dark:border-brand-500/20"
          >
            <FolderUp className="w-4 h-4" />
            <span className="font-bold text-[10px] uppercase tracking-wider truncate">Bulk Action</span>
          </button>
        </div>
      </div>

      {/* Scanner Modal - Moved to end for proper overlaying */}
      {showScanner && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest">Initializing Scanner...</div>}>
          <BarcodeScanner 
            onScan={handleBarcodeScanned} 
            onClose={() => setShowScanner(false)} 
            title="Inventory Scanner"
          />
        </Suspense>
      )}

      {/* Sort & Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] overflow-hidden animate-in slide-in-from-bottom-full duration-500">
            <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-[#2D2D3F] dark:text-white">Sort & Filter</h3>
              <button onClick={() => setShowFilterModal(false)} className="p-2 text-slate-400 active:scale-90 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
              {/* Sort Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sort By</h4>
                  <button onClick={() => setSortBy('NAME_ASC')} className="text-xs font-bold text-brand-500 uppercase tracking-widest">Clear</button>
                </div>
                <div className="space-y-1">
                  <SortOption 
                    active={sortBy === 'NAME_ASC'} 
                    onClick={() => setSortBy('NAME_ASC')} 
                    icon={<ArrowDownAZ className="w-5 h-5" />} 
                    label="Item name - A to Z" 
                  />
                  <SortOption 
                    active={sortBy === 'NAME_DESC'} 
                    onClick={() => setSortBy('NAME_DESC')} 
                    icon={<ArrowUpAZ className="w-5 h-5" />} 
                    label="Item name - Z to A" 
                  />
                  <SortOption 
                    active={sortBy === 'QTY_ASC'} 
                    onClick={() => setSortBy('QTY_ASC')} 
                    icon={<ArrowDown10 className="w-5 h-5" />} 
                    label="Quantity - Low to High" 
                  />
                  <SortOption 
                    active={sortBy === 'QTY_DESC'} 
                    onClick={() => setSortBy('QTY_DESC')} 
                    icon={<ArrowUp10 className="w-5 h-5" />} 
                    label="Quantity - High to Low" 
                  />
                </div>
              </div>

              {/* Filter Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Filter By</h4>
                <div className="flex flex-wrap gap-2">
                  <FilterChip 
                    active={stockFilter === 'LOW_STOCK'} 
                    onClick={() => setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')} 
                    label="Low Stock" 
                  />
                  <FilterChip 
                    active={stockFilter === 'IN_STOCK'} 
                    onClick={() => setStockFilter(stockFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK')} 
                    label="In Stock" 
                  />
                  <FilterChip 
                    active={stockFilter === 'OUT_OF_STOCK'} 
                    onClick={() => setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')} 
                    label="Not in Stock" 
                  />
                  <FilterChip 
                    active={false} 
                    onClick={() => {}} 
                    label="In Online store" 
                  />
                </div>
              </div>

              <button 
                onClick={() => setShowFilterModal(false)}
                className="w-full bg-brand-500 text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-all mt-4 border border-brand-400"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProductForProfile && (
        <ProductProfile 
          product={selectedProductForProfile}
          invoices={invoices}
          config={config}
          onClose={() => setSelectedProductForProfile(null)}
          onUpdateProduct={(updated) => {
            setSelectedProductForProfile(updated);
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
          }}
          onEdit={() => {
            const prod = selectedProductForProfile;
            setSelectedProductForProfile(null);
            startEdit(prod);
          }}
          onViewInvoice={(invoice) => {
            setSelectedInvoiceForDetail(invoice);
          }}
          businessId={businessId}
        />
      )}

      {selectedInvoiceForDetail && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[230] flex flex-col p-4 md:p-6 overflow-y-auto pt-[env(safe-area-inset-top)] animate-in-view">
          <div className="max-w-lg mx-auto w-full space-y-4">
            <button 
              onClick={() => setSelectedInvoiceForDetail(null)} 
              className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs mb-4"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={3} /> Back / पीछे जाएं
            </button>
            <InvoiceDetail 
              invoice={selectedInvoiceForDetail} 
              config={config} 
              shareUrl={auth.currentUser ? getInvoiceShareUrl(auth.currentUser.uid, selectedInvoiceForDetail.id, businessId) : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const SortOption = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
  >
    <div className="flex items-center gap-4">
      <div className={`${active ? 'text-brand-500' : 'text-slate-400'}`}>{icon}</div>
      <span className={`text-sm font-bold ${active ? 'text-[#2D2D3F] dark:text-white' : 'text-slate-500'}`}>{label}</span>
    </div>
    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-brand-500 bg-brand-500' : 'border-slate-200 dark:border-slate-700'}`}>
      {active && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
    </div>
  </button>
);

const FilterChip = ({ active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={`px-5 py-2.5 rounded-full font-bold text-xs transition-all border ${active ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100/70 dark:bg-slate-900 text-[#2D2D3F] dark:text-slate-300 border-transparent'}`}
  >
    {label}
  </button>
);

export default Inventory;
