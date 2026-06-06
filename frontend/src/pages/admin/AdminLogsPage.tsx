import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  Download,
  Filter,
  ScrollText,
  Search,
  Shield,
  UserX,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Button, EmptyState, ErrorState, Input, PageHeader, SegmentedControl, Select, Skeleton } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

const ACTION_META: Record<string, { label: string; icon: typeof Activity; color: string; bg: string }> = {
  ban: { label: 'admin.logs_action_ban', icon: Ban, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  unban: { label: 'admin.logs_action_unban', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  restrict: { label: 'admin.logs_action_restrict', icon: UserX, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  unrestrict: { label: 'admin.logs_action_unrestrict', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  set_user_role: { label: 'admin.logs_action_role', icon: Shield, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  hide_post: { label: 'admin.logs_action_hide_post', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  restore_post: { label: 'admin.logs_action_restore_post', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  pin_post: { label: 'admin.logs_action_pin_post', icon: Shield, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  unpin_post: { label: 'admin.logs_action_unpin_post', icon: Shield, color: 'text-gray-500 dark:text-zinc-400', bg: 'bg-gray-100 dark:bg-zinc-800' },
  delete_post: { label: 'admin.logs_action_delete_post', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  hide_comment: { label: 'admin.logs_action_hide_comment', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  restore_comment: { label: 'admin.logs_action_restore_comment', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  delete_comment: { label: 'admin.logs_action_delete_comment', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  ban_community: { label: 'admin.logs_action_ban_community', icon: Ban, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  unban_community: { label: 'admin.logs_action_unban_community', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  delete_hashtag: { label: 'admin.logs_action_delete_hashtag', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  revoke_session: { label: 'admin.logs_action_revoke_session', icon: Shield, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  revoke_all_sessions: { label: 'admin.logs_action_revoke_all', icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  reject_report: { label: 'admin.logs_action_dismiss', icon: CheckCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-zinc-800' },
  resolve_report: { label: 'admin.logs_action_resolve', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

const DEFAULT_ACTION = { label: 'admin.logs_action', icon: Activity, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-zinc-800' };

function formatDate(dateString: string, lang: string): string {
  try {
    return new Date(dateString).toLocaleString(LOCALE_MAP[lang] || 'ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function escapeCsv(value: string): string {
  if (value == null) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function AdminLogsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [actionFilter, setActionFilter] = useState('');
  const [targetType, setTargetType] = useState('');
  const [moderator, setModerator] = useState('');

  const queryArgs = useMemo(() => {
    const args: Parameters<typeof api.adminLogsFiltered>[0] = { limit: 200 };
    if (debouncedQ) args.q = debouncedQ;
    if (actionFilter) args.action = actionFilter;
    if (targetType) args.target_type = targetType;
    if (moderator) args.moderator_id = moderator;
    return args;
  }, [debouncedQ, actionFilter, targetType, moderator]);

  const logsQuery = useQuery({
    queryKey: ['admin-logs', queryArgs],
    queryFn: () => api.adminLogsFiltered(queryArgs),
    enabled: Boolean(isAdmin),
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const logs = logsQuery.data || [];
  const uniqueActions = [...new Set(logs.map((l) => String(l.action)))];
  const uniqueTargets = [...new Set(logs.map((l) => String(l.target_type)))];

  const exportCsv = () => {
    const header = ['id', 'action', 'target_type', 'target_id', 'reason', 'moderator_id', 'created_at'];
    const rows = logs.map((log) => [
      String(log.id ?? ''),
      String(log.action ?? ''),
      String(log.target_type ?? ''),
      String(log.target_id ?? ''),
      String(log.reason ?? ''),
      String(log.moderator_id ?? ''),
      String(log.created_at ?? ''),
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-logs-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title={t('admin.logs_title')}
        subtitle={logsQuery.isLoading ? '…' : `${logs.length} ${t('admin.logs_total')}`}
        tone="violet"
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={logs.length === 0}
            title={isGlobalAdmin ? t('admin.logs_export') : t('admin.system_warning_global')}
          >
            <Download size={14} /> {t('admin.logs_export')}
          </Button>
        }
      />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.logs_search_placeholder')} className="pl-10" />
          </div>
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">{t('admin.logs_all')}</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{t((ACTION_META[a] || DEFAULT_ACTION).label) || a}</option>
            ))}
          </Select>
          <Select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="">{t('admin.logs_all_target_types')}</option>
            {uniqueTargets.map((tt) => (
              <option key={tt} value={tt}>{tt}</option>
            ))}
          </Select>
          <Input value={moderator} onChange={(e) => setModerator(e.target.value)} placeholder={t('admin.logs_moderator_placeholder')} />
        </div>
      </div>

      {logsQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : logsQuery.isError ? (
        <ErrorState
          description={logsQuery.error instanceof Error ? logsQuery.error.message : t('admin.error_load_users')}
          onRetry={() => logsQuery.refetch()}
        />
      ) : logs.length === 0 ? (
        <EmptyState title={t('admin.logs_empty')} description={t('admin.logs_empty_desc')} icon={<Filter size={28} />} />
      ) : (
        <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
            {logs.map((log, index) => {
              const action = String(log.action);
              const meta = ACTION_META[action] || DEFAULT_ACTION;
              const Icon = meta.icon;
              const isLast = index === logs.length - 1;

              return (
                <div
                  key={String(log.id)}
                  className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-800/20"
                >
                  <div className="relative flex flex-col items-center">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color} transition-transform group-hover:scale-110`}>
                      <Icon size={16} />
                    </div>
                    {!isLast && (
                      <div className="absolute left-1/2 top-10 h-full w-px -translate-x-1/2 bg-gray-100 dark:bg-zinc-800" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{t(meta.label)}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                        {String(log.target_type)}
                      </span>
                      {log.target_id ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          #{String(log.target_id)}
                        </span>
                      ) : null}
                    </div>
                    {log.reason && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{String(log.reason)}</p>
                    )}
                    {log.created_at && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} />
                        <span>{formatDate(String(log.created_at), lang)}</span>
                        {log.moderator_id ? <span>· {String(log.moderator_id)}</span> : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
