import { useState } from 'react';
import { Ban, Crown, Flag, MessageSquareOff, PenOff, Shield, ShieldAlert, ShieldCheck, ShieldOff, Timer } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import type { User } from '../../shared/types';
import { Avatar, Button, EmptyState, Input, Modal, Select, Skeleton, Textarea, useToast } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

export function AdminPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRoleFilter] = useState('');
  const [banModal, setBanModal] = useState<User | null>(null);
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState(t('admin.ban_reason_default'));
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: api.adminStats, enabled: Boolean(isAdmin) });
  const usersQuery = useQuery({ queryKey: ['admin-users', q, role], queryFn: () => api.adminUsers({ q, role: role || undefined }), enabled: Boolean(isAdmin) });
  const reportsQuery = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.adminReports(), enabled: Boolean(isAdmin) });
  const logsQuery = useQuery({ queryKey: ['admin-logs'], queryFn: api.adminLogs, enabled: Boolean(isAdmin) });
  const moderate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof api.moderateUser>[1] }) => api.moderateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.show({ title: t('admin.action_applied'), tone: 'success' });
      setBanModal(null);
    },
  });
  const setRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: string }) => api.setUserRole(id, nextRole),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const resolveReport = useMutation({
    mutationFn: ({ id, action, status = 'resolved' }: { id: string; action?: string; status?: string }) => api.resolveReport(id, status, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
  });

  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  if (!isAdmin) return <div className="p-6"><EmptyState title={t('admin.no_access')} /></div>;

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 px-6 py-5 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/90">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#FF8C38] text-white shadow-md shadow-orange-200/50 dark:shadow-orange-900/30">
            <Shield size={20} />
          </div>
          <h1 className="text-2xl font-black tracking-tight">{t('admin.title')}</h1>
        </div>
      </header>

      <div className="space-y-8 p-6">
        {/* Stats */}
        {statsQuery.isLoading ? <Skeleton className="h-24 rounded-2xl" /> : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Object.entries(statsQuery.data || {}).map(([key, value]) => <Metric key={key} label={key} value={value} lang={lang} />)}
          </div>
        )}

        {/* Users section */}
        <section className="space-y-4 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <h2 className="text-xl font-black">{t('admin.users_title')}</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('admin.search_users')} />
            <Select value={role} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">{t('admin.all_roles')}</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="global_admin">global_admin</option>
            </Select>
          </div>
          <div className="space-y-3">
            {(usersQuery.data || []).map((item) => {
              const restrictions = item.restrictions || {};
              return (
                <div key={item.id} className="rounded-xl border border-gray-200/60 p-4 transition-all hover:shadow-sm dark:border-zinc-800/60">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={item.avatar_url} name={item.display_name} />
                      <div>
                        <p className="font-black">@{item.username}</p>
                        <p className="text-sm text-gray-400">{item.display_name} · {item.role}{item.is_banned ? ` · ${t('admin.banned')}` : ''}</p>
                        {Object.keys(restrictions).length ? <p className="text-xs font-bold text-amber-600">Ограничения: {Object.keys(restrictions).join(', ')}</p> : null}
                      </div>
                    </div>
                    {isGlobalAdmin ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.role !== 'global_admin' ? <Button variant="outline" onClick={() => setRole.mutate({ id: item.id, nextRole: 'global_admin' })}>global admin</Button> : null}
                        {item.role !== 'user' && item.id !== user.id ? <Button variant="outline" onClick={() => setRole.mutate({ id: item.id, nextRole: 'user' })}>{t('admin.remove_role')}</Button> : null}
                        <Button variant="outline" onClick={() => setBanModal(item)}>{t('admin.ban_timed')}</Button>
                        <Button variant="outline" onClick={() => moderate.mutate({ id: item.id, payload: { is_banned: true, reason: 'Нарушение правил сайта' } })}>{t('admin.ban_permanent')}</Button>
                        <Button variant="outline" onClick={() => moderate.mutate({ id: item.id, payload: { is_banned: false, restrictions: {} } })}>{t('admin.unban')}</Button>
                        <Button variant="outline" onClick={() => moderate.mutate({ id: item.id, payload: { restrictions: { ...restrictions, posts: !restrictions.posts } } })}>{restrictions.posts ? t('admin.allow_posts') : t('admin.block_posts')}</Button>
                        <Button variant="outline" onClick={() => moderate.mutate({ id: item.id, payload: { restrictions: { ...restrictions, comments: !restrictions.comments } } })}>{restrictions.comments ? t('admin.allow_comments') : t('admin.block_comments')}</Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reports section */}
        <section className="space-y-3 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <h2 className="flex items-center gap-2 text-xl font-black"><Flag size={18} className="text-amber-500" /> {t('admin.reports_title')}</h2>
          {(reportsQuery.data || []).map((report) => {
            const action = reportActionForTarget(String(report.target_type));
            return (
              <div key={String(report.id)} className="rounded-xl border border-gray-200/60 p-4 transition-all hover:shadow-sm dark:border-zinc-800/60">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-black">{String(report.reason)}</p>
                    <p className="text-sm text-gray-400">{String(report.target_type)} · {String(report.status)}</p>
                    {report.context && typeof report.context === 'object' ? <p className="mt-2 line-clamp-2 text-sm">{String((report.context as { name?: string; text?: string }).text || (report.context as { name?: string }).name || '')}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => resolveReport.mutate({ id: String(report.id), action: 'reject_report', status: 'rejected' })}>{t('admin.reports_dismiss')}</Button>
                    <Button onClick={() => resolveReport.mutate({ id: String(report.id), action: action.value })}>{t(action.label)}</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Logs section */}
        <section className="space-y-2 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <h2 className="text-xl font-black">{t('admin.logs_title')}</h2>
          {(logsQuery.data || []).slice(0, 12).map((log) => <p key={String(log.id)} className="border-b border-gray-100 py-2.5 text-sm text-gray-500 dark:border-zinc-800">{String(log.action)} · {String(log.target_type)} · {String(log.reason || '')}</p>)}
        </section>
      </div>

      <Modal open={Boolean(banModal)} onClose={() => setBanModal(null)} title={t('admin.ban_title')}>
        <div className="space-y-4">
          {banModal && (
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/40">
              <Avatar src={banModal.avatar_url} name={banModal.display_name} />
              <div>
                <p className="font-black">{banModal.display_name}</p>
                <p className="text-sm text-gray-400">@{banModal.username}</p>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('admin.ban_duration')}</label>
            <Input value={duration} onChange={(event) => setDuration(event.target.value)} type="number" placeholder="24" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('admin.ban_reason')}</label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('admin.ban_reason_placeholder')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBanModal(null)}>{t('admin.ban_cancel')}</Button>
            <Button variant="danger" onClick={() => banModal && moderate.mutate({ id: banModal.id, payload: { is_banned: true, duration_hours: Number(duration), reason } })}>
              <Ban size={16} />
              {t('admin.ban_confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['my-reports'], queryFn: api.myReports, enabled: Boolean(user) });
  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 px-6 py-5 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/90">
        <h1 className="text-2xl font-black tracking-tight">Мои жалобы</h1>
      </header>
      <div className="space-y-3 p-6">
        {(query.data || []).map((item) => (
          <div key={String(item.id)} className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
            <p className="font-black">{String(item.reason)}</p>
            <p className="text-sm text-gray-400">{String(item.target_type)} · {String(item.status)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, lang }: { label: string; value: number; lang: string }) {
  return (
    <div className="group rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">{typeof value === 'number' ? value.toLocaleString(LOCALE_MAP[lang]) : value}</p>
    </div>
  );
}

function reportActionForTarget(targetType: string) {
  if (targetType === 'comment') return { value: 'hide_comment', label: 'admin.report_action_hide_comment' };
  if (targetType === 'user') return { value: 'ban_user', label: 'admin.report_action_ban' };
  if (targetType === 'community') return { value: 'ban_community', label: 'admin.report_action_ban' };
  return { value: 'hide_post', label: 'admin.report_action_hide_post' };
}
