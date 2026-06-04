import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useViewportVideo } from '../lib/useViewportVideo';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { useTranslation } from '../i18n';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={cn(
        'motion-control inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-55',
        variant === 'primary' && 'bg-[#FF6B00] text-white hover:bg-[#e66000]',
        variant === 'secondary' && 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]',
        variant === 'outline' && 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900',
        variant === 'ghost' && 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        {...props}
        aria-label={label}
        title={label}
        className={cn(
          'motion-control inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-55 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
          className,
        )}
      >
        {children}
      </button>
    );
  },
);

export function Input({ error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <label className={cn('t-input-wrap block', error && 'is-error')}>
      <input
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        className={cn(
          't-input h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-950',
          error && 'is-error is-shaking border-red-400 focus:border-red-400 focus:ring-red-100',
          className,
        )}
      />
      <span className="t-error-msg mt-1 block text-xs font-bold text-red-500" aria-live="polite">{error || ''}</span>
    </label>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(
  function Textarea({ error, className, ...props }, ref) {
  return (
    <label className={cn('t-input-wrap block', error && 'is-error')}>
      <textarea
        {...props}
        ref={ref}
        aria-invalid={error ? true : props['aria-invalid']}
        className={cn(
          't-input min-h-24 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-950',
          error && 'is-error is-shaking border-red-400 focus:border-red-400 focus:ring-red-100',
          className,
        )}
      />
      <span className="t-error-msg mt-1 block text-xs font-bold text-red-500" aria-live="polite">{error || ''}</span>
    </label>
  );
  },
);

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'motion-control h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-zinc-300', className)}>
      <input type="checkbox" {...props} className="h-4 w-4 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00]" />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, ariaLabel }: { checked: boolean; onChange: (checked: boolean) => void; label?: string; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      onClick={() => onChange(!checked)}
      className="motion-control inline-flex items-center gap-2 rounded-lg text-sm font-bold"
    >
      <span aria-hidden className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-[#FF6B00]' : 'bg-gray-300 dark:bg-zinc-700')}>
        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('motion-control inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-black text-gray-600 dark:bg-zinc-900 dark:text-zinc-300', className)}>{children}</span>;
}

export function AnimatedNumber({ value, className }: { value: number | string; className?: string }) {
  const text = String(value);
  return (
    <span key={text} className={className} aria-label={text}>
      <span className="t-digit-group is-animating" aria-hidden="true">
        {Array.from(text).map((digit, index) => (
          <span
            key={`${digit}-${index}`}
            className="t-digit"
            data-stagger={index === text.length - 2 ? '1' : index === text.length - 1 ? '2' : undefined}
          >
            {digit}
          </span>
        ))}
      </span>
    </span>
  );
}

