import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, CornerDownRight, MessageCircle, Send, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Comment } from '../../shared/types';
import { Button, EmptyState, ErrorState, Skeleton, Tabs, Textarea, useToast } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { CommentItem } from '../../features/comments/CommentItem';
import { useAuthStore } from '../../store/authStore';
import { redirectToLogin } from '../../utils/authRedirect';
import { useTranslation } from '../../shared/i18n';
import { trackEvent } from '../../shared/lib/analytics';

type Sort = 'popular' | 'new' | 'old';
const MAX_COMMENT_LEN = 500;

export function PostPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [sort, setSort] = useState<Sort>('popular');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const postQuery = useQuery({ queryKey: ['post', id], queryFn: () => api.post(id), enabled: Boolean(id) });
  const commentsQuery = useQuery({
    queryKey: ['comments', id, sort],
    queryFn: () => api.comments(id, sort),
    enabled: Boolean(id),
  });

  const commentMutation = useMutation({
    mutationFn: () => api.comment(id, text, replyTo?.id),
    onMutate: async () => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['comments', id, sort] });
      const previous = queryClient.getQueryData(['comments', id, sort]);
      const optimistic: Comment = {
        id: `temp-${Date.now()}`,
        post_id: id,
        author_id: user.id,
        parent_comment_id: replyTo?.id,
        text,
        likes_count: 0,
        is_deleted: false,
        hidden_by_moderator: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: user,
        liked: false,
        replies: [],
      };
      queryClient.setQueryData(['comments', id, sort], (current: { items: Comment[] } | undefined) => ({
        ...(current || { items: [] }),
        items: replyTo ? current?.items || [] : [optimistic, ...(current?.items || [])],
      }));
      return { previous };
    },
    onSuccess: () => {
      trackEvent('meme_commented', {
        post_id: id,
        parent_comment_id: replyTo?.id || null,
        is_reply: Boolean(replyTo),
      });
      setText('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
    onError: (event, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['comments', id, sort], context.previous);
      toast.show({ title: event instanceof Error ? event.message : t('comment.send_error'), tone: 'error' });
    },
  });

  const submit = () => {
    if (!user) {
      redirectToLogin();
      return;
    }
    if (!text.trim()) return;
    commentMutation.mutate();
  };

  useEffect(() => {
    if (replyTo) commentRef.current?.focus();
  }, [replyTo]);

  useEffect(() => () => {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
  }, []);

  const scrollToComment = (commentId: string) => {
    const el = document.getElementById(`comment-${commentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedCommentId(commentId);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedCommentId(null), 1800);
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  if (postQuery.isLoading) {
    return (
      <div className="p-3 sm:p-4">
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (postQuery.isError || !postQuery.data?.post) {
    return (
      <div className="p-3 sm:p-4">
        <ErrorState description={postQuery.error instanceof Error ? postQuery.error.message : t('post_page.not_found')} onRetry={() => postQuery.refetch()} />
      </div>
    );
  }

  return (
    <div>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#F3F4F6]/90 px-3 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <button onClick={goBack} className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-zinc-900" aria-label={t('post_page.back')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black">{t('post_page.title')}</h1>
      </header>
      <div className="space-y-6 p-3 sm:p-4">
        <PostCard
          post={postQuery.data.post}
          onChanged={(post) => queryClient.setQueryData(['post', id], (current: typeof postQuery.data | undefined) => (current ? { ...current, post } : current))}
        />
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-black"><MessageCircle size={18} className="text-[#FF6B00]" /> Написать комментарий</h2>
            {replyTo ? (
              <button
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setReplyTo(null)}
              >
                <X size={13} /> Отменить ответ
              </button>
            ) : null}
          </div>
          {replyTo ? (
            <p className="mb-2 flex items-center gap-1 text-xs font-black text-[#7C3AED] dark:text-[#A78BFA]">
              <CornerDownRight size={12} />
              <span>{t('post_page.reply_to', { author: replyTo.author.username })}</span>
              <button
                type="button"
                onClick={() => scrollToComment(replyTo.id)}
                className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-[#7C3AED] underline-offset-2 hover:underline dark:text-[#A78BFA]"
                title={t('post_page.jump_to_comment')}
              >
                <ArrowUp size={10} /> {t('post_page.jump')}
              </button>
            </p>
          ) : null}
          <div className="relative">
            <Textarea
              ref={commentRef}
              value={text}
              maxLength={MAX_COMMENT_LEN}
              onChange={(event) => setText(event.target.value.slice(0, MAX_COMMENT_LEN))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setReplyTo(null);
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && text.trim()) submit();
              }}
              placeholder={postQuery.data.post.comments_enabled === false ? t('comment.disabled') : t('comment.placeholder')}
              disabled={postQuery.data.post.comments_enabled === false}
              aria-describedby="comment-counter"
            />
            <div id="comment-counter" className="mt-1 flex items-center justify-between text-[10px] font-bold">
              <span className="text-gray-300 dark:text-zinc-600">Ctrl+Enter</span>
              <span className={`tabular-nums ${text.length >= MAX_COMMENT_LEN ? 'text-amber-500' : 'text-gray-300 dark:text-zinc-600'}`} aria-live="polite">
                {text.length}/{MAX_COMMENT_LEN}
              </span>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} loading={commentMutation.isPending} disabled={postQuery.data.post.comments_enabled === false}>
              <Send size={16} /> {t('comment.send')}
            </Button>
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">{t('comment.title')}</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="hidden h-9 px-2 sm:inline-flex" onClick={() => commentRef.current?.focus()}>
                <MessageCircle size={15} /> Написать
              </Button>
              <Tabs
                value={sort}
                onChange={(value) => setSort(value as Sort)}
                items={[
                  { id: 'popular', label: t('comment.sort_popular') },
                  { id: 'new', label: t('comment.sort_new') },
                  { id: 'old', label: t('comment.sort_old') },
                ]}
              />
            </div>
          </div>
          {commentsQuery.isLoading ? (
            <Skeleton className="h-32" />
          ) : commentsQuery.data?.items.length ? (
            <div className="space-y-3">
              {commentsQuery.data.items.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  postId={id}
                  onReply={setReplyTo}
                  highlight={highlightedCommentId === comment.id || comment.replies.some((reply) => highlightedCommentId === reply.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('comment.empty_title')}
              description={t('comment.empty_desc')}
              action={<Button onClick={() => commentRef.current?.focus()}><MessageCircle size={16} /> Написать комментарий</Button>}
            />
          )}
        </section>
        {postQuery.data.related?.length ? (
          <section className="space-y-4">
            <h2 className="text-lg font-black">{t('post_page.related')}</h2>
            <div className="space-y-4">
              {postQuery.data.related.map((post) => (
                <PostCard key={post.id} post={post} compact />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
