import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Hash, Search, SearchX, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { Avatar, Button, ErrorState, Skeleton, Tabs } from '../../shared/ui';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { PostCard } from '../../features/posts/components/PostCard';
import { useTranslation } from '../../shared/i18n';
import { trackEvent } from '../../shared/lib/analytics';
import { ProductEmptyState } from '../../shared/ui/ProductEmptyState';

const SEARCH_HISTORY_KEY = 'memelution-search-history';
type SearchTab = 'all' | 'posts' | 'people' | 'communities' | 'hashtags' | 'media' | 'video';
const SEARCH_TAB_IDS: SearchTab[] = ['all', 'posts', 'people', 'communities', 'hashtags', 'media', 'video'];

function isSearchTab(value: string | null): value is SearchTab {
  return (SEARCH_TAB_IDS as readonly string[]).includes(value as SearchTab);
}

export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [type, setType] = useState<SearchTab>(() => {
    const tab = params.get('type');
    return isSearchTab(tab) ? tab : 'all';
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const debounced = useDebouncedValue(q.trim(), 400);

  const searchTabs: Array<{ id: SearchTab; label: string }> = [
    { id: 'all', label: t('search.tab_best') },
    { id: 'posts', label: t('search.tab_posts') },
    { id: 'people', label: t('search.tab_people') },
    { id: 'communities', label: t('search.tab_communities') },
    { id: 'hashtags', label: t('search.tab_hashtags') },
    { id: 'media', label: t('search.tab_media') },
    { id: 'video', label: t('search.tab_video') },
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const query = useQuery({
    queryKey: ['search', debounced, type],
    queryFn: () => api.search(debounced, type),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });
  const autocompleteQuery = useQuery({
    queryKey: ['search-autocomplete', debounced],
    queryFn: () => api.searchAutocomplete(debounced),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });
  const trendsQuery = useQuery({
    queryKey: ['trends', 'search'],
    queryFn: () => api.trends('day'),
    staleTime: 60_000,
  });

  useEffect(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (debounced) next.set('q', debounced);
      else next.delete('q');
      if (type === 'all') next.delete('type');
      else next.set('type', type);
      return next;
    }, { replace: true });
    if (!debounced) return;
    setHistory((current) => {
      const next = [debounced, ...current.filter((item) => item !== debounced)].slice(0, 8);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [debounced, setParams, type]);

  useEffect(() => {
    if (!debounced) return;
    trackEvent('search_used', { query: debounced, type });
  }, [debounced, type]);

  const suggestions = useMemo(() => {
    const local = history.filter((item) => item.toLowerCase().includes(q.toLowerCase()) && item !== q);
    return [...new Set([...(autocompleteQuery.data?.queries || []), ...local])].slice(0, 8);
  }, [autocompleteQuery.data?.queries, history, q]);
  const popularTags = (trendsQuery.data?.hashtags || []).slice(0, 8).map((tag) => tag.name);
  const hasResults = Boolean(query.data && ((query.data.posts?.length || 0) + (query.data.people?.length || 0) + (query.data.communities?.length || 0) + (query.data.hashtags?.length || 0) > 0));

  return (
    <div>
      <header className="page-header sticky top-16 z-20 px-4 py-5 sm:top-0 sm:px-6 sm:py-7">
        <div className="mb-5 flex items-center gap-3">
          <Search className="text-[#FF6B00]" size={32} strokeWidth={2.2} />
          <h1 className="page-title">{t('search.title')}</h1>
        </div>
        <div className="search-hero-field">
          <div className="search-hero-field-inner">
            <Search className="shrink-0 text-gray-400" size={24} />
            <input
              ref={inputRef}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setQ('');
              }}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-base font-semibold text-gray-900 outline-none placeholder:text-gray-400 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="motion-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FF7A1A,#FF5A00)] text-white shadow-[0_10px_20px_rgba(255,107,0,0.22)]"
              aria-label={t('search.title')}
            >
              <Search size={20} />
            </button>
          </div>
        </div>
        {q ? (
          <button
            type="button"
            onClick={() => setQ('')}
            className="mt-2 text-xs font-black text-gray-400 hover:text-[#FF6B00]"
          >
            {t('search.clear')}
          </button>
        ) : null}
        {suggestions.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button key={item} onClick={() => setQ(item)} className="rounded-lg bg-white px-3 py-1 text-xs font-black text-gray-500 dark:bg-zinc-900">
                {highlight(item, q)}
              </button>
            ))}
            {history.length ? <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => { localStorage.removeItem(SEARCH_HISTORY_KEY); setHistory([]); }}>{t('search.clear_history')}</Button> : null}
          </div>
        ) : null}
        <div className="surface-card mt-4 overflow-x-auto rounded-2xl p-1.5 [&_.t-tab]:flex-1 [&_.t-tabs]:flex [&_.t-tabs]:w-full [&_.t-tabs]:bg-transparent">
          <Tabs
            value={type}
            onChange={(value) => setType(value as SearchTab)}
            items={searchTabs}
          />
        </div>
      </header>
      <div className="space-y-5 p-3 sm:p-5 lg:p-6">
        {!debounced ? (
          <SearchDiscovery
            title={t('search.empty_query')}
            description={t('search.hint')}
            popularTags={popularTags}
            history={history}
            onPick={setQ}
            onClearHistory={() => {
              localStorage.removeItem(SEARCH_HISTORY_KEY);
              setHistory([]);
            }}
          />
        ) : query.isLoading ? (
          <Skeleton className="h-64" />
        ) : query.isError ? (
          <ErrorState description={query.error instanceof Error ? query.error.message : t('search.error')} onRetry={() => query.refetch()} />
        ) : hasResults ? (
          <>
            {query.data?.people?.length ? (
              <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="mb-3 font-black">{t('search.section_people')}</h2>
                <div className="space-y-1">
                  {query.data.people.map((person) => (
                    <Link key={person.id} to={`/user/${person.username}`} className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900">
                      <Avatar src={person.avatar_url} name={person.display_name} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{highlight(person.display_name, debounced)}</p>
                        <p className="truncate text-sm font-bold text-gray-400">@{highlight(person.username, debounced)}</p>
                        {person.bio ? <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-zinc-400">{person.bio}</p> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            {query.data?.communities?.length ? (
              <section className="grid gap-3 sm:grid-cols-2">
                {query.data.communities.map((community) => (
                  <Link key={community.id} to={`/communities/${community.slug}`} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                    <Avatar src={community.avatar_url} name={community.name} />
                    <div className="min-w-0">
                      <p className="truncate font-black">{highlight(community.name, debounced)}</p>
                      <p className="line-clamp-2 text-sm text-gray-500">{highlight(community.description || '', debounced)}</p>
                      <p className="mt-1 text-xs font-bold text-gray-400">{community.members_count} {t('search.members')}</p>
                    </div>
                  </Link>
                ))}
              </section>
            ) : null}
            {query.data?.hashtags?.length ? (
              <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="mb-3 font-black">{t('search.section_tags')}</h2>
                <div className="flex flex-wrap gap-2">
                  {query.data.hashtags.map((tag) => (
                    <Link key={tag.id} to={`/hashtag/${tag.name}`} className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-[#FF6B00] transition-colors hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50">
                      #{highlight(tag.name, debounced)} · {tag.posts_count}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            {query.data?.posts?.length ? (
              <div className="space-y-5">
                {query.data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-4">
            <ProductEmptyState className="sm:min-h-[25rem]" title={t('search.not_found')} description={t('search.not_found_desc')} tone="search" icon={<SearchX size={38} />} />
            {popularTags.length ? (
              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#FF6B00]" />
                  <h2 className="font-black">{t('search.try_trending')}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQ(`#${tag}`)}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-[#FF6B00] transition-colors hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50"
                    >
                      <Hash size={14} /> {tag}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchDiscovery({
  title,
  description,
  popularTags,
  history,
  onPick,
  onClearHistory,
}: {
  title: string;
  description: string;
  popularTags: string[];
  history: string[];
  onPick: (query: string) => void;
  onClearHistory: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <ProductEmptyState className="sm:min-h-[25rem]" title={title} description={description} tone="search" icon={<Search size={38} />} />
      {popularTags.length ? (
      <section className="surface-card rounded-2xl p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#FF6B00]" />
          <h2 className="font-black">{t('search.popular_queries')}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onPick(`#${tag}`)}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-[#FF6B00] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-orange-950/30"
            >
              <Hash size={14} /> {tag}
            </button>
          ))}
        </div>
      </section>
      ) : null}
      {history.length ? (
        <section className="surface-card rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-black">{t('search.recent_searches')}</h2>
            <Button variant="ghost" className="h-8 px-2 text-xs" onClick={onClearHistory}>{t('search.clear_recent')}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <button
                key={item}
                onClick={() => onPick(item)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-black text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function highlight(text: string, needle: string) {
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-orange-100 px-0.5 text-inherit dark:bg-orange-950">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}
