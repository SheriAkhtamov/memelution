import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useViewportVideo } from '../lib/useViewportVideo';
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
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-55',
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

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-55 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Input({ error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <label className="block">
      <input
        {...props}
        className={cn(
          'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-950',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
          className,
        )}
      />
      {error ? <span className="mt-1 block text-xs font-bold text-red-500">{error}</span> : null}
    </label>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(
  function Textarea({ error, className, ...props }, ref) {
  return (
    <label className="block">
      <textarea
        {...props}
        ref={ref}
        className={cn(
          'min-h-24 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-950',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
          className,
        )}
      />
      {error ? <span className="mt-1 block text-xs font-bold text-red-500">{error}</span> : null}
    </label>
  );
  },
);

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
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

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm font-bold">
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-[#FF6B00]' : 'bg-gray-300 dark:bg-zinc-700')}>
        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-black text-gray-600 dark:bg-zinc-900 dark:text-zinc-300', className)}>{children}</span>;
}

export function Avatar({ src, name, className }: { src?: string; name?: string; className?: string }) {
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-orange-100 font-black text-[#FF6B00]', className)}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name || '?').charAt(0)}
    </div>
  );
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            'h-9 shrink-0 rounded-lg px-3 text-sm font-black transition-colors',
            value === item.id ? 'bg-[#FF6B00] text-white' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900',
          )}
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
  return (
    <DropdownContext.Provider value={close}>
      <div className="relative">
        <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
        {open ? (
          <>
            <button className="fixed inset-0 z-30 cursor-default" aria-label={t('ui.close_menu')} onClick={close} />
            <div className="absolute right-0 top-full z-40 mt-2 min-w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              {children}
            </div>
          </>
        ) : null}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownItem({ children, danger, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void }) {
  const close = useContext(DropdownContext);
  return (
    <button onClick={() => { onClick(); close?.(); }} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-900', danger ? 'text-red-600' : 'text-gray-700 dark:text-zinc-100')}>
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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 animate-in fade-in duration-200 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 cursor-default" aria-label={t('common.close')} onClick={onClose} />
      <section ref={modalRef} className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-950 sm:max-w-2xl sm:rounded-lg animate-in slide-in-from-bottom-2 duration-200">
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
  return <div className={cn('animate-pulse rounded-lg bg-gray-200 dark:bg-zinc-800', className)} />;
}

export function EmptyState({ title, description, action, icon, emoji }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode; emoji?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-white to-gray-50/50 p-10 text-center dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/50">
      {emoji ? (
        <span className="mb-3 text-4xl animate-bounce" style={{ animationDuration: '2s', animationIterationCount: 3 }}>{emoji}</span>
      ) : icon ? (
        <div className="mb-3 text-gray-300 dark:text-zinc-600">{icon}</div>
      ) : (
        <span className="mb-3 text-4xl animate-bounce" style={{ animationDuration: '2s', animationIterationCount: 3 }}>🤷</span>
      )}
      <p className="text-lg font-black text-gray-900 dark:text-zinc-100">{title}</p>
      {description ? <p className="mt-1.5 max-w-xs text-sm text-gray-500 dark:text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title: _title, description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const title = _title ?? t('error.state_title');
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-6 text-center text-red-700 dark:border-red-900 dark:bg-red-950/25">
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
      <div className="fixed right-4 top-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => dismiss(item.id)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-4 py-3 text-sm font-bold shadow-xl transition-all duration-300 dark:bg-zinc-950',
              item.tone === 'error' ? 'border-red-200 text-red-700' : 'border-gray-200 text-gray-800 dark:border-zinc-800 dark:text-zinc-100',
              item.leaving ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100',
            )}
          >
            {item.tone === 'success' ? <Check size={16} className="text-green-600" /> : null}
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
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
  tone?: 'danger' | 'primary';
}) {
  const { t } = useTranslation();
  const confirmText = _confirmText ?? t('common.confirm');
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description ? <p className="text-sm text-gray-500 dark:text-zinc-400">{description}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
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
    <label className="block cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm font-bold text-gray-500 hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-orange-950/20">
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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

  return (
    <>
      <div
        className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 cursor-zoom-in"
        onClick={() => setExpanded(true)}
      >
        {type?.startsWith('video/') ? (
          <video ref={videoRef} src={url} className="max-h-[520px] w-full bg-black" controls muted playsInline preload="metadata" onClick={(e) => e.stopPropagation()} />
        ) : (
          <img src={url} alt={alt || ''} className="max-h-[520px] w-full object-contain" loading="lazy" />
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
