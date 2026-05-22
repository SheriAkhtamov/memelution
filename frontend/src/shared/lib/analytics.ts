export type AnalyticsEventName =
  | 'feed_viewed'
  | 'meme_viewed'
  | 'meme_liked'
  | 'meme_commented'
  | 'meme_shared'
  | 'meme_saved'
  | 'meme_created'
  | 'user_followed'
  | 'community_joined'
  | 'notification_clicked'
  | 'search_used'
  | 'onboarding_completed';

type HeartMetric = 'happiness' | 'engagement' | 'adoption' | 'retention' | 'task_success';
type PirateMetric = 'acquisition' | 'activation' | 'retention' | 'referral' | 'revenue';
type KanoTier = 'must-have' | 'performance' | 'delight';

interface AnalyticsEventMeta {
  heart: HeartMetric;
  pirate: PirateMetric;
  kano: KanoTier;
}

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  created_at: string;
  properties: Record<string, unknown>;
  meta: AnalyticsEventMeta;
}

export const analyticsCatalog: Record<AnalyticsEventName, AnalyticsEventMeta> = {
  feed_viewed: { heart: 'engagement', pirate: 'activation', kano: 'must-have' },
  meme_viewed: { heart: 'engagement', pirate: 'activation', kano: 'must-have' },
  meme_liked: { heart: 'engagement', pirate: 'activation', kano: 'must-have' },
  meme_commented: { heart: 'engagement', pirate: 'activation', kano: 'must-have' },
  meme_shared: { heart: 'retention', pirate: 'referral', kano: 'performance' },
  meme_saved: { heart: 'retention', pirate: 'retention', kano: 'performance' },
  meme_created: { heart: 'adoption', pirate: 'activation', kano: 'must-have' },
  user_followed: { heart: 'retention', pirate: 'retention', kano: 'must-have' },
  community_joined: { heart: 'adoption', pirate: 'activation', kano: 'performance' },
  notification_clicked: { heart: 'retention', pirate: 'retention', kano: 'performance' },
  search_used: { heart: 'task_success', pirate: 'activation', kano: 'performance' },
  onboarding_completed: { heart: 'adoption', pirate: 'activation', kano: 'must-have' },
};

const STORAGE_KEY = 'memelution-analytics-events';
const MAX_LOCAL_EVENTS = 200;

export function trackEvent(name: AnalyticsEventName, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;

  const event: AnalyticsEvent = {
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString(),
    properties,
    meta: analyticsCatalog[name],
  };

  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as AnalyticsEvent[];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([event, ...current].slice(0, MAX_LOCAL_EVENTS)));
  } catch {
    // Local analytics must never break the product loop.
  }

  window.dispatchEvent(new CustomEvent('memelution:analytics', { detail: event }));

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/analytics/events';
  if (!endpoint) return;

  try {
    const payload = JSON.stringify(event);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Network analytics is best-effort.
  }
}
