import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { useTranslation } from '../i18n';
import { IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}

export function Modal({ open, title, children, onClose, className }: ModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const presence = useAnimatedPresence(open, 170);

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', listener);
    const prev = document.activeElement as HTMLElement;
    window.setTimeout(() => modalRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus(), 50);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', listener);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [onClose, open]);

  if (!presence.mounted) return null;

  return createPortal(
    <div
      className="motion-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      data-state={presence.state}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button className="absolute inset-0 cursor-default focus:outline-none" aria-label={t('common.close')} onClick={onClose} />
      <section
        ref={modalRef}
        className={cn(
          't-modal relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-card border border-border shadow-2xl transition-all sm:max-w-2xl sm:rounded-xl',
          presence.state === 'open' && 'is-open',
          presence.state === 'closing' && 'is-closing',
          className
        )}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h2 className="text-base font-black text-foreground">{title}</h2>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="p-4 text-foreground">{children}</div>
      </section>
    </div>,
    document.body
  );
}

export const Drawer = Modal;
export const BottomSheet = Modal;
