import { useEffect, useRef } from 'react';

const MAX_PRELOAD = 12;
const MAX_CONCURRENT = 4;

/**
 * Preload a list of image URLs into the browser HTTP cache so they appear
 * instantly when rendered. Cancels in-flight loads on unmount/url change to
 * avoid wasted bandwidth.
 *
 * Only the first MAX_PRELOAD URLs are preloaded; rest are ignored. Loads are
 * serialized to MAX_CONCURRENT at a time to avoid saturating the network.
 */
export function useImagePreload(urls: Array<string | undefined | null>, enabled = true) {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    cancelledRef.current = false;
    const unique = Array.from(new Set(urls.filter((u): u is string => Boolean(u)))).slice(0, MAX_PRELOAD);
    if (!unique.length) return undefined;

    let cursor = 0;
    const inFlight: HTMLImageElement[] = [];
    const loadNext = () => {
      while (inFlight.length < MAX_CONCURRENT && cursor < unique.length && !cancelledRef.current) {
        const url = unique[cursor++];
        const img = new Image();
        img.decoding = 'async';
        img.loading = 'eager';
        inFlight.push(img);
        const done = () => {
          const idx = inFlight.indexOf(img);
          if (idx >= 0) inFlight.splice(idx, 1);
          loadNext();
        };
        img.onload = done;
        img.onerror = done;
        img.src = url;
      }
    };
    loadNext();

    return () => {
      cancelledRef.current = true;
      inFlight.forEach((img) => { img.onload = null; img.onerror = null; img.src = ''; });
    };
  }, [enabled, urls.join('|')]);
}
