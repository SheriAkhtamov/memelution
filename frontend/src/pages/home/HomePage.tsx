import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, ChevronDown, Flame, ListFilter, Plus, RefreshCw } from 'lucide-react';
import type { FeedTab } from '../../shared/types';
import { Button, EmptyState, ErrorState, Skeleton } from '../../shared/ui';
import { SwipeContainer } from '../../shared/ui/SwipeContainer';
import { useInfiniteSentinel } from '../../shared/lib/useInfiniteSentinel';
import { useImagePreload } from '../../shared/lib/useImagePreload';
import { PostCard } from '../../features/posts/components/PostCard';
import { PostComposer } from '../../features/posts/components/PostComposer';
import { useFeed } from '../../features/feed/useFeed';
import { useFeedUIStore } from '../../store/feedUIStore';
import { useTranslation } from '../../shared/i18n';
import { trackEvent } from '../../shared/lib/analytics';

const MAIN_FEED_IDS: FeedTab[] = ['for-you', 'following', 'popular', 'new'];
const EXTRA_FEED_IDS: FeedTab[] = ['memes', 'video', 'polls', 'communities', 'local'];
const FEED_IDS: FeedTab[] = [...MAIN_FEED_IDS, ...EXTRA_FEED_IDS];
const TAB_QUERY_BY_FEED: Record<FeedTab, string> = {
  'for-you': 'for-you',
  following: 'subscriptions',
  popular: 'trends',
  new: 'fresh',
  memes: 'memes',
  video: 'video',
  polls: 'polls',
  communities: 'communities',
  local: 'local',
};
const FEED_BY_TAB_QUERY: Record<string, FeedTab> = {
  'for-you': 'for-you',
  following: 'following',
  subscriptions: 'following',
  popular: 'popular',
  trends: 'popular',
  new: 'new',
  fresh: 'new',
  memes: 'memes',
  video: 'video',
  polls: 'polls',
  communities: 'communities',
  local: 'local',
};
const PULL_REFRESH_THRESHOLD = 64;
const PULL_REFRESH_MAX = 96;

function isFeedTab(value: string | null): value is FeedTab {
  return (FEED_IDS as readonly string[]).includes(value as FeedTab);
}

function feedFromQueryParam(value: string | null): FeedTab | null {
  return value ? FEED_BY_TAB_QUERY[value] || null : null;
}

function feedFromSearchParams(params: URLSearchParams): FeedTab | null {
  return feedFromQueryParam(params.get('tab')) || feedFromQueryParam(params.get('feed'));
}

function isMobilePullGesture() {
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 767px)').matches;
}

