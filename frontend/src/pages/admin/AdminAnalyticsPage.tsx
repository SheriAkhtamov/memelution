import { Activity, BarChart3, Flag, PieChart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Avatar, Chart, ChartLegend, EmptyState, ErrorState, PageHeader, SegmentedControl, Skeleton, StatCard } from '../../shared/ui';
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

export function AdminAnalyticsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';

  const [range, setRange] = useState<RangeId>('30');
  const days = Number(range);

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
  const moderationQuery = useQuery({
    queryKey: ['admin-moderation-analytics', days],
    queryFn: () => api.adminModerationAnalytics(days),
    enabled: Boolean(isAdmin),
  });

  const totals = useMemo(() => {
    const data = timeseriesQuery.data;
    if (!data) return { users: 0, posts: 0, comments: 0, reports: 0 };
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    return {
      users: sum(data.users),
      posts: sum(data.posts),
      comments: sum(data.comments),
      reports: sum(data.reports),
    };
  }, [timeseriesQuery.data]);

  const palette = ['#FF6B00', '#7C3AED', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#6366F1'];

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const ts = timeseriesQuery.data;
  const top = topQuery.data;
  const mod = moderationQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title={t('admin.analytics_title')}
        subtitle={t('admin.analytics_subtitle')}
        tone="blue"
        actions={
          <SegmentedControl<RangeId>
            value={range}
            options={RANGE_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setRange}
            size="sm"
          />
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('admin.analytics_total_users')}
          value={totals.users.toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
          icon={Activity}
          tone="blue"
          hint={t('admin.analytics_in_range', { days: String(days) })}
        />
        <StatCard
          label={t('admin.analytics_total_posts')}
          value={totals.posts.toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
          icon={BarChart3}
          tone="emerald"
          hint={t('admin.analytics_in_range', { days: String(days) })}
        />
        <StatCard
          label={t('admin.analytics_total_comments')}
          value={totals.comments.toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
          icon={Activity}
          tone="cyan"
          hint={t('admin.analytics_in_range', { days: String(days) })}
        />
        <StatCard
          label={t('admin.analytics_total_reports')}
          value={totals.reports.toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
          icon={Flag}
          tone="red"
          hint={t('admin.analytics_in_range', { days: String(days) })}
        />
      </div>

      {/* Growth chart */}
      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <h2 className="mb-4 text-lg font-black">{t('admin.chart_growth')}</h2>
        {timeseriesQuery.isLoading ? (
          <Skeleton className="h-[220px] w-full rounded-xl" />
        ) : timeseriesQuery.isError ? (
          <ErrorState
            description={timeseriesQuery.error instanceof Error ? timeseriesQuery.error.message : t('admin.error_load_users')}
            onRetry={() => timeseriesQuery.refetch()}
          />
        ) : !ts ? (
          <EmptyState title={t('admin.analytics_no_data')} />
        ) : (
          <Chart
            kind="area"
            series={[
              { name: t(METRIC_LABELS.users), data: ts.users },
              { name: t(METRIC_LABELS.posts), data: ts.posts },
              { name: t(METRIC_LABELS.comments), data: ts.comments },
              { name: t(METRIC_LABELS.reports), data: ts.reports },
            ]}
            labels={ts.days}
            height={240}
            ariaLabel={t('admin.chart_growth')}
          />
        )}
      </section>

      {/* Top content */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <h2 className="mb-4 text-lg font-black">{t('admin.top_users')}</h2>
          {topQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !top?.top_users.length ? (
            <EmptyState title={t('admin.analytics_no_data')} />
          ) : (
            <ul className="space-y-2">
              {top.top_users.slice(0, 8).map((u, idx) => (
                <li key={u.id} className="flex items-center gap-3 rounded-xl bg-gray-50/60 p-2.5 dark:bg-zinc-800/40">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[10px] font-black text-[#FF6B00] dark:bg-orange-900/30 dark:text-orange-300">
                    {idx + 1}
                  </span>
                  <Avatar src={u.avatar_url} name={u.display_name} className="h-8 w-8" />
                  <p className="flex-1 truncate text-sm font-black">{u.display_name}</p>
                  <span className="text-xs font-bold text-gray-500">{(u.posts_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <h2 className="mb-4 text-lg font-black">{t('admin.top_communities')}</h2>
          {topQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !top?.top_communities.length ? (
            <EmptyState title={t('admin.analytics_no_data')} />
          ) : (
            <ul className="space-y-2">
              {top.top_communities.slice(0, 8).map((c, idx) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-gray-50/60 p-2.5 dark:bg-zinc-800/40">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-[10px] font-black text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                    {idx + 1}
                  </span>
                  <Avatar src={c.avatar_url} name={c.name} className="h-8 w-8" />
                  <p className="flex-1 truncate text-sm font-black">{c.name}</p>
                  <span className="text-xs font-bold text-gray-500">{(c.members_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <h2 className="mb-4 text-lg font-black">{t('admin.top_posts')}</h2>
          {topQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !top?.top_posts.length ? (
            <EmptyState title={t('admin.analytics_no_data')} />
          ) : (
            <ul className="space-y-2">
              {top.top_posts.slice(0, 8).map((p, idx) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-gray-50/60 p-2.5 dark:bg-zinc-800/40">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-black text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{p.text?.slice(0, 60) || '—'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">@{p.author?.username || ''}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-500">♥ {(p.likes_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Moderation analytics */}
      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{t('admin.analytics_moderation_title')}</h2>
          <PieChart size={20} className="text-gray-400" />
        </div>
        {moderationQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : moderationQuery.isError ? (
          <ErrorState
            description={moderationQuery.error instanceof Error ? moderationQuery.error.message : t('admin.error_load_users')}
            onRetry={() => moderationQuery.refetch()}
          />
        ) : !mod ? (
          <EmptyState title={t('admin.analytics_no_data')} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-gray-500">{t('admin.analytics_by_action')}</h3>
              <Chart
                kind="donut"
                series={[{ name: t('admin.analytics_by_action'), data: mod.by_action.map((x) => x.count) }]}
                labels={mod.by_action.map((x) => x.action)}
                palette={palette}
                height={220}
                ariaLabel={t('admin.analytics_by_action')}
              />
              <div className="mt-3">
                <ChartLegend
                  items={mod.by_action.map((x, i) => ({ name: x.action, color: palette[i % palette.length] }))}
                />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-gray-500">{t('admin.analytics_by_target')}</h3>
              <Chart
                kind="donut"
                series={[{ name: t('admin.analytics_by_target'), data: mod.by_target.map((x) => x.count) }]}
                labels={mod.by_target.map((x) => x.target_type)}
                palette={palette}
                height={220}
                ariaLabel={t('admin.analytics_by_target')}
              />
              <div className="mt-3">
                <ChartLegend
                  items={mod.by_target.map((x, i) => ({ name: x.target_type, color: palette[i % palette.length] }))}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Report reasons bar chart */}
      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <h2 className="mb-4 text-lg font-black">{t('admin.analytics_top_report_reasons')}</h2>
        {topQuery.isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !top?.top_report_reasons.length ? (
          <EmptyState title={t('admin.analytics_no_data')} />
        ) : (
          <Chart
            kind="bar"
            series={[{ name: t('admin.analytics_top_report_reasons'), data: top.top_report_reasons.map((r) => r.count) }]}
            labels={top.top_report_reasons.map((r) => r.reason)}
            palette={palette}
            height={220}
            ariaLabel={t('admin.analytics_top_report_reasons')}
          />
        )}
      </section>
    </div>
  );
}
