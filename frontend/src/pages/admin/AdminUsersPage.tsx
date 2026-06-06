import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, Crown, Eye, MessageSquareOff, MoreHorizontal, PenOff, Search, ShieldAlert, ShieldCheck, ShieldOff, Timer, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import type { User } from '../../shared/types';
import { Avatar, Button, ConfirmDialog, Dropdown, DropdownItem, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Textarea, UserInspector, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  global_admin: { label: 'admin.role_admin', className: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-amber-400' },
  admin: { label: 'admin.role_moderator', className: 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 dark:from-purple-900/30 dark:to-violet-900/30 dark:text-purple-400' },
  user: { label: 'admin.role_user', className: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

type ConfirmKind = 'ban' | 'admin' | 'demote' | null;

export function AdminUsersPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [role, setRoleFilter] = useState('');
  const [banModal, setBanModal] = useState<User | null>(null);
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState(t('admin.ban_reason_default'));
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; target: User; revert: () => void } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const [inspector, setInspector] = useState<User | null>(null);
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';
  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedQ, role],
    queryFn: () => api.adminUsers({ q: debouncedQ, role: role || undefined }),
    enabled: Boolean(isAdmin),
  });

  const applyUserPatch = (id: string, patch: Partial<User>) => {
    queryClient.setQueryData<User[]>(['admin-users', debouncedQ, role], (current) => {
      if (!current) return current;
      return current.map((u) => (u.id === id ? { ...u, ...patch } : u));
    });
  };
  const moderate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof api.moderateUser>[1] }) => api.moderateUser(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users', debouncedQ, role] });
      const previous = queryClient.getQueryData<User[]>(['admin-users', debouncedQ, role]);
      const patch: Partial<User> = {};
      if (typeof payload.is_banned === 'boolean') patch.is_banned = payload.is_banned;
      if (payload.restrictions) patch.restrictions = { ...(payload.restrictions as Record<string, boolean>) };
      applyUserPatch(id, patch);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-users', debouncedQ, role], context.previous);
      toast.show({ title: t('admin.error_load_users'), tone: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onSuccess: (_data, vars) => {
      setBanModal(null);
      const revert = () => {
        const target = vars.payload;
        if (target.is_banned) {
          moderate.mutate({ id: vars.id, payload: { is_banned: false, restrictions: {} } });
        } else if (target.restrictions) {
          const inverse: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(target.restrictions)) inverse[k] = !Boolean(v);
          moderate.mutate({ id: vars.id, payload: { restrictions: inverse } });
        }
      };
      const isDestructive = vars.payload.is_banned === true;
      toast.show({
        title: t('admin.action_applied'),
        tone: 'success',
        duration: isDestructive ? 8000 : undefined,
        action: isDestructive ? { label: t('admin.undo'), onClick: revert } : undefined,
      });
    },
  });
  const setRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: string; previousRole?: string }) => api.setUserRole(id, nextRole),
    onMutate: async ({ id, nextRole }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users', debouncedQ, role] });
      const previous = queryClient.getQueryData<User[]>(['admin-users', debouncedQ, role]);
      applyUserPatch(id, { role: nextRole });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-users', debouncedQ, role], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onSuccess: (_data, vars) => {
      const isDestructive = vars.nextRole === 'global_admin' || (vars.nextRole === 'user' && vars.previousRole === 'admin');
      const revert = () => {
        if (vars.previousRole) setRole.mutate({ id: vars.id, nextRole: vars.previousRole, previousRole: vars.nextRole });
      };
      toast.show({
        title: t('admin.role_updated'),
        tone: 'success',
        duration: isDestructive ? 8000 : undefined,
        action: isDestructive ? { label: t('admin.undo'), onClick: revert } : undefined,
      });
    },
  });

  const requestPromote = (target: User) => {
    const previousRole = target.role;
    setConfirm({
      kind: 'admin',
      target,
      revert: () => setRole.mutate({ id: target.id, nextRole: previousRole, previousRole: 'global_admin' }),
    });
  };
  const requestDemote = (target: User) => {
    const previousRole = target.role;
    setConfirm({
      kind: 'demote',
      target,
      revert: () => setRole.mutate({ id: target.id, nextRole: previousRole, previousRole: 'user' }),
    });
  };
  const requestBan = (target: User) => {
    setConfirm({
      kind: 'ban',
      target,
      revert: () => moderate.mutate({ id: target.id, payload: { is_banned: false, restrictions: {} } }),
    });
  };

  if (!user) return <div className="p-6"><EmptyState title={t('admin.login_required')} /></div>;
  if (!isAdmin) return <div className="p-6"><EmptyState title={t('admin.no_access')} /></div>;

  const users = usersQuery.data || [];

  useEffect(() => {
    if (!focusId) return;
    const target = users.find((u) => u.id === focusId);
    if (target) {
      setInspector(target);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [focusId, users, searchParams, setSearchParams]);

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
        ) : usersQuery.isError ? (
          <ErrorState
            description={usersQuery.error instanceof Error ? usersQuery.error.message : t('admin.error_load_users')}
            onRetry={() => usersQuery.refetch()}
          />
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
                        <button
                          aria-label={t('admin.users_title')}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        >
                          <MoreHorizontal size={18} aria-hidden="true" />
                        </button>
                      }
                    >
                      <DropdownItem onClick={() => setInspector(item)}>
                        <Eye size={15} className="text-blue-500" /> {t('admin.users_action_inspect')}
                      </DropdownItem>
                      {item.role !== 'global_admin' && (
                        <DropdownItem onClick={() => requestPromote(item)}>
                          <Crown size={15} className="text-purple-500" /> {t('admin.make_admin')}
                        </DropdownItem>
                      )}
                      {item.role !== 'user' && item.id !== user.id && (
                        <DropdownItem onClick={() => requestDemote(item)}>
                          <ShieldOff size={15} className="text-gray-400" /> {t('admin.remove_role')}
                        </DropdownItem>
                      )}
                      <DropdownItem onClick={() => setBanModal(item)}>
                        <Timer size={15} className="text-amber-500" /> {t('admin.ban_timed')}
                      </DropdownItem>
                      <DropdownItem danger onClick={() => requestBan(item)}>
                        <ShieldAlert size={15} /> {t('admin.ban_permanent')}
                      </DropdownItem>
                      {(item.is_banned || hasRestrictions) && (
                        <DropdownItem
                          onClick={() => moderate.mutate({ id: item.id, payload: { is_banned: false, restrictions: {} } })}
                          disabled={moderate.isPending && moderate.variables?.id === item.id}
                        >
                          <ShieldCheck size={15} className="text-emerald-500" /> {t('admin.unban')}
                        </DropdownItem>
                      )}
                      <DropdownItem
                        onClick={() => moderate.mutate({ id: item.id, payload: { restrictions: { ...restrictions, posts: !restrictions.posts } } })}
                        disabled={moderate.isPending && moderate.variables?.id === item.id}
                      >
                        <PenOff size={15} className={restrictions.posts ? 'text-emerald-500' : 'text-amber-500'} />
                        {restrictions.posts ? t('admin.allow_posts') : t('admin.block_posts')}
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => moderate.mutate({ id: item.id, payload: { restrictions: { ...restrictions, comments: !restrictions.comments } } })}
                        disabled={moderate.isPending && moderate.variables?.id === item.id}
                      >
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
                loading={moderate.isPending && moderate.variables?.id === banModal.id}
                onClick={() => moderate.mutate({ id: banModal.id, payload: { is_banned: true, duration_hours: Number(duration), reason } })}
              >
                <Ban size={16} />
                {t('admin.ban_confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Destructive action confirmations */}
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === 'ban' ? t('admin.confirm_ban_title') :
          confirm?.kind === 'admin' ? t('admin.confirm_admin_title') :
          t('admin.confirm_demote_title')
        }
        description={
          confirm?.kind === 'ban' ? t('admin.confirm_ban_desc') :
          confirm?.kind === 'admin' ? t('admin.confirm_admin_desc') :
          t('admin.confirm_demote_desc')
        }
        loading={moderate.isPending || setRole.isPending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === 'ban') moderate.mutate({ id: confirm.target.id, payload: { is_banned: true, reason: 'Нарушение правил сайта' } });
          if (confirm.kind === 'admin') setRole.mutate({ id: confirm.target.id, nextRole: 'global_admin', previousRole: confirm.target.role });
          if (confirm.kind === 'demote') setRole.mutate({ id: confirm.target.id, nextRole: 'user', previousRole: confirm.target.role });
          setConfirm(null);
        }}
      />

      <UserInspector user={inspector} onClose={() => setInspector(null)} />
    </div>
  );
}
