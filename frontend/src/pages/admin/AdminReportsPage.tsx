import { AlertTriangle, Check, Eye, EyeOff, Flag, MessageSquare, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { EmptyState, Skeleton, useToast } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof Check }> = {
  open: { label: 'admin.report_status_pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  pending: { label: 'admin.report_status_pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  resolved: { label: 'admin.report_status_resolved', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Check },
  rejected: { label: 'admin.report_status_dismissed', className: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400', icon: X },
};
const OPEN_REPORT_STATUSES = new Set(['open', 'pending']);

const TARGET_ICONS: Record<string, typeof MessageSquare> = {
  post: MessageSquare,
  comment: MessageSquare,
  user: Flag,
  community: Flag,
};

export function AdminReportsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const reportsQuery = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.adminReports(), enabled: Boolean(isAdmin) });
  const resolveReport = useMutation({
    mutationFn: ({ id, action, status = 'resolved' }: { id: string; action?: string; status?: string }) => api.resolveReport(id, status, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
      toast.show({ title: t('admin.report_resolved'), tone: 'success' });
    },
  });

  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  if (!isAdmin) return <div className="p-6"><EmptyState title={t('admin.no_access')} /></div>;

  const reports = reportsQuery.data || [];
  const pending = reports.filter((r) => OPEN_REPORT_STATUSES.has(String(r.status)));
  const resolved = reports.filter((r) => !OPEN_REPORT_STATUSES.has(String(r.status)));

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
          <Flag size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('admin.reports_title')}</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">
            {reportsQuery.isLoading ? '...' : `${reports.length} ${t('admin.reports_total')} · ${pending.length} ${t('admin.reports_pending')}`}
          </p>
        </div>
      </div>

      {reportsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/60 bg-white p-12 text-center shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{t('admin.reports_clean')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('admin.reports_clean_desc')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending reports */}
          {pending.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle size={12} />
                </span>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">
                  {t('admin.reports_tab_pending')} ({pending.length})
                </h2>
              </div>
              <div className="space-y-3">
                {pending.map((report) => (
                  <ReportCard key={String(report.id)} report={report} onResolve={resolveReport} />
                ))}
              </div>
            </section>
          )}

          {/* Resolved reports */}
          {resolved.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Check size={12} />
                </span>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">
                  {t('admin.reports_tab_resolved')} ({resolved.length})
                </h2>
              </div>
              <div className="space-y-3">
                {resolved.map((report) => (
                  <ReportCard key={String(report.id)} report={report} onResolve={resolveReport} resolved />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ReportCard({
  report,
  onResolve,
  resolved,
}: {
  report: any;
  onResolve: any;
  resolved?: boolean;
}) {
  const { t } = useTranslation();
  const statusMeta = STATUS_STYLES[String(report.status)] || STATUS_STYLES.pending;
  const StatusIcon = statusMeta.icon;
  const TargetIcon = TARGET_ICONS[String(report.target_type)] || Flag;
  const contextText = report.context && typeof report.context === 'object'
    ? String((report.context as { name?: string; text?: string }).text || (report.context as { name?: string }).name || '')
    : '';
  const action = actionForTarget(String(report.target_type));

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 ${
      resolved
        ? 'border-gray-200/40 bg-white/60 opacity-70 dark:border-zinc-800/40 dark:bg-zinc-900/30'
        : 'border-gray-200/60 bg-white shadow-sm hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
            <TargetIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">{String(report.reason)}</p>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${statusMeta.className}`}>
                <StatusIcon size={10} />
                {t(statusMeta.label)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">
              {t('admin.reports_type')} <span className="font-bold">{String(report.target_type)}</span>
            </p>
            {contextText && (
              <p className="mt-2 max-w-lg rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-zinc-800/40 dark:text-zinc-300">
                {contextText}
              </p>
            )}
          </div>
        </div>

        {!resolved && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => onResolve.mutate({ id: String(report.id), action: 'reject_report', status: 'rejected' })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 hover:shadow-sm active:scale-95 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <EyeOff size={14} />
              {t('admin.reports_dismiss')}
            </button>
            <button
              onClick={() => onResolve.mutate({ id: String(report.id), action: action.value })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-all hover:bg-red-100 hover:shadow-sm active:scale-95 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Eye size={14} />
              {t(action.label)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function actionForTarget(targetType: string) {
  if (targetType === 'comment') return { value: 'hide_comment', label: 'admin.report_action_hide_comment' };
  if (targetType === 'user') return { value: 'ban_user', label: 'admin.report_action_ban' };
  if (targetType === 'community') return { value: 'ban_community', label: 'admin.report_action_ban' };
  return { value: 'hide_post', label: 'admin.report_action_hide_post' };
}
