import { Link, useSearchParams } from 'react-router-dom';
import { Bell, CheckCircle2, BellOff } from 'lucide-react';
import { AnimatedNumber, Button, EmptyState, ErrorState, Skeleton, Tabs } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';
import { useNotifications } from '../../features/notifications/useNotifications';
import { useTranslation } from '../../shared/i18n';
import { trackEvent } from '../../shared/lib/analytics';

type Filter = 'all' | 'post_liked' | 'comment' | 'follow' | 'message' | 'post_reposted' | 'system';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: '' },
  { id: 'post_liked', label: '' },
  { id: 'comment', label: '' },
  { id: 'follow', label: '' },
  { id: 'message', label: '' },
  { id: 'post_reposted', label: '' },
  { id: 'system', label: '' },
];

function isFilter(value: string | null): value is Filter {
  return FILTERS.some((item) => item.id === value);
}

export function NotificationsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedFilter = params.get('filter');
  const filter = isFilter(requestedFilter) ? requestedFilter : 'all';
  const { query, read, readAll } = useNotifications();

  const filterItems: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: t('notifications.filter_all') },
    { id: 'post_liked', label: t('notifications.filter_likes') },
    { id: 'comment', label: t('notifications.filter_comments') },
    { id: 'follow', label: t('notifications.filter_follows') },
    { id: 'message', label: t('notifications.filter_messages') },
    { id: 'post_reposted', label: t('notifications.filter_reposts') },
    { id: 'system', label: t('notifications.filter_system') },
  ];

  if (!user) return <div className="p-3 sm:p-4"><EmptyState title={t('common.required')} description={t('notifications.login_required')} /></div>;
  const notifications = query.data || [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const items = notifications.filter((item) => filter === 'all' || item.type === filter || (filter === 'system' && item.type.startsWith('account')));
  const newItems = items.filter((item) => !item.is_read);
  const oldItems = items.filter((item) => item.is_read);
  const grouped = oldItems.reduce<Array<{ label: string; items: typeof items }>>((acc, item) => {
    const diff = Date.now() - new Date(item.created_at).getTime();
    const dayMs = 86_400_000;
    let label: string;
    if (diff < dayMs) label = t('notifications.today');
    else if (diff < 2 * dayMs) label = t('notifications.yesterday');
    else if (diff < 7 * dayMs) label = t('notifications.this_week');
    else if (diff < 30 * dayMs) label = t('notifications.this_month');
    else label = t('notifications.earlier');
    const last = acc[acc.length - 1];
    if (last?.label === label) last.items.push(item);
    else acc.push({ label, items: [item] });
    return acc;
  }, []);

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#F3F4F6]/90 px-3 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-black"><Bell className="text-[#FF6B00]" /> {t('notifications.title')}</h1>
          <Button
            variant="outline"
            onClick={() => readAll.mutate()}
            loading={readAll.isPending}
            disabled={unreadCount === 0 || readAll.isPending}
          >
            {unreadCount > 0 ? <>{t('notifications.mark_all')} (<AnimatedNumber value={unreadCount} />)</> : t('notifications.all_read')}
          </Button>
        </div>
        <Tabs
          value={filter}
          onChange={(value) => {
            setParams((current) => {
              const next = new URLSearchParams(current);
              if (value === 'all') next.delete('filter');
              else next.set('filter', value);
              return next;
            }, { replace: true });
          }}
          items={filterItems}
        />
      </header>
      {/* XP Progress hint */}
      {user.activity_score !== undefined && (
        <div className="border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 dark:border-zinc-800 dark:from-orange-950/20 dark:to-amber-950/20">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-[#FF6B00]">{t('notifications.level')} <AnimatedNumber value={user.achievement_level || 1} /> ⚡</span>
            <span className="text-gray-400"><AnimatedNumber value={user.activity_score || 0} /> / {((user.achievement_level || 1) + 1) * 100} XP</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(100, ((user.activity_score || 0) / (((user.achievement_level || 1) + 1) * 100)) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-bold text-gray-400 dark:text-zinc-500">
            {t('notifications.xp_hint')}
          </p>
        </div>
      )}
      <div className="space-y-3 p-3 sm:p-4">
        {query.isLoading ? <Skeleton className="h-64" /> : query.isError ? <ErrorState description={t('notifications.load_error')} onRetry={() => query.refetch()} /> : items.length ? (
          <>
            {newItems.length ? (
              <NotificationSection
                label="Новые"
                items={newItems}
                locale={lang === 'en' ? 'en-US' : 'ru-RU'}
                readPending={read.isPending}
                onRead={(id) => read.mutate(id)}
                markReadLabel={t('notifications.mark_read')}
                titleFor={(type) => notificationTitle(type, t)}
                textFor={(item) => notificationText(item, t)}
              />
            ) : null}
            {grouped.length ? grouped.map((group) => (
              <NotificationSection
                key={group.label}
                label={group.label}
                items={group.items}
                locale={lang === 'en' ? 'en-US' : 'ru-RU'}
                readPending={read.isPending}
                onRead={(id) => read.mutate(id)}
                markReadLabel={t('notifications.mark_read')}
                titleFor={(type) => notificationTitle(type, t)}
                textFor={(item) => notificationText(item, t)}
              />
            )) : null}
          </>
        ) : <EmptyState title={t('notifications.empty_title')} description={t('notifications.empty_desc')} icon={<BellOff size={36} />} />}
      </div>
    </div>
  );
}

function NotificationSection({
  label,
  items,
  locale,
  readPending,
  onRead,
  markReadLabel,
  titleFor,
  textFor,
}: {
  label: string;
  items: Array<{ id: string; type: string; data: Record<string, unknown>; is_read: boolean; created_at: string }>;
  locale: string;
  readPending: boolean;
  onRead: (id: string) => void;
  markReadLabel: string;
  titleFor: (type: string) => string;
  textFor: (item: { type: string; data: Record<string, unknown> }) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-gray-400 dark:text-zinc-500">{label}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const href = notificationHref(item);
          const body = textFor(item);
          const content = (
            <div className={`motion-control flex items-start justify-between gap-3 rounded-lg border p-4 ${item.is_read ? 'border-gray-200 bg-white opacity-75 hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-950' : 'border-orange-100 bg-orange-50 shadow-sm dark:border-orange-900 dark:bg-orange-950/25'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-black">{titleFor(item.type)}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">{body}</p>
                <p className="mt-1 text-xs text-gray-400">{new Date(item.created_at).toLocaleString(locale)}</p>
              </div>
              {item.is_read ? null : (
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRead(item.id);
                  }}
                  disabled={readPending}
                  className="shrink-0 text-gray-400 hover:text-green-600 disabled:cursor-wait disabled:opacity-50"
                  aria-label={markReadLabel}
                >
                  <CheckCircle2 size={18} />
                </button>
              )}
            </div>
          );
          const handleClick = () => {
            trackEvent('notification_clicked', {
              notification_id: item.id,
              type: item.type,
              target: href,
            });
            if (!item.is_read) onRead(item.id);
          };
          return href ? (
            <Link key={item.id} to={href} onClick={handleClick}>
              {content}
            </Link>
          ) : <div key={item.id} onClick={handleClick}>{content}</div>;
        })}
      </div>
    </div>
  );
}

function notificationTitle(type: string, t: (key: string) => string) {
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

function notificationText(item: { type: string; data: Record<string, unknown> }, t: (key: string) => string) {
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
  return t('notifications.click_to_view');
}

function notificationHref(item: { type: string; data: Record<string, unknown> }) {
  if (typeof item.data?.post_id === 'string') return `/post/${item.data.post_id}`;
  if (typeof item.data?.chat_id === 'string') return `/messages?chat=${item.data.chat_id}`;
  return null;
}
