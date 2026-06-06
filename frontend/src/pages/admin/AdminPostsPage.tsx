import { ExternalLink, Eye, EyeOff, MessageSquare, Pin, PinOff, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, SegmentedControl, Select, Skeleton, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

type SortId = 'new' | 'popular' | 'comments';
const SORT_OPTIONS: Array<{ id: SortId; labelKey: string }> = [
  { id: 'new', labelKey: 'admin.posts_sort_new' },
  { id: 'popular', labelKey: 'admin.posts_sort_popular' },
  { id: 'comments', labelKey: 'admin.posts_sort_comments' },
];

const TYPE_LABELS: Record<string, string> = {
  text: 'admin.posts_type_post',
  meme: 'admin.posts_type_meme',
  video: 'admin.posts_type_video',
  poll: 'admin.posts_type_poll',
  quote: 'admin.posts_type_quote',
};

export function AdminPostsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [type, setType] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'deleted' | 'pinned'>('all');
  const [sort, setSort] = useState<SortId>('new');
  const [confirm, setConfirm] = useState<{ id: string; author: string } | null>(null);

  const queryArgs = useMemo(() => {
    const args: Parameters<typeof api.adminPosts>[0] = { sort, limit: 80 };
    if (debouncedQ) args.q = debouncedQ;
    if (type) args.type = type;
    if (status === 'deleted') args.is_deleted = true;
    if (status === 'published') args.is_deleted = false;
    if (status === 'pinned') args.is_pinned = true;
    return args;
  }, [debouncedQ, type, status, sort]);

  const postsQuery = useQuery({
    queryKey: ['admin-posts', queryArgs],
    queryFn: () => api.adminPosts(queryArgs),
    enabled: Boolean(isAdmin),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-timeseries'] });
    queryClient.invalidateQueries({ queryKey: ['admin-top'] });
  };

  const hide = useMutation({
    mutationFn: (id: string) => api.adminHidePost(id),
    onSuccess: () => { invalidate(); toast.show({ title: t('admin.posts_action_hide'), tone: 'success' }); },
    onError: () => toast.show({ title: t('admin.error_load_users'), tone: 'error' }),
  });
  const restore = useMutation({
    mutationFn: (id: string) => api.adminRestorePost(id),
    onSuccess: () => { invalidate(); toast.show({ title: t('admin.posts_action_restore'), tone: 'success' }); },
  });
  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => api.adminPinPost(id, pinned),
    onSuccess: (_d, v) => { invalidate(); toast.show({ title: v.pinned ? t('admin.posts_action_pin') : t('admin.posts_action_unpin'), tone: 'success' }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeletePost(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast.show({ title: t('admin.posts_action_delete'), tone: 'success' });
    },
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const posts = postsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader icon={MessageSquare} title={t('admin.posts_title')} subtitle={t('admin.posts_subtitle')} tone="cyan" />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_220px]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.posts_search_placeholder')} className="pl-10" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('admin.posts_filter_all_types')}</option>
            {Object.entries(TYPE_LABELS).map(([value, key]) => (
              <option key={value} value={value}>{t(key)}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">{t('admin.posts_filter_all_status')}</option>
            <option value="published">{t('admin.posts_status_published')}</option>
            <option value="deleted">{t('admin.posts_status_deleted')}</option>
            <option value="pinned">{t('admin.posts_status_pinned')}</option>
          </Select>
          <SegmentedControl<SortId>
            value={sort}
            options={SORT_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setSort}
          />
        </div>
      </div>

      {postsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : postsQuery.isError ? (
        <ErrorState
          description={postsQuery.error instanceof Error ? postsQuery.error.message : t('admin.error_load_users')}
          onRetry={() => postsQuery.refetch()}
        />
      ) : posts.length === 0 ? (
        <EmptyState title={t('admin.posts_empty')} description={t('admin.posts_empty_desc')} />
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const author = post.author;
            const community = post.community;
            return (
              <li
                key={post.id}
                className={`rounded-2xl border p-5 transition-all ${
                  post.is_deleted
                    ? 'border-red-200/60 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10'
                    : 'border-gray-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/50'
                } shadow-sm`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Avatar src={author?.avatar_url} name={author?.display_name} className="h-10 w-10 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{author?.display_name || '—'}</p>
                        <span className="text-xs text-gray-400">@{author?.username || ''}</span>
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {t(TYPE_LABELS[post.type] || 'admin.posts_type_post')}
                        </span>
                        {post.is_pinned ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Pin size={10} /> {t('admin.posts_pinned_label')}
                          </span>
                        ) : null}
                        {post.is_deleted ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <EyeOff size={10} /> {t('admin.posts_hidden_label')}
                          </span>
                        ) : null}
                      </div>
                      {community ? (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                          {community.name}
                        </p>
                      ) : null}
                      <p className="mt-2 line-clamp-3 max-w-xl text-sm text-gray-700 dark:text-zinc-200">
                        {post.text || (post.media_url ? '🖼' : '—')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>♥ {(post.likes_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                        <span>💬 {(post.comments_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                        <span>↻ {(post.reposts_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                        <span>· {new Date(post.created_at).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/post/${post.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      <ExternalLink size={12} /> {t('admin.posts_action_view')}
                    </Link>
                    <Button
                      variant="outline"
                      loading={pin.isPending && pin.variables?.id === post.id}
                      onClick={() => pin.mutate({ id: post.id, pinned: !post.is_pinned })}
                    >
                      {post.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      {post.is_pinned ? t('admin.posts_action_unpin') : t('admin.posts_action_pin')}
                    </Button>
                    {post.is_deleted ? (
                      <Button
                        variant="outline"
                        loading={restore.isPending && restore.variables === post.id}
                        onClick={() => restore.mutate(post.id)}
                      >
                        <Eye size={14} /> {t('admin.posts_action_restore')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        loading={hide.isPending && hide.variables === post.id}
                        onClick={() => hide.mutate(post.id)}
                      >
                        <EyeOff size={14} /> {t('admin.posts_action_hide')}
                      </Button>
                    )}
                    {isGlobalAdmin ? (
                      <Button
                        variant="danger"
                        loading={remove.isPending && remove.variables === post.id}
                        onClick={() => setConfirm({ id: post.id, author: author?.display_name || '' })}
                      >
                        <Trash2 size={14} /> {t('admin.posts_action_delete')}
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
        title={t('admin.posts_confirm_delete_title')}
        description={t('admin.posts_confirm_delete_desc')}
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
