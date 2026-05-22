import { Activity, BarChart3, Flag, MessageSquare, Shield, TrendingUp, Users, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { EmptyState, Skeleton } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

const METRIC_CONFIG: Record<string, { label: string; icon: typeof Users; color: string; gradient: string }> = {
  users: { label: 'admin.stat_users', icon: Users, color: 'text-blue-500', gradient: 'from-blue-500/10 to-blue-600/5' },
  posts: { label: 'admin.stat_posts', icon: MessageSquare, color: 'text-emerald-500', gradient: 'from-emerald-500/10 to-emerald-600/5' },
  reports: { label: 'admin.stat_reports', icon: Flag, color: 'text-amber-500', gradient: 'from-amber-500/10 to-amber-600/5' },
  communities: { label: 'admin.stat_communities', icon: Shield, color: 'text-purple-500', gradient: 'from-purple-500/10 to-purple-600/5' },
  active_users: { label: 'admin.stat_active', icon: Activity, color: 'text-cyan-500', gradient: 'from-cyan-500/10 to-cyan-600/5' },
  active_users_7d: { label: 'admin.stat_active_7d', icon: Activity, color: 'text-cyan-500', gradient: 'from-cyan-500/10 to-cyan-600/5' },
  returning_users_7d: { label: 'admin.stat_returned_7d', icon: TrendingUp, color: 'text-lime-500', gradient: 'from-lime-500/10 to-lime-600/5' },
  popular_posts_7d: { label: 'admin.stat_popular_7d', icon: BarChart3, color: 'text-fuchsia-500', gradient: 'from-fuchsia-500/10 to-fuchsia-600/5' },
  community_growth_7d: { label: 'admin.stat_community_growth', icon: Users, color: 'text-violet-500', gradient: 'from-violet-500/10 to-violet-600/5' },
  blocked_users: { label: 'admin.stat_banned', icon: Zap, color: 'text-red-500', gradient: 'from-red-500/10 to-red-600/5' },
  banned_users: { label: 'admin.stat_banned', icon: Zap, color: 'text-red-500', gradient: 'from-red-500/10 to-red-600/5' },
};

const DEFAULT_META = { label: 'Статистика', icon: BarChart3, color: 'text-gray-500', gradient: 'from-gray-500/10 to-gray-600/5' };
const OPEN_REPORT_STATUSES = new Set(['open', 'pending']);

export function AdminDashboardPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: api.adminStats, enabled: Boolean(isAdmin) });
  const reportsQuery = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.adminReports(), enabled: Boolean(isAdmin) });
  const logsQuery = useQuery({ queryKey: ['admin-logs'], queryFn: api.adminLogs, enabled: Boolean(isAdmin) });

  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  if (!isAdmin) return <div className="p-6"><EmptyState title={t('admin.no_access')} /></div>;

  const pendingReports = (reportsQuery.data || []).filter((r) => OPEN_REPORT_STATUSES.has(String(r.status))).length;
  const recentLogs = (logsQuery.data || []).slice(0, 5);

  return (
    <div className="space-y-8 p-6 lg:p-8">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#FF8C38] text-white shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('admin.dashboard')}</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">{t('admin.panel')}</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Object.entries(statsQuery.data || {}).map(([key, value]) => {
            const meta = METRIC_CONFIG[key] || DEFAULT_META;
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className={`group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} ${meta.color}`}>
                    <Icon size={20} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    {t(meta.label)}
                  </p>
                  <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">
                    {typeof value === 'number' ? value.toLocaleString(LOCALE_MAP[lang]) : value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick info cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending reports quick view */}
        <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag size={18} className="text-amber-500" />
              <h2 className="text-lg font-black">{t('admin.pending_reports')}</h2>
            </div>
            {pendingReports > 0 && (
              <span className="flex h-7 items-center rounded-full bg-amber-100 px-2.5 text-xs font-black text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {pendingReports}
              </span>
            )}
          </div>
          {reportsQuery.isLoading ? (
            <Skeleton className="h-20" />
          ) : pendingReports === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">✓</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t('admin.no_pending')}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {(reportsQuery.data || []).filter((r) => OPEN_REPORT_STATUSES.has(String(r.status))).slice(0, 3).map((report) => (
                <div key={String(report.id)} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 dark:bg-zinc-800/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{String(report.reason)}</p>
                    <p className="text-xs text-gray-400">{String(report.target_type)}</p>
                  </div>
                  <span className="ml-2 shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {t('admin.pending')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent moderation activity */}
        <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-500" />
            <h2 className="text-lg font-black">{t('admin.recent_activity')}</h2>
          </div>
          {logsQuery.isLoading ? (
            <Skeleton className="h-20" />
          ) : recentLogs.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-zinc-800/40">
              <span className="text-sm font-bold text-gray-400">{t('admin.no_activity')}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={String(log.id)} className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-zinc-800/40">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <Activity size={12} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{String(log.action)}</p>
                    <p className="truncate text-xs text-gray-400">{String(log.target_type)} {log.reason ? `· ${String(log.reason)}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
