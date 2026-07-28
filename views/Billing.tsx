
import React, { useState, useMemo, useEffect, Suspense, useRef } from 'react';
import { 
  X,
  CreditCard,
  Banknote,
  Clock,
  Users2,
  ScanLine,
  Briefcase,
  Box,
  Trash2,
  Search,
  ArrowRight,
  ChevronRight,
  CheckCircle,
  ArrowLeft,
  Plus,
  Edit2,
  UserPlus,
  Phone,
  IndianRupee,
  Loader2,
  User,
  MapPin
} from 'lucide-react';
import { Product, Client, Invoice, InvoiceItem, PaymentMethod, AppConfig, ItemType, InvoiceTheme } from '../types';
import { generateId, formatCurrency, formatWhatsAppNumber, getInvoiceShareUrl } from '../utils/helpers';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const BarcodeScanner = React.lazy(() => import('../components/BarcodeScanner'));
const InvoiceDetail = React.lazy(() => import('../components/InvoiceDetail'));
const ClientSelector = React.lazy(() => import('../components/ClientSelector'));

import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';

import { ShopIcon } from '../components/ShopIcon';
import { getTranslation } from '../utils/translations';
import { showToast, triggerWebNotification } from '../utils/notifications';

interface BillingProps {
  products: Product[];
  clients: Client[];
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  config: AppConfig;
  cart: InvoiceItem[];
  setCart: React.Dispatch<React.SetStateAction<InvoiceItem[]>>;
  custName: string;
  setCustName: React.Dispatch<React.SetStateAction<string>>;
  custMobile: string;
  setCustMobile: React.Dispatch<React.SetStateAction<string>>;
  custAddress: string;
  setCustAddress: React.Dispatch<React.SetStateAction<string>>;
  discount: number;
  setDiscount: React.Dispatch<React.SetStateAction<number>>;
  discountType: 'PERCENTAGE' | 'AMOUNT';
  setDiscountType: React.Dispatch<React.SetStateAction<'PERCENTAGE' | 'AMOUNT'>>;
  showCheckout: boolean;
  setShowCheckout: React.Dispatch<React.SetStateAction<boolean>>;
  paymentMethod: PaymentMethod;
  setPaymentMethod: React.Dispatch<React.SetStateAction<PaymentMethod>>;
  partialPaidAmount: number;
  setPartialPaidAmount: React.Dispatch<React.SetStateAction<number>>;
  isSuccess: boolean;
  setIsSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  lastInvoice: Invoice | null;
  setLastInvoice: React.Dispatch<React.SetStateAction<Invoice | null>>;
  user: FirebaseUser | null;
  businessId?: string;
  selectedClient?: Client | null;
  clearSelectedClient?: () => void;
  onUpdateConfig?: (updates: Partial<AppConfig>) => void;
}

