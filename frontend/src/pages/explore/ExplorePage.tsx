import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Compass, Hash, MessageCircle, Trophy, Users } from 'lucide-react';
import { api } from '../../shared/api/client';
import { Avatar, Badge, Button, EmptyState, ErrorState, Skeleton, Tabs } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { useTranslation } from '../../shared/i18n';

type Period = 'day' | 'week';

export function ExplorePage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('day');
  const [battleWinner, setBattleWinner] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['trends', period], queryFn: () => api.trends(period), staleTime: 60_000 });
  const memePosts = query.data?.rising_posts.filter((post) => post.type === 'meme') || [];
  const battlePosts = query.data?.rising_posts.slice(0, 2) || [];
  const hasAnyTrends = Boolean(
    query.data && (
      query.data.rising_posts.length ||
      query.data.hashtags.length ||
      query.data.active_communities.length ||
      query.data.discussed_posts.length ||
      memePosts.length
    ),
  );

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#F3F4F6]/90 px-3 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><Compass className="text-[#FF6B00]" /> {t('explore.title')}</h1>
            <p className="text-sm font-bold text-gray-400">{t('explore.subtitle')}</p>
          </div>
        </div>
        <Tabs
          value={period}
          onChange={(value) => setPeriod(value)}
          items={[
            { id: 'day', label: t('explore.filter_day') },
            { id: 'week', label: t('explore.filter_week') },
          ]}
        />
      </header>
      <div className="space-y-5 p-3 sm:p-4">
        {query.isLoading ? (
          <Skeleton className="h-72" />
        ) : query.isError ? (
          <ErrorState description={t('explore.error')} onRetry={() => query.refetch()} />
        ) : !hasAnyTrends ? (
          <EmptyState title={t('explore.empty')} />
        ) : (
          <>
            {query.data?.hashtags.length ? (
              <TrendSection title={t('explore.section_tags')} icon={<Hash size={18} className="text-[#FF6B00]" />}>
                <div className="flex flex-wrap gap-2">
                  {query.data.hashtags.map((tag) => (
                    <Link key={tag.id} to={`/hashtag/${tag.name}`}>
                      <Badge>#{tag.name} · {tag.posts_count}</Badge>
                    </Link>
                  ))}
                </div>
              </TrendSection>
            ) : null}

            {battlePosts.length === 2 ? (
              <TrendSection title="Мем-баттл дня" icon={<Trophy size={18} className="text-amber-500" />}>
                <MemeBattle posts={battlePosts} winner={battleWinner} onVote={setBattleWinner} />
              </TrendSection>
            ) : null}

            {query.data?.active_communities.length ? (
              <TrendSection title={t('explore.section_communities')} icon={<Users size={18} className="text-[#7C3AED]" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {query.data.active_communities.slice(0, 6).map((community) => (
                    <Link key={community.id} to={`/communities/${community.slug}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                      <Avatar src={community.avatar_url} name={community.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{community.name}</span>
                        <span className="block text-xs font-bold text-gray-400">{community.posts_count} {t('explore.posts')} · {community.members_count} {t('explore.members')}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </TrendSection>
            ) : null}

            {memePosts.length ? (
              <TrendSection title={t('explore.section_rising')}>
                <div className="space-y-5">
                  {memePosts.map((post) => <PostCard key={post.id} post={post} />)}
                </div>
              </TrendSection>
            ) : null}

            {query.data?.discussed_posts.length ? (
              <TrendSection title={t('explore.section_discussed')} icon={<MessageCircle size={18} className="text-[#FF6B00]" />}>
                <div className="space-y-3">
                  {query.data.discussed_posts.map((post) => (
                    <Link key={post.id} to={`/post/${post.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                      <p className="line-clamp-2 text-sm font-bold">{post.text || t('post.type_media')}</p>
                      <p className="mt-1 text-xs font-bold text-gray-400">{post.comments_count} {t('layout.comments')} · {post.likes_count} {t('layout.likes')}</p>
                    </Link>
                  ))}
                </div>
              </TrendSection>
            ) : null}

            {query.data?.rising_posts.length ? (
              <TrendSection title={t('explore.section_popular')}>
                <div className="space-y-5">
                  {query.data.rising_posts.map((post) => <PostCard key={post.id} post={post} />)}
                </div>
              </TrendSection>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MemeBattle({
  posts,
  winner,
  onVote,
}: {
  posts: Array<{ id: string; text: string; media_url?: string; likes_count: number; comments_count: number }>;
  winner: string | null;
  onVote: (id: string) => void;
}) {
  const renderPost = (post: typeof posts[number], index: number) => (
    <Link
      key={post.id}
      to={`/post/${post.id}`}
      className={`group flex min-w-0 flex-col overflow-hidden rounded-lg border transition-all ${
        winner === post.id
          ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:ring-amber-950'
          : 'border-gray-200 bg-gray-50 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-950'
      }`}
    >
      {post.media_url ? <img src={post.media_url} alt="" className="h-40 w-full object-cover" /> : null}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-black text-gray-900 dark:text-zinc-100">{post.text || 'Медиа-пост'}</p>
        <p className="mt-2 text-xs font-bold text-gray-400">{post.likes_count} лайков · {post.comments_count} комментариев</p>
        <Button
          className="mt-3"
          variant={winner === post.id ? 'secondary' : 'outline'}
          onClick={(event) => {
            event.preventDefault();
            onVote(post.id);
          }}
        >
          {winner === post.id ? 'Ваш выбор' : `Выбрать ${index === 0 ? 'левый' : 'правый'}`}
        </Button>
      </div>
    </Link>
  );

  return (
    <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm dark:border-amber-900/40 dark:bg-zinc-950">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        {renderPost(posts[0], 0)}
        <div className="hidden items-center justify-center text-xs font-black uppercase text-gray-300 sm:flex">VS</div>
        {renderPost(posts[1], 1)}
      </div>
    </div>
  );
}

function TrendSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase text-gray-500 dark:text-zinc-400">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
