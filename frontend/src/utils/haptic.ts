/**
 * Lightweight haptic feedback via the Vibration API.
 * Falls back silently on devices/browsers that don't support it.
 */
export function haptic(pattern: number | number[] = 10): void {
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // Vibration API may throw in restrictive contexts — safe to ignore.
  }
}

/** Short tap — like, save, react */
export function hapticTap(): void {
  haptic(10);
}

/** Medium — send message, achievement */
export function hapticMedium(): void {
  haptic(20);
}

/** Success pattern — double pulse */
export function hapticSuccess(): void {
  haptic([10, 50, 15]);
}
