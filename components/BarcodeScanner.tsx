
import React, { useRef, useEffect, useState } from 'react';
import { X, Zap, Camera, ArrowLeft, Plus, Trash2, Box, Briefcase, ScanLine } from 'lucide-react';
import { Product, InvoiceItem, ItemType } from '../types';
import { formatCurrency } from '../utils/helpers';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
  message?: string | null;
  products?: Product[];
  cart?: InvoiceItem[];
  onUpdateQuantity?: (id: string, delta: number) => void;
  onRemoveItem?: (id: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  onScan, 
  onClose, 
  title = "Scan Barcode", 
  message,
  products = [],
  cart = [],
  onUpdateQuantity,
  onRemoveItem
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    // Check for BarcodeDetector support
    if (!('BarcodeDetector' in window)) {
      console.warn('BarcodeDetector is not supported in this browser.');
    }

    let stream: MediaStream | null = null;
    let detectorInterval: number | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1920 }, // Higher res for better detection
            height: { ideal: 1080 } 
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoTrackRef.current = stream.getVideoTracks()[0];

          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Ignore play interruption errors
            });
          }

          // Try to enable torch by default if available with a small delay for better reliability
          setTimeout(async () => {
            if (!videoTrackRef.current) return;
            try {
              const capabilities = videoTrackRef.current.getCapabilities() as any;
              const settings = videoTrackRef.current.getSettings() as any;
              
              if (capabilities.torch || ('torch' in settings)) {
                await videoTrackRef.current.applyConstraints({
                  advanced: [{ torch: true }]
                } as any);
                setTorchOn(true);
              }
            } catch (e) {
              console.log('Torch not supported or could not be enabled automatically');
            }
          }, 500);

          setupDetection();
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setError("Camera access denied or not available. Please allow camera permissions.");
        setIsSupported(false);
      }
    };

    const setupDetection = () => {
      // @ts-ignore - BarcodeDetector might not be in the types
      if ('BarcodeDetector' in window) {
        // @ts-ignore
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39']
        });

        let lastScanned: string | null = null;
        let lastScannedTime = 0;

        detectorInterval = window.setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                const now = Date.now();
                
                // Prevent duplicate scans within 2 seconds
                if (rawValue !== lastScanned || (now - lastScannedTime) > 2000) {
                  onScan(rawValue);
                  lastScanned = rawValue;
                  lastScannedTime = now;
                  // Vibrate on success if supported
                  if ('vibrate' in navigator) navigator.vibrate(100);
                }
              }
            } catch (e) {
              console.error('Detection error:', e);
            }
          }
        }, 150); // Slightly faster interval
      } else {
        setError("Your browser doesn't support built-in barcode scanning. Please use Chrome on Android or Safari on iOS 17+.");
      }
    };

    const stopCamera = () => {
      if (detectorInterval) clearInterval(detectorInterval);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      videoTrackRef.current = null;
    };

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const toggleTorch = async () => {
    if (!videoTrackRef.current) return;
    
    try {
      const newTorchState = !torchOn;
      const capabilities = (videoTrackRef.current.getCapabilities() as any) || {};
      const settings = (videoTrackRef.current.getSettings() as any) || {};
      
      if (capabilities.torch || ('torch' in settings)) {
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newTorchState }]
        } as any);
        setTorchOn(newTorchState);
      } else {
        console.warn('Torch is not supported by this camera');
        // Optionally show toast to user
      }
    } catch (e) {
      console.error('Failed to toggle torch:', e);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-white z-[10000] flex flex-col animate-in fade-in duration-300">
      {/* Header - White background as per image */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-slate-500 active:scale-90 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
        </div>
        
        {/* Flashlight Toggle */}
        <button 
          onClick={toggleTorch}
          className={`relative p-3 rounded-full transition-all duration-300 ${
            torchOn 
              ? 'bg-yellow-400 text-white scale-110' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}
        >
          <Zap className={`w-5 h-5 ${torchOn ? 'fill-current' : ''}`} />
          {torchOn && (
            <span className="absolute inset-0 rounded-full animate-ping bg-yellow-400/20 pointer-events-none" />
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Camera Section */}
        <div className="relative w-full aspect-[4/3] bg-black overflow-hidden">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white space-y-4">
              <Camera className="w-16 h-16 mx-auto opacity-20" />
              <p className="font-bold text-sm text-red-400">{error}</p>
              <button onClick={onClose} className="bg-white/10 px-6 py-3 rounded-2xl font-black uppercase text-[10px]">Go Back</button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                playsInline 
                muted 
              />
              {/* Scanning UI Overlay - Matching Image */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-48 relative">
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-[6px] border-l-[6px] border-white rounded-tl-3xl"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-[6px] border-r-[6px] border-white rounded-tr-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[6px] border-l-[6px] border-white rounded-bl-3xl"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[6px] border-r-[6px] border-white rounded-br-3xl"></div>
                  
                  {/* Horizontal Scanning Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-white"></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Section - White area for products */}
        <div className="flex-1 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Scan Item</h4>
            <p className="text-xs text-slate-400">Scan item to detect barcode</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {cart.length > 0 ? (
              cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.type === ItemType.SERVICE ? 'bg-purple-100 text-purple-600' : 'bg-brand-100 text-brand-500'}`}>
                      {item.type === ItemType.SERVICE ? <Briefcase className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{formatCurrency(item.price)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                      <button 
                        onClick={() => onUpdateQuantity?.(item.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-500 active:scale-75 transition-transform"
                      >
                        <span className="text-lg font-bold">−</span>
                      </button>
                      <span className="w-8 text-center text-xs font-black text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => onUpdateQuantity?.(item.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-500 active:scale-75 transition-transform"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button 
                      onClick={() => onRemoveItem?.(item.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                <ScanLine className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No items scanned yet</p>
              </div>
            )}
          </div>

          {/* Toast Message inside Scanner */}
          {message && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-500 text-white px-6 py-3 rounded-2xl animate-in-view flex items-center gap-3 border border-white/20 z-50">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
