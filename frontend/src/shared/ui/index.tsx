import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useViewportVideo } from '../lib/useViewportVideo';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { useTranslation } from '../i18n';
import { Button } from './Button';
import { Modal } from './Modal';
import { Textarea } from './Textarea';


// Re-exports from separate design system components
export { Button, buttonVariants, IconButton } from './Button';
export type { ButtonProps, IconButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { Card, cardVariants } from './Card';
export type { CardProps } from './Card';

export { Modal, Drawer, BottomSheet } from './Modal';
export type { ModalProps } from './Modal';

export { Tabs } from './Tabs';
export type { TabsProps } from './Tabs';

export { Avatar, avatarVariants } from './Avatar';
export type { AvatarProps } from './Avatar';

export { Badge, badgeVariants } from './Badge';
export type { BadgeProps } from './Badge';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';

export { LoadingState } from './LoadingState';
export type { LoadingStateProps } from './LoadingState';

export { PageLayout, pageLayoutVariants } from './PageLayout';
export type { PageLayoutProps } from './PageLayout';

export { MainContent, mainContentVariants } from './MainContent';
export type { MainContentProps, MainContentVariant } from './MainContent';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { Typography, Text, typographyVariants } from './Typography';
export type { TypographyProps } from './Typography';

export { UserCard } from './UserCard';
export type { UserCardProps } from './UserCard';

export { CommunityCard } from './CommunityCard';
export type { CommunityCardProps } from './CommunityCard';

export { FeedLayout } from './FeedLayout';
export type { FeedLayoutProps } from './FeedLayout';

export { SidebarBlock } from './SidebarBlock';
export type { SidebarBlockProps } from './SidebarBlock';

// Inline simple controls that do not have separate files
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'motion-control h-9 w-full rounded-md border border-border bg-background px-2.5 text-[0.84rem] font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cn('inline-flex items-center gap-1.5 text-[0.84rem] font-bold text-muted-foreground', className)}>
      <input type="checkbox" {...props} className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary" />
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
      className="motion-control inline-flex items-center gap-1.5 rounded-md text-[0.84rem] font-bold"
    >
      <span aria-hidden className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted border border-border')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      {label ? <span className="text-foreground">{label}</span> : null}
    </button>
  );
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
                't-dropdown absolute right-0 top-full z-40 mt-2 min-w-52 overflow-hidden rounded-lg border border-border bg-card shadow-xl',
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
        'motion-control flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[0.82rem] font-bold hover:bg-muted',
        danger ? 'text-destructive' : 'text-foreground',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent',
      )}
    >
      {children}
    </button>
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
              'motion-toast flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-[0.82rem] font-bold shadow-xl',
              item.tone === 'error' ? 'border-destructive/20 text-destructive' : 'border-border text-foreground',
            )}
          >
            {item.tone === 'success' ? <span className="t-success-check text-green-600" data-state="in"><Check size={16} /></span> : null}
            <span className="flex-1">{item.title}</span>
            {item.action ? (
              <button
                onClick={(e) => { e.stopPropagation(); item.action!.onClick(); dismiss(item.id); }}
                className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10"
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
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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
    <label className="motion-control block cursor-pointer rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-[0.82rem] font-bold text-muted-foreground hover:border-primary/55 hover:bg-primary/5">
      <Upload className="mx-auto mb-1.5" size={18} />
      {file ? file.name : t('ui.add_media')}
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
      {error ? <span className="mt-2 block text-xs text-destructive">{error}</span> : null}
    </label>
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
        className="overflow-hidden rounded-xl border border-border bg-muted/10 cursor-zoom-in"
        onClick={() => !imgError && setExpanded(true)}
      >
        {imgError ? (
          <div className="flex aspect-video max-h-[440px] w-full flex-col items-center justify-center gap-2 bg-muted/30 p-4 text-center" role="img" aria-label={t('ui.media_failed_alt')}>
            <AlertTriangle size={24} className="text-amber-500" aria-hidden />
            <p className="text-sm font-bold text-muted-foreground">{t('ui.media_failed')}</p>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); setImgError(false); }}
              className="text-xs font-bold text-primary underline-offset-2 hover:underline"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : type?.startsWith('video/') ? (
          <video ref={videoRef} src={url} className="max-h-[440px] w-full bg-black" controls muted playsInline preload="none" poster="" onClick={(e) => e.stopPropagation()} />
        ) : (
          <img src={url} alt={alt || ''} className="max-h-[440px] w-full object-contain" loading="lazy" decoding="async" onError={() => setImgError(true)} />
        )}
      </div>
      {expanded ? createPortal(
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
            <video src={url} className="max-h-[90vh] max-w-[90vw] rounded-xl bg-black" controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={url} alt={alt || ''} className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>,
        document.body
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

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (this.props.onError) this.props.onError(error, info);
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
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        <div className="flex items-center gap-2 font-black">
          <AlertTriangle size={14} /> Не удалось отобразить пост
        </div>
        <p className="mt-1 text-xs opacity-80">Остальная лента работает. Можно попробовать ещё раз.</p>
        <button onClick={reset} className="mt-2 rounded-md bg-card border border-border px-3 py-1 text-xs font-black text-foreground shadow-sm hover:bg-muted">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle size={22} />
      </div>
      <h2 className="text-lg font-black text-foreground">
        {level === 'app' ? 'Что-то пошло совсем не так' : 'Не удалось загрузить страницу'}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.message || 'Попробуйте обновить страницу или повторить попытку.'}
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Повторить</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Перезагрузить</Button>
      </div>
    </div>
  );
}

