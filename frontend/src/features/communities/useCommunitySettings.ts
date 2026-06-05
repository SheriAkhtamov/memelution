import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Community } from '../../shared/types';
import { useToast } from '../../shared/ui';
import { useTranslation } from '../../shared/i18n';

export type CommunitySettingsTab =
  | 'general'
  | 'branding'
  | 'access'
  | 'rules'
  | 'members'
  | 'banned'
  | 'moderation'
  | 'danger';

export interface CommunitySettingsState {
  name: string;
  slug: string;
  description: string;
  rules: string;
  type: 'public' | 'closed' | 'private';
  language: string;
  avatar_url: string;
  cover_url: string;
  settings: {
    premoderation: boolean;
    allow_polls: boolean;
    allow_videos: boolean;
    comments_enabled: boolean;
    hide_author: boolean;
    slow_mode_seconds: number;
  };
}

const DEFAULT_SETTINGS: CommunitySettingsState['settings'] = {
  premoderation: false,
  allow_polls: true,
  allow_videos: true,
  comments_enabled: true,
  hide_author: false,
  slow_mode_seconds: 0,
};

function fromCommunity(community: Community): CommunitySettingsState {
  const stored = (community.settings || {}) as Partial<CommunitySettingsState['settings']>;
  return {
    name: community.name || '',
    slug: community.slug || '',
    description: community.description || '',
    rules: community.rules || '',
    type: (community.type as CommunitySettingsState['type']) || 'public',
    language: community.language || 'ru',
    avatar_url: community.avatar_url || '',
    cover_url: community.cover_url || '',
    settings: { ...DEFAULT_SETTINGS, ...stored },
  };
}

function shallowEqualSettings(a: CommunitySettingsState, b: CommunitySettingsState): boolean {
  if (a.name !== b.name) return false;
  if (a.slug !== b.slug) return false;
  if (a.description !== b.description) return false;
  if (a.rules !== b.rules) return false;
  if (a.type !== b.type) return false;
  if (a.language !== b.language) return false;
  if (a.avatar_url !== b.avatar_url) return false;
  if (a.cover_url !== b.cover_url) return false;
  const keys = Object.keys(DEFAULT_SETTINGS) as Array<keyof CommunitySettingsState['settings']>;
  for (const key of keys) {
    if (a.settings[key] !== b.settings[key]) return false;
  }
  return true;
}

