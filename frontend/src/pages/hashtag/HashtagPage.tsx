import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Hash } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { Button, EmptyState, ErrorState, PageLayout, Skeleton, Tabs } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { useAuthStore } from '../../store/authStore';
import { redirectToLogin } from '../../utils/authRedirect';
import { useTranslation } from '../../shared/i18n';

type Tab = 'popular' | 'new' | 'media' | 'video';

export function HashtagPage() {
  const { name = '' } = useParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('popular');
  const query = useQuery({ queryKey: ['hashtag', name, tab], queryFn: () => api.hashtag(name, tab), enabled: Boolean(name) });
  const follow = useMutation({
    mutationFn: () => {
      if (!user) {
        redirectToLogin();
        return Promise.resolve({ is_following: false });
      }
      return api.followHashtag(name, query.data?.hashtag.is_following);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hashtag', name] }),
  });
  if (query.isLoading) return <div className="p-3 sm:p-4"><Skeleton className="h-72" /></div>;
  if (query.isError || !query.data) return <div className="p-3 sm:p-4"><ErrorState description={t('hashtag.not_found')} onRetry={() => query.refetch()} /></div>;
  return (
    <PageLayout variant="default">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#F3F4F6]/90 px-3 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><Hash className="text-[#FF6B00]" /> {query.data.hashtag.name}</h1>
            <p className="text-sm font-bold text-gray-400">{query.data.hashtag.posts_count} {t('hashtag.posts')}</p>
          </div>
          <Button onClick={() => follow.mutate()} loading={follow.isPending}>{query.data.hashtag.is_following ? t('hashtag.unfollow') : t('hashtag.follow')}</Button>
        </div>
        <Tabs
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          items={[
            { id: 'popular', label: t('hashtag.filter_popular') },
            { id: 'new', label: t('hashtag.filter_new') },
            { id: 'media', label: t('hashtag.filter_media') },
            { id: 'video', label: t('hashtag.filter_video') },
          ]}
        />
      </header>
      <div className="space-y-5">
        {query.data.related.length ? (
          <div className="flex flex-wrap gap-2">
            {query.data.related.map((tag) => <Link key={tag.id} to={`/hashtag/${tag.name}`} className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#FF6B00] dark:bg-zinc-950">#{tag.name}</Link>)}
          </div>
        ) : null}
        {query.data.posts.length ? query.data.posts.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState title={t('hashtag.empty')} />}
      </div>
  </PageLayout>
  );
}
