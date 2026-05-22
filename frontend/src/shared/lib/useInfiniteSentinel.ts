import { RefObject, useEffect } from 'react';

export function useInfiniteSentinel(ref: RefObject<Element>, onVisible: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisible();
    }, { rootMargin: '320px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, onVisible, ref]);
}