export function useCommunitySettings(slug: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const communityQuery = useQuery({
    queryKey: ['community', slug, 'feed'],
    queryFn: () => api.community(slug, 'feed'),
    enabled: Boolean(slug),
  });
  const community: Community | undefined = communityQuery.data?.community;

  const original = useMemo<CommunitySettingsState | null>(
    () => (community ? fromCommunity(community) : null),
    [community],
  );

  const [draft, setDraft] = useState<CommunitySettingsState | null>(original);

  useEffect(() => {
    setDraft(original);
  }, [original]);

  const isDirty = useMemo(() => {
    if (!original || !draft) return false;
    return !shallowEqualSettings(original, draft);
  }, [original, draft]);

  const update = useCallback(<K extends keyof CommunitySettingsState>(key: K, value: CommunitySettingsState[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const updateSetting = useCallback(
    <K extends keyof CommunitySettingsState['settings']>(key: K, value: CommunitySettingsState['settings'][K]) => {
      setDraft((current) => (current ? { ...current, settings: { ...current.settings, [key]: value } } : current));
    },
    [],
  );

  const reset = useCallback(() => {
    setDraft(original);
  }, [original]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft || !original) throw new Error('Nothing to save');
      const payload: Record<string, unknown> = {};
      if (draft.name !== original.name) payload.name = draft.name;
      if (draft.slug !== original.slug && draft.slug) payload.slug = draft.slug;
      if (draft.description !== original.description) payload.description = draft.description;
      if (draft.rules !== original.rules) payload.rules = draft.rules;
      if (draft.type !== original.type) payload.type = draft.type;
      if (draft.language !== original.language) payload.language = draft.language;
      if (draft.avatar_url !== original.avatar_url) payload.avatar_url = draft.avatar_url || null;
      if (draft.cover_url !== original.cover_url) payload.cover_url = draft.cover_url || null;
      const settingsChanged = (Object.keys(DEFAULT_SETTINGS) as Array<keyof CommunitySettingsState['settings']>)
        .some((key) => draft.settings[key] !== original.settings[key]);
      if (settingsChanged) payload.settings = draft.settings;
      return api.updateCommunity(slug, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.show({ title: t('community.settings_saved'), tone: 'success' });
    },
    onError: (event) => {
      toast.show({
        title: event instanceof Error ? event.message : t('community.settings_save_error'),
        tone: 'error',
      });
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => api.uploadCommunityAvatar(slug, file),
    onSuccess: (next) => {
      const url = next.avatar_url || '';
      setDraft((current) => (current ? { ...current, avatar_url: url } : current));
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      toast.show({ title: t('community.avatar_updated'), tone: 'success' });
    },
    onError: () => toast.show({ title: t('community.avatar_upload_error'), tone: 'error' }),
  });

  const uploadCover = useMutation({
    mutationFn: (file: File) => api.uploadCommunityCover(slug, file),
    onSuccess: (next) => {
      const url = next.cover_url || '';
      setDraft((current) => (current ? { ...current, cover_url: url } : current));
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      toast.show({ title: t('community.cover_updated'), tone: 'success' });
    },
    onError: () => toast.show({ title: t('community.cover_upload_error'), tone: 'error' }),
  });

  const membersQuery = useQuery({
    queryKey: ['community-members', slug],
    queryFn: () => api.communityMembers(slug),
    enabled: Boolean(slug),
  });

  const banListQuery = useQuery({
    queryKey: ['community-ban-list', slug],
    queryFn: () => api.communityBanList(slug),
    enabled: Boolean(slug),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.updateCommunityRole(slug, id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', slug] });
      toast.show({ title: t('common.done'), tone: 'success' });
    },
    onError: () => toast.show({ title: t('community.action_error'), tone: 'error' }),
  });

  const banMember = useMutation({
    mutationFn: (id: string) => api.banCommunityMember(slug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', slug] });
      queryClient.invalidateQueries({ queryKey: ['community-ban-list', slug] });
      toast.show({ title: t('community.ban_done'), tone: 'success' });
    },
    onError: () => toast.show({ title: t('community.action_error'), tone: 'error' }),
  });

  const unbanMember = useMutation({
    mutationFn: (id: string) => api.unbanCommunityMember(slug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-ban-list', slug] });
      toast.show({ title: t('community.unban_done'), tone: 'success' });
    },
    onError: () => toast.show({ title: t('community.action_error'), tone: 'error' }),
  });

  const invite = useMutation({
    mutationFn: (username: string) => api.inviteCommunityMember(slug, username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', slug] });
      toast.show({ title: t('community.invite_sent'), tone: 'success' });
    },
    onError: (event) => toast.show({
      title: event instanceof Error ? event.message : t('community.invite_error'),
      tone: 'error',
    }),
  });

  return {
    community,
    communityQuery,
    original,
    draft,
    update,
    updateSetting,
    isDirty,
    reset,
    save: saveMutation,
    uploadAvatar,
    uploadCover,
    members: membersQuery,
    banList: banListQuery,
    changeRole,
    banMember,
    unbanMember,
    invite,
  };
}

export const COMMUNITY_SETTINGS_SECTIONS: Array<{
  id: CommunitySettingsTab;
  icon: 'home' | 'palette' | 'lock' | 'file' | 'users' | 'ban' | 'shield' | 'flame';
}> = [
  { id: 'general', icon: 'home' },
  { id: 'branding', icon: 'palette' },
  { id: 'access', icon: 'lock' },
  { id: 'rules', icon: 'file' },
  { id: 'members', icon: 'users' },
  { id: 'banned', icon: 'ban' },
  { id: 'moderation', icon: 'shield' },
  { id: 'danger', icon: 'flame' },
];
