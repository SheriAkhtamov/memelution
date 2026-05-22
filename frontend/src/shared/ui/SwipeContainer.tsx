import { useRef, type ReactNode } from 'react';

/**
 * Wraps children in a swipeable container that fires `onSwipeLeft` / `onSwipeRight`
 * when a horizontal swipe exceeds the threshold. Uses native touch events.
 */
export function SwipeContainer({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  className,
}: {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  className?: string;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);

  return (
    <div
      className={className}
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        swiping.current = true;
      }}
      onTouchMove={(e) => {
        if (!swiping.current) return;
        // If vertical scroll is dominant, bail out
        const dy = Math.abs(e.touches[0].clientY - startY.current);
        const dx = Math.abs(e.touches[0].clientX - startX.current);
        if (dy > dx) {
          swiping.current = false;
        }
      }}
      onTouchEnd={(e) => {
        if (!swiping.current) return;
        swiping.current = false;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) < threshold) return;
        if (dx < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }}
    >
      {children}
    </div>
  );
}
