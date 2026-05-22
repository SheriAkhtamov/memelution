export { AdminLoginPage, AuthCallbackPage, LoginPage, OnboardingPage } from './auth/AuthPages';
export { AdminPage, ReportsPage } from './admin/AdminPage';
export { CommunitiesPage, CommunityPage, CreateCommunityPage } from './communities/CommunitiesPage';
export { ExplorePage } from './explore/ExplorePage';
export { HashtagPage } from './hashtag/HashtagPage';
export { MessagesPage } from './messages/MessagesPage';
export { NotificationsPage } from './notifications/NotificationsPage';
export { ProfilePage } from './profile/ProfilePage';
export { SavedPage } from './saved/SavedPage';
export { SearchPage } from './search/SearchPage';
export { SettingsPage } from './settings/SettingsPage';

export function NotFoundPage() {
  return <div className="p-10 text-center font-black text-gray-400">Страница не найдена</div>;
}
