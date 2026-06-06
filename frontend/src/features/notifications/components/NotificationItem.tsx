import React from 'react';
import { Link } from 'react-router-dom';
import type { NotificationItem as NotificationType } from '../../../shared/types';
import { useTranslation } from '../../../shared/i18n';
import { trackEvent } from '../../../shared/lib/analytics';
import { cn } from '../../../lib/utils';

export interface NotificationItemProps {
  item: NotificationType;
  onClose?: () => void;
  onRead?: (id: string) => void;
}

export function NotificationItem({ item, onClose, onRead }: NotificationItemProps) {
  const { t } = useTranslation();
  const href = notificationHref(item);

  const handleClick = () => {
    trackEvent('notification_clicked', {
      notification_id: item.id,
      type: item.type,
      target: href,
      surface: onClose ? 'dropdown' : 'page',
    });
    if (onRead && !item.is_read) onRead(item.id);
    onClose?.();
  };

  const content = (
    <div className={cn(
      'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40 text-foreground',
      item.is_read ? 'opacity-60' : ''
    )}>
      <div className={cn(
        'mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all',
        item.is_read ? 'bg-transparent' : 'bg-primary'
      )} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{notificationTitle(item.type, t)}</p>
        <p className="truncate text-xs text-muted-foreground">{notificationText(item, t)}</p>
        <p className="mt-0.5 text-muted-foreground/60" style={{ fontSize: '10px' }}>{timeAgo(item.created_at, t)}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} onClick={handleClick} className="block border-b border-border last:border-0">
        {content}
      </Link>
    );
  }

  return (
    <div onClick={handleClick} className="border-b border-border last:border-0 cursor-pointer">
      {content}
    </div>
  );
}

// Helpers
export function notificationTitle(type: string, t: (key: string) => string) {
  const titles: Record<string, string> = {
    post_removed: t('notification_type.post_removed'),
    account_restricted: t('notification_type.account_restricted'),
    account_unrestricted: t('notification_type.account_unrestricted'),
    role_updated: t('notification_type.role_updated'),
    message: t('notification_type.message'),
    comment: t('notification_type.comment'),
    post_liked: t('notification_type.post_liked'),
    follow: t('notification_type.follow'),
    post_reposted: t('notification_type.post_reposted'),
  };
  return titles[type] || type;
}

export function notificationText(item: { type: string; data: Record<string, unknown> }, t: (key: string) => string) {
  const reason = item.data?.reason;
  const actor = item.data?.actor;
  const actorName = typeof actor === 'string' ? actor : null;
  if (typeof reason === 'string') return reason;
  if (actorName && item.type === 'post_liked') return `${actorName} поставил(а) лайк вашему мему`;
  if (actorName && item.type === 'comment') return `${actorName} оставил(а) комментарий или ответ`;
  if (actorName && item.type === 'follow') return `${actorName} подписался(ась) на вас`;
  if (actorName && item.type === 'post_reposted') return `${actorName} поделился(ась) вашим мемом`;
  if (actorName && item.type === 'message') return `${actorName} написал(а) вам`;
  if (actorName) return actorName;
  return t('notification_type.default');
}

export function notificationHref(item: { type: string; data: Record<string, unknown> }) {
  if (typeof item.data?.post_id === 'string') return `/post/${item.data.post_id}`;
  if (typeof item.data?.chat_id === 'string') return `/messages?chat=${item.data.chat_id}`;
  return null;
}

export function timeAgo(dateString: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return t('time.just_now');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${t('time.min_ago')}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${t('time.h_ago')}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ${t('time.d_ago')}`;
  return new Date(dateString).toLocaleDateString('ru-RU');
}