export function Avatar({ src, name, className }: { src?: string; name?: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-orange-100 font-black text-[#FF6B00]', className)}>
      {showImage ? <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setErrored(true)} /> : (name || '?').charAt(0)}
    </div>
  );
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const movePill = useCallback((animate: boolean) => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const active = Array.from(list.querySelectorAll<HTMLButtonElement>('[data-motion-tab]'))
      .find((tab) => tab.dataset.motionTab === value);
    if (!active) return;
    if (!animate) pill.style.transition = 'none';
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    pill.style.width = `${active.offsetWidth}px`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  }, [value]);

  useLayoutEffect(() => {
    movePill(false);
  }, [movePill]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => movePill(false));
    observer.observe(list);
    return () => observer.disconnect();
  }, [movePill]);

  return (
    <div ref={listRef} className="t-tabs" role="tablist">
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          role="tab"
          aria-selected={value === item.id}
          data-motion-tab={item.id}
          className="t-tab shrink-0 text-sm font-black"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const DropdownContext = createContext<(() => void) | null>(null);

export function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const close = useCallback(() => setOpen(false), []);
  const presence = useAnimatedPresence(open, 150);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);
  return (
    <DropdownContext.Provider value={close}>
      <div className="relative">
        <div onClick={() => setOpen((value) => !value)} role="button" tabIndex={0} aria-haspopup="menu" aria-expanded={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }}}>{trigger}</div>
        {presence.mounted ? (
          <>
            <button className="fixed inset-0 z-30 cursor-default" aria-label={t('ui.close_menu')} onClick={close} />
            <div
              role="menu"
              data-origin="top-right"
              className={cn(
                't-dropdown absolute right-0 top-full z-40 mt-2 min-w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950',
                presence.state === 'open' && 'is-open',
                presence.state === 'closing' && 'is-closing',
              )}
            >
              {children}
            </div>
          </>
        ) : null}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownItem({ children, danger, disabled, onClick }: { children: React.ReactNode; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  const close = useContext(DropdownContext);
  return (
    <button
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={() => { if (!disabled) { onClick(); close?.(); } }}
      className={cn(
        'motion-control flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900',
        danger ? 'text-red-600' : 'text-gray-700 dark:text-zinc-100',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const presence = useAnimatedPresence(open, 170);

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
  return (
    <div
      className="motion-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      data-state={presence.state}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button className="absolute inset-0 cursor-default" aria-label={t('common.close')} onClick={onClose} />
      <section
        ref={modalRef}
        className={cn(
          't-modal relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-950 sm:max-w-2xl sm:rounded-lg',
          presence.state === 'open' && 'is-open',
          presence.state === 'closing' && 'is-closing',
        )}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-black">{title}</h2>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}

export const Drawer = Modal;
export const BottomSheet = Modal;

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('motion-skeleton rounded-lg bg-gray-200 dark:bg-zinc-800', className)} />;
}

export function EmptyState({ title, description, action, icon, emoji }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode; emoji?: string }) {
  return (
    <div className="t-stagger is-shown flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-white to-gray-50/50 p-10 text-center dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/50">
      {emoji ? (
        <span className="t-stagger-line t-stagger-line--1 mb-3 text-4xl">{emoji}</span>
      ) : icon ? (
        <div className="t-stagger-line t-stagger-line--1 mb-3 text-gray-300 dark:text-zinc-600">{icon}</div>
      ) : (
        <span className="t-stagger-line t-stagger-line--1 mb-3 text-4xl">🤷</span>
      )}
      <p className="t-stagger-line t-stagger-line--2 text-lg font-black text-gray-900 dark:text-zinc-100">{title}</p>
      {description ? <p className="t-stagger-line t-stagger-line--3 mt-1.5 max-w-xs text-sm text-gray-500 dark:text-zinc-400">{description}</p> : null}
      {action ? <div className="t-stagger-line t-stagger-line--4 mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title: _title, description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const title = _title ?? t('error.state_title');
  return (
    <div className="t-input is-shaking rounded-lg border border-red-100 bg-red-50 p-6 text-center text-red-700 dark:border-red-900 dark:bg-red-950/25">
      <AlertTriangle className="mx-auto mb-2" />
      <p className="font-black">{title}</p>
      {description ? <p className="mt-1 text-sm">{description}</p> : null}
      {onRetry ? <Button variant="outline" className="mt-4" onClick={onRetry}>{t('common.retry')}</Button> : null}
    </div>
  );
}

type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: string; title: string; tone?: 'success' | 'error' | 'info'; leaving?: boolean; action?: ToastAction; duration?: number };
const ToastContext = createContext<{ show: (toast: Omit<ToastItem, 'id' | 'leaving'>) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((toast: Omit<ToastItem, 'id' | 'leaving'>) => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { id, ...toast }]);
    const duration = toast.duration ?? 4200;
    window.setTimeout(() => {
      setItems((current) => current.map((item) => item.id === id ? { ...item, leaving: true } : item));
      window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 300);
    }, duration);
  }, []);
  const dismiss = useCallback((id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, leaving: true } : item));
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 300);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" role="region" aria-label={t('ui.toast_region')}>
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            onClick={() => dismiss(item.id)}
            data-leaving={item.leaving || undefined}
            className={cn(
              'motion-toast flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-4 py-3 text-sm font-bold shadow-xl dark:bg-zinc-950',
              item.tone === 'error' ? 'border-red-200 text-red-700' : 'border-gray-200 text-gray-800 dark:border-zinc-800 dark:text-zinc-100',
            )}
          >
            {item.tone === 'success' ? <span className="t-success-check text-green-600" data-state="in"><Check size={16} /></span> : null}
            <span className="flex-1">{item.title}</span>
            {item.action ? (
              <button
                onClick={(e) => { e.stopPropagation(); item.action!.onClick(); dismiss(item.id); }}
                className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-bold text-[#FF6B00] hover:bg-orange-50 dark:hover:bg-orange-950/30"
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) return { show: () => undefined };
  return context;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText: _confirmText,
  onConfirm,
  onClose,
  tone = 'danger',
  loading = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const confirmText = _confirmText ?? t('common.confirm');
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description ? <p className="text-sm text-gray-500 dark:text-zinc-400">{description}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </div>
    </Modal>
  );
}

