import { useState } from 'react';
import { Heart, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Comment } from '../../shared/types';
import { Avatar, Button, IconButton, Textarea } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../shared/i18n';
import { formatDistanceToNow } from 'date-fns';

const COMMENT_REACTIONS = ['😂', '🔥', '❤️'];

export function CommentItem({
  comment,
  postId,
  onReply,
}: {
  comment: Comment;
  postId: string;
  onReply: (comment: Comment) => void;
}) {
  const { user } = useAuthStore();
  const { t, dateLocale } = useTranslation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [likePulse, setLikePulse] = useState(false);
  const [quickReaction, setQuickReaction] = useState<string | null>(null);
  const isRemoved = comment.is_deleted || comment.hidden_by_moderator;
  const canManage = !isRemoved && (user?.id === comment.author_id || user?.role === 'global_admin' || user?.role === 'admin');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['comments', postId] });
  const like = useMutation({ mutationFn: () => api.likeComment(comment.id, comment.liked), onSuccess: invalidate });
  const update = useMutation({ mutationFn: () => api.updateComment(comment.id, text), onSuccess: () => { setEditing(false); invalidate(); } });
  const remove = useMutation({ mutationFn: () => api.deleteComment(comment.id), onSuccess: invalidate });

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
                  {COMMENT_REACTIONS.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      aria-pressed={quickReaction === reaction}
                      onClick={() => setQuickReaction((current) => (current === reaction ? null : reaction))}
                      className={`h-11 w-11 rounded-lg text-lg font-black transition-colors ${
                        quickReaction === reaction
                          ? 'bg-orange-100 text-[#FF6B00] dark:bg-orange-950/40'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      {reaction}
                    </button>
                  ))}
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
                <IconButton label={t('comment.delete')} onClick={() => remove.mutate()}>
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
              <CommentItem key={reply.id} comment={reply} postId={postId} onReply={onReply} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
