import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { FeedTab, Post } from '../../shared/types';

export function useFeed(feed: FeedTab, communityId?: string) {
  const queryClient = useQueryClient();
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const queryKey = ['feed', feed, communityId || 'global'];
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.feed(feed, pageParam || null, communityId),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    staleTime: 30_000,
    retry: 2,
  });

  const posts = useMemo(() => dedupe(query.data?.pages.flatMap((page) => page.items) || []), [query.data]);
  const firstPostId = posts[0]?.id;

  useEffect(() => {
    if (!firstPostId) return;
    const timer = window.setInterval(() => {
      api
        .feed(feed, null, communityId, 1)
        .then((page) => {
          if (page.items[0]?.id && page.items[0].id !== firstPostId) { setHasNewPosts(true); setNewPostsCount((c) => c + 1); }
        })
        .catch(() => undefined);
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [communityId, feed, firstPostId]);

  const showNewPosts = async () => {
    setHasNewPosts(false);
    setNewPostsCount(0);
    try {
      // Fetch the latest first page and prepend new items into existing cache
      // instead of a full refetch + scroll-to-top (avoids disorienting jump).
      const freshPage = await api.feed(feed, null, communityId);
      queryClient.setQueryData(queryKey, (old: typeof query.data) => {
        if (!old) return old;
        const existingIds = new Set(old.pages.flatMap((p) => p.items.map((i) => i.id)));
        const newItems = freshPage.items.filter((item) => !existingIds.has(item.id));
        if (!newItems.length) return old;
        // Merge new items into the first page
        const updatedFirstPage = {
          ...old.pages[0],
          items: [...newItems, ...old.pages[0].items],
        };
        return { ...old, pages: [updatedFirstPage, ...old.pages.slice(1)] };
      });
    } catch {
      // Fallback to full refetch if prepend fails
      await query.refetch();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return { ...query, posts, hasNewPosts, newPostsCount, showNewPosts };
}

function dedupe(posts: Post[]) {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}
