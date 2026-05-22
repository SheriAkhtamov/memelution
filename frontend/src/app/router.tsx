import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './Layout';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../shared/i18n';
import { HomePage } from '../pages/home/HomePage';
import { ExplorePage } from '../pages/explore/ExplorePage';
import { PostPage } from '../pages/post/PostPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { CommunitiesPage, CommunityPage, CreateCommunityPage } from '../pages/communities/CommunitiesPage';
import { SearchPage } from '../pages/search/SearchPage';
import { HashtagPage } from '../pages/hashtag/HashtagPage';
import { MessagesPage } from '../pages/messages/MessagesPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { SavedPage } from '../pages/saved/SavedPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ReportsPage } from '../pages/admin/AdminPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';
import { AdminLogsPage } from '../pages/admin/AdminLogsPage';
import { AdminLoginPage, AuthCallbackPage, LoginPage, OnboardingPage } from '../pages/auth/AuthPages';

export function AppRouter({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  const { user } = useAuthStore();
  const location = useLocation();
  const standalone = ['/login', '/auth/callback', '/memelogin'].includes(location.pathname);
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (standalone) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/memelogin" element={<AdminLoginPage />} />
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
  if (onboardingRequired) return <OnboardingPage />;

  // Admin routes use a separate layout
  if (isAdminRoute) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/logs" element={<AdminLogsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AdminLayout>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/user/:username" element={<ProfilePage />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/communities/new" element={<CreateCommunityPage />} />
        <Route path="/communities/:slug" element={<CommunityPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/hashtag/:name" element={<HashtagPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/settings" element={<SettingsPage theme={theme} setTheme={setTheme} />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

function NotFoundPage() {
  const { t } = useTranslation();
  return <div className="p-10 text-center font-black text-gray-400">{t('app.page_not_found')}</div>;
}
