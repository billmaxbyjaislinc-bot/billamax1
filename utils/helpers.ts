
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: any): string => {
    if ((n = n.toString()).length > 9) return 'overflow';
    const nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return '';
    let str = '';
    str += parseInt(nArr[1]) !== 0 ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'Crore ' : '';
    str += parseInt(nArr[2]) !== 0 ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'Lakh ' : '';
    str += parseInt(nArr[3]) !== 0 ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'Thousand ' : '';
    str += parseInt(nArr[4]) !== 0 ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'Hundred ' : '';
    str += parseInt(nArr[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
    return str.trim();
  };

  return inWords(Math.floor(num)) + ' Rupees Only';
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const generateId = () => Math.random().toString(36).substr(2, 9).toUpperCase();

export const formatWhatsAppNumber = (mobile: string): string => {
  const cleaned = mobile.replace(/\D/g, '');
  return cleaned;
};

export const PUBLIC_APP_URL = 'https://billmax.jaislinc.in';

export const getInvoiceShareUrl = (userId?: string, invoiceId?: string, businessId?: string): string => {
  const baseUrl = PUBLIC_APP_URL;
  if (!userId && !invoiceId) return baseUrl;
  const params = new URLSearchParams();
  if (userId) params.set('u', userId);
  if (invoiceId) params.set('i', invoiceId);
  if (businessId) params.set('b', businessId);
  const queryString = params.toString();
  return queryString ? `${baseUrl}/?${queryString}` : baseUrl;
};

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  return new Date(d.setDate(diff));
};

export const safeFetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE') || contentType.includes('text/html')) {
    throw new Error(
      'Backend API server is not responding (received HTML). On Hostinger, please make sure the Node.js Express server is active or /api request proxy is configured.'
    );
  }

  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid JSON response from server.');
  }

  return { ok: res.ok, status: res.status, data };
};

