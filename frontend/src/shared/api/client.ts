import type {
  AdminCommentItem,
  AdminCommunityItem,
  AdminHashtagItem,
  AdminModerationAnalytics,
  AdminPostItem,
  AdminSessionItem,
  AdminSystemHealth,
  AdminTimeseries,
  AdminTopResponse,
  Chat,
  ChatDetail,
  Comment,
  Community,
  FeedTab,
  Message,
  NotificationItem,
  PageResponse,
  Post,
  SaveCollection,
  TrendResponse,
  User,
} from '../types';

import type {
  CommunityPayload,
  CreatePostParams,
} from '../types';

export const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiWsBase() {
  const httpBase = API_BASE || window.location.origin;
  return httpBase.replace(/^http/, 'ws');
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, status: number, code = 'API_ERROR', details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Failed to perform action. Please try again.'): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Session expired. Please log in again and retry.';
    if (error.status === 403) return 'Insufficient permissions for this action. Check your account or contact an administrator.';
    if (error.status === 404) return 'Requested data not found. Refresh the page and try again.';
    if (error.status >= 500) return 'Server temporarily unavailable. Please wait and try again.';
    return error.message || fallback;
  }
  if (error instanceof TypeError) {
    return 'Failed to connect to server. Check your internet connection and try again.';
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function token() {
  return localStorage.getItem('auth_token');
}

function requestHeaders(body?: BodyInit | null): HeadersInit {
  const authToken = token();
  const result: HeadersInit = {};
  if (authToken) result.Authorization = `Bearer ${authToken}`;
  if (!(body instanceof FormData)) result['Content-Type'] = 'application/json';
  return result;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = init.body ?? null;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...requestHeaders(body), ...(init.headers || {}) },
    });
  } catch (error) {
    throw new ApiError(getApiErrorMessage(error), 0, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    let message = response.statusText || 'API Error';
    let code = `HTTP_${response.status}`;
    let details: Record<string, unknown> = {};
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error.message || message;
        code = data.error.code || code;
        details = data.error.details || {};
      } else {
        message = data.detail || data.error || message;
      }
    } catch {
      // Non-JSON responses still become typed errors.
    }
    if (response.status === 401) {
      localStorage.removeItem('auth_token');
    }
    throw new ApiError(message, response.status, code, details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function postForm(payload: CreatePostParams) {
  const form = new FormData();
  form.set('text', payload.text || '');
  form.set('type', payload.type || 'text');
  if (payload.community_id) form.set('community_id', payload.community_id);
  if (payload.media_alt) form.set('media_alt', payload.media_alt);
  if (payload.visibility) form.set('visibility', payload.visibility);
  if (payload.status) form.set('status', payload.status);
  if (payload.comments_enabled !== undefined) form.set('comments_enabled', String(payload.comments_enabled));
  if (payload.poll_options) form.set('poll_options', JSON.stringify(payload.poll_options));
  if (payload.poll_settings) form.set('poll_settings', JSON.stringify(payload.poll_settings));
  if (payload.file) form.set('media', payload.file);
  payload.files?.forEach((file) => form.append('media_files', file));
  return form;
}

export const api = {
  telegramLogin: (payload: Record<string, unknown>) =>
    request<{ token: string; user: User }>('/api/auth/telegram', { method: 'POST', body: JSON.stringify(payload) }),
  telegramStartUrl: (redirectTo = '/') =>
    `${API_BASE}/api/auth/telegram/start?redirect_to=${encodeURIComponent(redirectTo)}`,
  adminLogin: (payload: { login: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/admin-login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request<User>('/api/me'),
  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  sessions: () => request<Array<Record<string, string | boolean>>>('/api/auth/sessions'),
  revokeSessions: () => request<{ success: boolean }>('/api/auth/sessions', { method: 'DELETE' }),
  updateMe: (payload: Partial<User>) => request<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadMedia: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return request<{ id: string; url: string; file_url: string; file_type: string; file_size: number }>('/api/media', { method: 'POST', body: form });
  },
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return request<User>('/api/users/me/avatar', { method: 'POST', body: form });
  },
  uploadCover: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return request<User>('/api/users/me/cover', { method: 'POST', body: form });
  },

  feed: (feed: FeedTab = 'for-you', cursor?: string | null, communityId?: string, limit = 20) => {
    const params = new URLSearchParams({ feed, limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (communityId) params.set('community_id', communityId);
    return request<PageResponse<Post>>(`/api/posts?${params.toString()}`);
  },
  trends: (period: 'day' | 'week' = 'day') => request<TrendResponse>(`/api/trends?period=${period}`),
  createPost: (payload: CreatePostParams) => request<Post>('/api/posts', { method: 'POST', body: postForm(payload) }),
  post: (id: string) => request<{ post: Post; comments: Comment[]; comments_next_cursor?: string | null; related: Post[] }>(`/api/posts/${id}`),
  updatePost: (id: string, payload: { text: string; comments_enabled?: boolean }) => {
    const form = new FormData();
    form.set('text', payload.text);
    form.set('comments_enabled', String(payload.comments_enabled ?? true));
    return request<Post>(`/api/posts/${id}`, { method: 'PATCH', body: form });
  },
  deletePost: (id: string) => request<{ success: boolean }>(`/api/posts/${id}`, { method: 'DELETE' }),
  restorePost: (id: string) => request<{ success: boolean; post: Post }>(`/api/posts/${id}/restore`, { method: 'POST' }),
  likePost: (id: string, liked?: boolean) =>
    request<{ liked: boolean; likes_count: number }>(`/api/posts/${id}/like`, { method: liked ? 'DELETE' : 'POST' }),
  repostPost: (id: string, comment?: string, community_id?: string) =>
    request<{ reposted: boolean; reposts_count: number }>(`/api/posts/${id}/repost`, {
      method: 'POST',
      body: JSON.stringify({ comment, community_id }),
    }),
  unrepostPost: (id: string) =>
    request<{ reposted: boolean; reposts_count: number }>(`/api/posts/${id}/repost`, { method: 'DELETE' }),
  savePost: (id: string, saved?: boolean, collection_id?: string) =>
    request<{ saved: boolean; saves_count: number }>(`/api/posts/${id}/save`, {
      method: saved ? 'DELETE' : 'POST',
      body: saved ? undefined : JSON.stringify({ collection_id }),
    }),
  hidePost: (id: string) => request<{ success: boolean; hidden: boolean }>(`/api/posts/${id}/hide`, { method: 'POST' }),
  unhidePost: (id: string) => request<{ success: boolean; hidden: boolean }>(`/api/posts/${id}/hide`, { method: 'DELETE' }),
  reactPost: (id: string, emoji: string) =>
    request<{ reactions: Array<{ emoji: string; count: number; reacted: boolean }> }>(`/api/posts/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'POST' }),
  unreactPost: (id: string, emoji: string) =>
    request<{ reactions: Array<{ emoji: string; count: number; reacted: boolean }> }>(`/api/posts/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
  reportPost: (id: string, payload: { reason: string; description?: string }) =>
    request<{ id: string; status: string }>(`/api/posts/${id}/report`, { method: 'POST', body: JSON.stringify(payload) }),
  pinPost: (id: string, pinned: boolean, scope: 'profile' | 'community' = 'profile') =>
    request<{ success: boolean; post: Post }>(`/api/posts/${id}/pin`, { method: 'POST', body: JSON.stringify({ pinned, scope }) }),
  votePoll: (postId: string, option_id: string) =>
    request<{ success: boolean; post: Post }>(`/api/posts/${postId}/poll/vote`, { method: 'POST', body: JSON.stringify({ option_id }) }),
  unvotePoll: (postId: string) =>
    request<{ success: boolean; post: Post }>(`/api/posts/${postId}/poll/vote`, { method: 'DELETE' }),

  comments: (postId: string, sort = 'popular', cursor?: string | null) => {
    const params = new URLSearchParams({ sort });
    if (cursor) params.set('cursor', cursor);
    return request<PageResponse<Comment>>(`/api/posts/${postId}/comments?${params.toString()}`);
  },
  comment: (postId: string, text: string, parent_comment_id?: string) =>
    request<Comment>(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text, parent_comment_id }) }),
  updateComment: (id: string, text: string) =>
    request<Comment>(`/api/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
  deleteComment: (id: string) => request<{ success: boolean }>(`/api/comments/${id}`, { method: 'DELETE' }),
  restoreComment: (id: string) => request<{ success: boolean; comment: Comment }>(`/api/comments/${id}/restore`, { method: 'POST' }),
  likeComment: (id: string, liked?: boolean) =>
    request<{ liked: boolean; likes_count: number }>(`/api/comments/${id}/like`, { method: liked ? 'DELETE' : 'POST' }),
  reactComment: (id: string, emoji: string) =>
    request<{ reactions: Array<{ emoji: string; count: number; reacted: boolean }> }>(`/api/comments/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'POST' }),
  unreactComment: (id: string, emoji: string) =>
    request<{ reactions: Array<{ emoji: string; count: number; reacted: boolean }> }>(`/api/comments/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' }),

  saved: (q = '', collection_id?: string, sort = 'saved_desc') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (collection_id) params.set('collection_id', collection_id);
    if (sort !== 'saved_desc') params.set('sort', sort);
    return request<Post[]>(`/api/saved${params.size ? `?${params.toString()}` : ''}`);
  },
  saveCollections: () => request<SaveCollection[]>('/api/save-collections'),
  createSaveCollection: (payload: { name: string; description?: string; visibility?: 'private' | 'public' }) =>
    request<SaveCollection>('/api/save-collections', { method: 'POST', body: JSON.stringify(payload) }),
  saveCollection: (id: string) => request<{ collection: SaveCollection; posts: Post[] }>(`/api/save-collections/${id}`),
  updateSaveCollection: (id: string, payload: Partial<Pick<SaveCollection, 'name' | 'description' | 'visibility' | 'sort_order'>>) =>
    request<SaveCollection>(`/api/save-collections/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSaveCollection: (id: string) => request<{ success: boolean }>(`/api/save-collections/${id}`, { method: 'DELETE' }),
  moveSavedPost: (collectionId: string, postId: string, targetCollectionId: string) =>
    request<{ success: boolean; collection_id: string }>(`/api/save-collections/${collectionId}/posts/${postId}/move`, {
      method: 'POST',
      body: JSON.stringify({ collection_id: targetCollectionId }),
    }),

  profile: (username: string) =>
    request<{ user: User; is_following: boolean; is_blocked: boolean; posts: Post[]; communities: Community[]; collections?: SaveCollection[]; liked_posts?: Post[]; reposted_posts?: Post[] }>(
      `/api/users/${username.replace('@', '')}`,
    ),
  follow: (username: string, following?: boolean) =>
    request<{ is_following: boolean }>(`/api/users/${username}/follow`, { method: following ? 'DELETE' : 'POST' }),
  block: (username: string, blocked?: boolean) =>
    request<{ is_blocked: boolean }>(`/api/users/${username}/block`, { method: blocked ? 'DELETE' : 'POST' }),
  followers: (username: string) => request<User[]>(`/api/users/${username}/followers`),
  following: (username: string) => request<User[]>(`/api/users/${username}/following`),
  checkUsername: (username: string) => request<{ available: boolean }>(`/api/users/check?username=${encodeURIComponent(username)}`),
  mutuals: (username: string) => request<User[]>(`/api/users/${username}/mutuals`),

  communities: (q = '') => request<Community[]>(`/api/communities${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createCommunity: (payload: CommunityPayload & { name: string }) =>
    request<Community>('/api/communities', { method: 'POST', body: JSON.stringify(payload) }),
  updateCommunity: (slug: string, payload: CommunityPayload) =>
    request<Community>(`/api/communities/${slug}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadCommunityAvatar: (slug: string, file: File) => {
    const form = new FormData();
    form.set('file', file);
    return request<Community>(`/api/communities/${slug}/avatar`, { method: 'POST', body: form });
  },
  uploadCommunityCover: (slug: string, file: File) => {
    const form = new FormData();
    form.set('file', file);
    return request<Community>(`/api/communities/${slug}/cover`, { method: 'POST', body: form });
  },
  community: (slug: string, tab = 'feed') =>
    request<{ community: Community; membership?: string; role?: string; posts: Post[]; moderators: User[]; analytics?: Record<string, number> }>(
      `/api/communities/${slug}?tab=${tab}`,
    ),
  joinCommunity: (slug: string, joined?: boolean) =>
    request<{ membership: string | null }>(`/api/communities/${slug}/join`, { method: joined ? 'DELETE' : 'POST' }),
  communityMembers: (slug: string) => request<Array<{ id?: string; user: User; role: string; membership: string }>>(`/api/communities/${slug}/members`),
  communityRequests: (slug: string) => request<Array<{ id: string; user: User; role: string; membership: string }>>(`/api/communities/${slug}/requests`),
  communityBanList: (slug: string) => request<Array<{ id: string; user: User; role: string }>>(`/api/communities/${slug}/ban-list`),
  inviteCommunityMember: (slug: string, username: string) =>
    request<{ success: boolean; invite_id: string }>(`/api/communities/${slug}/invite`, { method: 'POST', body: JSON.stringify({ username }) }),
  approveCommunityRequest: (slug: string, id: string) => request<{ success: boolean }>(`/api/communities/${slug}/requests/${id}/approve`, { method: 'POST' }),
  rejectCommunityRequest: (slug: string, id: string) => request<{ success: boolean }>(`/api/communities/${slug}/requests/${id}/reject`, { method: 'POST' }),
  updateCommunityRole: (slug: string, id: string, role: string) =>
    request<{ success: boolean }>(`/api/communities/${slug}/members/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
  banCommunityMember: (slug: string, id: string) => request<{ success: boolean }>(`/api/communities/${slug}/members/${id}/ban`, { method: 'POST' }),
  unbanCommunityMember: (slug: string, id: string) => request<{ success: boolean }>(`/api/communities/${slug}/members/${id}/unban`, { method: 'POST' }),

  search: (q: string, type = 'all') =>
    request<{ people?: User[]; posts?: Post[]; communities?: Community[]; hashtags?: Array<{ id: string; name: string; posts_count: number }> }>(
      `/api/search?q=${encodeURIComponent(q)}&type=${type}`,
    ),
  searchAutocomplete: (q = '') =>
    request<{ queries: string[]; people: User[]; communities: Community[]; hashtags: Array<{ id: string; name: string; posts_count: number }> }>(
      `/api/search/autocomplete?q=${encodeURIComponent(q)}`,
    ),
  hashtag: (name: string, tab = 'popular') =>
    request<{ hashtag: { id: string; name: string; posts_count: number; is_following: boolean }; posts: Post[]; related: Array<{ id: string; name: string; posts_count: number }> }>(
      `/api/hashtags/${encodeURIComponent(name)}?tab=${tab}`,
    ),
  followHashtag: (name: string, following?: boolean) =>
    request<{ is_following: boolean }>(`/api/hashtags/${encodeURIComponent(name)}/follow`, { method: following ? 'DELETE' : 'POST' }),

  notifications: () => request<NotificationItem[]>('/api/notifications'),
  notificationSettings: () => request<Record<string, unknown>>('/api/notifications/settings'),
  updateNotificationSettings: (settings: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/notifications/settings', { method: 'PATCH', body: JSON.stringify({ settings }) }),
  readNotification: (id: string) => request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request<{ success: boolean; updated: number }>('/api/notifications/read-all', { method: 'POST' }),

  chats: () => request<Chat[]>('/api/chats'),
  chatDetail: (chatId: string) => request<ChatDetail>(`/api/chats/${chatId}`),
  createChat: (username: string) => request<{ id: string }>('/api/chats', { method: 'POST', body: JSON.stringify({ username }) }),
  leaveChat: (chatId: string) => request<{ success: boolean }>(`/api/chats/${chatId}`, { method: 'DELETE' }),
  messages: (chatId: string, cursor?: string | null) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    return request<PageResponse<Message>>(`/api/chats/${chatId}/messages${params.size ? `?${params.toString()}` : ''}`);
  },
  sendMessage: (chatId: string, text: string, shared_post_id?: string, media_url?: string, reply_to_message_id?: string) =>
    request<Message>(`/api/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ text, shared_post_id, media_url, reply_to_message_id }) }),
  updateMessage: (id: string, text: string) =>
    request<{ success: boolean }>(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
  deleteMessage: (id: string) => request<{ success: boolean }>(`/api/messages/${id}`, { method: 'DELETE' }),
  reactMessage: (id: string, emoji: string) =>
    request<{ reactions: Array<{ emoji: string; count: number; reacted: boolean }> }>(`/api/messages/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'POST' }),
  unreactMessage: (id: string, emoji: string) =>
    request<{ reactions: Array<{ emoji: string; count: number; reacted: boolean }> }>(`/api/messages/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
  forwardMessage: (messageId: string, chatId: string) =>
    request<Message>(`/api/messages/${messageId}/forward?chat_id=${encodeURIComponent(chatId)}`, { method: 'POST' }),
  updateChatSettings: (chatId: string, payload: { is_pinned?: boolean; is_archived?: boolean; muted_until?: string | null }) =>
    request<{ success: boolean }>(`/api/chats/${chatId}/settings`, { method: 'POST', body: JSON.stringify(payload) }),
  readChat: (chatId: string) => request<{ success: boolean }>(`/api/chats/${chatId}/read`, { method: 'POST' }),

  report: (payload: { target_type: string; target_id: string; reason: string; description?: string }) =>
    request<{ id: string; status: string }>('/api/reports', { method: 'POST', body: JSON.stringify(payload) }),
  myReports: () => request<Array<Record<string, unknown>>>('/api/reports/my'),
  adminStats: () => request<Record<string, number>>('/api/admin/stats'),
  adminUsers: (params: { q?: string; role?: string; banned?: boolean } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.role) search.set('role', params.role);
    if (params.banned !== undefined) search.set('banned', String(params.banned));
    return request<User[]>(`/api/admin/users${search.size ? `?${search.toString()}` : ''}`);
  },
  setUserRole: (id: string, role: string) =>
    request<{ success: boolean; user: User }>(`/api/admin/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
  moderateUser: (
    id: string,
    payload: { is_banned?: boolean; duration_hours?: number | null; reason?: string; restrictions?: Record<string, boolean> },
  ) => request<{ success: boolean; user: User }>(`/api/admin/users/${id}/moderation`, { method: 'POST', body: JSON.stringify(payload) }),
  adminReports: (status?: string) => request<Array<Record<string, unknown>>>(`/api/admin/reports${status ? `?status=${status}` : ''}`),
  resolveReport: (id: string, status = 'resolved', action?: string) =>
    request<{ success: boolean }>(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status, action }) }),
  adminLogs: () => request<Array<Record<string, unknown>>>('/api/admin/logs'),
  adminLogsFiltered: (params: { action?: string; target_type?: string; moderator_id?: string; q?: string; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.action) search.set('action', params.action);
    if (params.target_type) search.set('target_type', params.target_type);
    if (params.moderator_id) search.set('moderator_id', params.moderator_id);
    if (params.q) search.set('q', params.q);
    if (params.limit) search.set('limit', String(params.limit));
    return request<Array<Record<string, unknown>>>(`/api/admin/logs${search.size ? `?${search.toString()}` : ''}`);
  },

  // Posts
  adminPosts: (params: {
    q?: string;
    type?: string;
    author_id?: string;
    community_id?: string;
    is_deleted?: boolean;
    is_pinned?: boolean;
    visibility?: string;
    sort?: 'new' | 'popular' | 'comments';
    limit?: number;
  } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    });
    return request<AdminPostItem[]>(`/api/admin/posts${search.size ? `?${search.toString()}` : ''}`);
  },
  adminHidePost: (id: string) =>
    request<{ success: boolean; post_id: string; hidden: boolean }>(`/api/admin/posts/${id}/hide`, { method: 'POST' }),
  adminRestorePost: (id: string) =>
    request<{ success: boolean; post_id: string; hidden: boolean }>(`/api/admin/posts/${id}/restore`, { method: 'POST' }),
  adminPinPost: (id: string, pinned: boolean) =>
    request<{ success: boolean; post_id: string; pinned: boolean }>(`/api/admin/posts/${id}/pin?pinned=${pinned}`, { method: 'POST' }),
  adminDeletePost: (id: string) =>
    request<{ success: boolean }>(`/api/admin/posts/${id}`, { method: 'DELETE' }),

  // Comments
  adminComments: (params: {
    q?: string;
    author_id?: string;
    post_id?: string;
    is_deleted?: boolean;
    limit?: number;
  } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    });
    return request<AdminCommentItem[]>(`/api/admin/comments${search.size ? `?${search.toString()}` : ''}`);
  },
  adminHideComment: (id: string) =>
    request<{ success: boolean; comment_id: string }>(`/api/admin/comments/${id}/hide`, { method: 'POST' }),
  adminRestoreComment: (id: string) =>
    request<{ success: boolean; comment_id: string }>(`/api/admin/comments/${id}/restore`, { method: 'POST' }),
  adminDeleteComment: (id: string) =>
    request<{ success: boolean }>(`/api/admin/comments/${id}`, { method: 'DELETE' }),

  // Communities
  adminCommunities: (params: {
    q?: string;
    is_banned?: boolean;
    type?: string;
    sort?: 'new' | 'members' | 'posts';
    limit?: number;
  } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    });
    return request<AdminCommunityItem[]>(`/api/admin/communities${search.size ? `?${search.toString()}` : ''}`);
  },
  adminBanCommunity: (id: string, reason: string) =>
    request<{ success: boolean }>(`/api/admin/communities/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminUnbanCommunity: (id: string) =>
    request<{ success: boolean }>(`/api/admin/communities/${id}/unban`, { method: 'POST' }),

  // Hashtags
  adminHashtags: (params: { q?: string; sort?: 'popular' | 'new' | 'alpha'; limit?: number } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    });
    return request<AdminHashtagItem[]>(`/api/admin/hashtags${search.size ? `?${search.toString()}` : ''}`);
  },
  adminDeleteHashtag: (id: string) =>
    request<{ success: boolean }>(`/api/admin/hashtags/${id}`, { method: 'DELETE' }),

  // Analytics
  adminTimeseries: (days: number) =>
    request<AdminTimeseries>(`/api/admin/analytics/timeseries?days=${days}`),
  adminTop: () => request<AdminTopResponse>('/api/admin/analytics/top'),
  adminModerationAnalytics: (days: number) =>
    request<AdminModerationAnalytics>(`/api/admin/analytics/moderation?days=${days}`),

  // Sessions
  adminSessions: (params: { limit?: number; q?: string; status?: 'all' | 'active' | 'revoked' } = { limit: 100 }) => {
    const search = new URLSearchParams();
    if (params.limit) search.set('limit', String(params.limit));
    if (params.q) search.set('q', params.q);
    if (params.status && params.status !== 'all') search.set('status', params.status);
    return request<AdminSessionItem[]>(`/api/admin/sessions${search.size ? `?${search.toString()}` : ''}`);
  },
  adminRevokeSession: (id: string) =>
    request<{ success: boolean }>(`/api/admin/sessions/${id}`, { method: 'DELETE' }),
  adminRevokeUserSessions: (userId: string) =>
    request<{ success: boolean; revoked: number }>(`/api/admin/users/${userId}/sessions/revoke-all`, { method: 'POST' }),

  // System
  adminSystem: () => request<AdminSystemHealth>('/api/admin/system'),
};
