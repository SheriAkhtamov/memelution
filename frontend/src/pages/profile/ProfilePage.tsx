import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Heart,
  FolderOpen,
  Pin,
  Users,
  Wind,
  Repeat,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  Tabs,
  useToast,
  PageLayout,
  Button,
} from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { PostComposer } from '../../features/posts/components/PostComposer';
import { useAuthStore } from '../../store/authStore';
import type { Post, User } from '../../shared/types';
import { trackEvent } from '../../shared/lib/analytics';
import { useTranslation } from '../../shared/i18n';
import { ProfileHeader } from './components/ProfileHeader';

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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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



function ProfileQRCard({ user, open, onClose }: { user: ExtendedUser; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  if (!open) return null;
  const url = `${window.location.origin}/user/${user.username}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  return (
    <Modal open={open} onClose={onClose} title={t('profile.qr_title')}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-zinc-900">
          <Avatar src={user.avatar_url} name={user.display_name} className="h-14 w-14 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate font-black text-gray-900 dark:text-white">{user.display_name}</p>
            <p className="truncate text-sm font-bold text-gray-400">@{user.username}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 dark:bg-zinc-950 dark:ring-zinc-800">
          <img src={qrUrl} alt={t('profile.qr_alt')} className="h-48 w-48 rounded-xl" />
        </div>
        <p className="text-center text-xs font-bold text-gray-400">{t('profile.qr_scan_hint')}</p>
      </div>
    </Modal>
  );
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [unfollowConfirm, setUnfollowConfirm] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
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
      <div className="min-h-dvh bg-background p-3 dark:bg-zinc-950 sm:p-4">
        <Skeleton className="h-96" />
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="min-h-dvh bg-background p-3 dark:bg-zinc-950 sm:p-4">
        <ErrorState
          description={query.error instanceof Error ? query.error.message : t('profile.not_found')}
          onRetry={() => query.refetch()}
        />
      </div>
    );

  const data = query.data;
  const pinnedPost = data.posts.find((p) => p.is_pinned);
  const tabPosts = data.posts.filter((post) => {
    if (post.is_pinned) return false;
    if (tab === 'media') return Boolean(post.media_url || post.media_items?.length);
    return true;
  });

  const accentColor = data.user.theme_color || '#FF6B00';
  const themeStyle = { '--profile-accent': accentColor } as React.CSSProperties;

  const tabCounts: Record<ProfileTab, number> = {
    posts: data.user.posts_count ?? data.posts.length,
    reposts: data.reposted_posts?.length ?? 0,
    media: data.posts.filter((p) => p.media_url || p.media_items?.length).length,
    likes: data.liked_posts?.length ?? 0,
    communities: data.communities.length,
    collections: data.collections?.length ?? 0,
  };

  const own = user?.id === data.user.id;
  const shareProfile = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/user/${data.user.username}`);
    toast.show({ title: t('profile.link_copied'), tone: 'success' });
  };

  return (
    <PageLayout variant="profile" style={themeStyle} className="profile-page">
      <div className="profile-stack">
        <ProfileHeader
          data={data}
          own={own}
          followPending={follow.isPending}
          chatPending={chat.isPending}
          coverRef={coverRef}
          onFollowToggle={() => (data.is_following ? setUnfollowConfirm(true) : follow.mutate())}
          onSendMessage={() => chat.mutate()}
          onShare={shareProfile}
          onShowQR={() => setQrOpen(true)}
          onShowFollowers={() => setFollowersOpen(true)}
          onShowFollowing={() => setFollowingOpen(true)}
        />

        {pinnedPost ? (
          <section className="profile-pinned-block" aria-label={t('profile.pinned_post')}>
            <div className="profile-section-label">
              <Pin size={14} />
              {t('profile.pinned')}
            </div>
            <PostCard post={pinnedPost as Post} compact />
          </section>
        ) : null}

        <div className="profile-tabs-wrap">
          <Tabs
            value={(['reposts', 'communities', 'collections'] as string[]).includes(tab) ? 'more' : tab}
            onChange={(value) => {
              if (value === 'more') setTab('reposts');
              else setTab(value as ProfileTab);
            }}
            items={[
              { id: 'posts', label: t('profile.tab_posts') },
              { id: 'media', label: t('profile.tab_media') },
              { id: 'likes', label: t('profile.tab_likes') },
              { id: 'more', label: t('profile.tab_more') },
            ]}
          />
          {(['reposts', 'communities', 'collections'] as string[]).includes(tab) ? (
            <div className="profile-more-tabs" aria-label={t('profile.extra_tabs_label')}>
              {(
                [
                  { id: 'reposts', label: `${t('profile.tab_reposts')} ${tabCounts.reposts ? `(${tabCounts.reposts})` : ''}` },
                  { id: 'communities', label: `${t('profile.tab_communities')} ${tabCounts.communities ? `(${tabCounts.communities})` : ''}` },
                  { id: 'collections', label: `${t('profile.tab_collections')} ${tabCounts.collections ? `(${tabCounts.collections})` : ''}` },
                ] as Array<{ id: ProfileTab; label: string }>
              ).map((sub) => (
                <Button
                  key={sub.id}
                  onClick={() => setTab(sub.id)}
                  variant="ghost"
                  className="profile-more-tab h-auto"
                  data-active={tab === sub.id}
                >
                  {sub.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {own && (tab === 'posts' || tab === 'media') ? (
          <div className="profile-composer">
            <PostComposer defaultExpanded onCreated={() => queryClient.invalidateQueries({ queryKey: ['profile', username] })} />
          </div>
        ) : null}

        {tab === 'communities' ? (
          data.communities.length ? (
            <div className="profile-card-grid">
              {data.communities.map((community) => (
                <Link key={community.id} to={`/communities/${community.slug}`} className="profile-mini-card">
                  <Avatar src={community.avatar_url} name={community.name} className="profile-mini-card-avatar" />
                  <span>
                    <strong>{community.name}</strong>
                    <span>{community.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="profile-empty-wrap">
              <EmptyState
                title={t('profile.no_communities_title')}
                description={t('profile.no_communities_desc')}
                icon={<Users size={40} />}
              />
            </div>
          )
        ) : tab === 'likes' ? (
          data.liked_posts?.length ? (
            <div className="profile-post-grid">
              {data.liked_posts.map((post) => (
                <PostCard key={post.id} post={post as Post} compact />
              ))}
            </div>
          ) : (
            <div className="profile-empty-wrap">
              <EmptyState
                title={t('profile.likes_hidden_title')}
                description={t('profile.likes_hidden_desc')}
                icon={<Heart size={40} />}
              />
            </div>
          )
        ) : tab === 'reposts' ? (
          data.reposted_posts?.length ? (
            <div className="profile-post-grid">
              {data.reposted_posts.map((post) => (
                <PostCard key={post.id} post={post as Post} compact />
              ))}
            </div>
          ) : (
            <div className="profile-empty-wrap">
              <EmptyState
                title={t('profile.no_reposts_title')}
                description={t('profile.no_reposts_desc')}
                icon={<Repeat size={40} />}
              />
            </div>
          )
        ) : tab === 'collections' ? (
          data.collections?.length ? (
            <div className="profile-card-grid">
              {data.collections.map((collection) => (
                <Link key={collection.id} to={`/saved?collection=${collection.id}`} className="profile-mini-card">
                  <span className="profile-mini-card-icon">
                    <FolderOpen size={20} />
                  </span>
                  <span>
                    <strong>{collection.name}</strong>
                    <span>{t('profile.posts_count', { count: collection.posts_count })}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="profile-empty-wrap">
              <EmptyState
                title={t('profile.no_collections_title')}
                description={t('profile.no_collections_desc')}
                icon={<FolderOpen size={40} />}
              />
            </div>
          )
        ) : tabPosts.length ? (
          <div className="profile-post-grid">
            {tabPosts.map((post) => (
              <PostCard key={post.id} post={post as Post} compact />
            ))}
          </div>
        ) : (
          <div className="profile-empty-wrap">
            <EmptyState
              title={t('profile.no_posts_title')}
              description={own ? t('profile.no_posts_own_desc') : t('profile.no_posts_user_desc')}
              icon={<Wind size={40} />}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={unfollowConfirm}
        onClose={() => setUnfollowConfirm(false)}
        title={t('profile.unfollow_title')}
        description={t('profile.unfollow_desc', { username: data.user.username })}
        confirmText={t('profile.unfollow_confirm')}
        onConfirm={() => {
          follow.mutate();
          setUnfollowConfirm(false);
        }}
      />
      <UserListModal
        open={followersOpen}
        title={t('profile.followers_title')}
        users={followersQuery.data || []}
        isLoading={followersQuery.isLoading}
        onClose={() => setFollowersOpen(false)}
      />
      <UserListModal
        open={followingOpen}
        title={t('profile.following_title')}
        users={followingQuery.data || []}
        isLoading={followingQuery.isLoading}
        onClose={() => setFollowingOpen(false)}
      />
      <ProfileQRCard user={data.user} open={qrOpen} onClose={() => setQrOpen(false)} />
    </PageLayout>
  );
}

function UserListModal({
  open,
  title,
  users,
  isLoading,
  onClose,
}: {
  open: boolean;
  title: string;
  users: Array<{ id: string; username: string; display_name: string; avatar_url?: string }>;
  isLoading?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-3 py-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length ? (
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
          <EmptyState title={t('profile.empty_list')} />
        )}
      </div>
    </Modal>
  );
}
