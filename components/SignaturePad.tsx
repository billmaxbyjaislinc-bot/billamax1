
import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onCancel: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get the actual displayed size
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ratio = window.devicePixelRatio || 1;
    
    // Set internal resolution based on device pixel ratio for sharpness
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    
    // Scale the context to match CSS pixels
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
  };

  useEffect(() => {
    // Use a small delay to ensure the container is fully laid out before measuring
    const timer = setTimeout(() => {
      initCanvas();
    }, 100);

    window.addEventListener('resize', initCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', initCanvas);
    };
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    if (e.cancelable) e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const ratio = window.devicePixelRatio || 1;
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
      }
    }
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-screen top-0 left-0 bg-slate-950 z-[100] flex flex-col p-4 md:p-8 overflow-hidden animate-in fade-in duration-300 pt-[env(safe-area-inset-top)]">
      <div className="flex justify-between items-center mb-4 text-white px-2">
        <h3 className="text-lg font-bold uppercase tracking-tight">Signature Pad</h3>
        <button onClick={onCancel} className="p-2.5 bg-white/10 rounded-full active:scale-90 transition-transform"><X className="w-5 h-5" /></button>
      </div>
      
      <div className="flex-1 bg-white rounded-[2rem] overflow-hidden relative border-2 border-brand-500">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="absolute bottom-4 left-4 right-4 flex gap-3">
          <button 
            onClick={clear}
            className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Eraser className="w-4 h-4" /> Clear
          </button>
          <button 
            onClick={save}
            className="flex-1 bg-brand-500 text-white py-3 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" /> Done
          </button>
        </div>
      </div>
      <p className="text-center text-brand-200 text-[10px] mt-4 font-semibold uppercase tracking-widest">Please sign in the box above</p>
    </div>
  );
};

export default SignaturePad;
