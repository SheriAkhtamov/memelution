import { ReactNode, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ChevronLeft, ChevronRight, FileWarning, Home, LogOut, Menu, ScrollText, Shield, Users, X } from 'lucide-react';
import { Avatar } from '../shared/ui';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../shared/i18n';

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminNavItems = useMemo(() => [
    { to: '/admin', label: t('admin.dashboard'), icon: BarChart3, exact: true },
    { to: '/admin/users', label: t('admin.users'), icon: Users },
    { to: '/admin/reports', label: t('admin.reports'), icon: FileWarning },
    { to: '/admin/logs', label: t('admin.logs'), icon: ScrollText },
  ], [t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50/30 text-[#1F2937] dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <div className="flex">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95 dark:bg-zinc-900/80 sm:hidden"
          aria-label={t('layout.open_menu')}
        >
          <Menu size={20} />
        </button>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm sm:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-[70] flex h-screen flex-col border-r border-gray-200/60 bg-white/95 backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-zinc-800/60 dark:bg-zinc-950/95
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
            sm:sticky sm:top-0 sm:translate-x-0
            ${collapsed ? 'sm:w-[76px]' : 'sm:w-72'}
          `}
        >
          {/* Brand header */}
          <div className="relative border-b border-gray-100 dark:border-zinc-800/60">
            <Link to="/admin" className="flex items-center gap-3 p-4 xl:p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#FF8C38] text-xl font-black text-white shadow-md shadow-orange-200 dark:shadow-orange-900/30">
                <Shield size={20} />
              </span>
              {!collapsed && (
                <span className="min-w-0 overflow-hidden">
                  <span className="block bg-gradient-to-r from-[#FF6B00] to-[#FF8C38] bg-clip-text text-lg font-black text-transparent">
                    {t('admin.title')}
                  </span>
                  <span className="block text-xs font-bold text-gray-400 dark:text-zinc-500">{t('common.site_name')}</span>
                </span>
              )}
            </Link>

            {/* Mobile close */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 sm:hidden"
            >
              <X size={18} />
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 sm:flex"
            >
              {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {adminNavItems.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-xl p-3 text-sm font-bold transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-[#FF6B00]/10 to-orange-50 text-[#FF6B00] shadow-sm shadow-orange-100/50 dark:from-orange-950/30 dark:to-orange-950/10 dark:shadow-none'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#FF6B00] transition-all" />
                  )}
                  <item.icon size={20} className={`shrink-0 transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`} />
                  {!collapsed && <span>{item.label}</span>}
                  {active && !collapsed && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#FF6B00] animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="space-y-1 border-t border-gray-100 p-3 dark:border-zinc-800/60">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
            >
              <Home size={20} className="shrink-0" />
              {!collapsed && <span>{t('layout.site')}</span>}
            </Link>

            {user && (
              <div className={`flex items-center gap-3 rounded-xl bg-gray-50/80 p-2.5 dark:bg-zinc-900/40 ${collapsed ? 'justify-center' : ''}`}>
                <Avatar src={user.avatar_url} name={user.display_name} className="h-9 w-9 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{user.display_name}</span>
                    <span className="block truncate text-xs font-bold text-gray-400 dark:text-zinc-500">
                      @{user.username}
                    </span>
                  </span>
                )}
              </div>
            )}

            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-bold text-red-500 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
            >
              <LogOut size={20} className="shrink-0" />
              {!collapsed && <span>{t('layout.logout')}</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-h-screen min-w-0 flex-1 pt-14 sm:pt-0">{children}</main>
      </div>
    </div>
  );
}
