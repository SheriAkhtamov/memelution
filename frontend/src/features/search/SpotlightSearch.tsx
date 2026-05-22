import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Command, FileText } from 'lucide-react';
import { api } from '../../shared/api/client';
import { Avatar, Skeleton } from '../../shared/ui';
import { useTranslation } from '../../shared/i18n';

type ResultItem =
  | { type: 'user'; id: string; label: string; sub: string; icon?: string; path: string }
  | { type: 'community'; id: string; label: string; sub: string; icon?: string; path: string }
  | { type: 'post'; id: string; label: string; sub: string; icon: null; path: string };

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const autocompleteQuery = useQuery({
    queryKey: ['spotlight-autocomplete', q],
    queryFn: () => api.searchAutocomplete(q.trim()),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });

  const postsQuery = useQuery({
    queryKey: ['spotlight-posts', q],
    queryFn: () => api.search(q.trim(), 'posts'),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });

  const flatResults = useMemo<ResultItem[]>(() => {
    const items: ResultItem[] = [];
    (autocompleteQuery.data?.people || []).slice(0, 5).forEach((u) =>
      items.push({ type: 'user', id: u.id, label: u.display_name, sub: `@${u.username}`, icon: u.avatar_url, path: `/user/${u.username}` }),
    );
    (autocompleteQuery.data?.communities || []).slice(0, 5).forEach((c) =>
      items.push({ type: 'community', id: c.id, label: c.name, sub: '', icon: c.avatar_url, path: `/communities/${c.slug}` }),
    );
    (postsQuery.data?.posts || []).slice(0, 5).forEach((p) =>
      items.push({ type: 'post', id: p.id, label: p.text ? p.text.slice(0, 80) : t('layout.media_post'), sub: p.author?.display_name || '', icon: null, path: `/post/${p.id}` }),
    );
    return items;
  }, [autocompleteQuery.data, postsQuery.data, t]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatResults[selectedIndex];
        if (item) {
          setOpen(false);
          navigate(item.path);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, flatResults, selectedIndex, navigate]);

  // Scroll selected into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const isLoading = autocompleteQuery.isLoading || postsQuery.isLoading;
  const hasResults = flatResults.length > 0;

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-0 pt-[15vh] animate-in fade-in duration-200 sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-b-xl bg-white shadow-2xl dark:bg-zinc-950 sm:rounded-xl">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
          <Search size={18} className="shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            className="h-10 flex-1 bg-transparent text-base font-bold text-gray-900 outline-none placeholder:text-gray-400 dark:text-zinc-100"
            autoComplete="off"
            aria-label={t('search.placeholder')}
          />
          {q ? (
            <button
              onClick={() => { setQ(''); inputRef.current?.focus(); }}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
              aria-label={t('search.clear')}
            >
              <X size={16} />
            </button>
          ) : null}
          <button
            onClick={() => setOpen(false)}
            className="hidden shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 sm:block"
            aria-label={t('common.close')}
          >
            <Command size={14} className="inline" /> K
          </button>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {isLoading ? (
            <div className="space-y-2 px-4 py-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !hasResults && q.trim().length > 0 ? (
            <div className="px-4 py-6 text-center text-sm font-bold text-gray-400">{t('search.not_found')}</div>
          ) : (
            <>
              {flatResults.map((item, index) => {
                const isSelected = index === selectedIndex;
                const baseClasses =
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ' +
                  (isSelected ? 'bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-900');
                if (item.type === 'user') {
                  return (
                    <button
                      key={`user-${item.id}`}
                      data-index={index}
                      onClick={() => handleSelect(item.path)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={baseClasses}
                    >
                      <Avatar src={item.icon} name={item.label} className="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{item.label}</p>
                        <p className="truncate text-xs text-gray-400">{item.sub}</p>
                      </div>
                    </button>
                  );
                }
                if (item.type === 'community') {
                  return (
                    <button
                      key={`comm-${item.id}`}
                      data-index={index}
                      onClick={() => handleSelect(item.path)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={baseClasses}
                    >
                      <Avatar src={item.icon} name={item.label} className="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{item.label}</p>
                      </div>
                    </button>
                  );
                }
                return (
                  <button
                    key={`post-${item.id}`}
                    data-index={index}
                    onClick={() => handleSelect(item.path)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={baseClasses}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800">
                      <FileText size={16} className="text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.label}</p>
                      {item.sub ? <p className="truncate text-xs text-gray-400">{item.sub}</p> : null}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-zinc-800">
          <span>
            <Command size={12} className="inline" /> K {t('spotlight.open') ?? 'открыть'}
          </span>
          <span>↑↓ {t('spotlight.navigate') ?? 'навигация'} · Enter {t('spotlight.select') ?? 'выбрать'}</span>
        </div>
      </div>
    </div>
  );
}
