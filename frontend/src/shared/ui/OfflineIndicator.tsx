import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from '../i18n';

/**
 * Shows a floating banner when the user goes offline.
 * Automatically dismisses when connection is restored.
 */
export function OfflineIndicator() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => { setOffline(true); setWasOffline(true); };
    const goOnline = () => setOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Auto-hide the "back online" toast after 3s
  useEffect(() => {
    if (!offline && wasOffline) {
      const timer = setTimeout(() => setWasOffline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [offline, wasOffline]);

  if (!offline && !wasOffline) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-black shadow-lg transition-all duration-300 sm:bottom-6 ${
        offline
          ? 'bg-red-600 text-white'
          : 'bg-green-600 text-white'
      }`}
    >
      {offline ? (
        <span className="flex items-center gap-2">
          <WifiOff size={16} /> {t('ui.offline')}
        </span>
      ) : (
        <span>{t('ui.online')}</span>
      )}
    </div>
  );
}
