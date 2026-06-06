import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bookmark, Compass, Home, MessageSquare, Plus, Search, Settings, Shield, Users, User as UserIcon, ExternalLink, UserCircle, TrendingUp } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api/client';
import type { NotificationItem } from '../shared/types';
import { AnimatedNumber, Avatar, Badge, Button, Skeleton, SidebarBlock, Card, IconButton } from '../shared/ui';
import { NotificationItem as NotificationItemComponent } from '../features/notifications/components/NotificationItem';
import { useAuthStore } from '../store/authStore';
import { authRedirectUrl } from '../utils/authRedirect';
import { PostComposer } from '../features/posts/components/PostComposer';
import { ConfettiCelebration } from '../features/gamification/ConfettiCelebration';
import { OfflineIndicator } from '../shared/ui/OfflineIndicator';
import { useTranslation } from '../shared/i18n';
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
    { to: '/notifications', label: t('nav.notifications'), icon: Bell },
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
        <aside
          className="app-sidebar t-resize sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border backdrop-blur sm:flex"
          style={{ width: 'var(--ui-shell-sidebar-w)' }}
        >
          <Link to="/" className="flex items-center gap-3 px-5 py-7 lg:px-7" aria-label={t('common.site_name')}>
            <span className="app-logo-mark flex h-11 w-11 items-center justify-center rounded-xl text-xl font-black text-white">М</span>
            <span className="hidden font-black uppercase tracking-[-0.045em] text-primary lg:block" style={{ fontSize: '1.45rem', letterSpacing: '-0.045em' }}>{t('common.site_name')}</span>
          </Link>
          <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 lg:px-4" aria-label={t('layout.main_nav')}>
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                badge={
                  item.to === '/messages' && unreadChats > 0
                    ? unreadChats
                    : item.to === '/notifications' && unread > 0
                    ? unread
                    : undefined
                }
              />
            ))}
            <NavItem to={user ? `/user/${user.username}` : loginPath} label={t('nav.profile')} icon={UserIcon} />
            {isAdmin ? (
              <Link
                to="/admin"
                className="motion-control flex min-h-14 items-center gap-4 rounded-2xl px-4 text-sm font-black text-secondary transition-colors hover:bg-secondary/10"
              >
                <span className="relative">
                  <Shield size={21} />
                </span>
                <span className="hidden lg:block">{t('nav.admin')}</span>
                <ExternalLink size={14} className="hidden opacity-50 lg:block" />
              </Link>
            ) : null}
          </nav>
          <div className="p-3 lg:p-4">
            {user ? (
              <Link to={`/user/${user.username}`} className="app-user-card flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-muted">
                <Avatar src={user.avatar_url} name={user.display_name} className="h-11 w-11 rounded-xl" />
                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-sm font-black text-foreground">{user.display_name}</span>
                  <span className="block truncate text-xs font-semibold text-muted-foreground">@{user.username}</span>
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
              <span className="text-xl font-black uppercase tracking-tight text-primary">{t('common.site_name')}</span>
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
                className="motion-control relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('layout.login_for_notif')}
              >
                <Bell size={20} />
              </Link>
            )}
          </header>

          <main id="main-content" className="min-h-dvh min-w-0 overflow-x-clip pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-0" tabIndex={-1}>
            <div key={location.pathname} className="motion-route-enter">
              {children}
            </div>
          </main>
        </div>

        <aside
          className="app-right-rail t-resize sticky top-0 hidden h-dvh shrink-0 flex-col border-l border-border backdrop-blur xl:flex"
          style={{ width: 'var(--ui-shell-rail-w)' }}
        >
          {/* Notification Bell — outside scroll area so dropdown isn't clipped */}
          <div className="relative z-[60] flex h-20 items-center justify-end border-b border-border px-6">
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
                className="motion-control relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                aria-label={t('layout.login_for_notif')}
              >
                <Bell size={20} />
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-black tracking-[-0.025em] text-foreground">
              {t('layout.whats_hot')}
              <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true" />
            </h2>
            {trendsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-44 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            ) : trendsQuery.data && hasTrendRailContent ? (
              <div className="space-y-4">
                {trendsQuery.data.hashtags.length ? (
                  <SidebarBlock title={t('layout.hashtags')} icon={TrendingUp}>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {trendsQuery.data.hashtags.slice(0, 6).map((tag) => (
                        <Link key={tag.id} to={`/hashtag/${tag.name}`}>
                          <Badge variant="secondary">#{tag.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </SidebarBlock>
                ) : null}
                {trendsQuery.data.rising_posts.length ? (
                  <SidebarBlock title={t('layout.posts_today')}>
                    <div className="space-y-1 pt-1">
                      {trendsQuery.data.rising_posts.slice(0, 3).map((post) => (
                        <Link key={post.id} to={`/post/${post.id}`} className="motion-control flex min-w-0 gap-3 rounded-xl p-2 hover:bg-muted text-foreground">
                          {post.media_url ? <img src={post.media_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><TrendingUp size={18} /></span>}
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-sm font-bold leading-snug">{post.text || t('layout.media_post')}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{post.likes_count} {t('layout.likes')} · {post.comments_count} {t('layout.comments')}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </SidebarBlock>
                ) : null}
                {trendsQuery.data.active_communities.length ? (
                  <SidebarBlock title={t('layout.active_communities')}>
                    <div className="space-y-1 pt-1">
                      {trendsQuery.data.active_communities.slice(0, 4).map((community) => (
                        <Link key={community.id} to={`/communities/${community.slug}`} className="motion-control flex items-center gap-3 rounded-xl p-2 hover:bg-muted text-foreground">
                          <Avatar src={community.avatar_url} name={community.name} className="h-10 w-10 rounded-xl" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">{community.name}</span>
                            <span className="block text-xs text-muted-foreground">{community.members_count} {t('layout.members')}</span>
                          </span>
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  </SidebarBlock>
                ) : null}
              </div>
            ) : (
              <Card variant="surface" padding="lg">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TrendingUp size={20} />
                </div>
                <p className="font-black text-foreground">{t('layout.no_trends')}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('layout.no_trends_desc')}</p>
                <Link to="/explore" className="mt-4 inline-flex text-sm font-black text-primary hover:brightness-110">{t('nav.explore')}</Link>
              </Card>
            )}
          </div>
        </aside>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 items-end border-t border-gray-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden" aria-label={t('layout.mobile_nav')}>
          <MobileLink to="/" label={t('nav.home')} icon={<Home size={22} />} />
          <MobileLink to="/explore" label={t('nav.explore')} icon={<Compass size={22} />} />
          <Button
            onClick={() => (user ? setComposerOpen(true) : navigate(loginPath))}
            className="mx-auto flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 p-0"
            aria-label={user ? t('nav.create_post') : t('nav.login_to_create')}
            title={user ? t('nav.create_post') : t('nav.login_to_create')}
          >
            <Plus size={24} />
          </Button>
          <MobileLink to="/messages" label={t('nav.messages')} icon={<MessageSquare size={22} />} badge={unreadChats} />
          <MobileLink to={user ? `/user/${user.username}` : loginPath} label={t('nav.profile')} icon={<UserCircle size={22} />} />
        </nav>
      </div>
      <Button onClick={() => (user ? setComposerOpen(true) : navigate(loginPath))} className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl sm:flex lg:hidden p-0" aria-label={t('nav.create_post')}>
        <Plus size={24} />
      </Button>
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
      <IconButton
        label={t('nav.notifications')}
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="motion-control relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <Bell size={20} />
        <span className="t-badge !-right-0.5 !-top-0.5" data-open={unread > 0} aria-hidden="true">
          <span className="t-badge-dot flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-black text-white" style={{ fontSize: '10px' }}>
            <AnimatedNumber value={unread > 99 ? '99+' : unread} />
          </span>
        </span>
      </IconButton>

      {presence.mounted ? (
        <div
          className={cn(
            't-dropdown absolute right-0 top-full z-[100] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl',
            presence.state === 'open' && 'is-open',
            presence.state === 'closing' && 'is-closing',
          )}
          data-origin="top-right"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-black text-foreground">{t('nav.notifications')}</p>
            {unread > 0 ? (
              <Button
                onClick={onReadAll}
                disabled={readAllPending}
                variant="ghost"
                className="text-xs font-bold text-primary hover:text-primary-hover p-0 h-auto cursor-pointer"
              >
                {t('notifications.mark_all')}
              </Button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('layout.no_notifications')}</div>
            ) : (
              notifications.slice(0, 20).map((item) => (
                <NotificationItemComponent key={item.id} item={item} onClose={onClose} onRead={onReadOne} />
              ))
            )}
          </div>
          <Link
            to="/notifications"
            onClick={onClose}
            className="block border-t border-border px-4 py-3 text-center text-sm font-black text-primary hover:bg-muted"
          >
            {t('layout.all_notifications')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}


/* ---------- Mobile Notification Bell ---------- */

function MobileNotificationBell({ notifications, unread }: { notifications: NotificationItem[]; unread: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();

  if (!user) {
    return (
      <Link to="/login" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg font-black text-gray-400 transition-colors active:bg-gray-100 dark:active:bg-zinc-900" style={{ fontSize: '11px' }} aria-label={t('layout.login_for_notif')}>
        <Bell size={22} />
        <span>{t('layout.notif_short')}</span>
      </Link>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="ghost" className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-gray-400 transition-colors active:bg-gray-100 dark:active:bg-zinc-900 h-auto p-0 font-black" style={{ fontSize: '11px' }} aria-label={t('nav.notifications')} aria-haspopup="dialog" aria-expanded={open}>
        <Bell size={22} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 font-black text-white" style={{ fontSize: '9px' }}>{unread > 9 ? '9+' : unread}</span>
        ) : null}
        <span>{t('layout.notif_short')}</span>
      </Button>

      {/* Full-screen mobile sheet */}
      {open ? (
        <div className="fixed inset-0 z-[80] flex min-w-0 flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <p className="text-lg font-black text-foreground">{t('nav.notifications')}</p>
            <Button onClick={() => setOpen(false)} variant="ghost" className="text-sm font-bold text-primary hover:text-primary-hover p-0 h-auto" aria-label={t('layout.close_notif')}>{t('common.close')}</Button>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">{t('layout.no_notifications')}</div>
            ) : (
              notifications.map((item) => (
                <NotificationItemComponent key={item.id} item={item} onClose={() => setOpen(false)} />
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
      className={`motion-nav-link motion-control relative flex min-h-14 items-center gap-4 rounded-2xl px-4 font-black ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
      style={{ fontSize: '0.94rem' }}
    >
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.25 : 1.9} />
        <span className="t-badge !-right-1.5 !-top-1.5" data-open={Boolean(badge)} aria-hidden="true">
          <span className="t-badge-dot flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 font-black text-white" style={{ fontSize: '9px' }}>
            <AnimatedNumber value={badge && badge > 9 ? '9+' : badge || 0} />
          </span>
        </span>
      </span>
      <span className="hidden lg:block">{label}</span>
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
      className={`motion-control relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg font-black active:bg-muted ${active ? 'text-primary' : 'text-muted-foreground'}`}
      style={{ fontSize: '11px' }}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span className="t-badge !-right-0.5 !-top-0.5" data-open={Boolean(badge)} aria-hidden="true">
        <span className="t-badge-dot flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 font-black text-white" style={{ fontSize: '9px' }}>
          <AnimatedNumber value={badge && badge > 9 ? '9+' : badge || 0} />
        </span>
      </span>
      <span>{label}</span>
    </Link>
  );
}


function apiBaseWs() {
  const httpBase = import.meta.env.VITE_API_URL || window.location.origin;
  return httpBase.replace(/^http/, 'ws');
}
