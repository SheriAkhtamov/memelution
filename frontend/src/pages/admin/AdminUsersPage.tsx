import { useState } from 'react';
import { Ban, Crown, MessageSquareOff, MoreHorizontal, PenOff, Search, ShieldAlert, ShieldCheck, ShieldOff, Timer, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import type { User } from '../../shared/types';
import { Avatar, Button, Dropdown, DropdownItem, EmptyState, Input, Modal, Select, Skeleton, Textarea, useToast } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  global_admin: { label: 'admin.role_admin', className: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-amber-400' },
  admin: { label: 'admin.role_moderator', className: 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 dark:from-purple-900/30 dark:to-violet-900/30 dark:text-purple-400' },
  user: { label: 'admin.role_user', className: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

export function AdminUsersPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRoleFilter] = useState('');
  const [banModal, setBanModal] = useState<User | null>(null);
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState(t('admin.ban_reason_default'));
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';
  const usersQuery = useQuery({ queryKey: ['admin-users', q, role], queryFn: () => api.adminUsers({ q, role: role || undefined }), enabled: Boolean(isAdmin) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.show({ title: t('admin.role_updated'), tone: 'success' });
    },
  });

  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  if (!isAdmin) return <div className="p-6"><EmptyState title={t('admin.no_access')} /></div>;

  const users = usersQuery.data || [];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('admin.users_title')}</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">
              {usersQuery.isLoading ? '...' : `${users.length} ${t('admin.role_users')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t('admin.search_placeholder')}
              className="pl-10"
            />
          </div>
          <Select value={role} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">{t('admin.all_roles')}</option>
            <option value="user">{t('admin.filter_users')}</option>
            <option value="admin">{t('admin.filter_moderators')}</option>
            <option value="global_admin">{t('admin.filter_admins')}</option>
          </Select>
        </div>
      </div>

      {/* Users list */}
      <div className="space-y-3">
        {usersQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : users.length === 0 ? (
          <EmptyState title={t('admin.no_users')} description={t('admin.no_users_desc')} />
        ) : (
          users.map((item) => {
            const restrictions = item.restrictions || {};
            const hasRestrictions = Object.values(restrictions).some(Boolean);
            const roleMeta = ROLE_BADGE[item.role] || ROLE_BADGE.user;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all ${
                  item.is_banned
                    ? 'border-red-200/60 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/10'
                    : hasRestrictions
                    ? 'border-amber-200/60 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10'
                    : 'border-gray-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/50'
                } shadow-sm`}
              >
                <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                      <Avatar src={item.avatar_url} name={item.display_name} className="h-12 w-12 rounded-xl" />
                      {item.is_banned && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-white dark:ring-zinc-900">
                          <Ban size={10} />
                        </span>
                      )}
                      {!item.is_banned && item.role !== 'user' && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-2 ring-white dark:ring-zinc-900">
                          <Crown size={10} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{item.display_name}</p>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleMeta.className}`}>
                          {t(roleMeta.label)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-400 dark:text-zinc-500">@{item.username}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.is_banned && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <Ban size={10} /> {t('admin.banned')}
                          </span>
                        )}
                        {restrictions.posts && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <PenOff size={10} /> {t('admin.posts_blocked')}
                          </span>
                        )}
                        {restrictions.comments && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <MessageSquareOff size={10} /> {t('admin.comments_blocked')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isGlobalAdmin && (
                    <Dropdown
                      trigger={
                        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
                          <MoreHorizontal size={18} />
                        </button>
                      }
                    >
                      {item.role !== 'global_admin' && (
                        <DropdownItem onClick={() => setRole.mutate({ id: item.id, nextRole: 'global_admin' })}>
                          <Crown size={15} className="text-purple-500" /> {t('admin.make_admin')}
                        </DropdownItem>
                      )}
                      {item.role !== 'user' && item.id !== user.id && (
                        <DropdownItem onClick={() => setRole.mutate({ id: item.id, nextRole: 'user' })}>
                          <ShieldOff size={15} className="text-gray-400" /> {t('admin.remove_role')}
                        </DropdownItem>
                      )}
                      <DropdownItem onClick={() => setBanModal(item)}>
                        <Timer size={15} className="text-amber-500" /> {t('admin.ban_timed')}
                      </DropdownItem>
                      <DropdownItem danger onClick={() => moderate.mutate({ id: item.id, payload: { is_banned: true, reason: 'Нарушение правил сайта' } })}>
                        <ShieldAlert size={15} /> {t('admin.ban_permanent')}
                      </DropdownItem>
                      {(item.is_banned || hasRestrictions) && (
                        <DropdownItem onClick={() => moderate.mutate({ id: item.id, payload: { is_banned: false, restrictions: {} } })}>
                          <ShieldCheck size={15} className="text-emerald-500" /> {t('admin.unban')}
                        </DropdownItem>
                      )}
                      <DropdownItem onClick={() => moderate.mutate({ id: item.id, payload: { restrictions: { ...restrictions, posts: !restrictions.posts } } })}>
                        <PenOff size={15} className={restrictions.posts ? 'text-emerald-500' : 'text-amber-500'} />
                        {restrictions.posts ? t('admin.allow_posts') : t('admin.block_posts')}
                      </DropdownItem>
                      <DropdownItem onClick={() => moderate.mutate({ id: item.id, payload: { restrictions: { ...restrictions, comments: !restrictions.comments } } })}>
                        <MessageSquareOff size={15} className={restrictions.comments ? 'text-emerald-500' : 'text-amber-500'} />
                        {restrictions.comments ? t('admin.allow_comments') : t('admin.block_comments')}
                      </DropdownItem>
                    </Dropdown>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Ban modal */}
      <Modal open={Boolean(banModal)} onClose={() => setBanModal(null)} title={t('admin.ban_title')}>
        {banModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/40">
              <Avatar src={banModal.avatar_url} name={banModal.display_name} />
              <div>
                <p className="font-black">{banModal.display_name}</p>
                <p className="text-sm text-gray-400">@{banModal.username}</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
                {t('admin.ban_duration')}
              </label>
              <Input value={duration} onChange={(event) => setDuration(event.target.value)} type="number" placeholder="24" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
                {t('admin.ban_reason')}
              </label>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('admin.ban_reason_placeholder')} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBanModal(null)}>{t('admin.ban_cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => moderate.mutate({ id: banModal.id, payload: { is_banned: true, duration_hours: Number(duration), reason } })}
              >
                <Ban size={16} />
                {t('admin.ban_confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
