import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './Layout';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../shared/i18n';
import { ErrorBoundary } from '../shared/ui';

const HomePage = lazy(() => import('../pages/home/HomePage').then((module) => ({ default: module.HomePage })));
const ExplorePage = lazy(() => import('../pages/explore/ExplorePage').then((module) => ({ default: module.ExplorePage })));
const PostPage = lazy(() => import('../pages/post/PostPage').then((module) => ({ default: module.PostPage })));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const CommunitiesPage = lazy(() => import('../pages/communities/CommunitiesPage').then((module) => ({ default: module.CommunitiesPage })));
const CommunityPage = lazy(() => import('../pages/communities/CommunitiesPage').then((module) => ({ default: module.CommunityPage })));
const CreateCommunityPage = lazy(() => import('../pages/communities/CommunitiesPage').then((module) => ({ default: module.CreateCommunityPage })));
const SearchPage = lazy(() => import('../pages/search/SearchPage').then((module) => ({ default: module.SearchPage })));
const HashtagPage = lazy(() => import('../pages/hashtag/HashtagPage').then((module) => ({ default: module.HashtagPage })));
const MessagesPage = lazy(() => import('../pages/messages/MessagesPage').then((module) => ({ default: module.MessagesPage })));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const SavedPage = lazy(() => import('../pages/saved/SavedPage').then((module) => ({ default: module.SavedPage })));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ReportsPage = lazy(() => import('../pages/admin/AdminPage').then((module) => ({ default: module.ReportsPage })));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminReportsPage = lazy(() => import('../pages/admin/AdminReportsPage').then((module) => ({ default: module.AdminReportsPage })));
const AdminLogsPage = lazy(() => import('../pages/admin/AdminLogsPage').then((module) => ({ default: module.AdminLogsPage })));
const AdminLoginPage = lazy(() => import('../pages/auth/AuthPages').then((module) => ({ default: module.AdminLoginPage })));
const AuthCallbackPage = lazy(() => import('../pages/auth/AuthPages').then((module) => ({ default: module.AuthCallbackPage })));
const LoginPage = lazy(() => import('../pages/auth/AuthPages').then((module) => ({ default: module.LoginPage })));
const OnboardingPage = lazy(() => import('../pages/auth/AuthPages').then((module) => ({ default: module.OnboardingPage })));

export function AppRouter({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  const { user } = useAuthStore();
  const location = useLocation();
  const standalone = ['/login', '/auth/callback', '/memelogin'].includes(location.pathname);
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (standalone) {
    return (
      <Routes>
        <Route path="/login" element={<RouteLoader><LoginPage /></RouteLoader>} />
        <Route path="/auth/callback" element={<RouteLoader><AuthCallbackPage /></RouteLoader>} />
        <Route path="/memelogin" element={<RouteLoader><AdminLoginPage /></RouteLoader>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  // Only force onboarding on pages that require full registration.
  // Allow browsing feed, explore, search, posts, and profiles freely (lazy registration).
  const onboardingRequired = user && !user.onboarding_completed
    && ['/messages', '/notifications', '/saved', '/settings', '/communities/new'].some(
      (path) => location.pathname === path || location.pathname.startsWith(path + '/'),
    );
  if (onboardingRequired) return <RouteLoader><OnboardingPage /></RouteLoader>;

  // Admin routes use a separate layout
  if (isAdminRoute) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/admin" element={<RouteLoader><AdminDashboardPage /></RouteLoader>} />
          <Route path="/admin/users" element={<RouteLoader><AdminUsersPage /></RouteLoader>} />
          <Route path="/admin/reports" element={<RouteLoader><AdminReportsPage /></RouteLoader>} />
          <Route path="/admin/logs" element={<RouteLoader><AdminLogsPage /></RouteLoader>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AdminLayout>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RouteLoader><HomePage /></RouteLoader>} />
        <Route path="/explore" element={<RouteLoader><ExplorePage /></RouteLoader>} />
        <Route path="/post/:id" element={<RouteLoader><PostPage /></RouteLoader>} />
        <Route path="/user/:username" element={<RouteLoader><ProfilePage /></RouteLoader>} />
        <Route path="/communities" element={<RouteLoader><CommunitiesPage /></RouteLoader>} />
        <Route path="/communities/new" element={<RouteLoader><CreateCommunityPage /></RouteLoader>} />
        <Route path="/communities/:slug" element={<RouteLoader><CommunityPage /></RouteLoader>} />
        <Route path="/search" element={<RouteLoader><SearchPage /></RouteLoader>} />
        <Route path="/hashtag/:name" element={<RouteLoader><HashtagPage /></RouteLoader>} />
        <Route path="/messages" element={<RouteLoader><MessagesPage /></RouteLoader>} />
        <Route path="/notifications" element={<RouteLoader><NotificationsPage /></RouteLoader>} />
        <Route path="/saved" element={<RouteLoader><SavedPage /></RouteLoader>} />
        <Route path="/settings" element={<RouteLoader><SettingsPage theme={theme} setTheme={setTheme} /></RouteLoader>} />
        <Route path="/reports" element={<RouteLoader><ReportsPage /></RouteLoader>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

function RouteLoader({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="route">
      <Suspense fallback={<div className="p-10 text-center font-black text-gray-400">Loading...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFoundPage() {
  const { t } = useTranslation();
  return <div className="p-10 text-center font-black text-gray-400">{t('app.page_not_found')}</div>;
}
