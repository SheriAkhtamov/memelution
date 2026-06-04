import { useRef, useState } from 'react';
import { Check, Copy, Edit3, Forward, Loader2, MoreHorizontal, Reply, Trash2, X } from 'lucide-react';
import type { Message } from '../../shared/types';
import { Button, Dropdown, DropdownItem } from '../../shared/ui';
import { hapticTap } from '../../utils/haptic';
import { useTranslation } from '../../shared/i18n';

type BubbleActions = {
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onCopy: () => void;
};

type DisplayMessage = Message & {
  status?: 'pending' | 'failed';
  reactions?: Array<{ emoji: string; count: number; reacted?: boolean }>;
  readAt?: string | null;
};

const REACTION_EMOJIS = ['❤️', '👍', '😂'];

export function MessageBubble({
  message,
  mine,
  editing,
  editText,
  onEditChange,
  onEditSave,
  onEditCancel,
  actions,
  repliedMessage,
  onRetry,
  onReact,
}: {
  message: DisplayMessage;
  mine: boolean;
  editing?: boolean;
  editText?: string;
  onEditChange?: (value: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  actions?: BubbleActions;
  repliedMessage?: { id: string; text: string; sender: string } | null;
  onRetry?: () => void;
  onReact?: (emoji: string, reacted?: boolean) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const { t } = useTranslation();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe-to-reply state
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);
  const swipeTriggered = useRef(false);
  const SWIPE_THRESHOLD = 60;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = true;
    swipeTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      swiping.current = false;
      setShowMenu(true);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!swiping.current) return;

    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    const dx = e.touches[0].clientX - touchStartX.current;

    // If vertical scroll dominates, cancel swipe
    if (dy > Math.abs(dx) + 10) {
      swiping.current = false;
      setSwipeX(0);
      return;
    }

    // For own messages swipe left (negative), for others swipe right (positive)
    const direction = mine ? Math.min(0, dx) : Math.max(0, dx);
    const clamped = mine
      ? Math.max(-100, direction)
      : Math.min(100, direction);
    setSwipeX(clamped);

    // Haptic feedback when crossing threshold
    if (Math.abs(clamped) >= SWIPE_THRESHOLD && !swipeTriggered.current) {
      swipeTriggered.current = true;
      hapticTap();
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (Math.abs(swipeX) >= SWIPE_THRESHOLD && actions) {
      actions.onReply();
    }
    swiping.current = false;
    swipeTriggered.current = false;
    setSwipeX(0);
  };

  const isVideo = /\.(mp4|mov|webm)($|\?)/i.test(message.media_url || '');
  const displayText = message.is_deleted ? t('messages.deleted') : message.text;
  const replyMsg = repliedMessage || null;
  const showSwipeIcon = Math.abs(swipeX) > 15;
  const reactionOptions = Array.from(new Set([...REACTION_EMOJIS, ...(message.reactions || []).map((reaction) => reaction.emoji)]));

  return (
    <div
      className={`motion-message-enter group relative flex ${mine ? 'justify-end' : 'justify-start'}`}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe-to-reply icon behind bubble */}
      {showSwipeIcon && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition-opacity ${
            Math.abs(swipeX) >= SWIPE_THRESHOLD ? 'bg-[#2AABEE] text-white' : 'bg-gray-200 text-gray-400 dark:bg-zinc-700 dark:text-zinc-400'
          } ${mine ? 'left-2' : 'right-2'}`}
          style={{ opacity: Math.min(1, Math.abs(swipeX) / SWIPE_THRESHOLD) }}
        >
          <Reply size={16} />
        </div>
      )}

      <div
        className={`relative max-w-[78%] ${mine ? 'order-1' : ''}`}
        style={{
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipeX ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {!mine && message.sender && (
          <p className="mb-1 ml-1 text-xs font-black text-[#7C3AED]">{message.sender.display_name}</p>
        )}

        {editing ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-md ring-2 ring-[#2AABEE] dark:bg-zinc-900">
            <textarea
              value={editText}
              onChange={(e) => onEditChange?.(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-900 focus:border-[#2AABEE] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') onEditCancel?.();
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onEditSave?.();
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">{editText?.length || 0} / 500</span>
              <div className="flex gap-1.5">
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={onEditCancel}>{t('common.cancel')}</Button>
                <Button className="h-8 px-3 text-xs" onClick={onEditSave} disabled={!editText?.trim()}>
                  <Check size={14} /> {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-3 shadow-sm transition-all duration-300 ${
            message.status === 'pending' ? 'scale-[0.98] opacity-80' : 'scale-100 opacity-100'
          } ${
            message.is_deleted
              ? 'bg-gray-100 text-gray-400 italic dark:bg-zinc-900/50 dark:text-zinc-500'
              : mine
                ? 'bg-[#2AABEE] text-white'
                : 'bg-white text-gray-900 dark:bg-zinc-900 dark:text-zinc-100'
          }`}>
            {replyMsg && (
              <div className={`rounded-xl border-l-3 px-3 py-2 text-xs ${mine ? 'border-white/40 bg-white/15' : 'border-[#2AABEE] bg-gray-50 dark:bg-zinc-800'}`}>
                <span className={`block font-black ${mine ? 'text-white/50' : 'text-[#2AABEE]'}`}>{replyMsg.sender}</span>
                <span className="line-clamp-1 opacity-75">{replyMsg.text || t('messages.media_fallback')}</span>
              </div>
            )}

            {message.media_url && !message.is_deleted ? (
              isVideo ? (
                <video src={message.media_url} className="mb-2 max-h-64 rounded-xl bg-black" controls preload="metadata" />
              ) : (
                <img src={message.media_url} alt="" className="mb-2 max-h-64 rounded-xl object-contain" />
              )
            ) : null}

            {message.shared_post_id && !message.is_deleted ? (
              <a href={`/post/${message.shared_post_id}`} className={`mb-2 block rounded-xl px-3 py-2 text-sm font-black ${mine ? 'bg-white/15' : 'bg-black/5 dark:bg-white/5'}`}>
                <span className="block text-xs opacity-70">{t('messages.post')}</span>
                {message.shared_post?.text ? <span className="line-clamp-2">{message.shared_post.text}</span> : t('messages.open_post')}
              </a>
            ) : null}

            <p className="whitespace-pre-wrap break-words leading-relaxed">{displayText || ''}</p>

            <div className={`mt-1 flex items-center gap-2 text-[10px] ${mine ? 'text-white/75' : 'text-gray-400 dark:text-zinc-500'}`}>
              <span>{new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}{message.edited_at ? ` · ${t('messages.edited')}` : ''}</span>
              {mine && !message.is_deleted && !editing && (
                <span className="flex items-center gap-0.5">
                  {message.status === 'pending' && <Loader2 size={10} className="animate-spin" />}
                  {message.status === 'failed' && (
                    <button onClick={onRetry} className="text-[10px] font-bold text-red-500 underline hover:text-red-600">
                      {t('messages.retry') || 'Retry'}
                    </button>
                  )}
                  {!message.status && (
                    <>
                      {message.read_count || message.readAt ? (
                        <span className="flex items-center text-white/90">
                          <Check size={10} strokeWidth={3} />
                          <Check size={10} strokeWidth={3} className="-ml-1" />
                        </span>
                      ) : (
                        <span className="flex items-center text-white/60">
                          <Check size={10} strokeWidth={3} />
                          <Check size={10} strokeWidth={3} className="-ml-1" />
                        </span>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {!editing && !message.is_deleted && onReact ? (
          <div className={`mt-1 flex flex-wrap items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
            {reactionOptions.map((emoji) => {
              const reaction = message.reactions?.find((item) => item.emoji === emoji);
              const reacted = Boolean(reaction?.reacted);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(emoji, reacted)}
                  data-active={reacted}
                  className={`motion-pop motion-control min-h-[28px] min-w-[28px] select-none rounded-full px-2 py-1 text-xs font-bold ${
                    reacted
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : reaction
                        ? 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200'
                        : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                  aria-pressed={reacted}
                  aria-label={`Reaction ${emoji}`}
                >
                  {emoji}{reaction?.count ? ` ${reaction.count}` : ''}
                </button>
              );
            })}
          </div>
        ) : null}

        {actions && !message.is_deleted && !editing && (
          <div className={`absolute top-20 ${mine ? '-left-8' : '-right-8'}`}>
            <Dropdown trigger={
              <button className={`rounded-full p-1 transition-opacity bg-white shadow-md hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <MoreHorizontal size={14} className="text-gray-500" />
              </button>
            }>
              {mine && (
                <>
                  <DropdownItem onClick={() => { setShowMenu(false); actions.onEdit(); }}>
                    <Edit3 size={14} /> {t('messages.context_edit')}
                  </DropdownItem>
                  <DropdownItem danger onClick={() => { setShowMenu(false); actions.onDelete(); }}>
                    <Trash2 size={14} /> {t('messages.context_delete')}
                  </DropdownItem>
                </>
              )}
              <DropdownItem onClick={() => { setShowMenu(false); actions.onReply(); }}>
                <Reply size={14} /> {t('messages.context_reply')}
              </DropdownItem>
              <DropdownItem onClick={() => { setShowMenu(false); actions.onForward(); }}>
                <Forward size={14} /> {t('messages.context_forward')}
              </DropdownItem>
              <DropdownItem onClick={() => { setShowMenu(false); actions.onCopy(); }}>
                <Copy size={14} /> {t('messages.context_copy')}
              </DropdownItem>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageRepliedPreview({ replyTo, onCancel }: { replyTo: { id: string; text: string; sender: string } | null; onCancel: () => void }) {
  const { t } = useTranslation();
  if (!replyTo) return null;
  return (
    <div className="t-panel-slide flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900" data-open="true">
      <div className="min-w-0 flex-1 border-l-3 border-[#2AABEE] pl-3">
        <p className="text-xs font-black text-[#2AABEE]">{replyTo.sender}</p>
        <p className="line-clamp-1 text-xs text-gray-500">{replyTo.text || t('messages.media_fallback')}</p>
      </div>
      <button onClick={onCancel} className="rounded-full p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
        <X size={14} />
      </button>
    </div>
  );
}
