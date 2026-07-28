import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const slides = [
    {
      image: '/welcome1.png',
      fallback: '/signin1.png',
      title: (
        <>
          Manage Your <br />
          Business with <br />
          <span 
            className="inline-block align-middle h-10 bg-brand-600 dark:bg-brand-400 -ml-[5px]" 
            style={{
              maskImage: 'url(/Textbillmax.png)',
              WebkitMaskImage: 'url(/Textbillmax.png)',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'left center',
              WebkitMaskPosition: 'left center',
              width: '153px'
            }} 
            aria-label="Billmax"
          />
        </>
      ),
      desc: 'Create invoices, track payments, manage inventory and grow your business – all in one place.',
    },
    {
      image: '/welcome2.png',
      fallback: '/signin11.png',
      title: (
        <>
          Smart & Fast <br />
          <span className="text-brand-600 dark:text-brand-400 font-black">Digital Billing</span>
        </>
      ),
      desc: 'Generate professional bills, share via WhatsApp, and manage payments in under 10 seconds.',
    },
    {
      image: '/welcome3.png',
      fallback: '/signin3.png',
      title: (
        <>
          Real-time <br />
          <span className="text-brand-600 dark:text-brand-400 font-black">Inventory Sync</span>
        </>
      ),
      desc: 'Track low-stock items automatically, manage multiple products, and stay updated with live alerts.',
    },
  ];

  useEffect(() => {
    const imagesToPreload = [
      '/welcome1.png',
      '/welcome2.png',
      '/welcome3.png',
      '/Textbillmax.png',
      '/signin1.png',
      '/signin11.png',
      '/signin3.png',
      '/signin4.png',
      '/signin5.png',
      '/signin6.png',
      '/signin7.png',
      '/signin8.png',
      '/Google.png'
    ];

    let loadedCount = 0;
    const totalImages = imagesToPreload.length;

    const handleImageLoad = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        setImagesLoaded(true);
      }
    };

    const handleImageError = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        setImagesLoaded(true);
      }
    };

    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.onload = handleImageLoad;
      img.onerror = handleImageError;
      img.src = src;
    });
  }, []);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  if (!imagesLoaded) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] flex flex-col justify-center items-center">
        <Loader2 className="w-8 h-8 text-brand-600 dark:text-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] flex flex-col justify-between py-6 px-6 overflow-hidden font-sans">
      {/* Top Header Spacing (Skip removed) */}
      <div className="max-w-lg mx-auto w-full h-8" />

      {/* Main Image Slider Area */}
      <div className="flex-1 max-w-lg mx-auto w-full flex flex-col justify-center items-center my-4">
        <div className="w-full relative h-[42vh] max-h-[420px] flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(event, info) => {
                const swipeThreshold = 40;
                if (info.offset.x < -swipeThreshold) {
                  // Swiped left (go next)
                  if (currentSlide < slides.length - 1) {
                    setCurrentSlide(prev => prev + 1);
                  }
                } else if (info.offset.x > swipeThreshold) {
                  // Swiped right (go back)
                  if (currentSlide > 0) {
                    setCurrentSlide(prev => prev - 1);
                  }
                }
              }}
              className="absolute inset-0 flex items-center justify-center p-4 cursor-grab active:cursor-grabbing select-none touch-pan-y"
            >
              <div className="w-full h-full relative flex items-center justify-center pointer-events-none">
                <img 
                  src={slides[currentSlide].image} 
                  alt="Feature showcase"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain transition-transform duration-300 scale-[1.65] translate-y-3"
                  onError={(e) => {
                    // Try fallback image on error
                    const img = e.currentTarget;
                    if (img.src !== window.location.origin + slides[currentSlide].fallback) {
                      img.src = slides[currentSlide].fallback;
                    } else {
                      // Final placeholder
                      img.src = 'https://picsum.photos/600/800?sig=' + currentSlide;
                    }
                  }}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Elegant fade overlay at the bottom of the image area */}
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 pointer-events-none z-10" />
        </div>

        {/* Text Content Area */}
        <div className="w-full mt-6 text-left px-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-3"
            >
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-[1.15] tracking-tight">
                {slides[currentSlide].title}
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                {slides[currentSlide].desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Navigation Row */}
      <div className="max-w-lg mx-auto w-full flex items-center justify-between mt-auto pt-4 pb-4">
        {/* Progress Dots */}
        <div className="flex gap-2.5 items-center">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                currentSlide === index 
                  ? 'w-6 bg-brand-500 dark:bg-brand-400' 
                  : 'w-2.5 bg-slate-200 dark:bg-slate-800'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Next/Get Started Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleNext}
          className="w-14 h-14 bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all focus:outline-none focus:ring-0 active:scale-95"
        >
          <ArrowRight className="w-6 h-6 stroke-[2.5]" />
        </motion.button>
      </div>
    </div>
  );
};

export default Onboarding;
