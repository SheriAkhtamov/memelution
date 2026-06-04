import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  Award,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Clock,
  Flame,
  FolderOpen,
  Ghost,
  Globe,
  Heart,
  ImageOff,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageCircle,
  Pin,
  QrCode,
  Radio,
  Repeat,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { api } from '../../shared/api/client';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  Tabs,
  useToast,
} from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { PostComposer } from '../../features/posts/components/PostComposer';
import { useAuthStore } from '../../store/authStore';
import type { Post, User } from '../../shared/types';
import { trackEvent } from '../../shared/lib/analytics';

type ProfileTab = 'posts' | 'reposts' | 'media' | 'likes' | 'communities' | 'collections';

interface ExtendedUser extends User {
  is_online?: boolean;
  last_seen?: string;
  theme_color?: string;
}

interface ExtendedProfile {
  user: ExtendedUser;
  is_following: boolean;
  is_blocked: boolean;
  posts: Post[];
  communities: Array<{ id: string; name: string; slug: string; description: string; avatar_url?: string }>;
  collections?: Array<{ id: string; name: string; posts_count: number }>;
  liked_posts?: Post[];
  reposted_posts?: Post[];
  mutuals?: ExtendedUser[];
}

function useParallax(ref: React.RefObject<HTMLDivElement | null>, rate = 0.2) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scroll = window.scrollY;
        node.style.transform = `translateY(${scroll * rate}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref, rate]);
}

function achievementBadgeClasses(index: number) {
  const palette = [
    'bg-amber-50 text-amber-700 ring-amber-200 shadow-amber-100',
    'bg-purple-50 text-purple-700 ring-purple-200 shadow-purple-100',
    'bg-sky-50 text-sky-700 ring-sky-200 shadow-sky-100',
    'bg-emerald-50 text-emerald-700 ring-emerald-200 shadow-emerald-100',
    'bg-rose-50 text-rose-700 ring-rose-200 shadow-rose-100',
  ];
  return palette[index % palette.length];
}

function ProfileQRCard({ user, open, onClose }: { user: ExtendedUser; open: boolean; onClose: () => void }) {
  if (!open) return null;
  const url = `${window.location.origin}/user/${user.username}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  return (
    <Modal open={open} onClose={onClose} title="Карточка профиля">
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-zinc-900">
          <Avatar src={user.avatar_url} name={user.display_name} className="h-14 w-14 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate font-black text-gray-900 dark:text-white">{user.display_name}</p>
            <p className="truncate text-sm font-bold text-gray-400">@{user.username}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100 dark:bg-zinc-950 dark:ring-zinc-800">
          <img src={qrUrl} alt="QR код профиля" className="h-48 w-48 rounded-xl" />
        </div>
        <p className="text-center text-xs font-bold text-gray-400">Отсканируйте, чтобы открыть профиль</p>
      </div>
    </Modal>
  );
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [unfollowConfirm, setUnfollowConfirm] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [showGamification, setShowGamification] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  useParallax(coverRef, 0.15);

  const query = useQuery<ExtendedProfile>({
    queryKey: ['profile', username],
    queryFn: () => api.profile(username) as Promise<ExtendedProfile>,
    enabled: Boolean(username),
  });
  const followersQuery = useQuery({
    queryKey: ['followers', username],
    queryFn: () => api.followers(username),
    enabled: followersOpen,
  });
  const followingQuery = useQuery({
    queryKey: ['following', username],
    queryFn: () => api.following(username),
    enabled: followingOpen,
  });
  const mutualsQuery = useQuery({
    queryKey: ['mutuals', username],
    queryFn: () => api.mutuals(username),
    enabled: Boolean(username) && !query.isLoading,
  });

  const follow = useMutation({
    mutationFn: () => api.follow(username, query.data?.is_following),
    onSuccess: (result) => {
      if (result.is_following) {
        trackEvent('user_followed', {
          username,
          user_id: query.data?.user.id,
          source: 'profile_header',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    },
  });
  const chat = useMutation({
    mutationFn: () => api.createChat(username),
    onSuccess: (result) => navigate(`/messages?chat=${result.id}`),
  });

  if (query.isLoading)
    return (
      <div className="min-h-screen bg-[#F3F4F6] p-3 dark:bg-zinc-950 sm:p-4">
        <Skeleton className="h-96" />
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="min-h-screen bg-[#F3F4F6] p-3 dark:bg-zinc-950 sm:p-4">
        <ErrorState
          description={query.error instanceof Error ? query.error.message : 'Профиль не найден'}
          onRetry={() => query.refetch()}
        />
      </div>
    );

  const data = query.data;
  const own = user?.id === data.user.id;
  const level = data.user.achievement_level || 1;
  const xpTarget = level * 150 + 50;
  const xpCurrent = data.user.activity_score || 0;
  const xpProgress = Math.min(100, Math.round((xpCurrent / xpTarget) * 100));
  const achievements = data.user.achievements || [];
  const joinedAt = data.user.created_at
    ? new Date(data.user.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    : null;

  const accentColor = data.user.theme_color || '#FF6B00';
  const hasCustomTheme = Boolean(data.user.theme_color) || (level >= 10 && false); // если бэкенд пришлёт theme_color, будет работать
  const themeStyle = { '--theme-color': accentColor } as React.CSSProperties;

  const pinnedPost = data.posts.find((p) => p.is_pinned);
  const tabPosts = data.posts.filter((post) => {
    if (post.is_pinned) return false;
    if (tab === 'media') return Boolean(post.media_url || post.media_items?.length);
    return true;
  });

  const mutuals = data.mutuals ?? mutualsQuery.data ?? [];

  const tabCounts: Record<ProfileTab, number> = {
    posts: data.user.posts_count ?? data.posts.length,
    reposts: data.reposted_posts?.length ?? 0,
    media: data.posts.filter((p) => p.media_url || p.media_items?.length).length,
    likes: data.liked_posts?.length ?? 0,
    communities: data.communities.length,
    collections: data.collections?.length ?? 0,
  };

  const shareProfile = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/user/${data.user.username}`);
    toast.show({ title: 'Ссылка на профиль скопирована', tone: 'success' });
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-[#F3F4F6]/90 px-3 py-3 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/90 sm:px-4">
        <h1 className="text-xl font-black">@{data.user.username}</h1>
      </header>

      <div className="space-y-5 p-3 sm:p-4">
        {/* Profile Card */}
        <section
          className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900"
          style={hasCustomTheme ? themeStyle : undefined}
        >
          {/* Cover */}
          <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#FF6B00] via-fuchsia-600 to-sky-500 sm:h-56">
            <div ref={coverRef} className="absolute inset-0">
              {data.user.cover_url ? (
                <img src={data.user.cover_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          <div className="relative z-10 p-5">
            <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
              <div className="relative">
                <Avatar
                  src={data.user.avatar_url}
                  name={data.user.display_name}
                  className="h-28 w-28 rounded-2xl border-4 border-white shadow-lg dark:border-zinc-900"
                />
                {data.user.is_online ? (
                  <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-sm dark:border-zinc-900" />
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {own ? (
                  <Link to="/settings">
                    <Button variant="outline">Редактировать</Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      onClick={() => (data.is_following ? setUnfollowConfirm(true) : follow.mutate())}
                      loading={follow.isPending}
                      className="transition-all duration-200 active:scale-95"
                    >
                      {data.is_following ? 'Отписаться' : 'Подписаться'}
                    </Button>
                    <Button variant="outline" onClick={() => chat.mutate()} loading={chat.isPending}>
                      <Mail size={16} /> Сообщение
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={shareProfile}>
                  <Share2 size={16} />
                </Button>
                <Button variant="outline" onClick={() => setQrOpen(true)}>
                  <QrCode size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black">{data.user.display_name}</h2>
                {data.user.role === 'global_admin' ? (
                  <BadgeCheck size={22} className="shrink-0 fill-blue-500 text-white" />
                ) : null}
                {data.user.role === 'global_admin' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-100 to-orange-100 px-2.5 py-0.5 text-xs font-black text-amber-800 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-amber-400">
                    👑 Основатель
                  </span>
                ) : null}
                {data.user.is_verified ? <Badge>Проверен</Badge> : null}
              </div>
              <p className="font-bold text-gray-400">@{data.user.username}</p>

              {/* Online / Last seen */}
              <div className="mt-1">
                {data.user.is_online ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-500">
                    <Radio size={12} className="animate-pulse" />
                    в сети
                  </span>
                ) : data.user.last_seen ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-400">
                    <Clock size={12} />
                    был(а) {formatDistanceToNow(new Date(data.user.last_seen), { addSuffix: true, locale: ru })}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-gray-700 dark:text-zinc-300">
                {data.user.bio || 'Пользователь Мемолюции'}
              </p>

              {/* Compact meta row */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-gray-500 dark:text-zinc-400">
                {data.user.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} />
                    {data.user.location}
                  </span>
                ) : null}
                {data.user.website ? (
                  <a
                    href={data.user.website}
                    className="inline-flex items-center gap-1 hover:underline"
                    style={{ color: hasCustomTheme ? 'var(--theme-color)' : '#FF6B00' }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LinkIcon size={14} />
                    {data.user.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
                {joinedAt ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={14} />
                    С нами с {joinedAt}
                  </span>
                ) : null}
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-2">
                {(data.user.interests || []).map((interest) => {
                  const tagName = interest.replace(/^#/, '').trim();
                  if (!tagName) return null;
                  return (
                    <Link key={interest} to={`/hashtag/${encodeURIComponent(tagName)}`}>
                      <Badge>#{tagName}</Badge>
                    </Link>
                  );
                })}
              </div>

              {/* Stats grid */}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="group rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/60">
                  <strong className="block text-xl font-black text-gray-950 transition-transform group-hover:scale-105 dark:text-white">
                    {data.user.posts_count ?? data.posts.length}
                  </strong>
                  <span className="text-xs font-black uppercase tracking-wide text-gray-400">постов</span>
                </div>
                <button
                  onClick={() => setFollowersOpen(true)}
                  className="group rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                >
                  <strong className="block text-xl font-black text-gray-950 transition-transform group-hover:scale-105 dark:text-white">
                    {data.user.followers_count ?? 0}
                  </strong>
                  <span className="text-xs font-black uppercase tracking-wide text-gray-400">подписчиков</span>
                </button>
                <button
                  onClick={() => setFollowingOpen(true)}
                  className="group rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                >
                  <strong className="block text-xl font-black text-gray-950 transition-transform group-hover:scale-105 dark:text-white">
                    {data.user.following_count ?? 0}
                  </strong>
                  <span className="text-xs font-black uppercase tracking-wide text-gray-400">подписок</span>
                </button>
              </div>

              {!own ? (
                <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm font-bold text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200">
                  {data.is_following
                    ? `Посты @${data.user.username} уже попадают в вашу ленту подписок.`
                    : `Подпишитесь на @${data.user.username}, чтобы чаще видеть его мемы и ответы.`}
                </div>
              ) : null}

              {/* Achievements / Gamification — progressive disclosure */}
              {achievements.length ? (
                <div className="mt-4">
                  <button
                    onClick={() => setShowGamification((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60"
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-zinc-100">
                      <Zap size={16} className="text-amber-500" />
                      Уровень {level} · {achievements.filter((a) => a.unlocked).length} достижений
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-gray-400 transition-transform ${showGamification ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showGamification ? (
                    <div className="mt-2 space-y-3 rounded-2xl bg-gray-50 p-4 shadow-sm dark:bg-zinc-800/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">
                          {xpCurrent}/{xpTarget} XP
                        </span>
                        <span className="text-xs font-bold text-gray-500">{xpProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${xpProgress}%`,
                            backgroundColor: hasCustomTheme ? 'var(--theme-color)' : '#FF6B00',
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {achievements.map((achievement, idx) => (
                          <span
                            key={achievement.id}
                            title={achievement.description}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ring-1 shadow-sm drop-shadow-sm ${
                              achievement.unlocked
                                ? achievementBadgeClasses(idx)
                                : 'bg-white text-gray-400 ring-gray-200 dark:bg-zinc-950 dark:text-zinc-500 dark:ring-zinc-800'
                            }`}
                          >
                            <Sparkles size={13} />
                            {achievement.title}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-black text-gray-700 shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
                          <Activity size={14} className="text-emerald-500" />
                          Активность {data.user.activity_score ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-black text-gray-700 shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
                          <Flame size={14} className="text-rose-500" />
                          Рейтинг {data.user.meme_rating ?? 0}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Mutuals — compact avatars + count */}
              {mutuals.length > 0 ? (
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {mutuals.slice(0, 4).map((m) => (
                      <Avatar
                        key={m.id}
                        src={m.avatar_url}
                        name={m.display_name}
                        className="h-7 w-7 rounded-full border-2 border-white dark:border-zinc-900"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">
                    {mutuals.length} взаимных
                  </span>
                </div>
              ) : null}

            </div>
          </div>
        </section>

        {/* Pinned post */}
        {pinnedPost ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-black" style={{ color: hasCustomTheme ? 'var(--theme-color)' : '#FF6B00' }}>
              <Pin size={14} />
              Закреплено
            </div>
            <PostCard post={pinnedPost as any} />
          </div>
        ) : null}

        {/* Sticky Tabs — 4 primary + progressive disclosure for More */}
        <div className="sticky top-14 z-10 -mx-3 bg-white/90 px-3 py-2 backdrop-blur dark:bg-zinc-950/90 sm:-mx-4 sm:px-4">
          <Tabs
            value={(['reposts', 'communities', 'collections'] as string[]).includes(tab) ? 'more' : tab}
            onChange={(value) => {
              if (value === 'more') setTab('reposts');
              else setTab(value as ProfileTab);
            }}
            items={[
              { id: 'posts', label: `Посты` },
              { id: 'media', label: `Медиа` },
              { id: 'likes', label: `Лайки` },
              { id: 'more', label: `Ещё` },
            ]}
          />
          {(['reposts', 'communities', 'collections'] as string[]).includes(tab) ? (
            <div className="mt-2 flex gap-1">
              {(
                [
                  { id: 'reposts', label: `Репосты ${tabCounts.reposts ? `(${tabCounts.reposts})` : ''}` },
                  { id: 'communities', label: `Сообщества ${tabCounts.communities ? `(${tabCounts.communities})` : ''}` },
                  { id: 'collections', label: `Коллекции ${tabCounts.collections ? `(${tabCounts.collections})` : ''}` },
                ] as Array<{ id: ProfileTab; label: string }>
              ).map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setTab(sub.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    tab === sub.id
                      ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-950/30'
                      : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {own && (tab === 'posts' || tab === 'media') ? (
          <PostComposer onCreated={() => queryClient.invalidateQueries({ queryKey: ['profile', username] })} />
        ) : null}

        {tab === 'communities' ? (
          data.communities.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.communities.map((community) => (
                <Link
                  key={community.id}
                  to={`/communities/${community.slug}`}
                  className="rounded-2xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <p className="font-black">{community.name}</p>
                  <p className="line-clamp-2 text-sm text-gray-500">{community.description}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Сообществ пока нет"
              description="Пользователь пока не вступил ни в одно сообщество. Одиночка."
              icon={<Users size={40} />}
            />
          )
        ) : tab === 'likes' ? (
          data.liked_posts?.length ? (
            <div className="space-y-5">
              {data.liked_posts.map((post) => (
                <PostCard key={post.id} post={post as any} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Лайки скрыты"
              description="Пользователь решил сохранить свои лайки в тайне."
              icon={<Heart size={40} />}
            />
          )
        ) : tab === 'reposts' ? (
          data.reposted_posts?.length ? (
            <div className="space-y-5">
              {data.reposted_posts.map((post) => (
                <PostCard key={post.id} post={post as any} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Репостов пока нет"
              description="Информация пока не хочет быть свободной."
              icon={<Repeat size={40} />}
            />
          )
        ) : tab === 'collections' ? (
          data.collections?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.collections.map((collection) => (
                <Link
                  key={collection.id}
                  to={`/saved?collection=${collection.id}`}
                  className="rounded-2xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <p className="font-black">{collection.name}</p>
                  <p className="text-sm text-gray-500">{collection.posts_count} постов</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Публичных коллекций нет"
              description="Пользователь ещё не создал коллекций."
              icon={<FolderOpen size={40} />}
            />
          )
        ) : tabPosts.length ? (
          <div className="space-y-5">
            {tabPosts.map((post) => (
              <PostCard key={post.id} post={post as any} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Здесь так пусто, что слышно эхо"
            description={own ? 'Скинь сюда мем!' : 'Пользователь ещё ничего не публиковал.'}
            icon={<Wind size={40} />}
          />
        )}
      </div>

      <ConfirmDialog
        open={unfollowConfirm}
        onClose={() => setUnfollowConfirm(false)}
        title="Отписаться?"
        description={`Вы больше не будете видеть посты @${data.user.username} в ленте подписок.`}
        confirmText="Отписаться"
        onConfirm={() => {
          follow.mutate();
          setUnfollowConfirm(false);
        }}
      />
      <UserListModal
        open={followersOpen}
        title="Подписчики"
        users={followersQuery.data || []}
        onClose={() => setFollowersOpen(false)}
      />
      <UserListModal
        open={followingOpen}
        title="Подписки"
        users={followingQuery.data || []}
        onClose={() => setFollowingOpen(false)}
      />
      <ProfileQRCard user={data.user} open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}

function UserListModal({
  open,
  title,
  users,
  onClose,
}: {
  open: boolean;
  title: string;
  users: Array<{ id: string; username: string; display_name: string; avatar_url?: string }>;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-2">
        {users.length ? (
          users.map((item) => (
            <Link
              key={item.id}
              to={`/user/${item.username}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900"
            >
              <Avatar src={item.avatar_url} name={item.display_name} />
              <span>
                <span className="block font-black">{item.display_name}</span>
                <span className="text-sm text-gray-400">@{item.username}</span>
              </span>
            </Link>
          ))
        ) : (
          <EmptyState title="Список пуст" />
        )}
      </div>
    </Modal>
  );
}
