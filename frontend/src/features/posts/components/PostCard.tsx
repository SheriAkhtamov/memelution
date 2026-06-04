import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BarChart3, Copy, EyeOff, Flag, Heart, Loader2, MessageSquare, MoreHorizontal, Pencil, Pin, Repeat2, Send, Share2, ThumbsDown, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import type { Post, ReactionItem } from '../../../shared/types';
import { AnimatedNumber, Avatar, Badge, Button, ConfirmDialog, ErrorBoundary, IconButton, Input, MediaViewer, Modal, ReportDialog, Select, Textarea, useToast } from '../../../shared/ui';
import { Dropdown, DropdownItem } from '../../../shared/ui';
import { useAuthStore } from '../../../store/authStore';
import { ReactionPicker } from './ReactionPicker';
import { redirectToLogin } from '../../../utils/authRedirect';
import { hapticTap } from '../../../utils/haptic';
import { useTranslation } from '../../../shared/i18n';
import { trackEvent } from '../../../shared/lib/analytics';

function hashtagParts(text: string) {
  return text.split(/(#[\wа-яА-ЯёЁ_]{2,80})/g);
}

export function PostCard({
  post,
  compact = false,
  onChanged,
  onDeleted,
}: {
  post: Post;
  compact?: boolean;
  onChanged?: (post: Post) => void;
  onDeleted?: (id: string) => void;
}) {
  const { user } = useAuthStore();
  const { t, dateLocale } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [localPost, setLocalPost] = useState(post);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnrepost, setConfirmUnrepost] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [repostText, setRepostText] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [commentsEnabled, setCommentsEnabled] = useState(post.comments_enabled ?? true);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendUsername, setSendUsername] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [notInterestedOpen, setNotInterestedOpen] = useState(false);
  const [notInterestedReason, setNotInterestedReason] = useState('boring');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [heartAnim, setHeartAnim] = useState(false);
  const [heartPos, setHeartPos] = useState<{ x: number; y: number } | null>(null);
  const [likePulse, setLikePulse] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [repostPulse, setRepostPulse] = useState(false);
  const [postContextMenuOpen, setPostContextMenuOpen] = useState(false);
  const lastTapRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewTrackedRef = useRef(false);
  const deleteUndoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const pulseFeedback = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    setTimeout(() => setter(false), 300);
  };

  const canManage = user?.id === localPost.author_id || user?.role === 'global_admin' || user?.role === 'admin';
  const timeAgo = useMemo(() => formatDistanceToNow(new Date(localPost.created_at), { addSuffix: true, locale: dateLocale }), [dateLocale, localPost.created_at]);
  const isEdited = Boolean(localPost.updated_at && new Date(localPost.updated_at).getTime() > new Date(localPost.created_at).getTime() + 1000);

  const patch = (changes: Partial<Post>) => {
    const next = { ...localPost, ...changes };
    setLocalPost(next);
    onChanged?.(next);
  };

  const requireAuth = () => {
    if (!user) {
      redirectToLogin();
      return false;
    }
    return true;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['post', localPost.id] });
  };
  const collectionsQuery = useQuery({ queryKey: ['save-collections'], queryFn: api.saveCollections, enabled: Boolean(saveOpen && user) });

  const like = useMutation({
    mutationFn: () => api.likePost(localPost.id, localPost.liked),
    onMutate: () => {
      const nextLiked = !localPost.liked;
      patch({ liked: nextLiked, likes_count: Math.max(0, localPost.likes_count + (localPost.liked ? -1 : 1)) });
      if (nextLiked) {
        trackEvent('meme_liked', {
          post_id: localPost.id,
          author_id: localPost.author_id,
          community_id: localPost.community_id,
        });
      }
    },
    onSuccess: (result) => patch({ liked: result.liked, likes_count: result.likes_count }),
    onError: () => invalidate(),
  });
  const save = useMutation({
    mutationFn: (collectionId?: string) => api.savePost(localPost.id, localPost.saved, collectionId),
    onSuccess: (result) => {
      patch({ saved: result.saved, saves_count: result.saves_count });
      if (result.saved) {
        trackEvent('meme_saved', {
          post_id: localPost.id,
          author_id: localPost.author_id,
          community_id: localPost.community_id,
        });
      }
      toast.show({ title: result.saved ? t('post.saved') : t('post.unsaved'), tone: 'success' });
      setSaveOpen(false);
    },
  });
  const createCollection = useMutation({
    mutationFn: () => api.createSaveCollection({ name: newCollectionName }),
    onSuccess: (collection) => {
      setSelectedCollection(collection.id);
      setNewCollectionName('');
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
    },
  });
  const repost = useMutation({
    mutationFn: (comment?: string) => (localPost.reposted ? api.unrepostPost(localPost.id) : api.repostPost(localPost.id, comment)),
    onSuccess: (result) => {
      patch({ reposted: result.reposted, reposts_count: result.reposts_count });
      if (result.reposted) {
        trackEvent('meme_shared', {
          post_id: localPost.id,
          author_id: localPost.author_id,
          community_id: localPost.community_id,
          channel: 'repost',
        });
      }
      if (result.reposted) {
        toast.show({ title: t('post.reposted'), tone: 'success' });
      } else {
        toast.show({
          title: t('post.unreposted'),
          tone: 'success',
          duration: 5000,
          action: {
            label: 'Отменить',
            onClick: () => {
              api.repostPost(localPost.id).then((res) => {
                patch({ reposted: res.reposted, reposts_count: res.reposts_count });
                invalidate();
                toast.show({ title: 'Репост восстановлен', tone: 'success' });
              }).catch(() => {
                toast.show({ title: 'Не удалось восстановить репост', tone: 'error' });
              });
            },
          },
        });
      }
      setRepostOpen(false);
      setRepostText('');
      invalidate();
    },
    onError: () => {
      toast.show({ title: t('post.repost_error'), tone: 'error' });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deletePost(localPost.id),
    onSuccess: () => {
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: () => api.updatePost(localPost.id, { text: editText, comments_enabled: commentsEnabled }),
    onSuccess: (next) => {
      patch(next);
      setEditOpen(false);
      toast.show({ title: t('post.updated'), tone: 'success' });
    },
  });
  const pin = useMutation({
    mutationFn: () => api.pinPost(localPost.id, !localPost.is_pinned, localPost.community_id ? 'community' : 'profile'),
    onSuccess: (result) => {
      patch(result.post);
      toast.show({ title: result.post.is_pinned ? t('post.pinned') : t('post.unpinned'), tone: 'success' });
    },
  });
  const hide = useMutation({
    mutationFn: () => api.hidePost(localPost.id),
    onSuccess: () => {
      invalidate();
    },
  });
  const vote = useMutation({
    mutationFn: (optionId: string) => api.votePoll(localPost.id, optionId),
    onMutate: (optionId) => {
      const oldOptions = localPost.poll_options || [];
      const newOptions = oldOptions.map((opt) => {
        const wasSelected = localPost.poll_voted_option_id === opt.id;
        const isNew = opt.id === optionId;
        return { ...opt, votes: Math.max(0, (opt.votes || 0) + (isNew ? 1 : 0) + (wasSelected ? -1 : 0)) };
      });
      const newTotal = newOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0);
      patch({ poll_options: newOptions, poll_voted_option_id: optionId, poll_total_votes: newTotal, poll_results_visible: true });
    },
    onSuccess: (result) => patch(result.post),
    onError: () => {
      toast.show({ title: t('post.vote_error'), tone: 'error' });
      invalidate();
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      const chat = await api.createChat(sendUsername.replace(/^@/, '').trim());
      await api.sendMessage(chat.id, '', localPost.id);
      return chat;
    },
    onSuccess: () => {
      setSendOpen(false);
      setSendUsername('');
      toast.show({ title: t('post.sent_to_chat'), tone: 'success' });
    },
  });

  const userSearchQuery = useQuery({
    queryKey: ['user-search', sendUsername.replace(/^@/, '').trim()],
    queryFn: () => api.searchAutocomplete(sendUsername.replace(/^@/, '').trim()),
    enabled: sendOpen && sendUsername.trim().length > 1,
    staleTime: 30_000,
  });

  const chatsQueryForSend = useQuery({
    queryKey: ['chats'],
    queryFn: api.chats,
    enabled: sendOpen && Boolean(user),
    staleTime: 60_000,
  });

  const userSuggestions = useMemo(() => {
    const raw = userSearchQuery.data?.people || [];
    const chatUsernames = new Set((chatsQueryForSend.data || []).flatMap((c) => c.members.map((m) => m.username)));
    return [...raw].sort((a, b) => {
      const aChat = chatUsernames.has(a.username) ? 1 : 0;
      const bChat = chatUsernames.has(b.username) ? 1 : 0;
      return bChat - aChat;
    });
  }, [userSearchQuery.data, chatsQueryForSend.data]);

  const performHide = () => {
    if (!requireAuth()) return;
    hide.mutate(undefined, {
      onSuccess: () => {
        toast.show({
          title: t('post.hidden'),
          tone: 'success',
          duration: 5000,
          action: {
            label: 'Отменить',
            onClick: () => {
              api.unhidePost(localPost.id).then(() => {
                invalidate();
                toast.show({ title: 'Пост восстановлен', tone: 'success' });
              }).catch(() => {
                toast.show({ title: 'Не удалось восстановить', tone: 'error' });
              });
            },
          },
        });
        onDeleted?.(localPost.id);
      },
    });
  };

  const performDelete = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast.show({
          title: t('post.deleted_undo'),
          tone: 'success',
          duration: 5000,
          action: {
            label: t('common.undo'),
            onClick: () => {
              if (deleteUndoRef.current) {
                clearTimeout(deleteUndoRef.current);
                deleteUndoRef.current = null;
              }
              api.restorePost(localPost.id).then((result) => {
                patch(result.post);
                invalidate();
                toast.show({ title: 'Пост восстановлен', tone: 'success' });
              }).catch(() => {
                toast.show({ title: 'Не удалось восстановить', tone: 'error' });
              });
            },
          },
        });
        deleteUndoRef.current = setTimeout(() => {
          onDeleted?.(localPost.id);
        }, 5000);
      },
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/post/${localPost.id}`);
    trackEvent('meme_shared', {
      post_id: localPost.id,
      author_id: localPost.author_id,
      community_id: localPost.community_id,
      channel: 'copy_link',
    });
    toast.show({ title: t('common.copied'), tone: 'success' });
  };

  const handleShare = useCallback(async () => {
    const postUrl = `${window.location.origin}/post/${localPost.id}`;
    const shareText = localPost.text ? `${localPost.text.slice(0, 80)}${localPost.text.length > 80 ? '…' : ''} — ${t('common.site_name')}` : t('post.share_text');
    if (navigator.share) {
      try {
        await navigator.share({ title: t('common.site_name'), text: shareText, url: postUrl });
        trackEvent('meme_shared', {
          post_id: localPost.id,
          author_id: localPost.author_id,
          community_id: localPost.community_id,
          channel: 'native_share',
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to copy link
      }
    }
    await navigator.clipboard.writeText(postUrl);
    trackEvent('meme_shared', {
      post_id: localPost.id,
      author_id: localPost.author_id,
      community_id: localPost.community_id,
      channel: 'copy_link',
    });
    toast.show({ title: t('common.copied'), tone: 'success' });
  }, [localPost.id, localPost.text, localPost.author_id, localPost.community_id, t]);

  const startPostLongPress = useCallback(() => {
    postLongPressTimerRef.current = setTimeout(() => {
      setPostContextMenuOpen(true);
    }, 500);
  }, []);

  const cancelPostLongPress = useCallback(() => {
    if (postLongPressTimerRef.current) {
      clearTimeout(postLongPressTimerRef.current);
      postLongPressTimerRef.current = null;
    }
    postTouchStartPosRef.current = null;
  }, []);

  const handlePostTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"], input, textarea')) return;
    const touch = e.touches[0];
    postTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    startPostLongPress();
  }, [startPostLongPress]);

  const handlePostTouchMove = useCallback((e: React.TouchEvent) => {
    if (!postTouchStartPosRef.current || !postLongPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - postTouchStartPosRef.current.x;
    const dy = touch.clientY - postTouchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      cancelPostLongPress();
    }
  }, [cancelPostLongPress]);

  const handlePostTouchEnd = useCallback(() => {
    cancelPostLongPress();
  }, [cancelPostLongPress]);

  const handlePostContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPostContextMenuOpen(true);
  }, []);

  const handleDoubleTap = useCallback((clientX?: number, clientY?: number) => {
    if (!requireAuth()) return;
    if (!localPost.liked) {
      like.mutate();
      hapticTap();
      // Calculate position relative to the content container
      if (clientX !== undefined && clientY !== undefined && contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect();
        setHeartPos({ x: clientX - rect.left, y: clientY - rect.top });
      } else {
        setHeartPos(null);
      }
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 800);
    }
  }, [localPost.liked, like]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || viewTrackedRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.45 || viewTrackedRef.current) return;
        viewTrackedRef.current = true;
        trackEvent('meme_viewed', {
          post_id: localPost.id,
          author_id: localPost.author_id,
          community_id: localPost.community_id,
          surface: compact ? 'compact_card' : 'feed_card',
        });
        observer.disconnect();
      },
      { threshold: [0.45] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact, localPost.author_id, localPost.community_id, localPost.id]);

  useEffect(() => {
    return () => {
      if (deleteUndoRef.current) clearTimeout(deleteUndoRef.current);
    };
  }, []);

  const contentText = localPost.text ? (
    <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-gray-900 dark:text-zinc-100">
      {hashtagParts(localPost.text).map((part, index) =>
        part.startsWith('#') ? (
          <Link key={`${part}-${index}`} to={`/hashtag/${encodeURIComponent(part.slice(1))}`} className="font-black text-[#FF6B00] hover:underline">
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </p>
  ) : null;

  return (
    <ErrorBoundary level="feed-item">
      <article
        className="motion-feed-card rounded-lg border border-gray-200/80 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_18px_40px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:hover:border-zinc-700"
      onTouchStart={handlePostTouchStart}
      onTouchMove={handlePostTouchMove}
      onTouchEnd={handlePostTouchEnd}
      onContextMenu={handlePostContextMenu}
    >
      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="flex gap-3">
          <Link to={`/user/${localPost.author?.username}`} className="shrink-0">
            <Avatar src={localPost.author?.avatar_url} name={localPost.author?.display_name} className="h-11 w-11" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/user/${localPost.author?.username}`} className="font-black hover:text-[#FF6B00]">
                    {localPost.author?.display_name}
                  </Link>
                  <span className="text-xs font-bold text-gray-400">@{localPost.author?.username}</span>
                  <span className="text-xs text-gray-400">· {timeAgo}</span>
                  {isEdited ? <span className="text-xs font-bold text-gray-400">· {t('post.edited')}</span> : null}
                  {localPost.is_pinned ? <Badge>{t('post.pinned_label')}</Badge> : null}
                </div>
                {localPost.community ? (
                  <Link to={`/communities/${localPost.community.slug}`} className="mt-1 block text-xs font-black text-[#7C3AED] hover:underline">
                    /{localPost.community.name}
                  </Link>
                ) : null}
              </div>
              <Dropdown
                trigger={
                  <IconButton label={t('post.menu_actions')}>
                    <MoreHorizontal size={18} />
                  </IconButton>
                }
              >
                <DropdownItem onClick={handleShare}>
                  <Share2 size={15} /> {t('common.share')}
                </DropdownItem>
                <DropdownItem onClick={copyLink}>
                  <Copy size={15} /> {t('post.menu_copy')}
                </DropdownItem>
                <DropdownItem onClick={() => requireAuth() && setSendOpen(true)}>
                  <Send size={15} /> {t('post.menu_send')}
                </DropdownItem>
                <DropdownItem onClick={() => (localPost.saved ? save.mutate(undefined) : setSaveOpen(true))}>
                  <Bookmark size={15} /> {localPost.saved ? t('post.menu_unsave') : t('post.menu_save')}
                </DropdownItem>
                <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                <DropdownItem onClick={() => setNotInterestedOpen(true)}>
                  <ThumbsDown size={15} /> {t('post.menu_not_interested')}
                </DropdownItem>
                <DropdownItem onClick={() => setConfirmHide(true)}>
                  <EyeOff size={15} /> {t('post.menu_hide')}
                </DropdownItem>
                {canManage ? (
                  <>
                    <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                    <DropdownItem onClick={() => setEditOpen(true)}>
                      <Pencil size={15} /> {t('post.menu_edit')}
                    </DropdownItem>
                    <DropdownItem onClick={() => pin.mutate()}>
                      <Pin size={15} /> {localPost.is_pinned ? t('post.menu_unpin') : t('post.menu_pin')}
                    </DropdownItem>
                    <DropdownItem onClick={() => setStatsOpen(true)}>
                      <BarChart3 size={15} /> {t('post.menu_stats')}
                    </DropdownItem>
                    <DropdownItem danger onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={15} /> {t('post.menu_delete')}
                    </DropdownItem>
                  </>
                ) : null}
                <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                <DropdownItem danger onClick={() => setReportOpen(true)}>
                  <Flag size={15} /> {t('post.menu_report')}
                </DropdownItem>
              </Dropdown>
            </div>

            <div
              ref={contentRef}
              className="mt-3 relative"
              onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
              onTouchEnd={(e) => {
                const now = Date.now();
                if (now - lastTapRef.current < 300) {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  handleDoubleTap(touch?.clientX, touch?.clientY);
                }
                lastTapRef.current = now;
              }}
            >
              {heartAnim && (
                <div
                  className="pointer-events-none absolute z-10"
                  style={
                    heartPos
                      ? { left: heartPos.x - 40, top: heartPos.y - 40 }
                      : { inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
                  }
                >
                  <Heart size={80} className="animate-like-heart fill-red-500 text-red-500 drop-shadow-lg" />
                </div>
              )}
              {contentText}
              {localPost.media_items?.length ? (
                <div className={`mt-4 grid min-w-0 gap-3 overflow-hidden ${localPost.media_items.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                  {localPost.media_items.map((item, index) => (
                    <div key={item.id || `${item.url}-${index}`} className="min-w-0">
                      <MediaViewer url={item.url} type={item.type} alt={item.alt || localPost.media_alt || t('post_page.title')} />
                    </div>
                  ))}
                </div>
              ) : localPost.media_url ? (
                <div className="mt-4 min-w-0 overflow-hidden"><MediaViewer url={localPost.media_url} type={localPost.media_type} alt={localPost.media_alt || t('post_page.title')} /></div>
              ) : null}
            </div>

            {localPost.type === 'poll' && localPost.poll_options?.length ? (
              <div className="mt-4 space-y-2">
                {localPost.poll_options.map((option) => {
                  const total = localPost.poll_total_votes || localPost.poll_options?.reduce((sum, item) => sum + (item.votes || 0), 0) || 0;
                  const percent = total ? Math.round((option.votes / total) * 100) : 0;
                  const selected = localPost.poll_voted_option_id === option.id;
                  const hasVoted = Boolean(localPost.poll_voted_option_id);
                  return (
                    <button
                      key={option.id}
                      disabled={vote.isPending}
                      onClick={() => requireAuth() && vote.mutate(option.id)}
                      className={`relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all ${
                        selected
                          ? 'border-[#7C3AED] bg-purple-50/50 dark:bg-purple-950/20'
                          : hasVoted
                            ? 'border-gray-200/60 dark:border-zinc-800'
                            : 'border-purple-100 hover:border-purple-300 hover:bg-purple-50/30 dark:border-purple-900 dark:hover:border-purple-700'
                      } ${vote.isPending ? 'opacity-70' : ''}`}
                    >
                      {localPost.poll_results_visible ? <span className={`absolute inset-y-0 left-0 transition-all duration-500 ${selected ? 'bg-purple-200/60 dark:bg-purple-900/40' : 'bg-gray-100 dark:bg-zinc-800/40'}`} style={{ width: `${percent}%` }} /> : null}
                      <span className="relative flex items-center justify-between gap-3 text-sm font-black">
                        <span className="flex items-center gap-2">
                          {selected ? <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-[10px] text-white">✓</span> : null}
                          {option.text}
                        </span>
                        {localPost.poll_results_visible ? <span className="tabular-nums text-gray-500">{percent}%</span> : null}
                      </span>
                    </button>
                  );
                })}
                <p className="text-xs font-bold text-gray-400">{localPost.poll_total_votes || 0} {t('post.votes')}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-gray-100/80 pt-3 text-gray-500 dark:border-zinc-800/80">
              <Button variant="ghost" className="h-9 px-2.5" onClick={() => navigate(`/post/${localPost.id}`)} aria-label={t('post_page.open_comments')}>
                <MessageSquare size={17} /> <AnimatedNumber value={localPost.comments_count || 0} className="tabular-nums" /><span className="hidden sm:inline">{t('post.comm_short')}</span>
              </Button>
              <Button variant="ghost" className={`h-9 px-2.5 transition-transform ${localPost.liked ? 'text-red-500' : ''} ${likePulse ? 'scale-125' : ''}`} onClick={() => { requireAuth() && like.mutate(); hapticTap(); pulseFeedback(setLikePulse); }} aria-label={localPost.liked ? t('post.remove_like') : t('post.add_like')}>
                <Heart size={17} fill={localPost.liked ? 'currentColor' : 'none'} /> <AnimatedNumber value={localPost.likes_count || 0} className="tabular-nums" /><span className="hidden sm:inline">{t('post.like')}</span>
              </Button>
              <Button variant="ghost" className={`h-9 px-2.5 transition-transform ${localPost.reposted ? 'text-green-600' : ''} ${repostPulse ? 'scale-125' : ''}`} onClick={() => { if (!requireAuth()) return; if (localPost.reposted) { setConfirmUnrepost(true); } else { setRepostOpen(true); pulseFeedback(setRepostPulse); } }} aria-label={localPost.reposted ? t('post.remove_repost') : t('post.add_repost')}>
                <Repeat2 size={17} /> <AnimatedNumber value={localPost.reposts_count || 0} className="tabular-nums" /><span className="hidden sm:inline">{t('post.repost')}</span>
              </Button>
              <Button variant="ghost" className={`h-9 px-2.5 transition-transform ${localPost.saved ? 'text-blue-600' : ''} ${savePulse ? 'scale-125' : ''}`} onClick={() => { requireAuth() && (localPost.saved ? save.mutate(undefined) : setSaveOpen(true)); if (!localPost.saved) pulseFeedback(setSavePulse); }} aria-label={localPost.saved ? t('post.menu_unsave') : t('post.save')}>
                <Bookmark size={17} fill={localPost.saved ? 'currentColor' : 'none'} /> <AnimatedNumber value={localPost.saves_count || 0} className="tabular-nums" /><span className="hidden sm:inline">{t('post.saved_short')}</span>
              </Button>
              <Button variant="ghost" className="ml-auto h-9 px-2.5" onClick={handleShare} aria-label={t('post.share')}>
                <Share2 size={17} /> <span className="hidden sm:inline">{t('common.share')}</span>
              </Button>
            </div>
            {/* Reactions row */}
            <div className="px-1">
              <ReactionPicker
                postId={localPost.id}
                reactions={localPost.reactions || []}
                onUpdate={(reactions: ReactionItem[]) => setLocalPost((prev) => ({ ...prev, reactions }))}
                requireAuth={requireAuth}
              />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('post.delete_title')}
        description={t('post.delete_desc')}
        confirmText={t('post.delete_confirm')}
        onConfirm={performDelete}
        loading={remove.isPending}
      />
      <ConfirmDialog
        open={confirmHide}
        onClose={() => setConfirmHide(false)}
        title={t('post.hide_title')}
        description={t('post.hide_desc')}
        confirmText={t('post.hide_confirm')}
        onConfirm={() => { setConfirmHide(false); performHide(); }}
        loading={hide.isPending}
      />
      <ConfirmDialog
        open={confirmUnrepost}
        onClose={() => setConfirmUnrepost(false)}
        title="Удалить репост?"
        description="Это действие удалит ваш репост."
        confirmText="Удалить"
        onConfirm={() => {
          setConfirmUnrepost(false);
          repost.mutate(undefined);
        }}
      />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={(payload) => {
          api.reportPost(localPost.id, payload).then(() => {
            setReportOpen(false);
            toast.show({ title: t('post.report_sent'), tone: 'success' });
            onDeleted?.(localPost.id);
          });
        }}
      />
      <Modal open={repostOpen} onClose={() => setRepostOpen(false)} title={t('post.repost_title')}>
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-100 p-3 text-sm text-gray-500 dark:border-zinc-800">
            <p className="font-black text-gray-900 dark:text-zinc-100">{localPost.author?.display_name}</p>
            <p className="line-clamp-3">{localPost.text || t('post.type_media')}</p>
          </div>
          <Textarea value={repostText} onChange={(event) => setRepostText(event.target.value)} placeholder={t('post.repost_comment')} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => repost.mutate(undefined)} loading={repost.isPending}>{t('post.repost_quick')}</Button>
            <Button onClick={() => repost.mutate(repostText)} loading={repost.isPending}>{t('common.publish')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('post.menu_edit')}>
        <div className="space-y-3">
          <Textarea value={editText} onChange={(event) => setEditText(event.target.value)} />
          <Select value={commentsEnabled ? 'on' : 'off'} onChange={(event) => setCommentsEnabled(event.target.value === 'on')}>
            <option value="on">{t('post_composer.comments_enabled')}</option>
            <option value="off">{t('comment.disabled')}</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => update.mutate()} loading={update.isPending}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t('post.menu_send')}>
        <div className="relative space-y-3">
          <Input value={sendUsername} onChange={(event) => setSendUsername(event.target.value)} placeholder="@username" autoComplete="off" />
          {sendOpen && sendUsername.trim().length > 1 && userSearchQuery.isLoading ? (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> {t('common.loading')}</div>
            </div>
          ) : userSuggestions.length > 0 ? (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              {userSuggestions.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setSendUsername(u.username); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-900"
                >
                  <Avatar src={u.avatar_url} name={u.display_name} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{u.display_name}</p>
                    <p className="truncate text-xs text-gray-400">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!sendUsername.trim()}>{t('common.send')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title={t('saved.save_to_collection')}>
        <div className="space-y-3">
          <Select value={selectedCollection} onChange={(event) => setSelectedCollection(event.target.value)}>
            <option value="">{t('saved.all')}</option>
            {(collectionsQuery.data || []).map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder={t('saved.new_collection')} />
            <Button variant="outline" onClick={() => createCollection.mutate()} loading={createCollection.isPending} disabled={!newCollectionName.trim()}>{t('common.create')}</Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => save.mutate(selectedCollection || undefined)} loading={save.isPending}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title={t('post.menu_stats')}>
        <div className="grid grid-cols-2 gap-3">
          {[
            [t('profile.tab_likes'), localPost.likes_count],
            [t('comment.title'), localPost.comments_count],
            [t('profile.tab_reposts'), localPost.reposts_count],
            [t('saved.title'), localPost.saves_count],
          ].map(([label, value]) => (
            <div key={label} className="motion-control rounded-lg border border-gray-100 p-4 hover:-translate-y-0.5 hover:shadow-sm dark:border-zinc-800">
              <p className="text-xs font-black uppercase text-gray-400">{label}</p>
              <p className="text-2xl font-black"><AnimatedNumber value={String(value || 0)} /></p>
            </div>
          ))}
        </div>
      </Modal>
      <Modal open={notInterestedOpen} onClose={() => setNotInterestedOpen(false)} title={t('post.not_interested_title')}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('post.not_interested_desc')}</p>
          <Select value={notInterestedReason} onChange={(event) => setNotInterestedReason(event.target.value)}>
            <option value="boring">{t('post.not_interested_boring')}</option>
            <option value="offensive">{t('post.not_interested_offensive')}</option>
            <option value="repetitive">{t('post.not_interested_repetitive')}</option>
            <option value="irrelevant">{t('post.not_interested_irrelevant')}</option>
            <option value="other">{t('post.not_interested_other')}</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotInterestedOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              performHide();
              setNotInterestedOpen(false);
            }}>{t('common.send')}</Button>
          </div>
        </div>
      </Modal>

      {postContextMenuOpen && (
        <div className="motion-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" data-state="open" onClick={() => setPostContextMenuOpen(false)}>
          <div className="t-modal is-open w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-zinc-950 sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <button
                className="motion-control flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900"
                onClick={() => { localPost.saved ? save.mutate(undefined) : setSaveOpen(true); setPostContextMenuOpen(false); }}
              >
                <Bookmark size={16} /> {localPost.saved ? t('post.menu_unsave') : t('post.menu_save')}
              </button>
              <button
                className="motion-control flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900"
                onClick={() => { setConfirmHide(true); setPostContextMenuOpen(false); }}
              >
                <EyeOff size={16} /> {t('post.menu_hide')}
              </button>
              <button
                className="motion-control flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900"
                onClick={() => { handleShare(); setPostContextMenuOpen(false); }}
              >
                <Share2 size={16} /> {t('common.share')}
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900"
                onClick={() => { copyLink(); setPostContextMenuOpen(false); }}
              >
                <Copy size={16} /> {t('post.menu_copy')}
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => { setReportOpen(true); setPostContextMenuOpen(false); }}
              >
                <Flag size={16} /> {t('post.menu_report')}
              </button>
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-gray-100 py-3 text-sm font-bold dark:bg-zinc-800"
              onClick={() => setPostContextMenuOpen(false)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </article>
    </ErrorBoundary>
  );
}
