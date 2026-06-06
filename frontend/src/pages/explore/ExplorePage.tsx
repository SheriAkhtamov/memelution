import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Compass, Hash, MessageCircle, Rocket, Sun, Trophy, Users, Zap } from 'lucide-react';
import { api } from '../../shared/api/client';
import { Avatar, Badge, Button, ErrorState, Skeleton, PageLayout, PageHeader, Card, buttonVariants } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { useTranslation } from '../../shared/i18n';
import { ProductEmptyState } from '../../shared/ui/ProductEmptyState';

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
    <PageLayout variant="feed">
      <header className="page-header sticky top-16 z-20 px-4 py-5 sm:top-0 sm:px-6 sm:py-7">
        <PageHeader
          icon={Zap}
          title={t('explore.title')}
          subtitle={t('explore.subtitle')}
          tone="orange"
          actions={
            <div className="flex gap-2" role="tablist" aria-label={t('explore.title')}>
              <Button
                type="button"
                role="tab"
                size="lg"
                aria-selected={period === 'day'}
                onClick={() => setPeriod('day')}
                variant={period === 'day' ? 'primary' : 'outline'}
              >
                <Sun size={17} /> {t('explore.filter_day')}
              </Button>
              <Button
                type="button"
                role="tab"
                size="lg"
                aria-selected={period === 'week'}
                onClick={() => setPeriod('week')}
                variant={period === 'week' ? 'primary' : 'outline'}
              >
                <CalendarDays size={17} /> {t('explore.filter_week')}
              </Button>
            </div>
          }
        />
      </header>
      <div className="space-y-5 p-3 sm:p-5 lg:p-6">
        {query.isLoading ? (
          <Skeleton className="h-[32rem] rounded-3xl" />
        ) : query.isError ? (
          <ErrorState description={t('explore.error')} onRetry={() => query.refetch()} />
        ) : !hasAnyTrends ? (
          <ProductEmptyState
            className="sm:min-h-[38rem]"
            title={t('explore.empty')}
            description={t('explore.empty_desc')}
            tone="rocket"
            icon={<Rocket size={38} />}
            action={
              <Link
                to="/search"
                className={buttonVariants({ variant: 'primary', size: 'lg' })}
              >
                <Compass size={17} /> {t('explore.action_discover')}
              </Link>
            }
          />
        ) : (
          <>
            {query.data?.hashtags.length ? (
              <TrendSection title={t('explore.section_tags')} icon={<Hash size={18} className="text-primary" />}>
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
              <TrendSection title={t('explore.section_communities')} icon={<Users size={18} className="text-secondary" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {query.data.active_communities.slice(0, 6).map((community) => (
                    <Link key={community.id} to={`/communities/${community.slug}`} className="block min-w-0">
                      <Card variant="hoverable" padding="sm" className="flex items-center gap-3">
                        <Avatar src={community.avatar_url} name={community.name} className="h-11 w-11 rounded-xl" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-foreground">{community.name}</span>
                          <span className="block text-xs font-bold text-muted-foreground">{community.posts_count} {t('explore.posts')} · {community.members_count} {t('explore.members')}</span>
                        </span>
                      </Card>
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
              <TrendSection title={t('explore.section_discussed')} icon={<MessageCircle size={18} className="text-primary" />}>
                <div className="space-y-3">
                  {query.data.discussed_posts.map((post) => (
                    <Link key={post.id} to={`/post/${post.id}`} className="block">
                      <Card variant="hoverable" padding="sm">
                        <p className="line-clamp-2 text-sm font-bold text-foreground">{post.text || t('post.type_media')}</p>
                        <p className="mt-1 text-xs font-bold text-muted-foreground">{post.comments_count} {t('layout.comments')} · {post.likes_count} {t('layout.likes')}</p>
                      </Card>
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
    </PageLayout>
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
      className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border transition-all ${
        winner === post.id
          ? 'border-amber-500/35 bg-amber-500/10 ring-2 ring-amber-500/20 text-foreground'
          : 'border-border bg-muted/30 hover:bg-card hover:border-border text-foreground'
      }`}
    >
      {post.media_url ? <img src={post.media_url} alt="" className="h-40 w-full object-cover" /> : null}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-black text-foreground">{post.text || 'Медиа-пост'}</p>
        <p className="mt-2 text-xs font-bold text-muted-foreground">{post.likes_count} лайков · {post.comments_count} комментариев</p>
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
    <div className="rounded-xl border border-amber-500/30 bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        {renderPost(posts[0], 0)}
        <div className="hidden items-center justify-center text-xs font-black uppercase text-muted-foreground sm:flex">VS</div>
        {renderPost(posts[1], 1)}
      </div>
    </div>
  );
}

function TrendSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card variant="surface" padding="lg" className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  );
}
