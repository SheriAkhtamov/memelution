import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../shared/ui';
import { I18nProvider } from '../shared/i18n';
import { useAuthStore } from '../store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <I18nProvider userLanguage={user?.language}>{children}</I18nProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
