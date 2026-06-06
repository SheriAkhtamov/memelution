import {
  Activity,
  BarChart3,
  Flag,
  MessageSquare,
  ScrollText,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Avatar, Chart, ChartLegend, EmptyState, PageHeader, SegmentedControl, Skeleton, StatCard } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

type RangeId = '7' | '14' | '30' | '90';
const RANGE_OPTIONS: Array<{ id: RangeId; labelKey: string }> = [
  { id: '7', labelKey: 'admin.range_7d' },
  { id: '14', labelKey: 'admin.range_14d' },
  { id: '30', labelKey: 'admin.range_30d' },
  { id: '90', labelKey: 'admin.range_90d' },
];

const METRIC_KEYS = ['users', 'posts', 'comments', 'reports'] as const;
const METRIC_LABELS: Record<typeof METRIC_KEYS[number], string> = {
  users: 'admin.chart_metric_users',
  posts: 'admin.chart_metric_posts',
  comments: 'admin.chart_metric_comments',
  reports: 'admin.chart_metric_reports',
};

export function AdminDashboardPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';
  const [range, setRange] = useState<RangeId>('14');
  const [activeMetrics, setActiveMetrics] = useState<Array<typeof METRIC_KEYS[number]>>(['users', 'posts']);

  const days = Number(range);

  const systemQuery = useQuery({
    queryKey: ['admin-system'],
    queryFn: api.adminSystem,
    enabled: Boolean(isGlobalAdmin),
  });
  const timeseriesQuery = useQuery({
    queryKey: ['admin-timeseries', days],
    queryFn: () => api.adminTimeseries(days),
    enabled: Boolean(isAdmin),
  });
  const topQuery = useQuery({
    queryKey: ['admin-top'],
    queryFn: api.adminTop,
    enabled: Boolean(isAdmin),
  });
  const reportsQuery = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.adminReports(),
    enabled: Boolean(isAdmin),
  });
  const logsQuery = useQuery({
    queryKey: ['admin-logs'],
    queryFn: api.adminLogs,
    enabled: Boolean(isAdmin),
  });

  const system = systemQuery.data;

  const series = useMemo(() => {
    const data = timeseriesQuery.data;
    if (!data) return [];
    return activeMetrics.map((metric) => ({
      name: t(METRIC_LABELS[metric]),
      data: data[metric] || [],
    }));
  }, [timeseriesQuery.data, activeMetrics, t]);

  const legendItems = useMemo(
    () => series.map((s, i) => ({
      name: s.name,
      color: ['#FF6B00', '#7C3AED', '#10B981', '#F59E0B'][i % 4],
    })),
    [series],
  );

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const openReports = (reportsQuery.data || []).filter((r) => String(r.status) === 'open' || String(r.status) === 'pending').length;
  const recentLogs = (logsQuery.data || []).slice(0, 5);

  const kpiCards: Array<{ label: string; value: number; icon: typeof Users; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'cyan' | 'violet'; deltaLabel?: string; hint?: string }> = system ? [
    { label: t('admin.kpi_users_total'), value: system.total_users, icon: Users, tone: 'blue' },
    { label: t('admin.kpi_users_new_today'), value: system.new_users_today, icon: UserPlus, tone: 'emerald', hint: t('admin.last_24h') },
    { label: t('admin.kpi_users_new_week'), value: system.new_users_week, icon: TrendingUp, tone: 'violet', hint: t('admin.this_week') },
    { label: t('admin.kpi_banned_users'), value: system.banned_users, icon: Shield, tone: 'red' },
    { label: t('admin.kpi_restricted'), value: system.restricted_users, icon: Zap, tone: 'amber' },
    { label: t('admin.kpi_posts_today'), value: system.new_posts_today, icon: MessageSquare, tone: 'cyan', hint: t('admin.last_24h') },
    { label: t('admin.kpi_comments_today'), value: system.new_comments_today, icon: MessageSquare, tone: 'blue', hint: t('admin.last_24h') },
    { label: t('admin.kpi_open_reports'), value: system.open_reports, icon: Flag, tone: 'red' },
    { label: t('admin.kpi_resolved_week'), value: system.resolved_reports_week, icon: TrendingUp, tone: 'emerald', hint: t('admin.this_week') },
    { label: t('admin.kpi_active_sessions'), value: system.active_sessions, icon: Activity, tone: 'purple' },
    { label: t('admin.kpi_sessions_today'), value: system.sessions_today, icon: Activity, tone: 'cyan', hint: t('admin.last_24h') },
    { label: t('admin.kpi_mod_actions_week'), value: system.mod_actions_week, icon: ScrollText, tone: 'violet', hint: t('admin.this_week') },
  ] : [];

  const toggleMetric = (metric: typeof METRIC_KEYS[number]) => {
    setActiveMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) return current;
        return current.filter((m) => m !== metric);
      }
      return [...current, metric];
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title={t('admin.dashboard')}
        subtitle={t('admin.dashboard_subtitle')}
        badge={openReports > 0 ? (
          <span className="flex h-6 items-center rounded-full bg-amber-100 px-2.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {openReports} {t('admin.reports_pending')}
          </span>
        ) : null}
      />

      {!isGlobalAdmin ? (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          {t('admin.system_warning_global')}
        </div>
      ) : null}

      {/* KPI grid */}
      {!isGlobalAdmin ? null : systemQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {kpiCards.map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value.toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
              icon={kpi.icon}
              tone={kpi.tone}
              hint={kpi.hint || kpi.deltaLabel}
            />
          ))}
        </div>
      )}

      {/* Chart card */}
      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black">{t('admin.chart_growth')}</h2>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">{t('admin.chart_growth_desc')}</p>
          </div>
          <SegmentedControl<RangeId>
            value={range}
            options={RANGE_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setRange}
            size="sm"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {METRIC_KEYS.map((metric) => {
            const active = activeMetrics.includes(metric);
            return (
              <button
                key={metric}
                onClick={() => toggleMetric(metric)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {t(METRIC_LABELS[metric])}
              </button>
            );
          })}
        </div>
        {timeseriesQuery.isLoading ? (
          <Skeleton className="h-[180px] w-full rounded-xl" />
        ) : !timeseriesQuery.data ? (
          <EmptyState title={t('admin.analytics_no_data')} />
        ) : (
          <div>
            <Chart kind="line" series={series} labels={timeseriesQuery.data.days} height={220} ariaLabel={t('admin.chart_growth')} />
            {legendItems.length > 0 ? (
              <div className="mt-3">
                <ChartLegend items={legendItems} />
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Top content + Recent activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">{t('admin.top_users')}</h2>
            <Link to="/admin/users" className="text-xs font-black text-[#FF6B00] hover:underline">
              {t('admin.menu_users')}
            </Link>
          </div>
          {topQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !topQuery.data?.top_users.length ? (
            <EmptyState title={t('admin.analytics_no_data')} />
          ) : (
            <ul className="space-y-2">
              {topQuery.data.top_users.slice(0, 6).map((u, idx) => (
                <li key={u.id} className="flex items-center gap-3 rounded-xl bg-gray-50/60 p-2.5 dark:bg-zinc-800/40">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-black text-[#FF6B00] dark:bg-orange-900/30 dark:text-orange-300">
                    {idx + 1}
                  </span>
                  <Avatar src={u.avatar_url} name={u.display_name} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{u.display_name}</p>
                    <p className="truncate text-xs text-gray-400">@{u.username}</p>
                  </div>
                  <div className="text-right text-xs font-bold text-gray-500 dark:text-zinc-400">
                    <p>{(u.posts_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} {t('admin.analytics_no_data').includes('данных') ? 'постов' : 'posts'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">{t('admin.top_communities')}</h2>
            <Link to="/admin/communities" className="text-xs font-black text-[#FF6B00] hover:underline">
              {t('admin.menu_communities')}
            </Link>
          </div>
          {topQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !topQuery.data?.top_communities.length ? (
            <EmptyState title={t('admin.analytics_no_data')} />
          ) : (
            <ul className="space-y-2">
              {topQuery.data.top_communities.slice(0, 6).map((c, idx) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-gray-50/60 p-2.5 dark:bg-zinc-800/40">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-xs font-black text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                    {idx + 1}
                  </span>
                  <Avatar src={c.avatar_url} name={c.name} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{c.name}</p>
                    <p className="truncate text-xs text-gray-400">@{c.slug}</p>
                  </div>
                  <div className="text-right text-xs font-bold text-gray-500 dark:text-zinc-400">
                    <p>{(c.members_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">{t('admin.recent_activity')}</h2>
            <Link to="/admin/logs" className="text-xs font-black text-[#FF6B00] hover:underline">
              {t('admin.menu_logs')}
            </Link>
          </div>
          {logsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : recentLogs.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-zinc-800/40">
              <span className="text-sm font-bold text-gray-400">{t('admin.no_activity')}</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentLogs.map((log) => (
                <li key={String(log.id)} className="flex items-start gap-3 rounded-xl bg-gray-50/60 p-2.5 dark:bg-zinc-800/40">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <Activity size={12} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{String(log.action)}</p>
                    <p className="truncate text-xs text-gray-400">{String(log.target_type)} {log.reason ? `· ${String(log.reason)}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isGlobalAdmin && system ? (
        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">{t('admin.system_health')}</h2>
            <Link to="/admin/system" className="text-xs font-black text-[#FF6B00] hover:underline">
              {t('admin.menu_health')}
            </Link>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <HealthRow label={t('admin.system_app')} value={system.app_name} />
            <HealthRow label={t('admin.system_version')} value={system.version} />
            <HealthRow label={t('admin.system_environment')} value={system.environment} />
            <HealthRow label={t('admin.system_server_time')} value={new Date(system.server_time).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate font-bold">{value}</p>
    </div>
  );
}
