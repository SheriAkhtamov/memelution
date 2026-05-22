import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';
import { AppRouter } from './router';
import { useAuthStore } from '../store/authStore';

export default function App() {
  const { checkAuth, isLoaded } = useAuthStore();
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'system');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] font-black text-gray-400 dark:bg-zinc-950">Loading...</div>;
  }

  return (
    <Providers>
      <BrowserRouter>
        <AppRouter theme={theme} setTheme={setThemeState} />
      </BrowserRouter>
    </Providers>
  );
}
