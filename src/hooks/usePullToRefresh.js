import { useEffect, useRef, useCallback } from 'react';

/**
 * usePullToRefresh
 * Adds native-feel pull-to-refresh on touch devices.
 * Attach containerRef to your scrollable container.
 * onRefresh: async function called when user pulls down enough.
 */
export function usePullToRefresh({ onRefresh, threshold = 70 }) {
  const containerRef = useRef(null);
  const startYRef    = useRef(0);
  const pullingRef   = useRef(false);
  const indicatorRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    // Only activate when already at top of scroll
    if (el.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pullingRef.current) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) { pullingRef.current = false; return; }
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) return;
    // Show indicator
    if (indicatorRef.current) {
      const progress = Math.min(dy / threshold, 1);
      indicatorRef.current.style.opacity = String(progress);
      indicatorRef.current.style.transform = `translateY(${Math.min(dy * 0.4, 28)}px)`;
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async (e) => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    const dy = (e.changedTouches[0]?.clientY || 0) - startYRef.current;
    // Reset indicator
    if (indicatorRef.current) {
      indicatorRef.current.style.opacity = '0';
      indicatorRef.current.style.transform = 'translateY(0)';
    }
    if (dy >= threshold) {
      await onRefresh?.();
    }
  }, [threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove',  handleTouchMove,  { passive: true });
    el.addEventListener('touchend',   handleTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove',  handleTouchMove);
      el.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, indicatorRef };
}
