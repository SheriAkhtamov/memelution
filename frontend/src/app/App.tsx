import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider, useLocation } from 'react-router-dom';
import { Providers } from './providers';
import { AppRouter } from './router';
import { useAuthStore } from '../store/authStore';
import { ErrorBoundary } from '../shared/ui';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type ThemeRouterContextValue = {
  theme: string;
  setTheme: (theme: string) => void;
};

const THEME_TRANSITION_MS = 300;
const PWA_DISMISS_KEY = 'pwa-install-dismissed';
const PWA_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const router = createBrowserRouter([{ path: '*', element: <RouterRoot /> }]);
const ThemeRouterContext = createContext<ThemeRouterContextValue | null>(null);

export default function App() {
  const { checkAuth, isLoaded } = useAuthStore();
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'system');
  const hasAppliedThemeRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    const shouldAnimateThemeChange = hasAppliedThemeRef.current;

    if (shouldAnimateThemeChange) root.classList.add('theme-transition');
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
    hasAppliedThemeRef.current = true;

    if (!shouldAnimateThemeChange) return undefined;
    const timeout = window.setTimeout(() => root.classList.remove('theme-transition'), THEME_TRANSITION_MS);
    return () => {
      window.clearTimeout(timeout);
      root.classList.remove('theme-transition');
    };
  }, [theme]);

  if (!isLoaded) {
    return <SplashScreen />;
  }

  return (
    <ErrorBoundary level="app">
      <Providers>
        <ThemeRouterContext.Provider value={{ theme, setTheme: setThemeState }}>
          <RouterProvider router={router} />
        </ThemeRouterContext.Provider>
      </Providers>
    </ErrorBoundary>
  );
}

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F4F6] dark:bg-zinc-950" role="status" aria-live="polite" aria-label="Загружаем Memelution">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF6B00] text-3xl font-black text-white shadow-lg animate-pulse">
        М
      </div>
      <p className="mt-4 text-sm font-black text-gray-400">Memelution</p>
    </div>
  );
}

function RouterRoot() {
  const { theme, setTheme } = useThemeRouter();

  return (
    <>
      <RouteTransitionShell theme={theme} setTheme={setTheme} />
      <PwaInstallPrompt />
    </>
  );
}

function useThemeRouter() {
  const value = useContext(ThemeRouterContext);
  if (!value) throw new Error('Theme router context is missing');
  return value;
}

function RouteTransitionShell({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const [routeVisible, setRouteVisible] = useState(true);

  useLayoutEffect(() => {
    if (previousPathRef.current === location.pathname) return undefined;
    previousPathRef.current = location.pathname;
    setRouteVisible(false);

    const frame = window.requestAnimationFrame(() => setRouteVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.pathname]);

  return (
    <div className={`min-h-screen transition-opacity duration-150 ease-out motion-reduce:transition-none ${routeVisible ? 'opacity-100' : 'opacity-0'}`}>
      <AppRouter theme={theme} setTheme={setTheme} />
    </div>
  );
}

function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    if (isRunningStandalone() || !supportsBeforeInstallPrompt()) return undefined;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isInstallPromptDismissed()) return;
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };
    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    setShowInstallBanner(false);
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => undefined);
    if (choice?.outcome === 'dismissed') rememberInstallDismissal();
    setInstallPrompt(null);
  }, [installPrompt]);

  const dismissInstall = useCallback(() => {
    rememberInstallDismissal();
    setShowInstallBanner(false);
    setInstallPrompt(null);
  }, []);

  if (!showInstallBanner) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[70] rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
      role="dialog"
      aria-label="Установить Memelution"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF6B00] text-xl font-black text-white">М</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Установить Memelution</p>
          <p className="text-xs font-bold text-gray-400">Быстрый доступ с домашнего экрана</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={dismissInstall} className="rounded-lg px-3 py-1.5 text-xs font-bold text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800">
            Not now
          </button>
          <button onClick={handleInstall} className="rounded-lg bg-[#FF6B00] px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-orange-600">
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

function supportsBeforeInstallPrompt() {
  return 'BeforeInstallPromptEvent' in window || 'onbeforeinstallprompt' in window;
}

function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as NavigatorWithStandalone).standalone === true;
}

function isInstallPromptDismissed() {
  const dismissedAt = Number(localStorage.getItem(PWA_DISMISS_KEY) || 0);
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < PWA_DISMISS_MS;
}

function rememberInstallDismissal() {
  localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
}
