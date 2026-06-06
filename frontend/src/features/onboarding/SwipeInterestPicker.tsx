import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../../shared/i18n';

const INTEREST_EMOJIS: Record<string, string> = {
  мемы: '😂',
  айти: '💻',
  учёба: '📚',
  работа: '💼',
  игры: '🎮',
  кино: '🎬',
  музыка: '🎵',
  спорт: '⚽',
  город: '🏙️',
  авто: '🚗',
  дедлайны: '⏰',
  котики: '🐱',
};

/**
 * Tinder-style interest picker for onboarding.
 * Swipe right = select, swipe left = skip.
 */
export function SwipeInterestPicker({
  options,
  selected,
  onChange,
  onComplete,
}: {
  options: string[];
  selected: string[];
  onChange: (interests: string[]) => void;
  onComplete?: () => void;
}) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  const THRESHOLD = 80;
  const remaining = options.filter((_, i) => i >= currentIndex);
  const current = remaining[0];

  const handleDecision = useCallback(
    (direction: 'left' | 'right') => {
      if (!current) return;
      setExiting(direction);
      setTimeout(() => {
        if (direction === 'right') {
          onChange([...selected, current]);
        }
        setCurrentIndex((i) => i + 1);
        setExiting(null);
        setDragX(0);
      }, 250);
    },
    [current, onChange, selected],
  );

  const handleSkip = useCallback(() => {
    const final = selected.length > 0 ? selected : ['мемы'];
    onChange(final);
    onComplete?.();
  }, [onChange, onComplete, selected]);

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-white to-gray-50/50 p-8 text-center dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/50">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-black">{t('onboarding.complete')}</p>
        <p className="text-sm text-gray-500">{t('onboarding.selected', { selected: selected.length, total: options.length })}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {selected.map((s) => (
            <span key={s} className="rounded-lg bg-orange-50 px-3 py-1 text-sm font-black text-[#FF6B00] dark:bg-orange-950/30">
              {INTEREST_EMOJIS[s] || '✨'} {s}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const exitTransform = exiting === 'left' ? 'translateX(-120%) rotate(-15deg)' : exiting === 'right' ? 'translateX(120%) rotate(15deg)' : undefined;
  const rotation = dragX * 0.1;
  const opacity = Math.max(0.3, 1 - Math.abs(dragX) / 300);

  return (
    <div className="relative flex flex-col items-center">
      {/* Instruction */}
      <div className="mb-4 flex items-center gap-6 text-xs font-black text-gray-400">
        <span className="flex items-center gap-1">{t('onboarding.skip')}</span>
        <span className="flex items-center gap-1">{t('onboarding.choose')}</span>
      </div>

      {/* Card stack */}
      <div className="relative h-48 w-64">
        {/* Background card (next) */}
        {remaining[1] && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950" style={{ transform: 'scale(0.95)', opacity: 0.5 }}>
            <span className="text-4xl">{INTEREST_EMOJIS[remaining[1]] || '✨'}</span>
            <span className="mt-2 text-lg font-black capitalize">{remaining[1]}</span>
          </div>
        )}

        {/* Active card */}
        <div
          className="absolute inset-0 flex cursor-grab flex-col items-center justify-center rounded-xl border-2 bg-white shadow-lg transition-shadow active:cursor-grabbing active:shadow-xl dark:bg-zinc-950"
          style={{
            transform: exiting ? exitTransform : `translateX(${dragX}px) rotate(${rotation}deg)`,
            transition: exiting || !dragging.current ? 'transform 250ms ease-out, opacity 250ms' : 'none',
            opacity: exiting ? 0 : opacity,
            borderColor: dragX > 30 ? '#22c55e' : dragX < -30 ? '#ef4444' : '#e5e7eb',
          }}
          onTouchStart={(e) => {
            startX.current = e.touches[0].clientX;
            startY.current = e.touches[0].clientY;
            dragging.current = true;
          }}
          onTouchMove={(e) => {
            if (!dragging.current) return;
            const dy = Math.abs(e.touches[0].clientY - startY.current);
            const dx = e.touches[0].clientX - startX.current;
            if (dy > Math.abs(dx) + 20) {
              dragging.current = false;
              setDragX(0);
              return;
            }
            setDragX(dx);
          }}
          onTouchEnd={() => {
            dragging.current = false;
            if (dragX > THRESHOLD) handleDecision('right');
            else if (dragX < -THRESHOLD) handleDecision('left');
            else setDragX(0);
          }}
          onMouseDown={(e) => {
            startX.current = e.clientX;
            dragging.current = true;
          }}
          onMouseMove={(e) => {
            if (!dragging.current) return;
            setDragX(e.clientX - startX.current);
          }}
          onMouseUp={() => {
            dragging.current = false;
            if (dragX > THRESHOLD) handleDecision('right');
            else if (dragX < -THRESHOLD) handleDecision('left');
            else setDragX(0);
          }}
          onMouseLeave={() => {
            if (dragging.current) {
              dragging.current = false;
              setDragX(0);
            }
          }}
        >
          {/* Like/Dislike labels */}
          {dragX > 30 && (
            <span className="absolute left-4 top-4 rounded-lg border-2 border-green-500 px-3 py-1 text-sm font-black text-green-500" style={{ opacity: Math.min(1, (dragX - 30) / 50) }}>
              {t('onboarding.like')}
            </span>
          )}
          {dragX < -30 && (
            <span className="absolute right-4 top-4 rounded-lg border-2 border-red-500 px-3 py-1 text-sm font-black text-red-500" style={{ opacity: Math.min(1, (-dragX - 30) / 50) }}>
              {t('onboarding.pass')}
            </span>
          )}

          <span className="text-5xl">{INTEREST_EMOJIS[current] || '✨'}</span>
          <span className="mt-3 text-xl font-black capitalize">{current}</span>
          <span className="mt-1 text-xs text-gray-400">{currentIndex + 1} / {options.length}</span>
        </div>
      </div>

      {/* Button fallback for desktop */}
      <div className="mt-5 flex gap-3">
        <button
          onClick={() => handleDecision('left')}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-200 text-red-500 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
          aria-label={t('onboarding.skip_aria')}
        >
          ✕
        </button>
        <button
          onClick={() => handleDecision('right')}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-200 text-green-500 transition-colors hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-950/30"
          aria-label={t('onboarding.choose_aria')}
        >
          ♥
        </button>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {selected.map((s) => (
            <span key={s} className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-black text-[#FF6B00] dark:bg-orange-950/30">
              {INTEREST_EMOJIS[s] || '✨'} {s}
            </span>
          ))}
        </div>
      )}

      {/* Skip remaining */}
      {current && currentIndex >= 3 && (
        <button
          onClick={handleSkip}
          className="mt-4 text-xs font-bold text-gray-400 underline decoration-dashed underline-offset-2 transition-colors hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          {t('onboarding.skip_rest')}
        </button>
      )}
    </div>
  );
}
