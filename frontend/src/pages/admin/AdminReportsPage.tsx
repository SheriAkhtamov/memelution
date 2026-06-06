import { AlertTriangle, Check, Eye, EyeOff, ExternalLink, Flag, MessageSquare, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, SegmentedControl, Skeleton, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
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

type TargetFilter = 'all' | 'post' | 'comment' | 'user' | 'community';
type StatusFilter = 'pending' | 'all' | 'resolved';

const TARGET_FILTERS: Array<{ id: TargetFilter; label: string; icon: typeof MessageSquare }> = [
  { id: 'all', label: 'admin.reports_filter_all', icon: Flag },
  { id: 'post', label: 'admin.reports_filter_post', icon: MessageSquare },
  { id: 'comment', label: 'admin.reports_filter_comment', icon: MessageSquare },
  { id: 'user', label: 'admin.reports_filter_user', icon: Flag },
  { id: 'community', label: 'admin.reports_filter_community', icon: Flag },
];

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'pending', label: 'admin.reports_tab_pending' },
  { id: 'all', label: 'admin.reports_filter_all' },
  { id: 'resolved', label: 'admin.reports_tab_resolved' },
];

export function AdminReportsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';

  const [target, setTarget] = useState<TargetFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [confirmDismissAll, setConfirmDismissAll] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.adminReports(),
    enabled: Boolean(isAdmin),
  });

  const resolveReport = useMutation({
    mutationFn: ({ id, action, status = 'resolved' }: { id: string; action?: string; status?: string }) => api.resolveReport(id, status, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
      toast.show({ title: t('admin.report_resolved'), tone: 'success' });
    },
  });
  const dismissAll = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.resolveReport(id, 'rejected', 'reject_report'))),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
      toast.show({ title: `${ids.length} ${t('admin.reports_dismiss')}`, tone: 'success' });
    },
  });

  const reports = reportsQuery.data || [];

  const filtered = useMemo(() => {
    const ql = debouncedQ.toLowerCase();
    return reports.filter((r) => {
      if (target !== 'all' && String(r.target_type) !== target) return false;
      if (statusFilter === 'pending' && !OPEN_REPORT_STATUSES.has(String(r.status))) return false;
      if (statusFilter === 'resolved' && OPEN_REPORT_STATUSES.has(String(r.status))) return false;
      if (ql) {
        const text = JSON.stringify(r).toLowerCase();
        if (!text.includes(ql)) return false;
      }
      return true;
    });
  }, [reports, target, statusFilter, debouncedQ]);

  const pending = useMemo(
    () => reports.filter((r) => OPEN_REPORT_STATUSES.has(String(r.status))),
    [reports],
  );

  const availableTargets = useMemo(() => {
    const seen = new Set(reports.map((r) => String(r.target_type)));
    return TARGET_FILTERS.filter((f) => f.id === 'all' || seen.has(f.id));
  }, [reports]);

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Flag}
        title={t('admin.reports_title')}
        subtitle={
          reportsQuery.isLoading
            ? '…'
            : `${reports.length} ${t('admin.reports_total')} · ${pending.length} ${t('admin.reports_pending')}`
        }
        tone="amber"
        actions={
          pending.length > 1 ? (
            <Button variant="outline" loading={dismissAll.isPending} onClick={() => setConfirmDismissAll(true)}>
              <X size={14} />
              {t('admin.reports_dismiss_all')} ({pending.length})
            </Button>
          ) : null
        }
      />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.reports_search_placeholder')}
              className="pl-10"
            />
          </div>
          <SegmentedControl<StatusFilter>
            value={statusFilter}
            options={STATUS_FILTERS.map((o) => ({ id: o.id, label: t(o.label) }))}
            onChange={setStatusFilter}
            size="sm"
          />
          <SegmentedControl<TargetFilter>
            value={target}
            options={availableTargets.map((f) => ({ id: f.id, label: t(f.label) }))}
            onChange={setTarget}
            size="sm"
          />
        </div>
      </div>

      {reportsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : reportsQuery.isError ? (
        <ErrorState
          description={reportsQuery.error instanceof Error ? reportsQuery.error.message : t('admin.error_load_reports')}
          onRetry={() => reportsQuery.refetch()}
        />
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/60 bg-white p-12 text-center shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{t('admin.reports_clean')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('admin.reports_clean_desc')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t('admin.reports_empty_filtered')} />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <ReportCard key={String(report.id)} report={report} onResolve={resolveReport} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDismissAll}
        onClose={() => setConfirmDismissAll(false)}
        title={t('admin.confirm_dismiss_all_title')}
        description={t('admin.confirm_dismiss_all_desc')}
        loading={dismissAll.isPending}
        onConfirm={() => {
          dismissAll.mutate(pending.map((r) => String(r.id)));
          setConfirmDismissAll(false);
        }}
      />
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ReportCard({
  report,
  onResolve,
}: {
  report: any;
  onResolve: any;
}) {
  const { t } = useTranslation();
  const statusMeta = STATUS_STYLES[String(report.status)] || STATUS_STYLES.pending;
  const StatusIcon = statusMeta.icon;
  const TargetIcon = TARGET_ICONS[String(report.target_type)] || Flag;
  const contextText =
    report.context && typeof report.context === 'object'
      ? String((report.context as { name?: string; text?: string }).text || (report.context as { name?: string }).name || '')
      : '';
  const action = actionForTarget(String(report.target_type));
  const resolved = !OPEN_REPORT_STATUSES.has(String(report.status));
  const targetId = report.target_id ? String(report.target_id) : null;
  const targetHref =
    targetId && report.target_type === 'post'
      ? `/post/${targetId}`
      : targetId && report.target_type === 'community'
      ? `/c/${report.context?.slug || targetId}`
      : targetId && report.target_type === 'user'
      ? `/u/${targetId}`
      : null;

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 ${
        resolved
          ? 'border-gray-200/40 bg-white/60 opacity-70 dark:border-zinc-800/40 dark:bg-zinc-900/30'
          : 'border-gray-200/60 bg-white shadow-sm hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50'
      }`}
    >
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
              {targetId ? <span> · #{targetId}</span> : null}
              {report.reporter_id ? <span> · {String(report.reporter_id)}</span> : null}
            </p>
            {contextText ? (
              <p className="mt-2 max-w-lg rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-zinc-800/40 dark:text-zinc-300">
                {contextText.slice(0, 240)}
                {contextText.length > 240 ? '…' : ''}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {targetHref ? (
            <Link
              to={targetHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ExternalLink size={12} /> {t('admin.posts_action_view')}
            </Link>
          ) : null}
          {!resolved ? (
            <>
              <button
                onClick={() => onResolve.mutate({ id: String(report.id), action: 'reject_report', status: 'rejected' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 hover:shadow-sm active:scale-95 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <EyeOff size={14} />
                {t('admin.reports_dismiss')}
              </button>
              <button
                onClick={() => onResolve.mutate({ id: String(report.id), action: action.value, status: 'resolved' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-all hover:bg-red-100 hover:shadow-sm active:scale-95 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Eye size={14} />
                {t(action.label)}
              </button>
            </>
          ) : null}
        </div>
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
