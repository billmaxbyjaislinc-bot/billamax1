
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useAnimation, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  isDisabled?: boolean;
}

const PULL_THRESHOLD = 80;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, isDisabled = false }) => {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isDisabled || refreshing) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].pageY;
      setPulling(true);
    } else {
      setPulling(false);
    }
  }, [isDisabled, refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling || refreshing) return;
    
    const pageY = e.touches[0].pageY;
    const distance = pageY - startY.current;
    
    if (distance > 0) {
      // Apply resistance
      const dampedDistance = Math.min(distance * 0.5, PULL_THRESHOLD + 20);
      setPullDistance(dampedDistance);
      
      // Prevent scrolling if pulling
      if (distance > 5 && e.cancelable) {
        // Only prevent if we are actually pulling down
        if (window.scrollY <= 0) {
          e.preventDefault();
        }
      }
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || refreshing) return;
    
    const isTriggered = pullDistance >= PULL_THRESHOLD;
    setPulling(false);
    
    if (isTriggered) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(20);
        } catch (e) {}
      }
      
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
        }, 150);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, refreshing, pullDistance, onRefresh]);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div className="relative w-full overflow-visible" ref={containerRef}>
      {/* Pull Indicator Area */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-[100]"
        style={{ height: pullDistance, opacity: pullDistance > 0 ? 1 : 0 }}
      >
        <div className="pt-2 flex flex-col items-center">
          <motion.div 
            animate={{ 
              rotate: refreshing ? 360 : (pullDistance / PULL_THRESHOLD) * 360,
              scale: pullDistance > 10 ? 1 : 0.5,
              opacity: pullDistance > 10 ? 1 : 0
            }}
            transition={refreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", damping: 15 }}
            className={`w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 ${pullDistance >= PULL_THRESHOLD ? 'text-brand-500' : 'text-slate-400'}`}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.div>
          {pullDistance >= PULL_THRESHOLD && !refreshing && (
            <motion.p 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[8px] font-bold text-brand-500 uppercase tracking-widest mt-2 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-full"
            >
              Release to Refresh
            </motion.p>
          )}
        </div>
      </div>

      {/* Main Content with dynamic offset */}
      <motion.div
        animate={{ y: pullDistance }}
        transition={pulling ? { type: "tween", duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
        className="w-full"
      >
        {children}
      </motion.div>
    </div>
  );
};
