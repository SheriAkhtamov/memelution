import { Hash, Search, Trash2, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useTranslation } from '../../shared/i18n';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, SegmentedControl, Skeleton, useToast } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAuthStore } from '../../store/authStore';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

type SortId = 'popular' | 'new' | 'alpha';
const SORT_OPTIONS: Array<{ id: SortId; labelKey: string }> = [
  { id: 'popular', labelKey: 'admin.hashtags_sort_posts' },
  { id: 'new', labelKey: 'admin.hashtags_sort_new' },
  { id: 'alpha', labelKey: 'admin.hashtags_sort_name' },
];

export function AdminHashtagsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'global_admin' || user?.role === 'admin';

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [sort, setSort] = useState<SortId>('popular');
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);

  const queryArgs = useMemo(() => {
    const args: Parameters<typeof api.adminHashtags>[0] = { sort, limit: 200 };
    if (debouncedQ) args.q = debouncedQ;
    return args;
  }, [debouncedQ, sort]);

  const hashtagsQuery = useQuery({
    queryKey: ['admin-hashtags', queryArgs],
    queryFn: () => api.adminHashtags(queryArgs),
    enabled: Boolean(isAdmin),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-hashtags'] });
    queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteHashtag(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast.show({ title: t('admin.hashtags_action_delete'), tone: 'success' });
    },
  });

  if (!user) return <EmptyState title={t('admin.login_required')} />;
  if (!isAdmin) return <EmptyState title={t('admin.no_access')} />;

  const hashtags = hashtagsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader icon={Hash} title={t('admin.hashtags_title')} subtitle={t('admin.hashtags_subtitle')} tone="emerald" />

      <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.hashtags_search_placeholder')} className="pl-10" />
          </div>
          <SegmentedControl<SortId>
            value={sort}
            options={SORT_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
            onChange={setSort}
            size="sm"
          />
        </div>
      </div>

      {hashtagsQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : hashtagsQuery.isError ? (
        <ErrorState
          description={hashtagsQuery.error instanceof Error ? hashtagsQuery.error.message : t('admin.error_load_users')}
          onRetry={() => hashtagsQuery.refetch()}
        />
      ) : hashtags.length === 0 ? (
        <EmptyState title={t('admin.hashtags_empty')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {hashtags.map((h) => (
            <article
              key={h.id}
              className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Hash size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black">{h.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      {new Date(h.created_at).toLocaleDateString(LOCALE_MAP[lang] || 'ru-RU')}
                    </p>
                  </div>
                </div>
                <Button variant="danger" onClick={() => setConfirm({ id: h.id, name: h.name })}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50/60 px-3 py-2 dark:bg-emerald-900/10">
                <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                  {(h.posts_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
                </span>
                <span className="text-xs font-bold text-emerald-600/80 dark:text-emerald-300/80">
                  {t('admin.hashtags_posts')}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={t('admin.hashtags_confirm_delete_title')}
        description={t('admin.hashtags_confirm_delete_desc', { name: confirm?.name || '' })}
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
