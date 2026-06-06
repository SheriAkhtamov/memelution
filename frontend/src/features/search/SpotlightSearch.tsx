import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, User, Users, FileText, Hash } from 'lucide-react';
import { api } from '../../shared/api/client';
import { useAuthStore } from '../../store/authStore';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useAnimatedPresence } from '../../shared/lib/useAnimatedPresence';
import { cn } from '../../lib/utils';

type SearchResult = {
  people: Array<{ id: string; username: string; display_name: string; avatar_url?: string }>;
  posts: Array<{ id: string; text?: string; author?: { display_name: string } }>;
  communities: Array<{ id: string; slug: string; name: string; avatar_url?: string }>;
  hashtags: Array<{ id: string; name: string; posts_count: number }>;
};

export function SpotlightSearch() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const presence = useAnimatedPresence(open, 170);

  // Debounce the API call but keep the input responsive (200ms = snappy for a palette)
  const debounced = useDebouncedValue(query.trim(), 200);
  const searchQuery = useQuery({
    queryKey: ['spotlight', debounced],
    queryFn: () => api.search(debounced, 'all') as Promise<SearchResult>,
    enabled: open && debounced.length > 1,
    staleTime: 30_000,
  });

  const results = searchQuery.data;

  const flatResults = useMemo(() => {
    const items: Array<{ type: string; label: string; sub?: string; icon: typeof User; path: string; id: string }> = [];
    if (!results) return items;
    (results.people || []).slice(0, 5).forEach((p) =>
      items.push({ type: 'user', label: p.display_name, sub: `@${p.username}`, icon: User, path: `/user/${p.username}`, id: `u-${p.id}` }),
    );
    (results.communities || []).slice(0, 5).forEach((c) =>
      items.push({ type: 'community', label: c.name, sub: `/${c.slug}`, icon: Users, path: `/communities/${c.slug}`, id: `c-${c.id}` }),
    );
    (results.posts || []).slice(0, 5).forEach((p) =>
      items.push({ type: 'post', label: p.text ? p.text.slice(0, 60) : 'Пост', sub: p.author?.display_name, icon: FileText, path: `/post/${p.id}`, id: `p-${p.id}` }),
    );
    (results.hashtags || []).slice(0, 5).forEach((h) =>
      items.push({ type: 'hashtag', label: `#${h.name}`, sub: `${h.posts_count} постов`, icon: Hash, path: `/hashtag/${h.name}`, id: `h-${h.id}` }),
    );
    return items;
  }, [results]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        setQuery('');
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && flatResults[selectedIndex]) {
        e.preventDefault();
        navigate(flatResults[selectedIndex].path);
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatResults, selectedIndex, navigate]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!user) return;
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [user]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const scrollSelectedIntoView = useCallback(() => {
    const node = resultsRef.current;
    if (!node) return;
    const active = node.querySelector('[data-selected="true"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollSelectedIntoView();
  }, [selectedIndex, scrollSelectedIntoView]);

  if (!presence.mounted) return null;

  return createPortal(
    <div className="motion-overlay fixed inset-0 z-[110] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-[2px]" data-state={presence.state} onClick={() => { setOpen(false); setQuery(''); }}>
      <div
        className={cn(
          't-modal w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950',
          presence.state === 'open' && 'is-open',
          presence.state === 'closing' && 'is-closing',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
          <Search size={18} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по людям, сообществам, постам..."
            className="min-w-0 flex-1 bg-transparent text-base font-bold text-gray-900 outline-none placeholder:text-gray-400 dark:text-zinc-100"
          />
          <button onClick={() => { setOpen(false); setQuery(''); }} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length <= 1 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              Начните вводить запрос или выберите из результатов
            </div>
          ) : searchQuery.isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="motion-skeleton h-10 rounded-lg bg-gray-100 dark:bg-zinc-900" />
              ))}
            </div>
          ) : flatResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              Ничего не найдено
            </div>
          ) : (
            <div className="space-y-1">
              {flatResults.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    data-selected={isSelected}
                    onClick={() => { navigate(item.path); setOpen(false); setQuery(''); }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`motion-control flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                      isSelected
                        ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30 dark:text-orange-400'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-[#FF6B00]' : 'text-gray-400'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{item.label}</p>
                      {item.sub ? <p className="truncate text-xs text-gray-400">{item.sub}</p> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[10px] font-bold text-gray-400 dark:border-zinc-800">
          <span>↑↓ навигация · Enter открыть · Esc закрыть</span>
          <span className="rounded border border-gray-200 px-1 py-0.5 dark:border-zinc-700">Ctrl+K</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
