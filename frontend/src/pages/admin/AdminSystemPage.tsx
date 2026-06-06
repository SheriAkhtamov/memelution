import { CheckCircle2, Database, Server, Shield, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

export function AdminSystemPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const isGlobalAdmin = user?.role === 'global_admin';

  const query = useQuery({
    queryKey: ['admin-system'],
    queryFn: api.adminSystem,
    enabled: Boolean(isGlobalAdmin),
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isGlobalAdmin) return <EmptyState title={t('admin.no_access')} description={t('admin.system_warning_global')} />;

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Server} title={t('admin.system_title')} subtitle={t('admin.system_subtitle')} tone="cyan" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Server} title={t('admin.system_title')} subtitle={t('admin.system_subtitle')} tone="cyan" />
        <ErrorState
          description={query.error instanceof Error ? query.error.message : t('admin.error_load_users')}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  const s = query.data;

  return (
    <div className="space-y-6">
      <PageHeader icon={Server} title={t('admin.system_title')} subtitle={t('admin.system_subtitle')} tone="cyan" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('admin.system_app')} value={s.app_name} icon={Server} tone="blue" />
        <StatCard label={t('admin.system_version')} value={s.version} icon={Shield} tone="emerald" />
        <StatCard label={t('admin.system_environment')} value={s.environment} icon={Database} tone="violet" />
        <StatCard label={t('admin.system_uptime')} value={s.uptime} icon={CheckCircle2} tone="emerald" />
      </div>

      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <h2 className="mb-4 text-lg font-black">{t('admin.system_runtime')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HealthRow label={t('admin.system_server_time')} value={new Date(s.server_time).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} />
          <HealthRow label={t('admin.system_python')} value={s.python_version} />
          <HealthRow label={t('admin.system_db')} value={s.database} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <h2 className="mb-4 text-lg font-black">{t('admin.system_storage')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('admin.system_total_users')} value={(s.total_users || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={Shield} tone="blue" />
          <StatCard label={t('admin.system_total_posts')} value={(s.total_posts || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={Database} tone="emerald" />
          <StatCard label={t('admin.system_total_communities')} value={(s.total_communities || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={Database} tone="violet" />
          <StatCard label={t('admin.system_active_sessions')} value={(s.active_sessions || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={CheckCircle2} tone="cyan" />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <h2 className="mb-4 text-lg font-black">{t('admin.system_health_checks')}</h2>
        <ul className="space-y-2">
          {s.checks.map((check) => (
            <li
              key={check.name}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                check.ok
                  ? 'border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                  : 'border-red-200/60 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {check.ok ? (
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle size={18} className="text-red-600 dark:text-red-400" />
                )}
                <div>
                  <p className="font-black">{check.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{check.detail || '—'}</p>
                </div>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  check.ok
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}
              >
                {check.ok ? t('admin.system_check_ok') : t('admin.system_check_fail')}
              </span>
            </li>
          ))}
        </ul>
      </section>
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
