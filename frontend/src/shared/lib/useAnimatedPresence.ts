import { useEffect, useState } from 'react';

export type AnimatedPresenceState = 'opening' | 'open' | 'closing';

export function useAnimatedPresence(visible: boolean, exitDuration = 180) {
  const [mounted, setMounted] = useState(visible);
  const [state, setState] = useState<AnimatedPresenceState>(visible ? 'opening' : 'closing');

  useEffect(() => {
    let frame = 0;
    let timer = 0;

    if (visible) {
      setMounted(true);
      setState('opening');
      frame = window.requestAnimationFrame(() => setState('open'));
    } else if (mounted) {
      setState('closing');
      timer = window.setTimeout(() => setMounted(false), exitDuration);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, [exitDuration, mounted, visible]);

  return { mounted, state };
}
