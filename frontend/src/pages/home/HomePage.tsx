import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, ChevronDown, Flame, ListFilter, Plus, RefreshCw, Zap } from 'lucide-react';
import type { FeedTab } from '../../shared/types';
import { Button, EmptyState, ErrorState, Skeleton, Tabs } from '../../shared/ui';
import { SwipeContainer } from '../../shared/ui/SwipeContainer';
import { useInfiniteSentinel } from '../../shared/lib/useInfiniteSentinel';
import { PostCard } from '../../features/posts/components/PostCard';
import { PostComposer } from '../../features/posts/components/PostComposer';
import { useFeed } from '../../features/feed/useFeed';
import { useFeedUIStore } from '../../store/feedUIStore';
import { useTranslation } from '../../shared/i18n';
import { trackEvent } from '../../shared/lib/analytics';

const MAIN_FEED_IDS: FeedTab[] = ['for-you', 'following', 'popular', 'new'];
const EXTRA_FEED_IDS: FeedTab[] = ['memes', 'video', 'polls', 'communities', 'local'];
const FEED_IDS: FeedTab[] = [...MAIN_FEED_IDS, ...EXTRA_FEED_IDS];

function isFeedTab(value: string | null): value is FeedTab {
  return (FEED_IDS as readonly string[]).includes(value as FeedTab);
}

