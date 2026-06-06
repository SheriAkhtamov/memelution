import { ReactNode, useMemo, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Hash,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  MessageSquareWarning,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  Users,
  Users2,
  X,
} from 'lucide-react';
import { Avatar, Button, IconButton } from '../shared/ui';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../shared/i18n';

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
  badge?: number;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: NavItem[];
};

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    moderation: location.pathname.startsWith('/admin/reports') || location.pathname.startsWith('/admin/posts') || location.pathname.startsWith('/admin/comments'),
    content: location.pathname.startsWith('/admin/communities') || location.pathname.startsWith('/admin/hashtags'),
    people: location.pathname.startsWith('/admin/users'),
    insights: location.pathname.startsWith('/admin/analytics'),
    system: location.pathname.startsWith('/admin/sessions') || location.pathname.startsWith('/admin/system'),
  });

  const groups = useMemo<NavGroup[]>(() => [
    {
      id: 'main',
      label: t('admin.nav_main'),
      icon: BarChart3,
      items: [
        { to: '/admin', label: t('admin.menu_dashboard'), icon: BarChart3, exact: true },
      ],
    },
    {
      id: 'moderation',
      label: t('admin.nav_moderation'),
      icon: MessageSquareWarning,
      items: [
        { to: '/admin/reports', label: t('admin.menu_reports'), icon: Flag },
        { to: '/admin/posts', label: t('admin.menu_posts'), icon: MessageSquare },
        { to: '/admin/comments', label: t('admin.menu_comments'), icon: MessageSquare },
      ],
    },
    {
      id: 'content',
      label: t('admin.nav_content'),
      icon: Hash,
      items: [
        { to: '/admin/communities', label: t('admin.menu_communities'), icon: Users2 },
        { to: '/admin/hashtags', label: t('admin.menu_hashtags'), icon: Hash },
      ],
    },
    {
      id: 'people',
      label: t('admin.nav_people'),
      icon: Users,
      items: [
        { to: '/admin/users', label: t('admin.menu_users'), icon: Users },
      ],
    },
    {
      id: 'insights',
      label: t('admin.nav_insights'),
      icon: Activity,
      items: [
        { to: '/admin/analytics', label: t('admin.menu_analytics'), icon: BarChart3 },
      ],
    },
    {
      id: 'system',
      label: t('admin.nav_system'),
      icon: Server,
      items: [
        { to: '/admin/sessions', label: t('admin.menu_sessions'), icon: ShieldCheck },
        { to: '/admin/system', label: t('admin.menu_health'), icon: Server },
      ],
    },
    {
      id: 'audit',
      label: t('admin.nav_audit'),
      icon: ScrollText,
      items: [
        { to: '/admin/logs', label: t('admin.menu_logs'), icon: ScrollText },
      ],
    },
  ], [t]);

  const isItemActive = useCallback((item: NavItem) => item.exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(item.to + '/'), [location.pathname]);
  const isGroupActive = (group: NavGroup) => group.items.some(isItemActive);
  const currentTitle = useMemo(() => {
    for (const group of groups) {
      const item = group.items.find(isItemActive);
      if (item) return item.label;
    }
    return t('admin.title');
  }, [groups, isItemActive, t]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="admin-shell-root min-h-dvh bg-background text-foreground">
      <div className="flex">
        {/* Mobile hamburger */}
        <IconButton
          label={t('layout.open_menu')}
          onClick={() => setMobileOpen(true)}
          className="motion-control fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 shadow-lg backdrop-blur-sm dark:bg-zinc-900/80 sm:hidden"
        >
          <Menu size={18} />
        </IconButton>

        {/* Mobile overlay */}
        {mobileOpen ? (
          <div className="motion-overlay fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm sm:hidden" data-state="open" onClick={() => setMobileOpen(false)} />
        ) : null}

        {/* Sidebar */}
        <aside
          className={`
            t-resize fixed inset-y-0 left-0 z-[70] flex h-dvh flex-col border-r border-gray-200/60 bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-in-out dark:border-zinc-800/60 dark:bg-zinc-950/95
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
            sm:sticky sm:top-0 sm:translate-x-0
            ${collapsed ? 'sm:w-[68px]' : 'sm:w-[244px]'}
          `}
        >
          {/* Brand header */}
          <div className="relative border-b border-border">
            <Link to="/admin" className="flex items-center gap-2.5 p-3 xl:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-black text-primary-foreground shadow-md shadow-primary/20">
                <Shield size={18} />
              </span>
              {!collapsed ? (
                <span className="min-w-0 overflow-hidden">
                  <span className="block text-base font-black text-primary">
                    {t('admin.title')}
                  </span>
                  <span className="block text-xs font-bold text-muted-foreground">{t('common.site_name')}</span>
                </span>
              ) : null}
            </Link>

            {/* Mobile close */}
            <IconButton
              label={t('common.close')}
              onClick={() => setMobileOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted sm:hidden"
            >
              <X size={18} />
            </IconButton>

            {/* Desktop collapse toggle */}
            <IconButton
              label={t('common.toggle_sidebar')}
              onClick={() => setCollapsed(!collapsed)}
              className="motion-control absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground sm:flex"
            >
              <span className="t-icon-swap" data-state={collapsed ? 'b' : 'a'}>
                <ChevronLeft size={12} className="t-icon" data-icon="a" />
                <ChevronRight size={12} className="t-icon" data-icon="b" />
              </span>
            </IconButton>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
            {groups.map((group) => {
              const GroupIcon = group.icon;
              const groupActive = isGroupActive(group);
              const isOpen = openGroups[group.id] ?? groupActive;
              const singleItem = group.items.length === 1;
              if (collapsed) {
                return (
                  <div key={group.id} className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          title={item.label}
                          className={`group relative flex items-center justify-center rounded-lg p-2 transition-all duration-200 ${
                            active
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon size={18} />
                        </Link>
                      );
                    })}
                  </div>
                );
              }
              return (
                <div key={group.id} className="space-y-0.5">
                  {singleItem ? (
                    group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className={`group relative flex items-center gap-2.5 rounded-lg p-2 font-bold transition-all duration-200 ${
                            active
                              ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          style={{ fontSize: '0.82rem' }}
                        >
                          <Icon size={16} className="shrink-0" />
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      );
                    })
                  ) : (
                    <>
                      <Button
                        onClick={() => toggleGroup(group.id)}
                        variant="ghost"
                        aria-expanded={isOpen}
                        className={cn(
                          "group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 font-black uppercase tracking-wider transition-colors h-auto p-0 justify-start normal-case border-0 bg-transparent",
                          groupActive
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        style={{ fontSize: '9px' }}
                      >
                        <GroupIcon size={12} className="shrink-0" />
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown
                          size={12}
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                        />
                      </Button>
                      {isOpen ? (
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = isItemActive(item);
                            return (
                              <Link
                                key={item.to}
                                to={item.to}
                                onClick={() => setMobileOpen(false)}
                                className={`group relative flex items-center gap-2.5 rounded-lg p-2 font-bold transition-all duration-200 ${
                                  active
                                    ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                                style={{ fontSize: '0.82rem' }}
                              >
                                <Icon size={16} className="shrink-0" />
                                <span className="flex-1">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="space-y-0.5 border-t border-border p-2.5">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-lg p-2 font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              style={{ fontSize: '0.82rem' }}
            >
              <Home size={17} className="shrink-0" />
              {!collapsed ? <span>{t('layout.site')}</span> : null}
            </Link>

            {user ? (
              <div className={`flex items-center gap-2.5 rounded-lg bg-muted/40 p-2 ${collapsed ? 'justify-center' : ''}`}>
                <Avatar src={user.avatar_url} name={user.display_name} className="h-8 w-8 shrink-0" />
                {!collapsed ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-foreground" style={{ fontSize: '0.82rem' }}>{user.display_name}</span>
                    <span className="block truncate text-xs font-bold text-muted-foreground">
                      @{user.username}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}

            <Button
              onClick={logout}
              variant="ghost"
              className="flex w-full items-center gap-2.5 rounded-lg p-2 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive justify-start h-auto cursor-pointer"
              style={{ fontSize: '0.82rem' }}
            >
              <LogOut size={17} className="shrink-0" />
              {!collapsed ? <span>{t('layout.logout')}</span> : null}
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-h-dvh min-w-0 flex-1 overflow-x-clip pt-14 sm:pt-0">
          <div className="motion-route-enter" key={location.pathname}>
            <div className="mx-auto w-full max-w-7xl space-y-4 p-3 sm:p-4 lg:p-5">
              <div className="hidden items-center gap-2 text-xs font-bold text-muted-foreground sm:flex">
                <Link to="/admin" className="hover:text-primary">{t('admin.title')}</Link>
                <span>/</span>
                <span className="text-foreground">{currentTitle}</span>
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
