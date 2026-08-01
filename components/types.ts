
export enum PaymentMethod {
  CASH = 'CASH',
  ONLINE = 'ONLINE',
  BORROW = 'BORROW'
}

export enum ItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE'
}

export enum InvoiceTheme {
  MODERN = 'MODERN',
  CLASSIC = 'CLASSIC',
  ELEGANT = 'ELEGANT',
  MINIMAL = 'MINIMAL'
}

export interface Product {
  id: string;
  type: ItemType;
  name: string;
  price: number;
  stock: number | null; // null for unlimited or services
  barcode?: string;
  createdAt?: number;
  image?: string;
}

export interface Client {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  totalBorrowed: number;
  createdAt?: number;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  type?: ItemType;
}

export interface Invoice {
  id: string;
  date: string;
  clientId: string | 'WALK_IN';
  clientName: string;
  clientMobile?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  discount: number; // value (could be % or amount)
  discountType: 'PERCENTAGE' | 'AMOUNT';
  discountAmount: number; // calculated absolute discount
  additionalCharges?: number; // additional fees or transport costs
  roundOff?: number; // round off adjust amount
  subtotal: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  pendingAmount: number;
  invoiceTheme?: InvoiceTheme;
  invoicePrimaryColor?: string;
  showLogo?: boolean;
  showSignature?: boolean;
  userId?: string;
  businessId?: string;
}

export interface AppConfig {
  ownerName: string;
  shopName: string;
  shopAddress?: string;
  shopMobile: string;
  gstNumber?: string;
  pin: string;
  signatureImage?: string;
  qrCodeImage?: string;
  businessLogo?: string;
  lowStockThreshold: number;
  setupComplete: boolean;
  invoiceTheme?: InvoiceTheme;
  invoicePrimaryColor?: string;
  showLogo?: boolean;
  showSignature?: boolean;
  showHsnColumn?: boolean;
  showFooterBranding?: boolean;
  showTerms?: boolean;
  isDarkMode: boolean;
  invoiceGreetingVoice?: 'female' | 'male' | 'classic' | 'cheerful';
  welcomeGreetingText?: string;
  reminderGreetingText?: string;
  reminderGreetingVoice?: 'female' | 'male' | 'classic' | 'cheerful';
  enableAudioGreeting?: boolean;
  language?: 'en' | 'hi' | 'hinglish';
  enableNotifications?: boolean;
  enableLowStockAlerts?: boolean;
  enablePaymentReminders?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  type: 'info' | 'warning' | 'success' | 'alert' | 'error';
  read: boolean;
  linkTab?: Tab;
  targetId?: string;
}

export interface Business {
  id: string;
  name: string;
  ownerName: string;
  logo?: string;
  createdAt: number;
}

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  BILLING = 'BILLING',
  INVENTORY = 'INVENTORY',
  INVOICES = 'INVOICES',
  SETTINGS = 'SETTINGS'
}