export function HomePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [feed, setFeed] = useState<FeedTab>(() => {
    const urlFeed = params.get('feed');
    if (isFeedTab(urlFeed)) return urlFeed;
    const savedFeed = localStorage.getItem('feed-tab');
    return isFeedTab(savedFeed) ? savedFeed : 'for-you';
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const pullStartRef = useRef(0);
  const query = useFeed(feed);
  const posts = query.posts;
  const shouldOpenComposer = params.get('compose') === '1' || params.get('onboarded') === '1';
  const isRefreshing = query.isFetching && !query.isLoading && !query.isFetchingNextPage;
  const fetchNextPage = useCallback(() => {
    query.fetchNextPage();
  }, [query.fetchNextPage]);

  const mainFeedTabs: Array<{ id: FeedTab; label: string }> = [
    { id: 'for-you', label: t('home.tab_for_you') },
    { id: 'following', label: t('home.tab_following') },
    { id: 'popular', label: t('home.tab_popular') },
    { id: 'new', label: t('home.tab_new') },
  ];
  const extraFeedTabs: Array<{ id: FeedTab; label: string }> = [
    { id: 'memes', label: t('home.tab_memes') },
    { id: 'video', label: t('home.tab_video') },
    { id: 'polls', label: t('home.tab_polls') },
    { id: 'communities', label: t('home.tab_communities') },
    { id: 'local', label: t('home.tab_local') },
  ];
  const isExtraFeed = EXTRA_FEED_IDS.includes(feed);

  useInfiniteSentinel(sentinelRef, fetchNextPage, Boolean(query.hasNextPage && !query.isFetchingNextPage));

  useEffect(() => {
    localStorage.setItem('feed-tab', feed);
    trackEvent('feed_viewed', { feed });
  }, [feed]);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  useEffect(() => {
    const urlFeed = params.get('feed');
    if (isFeedTab(urlFeed) && urlFeed !== feed) setFeed(urlFeed);
  }, [feed, params]);

  const changeFeed = (nextFeed: FeedTab) => {
    setFeed(nextFeed);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextFeed === 'for-you') next.delete('feed');
      else next.set('feed', nextFeed);
      return next;
    }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Persist scroll position in Zustand store (survives route changes).
  const getScrollPosition = useFeedUIStore((state) => state.getScrollPosition);
  const setScrollPosition = useFeedUIStore((state) => state.setScrollPosition);
  useEffect(() => {
    const saved = getScrollPosition(feed);
    if (saved) window.requestAnimationFrame(() => window.scrollTo({ top: saved }));
    return () => setScrollPosition(feed, window.scrollY);
  }, [feed, getScrollPosition, setScrollPosition]);

  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) pullStartRef.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || !pullStartRef.current) { setPullDistance(0); return; }
    const dist = Math.max(0, e.touches[0].clientY - pullStartRef.current);
    setPullDistance(Math.min(dist, 80));
  };
  const handleTouchEnd = () => {
    if (pullDistance > 60) query.refetch();
    setPullDistance(0);
    pullStartRef.current = 0;
  };

  const focusComposer = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('compose', '1');
      return next;
    }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 ? (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance }}>
          <RefreshCw size={20} className={`text-gray-400 ${isRefreshing || pullDistance > 60 ? 'animate-spin' : ''}`} />
        </div>
      ) : null}
      <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-slate-50/80 px-3 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">{t('home.title')}</h1>
          <div className="flex items-center gap-2">
            {isRefreshing ? <span className="text-xs font-black text-gray-400">{t('home.refreshing')}</span> : null}
            <Button variant="ghost" className="h-9 px-2" loading={isRefreshing} onClick={() => query.refetch()} aria-label={t('home.refresh_feed')}>
              {!isRefreshing ? <RefreshCw size={17} /> : null}
            </Button>
            <ListFilter className="text-gray-400" size={20} />
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {mainFeedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => changeFeed(tab.id)}
              className={`relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-black transition-colors ${
                feed === tab.id
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
              {feed === tab.id ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#FF6B00]" />
              ) : null}
            </button>
          ))}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-black transition-colors ${
                isExtraFeed
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {isExtraFeed ? extraFeedTabs.find((t) => t.id === feed)?.label : 'Ещё...'}
              <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                {extraFeedTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      changeFeed(tab.id);
                      setMoreOpen(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                      feed === tab.id
                        ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <SwipeContainer
        className="space-y-4 p-3 sm:space-y-5 sm:p-4"
        onSwipeLeft={() => {
          const idx = FEED_IDS.indexOf(feed);
          if (idx < FEED_IDS.length - 1) changeFeed(FEED_IDS[idx + 1]);
        }}
        onSwipeRight={() => {
          const idx = FEED_IDS.indexOf(feed);
          if (idx > 0) changeFeed(FEED_IDS[idx - 1]);
        }}
      >
        <FeedLoopPanel
          activeFeed={feedTabs.find((item) => item.id === feed)?.label || t('home.title')}
          postsCount={posts.length}
          isRefreshing={isRefreshing}
          hasNewPosts={query.hasNewPosts}
          newPostsCount={query.newPostsCount}
          onCreate={focusComposer}
          onRefresh={() => query.refetch()}
        />
        <PostComposer defaultExpanded={shouldOpenComposer} autoFocus={shouldOpenComposer} />
        {query.hasNewPosts ? (
          <div className="sticky top-24 z-10 flex justify-center animate-in slide-in-from-top-4 duration-300">
            <Button onClick={query.showNewPosts} className="rounded-full shadow-lg shadow-orange-500/20">
              <RefreshCw size={14} /> {query.newPostsCount > 1 ? t('home.load_new', { count: query.newPostsCount }) : t('home.show_new')}
            </Button>
          </div>
        ) : null}
        {query.isLoading ? (
          <FeedSkeleton />
        ) : query.isError ? (
          <ErrorState description={query.error instanceof Error ? query.error.message : t('home.feed_error')} onRetry={() => query.refetch()} />
        ) : posts.length ? (
          <>
            <div className="space-y-5">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <div ref={sentinelRef} className="py-4">
              {query.isFetchingNextPage ? (
                <div className="flex justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF6B00] border-t-transparent" />
                </div>
              ) : !query.hasNextPage && posts.length > 5 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-center text-sm font-bold text-gray-500 dark:text-zinc-400">
                    Вы всё посмотрели! 🎉 Время создать что-то своё?
                  </p>
                  <Button onClick={focusComposer}>
                    <Plus size={16} /> Создать пост
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            title={t('home.empty_title')}
            description={t('home.empty_desc')}
            icon={<Flame size={36} />}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button loading={isRefreshing} onClick={focusComposer}><Plus size={16} /> Опубликовать мем</Button>
                <Button variant="outline" loading={isRefreshing} onClick={() => query.refetch()}>{t('home.refresh_feed')}</Button>
              </div>
            }
          />
        )}
      </SwipeContainer>
      {showBackToTop ? (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-lg backdrop-blur transition-all hover:bg-white hover:text-gray-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:bottom-8"
          aria-label={t('home.scroll_to_top')}
        >
          <ArrowUp size={18} />
        </button>
      ) : null}
    </div>
  );
}

function FeedLoopPanel({
  activeFeed,
  postsCount,
  isRefreshing,
  hasNewPosts,
  newPostsCount,
  onCreate,
  onRefresh,
}: {
  activeFeed: string;
  postsCount: number;
  isRefreshing: boolean;
  hasNewPosts: boolean;
  newPostsCount: number;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm dark:border-orange-900/30 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-gray-400">
            <span className="inline-flex items-center gap-1 text-[#FF6B00]"><Zap size={14} /> {activeFeed}</span>
            <span>{postsCount} постов загружено</span>
            {hasNewPosts ? <span className="text-emerald-600">+{newPostsCount} новых</span> : null}
          </div>
          <p className="mt-1 text-lg font-black text-gray-950 dark:text-zinc-100">Реакция, комментарий, сохранение — и следующий мем уже рядом</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button onClick={onCreate}><Plus size={16} /> Опубликовать</Button>
          <Button variant="outline" loading={isRefreshing} onClick={onRefresh}><RefreshCw size={16} /> Обновить</Button>
        </div>
      </div>
    </section>
  );
}

function FeedSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5" aria-label={t('home.loading_feed')}>
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg border border-gray-200/80 bg-white/95 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
