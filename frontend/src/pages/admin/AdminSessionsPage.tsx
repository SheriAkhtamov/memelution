import { Activity, Search, ShieldX, Smartphone, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, SegmentedControl, Skeleton, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

type StatusId = 'all' | 'active' | 'revoked';
const STATUS_OPTIONS: Array<{ id: StatusId; labelKey: string }> = [
  { id: 'all', labelKey: 'admin.sessions_status_all' },
  { id: 'active', labelKey: 'admin.sessions_status_active' },
  { id: 'revoked', labelKey: 'admin.sessions_status_revoked' },
];

function deviceFromUA(ua: string | null | undefined): string {
  if (!ua) return '—';
  const s = ua.toLowerCase();
  if (s.includes('iphone')) return 'iPhone';
  if (s.includes('ipad')) return 'iPad';
  if (s.includes('android')) return 'Android';
  if (s.includes('mac os')) return 'macOS';
  if (s.includes('windows')) return 'Windows';
  if (s.includes('linux')) return 'Linux';
  return ua.slice(0, 24);
}

export function AdminSessionsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isGlobalAdmin = user?.role === 'global_admin';

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [status, setStatus] = useState<StatusId>('active');
  const [confirm, setConfirm] = useState<{ id: string; user: string } | null>(null);
  const [revokeAllTarget, setRevokeAllTarget] = useState<{ id: string; user: string } | null>(null);

  const queryArgs = useMemo(() => {
    const args: Parameters<typeof api.adminSessions>[0] = { limit: 200 };
    if (debouncedQ) args.q = debouncedQ;
    if (status === 'active') args.status = 'active';
    else if (status === 'revoked') args.status = 'revoked';
    return args;
  }, [debouncedQ, status]);

  const sessionsQuery = useQuery({
    queryKey: ['admin-sessions', queryArgs],
    queryFn: () => api.adminSessions(queryArgs),
    enabled: Boolean(isGlobalAdmin),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
  };

  const revoke = useMutation({
    mutationFn: (id: string) => api.adminRevokeSession(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast.show({ title: t('admin.sessions_action_revoke'), tone: 'success' });
    },
  });
  const revokeAll = useMutation({
    mutationFn: (id: string) => api.adminRevokeUserSessions(id),
    onSuccess: () => {
      invalidate();
      setRevokeAllTarget(null);
      toast.show({ title: t('admin.sessions_action_revoke_all'), tone: 'success' });
    },
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isGlobalAdmin) return <EmptyState title={t('admin.no_access')} description={t('admin.system_warning_global')} />;

  const sessions = sessionsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader icon={Activity} title={t('admin.sessions_title')} subtitle={t('admin.sessions_subtitle')} tone="purple" />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.sessions_search_placeholder')} className="pl-10" />
          </div>
          <SegmentedControl<StatusId>
            value={status}
            options={STATUS_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setStatus}
            size="sm"
          />
        </div>
      </div>

      {sessionsQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : sessionsQuery.isError ? (
        <ErrorState
          description={sessionsQuery.error instanceof Error ? sessionsQuery.error.message : t('admin.error_load_users')}
          onRetry={() => sessionsQuery.refetch()}
        />
      ) : sessions.length === 0 ? (
        <EmptyState title={t('admin.sessions_empty')} />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const u = s.user;
            const isCurrent = user?.id && s.user_id === user.id;
            return (
              <li
                key={s.id}
                className={`rounded-2xl border p-4 shadow-sm ${
                  s.is_revoked
                    ? 'border-gray-200/60 bg-gray-50/40 dark:border-zinc-800/40 dark:bg-zinc-900/30'
                    : 'border-gray-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/50'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar src={u?.avatar_url} name={u?.display_name} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{u?.display_name || '—'}</p>
                      <span className="text-xs text-gray-400">@{u?.username || ''}</span>
                      {isCurrent ? (
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {t('admin.sessions_current_label')}
                        </span>
                      ) : null}
                      {s.is_revoked ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:bg-zinc-700 dark:text-zinc-300">
                          <ShieldX size={10} /> {t('admin.sessions_revoked_label')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <Smartphone size={12} /> {deviceFromUA(s.user_agent)}
                      </span>
                      {s.ip_address ? <span>· IP {s.ip_address}</span> : null}
                      <span>· {new Date(s.created_at).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                      <span>· {t('admin.sessions_expires')}: {new Date(s.expires_at).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!s.is_revoked && u ? (
                      <Button
                        variant="outline"
                        onClick={() => setRevokeAllTarget({ id: u.id, user: u.display_name })}
                      >
                        {t('admin.sessions_action_revoke_all')}
                      </Button>
                    ) : null}
                    {!s.is_revoked && !isCurrent ? (
                      <Button
                        variant="danger"
                        loading={revoke.isPending && revoke.variables === s.id}
                        onClick={() => setConfirm({ id: s.id, user: u?.display_name || '' })}
                      >
                        <Trash2 size={14} /> {t('admin.sessions_action_revoke')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={t('admin.sessions_confirm_revoke_title')}
        description={t('admin.sessions_confirm_revoke_desc')}
        loading={revoke.isPending}
        onConfirm={() => confirm && revoke.mutate(confirm.id)}
      />

      <ConfirmDialog
        open={Boolean(revokeAllTarget)}
        onClose={() => setRevokeAllTarget(null)}
        title={t('admin.sessions_confirm_revoke_all_title')}
        description={t('admin.sessions_confirm_revoke_all_desc', { user: revokeAllTarget?.user || '' })}
        loading={revokeAll.isPending}
        onConfirm={() => revokeAllTarget && revokeAll.mutate(revokeAllTarget.id)}
        tone="danger"
      />
    </div>
  );
}