// Admin charts helpers
type ChartKind = 'line' | 'bar' | 'area' | 'donut';
const CHART_PALETTE = ['#FF6B00', '#7C3AED', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#6366F1'];

export function Chart({
  kind = 'line',
  series,
  labels,
  height = 180,
  ariaLabel,
  donutCenterLabel,
  palette: paletteOverride,
}: {
  kind?: ChartKind;
  series: Array<{ name: string; color?: string; data: number[] }>;
  labels: string[];
  height?: number;
  ariaLabel?: string;
  donutCenterLabel?: string;
  palette?: string[];
}) {
  const { t } = useTranslation();
  const PALETTE = paletteOverride && paletteOverride.length > 0 ? paletteOverride : CHART_PALETTE;
  const palette = series.map((s, i) => s.color || PALETTE[i % PALETTE.length]);
  const width = 600;
  const padX = 16;
  const padY = 12;
  const allValues = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allValues);
  const stepX = (width - padX * 2) / Math.max(1, labels.length - 1);
  const innerHeight = height - padY * 2;

  if (kind === 'donut') {
    const total = series.reduce((sum, s) => sum + s.data.reduce((a, b) => a + b, 0), 0) || 1;
    const radius = 70;
    const stroke = 18;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel || t('common.chart')}
        className="overflow-visible"
      >
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" className="text-gray-100 dark:text-zinc-800" strokeWidth={stroke} />
        {series.flatMap((s, si) =>
          s.data.map((v, vi) => {
            const len = (v / total) * circumference;
            const seg = (
              <circle
                key={`${si}-${vi}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={PALETTE[vi % PALETTE.length]}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return seg;
          }),
        )}
        {donutCenterLabel ? (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize={14} fontWeight={700}>
            {donutCenterText(donutCenterLabel, total)}
          </text>
        ) : null}
      </svg>
    );
  }

  const yTicks = [0, 0.5, 1].map((p) => Math.round(max * p));
  const yToPx = (v: number) => padY + innerHeight - (v / max) * innerHeight;
  const xToPx = (i: number) => padX + i * stepX;

  if (kind === 'bar') {
    const barGroupWidth = (width - padX * 2) / Math.max(1, labels.length);
    const barWidth = (barGroupWidth * 0.7) / Math.max(1, series.length);
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel || t('common.chart')} className="overflow-visible">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padX} y1={yToPx(v)} x2={width - padX} y2={yToPx(v)} stroke="currentColor" className="text-gray-100 dark:text-zinc-800" strokeWidth={1} />
            <text x={padX - 4} y={yToPx(v) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{v}</text>
          </g>
        ))}
        {labels.map((label, i) => (
          <g key={label + i}>
            {series.map((s, si) => {
              const v = s.data[i] || 0;
              const x = padX + i * barGroupWidth + si * barWidth + barGroupWidth * 0.15;
              const y = yToPx(v);
              return (
                <rect
                  key={s.name + si}
                  x={x}
                  y={y}
                  width={Math.max(2, barWidth)}
                  height={Math.max(0, padY + innerHeight - y)}
                  rx={3}
                  fill={palette[si]}
                  opacity={0.9}
                />
              );
            })}
            {labels.length <= 14 ? (
              <text x={padX + i * barGroupWidth + barGroupWidth / 2} y={height - 2} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
                {shortDate(label)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel || t('common.chart')} className="overflow-visible">
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padX} y1={yToPx(v)} x2={width - padX} y2={yToPx(v)} stroke="currentColor" className="text-gray-100 dark:text-zinc-800" strokeWidth={1} />
          <text x={padX - 4} y={yToPx(v) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{v}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const path = s.data
          .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(i)} ${yToPx(v)}`)
          .join(' ');
        const areaPath = `${path} L ${xToPx(s.data.length - 1)} ${padY + innerHeight} L ${xToPx(0)} ${padY + innerHeight} Z`;
        return (
          <g key={s.name}>
            {kind === 'area' ? (
              <path d={areaPath} fill={palette[si]} opacity={0.15} />
            ) : null}
            <path d={path} fill="none" stroke={palette[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={xToPx(i)} cy={yToPx(v)} r={2.5} fill={palette[si]} />
            ))}
          </g>
        );
      })}
      {labels.map((label, i) =>
        labels.length <= 14 && (i === 0 || i === labels.length - 1 || i % Math.ceil(labels.length / 6) === 0) ? (
          <text key={label + i} x={xToPx(i)} y={height - 2} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
            {shortDate(label)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function donutCenterText(label: string, total: number) {
  return `${label}: ${total}`;
}

function shortDate(label: string) {
  if (!label) return '';
  const parts = label.split('-');
  if (parts.length >= 3) return `${parts[2]}.${parts[1]}`;
  return label;
}

export function ChartLegend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  delta,
  deltaLabel,
  hint,
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: 'neutral' | 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'cyan' | 'violet' | 'lime' | 'fuchsia';
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  isLoading?: boolean;
}) {
  const toneMap: Record<string, { color: string; gradient: string; bg: string }> = {
    neutral: { color: 'text-muted-foreground', gradient: 'from-gray-500/10 to-gray-600/5', bg: 'bg-muted' },
    blue: { color: 'text-blue-500', gradient: 'from-blue-500/10 to-blue-600/5', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    emerald: { color: 'text-emerald-500', gradient: 'from-emerald-500/10 to-emerald-600/5', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    amber: { color: 'text-amber-500', gradient: 'from-amber-500/10 to-amber-600/5', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    red: { color: 'text-destructive', gradient: 'from-red-500/10 to-red-600/5', bg: 'bg-destructive/10 dark:bg-red-900/30' },
    purple: { color: 'text-purple-500', gradient: 'from-purple-500/10 to-purple-600/5', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    cyan: { color: 'text-cyan-500', gradient: 'from-cyan-500/10 to-cyan-600/5', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    violet: { color: 'text-violet-500', gradient: 'from-violet-500/10 to-violet-600/5', bg: 'bg-violet-100 dark:bg-violet-900/30' },
    lime: { color: 'text-lime-500', gradient: 'from-lime-500/10 to-lime-600/5', bg: 'bg-lime-100 dark:bg-lime-900/30' },
    fuchsia: { color: 'text-fuchsia-500', gradient: 'from-fuchsia-500/10 to-fuchsia-600/5', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30' },
  };
  const palette = toneMap[tone] || toneMap.neutral;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-0 bg-gradient-to-br ${palette.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
      <div className="relative">
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${palette.bg} ${palette.color}`}>
          <Icon size={20} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {isLoading ? (
          <div className="mt-2 h-8 w-24 rounded bg-muted animate-pulse" />
        ) : (
          <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
        )}
        {delta !== undefined || hint ? (
          <div className="mt-2 flex items-center gap-2 text-xs font-bold">
            {delta !== undefined ? (
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 ${
                  delta > 0
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : delta < 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '·'} {Math.abs(delta)}%
              </span>
            ) : null}
            {(deltaLabel || hint) ? <span className="text-muted-foreground">{deltaLabel || hint}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'sm',
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (id: T) => void;
  size?: 'sm' | 'xs';
}) {
  const sizeMap = {
    sm: 'h-9 text-xs',
    xs: 'h-8 text-[11px]',
  } as const;
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5`}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`${sizeMap[size]} inline-flex items-center justify-center rounded-md px-3 font-bold transition-colors ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyState,
  rowClassName,
}: {
  columns: Array<{
    key: string;
    label: string;
    render: (row: T) => React.ReactNode;
    className?: string;
  }>;
  rows: T[];
  getRowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className={`transition-colors hover:bg-muted/30 ${rowClassName ? rowClassName(row) : ''}`}>
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-4 align-middle text-sm ${col.className || ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { UserInspector } from './UserInspector';
