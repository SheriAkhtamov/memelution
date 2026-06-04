export type FeedTab = 'for-you' | 'following' | 'popular' | 'new' | 'memes' | 'video' | 'polls' | 'communities' | 'local';

export interface CreatePostParams {
  text: string;
  type?: 'text' | 'meme' | 'video' | 'poll' | 'quote';
  file?: File | null;
  files?: File[];
  community_id?: string;
  media_alt?: string;
  poll_options?: Array<{ text: string }>;
  poll_settings?: { results?: 'always' | 'after_vote' };
  comments_enabled?: boolean;
  visibility?: 'public' | 'followers' | 'private';
  status?: 'published' | 'draft';
}

export interface User {
  id: string;
  telegram_id?: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  website?: string;
  language?: string;
  role?: string;
  is_verified?: boolean;
  is_banned?: boolean;
  banned_until?: string | null;
  ban_reason?: string | null;
  restrictions?: Record<string, boolean>;
  onboarding_completed?: boolean;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  interests?: string[];
  location?: string;
  privacy?: Record<string, unknown>;
  notification_settings?: Record<string, unknown>;
  created_at?: string;
  achievement_level?: number;
  activity_score?: number;
  meme_rating?: number;
  achievements?: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface Community {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url?: string;
  cover_url?: string;
  type: string;
  language: string;
  rules: string;
  settings: Record<string, unknown>;
  members_count: number;
  posts_count: number;
  membership?: string | null;
  role?: string | null;
}

export interface CommunityPayload {
  name?: string;
  slug?: string;
  description?: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  type?: string;
  language?: string;
  rules?: string;
  settings?: Record<string, unknown>;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface ReactionItem {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface Post {
  id: string;
  author_id: string;
  author: User;
  community?: Community | null;
  community_id?: string;
  parent_post_id?: string;
  type: string;
  text: string;
  media_url?: string;
  media_type?: string;
  media_alt?: string;
  media_items?: Array<{ id?: string; url: string; type?: string; alt?: string; name?: string; size?: number }>;
  poll_options?: PollOption[];
  poll_settings?: Record<string, unknown>;
  poll_total_votes?: number;
  poll_voted_option_id?: string | null;
  poll_results_visible?: boolean;
  visibility?: string;
  comments_enabled?: boolean;
  is_pinned?: boolean;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  saves_count: number;
  created_at: string;
  updated_at?: string;
  liked?: boolean;
  saved?: boolean;
  reposted?: boolean;
  reactions?: ReactionItem[];
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id?: string;
  text: string;
  likes_count: number;
  is_deleted: boolean;
  hidden_by_moderator: boolean;
  created_at: string;
  updated_at: string;
  author: User;
  liked: boolean;
  reactions?: ReactionItem[];
  replies: Comment[];
}

export interface NotificationItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface Chat {
  id: string;
  type: string;
  title?: string;
  avatar_url?: string;
  members: User[];
  latest_message?: { id: string; text: string; created_at: string };
  unread_count?: number;
}

export interface ChatMediaItem {
  id: string;
  url: string;
  created_at: string;
  sender?: User;
}

export interface ChatDetail {
  id: string;
  type: string;
  title?: string;
  avatar_url?: string;
  members: User[];
  member_roles: Array<{ user_id: string; role: string; is_pinned: boolean; is_archived: boolean; muted_until: string | null }>;
  shared_media: ChatMediaItem[];
  members_count: number;
}

export interface Message {
  id: string;
  chat_id: string;
  sender: User;
  text: string;
  media_url?: string;
  shared_post_id?: string;
  shared_post?: Post;
  reply_to_message_id?: string;
  is_pinned?: boolean;
  is_deleted: boolean;
  read_count?: number;
  reactions?: ReactionItem[];
  created_at: string;
  edited_at?: string | null;
}

export interface SaveCollection {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  description: string;
  visibility: 'private' | 'public';
  sort_order?: number;
  posts_count: number;
  created_at: string;
  updated_at?: string;
  editable?: boolean;
}

export interface PageResponse<T> {
  items: T[];
  next_cursor?: string | null;
  has_more?: boolean;
  limit?: number;
}

export interface TrendResponse {
  hashtags: Array<{ id: string; name: string; posts_count: number }>;
  rising_posts: Post[];
  active_communities: Community[];
  discussed_posts: Post[];
  popular_authors: User[];
  popular_polls: Post[];
}
