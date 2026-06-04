import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Flag, Heart, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Comment, ReactionItem } from '../../shared/types';
import { Avatar, Button, ConfirmDialog, IconButton, ReportDialog, Textarea, useToast } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../shared/i18n';
import { formatDistanceToNow } from 'date-fns';
import { redirectToLogin } from '../../utils/authRedirect';

const COMMENT_REACTIONS = ['😂', '🔥', '❤️'];

export function CommentItem({
  comment,
  postId,
  onReply,
  highlight = false,
}: {
  comment: Comment;
  postId: string;
  onReply: (comment: Comment) => void;
  highlight?: boolean;
}) {
  const { user } = useAuthStore();
  const { t, dateLocale } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [likePulse, setLikePulse] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const isRemoved = comment.is_deleted || comment.hidden_by_moderator;
  const canManage = !isRemoved && (user?.id === comment.author_id || user?.role === 'global_admin' || user?.role === 'admin');

  const initialReactions = comment.reactions || [];
  const [reactions, setReactions] = useState<ReactionItem[]>(initialReactions);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['comments', postId] });
  const like = useMutation({ mutationFn: () => api.likeComment(comment.id, comment.liked), onSuccess: invalidate });
  const update = useMutation({ mutationFn: () => api.updateComment(comment.id, text), onSuccess: () => { setEditing(false); invalidate(); } });

  useEffect(() => {
    setText(comment.text);
    setReactions(comment.reactions || []);
  }, [comment.id, comment.reactions, comment.text]);

  const remove = useMutation({
    mutationFn: () => api.deleteComment(comment.id),
    onSuccess: () => {
      invalidate();
      toast.show({
        title: 'Комментарий удалён',
        tone: 'success',
        duration: 5000,
        action: {
          label: 'Отменить',
          onClick: () => {
            api.restoreComment(comment.id).then(() => {
              invalidate();
              toast.show({ title: 'Комментарий восстановлен', tone: 'success' });
            }).catch(() => {
              toast.show({ title: 'Не удалось восстановить', tone: 'error' });
            });
          },
        },
      });
    },
  });

  const reactComment = useMutation({
    mutationFn: (emoji: string) => {
      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing?.reacted) return api.unreactComment(comment.id, emoji);
      return api.reactComment(comment.id, emoji);
    },
    onMutate: (emoji) => {
      const previous = reactions;
      setReactions((prev) => {
        const existing = prev.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.reacted) {
            const nextCount = existing.count - 1;
            if (nextCount <= 0) return prev.filter((r) => r.emoji !== emoji);
            return prev.map((r) => (r.emoji === emoji ? { ...r, count: nextCount, reacted: false } : r));
          }
          return prev.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r));
        }
        return [...prev, { emoji, count: 1, reacted: true }];
      });
      return { previous };
    },
    onError: (_err, _emoji, context) => {
      if (context?.previous) setReactions(context.previous);
    },
    onSuccess: (data) => {
      setReactions(data.reactions);
    },
  });

  const startLongPress = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setContextMenuOpen(true);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    startLongPress();
  }, [startLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      cancelLongPress();
    }
  }, [cancelLongPress]);

  const handleTouchEnd = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuOpen(true);
  }, []);

  const handleReport = (payload: { reason: string; description?: string }) => {
    api.report({ target_type: 'comment', target_id: comment.id, reason: payload.reason, description: payload.description }).then(() => {
      setReportOpen(false);
      toast.show({ title: t('post.report_sent'), tone: 'success' });
    }).catch(() => {
      toast.show({ title: t('post.reaction_error'), tone: 'error' });
    });
  };
  const reactionOptions = Array.from(new Set([...COMMENT_REACTIONS, ...reactions.map((reaction) => reaction.emoji)]));

  return (
    <div
      id={`comment-${comment.id}`}
      className={`rounded-lg border bg-white p-4 transition-colors duration-700 dark:bg-zinc-950 ${highlight ? 'border-[#7C3AED]/60 ring-2 ring-[#7C3AED]/30 dark:border-[#A78BFA]/60 dark:ring-[#A78BFA]/30' : 'border-gray-100 dark:border-zinc-800'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <div className="flex gap-3">
        <Avatar src={comment.author.avatar_url} name={comment.author.display_name} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{comment.author.display_name}</p>
            <p className="text-xs font-bold text-gray-400">@{comment.author.username}</p>
            <p className="text-xs text-gray-400">· {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: dateLocale })}</p>
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <Textarea value={text} onChange={(event) => setText(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>{t('comment.cancel')}</Button>
                <Button onClick={() => update.mutate()} loading={update.isPending}>{t('comment.save')}</Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-zinc-100">{comment.text || t('comment.deleted')}</p>
          )}
          <div className="mt-2 flex items-center gap-1 text-gray-400">
            {!isRemoved ? (
              <>
                <Button variant="ghost" className={`h-8 px-2 transition-transform ${likePulse ? 'scale-125' : ''} ${comment.liked ? 'text-red-500' : ''}`} onClick={() => { like.mutate(); setLikePulse(true); setTimeout(() => setLikePulse(false), 300); }}>
                  <Heart size={15} fill={comment.liked ? 'currentColor' : 'none'} /> {comment.likes_count}
                </Button>
                <Button variant="ghost" className="h-8 px-2" onClick={() => onReply(comment)}>
                  <MessageSquare size={15} /> {t('comment.reply')}
                </Button>
                <div className="hidden items-center gap-1 sm:flex">
                  {reactionOptions.map((reaction) => {
                    const r = reactions.find((item) => item.emoji === reaction);
                    const reacted = Boolean(r?.reacted);
                    return (
                      <button
                        key={reaction}
                        type="button"
                        aria-pressed={reacted}
                        onClick={() => {
                          if (!user) {
                            redirectToLogin();
                            return;
                          }
                          reactComment.mutate(reaction);
                        }}
                        className={`h-11 w-11 rounded-lg text-lg font-black transition-colors ${
                          reacted
                            ? 'bg-orange-100 text-[#FF6B00] dark:bg-orange-950/40'
                            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        {reaction}{r?.count ? <span className="ml-1 align-middle text-[10px]">{r.count}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            {comment.replies.length ? (
              <Button variant="ghost" className="h-8 px-2" onClick={() => setCollapsed((value) => !value)}>
                {collapsed ? t('comment.show_thread') : t('comment.hide_thread')}
              </Button>
            ) : null}
            {canManage ? (
              <>
                <IconButton label={t('comment.edit')} onClick={() => setEditing(true)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton label={t('comment.delete')} onClick={() => setConfirmDeleteOpen(true)}>
                  <Trash2 size={15} />
                </IconButton>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {comment.replies.length ? (
        <div className={`mt-3 flex gap-0 transition-all duration-300 ${collapsed ? 'max-h-0 overflow-hidden opacity-0' : 'max-h-[9999px] opacity-100'}`}>
          {/* Clickable thread line */}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="group/line flex w-5 shrink-0 cursor-pointer justify-center pt-1"
            aria-label={t('comment.hide_thread')}
            title={t('comment.hide_thread')}
          >
            <div className="h-full w-0.5 rounded-full bg-purple-200 transition-colors group-hover/line:bg-purple-500 dark:bg-purple-900 dark:group-hover/line:bg-purple-400" />
          </button>
          <div className="min-w-0 flex-1 space-y-3 pl-1">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} postId={postId} onReply={onReply} highlight={highlight} />
            ))}
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Удалить комментарий?"
        description="Это действие нельзя отменить."
        confirmText="Удалить"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          remove.mutate();
        }}
      />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReport}
      />
      {contextMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 animate-in fade-in duration-200 sm:items-center sm:p-4" onClick={() => setContextMenuOpen(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-zinc-950 sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900"
                onClick={() => { onReply(comment); setContextMenuOpen(false); }}
              >
                <MessageSquare size={16} /> {t('comment.reply')}
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900"
                onClick={() => { navigator.clipboard.writeText(comment.text); toast.show({ title: t('post.menu_copy'), tone: 'success' }); setContextMenuOpen(false); }}
              >
                <Copy size={16} /> {t('post.menu_copy')}
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => { setReportOpen(true); setContextMenuOpen(false); }}
              >
                <Flag size={16} /> {t('post.menu_report')}
              </button>
              {canManage ? (
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => { setConfirmDeleteOpen(true); setContextMenuOpen(false); }}
                >
                  <Trash2 size={16} /> {t('comment.delete')}
                </button>
              ) : null}
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-gray-100 py-3 text-sm font-bold dark:bg-zinc-800"
              onClick={() => setContextMenuOpen(false)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
