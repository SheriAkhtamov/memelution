import { Activity, AtSign, Ban, Calendar, Globe, MessageSquare, Shield, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useTranslation } from '../i18n';
import type { User } from '../types';
import { Avatar, EmptyState, ErrorState, Skeleton, StatCard } from './index';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', uz: 'uz-UZ' };

interface UserInspectorProps {
  user: User | null;
  onClose: () => void;
}

export function UserInspector({ user, onClose }: UserInspectorProps) {
  const { t, lang } = useTranslation();
  const sessionsQuery = useQuery({
    queryKey: ['admin-sessions', { q: user?.id || '' }],
    queryFn: () => api.adminSessions({ q: user?.id, limit: 50 }),
    enabled: Boolean(user),
  });
  const logsQuery = useQuery({
    queryKey: ['admin-logs', { q: user?.id || '' }],
    queryFn: () => api.adminLogsFiltered({ moderator_id: user?.id, limit: 50 }),
    enabled: Boolean(user),
  });

  if (!user) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center gap-4 border-b border-gray-100 bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 dark:border-zinc-800">
          <Avatar src={user.avatar_url} name={user.display_name} className="h-16 w-16 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black">{user.display_name}</h2>
            <p className="flex items-center gap-1 text-sm font-bold text-gray-500 dark:text-zinc-400">
              <AtSign size={12} /> {user.username}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {user.role || 'user'}
              </span>
              {user.is_banned ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <Ban size={10} /> {t('admin.banned')}
                </span>
              ) : null}
              {user.is_verified ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <ShieldCheck size={10} /> verified
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.cancel')}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {user.bio ? (
            <div className="mb-4 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/40">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">bio</p>
              <p className="mt-1 text-sm">{user.bio}</p>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatCard label={t('admin.inspector_posts')} value={(user.posts_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={MessageSquare} tone="blue" />
            <StatCard label={t('admin.inspector_followers')} value={(user.followers_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={Activity} tone="emerald" />
            <StatCard label={t('admin.inspector_following')} value={(user.following_count || 0).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')} icon={Activity} tone="violet" />
          </div>

          <div className="mb-4 space-y-2 rounded-xl border border-gray-100 p-3 dark:border-zinc-800">
            {user.location ? (
              <Row icon={Globe} label={t('admin.inspector_location')} value={user.location} />
            ) : null}
            {user.website ? (
              <Row icon={Globe} label={t('admin.inspector_website')} value={user.website} />
            ) : null}
            {user.created_at ? (
              <Row
                icon={Calendar}
                label={t('admin.inspector_joined')}
                value={new Date(user.created_at).toLocaleDateString(LOCALE_MAP[lang] || 'ru-RU')}
              />
            ) : null}
            {user.banned_until && user.is_banned ? (
              <Row
                icon={Shield}
                label={t('admin.inspector_ban_expires')}
                value={new Date(user.banned_until).toLocaleString(LOCALE_MAP[lang] || 'ru-RU')}
              />
            ) : null}
            {user.ban_reason ? (
              <Row icon={Ban} label={t('admin.inspector_ban_reason')} value={user.ban_reason} />
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-gray-500">
              {t('admin.inspector_recent_sessions')}
            </h3>
            {sessionsQuery.isLoading ? (
              <div className="space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : sessionsQuery.isError ? (
              <ErrorState description={t('admin.error_load_users')} onRetry={() => sessionsQuery.refetch()} />
            ) : !sessionsQuery.data?.length ? (
              <EmptyState title={t('admin.sessions_empty')} />
            ) : (
              <ul className="space-y-1.5">
                {sessionsQuery.data.slice(0, 5).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-2.5 text-xs dark:bg-zinc-800/40"
                  >
                    <span className="truncate text-gray-700 dark:text-zinc-200">{s.user_agent || '—'}</span>
                    <span className="shrink-0 text-gray-400">
                      {new Date(s.created_at).toLocaleDateString(LOCALE_MAP[lang] || 'ru-RU')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-gray-500">
              {t('admin.inspector_recent_activity')}
            </h3>
            {logsQuery.isLoading ? (
              <div className="space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : logsQuery.isError ? (
              <ErrorState description={t('admin.error_load_users')} onRetry={() => logsQuery.refetch()} />
            ) : !logsQuery.data?.length ? (
              <EmptyState title={t('admin.no_activity')} />
            ) : (
              <ul className="space-y-1.5">
                {logsQuery.data.slice(0, 5).map((log) => (
                  <li
                    key={String(log.id)}
                    className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-2.5 text-xs dark:bg-zinc-800/40"
                  >
                    <span className="truncate font-bold">{String(log.action)}</span>
                    <span className="shrink-0 text-gray-400">
                      {new Date(String(log.created_at)).toLocaleDateString(LOCALE_MAP[lang] || 'ru-RU')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon size={14} className="shrink-0 text-gray-400" />
      <span className="w-32 shrink-0 text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</span>
      <span className="truncate font-bold">{value}</span>
    </div>
  );
}
