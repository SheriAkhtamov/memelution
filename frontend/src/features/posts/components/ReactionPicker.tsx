import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { hapticTap } from '../../../utils/haptic';
import { useToast } from '../../../shared/ui';
import { useTranslation } from '../../../shared/i18n';

const REACTIONS = ['😂', '❤️', '🔥', '😢', '😡', '👏', '💀', '🤡'];
const REACTION_LABELS: Record<string, string> = {
  '😂': 'joy',
  '❤️': 'love',
  '🔥': 'fire',
  '😢': 'cry',
  '😡': 'angry',
  '👏': 'clap',
  '💀': 'skull',
  '🤡': 'clown',
};

type ReactionItem = { emoji: string; count: number; reacted: boolean };

/**
 * Compact reaction picker that opens a popover with emoji options.
 * Shows existing reactions as chips below the post actions bar.
 */
export function ReactionPicker({
  postId,
  reactions,
  onUpdate,
  requireAuth,
}: {
  postId: string;
  reactions: ReactionItem[];
  onUpdate: (reactions: ReactionItem[]) => void;
  requireAuth: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const react = useMutation({
    mutationFn: (emoji: string) => {
      const current = reactions.find((r) => r.emoji === emoji);
      if (current?.reacted) return api.unreactPost(postId, emoji);
      return api.reactPost(postId, emoji);
    },
    onSuccess: (data) => {
      onUpdate(data.reactions);
      hapticTap();
    },
    onError: () => {
      toast?.show?.({ title: t('post.reaction_error'), tone: 'error' });
    },
  });

  const handlePick = (emoji: string) => {
    if (!requireAuth()) return;
    react.mutate(emoji);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Existing reactions as chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {reactions.filter((r) => r.count > 0).map((r) => (
          <button
            key={r.emoji}
            onClick={() => handlePick(r.emoji)}
            aria-pressed={r.reacted}
            aria-label={t(`post.reaction_${REACTION_LABELS[r.emoji] || 'react'}`, { emoji: r.emoji, count: r.count })}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-black transition-all ${
              r.reacted
                ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <span aria-hidden>{r.emoji}</span>
            <span className="tabular-nums" aria-hidden>{r.count}</span>
          </button>
        ))}

        {/* Add reaction button */}
        <button
          onClick={() => {
            if (!requireAuth()) return;
            setOpen(!open);
          }}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('post.reaction_add')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-gray-300 text-xs text-gray-400 transition-colors hover:border-[#FF6B00] hover:text-[#FF6B00] dark:border-zinc-600 dark:hover:border-[#FF6B00]"
        >
          +
        </button>
      </div>

      {/* Picker popover */}
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label={t('ui.close_menu')} onClick={() => setOpen(false)} />
          <div role="menu" aria-label={t('post.reaction_picker')} className="absolute bottom-8 left-0 z-50 flex gap-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                role="menuitem"
                onClick={() => handlePick(emoji)}
                aria-label={t(`post.reaction_${REACTION_LABELS[emoji] || 'react'}`, { emoji, count: 0 })}
                className="rounded-lg p-2.5 min-w-11 min-h-11 text-lg transition-transform hover:scale-125 hover:bg-gray-100 active:scale-95 dark:hover:bg-zinc-800"
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