export function ReportDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; description?: string }) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={t('post.menu_report')}>
      <div className="space-y-3">
        <Select value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="spam">{t('ui.report_spam')}</option>
          <option value="abuse">{t('ui.report_abuse')}</option>
          <option value="fraud">{t('ui.report_fraud')}</option>
          <option value="illegal">{t('ui.report_illegal')}</option>
          <option value="other">{t('ui.report_other')}</option>
        </Select>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('ui.report_comment')} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => onSubmit({ reason, description })}>{t('common.send')}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function FileUploader({
  file,
  accept = 'image/*,video/mp4',
  onFile,
  error,
}: {
  file?: File | null;
  accept?: string;
  onFile: (file: File | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <label className="motion-control block cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm font-bold text-gray-500 hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-orange-950/20">
      <Upload className="mx-auto mb-2" size={20} />
      {file ? file.name : t('ui.add_media')}
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
      {error ? <span className="mt-2 block text-xs text-red-500">{error}</span> : null}
    </label>
  );
}

export function UserCard({ user, action }: { user: { username: string; display_name: string; avatar_url?: string; bio?: string }; action?: React.ReactNode }) {
  return (
    <div className="motion-control flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={user.avatar_url} name={user.display_name} />
        <span className="min-w-0">
          <span className="block truncate font-black">{user.display_name}</span>
          <span className="block truncate text-sm font-bold text-gray-400">@{user.username}</span>
          {user.bio ? <span className="mt-1 line-clamp-2 block text-sm text-gray-500">{user.bio}</span> : null}
        </span>
      </div>
      {action}
    </div>
  );
}

export function CommunityCard({
  community,
  action,
}: {
  community: { name: string; slug: string; avatar_url?: string; description?: string; members_count?: number };
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="motion-control flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={community.avatar_url} name={community.name} />
        <span className="min-w-0">
          <span className="block truncate font-black">{community.name}</span>
          {community.description ? <span className="line-clamp-2 block text-sm text-gray-500">{community.description}</span> : null}
          <span className="text-xs font-bold text-gray-400">{community.members_count || 0} {t('layout.members')}</span>
        </span>
      </div>
      {action}
    </div>
  );
}

export function MediaViewer({ url, type, alt }: { url: string; type?: string; alt?: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useViewportVideo();

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [expanded]);

  useEffect(() => { setImgError(false); }, [url]);

  return (
    <>
      <div
        className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 cursor-zoom-in"
        onClick={() => !imgError && setExpanded(true)}
      >
        {imgError ? (
          <div className="flex aspect-video max-h-[520px] w-full flex-col items-center justify-center gap-2 bg-gray-100 p-6 text-center dark:bg-zinc-900" role="img" aria-label={t('ui.media_failed_alt')}>
            <AlertTriangle size={28} className="text-amber-500" aria-hidden />
            <p className="text-sm font-bold text-gray-500 dark:text-zinc-400">{t('ui.media_failed')}</p>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); setImgError(false); }}
              className="text-xs font-bold text-[#FF6B00] underline-offset-2 hover:underline"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : type?.startsWith('video/') ? (
          <video ref={videoRef} src={url} className="max-h-[520px] w-full bg-black" controls muted playsInline preload="none" poster="" onClick={(e) => e.stopPropagation()} />
        ) : (
          <img src={url} alt={alt || ''} className="max-h-[520px] w-full object-contain" loading="lazy" decoding="async" onError={() => setImgError(true)} />
        )}
      </div>
      {expanded ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out animate-in fade-in duration-150"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt || t('ui.view_media')}
        >
          <button className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20" aria-label={t('common.close')} onClick={() => setExpanded(false)}>
            <X size={20} />
          </button>
          {type?.startsWith('video/') ? (
            <video src={url} className="max-h-[90vh] max-w-[90vw] rounded-lg bg-black" controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={url} alt={alt || ''} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      ) : null}
    </>
  );
}

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  level?: 'app' | 'route' | 'feed-item';
  onError?: (error: Error, info: { componentStack: string }) => void;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * 3-level ErrorBoundary:
 *  - level="app"      → full-screen fallback in App.tsx (last resort)
 *  - level="route"    → page-level fallback in router.tsx
 *  - level="feed-item"→ inline fallback in PostCard.tsx (one post crashes, others survive)
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (this.props.onError) this.props.onError(error, info);
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.level ?? 'unknown', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultErrorFallback error={error} reset={this.reset} level={this.props.level ?? 'route'} />;
  }
}

function DefaultErrorFallback({ error, reset, level }: { error: Error; reset: () => void; level: 'app' | 'route' | 'feed-item' }) {
  if (level === 'feed-item') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
        <div className="flex items-center gap-2 font-black">
          <AlertTriangle size={14} /> Не удалось отобразить пост
        </div>
        <p className="mt-1 text-xs opacity-80">Остальная лента работает. Можно попробовать ещё раз.</p>
        <button onClick={reset} className="mt-2 rounded-md bg-white px-3 py-1 text-xs font-black text-red-700 shadow-sm hover:bg-red-100 dark:bg-zinc-900 dark:hover:bg-zinc-800">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle size={22} />
      </div>
      <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">
        {level === 'app' ? 'Что-то пошло совсем не так' : 'Не удалось загрузить страницу'}
      </h2>
      <p className="max-w-sm text-sm text-gray-500 dark:text-zinc-400">
        {error.message || 'Попробуйте обновить страницу или повторить попытку.'}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-orange-600"
        >
          Повторить
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Перезагрузить
        </button>
      </div>
    </div>
  );
}
