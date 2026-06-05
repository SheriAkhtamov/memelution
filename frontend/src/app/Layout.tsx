import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bookmark, Compass, Home, MessageSquare, Plus, Search, Settings, Shield, Users, User as UserIcon, ExternalLink, UserCircle, TrendingUp } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api/client';
import type { NotificationItem } from '../shared/types';
import { AnimatedNumber, Avatar, Badge, Button, Skeleton } from '../shared/ui';
import { useAuthStore } from '../store/authStore';
import { authRedirectUrl } from '../utils/authRedirect';
import { PostComposer } from '../features/posts/components/PostComposer';
import { ConfettiCelebration } from '../features/gamification/ConfettiCelebration';
import { OfflineIndicator } from '../shared/ui/OfflineIndicator';
import { useTranslation } from '../shared/i18n';
import { trackEvent } from '../shared/lib/analytics';
import { SpotlightSearch } from '../features/search/SpotlightSearch';
import { useAnimatedPresence } from '../shared/lib/useAnimatedPresence';
import { cn } from '../lib/utils';

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [achievement, setAchievement] = useState<{ title: string; description?: string } | null>(null);
  const loginPath = authRedirectUrl(`${location.pathname}${location.search}${location.hash}`);
  const trendsQuery = useQuery({ queryKey: ['trends'], queryFn: () => api.trends(), staleTime: 60_000 });
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications,
    enabled: Boolean(user),
    refetchInterval: user ? 30_000 : false,
  });
  const readAll = useMutation({
    mutationFn: api.readAllNotifications,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api.readNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const notifications = notificationsQuery.data || [];
  const refetchNotificationsRef = useRef(notificationsQuery.refetch);
  const refetchTrendsRef = useRef(trendsQuery.refetch);
  const unread = notifications.filter((item) => !item.is_read).length;
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const chatsQuery = useQuery({ queryKey: ['chats-badge'], queryFn: api.chats, enabled: Boolean(user), refetchInterval: 30_000 });
  const unreadChats = (chatsQuery.data || []).reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
  const hasTrendRailContent = Boolean(
    trendsQuery.data && (
      trendsQuery.data.hashtags.length
      || trendsQuery.data.rising_posts.length
      || trendsQuery.data.active_communities.length
    ),
  );

  const navItems = useMemo(() => [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/explore', label: t('nav.explore'), icon: Compass },
    { to: '/search', label: t('nav.search'), icon: Search },
    { to: '/communities', label: t('nav.communities'), icon: Users },
    { to: '/messages', label: t('nav.messages'), icon: MessageSquare },
    { to: '/saved', label: t('nav.saved'), icon: Bookmark },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ], [t]);



  useEffect(() => {
    refetchNotificationsRef.current = notificationsQuery.refetch;
    refetchTrendsRef.current = trendsQuery.refetch;
  }, [notificationsQuery.refetch, trendsQuery.refetch]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !user) return;
    const url = `${apiBaseWs()}/api/ws/notifications?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    socket.onmessage = (event) => {
      refetchNotificationsRef.current();
      refetchTrendsRef.current();
      // Detect achievement events for confetti
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'achievement_unlocked' || data?.event === 'achievement_unlocked') {
          setAchievement({
            title: data.data?.title || data.title || t('layout.new_achievement'),
            description: data.data?.description || data.description,
          });
        }
      } catch { /* non-JSON or unknown event */ }
    };
    return () => socket.close();
  }, [user?.id, t]);

  // Auto-mark notifications as read when dropdown opens (modern UX: seen = read)
  useEffect(() => {
    if (!notifOpen || unread === 0 || readAll.isPending) return;
    const timer = window.setTimeout(() => readAll.mutate(), 400);
    return () => window.clearTimeout(timer);
  }, [notifOpen, unread, readAll]);

  // Close dropdown on route change
  useEffect(() => {
    setNotifOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell-root dark:text-zinc-100">
      <a href="#main-content" className="skip-link">{t('layout.skip_to_content')}</a>
      <div className="flex w-full min-w-0">
        <aside className="app-sidebar t-resize sticky top-0 hidden h-screen w-[92px] shrink-0 flex-col border-r backdrop-blur sm:flex xl:w-[288px]">
          <Link to="/" className="flex items-center gap-3 px-5 py-7 xl:px-7" aria-label={t('common.site_name')}>
            <span className="app-logo-mark flex h-11 w-11 items-center justify-center rounded-xl text-xl font-black text-white">М</span>
            <span className="hidden text-[1.45rem] font-black uppercase tracking-[-0.045em] text-[#F45B0B] xl:block">{t('common.site_name')}</span>
          </Link>
          <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 xl:px-4" aria-label={t('layout.main_nav')}>
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                badge={item.to === '/messages' && unreadChats > 0 ? unreadChats : undefined}
              />
            ))}
            <NavItem to={user ? `/user/${user.username}` : loginPath} label={t('nav.profile')} icon={UserIcon} />
            {isAdmin ? (
              <Link
                to="/admin"
                className="motion-control flex min-h-14 items-center gap-4 rounded-2xl px-4 text-sm font-black text-[#7C3AED] transition-colors hover:bg-purple-50 dark:hover:bg-purple-950/30"
              >
                <span className="relative">
                  <Shield size={21} />
                </span>
                <span className="hidden xl:block">{t('nav.admin')}</span>
                <ExternalLink size={14} className="hidden opacity-50 xl:block" />
              </Link>
            ) : null}
          </nav>
          <div className="p-3 xl:p-4">
            {user ? (
              <Link to={`/user/${user.username}`} className="app-user-card flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900">
                <Avatar src={user.avatar_url} name={user.display_name} className="h-11 w-11 rounded-xl" />
                <span className="hidden min-w-0 xl:block">
                  <span className="block truncate text-sm font-black">{user.display_name}</span>
                  <span className="block truncate text-xs font-semibold text-gray-400">@{user.username}</span>
                </span>
              </Link>
            ) : (
              <Button className="w-full rounded-xl" onClick={() => navigate(loginPath)}>{t('nav.login')}</Button>
            )}
          </div>
        </aside>

        <div className="app-main-column min-w-0 flex-1">
          <header className="page-header sticky top-0 z-50 flex h-16 items-center justify-between px-3 sm:hidden">
            <Link to="/" className="flex items-center gap-2" aria-label={t('common.site_name')}>
              <span className="app-logo-mark flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black text-white">М</span>
              <span className="text-xl font-black uppercase tracking-tight text-[#FF6B00]">{t('common.site_name')}</span>
            </Link>
            {user ? (
              <NotificationBell
                notifications={notifications}
                unread={unread}
                open={notifOpen}
                onToggle={() => setNotifOpen((v) => !v)}
                onClose={() => setNotifOpen(false)}
                onReadAll={() => readAll.mutate()}
                readAllPending={readAll.isPending}
                onReadOne={(id) => readOne.mutate(id)}
              />
            ) : (
              <Link
                to={loginPath}
                className="motion-control relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                aria-label={t('layout.login_for_notif')}
              >
                <Bell size={20} />
              </Link>
            )}
          </header>

          <main id="main-content" className="min-h-screen min-w-0 overflow-x-clip pb-24 sm:pb-0" tabIndex={-1}>
            <div key={location.pathname} className="motion-route-enter">
              {children}
            </div>
          </main>
        </div>

        <aside className="app-right-rail t-resize sticky top-0 hidden h-screen w-[368px] shrink-0 flex-col border-l backdrop-blur 2xl:flex">
          {/* Notification Bell — outside scroll area so dropdown isn't clipped */}
          <div className="relative z-[60] flex h-20 items-center justify-end border-b border-[var(--app-line)] px-6">
            {user ? (
              <NotificationBell
                notifications={notifications}
                unread={unread}
                open={notifOpen}
                onToggle={() => setNotifOpen((v) => !v)}
                onClose={() => setNotifOpen(false)}
                onReadAll={() => readAll.mutate()}
                readAllPending={readAll.isPending}
                onReadOne={(id) => readOne.mutate(id)}
              />
            ) : (
              <Link
                to={loginPath}
                className="motion-control relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--app-line)] bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-900 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                aria-label={t('layout.login_for_notif')}
              >
                <Bell size={20} />
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-black tracking-[-0.025em]">
              {t('layout.whats_hot')}
              <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" aria-hidden="true" />
            </h2>
            {trendsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-44 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            ) : trendsQuery.data && hasTrendRailContent ? (
              <div className="space-y-0">
                {trendsQuery.data.hashtags.length ? (
                <section className="border-b border-[var(--app-line)] pb-5">
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">{t('layout.hashtags')}</p>
                  <div className="flex flex-wrap gap-2">
                    {trendsQuery.data.hashtags.slice(0, 6).map((tag) => (
                      <Link key={tag.id} to={`/hashtag/${tag.name}`}>
                        <Badge className="rounded-xl bg-[#F4F1FF] px-3 py-1.5 text-[#6552B8] hover:bg-[#ECE7FF] dark:bg-purple-950/30 dark:text-purple-200">#{tag.name}</Badge>
                      </Link>
                    ))}
                  </div>
                </section>
                ) : null}
                {trendsQuery.data.rising_posts.length ? (
                <section className="border-b border-[var(--app-line)] py-5">
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">{t('layout.posts_today')}</p>
                  <div className="space-y-1">
                    {trendsQuery.data.rising_posts.slice(0, 3).map((post) => (
                      <Link key={post.id} to={`/post/${post.id}`} className="motion-control flex min-w-0 gap-3 rounded-xl p-2 hover:bg-gray-50 dark:hover:bg-zinc-900">
                        {post.media_url ? <img src={post.media_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6B00]"><TrendingUp size={18} /></span>}
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm font-bold leading-snug">{post.text || t('layout.media_post')}</span>
                          <span className="mt-1 block text-xs text-gray-400">{post.likes_count} {t('layout.likes')} · {post.comments_count} {t('layout.comments')}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
                ) : null}
                {trendsQuery.data.active_communities.length ? (
                <section className="pt-5">
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">{t('layout.active_communities')}</p>
                  <div className="space-y-1">
                    {trendsQuery.data.active_communities.slice(0, 4).map((community) => (
                      <Link key={community.id} to={`/communities/${community.slug}`} className="motion-control flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 dark:hover:bg-zinc-900">
                        <Avatar src={community.avatar_url} name={community.name} className="h-10 w-10 rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black">{community.name}</span>
                          <span className="block text-xs text-gray-400">{community.members_count} {t('layout.members')}</span>
                        </span>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </section>
                ) : null}
              </div>
            ) : (
              <div className="app-rail-card rounded-2xl p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30">
                  <TrendingUp size={20} />
                </div>
                <p className="font-black">{t('layout.no_trends')}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-zinc-400">{t('layout.no_trends_desc')}</p>
                <Link to="/explore" className="mt-4 inline-flex text-sm font-black text-[#FF6B00] hover:text-orange-700">{t('nav.explore')}</Link>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 items-end border-t border-gray-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden" aria-label={t('layout.mobile_nav')}>
          <MobileLink to="/" label={t('nav.home')} icon={<Home size={22} />} />
          <MobileLink to="/explore" label={t('nav.explore')} icon={<Compass size={22} />} />
          <button
            onClick={() => (user ? setComposerOpen(true) : navigate(loginPath))}
            className="motion-control mx-auto flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-[#FF6B00] text-white shadow-lg shadow-orange-500/30"
            aria-label={user ? t('nav.create_post') : t('nav.login_to_create')}
            title={user ? t('nav.create_post') : t('nav.login_to_create')}
          >
            <Plus size={24} />
          </button>
          <MobileLink to="/messages" label={t('nav.messages')} icon={<MessageSquare size={22} />} badge={unreadChats} />
          <MobileLink to={user ? `/user/${user.username}` : loginPath} label={t('nav.profile')} icon={<UserCircle size={22} />} />
        </nav>
      </div>
      <button onClick={() => (user ? setComposerOpen(true) : navigate(loginPath))} className="motion-control fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#FF6B00] text-white shadow-xl sm:flex lg:hidden" aria-label={t('nav.create_post')}>
        <Plus size={24} />
      </button>
      <PostComposer mode="modal" open={composerOpen} onClose={() => setComposerOpen(false)} />
      <ConfettiCelebration
        active={Boolean(achievement)}
        title={achievement?.title}
        description={achievement?.description}
        onComplete={() => setAchievement(null)}
      />
      <OfflineIndicator />
      <SpotlightSearch />
    </div>
  );
}

/* ---------- Notification Bell Dropdown ---------- */

function NotificationBell({
  notifications,
  unread,
  open,
  onToggle,
  onClose,
  onReadAll,
  readAllPending,
  onReadOne,
}: {
  notifications: NotificationItem[];
  unread: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onReadAll: () => void;
  readAllPending: boolean;
  onReadOne: (id: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const presence = useAnimatedPresence(open, 150);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="motion-control relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        aria-label={t('nav.notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell size={20} />
        <span className="t-badge !-right-0.5 !-top-0.5" data-open={unread > 0} aria-hidden="true">
          <span className="t-badge-dot flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
            <AnimatedNumber value={unread > 99 ? '99+' : unread} />
          </span>
        </span>
      </button>

      {presence.mounted ? (
        <div
          className={cn(
            't-dropdown absolute right-0 top-full z-[100] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950',
            presence.state === 'open' && 'is-open',
            presence.state === 'closing' && 'is-closing',
          )}
          data-origin="top-right"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-sm font-black">{t('nav.notifications')}</p>
            {unread > 0 ? (
              <button
                onClick={onReadAll}
                disabled={readAllPending}
                className="text-xs font-bold text-[#FF6B00] transition-colors hover:text-orange-700 disabled:opacity-50"
              >
                {t('notifications.mark_all')}
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">{t('layout.no_notifications')}</div>
            ) : (
              notifications.slice(0, 20).map((item) => (
                <NotificationRow key={item.id} item={item} onClose={onClose} onRead={onReadOne} />
              ))
            )}
          </div>
          <Link
            to="/notifications"
            onClick={onClose}
            className="block border-t border-gray-100 px-4 py-3 text-center text-sm font-black text-[#FF6B00] hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            {t('layout.all_notifications')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({ item, onClose, onRead }: { item: NotificationItem; onClose: () => void; onRead?: (id: string) => void }) {
  const { t } = useTranslation();
  const href = notificationHref(item);
  const handleClick = () => {
    trackEvent('notification_clicked', {
      notification_id: item.id,
      type: item.type,
      target: href,
      surface: 'dropdown',
    });
    if (onRead && !item.is_read) onRead(item.id);
    onClose();
  };
  const content = (
    <div className={`flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900 ${item.is_read ? 'opacity-60' : ''}`}>
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.is_read ? 'bg-transparent' : 'bg-[#FF6B00]'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{notificationTitle(item.type, t)}</p>
        <p className="truncate text-xs text-gray-500 dark:text-zinc-400">{notificationText(item, t)}</p>
        <p className="mt-0.5 text-[10px] text-gray-400">{timeAgo(item.created_at, t)}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} onClick={handleClick} className="block border-b border-gray-50 last:border-0 dark:border-zinc-900">
        {content}
      </Link>
    );
  }
  return <div onClick={handleClick} className="border-b border-gray-50 last:border-0 dark:border-zinc-900">{content}</div>;
}

/* ---------- Mobile Notification Bell ---------- */

function MobileNotificationBell({ notifications, unread }: { notifications: NotificationItem[]; unread: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();

  if (!user) {
    return (
      <Link to="/login" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black text-gray-400 transition-colors active:bg-gray-100 dark:active:bg-zinc-900" aria-label={t('layout.login_for_notif')}>
        <Bell size={22} />
        <span>{t('layout.notif_short')}</span>
      </Link>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black text-gray-400 transition-colors active:bg-gray-100 dark:active:bg-zinc-900" aria-label={t('nav.notifications')} aria-haspopup="dialog" aria-expanded={open}>
        <Bell size={22} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">{unread > 9 ? '9+' : unread}</span>
        ) : null}
        <span>{t('layout.notif_short')}</span>
      </button>

      {/* Full-screen mobile sheet */}
      {open ? (
        <div className="fixed inset-0 z-[80] flex min-w-0 flex-col bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] dark:border-zinc-800">
            <p className="text-lg font-black">{t('nav.notifications')}</p>
            <button onClick={() => setOpen(false)} className="text-sm font-bold text-[#FF6B00]" aria-label={t('layout.close_notif')}>{t('common.close')}</button>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">{t('layout.no_notifications')}</div>
            ) : (
              notifications.map((item) => (
                <NotificationRow key={item.id} item={item} onClose={() => setOpen(false)} />
              ))
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---------- Helpers ---------- */

function NavItem({ to, label, icon: Icon, badge }: { to: string; label: string; icon: typeof Home; badge?: number }) {
  const location = useLocation();
  const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      data-active={active}
      aria-current={active ? 'page' : undefined}
      className={`motion-nav-link motion-control relative flex min-h-14 items-center gap-4 rounded-2xl px-4 text-[0.94rem] font-black ${
        active
          ? 'bg-[linear-gradient(100deg,#FFF4EC,#FFF8F3)] text-[#F45B0B] shadow-[inset_0_0_0_1px_rgba(255,107,0,0.04)] dark:bg-orange-950/30'
          : 'text-[#596579] hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
      }`}
    >
      {active ? <span className="absolute -left-3 h-8 w-1 rounded-r-full bg-[#FF6B00]" aria-hidden="true" /> : null}
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.25 : 1.9} />
        <span className="t-badge !-right-1.5 !-top-1.5" data-open={Boolean(badge)} aria-hidden="true">
          <span className="t-badge-dot flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">
            <AnimatedNumber value={badge && badge > 9 ? '9+' : badge || 0} />
          </span>
        </span>
      </span>
      <span className="hidden xl:block">{label}</span>
    </Link>
  );
}

function MobileLink({ to, label, icon, badge }: { to: string; label: string; icon: ReactNode; badge?: number }) {
  const location = useLocation();
  const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      data-active={active}
      className={`motion-control relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black active:bg-gray-100 dark:active:bg-zinc-900 ${active ? 'text-[#FF6B00]' : 'text-gray-400'}`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span className="t-badge !-right-0.5 !-top-0.5" data-open={Boolean(badge)} aria-hidden="true">
        <span className="t-badge-dot flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black text-white">
          <AnimatedNumber value={badge && badge > 9 ? '9+' : badge || 0} />
        </span>
      </span>
      <span>{label}</span>
    </Link>
  );
}

function notificationTitle(type: string, t: (key: string) => string) {
  const titles: Record<string, string> = {
    post_removed: t('notification_type.post_removed'),
    account_restricted: t('notification_type.account_restricted'),
    account_unrestricted: t('notification_type.account_unrestricted'),
    role_updated: t('notification_type.role_updated'),
    message: t('notification_type.message'),
    comment: t('notification_type.comment'),
    post_liked: t('notification_type.post_liked'),
    follow: t('notification_type.follow'),
    post_reposted: t('notification_type.post_reposted'),
  };
  return titles[type] || type;
}

function notificationText(item: { type: string; data: Record<string, unknown> }, t: (key: string) => string) {
  const reason = item.data?.reason;
  const actor = item.data?.actor;
  const actorName = typeof actor === 'string' ? actor : null;
  if (typeof reason === 'string') return reason;
  if (actorName && item.type === 'post_liked') return `${actorName} поставил(а) лайк вашему мему`;
  if (actorName && item.type === 'comment') return `${actorName} оставил(а) комментарий или ответ`;
  if (actorName && item.type === 'follow') return `${actorName} подписался(ась) на вас`;
  if (actorName && item.type === 'post_reposted') return `${actorName} поделился(ась) вашим мемом`;
  if (actorName && item.type === 'message') return `${actorName} написал(а) вам`;
  if (actorName) return actorName;
  return t('notification_type.default');
}

function notificationHref(item: { type: string; data: Record<string, unknown> }) {
  if (typeof item.data?.post_id === 'string') return `/post/${item.data.post_id}`;
  if (typeof item.data?.chat_id === 'string') return `/messages?chat=${item.data.chat_id}`;
  return null;
}

function timeAgo(dateString: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return t('time.just_now');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${t('time.min_ago')}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${t('time.h_ago')}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ${t('time.d_ago')}`;
  return new Date(dateString).toLocaleDateString('ru-RU');
}

function apiBaseWs() {
  const httpBase = import.meta.env.VITE_API_URL || window.location.origin;
  return httpBase.replace(/^http/, 'ws');
}
