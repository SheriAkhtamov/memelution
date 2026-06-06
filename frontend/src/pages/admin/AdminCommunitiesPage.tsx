import { Ban, Eye, Hash, ShieldCheck, Users2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, SegmentedControl, Skeleton, Textarea, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

type StatusId = 'all' | 'active' | 'banned';
type SortId = 'new' | 'members' | 'posts';
const STATUS_OPTIONS: Array<{ id: StatusId; labelKey: string }> = [
  { id: 'all', labelKey: 'admin.communities_status_all' },
  { id: 'active', labelKey: 'admin.communities_status_active' },
  { id: 'banned', labelKey: 'admin.communities_status_banned' },
];
const SORT_OPTIONS: Array<{ id: SortId; labelKey: string }> = [
  { id: 'new', labelKey: 'admin.communities_sort_new' },
  { id: 'members', labelKey: 'admin.communities_sort_members' },
  { id: 'posts', labelKey: 'admin.communities_sort_posts' },
];

export function AdminCommunitiesPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [status, setStatus] = useState<StatusId>('all');
  const [sort, setSort] = useState<SortId>('new');
  const [banTarget, setBanTarget] = useState<{ id: string; name: string; banned: boolean } | null>(null);
  const [banReason, setBanReason] = useState('');

  const queryArgs = useMemo(() => {
    const args: Parameters<typeof api.adminCommunities>[0] = { sort, limit: 100 };
    if (debouncedQ) args.q = debouncedQ;
    if (status === 'active') args.is_banned = false;
    if (status === 'banned') args.is_banned = true;
    return args;
  }, [debouncedQ, status, sort]);

  const communitiesQuery = useQuery({
    queryKey: ['admin-communities', queryArgs],
    queryFn: () => api.adminCommunities(queryArgs),
    enabled: Boolean(isAdmin),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
    queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-top'] });
  };

  const ban = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.adminBanCommunity(id, reason),
    onSuccess: () => {
      invalidate();
      setBanTarget(null);
      setBanReason('');
      toast.show({ title: t('admin.communities_action_ban'), tone: 'success' });
    },
  });
  const unban = useMutation({
    mutationFn: (id: string) => api.adminUnbanCommunity(id),
    onSuccess: () => { invalidate(); toast.show({ title: t('admin.communities_action_unban'), tone: 'success' }); },
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const communities = communitiesQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader icon={Users2} title={t('admin.communities_title')} subtitle={t('admin.communities_subtitle')} tone="purple" />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Hash size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.communities_search_placeholder')} className="pl-10" />
          </div>
          <SegmentedControl<StatusId>
            value={status}
            options={STATUS_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setStatus}
            size="sm"
          />
          <SegmentedControl<SortId>
            value={sort}
            options={SORT_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setSort}
            size="sm"
          />
        </div>
      </div>

      {communitiesQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : communitiesQuery.isError ? (
        <ErrorState
          description={communitiesQuery.error instanceof Error ? communitiesQuery.error.message : t('admin.error_load_users')}
          onRetry={() => communitiesQuery.refetch()}
        />
      ) : communities.length === 0 ? (
        <EmptyState title={t('admin.communities_empty')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {communities.map((c) => (
            <article
              key={c.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                c.is_banned
                  ? 'border-red-200/60 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10'
                  : 'border-gray-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <Avatar src={c.avatar_url} name={c.name} className="h-12 w-12 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-black">{c.name}</p>
                    {c.is_banned ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <Ban size={10} /> {t('admin.communities_banned_label')}
                      </span>
                    ) : null}
                    {c.is_featured ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        ⭐ {t('admin.communities_featured_label')}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-gray-400">@{c.slug}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-zinc-400">
                    {c.description || t('admin.communities_no_description')}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-gray-500 dark:text-zinc-400">
                  {(c.members_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} {t('admin.communities_members')}
                  {' · '}
                  {(c.posts_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} {t('admin.communities_posts')}
                </span>
                {c.owner ? (
                  <Link
                    to={`/admin/users?focus=${c.owner.id}`}
                    className="font-black text-gray-700 hover:underline dark:text-zinc-200"
                  >
                    {c.owner.display_name}
                  </Link>
                ) : null}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Link
                  to={`/c/${c.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <Eye size={12} /> {t('admin.communities_action_view')}
                </Link>
                {c.is_banned ? (
                  <Button
                    variant="outline"
                    loading={unban.isPending && unban.variables === c.id}
                    onClick={() => unban.mutate(c.id)}
                  >
                    <ShieldCheck size={14} /> {t('admin.communities_action_unban')}
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    loading={ban.isPending && ban.variables?.id === c.id}
                    onClick={() => {
                      setBanReason('');
                      setBanTarget({ id: c.id, name: c.name, banned: false });
                    }}
                  >
                    <Ban size={14} /> {t('admin.communities_action_ban')}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(banTarget)}
        onClose={() => !ban.isPending && setBanTarget(null)}
        title={t('admin.communities_ban_modal_title')}
      >
        <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">
          {t('admin.communities_ban_modal_desc')} <strong>{banTarget?.name}</strong>
        </p>
        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-gray-500">
          {t('admin.communities_ban_modal_reason')}
        </label>
        <Textarea
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          rows={3}
          placeholder={t('admin.communities_ban_modal_reason_placeholder')}
          className="mt-1"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBanTarget(null)} disabled={ban.isPending}>
            {t('admin.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={ban.isPending}
            onClick={() => banTarget && ban.mutate({ id: banTarget.id, reason: banReason.trim() })}
          >
            {t('admin.communities_action_ban')}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={false}
        onClose={() => undefined}
        title=""
        description=""
        onConfirm={() => undefined}
      />
    </div>
  );
}