const Billing: React.FC<BillingProps> = ({ 
  products, 
  clients, 
  invoices,
  setInvoices, 
  setProducts, 
  setClients, 
  config,
  cart,
  setCart,
  custName,
  setCustName,
  custMobile,
  setCustMobile,
  custAddress,
  setCustAddress,
  discount,
  setDiscount,
  discountType,
  setDiscountType,
  showCheckout,
  setShowCheckout,
  paymentMethod,
  setPaymentMethod,
  partialPaidAmount,
  setPartialPaidAmount,
  isSuccess,
  setIsSuccess,
  lastInvoice,
  setLastInvoice,
  user,
  businessId = 'default',
  selectedClient,
  clearSelectedClient,
  onUpdateConfig
}) => {
  const t = getTranslation(config?.language || 'hinglish');
  const [showScanner, setShowScanner] = useState(false);
  const [showFullListSelector, setShowFullListSelector] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProductForm, setEditProductForm] = useState<{
    name: string;
    price: string;
    stock: string;
    barcode: string;
    type: ItemType;
  }>({ name: '', price: '', stock: '', barcode: '', type: ItemType.PRODUCT });

  useEffect(() => {
    if (editingProduct) {
      setEditProductForm({
        name: editingProduct.name || '',
        price: editingProduct.price !== undefined && editingProduct.price !== null ? editingProduct.price.toString() : '',
        stock: editingProduct.stock === null || editingProduct.stock === undefined ? '' : editingProduct.stock.toString(),
        barcode: editingProduct.barcode || '',
        type: editingProduct.type || ItemType.PRODUCT,
      });
    }
  }, [editingProduct]);

  const handleSaveEditedProduct = async () => {
    if (!editingProduct) return;
    if (!editProductForm.name.trim()) {
      showToast("Product name is required", "error");
      return;
    }

    const updatedPrice = parseFloat(editProductForm.price) || 0;
    const updatedStock = editProductForm.stock === '' ? null : parseInt(editProductForm.stock);

    const updatedProduct: Product = {
      ...editingProduct,
      name: editProductForm.name.trim(),
      price: updatedPrice,
      stock: updatedStock,
      barcode: editProductForm.barcode.trim() || undefined,
      type: editProductForm.type,
    };

    try {
      setIsProcessing(true);
      if (user) {
        const businessRef = businessId === 'default' 
          ? doc(db, 'users', user.uid) 
          : doc(db, 'users', user.uid, 'businesses', businessId);
        await setDoc(doc(businessRef, 'products', editingProduct.id), updatedProduct, { merge: true });
      }

      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p));

      // Sync with active cart
      setCart(prev => prev.map(item => {
        if (item.id === editingProduct.id) {
          return {
            ...item,
            name: updatedProduct.name,
            price: updatedProduct.price,
            total: updatedProduct.price * item.quantity,
            type: updatedProduct.type,
          };
        }
        return item;
      }));

      showToast("Product updated successfully!", "success");
      setEditingProduct(null);
    } catch (err) {
      console.error("Error updating product:", err);
      showToast("Failed to update product", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestionsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (suggestionsContainerRef.current && !suggestionsContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (selectedClient) {
      setCustName(selectedClient.name);
      setCustMobile(selectedClient.mobile || '');
      setCustAddress(selectedClient.address || '');
      setShowSuggestions(false);
      if (clearSelectedClient) clearSelectedClient();
    }
  }, [selectedClient, setCustName, setCustMobile, setCustAddress, clearSelectedClient]);

  useEffect(() => {
    const handlePopState = () => {
      if (showFullListSelector) setShowFullListSelector(false);
      if (showScanner) setShowScanner(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showFullListSelector, showScanner]);

  const openSubScreen = (setter: (v: boolean) => void) => {
    setter(true);
    window.history.pushState({ ...window.history.state, sub: true }, '');
  };

  const nameSuggestions = useMemo(() => {
    if (!custName.trim() || !showSuggestions) return [];
    const trimmedInput = custName.trim().toLowerCase();
    return clients.filter(c => {
      const clientNameLower = c.name.toLowerCase();
      // If client name matches exactly, hide it from suggestions since they are already selected/fully typed
      if (clientNameLower === trimmedInput) {
        return false;
      }
      return clientNameLower.includes(trimmedInput) ||
        (c.mobile && c.mobile.includes(custName));
    }).sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeB - timeA;
    }).slice(0, 5);
  }, [custName, clients, showSuggestions]);

  const [activeForm, setActiveForm] = useState<ItemType | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', quantity: '1', barcode: '', id: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryTab, setInventoryTab] = useState<ItemType>(ItemType.PRODUCT);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [stockError, setStockError] = useState<string | null>(null);

  const [isAdditionalChargesActive, setIsAdditionalChargesActive] = useState(false);
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [isDiscountActive, setIsDiscountActive] = useState(discount > 0);
  const [isRoundOffActive, setIsRoundOffActive] = useState(false);
  const [roundOffAmount, setRoundOffAmount] = useState<number>(0);

  useEffect(() => {
    if (discount > 0) {
      setIsDiscountActive(true);
    }
  }, [discount]);

  const filteredInventory = useMemo(() => 
    products.filter(p => 
      (p.type === inventoryTab) && 
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery)))
    ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), 
    [searchQuery, products, inventoryTab]
  );

  const syncProductToCart = (p: Product, qty: number) => {
    if (qty <= 0) {
      // If quantity is 0, remove from cart if exists
      setCart(prev => prev.filter(item => item.id !== p.id));
      return;
    }

    // Stock Validation
    if (p.type === ItemType.PRODUCT && p.stock !== null && qty > p.stock) {
      setStockError("Quantity cannot exceed available inventory stock.");
      setTimeout(() => setStockError(null), 2000);
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === p.id);
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: qty,
          total: newCart[existingIndex].price * qty
        };
        return newCart;
      }
      return [...prev, {
        id: p.id,
        name: p.name,
        price: p.price,
        quantity: qty,
        total: p.price * qty,
        type: p.type
      }];
    });
  };

  const updateItemQuantity = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const currentQty = itemQuantities[id] || 0;
    const newQty = Math.max(0, currentQty + delta);

    if (delta > 0 && product.type === ItemType.PRODUCT && product.stock !== null && newQty > product.stock) {
      setStockError("Quantity cannot exceed available inventory stock.");
      setTimeout(() => setStockError(null), 2000);
      return;
    }

    setItemQuantities(prev => ({
      ...prev,
      [id]: newQty
    }));
    
    syncProductToCart(product, newQty);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    setItemQuantities(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    setItemQuantities({});
  };

  // Sync itemQuantities with cart when selector opens
  useEffect(() => {
    if (showFullListSelector) {
      const initialQtys: Record<string, number> = {};
      cart.forEach(item => {
        if (item.id) {
          initialQtys[item.id] = item.quantity;
        }
      });
      // Strictly set to cart contents, don't merge with previous stale state
      setItemQuantities(initialQtys);
    }
  }, [showFullListSelector]);

  // Calculate subtotal, grandTotal, and discountAmount from current cart, discount, and charges
  const { subtotal, grandTotal, discountAmount } = useMemo(() => {
    const sub = cart.reduce((acc, i) => acc + i.total, 0);
    let discAmt = 0;
    if (isDiscountActive) {
      if (discountType === 'PERCENTAGE') {
        discAmt = sub * (discount / 100);
      } else {
        discAmt = discount;
      }
    }
    const charges = isAdditionalChargesActive ? additionalCharges : 0;
    
    // Calculate dynamic round off if active
    let rOff = 0;
    if (isRoundOffActive) {
      const tempTotal = sub - discAmt + charges;
      rOff = parseFloat((Math.round(tempTotal) - tempTotal).toFixed(2));
    }
    
    const grand = Math.max(0, sub - discAmt + charges + rOff);
    return { subtotal: sub, grandTotal: grand, discountAmount: discAmt };
  }, [cart, discount, discountType, isDiscountActive, isAdditionalChargesActive, additionalCharges, isRoundOffActive]);

  // Sync roundOffAmount state automatically
  useEffect(() => {
    if (isRoundOffActive) {
      const baseVal = subtotal - discountAmount + (isAdditionalChargesActive ? additionalCharges : 0);
      const diff = parseFloat((Math.round(baseVal) - baseVal).toFixed(2));
      setRoundOffAmount(diff);
    } else {
      setRoundOffAmount(0);
    }
  }, [isRoundOffActive, subtotal, discountAmount, isAdditionalChargesActive, additionalCharges]);

  const handleSelectFromInventory = (p: Product) => {
    setFormData({ name: p.name, price: p.price.toString(), quantity: '1', barcode: p.barcode || '', id: p.id });
    setActiveForm(p.type);
    setSearchQuery('');
    setShowFullListSelector(false);
  };

  const handleEditCartItem = (index: number) => {
    const item = cart[index];
    setFormData({
      name: item.name,
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      barcode: '', // We don't store barcode in InvoiceItem usually unless we add it
      id: item.id
    });
    setEditingIndex(index);
    setActiveForm(item.type);
  };

  const handleAddToCart = (customItem?: Partial<InvoiceItem>) => {
    const itemToAdd = customItem || {
      name: formData.name,
      price: parseFloat(formData.price) || 0,
      quantity: parseInt(formData.quantity) || 1,
      id: formData.id || generateId(),
      type: activeForm || ItemType.PRODUCT
    };

    if (!itemToAdd.name) return;

    if (editingIndex !== null) {
      setCart(prev => {
        const newCart = [...prev];
        newCart[editingIndex] = {
          ...itemToAdd,
          id: itemToAdd.id!,
          name: itemToAdd.name!,
          price: itemToAdd.price!,
          quantity: itemToAdd.quantity!,
          total: itemToAdd.price! * itemToAdd.quantity!,
          type: itemToAdd.type!
        };
        return newCart;
      });
      setEditingIndex(null);
    } else {
      setCart(prev => {
        const existingIndex = prev.findIndex(item => item.id === itemToAdd.id);
        if (existingIndex > -1) {
          const newCart = [...prev];
          newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantity: newCart[existingIndex].quantity + (itemToAdd.quantity || 1),
            total: newCart[existingIndex].price * (newCart[existingIndex].quantity + (itemToAdd.quantity || 1))
          };
          return newCart;
        }
        return [...prev, {
          id: itemToAdd.id!,
          name: itemToAdd.name!,
          price: itemToAdd.price!,
          quantity: itemToAdd.quantity!,
          total: itemToAdd.price! * itemToAdd.quantity!,
          type: itemToAdd.type!
        }];
      });
    }

    if (!customItem) {
      setFormData({ name: '', price: '', quantity: '1', barcode: '', id: '' });
      setActiveForm(null);
    }
  };

  const handleFinish = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }
    
    const user = auth.currentUser;
    if (!user) return;

    const finalCustName = custName.trim() || 'Walk-in Customer';
    
    const paid = paymentMethod === PaymentMethod.BORROW ? partialPaidAmount : grandTotal;
    const pending = paymentMethod === PaymentMethod.BORROW ? Math.max(0, grandTotal - partialPaidAmount) : 0;

    setIsProcessing(true);
    const invoice: Invoice = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      clientId: 'WALK_IN',
      clientName: finalCustName,
      clientMobile: custMobile,
      clientAddress: custAddress,
      items: [...cart],
      discount: isDiscountActive ? discount : 0,
      discountType,
      discountAmount: isDiscountActive ? discountAmount : 0,
      additionalCharges: isAdditionalChargesActive ? additionalCharges : 0,
      roundOff: isRoundOffActive ? roundOffAmount : 0,
      subtotal,
      grandTotal,
      paymentMethod,
      paidAmount: paid,
      pendingAmount: pending,
      invoiceTheme: config.invoiceTheme || InvoiceTheme.MODERN,
      invoicePrimaryColor: config.invoicePrimaryColor || '#3b82f6',
      showLogo: config.showLogo !== undefined ? config.showLogo : !!config.businessLogo,
      showSignature: config.showSignature !== undefined ? config.showSignature : !!config.signatureImage
    };

    try {
      const businessRef = businessId === 'default' 
        ? doc(db, 'users', user.uid) 
        : doc(db, 'users', user.uid, 'businesses', businessId);
      
      // 1. Save Invoice
      await setDoc(doc(businessRef, 'invoices', invoice.id), invoice);

      // 2. Update Product Stock
      for (const item of cart) {
        if (item.type === ItemType.PRODUCT) {
          const product = products.find(p => p.id === item.id);
          if (product && product.stock !== null) {
            await updateDoc(doc(businessRef, 'products', product.id), {
              stock: Math.max(0, product.stock - item.quantity)
            });
          }
        }
      }

      // 3. Update Client Borrowed Amount
      if (paymentMethod === PaymentMethod.BORROW) {
        const client = clients.find(c => c.name === finalCustName);
        if (client) {
          await updateDoc(doc(businessRef, 'clients', client.id), {
            totalBorrowed: (client.totalBorrowed || 0) + pending
          });
        } else {
          const newClient: Client = {
            id: generateId(),
            name: finalCustName,
            mobile: custMobile,
            totalBorrowed: pending,
            createdAt: Date.now()
          };
          await setDoc(doc(businessRef, 'clients', newClient.id), newClient);
        }
      } else if (finalCustName !== 'Walk-in Customer') {
        const client = clients.find(c => c.name === finalCustName);
        if (!client) {
          const newClient: Client = {
            id: generateId(),
            name: finalCustName,
            mobile: custMobile,
            totalBorrowed: 0,
            createdAt: Date.now()
          };
          await setDoc(doc(businessRef, 'clients', newClient.id), newClient);
        }
      }

      setLastInvoice(invoice);
      setIsSuccess(true);
      
      showToast(`Invoice #${invoice.id} Created! 📄`, 'success');
      triggerWebNotification('BillMax Invoice Generated 📄', `Invoice #${invoice.id} created for ${finalCustName} of ₹${invoice.grandTotal}`);
      
      // Sensory Feedback: Sound & Vibration
      try {
        // 1. Vibration
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 200]);
        }

        // 2. Sound Effect (Success Chime)
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, startTime: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.3, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        // Success jingle
        const now = audioCtx.currentTime;
        playTone(523.25, now, 0.2); // C5
        playTone(659.25, now + 0.15, 0.2); // E5
        playTone(783.99, now + 0.3, 0.4); // G5
      } catch (e) {
        console.warn("Feedback audio failed", e);
      }

      setShowCheckout(false);
      setCart([]);
      setItemQuantities({});
      setCustName('');
      setCustMobile('');
      setCustAddress('');
      setDiscount(0);
      setPartialPaidAmount(0);
      setIsAdditionalChargesActive(false);
      setAdditionalCharges(0);
      setIsDiscountActive(false);
      setIsRoundOffActive(false);
      setRoundOffAmount(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/invoices/${invoice.id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess && lastInvoice) {
    const handleTemplateUpdate = async (id: string, updates: Partial<Invoice>) => {
      if (!user) return;
      const businessRef = businessId === 'default' 
        ? doc(db, 'users', user.uid) 
        : doc(db, 'users', user.uid, 'businesses', businessId);
      
      try {
        await setDoc(doc(businessRef, 'invoices', id), updates, { merge: true });
        // Update local state to reflect change immediately
        setLastInvoice(prev => prev ? { ...prev, ...updates } : null);

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
        console.error('Error updating invoice template:', err);
      }
    };

    const handleWhatsAppLinkShare = () => {
      if (!lastInvoice) return;
      const shareUrl = user ? getInvoiceShareUrl(user.uid, lastInvoice.id, businessId) : '';
      const message = `Hello! Your bill from ${config.shopName}.\nBill No: ${lastInvoice.id}\nAmount: ${formatCurrency(lastInvoice.grandTotal)}\nView Bill: ${shareUrl}`;
      const url = `https://wa.me/${formatWhatsAppNumber(lastInvoice.clientMobile)}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    };

    return (
      <div className="space-y-6 pb-24 animate-in-view">
        <div className="flex items-center justify-between px-2">
           <button 
             onClick={() => { setIsSuccess(false); setLastInvoice(null); }}
             className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl active:scale-90 transition-all text-slate-400"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
           <div className="flex flex-col items-center justify-center text-center flex-1">
             <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">Bill Generated</h2>
             <p className="text-slate-400 font-bold text-[8px] uppercase tracking-widest leading-none mb-1">ID: {lastInvoice.id}</p>
             <div className="flex gap-2 text-[9px] font-black uppercase tracking-tighter">
                <span className="text-emerald-600">Paid: ₹{lastInvoice.paidAmount}</span>
                {lastInvoice.pendingAmount > 0 && <span className="text-red-500">Unpaid: ₹{lastInvoice.pendingAmount}</span>}
             </div>
           </div>
           <div className="w-11"></div> {/* Spacer to keep title centered */}
         </div>

        <div className="flex flex-col items-center justify-center text-center p-2">
          <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-2">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
        
        <Suspense fallback={<div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Bill Details...</div>}>
          <InvoiceDetail onUpdateConfig={onUpdateConfig} 
            invoice={lastInvoice} 
            config={config} 
            shareUrl={user ? getInvoiceShareUrl(user.uid, lastInvoice.id, businessId) : undefined}
            onUpdate={handleTemplateUpdate}
          />
        </Suspense>
        
        <div className="px-4 space-y-3">
          <button 
            onClick={() => { setIsSuccess(false); setLastInvoice(null); }} 
            className="w-full bg-slate-900 dark:bg-slate-800 text-white py-4 rounded-2xl font-bold uppercase tracking-[0.2em] transition-all active:scale-95"
          >
            New Transaction
          </button>
        </div>
      </div>
    );
  }

  if (showFullListSelector) return (
    <div className="fixed inset-0 w-full h-screen bg-white dark:bg-slate-900 z-[9999] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Top Section: Fixed Header */}
      <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFullListSelector(false)} className="text-slate-500 active:scale-90 transition-transform flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">Search Products</h2>
        </div>
        <button onClick={() => openSubScreen(setShowScanner)} className="p-1.5 text-slate-400 hover:text-brand-500 transition-colors">
          <ScanLine className="w-5 h-5" />
        </button>
      </div>

      {/* Stock Error Toast */}
      {stockError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[10000] bg-red-500 text-white px-6 py-3 rounded-2xl animate-in-view flex items-center gap-3 border border-white/20">
          <div className="w-2 h-2 bg-white rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-widest">{stockError}</p>
        </div>
      )}

      {/* Top Section: Fixed Search Bar & Add Product */}
      <div className="flex-shrink-0 p-3 bg-white dark:bg-slate-900 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input 
            type="text" 
            placeholder={`Search ${inventoryTab.toLowerCase()}s...`} 
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold outline-none text-xs" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            autoFocus 
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          <button 
            onClick={() => setInventoryTab(ItemType.PRODUCT)}
            className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${inventoryTab === ItemType.PRODUCT ? 'bg-white dark:bg-slate-700 text-brand-500 border border-slate-200 dark:border-slate-600' : 'text-slate-400'}`}
          >
            Products
          </button>
          <button 
            onClick={() => setInventoryTab(ItemType.SERVICE)}
            className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${inventoryTab === ItemType.SERVICE ? 'bg-white dark:bg-slate-700 text-brand-500 border border-slate-200 dark:border-slate-600' : 'text-slate-400'}`}
          >
            Services
          </button>
        </div>
      </div>

      {/* Middle Section: Scrollable Product List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 no-scrollbar bg-slate-50 dark:bg-slate-950">
        {filteredInventory.map(p => {
          const totalSelected = itemQuantities[p.id] || 0;
          const availableStock = p.stock === null ? null : Math.max(0, p.stock - totalSelected);

          return (
            <div key={p.id} className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-3 flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-sm text-brand-500 dark:text-brand-500 tracking-tight">{p.name}</h3>
                    {p.type === ItemType.PRODUCT && (
                      <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${availableStock <= (config.lowStockThreshold || 5) ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'}`}>
                        स्टॉक (Stock): {availableStock === null ? '∞' : `${Math.max(0, availableStock)}.0 PCS`}
                      </div>
                    )}
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-white">₹{p.price}</p>
                </div>
                
                <div className="flex flex-col items-end gap-3 ml-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateItemQuantity(p.id, -1)}
                      className="w-6 h-6 flex items-center justify-center bg-brand-500 text-white rounded-full active:scale-75 transition-transform"
                    >
                      <span className="text-base font-bold">−</span>
                    </button>
                    <div className="relative">
                      <input 
                        type="number"
                        inputMode="numeric"
                        className="w-10 text-center text-sm font-bold text-slate-900 dark:text-white bg-transparent outline-none border-b border-slate-200 dark:border-slate-700 focus:border-brand-500 transition-colors"
                        value={itemQuantities[p.id] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const newQty = Math.max(0, val);
                          if (p.stock !== null && newQty > p.stock) {
                            setStockError("Quantity cannot exceed available inventory stock.");
                            setTimeout(() => setStockError(null), 2000);
                            return;
                          }
                          setItemQuantities(prev => ({ ...prev, [p.id]: newQty }));
                          syncProductToCart(p, newQty);
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => updateItemQuantity(p.id, 1)}
                      className="w-6 h-6 flex items-center justify-center bg-brand-500 text-white rounded-full active:scale-75 transition-transform"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <button 
                  onClick={() => setEditingProduct(p)}
                  className="text-brand-500 hover:text-brand-600 text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-brand-50 dark:bg-brand-500/10 rounded-lg active:scale-95 transition-all"
                >
                  Edit
                </button>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">PCS</span>
              </div>
            </div>
          );
        })}
        {filteredInventory.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No {inventoryTab.toLowerCase()}s found</p>
          </div>
        )}
      </div>

      {/* Bottom Footer (Cart Section) */}
      <div className="flex-shrink-0 p-3 bg-slate-900 dark:bg-slate-950 border-t border-white/5 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex gap-2 text-[9px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
            <span>Items: {cart.length}</span>
            <span>Qty: {cart.reduce((acc, i) => acc + i.quantity, 0)}.0</span>
          </div>
          <p className="text-lg font-bold text-white tracking-tight">Amount: ₹{subtotal.toLocaleString()}</p>
        </div>
        <button 
          onClick={() => setShowFullListSelector(false)}
          className="bg-brand-500 hover:bg-brand-500 text-white px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center gap-2"
        >
          Continue <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  if (showCheckout) return (
    <div className="fixed inset-0 w-full h-screen bg-white dark:bg-slate-900 z-[9999] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setShowCheckout(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Payment Method</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-slate-50 dark:bg-slate-950">
        <div className="space-y-3">
          <PayMethodBtn active={paymentMethod === PaymentMethod.CASH} icon={<Banknote className="w-5 h-5" />} label="Cash Payment" desc="Physical currency received" onClick={() => setPaymentMethod(PaymentMethod.CASH)} />
          <PayMethodBtn active={paymentMethod === PaymentMethod.ONLINE} icon={<CreditCard className="w-5 h-5" />} label="Online / UPI" desc="Digital bank transfer" onClick={() => setPaymentMethod(PaymentMethod.ONLINE)} />
          <PayMethodBtn active={paymentMethod === PaymentMethod.BORROW} icon={<Clock className="w-5 h-5" />} label="Unpaid" desc="Add to unpaid ledger" onClick={() => setPaymentMethod(PaymentMethod.BORROW)} />
        </div>

        {paymentMethod === PaymentMethod.BORROW && (
          <div className="p-5 bg-brand-50 dark:bg-brand-500/5 rounded-3xl border border-brand-100 dark:border-brand-500/20 animate-in-view">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-brand-500 text-white rounded-xl border border-brand-400"><IndianRupee className="w-4 h-4" /></div>
              <p className="text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">Jama Rashi (Collected)</p>
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Enter amount paid now (default 0)" 
                className="w-full p-5 bg-white dark:bg-slate-900 border-2 border-brand-200 dark:border-brand-500/30 rounded-2xl text-slate-900 dark:text-white font-bold text-xl outline-none focus:border-brand-500 transition-all"
                value={partialPaidAmount || ''}
                onChange={e => setPartialPaidAmount(Math.min(grandTotal, parseFloat(e.target.value) || 0))}
              />
              <div className="mt-3 flex justify-between px-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unpaid Rashi (Remaining): <span className="text-brand-600">{formatCurrency(grandTotal - partialPaidAmount)}</span></p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 bg-brand-50 dark:bg-brand-500/5 rounded-3xl border border-brand-100 dark:border-brand-500/20">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Final Amount to Pay</p>
            <p className="text-2xl font-black text-brand-500 tracking-tighter">{formatCurrency(grandTotal)}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-10">
        <button 
          onClick={handleFinish} 
          disabled={isProcessing}
          className="w-full bg-brand-500 text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : 'Confirm & Finalize'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-40">
      <div className="px-2 pt-2">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.billing}</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.createInvoice}</p>
      </div>

      {showClientSelector && (
        <Suspense fallback={null}>
          <ClientSelector 
            clients={clients}
            setClients={setClients}
            invoices={invoices}
            setInvoices={setInvoices}
            config={config}
            onClose={() => setShowClientSelector(false)}
            onSelect={(client) => {
              setCustName(client.name);
              setCustMobile(client.mobile || '');
              setCustAddress(client.address || '');
              setShowSuggestions(false);
            }}
            directSelect={true}
          />
        </Suspense>
      )}

      {/* Main Responsive Grid Layout for landscape and wider screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 landscape:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* Customer Input Section */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in-view">
            <div className="relative" ref={suggestionsContainerRef}>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Customer Name</span>
                <button 
                  onClick={() => openSubScreen(setShowClientSelector)}
                  className="px-1.5 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 border border-brand-100 dark:border-brand-500/20 rounded-md flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest active:scale-95 transition-all"
                >
                  <Users2 className="w-3 h-3" /> Select
                </button>
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search or enter name..."
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-slate-900 dark:text-white font-bold outline-none text-xs ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-brand-500 transition-all"
                  value={custName}
                  onChange={(e) => {
                    setCustName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {custName && (
                  <button 
                    onClick={() => {
                      setCustName('');
                      setCustMobile('');
                      setCustAddress('');
                      setShowSuggestions(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {showSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-300 ring-1 ring-slate-100 dark:ring-slate-800">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Matching in Ledger</p>
                    <button 
                      onClick={() => setShowSuggestions(false)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {nameSuggestions.map(client => (
                    <button 
                      key={client.id}
                      onClick={() => {
                        setCustName(client.name);
                        setCustMobile(client.mobile || '');
                        setCustAddress(client.address || '');
                        setShowSuggestions(false);
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all text-left border-b border-slate-50 dark:border-slate-800 last:border-0 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-brand-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white tracking-tight">{client.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{client.mobile || 'No Mobile'}</p>
                        </div>
                      </div>
                      <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg group-hover:bg-brand-500 group-hover:text-white transition-all">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-1.5">
                <Phone className="w-3 h-3" /> Mobile Number
              </label>
              <div className="relative">
                <input 
                  type="tel" 
                  placeholder="Enter 10-digit number..."
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-slate-900 dark:text-white font-bold outline-none text-xs ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-brand-500 transition-all"
                  value={custMobile}
                  onChange={(e) => setCustMobile(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3 h-3" /> Address (Optional)
              </label>
              <div className="relative">
                <textarea 
                  placeholder="Enter customer address..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-slate-900 dark:text-white font-bold outline-none text-xs ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-brand-500 transition-all min-h-[60px]"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Selector Actions */}
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => openSubScreen(setShowFullListSelector)} className="flex items-center justify-between p-3 bg-brand-500 text-white rounded-xl active:scale-[0.98] transition-all border border-brand-400">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/10 rounded-lg"><Search className="w-3.5 h-3.5" /></div>
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest">Select Product</p>
                  <p className="text-[7px] opacity-70 font-semibold uppercase tracking-tight">Browse and add from inventory</p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button onClick={() => setActiveForm(ItemType.PRODUCT)} className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 active:scale-95 transition-all">
              <div className="p-1.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-lg"><Plus className="w-3 h-3" /></div>
              <div className="text-left">
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">Quick Add</p>
                <p className="text-[7px] text-slate-400 font-semibold uppercase tracking-tight">Add items not in inventory</p>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Shopping Cart Container */}
          <div className="min-h-[180px] bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/50">
            <div className="flex justify-between items-center mb-4 px-2">
              <div className="flex items-center gap-2">
                <ShopIcon className="w-4 h-4 text-slate-900 dark:text-white" />
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-tight">Active Cart</h4>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button onClick={handleClearCart} className="text-[9px] font-bold text-red-500 uppercase tracking-widest px-3 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg active:scale-95 transition-all">Clear</button>
                )}
                <button onClick={() => openSubScreen(setShowScanner)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl active:scale-90 transition-all"><ScanLine className="w-4 h-4" /></button>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center opacity-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <ShopIcon className="w-10 h-10 mx-auto mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Your cart is empty</p>
              </div>
            ) : (
              <div>
                <div className="max-h-[360px] md:max-h-[calc(100vh-360px)] overflow-y-auto space-y-3 pr-1 no-scrollbar">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex flex-col p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 animate-in-view gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === ItemType.SERVICE ? 'bg-purple-50 text-purple-600' : 'bg-brand-50 text-brand-500'}`}>
                            {item.type === ItemType.SERVICE ? <Briefcase className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-tight leading-tight">{item.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">{formatCurrency(item.price)} per unit</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleEditCartItem(idx)}
                            className="p-1.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-lg active:scale-95 transition-all focus:ring-0 focus:outline-none"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleRemoveFromCart(item.id)} 
                            className="text-slate-300 hover:text-red-500 transition-colors p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-50 dark:border-slate-800">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                          <button 
                            onClick={() => setCart(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1), total: it.price * Math.max(1, it.quantity - 1) } : it))}
                            className="w-7 h-7 flex items-center justify-center text-slate-500 active:scale-75 transition-transform"
                          >
                            <span className="text-lg font-bold">−</span>
                          </button>
                          <span className="w-8 text-center text-[11px] font-black text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => setCart(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1, total: it.price * (it.quantity + 1) } : it))}
                            className="w-7 h-7 flex items-center justify-center text-slate-500 active:scale-75 transition-transform"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total</p>
                          <p className="font-bold text-sm text-brand-500 mt-0.5">{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotals & Adjustments Panel */}
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3.5">
                  {/* Item Subtotal Row */}
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Item Subtotal</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</span>
                  </div>

                  {/* Active Additional Charges Row */}
                  {isAdditionalChargesActive ? (
                    <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setIsAdditionalChargesActive(false); setAdditionalCharges(0); }}
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 dark:bg-slate-800 transition-all text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span>Additional Charges</span>
                      </div>
                      <div className="flex items-center gap-1 border-b border-brand-500 dark:border-brand-400 max-w-[100px]">
                        <span className="text-[10px] font-semibold text-slate-400">₹</span>
                        <input 
                          type="number" 
                          placeholder="0" 
                          className="w-full bg-transparent text-right font-bold text-xs outline-none text-slate-900 dark:text-white border-none p-0.5 focus:ring-0"
                          value={additionalCharges || ''}
                          onChange={e => setAdditionalCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Active Discount Row */}
                  {isDiscountActive ? (
                    <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setIsDiscountActive(false); setDiscount(0); }}
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 dark:bg-slate-800 transition-all text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span>Discount After Tax</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Percentage field */}
                        <div className="flex items-center gap-0.5 border-b border-brand-500 dark:border-brand-400 max-w-[65px]">
                          <input 
                            type="number" 
                            placeholder="0" 
                            className="w-full bg-transparent text-right font-bold text-xs outline-none text-slate-900 dark:text-white border-none p-0.5 focus:ring-0"
                            value={discountType === 'PERCENTAGE' ? (discount || '') : (discount > 0 && subtotal > 0 ? parseFloat(((discount / subtotal) * 100).toFixed(2)) : '')}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setDiscountType('PERCENTAGE');
                              setDiscount(Math.min(100, Math.max(0, val)));
                            }}
                          />
                          <span className="text-[10px] font-semibold text-slate-400">%</span>
                        </div>
                        {/* Rupees field */}
                        <div className="flex items-center gap-0.5 border-b border-brand-500 dark:border-brand-400 max-w-[85px]">
                          <span className="text-[10px] font-semibold text-slate-400">₹</span>
                          <input 
                            type="number" 
                            placeholder="0" 
                            className="w-full bg-transparent text-right font-bold text-xs outline-none text-slate-900 dark:text-white border-none p-0.5 focus:ring-0"
                            value={discountType === 'AMOUNT' ? (discount || '') : (discount > 0 ? Math.round(subtotal * (discount / 100)) : '')}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setDiscountType('AMOUNT');
                              setDiscount(Math.max(0, val));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Inactive options block */}
                  {(!isAdditionalChargesActive || !isDiscountActive) && (
                    <div className="flex flex-col items-end gap-1.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                      {!isAdditionalChargesActive && (
                        <button 
                          onClick={() => setIsAdditionalChargesActive(true)}
                          className="flex items-center gap-1 text-[10px] font-bold text-brand-500 dark:text-brand-400 hover:text-brand-600 transition-colors uppercase tracking-widest"
                        >
                          <Plus className="w-3 h-3" /> Additional Charges
                        </button>
                      )}
                      {!isDiscountActive && (
                        <button 
                          onClick={() => setIsDiscountActive(true)}
                          className="flex items-center gap-1 text-[10px] font-bold text-brand-500 dark:text-brand-400 hover:text-brand-600 transition-colors uppercase tracking-widest"
                        >
                          <Plus className="w-3 h-3" /> Discount
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Full Section (Quick Add) */}
      {activeForm && (
        <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-slate-50 dark:bg-slate-950 z-[9999] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
            <button onClick={() => { setActiveForm(null); setEditingIndex(null); setFormData({ name: '', price: '', quantity: '1', barcode: '', id: '' }); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90 transition-transform"><ArrowLeft className="w-5 h-5" /></button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              {editingIndex !== null ? 'Edit Item' : 'Quick Add'}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
            <div className="p-5 space-y-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              {/* Type Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={() => setActiveForm(ItemType.PRODUCT)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${activeForm === ItemType.PRODUCT ? 'bg-white dark:bg-slate-700 text-brand-500 border border-slate-200 dark:border-slate-800' : 'text-slate-400'}`}
                >
                  <Box className="w-4 h-4" />
                  Product
                </button>
                <button 
                  onClick={() => setActiveForm(ItemType.SERVICE)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${activeForm === ItemType.SERVICE ? 'bg-white dark:bg-slate-700 text-brand-500 border border-slate-200 dark:border-slate-800' : 'text-slate-400'}`}
                >
                  <Briefcase className="w-4 h-4" />
                  Service
                </button>
              </div>

              <div className="space-y-4">
                {activeForm === ItemType.PRODUCT && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Barcode / Item ID</label>
                    <div className="relative mt-1.5">
                      <input 
                        type="text" 
                        placeholder="Scan or enter barcode" 
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white font-bold text-sm outline-none ring-2 ring-transparent focus:ring-brand-500 transition-all" 
                        value={formData.barcode} 
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
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Item Name</label>
                  <input type="text" placeholder="e.g. Special Item" className="w-full mt-1.5 p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white font-bold text-sm outline-none ring-2 ring-transparent focus:ring-brand-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Price (₹)</label>
                    <input type="number" placeholder="0.00" className="w-full mt-1.5 p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white font-bold text-sm outline-none ring-2 ring-transparent focus:ring-brand-500 transition-all" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                    <input type="number" placeholder="1" className="w-full mt-1.5 p-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white font-bold text-sm outline-none ring-2 ring-transparent focus:ring-brand-500 transition-all" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                  </div>
                </div>
              </div>
              <button onClick={() => handleAddToCart()} className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all">
                {editingIndex !== null ? 'Update Item' : 'Add to Cart'}
              </button>
            </div>
            
            {/* Live Cart Preview */}
            <div className="flex-1 p-6 bg-slate-50/50 dark:bg-slate-950/50">
               <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">Items in this bill ({cart.length})</h4>
               <div className="space-y-2">
                 {cart.map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${item.type === ItemType.SERVICE ? 'bg-purple-50 text-purple-600' : 'bg-brand-50 text-brand-500'}`}>
                          {item.type === ItemType.SERVICE ? <Briefcase className="w-3 h-3" /> : <Box className="w-3 h-3" />}
                        </div>
                        <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-tight">{item.name}</p>
                      </div>
                      <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                   </div>
                 )).reverse()}
               </div>
            </div>
          </div>
          <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between pb-8 sm:pb-5">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bill Total</p>
              <p className="text-xl font-bold text-brand-500">{formatCurrency(subtotal)}</p>
            </div>
            <button onClick={() => setActiveForm(null)} className="px-6 py-3 bg-brand-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest active:scale-95 focus:ring-0 focus:outline-none">Done</button>
          </div>
        </div>
      )}

      {/* Checkout Modal removed - now handled as full screen early return */}

      {/* Sticky Bottom Total Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-[68px] md:bottom-4 left-0 md:left-64 right-0 z-[60] px-4 pointer-events-none">
          <div className="max-w-lg md:max-w-4xl lg:max-w-6xl mx-auto w-full pointer-events-auto">
            <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl text-white rounded-2xl md:rounded-3xl p-3.5 sm:p-4 shadow-2xl border border-slate-800 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Grand Total</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight">{formatCurrency(grandTotal)}</span>
                  <span className="text-[10px] font-semibold text-slate-400">({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                </div>
              </div>
              <button 
                onClick={() => setShowCheckout(true)} 
                className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 sm:py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px] active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-brand-500/25 focus:ring-0 focus:outline-none flex-shrink-0"
              >
                Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Barcode Scanner */}
      {showScanner && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest">Initializing Scanner...</div>}>
          <BarcodeScanner 
            onScan={(b) => {
              if (editingProduct) {
                setEditProductForm(prev => ({ ...prev, barcode: b }));
                setShowScanner(false);
                setScanToast(`Barcode scanned: ${b}`);
                setTimeout(() => setScanToast(null), 2000);
                return;
              }
              const p = products.find(x => x.barcode === b);
              if (p) {
                updateItemQuantity(p.id, 1);
                setScanToast(`Added: ${p.name}`);
                setTimeout(() => setScanToast(null), 2000);
              } else {
                setScanToast(`Product not found: ${b}`);
                setTimeout(() => setScanToast(null), 2000);
              }
            }} 
            onClose={() => setShowScanner(false)} 
            title="Scan Barcode"
            message={scanToast}
            products={products}
            cart={cart}
            onUpdateQuantity={updateItemQuantity}
            onRemoveItem={handleRemoveFromCart}
          />
        </Suspense>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-white dark:bg-slate-900 z-[10005] flex flex-col animate-in-view overflow-hidden pt-[env(safe-area-inset-top)]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setEditingProduct(null)} 
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 active:scale-90 transition-transform"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Edit Product / Details</h3>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar pb-24 bg-slate-50 dark:bg-slate-950">
            {/* Type Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setEditProductForm({...editProductForm, type: ItemType.PRODUCT})}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${editProductForm.type === ItemType.PRODUCT ? 'bg-white dark:bg-slate-700 text-brand-500 shadow-sm' : 'text-slate-400'}`}
              >
                <Box className="w-4 h-4" /> Product
              </button>
              <button 
                onClick={() => setEditProductForm({...editProductForm, type: ItemType.SERVICE, barcode: '', stock: ''})}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${editProductForm.type === ItemType.SERVICE ? 'bg-white dark:bg-slate-700 text-brand-500 shadow-sm' : 'text-slate-400'}`}
              >
                <Briefcase className="w-4 h-4" /> Service
              </button>
            </div>

            <div className="space-y-5">
              {editProductForm.type === ItemType.PRODUCT && (
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Barcode / Item ID</label>
                  <div className="relative mt-1.5">
                    <input 
                      type="text"
                      placeholder="Scan or enter barcode"
                      className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                      value={editProductForm.barcode}
                      onChange={e => setEditProductForm({...editProductForm, barcode: e.target.value})}
                    />
                    <button 
                      onClick={() => setShowScanner(true)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-500 active:scale-90 transition-transform p-1 bg-brand-50 dark:bg-brand-500/10 rounded-lg"
                    >
                      <ScanLine className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{editProductForm.type === ItemType.PRODUCT ? 'Product Name' : 'Service Name'}</label>
                <input 
                  type="text"
                  placeholder="Enter product name"
                  className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                  value={editProductForm.name}
                  onChange={e => setEditProductForm({...editProductForm, name: e.target.value})}
                />
              </div>
              
              <div className={`grid gap-5 ${editProductForm.type === ItemType.PRODUCT ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rate / Price (₹)</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                    value={editProductForm.price}
                    onChange={e => setEditProductForm({...editProductForm, price: e.target.value})}
                  />
                </div>
                {editProductForm.type === ItemType.PRODUCT && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Available Stock</label>
                    <input 
                      type="number"
                      placeholder="∞ Unlimited"
                      className="w-full mt-1.5 bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 outline-none font-bold text-slate-900 dark:text-white text-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-brand-500 transition-all"
                      value={editProductForm.stock}
                      onChange={e => setEditProductForm({...editProductForm, stock: e.target.value})}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-8 sm:pb-5">
            <button 
              onClick={handleSaveEditedProduct}
              disabled={isProcessing}
              className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-[11px] disabled:opacity-50 border border-brand-400 shadow-lg shadow-brand-500/25"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {isProcessing ? 'Saving Changes...' : 'Update Detail'}
            </button>
          </div>
        </div>
      )}

      {scanToast && !showScanner && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10001] bg-slate-900 text-white px-6 py-3 rounded-2xl animate-in-view flex items-center gap-3 border border-white/20">
          <div className="w-2 h-2 bg-brand-500 rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-widest">{scanToast}</p>
        </div>
      )}
    </div>
  );
};

const PayMethodBtn = ({ active, icon, label, desc, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${active ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-500' : 'bg-slate-50 dark:bg-slate-900 border-transparent opacity-50'}`}>
    <div className={`p-3 rounded-xl ${active ? 'bg-brand-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>{React.cloneElement(icon, { className: 'w-5 h-5' })}</div>
    <div className="text-left">
      <p className={`font-bold text-xs ${active ? 'text-brand-500 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>{label}</p>
      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight mt-0.5">{desc}</p>
    </div>
  </button>
);

export default Billing;
