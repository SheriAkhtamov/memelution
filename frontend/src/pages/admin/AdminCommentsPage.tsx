import { Eye, EyeOff, MessageSquare, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Skeleton, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

export function AdminCommentsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isGlobalAdmin = user?.role === 'global_admin';

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [status, setStatus] = useState<'all' | 'published' | 'deleted'>('all');
  const [confirm, setConfirm] = useState<{ id: string; author: string } | null>(null);

  const queryArgs = useMemo(() => {
    const args: Parameters<typeof api.adminComments>[0] = { limit: 100 };
    if (debouncedQ) args.q = debouncedQ;
    if (status === 'deleted') args.is_deleted = true;
    if (status === 'published') args.is_deleted = false;
    return args;
  }, [debouncedQ, status]);

  const commentsQuery = useQuery({
    queryKey: ['admin-comments', queryArgs],
    queryFn: () => api.adminComments(queryArgs),
    enabled: Boolean(isAdmin),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
    queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-timeseries'] });
  };

  const hide = useMutation({
    mutationFn: (id: string) => api.adminHideComment(id),
    onSuccess: () => { invalidate(); toast.show({ title: t('admin.comments_action_hide'), tone: 'success' }); },
  });
  const restore = useMutation({
    mutationFn: (id: string) => api.adminRestoreComment(id),
    onSuccess: () => { invalidate(); toast.show({ title: t('admin.comments_action_restore'), tone: 'success' }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteComment(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast.show({ title: t('admin.comments_action_delete'), tone: 'success' });
    },
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const comments = commentsQuery.data || [];

  const statusChips: Array<{ id: typeof status; label: string }> = [
    { id: 'all', label: t('admin.comments_filter_all') },
    { id: 'published', label: t('admin.comments_status_published') },
    { id: 'deleted', label: t('admin.comments_status_deleted') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={MessageSquare} title={t('admin.comments_title')} subtitle={t('admin.comments_subtitle')} tone="blue" />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.comments_search_placeholder')} className="pl-10" />
          </div>
          <div className="flex items-center gap-2">
            {statusChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setStatus(chip.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  status === chip.id
                    ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {commentsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : commentsQuery.isError ? (
        <ErrorState
          description={commentsQuery.error instanceof Error ? commentsQuery.error.message : t('admin.error_load_users')}
          onRetry={() => commentsQuery.refetch()}
        />
      ) : comments.length === 0 ? (
        <EmptyState title={t('admin.comments_empty')} />
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => {
            const author = c.author;
            return (
              <li
                key={c.id}
                className={`rounded-2xl border p-4 ${
                  c.is_deleted
                    ? 'border-red-200/60 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10'
                    : 'border-gray-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/50'
                } shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <Avatar src={author?.avatar_url} name={author?.display_name} className="h-9 w-9 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{author?.display_name || '—'}</p>
                      <span className="text-xs text-gray-400">@{author?.username || ''}</span>
                      <span className="text-xs text-gray-400">
                        · {new Date(c.created_at).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
                      </span>
                      {c.is_deleted ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <EyeOff size={10} /> {t('admin.comments_hidden_label')}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-3 max-w-2xl text-sm text-gray-700 dark:text-zinc-200">{c.text}</p>
                    {c.post_id ? (
                      <Link
                        to={`/post/${c.post_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[10px] font-black uppercase tracking-wider text-[#FF6B00] hover:underline"
                      >
                        {t('admin.comments_to_post')}
                      </Link>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.is_deleted ? (
                      <Button variant="outline" loading={restore.isPending && restore.variables === c.id} onClick={() => restore.mutate(c.id)}>
                        <Eye size={14} /> {t('admin.comments_action_restore')}
                      </Button>
                    ) : (
                      <Button variant="outline" loading={hide.isPending && hide.variables === c.id} onClick={() => hide.mutate(c.id)}>
                        <EyeOff size={14} /> {t('admin.comments_action_hide')}
                      </Button>
                    )}
                    {isGlobalAdmin ? (
                      <Button variant="danger" loading={remove.isPending && remove.variables === c.id} onClick={() => setConfirm({ id: c.id, author: author?.display_name || '' })}>
                        <Trash2 size={14} /> {t('admin.comments_action_delete')}
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
        title={t('admin.comments_confirm_delete_title')}
        description={t('admin.comments_confirm_delete_desc')}
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