export function HomePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [feed, setFeed] = useState<FeedTab>(() => {
    const urlFeed = feedFromSearchParams(params);
    if (urlFeed) return urlFeed;
    const savedFeed = localStorage.getItem('feed-tab');
    return isFeedTab(savedFeed) ? savedFeed : 'for-you';
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef(new Map<FeedTab | 'more', HTMLButtonElement>());
  const pullStartRef = useRef(0);
  const pullResetTimeoutRef = useRef<number | null>(null);
  const query = useFeed(feed);
  const posts = query.posts;
  const shouldOpenComposer = params.get('compose') === '1' || params.get('onboarded') === '1';
  const isRefreshing = query.isFetching && !query.isLoading && !query.isFetchingNextPage;
  const showPullIndicator = pullDistance > 0 || isPullRefreshing;
  const pullProgress = Math.min(pullDistance / PULL_REFRESH_THRESHOLD, 1);
  const pullIndicatorY = isPullRefreshing ? 12 : Math.min(pullDistance, PULL_REFRESH_MAX) - 52;
  const fetchNextPage = useCallback(() => {
    query.fetchNextPage();
  }, [query.fetchNextPage]);

  const mainFeedTabs: Array<{ id: FeedTab; label: string }> = [
    { id: 'for-you', label: 'Для вас' },
    { id: 'following', label: 'Подписки' },
    { id: 'popular', label: 'Тренды' },
    { id: 'new', label: 'Свежее' },
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

  // Preload images for the next 12 posts after the currently visible window so
  // scrolling never reveals an empty <img>. The hook cancels in-flight loads on
  // unmount and respects a low concurrent-load cap.
  const upcomingImageUrls = posts.slice(0, 12).map((p) => p.media_url || p.media_items?.[0]?.url);
  useImagePreload(upcomingImageUrls, posts.length > 0);

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
    const urlFeed = feedFromSearchParams(params);
    if (urlFeed && urlFeed !== feed) {
      setFeed(urlFeed);
      return;
    }

    const tabParam = params.get('tab');
    const legacyFeedParam = params.get('feed');
    const canonicalTab = TAB_QUERY_BY_FEED[urlFeed || feed];
    const hasUnresolvedTab = Boolean(tabParam && !feedFromQueryParam(tabParam));
    const hasUnresolvedFeed = Boolean(legacyFeedParam && !feedFromQueryParam(legacyFeedParam));
    const shouldCanonicalize = Boolean(
      (urlFeed && (legacyFeedParam || tabParam !== canonicalTab))
      || (!urlFeed && (feed !== 'for-you' || hasUnresolvedTab || hasUnresolvedFeed)),
    );

    if (!shouldCanonicalize) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', canonicalTab);
      next.delete('feed');
      return next;
    }, { replace: true });
  }, [feed, params, setParams]);

  useEffect(() => {
    const activeKey = isExtraFeed ? 'more' : feed;
    tabButtonRefs.current.get(activeKey)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [feed, isExtraFeed]);

  const changeFeed = (nextFeed: FeedTab) => {
    setFeed(nextFeed);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', TAB_QUERY_BY_FEED[nextFeed]);
      next.delete('feed');
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

  useEffect(() => () => {
    if (pullResetTimeoutRef.current) window.clearTimeout(pullResetTimeoutRef.current);
  }, []);

  const resetPullGesture = useCallback(() => {
    setPullDistance(0);
    pullStartRef.current = 0;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobilePullGesture() || isPullRefreshing || e.touches.length !== 1 || window.scrollY > 0) return;
    pullStartRef.current = e.touches[0].clientY;
  }, [isPullRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!pullStartRef.current || isPullRefreshing) return;
    if (window.scrollY > 0) {
      resetPullGesture();
      return;
    }

    const distance = e.touches[0].clientY - pullStartRef.current;
    if (distance <= 0) {
      setPullDistance(0);
      return;
    }

    if (distance > 8 && e.cancelable) e.preventDefault();
    setPullDistance(Math.min(distance * 0.55, PULL_REFRESH_MAX));
  }, [isPullRefreshing, resetPullGesture]);

  const handleTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistance >= PULL_REFRESH_THRESHOLD;
    pullStartRef.current = 0;

    if (!shouldRefresh || isPullRefreshing) {
      setPullDistance(0);
      return;
    }

    setIsPullRefreshing(true);
    setPullDistance(PULL_REFRESH_THRESHOLD);
    void queryClient.invalidateQueries({ queryKey: ['feed'] }).finally(() => {
      pullResetTimeoutRef.current = window.setTimeout(() => {
        setIsPullRefreshing(false);
        setPullDistance(0);
      }, 220);
    });
  }, [isPullRefreshing, pullDistance, queryClient]);

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
      onTouchCancel={resetPullGesture}
    >
      {showPullIndicator ? (
        <div
          className="pointer-events-none sticky top-0 z-30 flex h-0 justify-center overflow-visible sm:hidden"
          aria-hidden={!isPullRefreshing}
          role={isPullRefreshing ? 'status' : undefined}
        >
          <div
            className="mt-2 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-[#FF6B00] shadow-lg backdrop-blur transition-[opacity,transform] duration-150 dark:border-zinc-800 dark:bg-zinc-950/95"
            style={{ opacity: isPullRefreshing ? 1 : Math.max(0.35, pullProgress), transform: `translateY(${pullIndicatorY}px)` }}
          >
            <RefreshCw size={20} className={isPullRefreshing || pullProgress >= 1 ? 'animate-spin' : ''} />
            {isPullRefreshing ? <span className="sr-only">{t('home.refreshing')}</span> : null}
          </div>
        </div>
      ) : null}
      <header className="border-b border-gray-200/70 bg-slate-50/80 px-3 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">{t('home.title')}</h1>
          <div className="flex items-center gap-2">
            {isRefreshing ? <span className="t-shimmer text-xs font-black" data-text={t('home.refreshing')}>{t('home.refreshing')}</span> : null}
            <Button variant="ghost" className="h-9 px-2" loading={isRefreshing} onClick={() => query.refetch()} aria-label={t('home.refresh_feed')}>
              {!isRefreshing ? <RefreshCw size={17} /> : null}
            </Button>
            <ListFilter className="text-gray-400" size={20} />
          </div>
        </div>
      </header>
      <div className="sticky top-16 z-10 border-b border-gray-200/70 bg-slate-50/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 sm:top-0">
        <div ref={moreRef} className="relative">
          <div className="flex items-center gap-1 overflow-x-auto scroll-smooth px-3 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          {mainFeedTabs.map((tab) => (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabButtonRefs.current.set(tab.id, node);
                else tabButtonRefs.current.delete(tab.id);
              }}
              onClick={() => changeFeed(tab.id)}
              aria-current={feed === tab.id ? 'page' : undefined}
              className={`motion-control relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-black ${
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
            <button
              ref={(node) => {
                if (node) tabButtonRefs.current.set('more', node);
                else tabButtonRefs.current.delete('more');
              }}
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={`motion-control flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-black ${
                isExtraFeed
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Ещё
              <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {moreOpen ? (
            <div className="t-dropdown is-open absolute right-3 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950 sm:right-4" data-origin="top-right" role="menu">
              {extraFeedTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    changeFeed(tab.id);
                    setMoreOpen(false);
                  }}
                  className={`motion-control block w-full px-4 py-2.5 text-left text-sm font-bold ${
                    feed === tab.id
                      ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-900'
                  }`}
                  role="menuitem"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
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
            <div className="motion-feed-list space-y-5">
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
          className="t-panel-slide motion-control fixed bottom-24 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-lg backdrop-blur hover:bg-white hover:text-gray-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:bottom-8"
          data-open="true"
          aria-label={t('home.scroll_to_top')}
        >
          <ArrowUp size={18} />
        </button>
      ) : null}
    </div>
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
