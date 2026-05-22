import { useEffect, useRef } from 'react';

/**
 * Autoplay a <video> when it enters the viewport (>50% visible)
 * and pause it when it leaves. Saves bandwidth and reduces visual noise.
 */
export function useViewportVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {
            // Autoplay may be blocked by browser policy — silent fallback.
          });
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
