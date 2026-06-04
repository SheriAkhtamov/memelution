import { Activity, AlertTriangle, Ban, CheckCircle, Clock, Filter, ScrollText, Shield, UserX } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { EmptyState, Skeleton } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

const ACTION_META: Record<string, { label: string; icon: typeof Activity; color: string; bg: string }> = {
  ban: { label: 'admin.logs_action_ban', icon: Ban, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  unban: { label: 'admin.logs_action_unban', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  restrict: { label: 'admin.logs_action_restrict', icon: UserX, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  unrestrict: { label: 'admin.logs_action_unrestrict', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  role_change: { label: 'admin.logs_action_role', icon: Shield, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  hide_post: { label: 'admin.logs_action_hide', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  reject_report: { label: 'admin.logs_action_dismiss', icon: CheckCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-zinc-800' },
  resolve_report: { label: 'admin.logs_action_resolve', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

const DEFAULT_ACTION = { label: 'admin.logs_action', icon: Activity, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-zinc-800' };

export function AdminLogsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const logsQuery = useQuery({ queryKey: ['admin-logs'], queryFn: api.adminLogs, enabled: Boolean(isAdmin) });
  const [filter, setFilter] = useState('');

  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  if (!isAdmin) return <div className="p-6"><EmptyState title={t('admin.no_access')} /></div>;

  const logs = logsQuery.data || [];
  const filteredLogs = filter
    ? logs.filter((log) => String(log.action).includes(filter))
    : logs;

  // Unique actions for filter
  const uniqueActions = [...new Set(logs.map((l) => String(l.action)))];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-200/50 dark:shadow-purple-900/30">
            <ScrollText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('admin.logs_title')}</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">
              {logsQuery.isLoading ? '...' : `${logs.length} ${t('admin.logs_total')}`}
            </p>
          </div>
        </div>

        {/* Filter */}
        {uniqueActions.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter size={16} className="shrink-0 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={t('admin.logs_all')}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="">{t('admin.logs_all')}</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{t((ACTION_META[a] || DEFAULT_ACTION).label) || a}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {logsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/60 bg-white p-12 text-center shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800">
            <ScrollText size={28} className="text-gray-400" />
          </div>
          <p className="text-lg font-black text-gray-600 dark:text-zinc-300">{t('admin.logs_empty')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('admin.logs_empty_desc')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          {/* Timeline */}
          <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
            {filteredLogs.map((log, index) => {
              const action = String(log.action);
              const meta = ACTION_META[action] || DEFAULT_ACTION;
              const Icon = meta.icon;
              const isLast = index === filteredLogs.length - 1;

              return (
                <div
                  key={String(log.id)}
                  className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-800/20"
                >
                  {/* Timeline dot */}
                  <div className="relative flex flex-col items-center">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color} transition-transform group-hover:scale-110`}>
                      <Icon size={16} />
                    </div>
                    {!isLast && (
                      <div className="absolute left-1/2 top-10 h-full w-px -translate-x-1/2 bg-gray-100 dark:bg-zinc-800" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{t(meta.label)}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                        {String(log.target_type)}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{String(log.reason)}</p>
                    )}
                    {log.created_at && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} />
                        <span>{formatDate(String(log.created_at), lang)}</span>
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
