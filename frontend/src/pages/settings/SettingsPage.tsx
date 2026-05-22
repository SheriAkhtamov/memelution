import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../shared/i18n';
import {
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  Heart,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Monitor,
  Moon,
  Settings,
  Shield,
  Smartphone,
  Sun,
  User,
  XCircle,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import { Avatar, Button, EmptyState, Input, Textarea, useToast } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';

type SettingsTab = 'profile' | 'privacy' | 'notifications' | 'appearance' | 'sessions';

function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

export function SettingsPage({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  const { user, updateProfile, logout, setUser } = useAuthStore();
  const toast = useToast();
  const { t, lang, setLang } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<SettingsTab>('profile');

  // Text fields
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [interests, setInterests] = useState((user?.interests || []).join(', '));

  // Toggles (auto-saved)
  const [showLikes, setShowLikes] = useState(Boolean(user?.privacy?.show_likes));
  const [profilePrivate, setProfilePrivate] = useState(Boolean(user?.privacy?.profile_private));
  const [notifyLikes, setNotifyLikes] = useState(user?.notification_settings?.likes !== false);
  const [notifyComments, setNotifyComments] = useState(user?.notification_settings?.comments !== false);
  const [notifyFollows, setNotifyFollows] = useState(user?.notification_settings?.follows !== false);

  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<Array<Record<string, string | boolean>>>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Username validation
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const debouncedUsername = useDebounce(username, 500);

  const original = useRef({
    username: user?.username || '',
    displayName: user?.display_name || '',
    bio: user?.bio || '',
    website: user?.website || '',
    location: user?.location || '',
    interests: (user?.interests || []).join(', '),
  });

  const markChanged = useCallback(() => setHasChanges(true), []);

  useEffect(() => {
    if (debouncedUsername && debouncedUsername !== user?.username) {
      setUsernameChecking(true);
      let cancelled = false;
      api
        .checkUsername(debouncedUsername)
        .then((res) => {
          if (!cancelled) setUsernameAvailable(res.available);
        })
        .catch(() => {
          if (!cancelled) setUsernameAvailable(null);
        })
        .finally(() => {
          if (!cancelled) setUsernameChecking(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      setUsernameAvailable(null);
      setUsernameChecking(false);
    }
  }, [debouncedUsername, user?.username]);

  useEffect(() => {
    if (user) api.sessions().then(setSessions).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  if (!user) return (
    <div className="min-h-screen bg-[#F3F4F6] p-3 dark:bg-zinc-950 sm:p-4">
      <EmptyState title={t('common.required')} />
    </div>
  );

  const autoSave = async (partial: Parameters<typeof updateProfile>[0]) => {
    try {
      await updateProfile(partial);
      toast.show({ title: t('settings.saved'), tone: 'success' });
    } catch (e) {
      toast.show({ title: e instanceof Error ? e.message : t('settings.save_error'), tone: 'error' });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        username,
        display_name: displayName,
        bio,
        website,
        location,
        interests: interests.split(',').map((item) => item.trim()).filter(Boolean),
        privacy: {
          ...(user.privacy || {}),
          show_likes: showLikes,
          profile_private: profilePrivate,
        },
        notification_settings: {
          ...(user.notification_settings || {}),
          likes: notifyLikes,
          comments: notifyComments,
          follows: notifyFollows,
        },
      });
      toast.show({ title: t('settings.profile_saved'), tone: 'success' });
      original.current = { username, displayName, bio, website, location, interests };
      setHasChanges(false);
    } catch (e) {
      toast.show({ title: e instanceof Error ? e.message : t('settings.profile_save_error'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setUsername(original.current.username);
    setDisplayName(original.current.displayName);
    setBio(original.current.bio);
    setWebsite(original.current.website);
    setLocation(original.current.location);
    setInterests(original.current.interests);
    setHasChanges(false);
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setAvatarUploading(true);
    try {
      const next = await api.uploadAvatar(file);
      setUser(next);
      toast.show({ title: t('settings.avatar_updated'), tone: 'success' });
    } catch {
      toast.show({ title: t('settings.avatar_error'), tone: 'error' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setCoverUploading(true);
    try {
      const next = await api.uploadCover(file);
      setUser(next);
      toast.show({ title: t('settings.cover_updated'), tone: 'success' });
    } catch {
      toast.show({ title: t('settings.cover_error'), tone: 'error' });
    } finally {
      setCoverUploading(false);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
    { id: 'profile', label: t('settings.tab_profile'), icon: User },
    { id: 'privacy', label: t('settings.tab_privacy'), icon: Eye },
    { id: 'notifications', label: t('settings.tab_notifications'), icon: Bell },
    { id: 'appearance', label: t('settings.tab_appearance'), icon: Sun },
    { id: 'sessions', label: t('settings.tab_sessions'), icon: Shield },
  ];

  const sidebar = (
    <nav className="hidden lg:block">
      <div className="sticky top-20 space-y-1">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-black transition-all ${
                active
                  ? 'bg-white text-[#FF6B00] shadow-sm dark:bg-zinc-900 dark:text-orange-400'
                  : 'text-gray-500 hover:bg-white/60 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900/40 dark:hover:text-zinc-200'
              }`}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  const mobileTabs = isMobile ? (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition-all ${
            tab === t.id
              ? 'bg-[#FF6B00] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <t.icon size={16} />
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  ) : null;

  useEffect(() => {
    if (user && lang !== user.language) {
      updateProfile({ language: lang }).catch(() => {});
    }
  }, [lang]);

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-[#F3F4F6]/90 px-3 py-3 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/90 sm:px-4">
        <h1 className="flex items-center gap-2 text-xl font-black">
          <Settings className="text-[#FF6B00]" /> {t('settings.title')}
        </h1>
      </header>

      <div className="flex gap-6 p-3 sm:p-4 lg:p-6">
        {sidebar}

        <div className="min-w-0 flex-1 max-w-3xl">
          {mobileTabs}

          {/* Profile Tab */}
          {tab === 'profile' ? (
            <div className="space-y-5">
              {/* Cover & Avatar */}
              <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
                <div className="group relative h-40 bg-gradient-to-r from-orange-400 via-purple-500 to-sky-500 sm:h-48">
                  {user.cover_url ? (
                    <img src={user.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  {coverUploading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                      <Loader2 size={28} className="animate-spin text-white" />
                    </div>
                  )}
                  <label className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                    <span className={`flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-bold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 ${coverUploading ? 'opacity-0' : ''}`}>
                      <Camera size={16} />
                      {t('settings.change_cover')}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={coverUploading}
                      onChange={(e) => uploadCover(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <div className="px-5 pb-5">
                  <div className="-mt-12 flex items-end gap-4">
                    <label className="group/avatar relative cursor-pointer">
                      <Avatar
                        src={user.avatar_url}
                        name={user.display_name}
                        className="h-24 w-24 rounded-2xl border-4 border-white shadow-lg dark:border-zinc-900"
                      />
                      {avatarUploading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
                          <Loader2 size={24} className="animate-spin text-white" />
                        </div>
                      )}
                      <div className={`absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/0 transition-colors group-hover/avatar:bg-black/30 ${avatarUploading ? 'opacity-0' : ''}`}>
                        <Camera size={20} className="text-white opacity-0 transition-opacity group-hover/avatar:opacity-100" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={avatarUploading}
                        onChange={(e) => uploadAvatar(e.target.files?.[0])}
                      />
                    </label>
                    <div className="min-w-0 pb-1">
                      <p className="truncate text-lg font-black">{user.display_name}</p>
                      <p className="truncate text-sm font-bold text-gray-400">@{user.username}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Basic Info — iOS grouped list */}
              <GroupedCard>
                <SettingsField label={t('settings.username')} icon={<span className="text-sm font-black text-gray-400">@</span>}>
                  <div className="relative flex items-center gap-2">
                    <Input
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); markChanged(); }}
                      placeholder="username"
                      className="!border-0 !bg-transparent !p-0 !ring-0 !outline-none focus:!ring-0"
                    />
                    {usernameChecking && <Loader2 size={16} className="animate-spin text-gray-400" />}
                    {!usernameChecking && usernameAvailable === true && debouncedUsername !== user.username && (
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                    )}
                    {!usernameChecking && usernameAvailable === false && debouncedUsername !== user.username && (
                      <XCircle size={16} className="shrink-0 text-red-500" />
                    )}
                  </div>
                </SettingsField>
                {usernameAvailable === false && debouncedUsername !== user.username && (
                  <p className="px-4 pb-3 text-xs font-bold text-red-500">{t('settings.username_taken')}</p>
                )}
                <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                <SettingsField label={t('settings.display_name')} icon={<User size={16} className="text-gray-400" />}>
                  <Input
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); markChanged(); }}
                    placeholder={t('settings.display_name_placeholder')}
                    className="!border-0 !bg-transparent !p-0 !ring-0 !outline-none focus:!ring-0"
                  />
                </SettingsField>
              </GroupedCard>

              {/* Bio & Details */}
              <GroupedCard>
                <div className="px-4 py-3.5">
                  <label className="mb-1.5 block text-[10px] font-black uppercase text-gray-400">{t('settings.bio')}</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => { setBio(e.target.value); markChanged(); }}
                    placeholder={t('settings.bio_placeholder')}
                    className="min-h-20 !border-0 !bg-transparent !p-0 !text-sm !ring-0 focus:!ring-0"
                  />
                  <p className="mt-1 text-right text-xs font-bold text-gray-400">{bio.length}/160</p>
                </div>
                <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                <SettingsField label={t('settings.website')} icon={<Link2 size={16} className="text-gray-400" />}>
                  <Input
                    value={website}
                    onChange={(e) => { setWebsite(e.target.value); markChanged(); }}
                    placeholder={t('settings.website_placeholder')}
                    className="!border-0 !bg-transparent !p-0 !ring-0 !outline-none focus:!ring-0"
                  />
                </SettingsField>
                <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                <SettingsField label={t('settings.location')} icon={<MapPin size={16} className="text-gray-400" />}>
                  <Input
                    value={location}
                    onChange={(e) => { setLocation(e.target.value); markChanged(); }}
                    placeholder={t('settings.location_placeholder')}
                    className="!border-0 !bg-transparent !p-0 !ring-0 !outline-none focus:!ring-0"
                  />
                </SettingsField>
                <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                <SettingsField label={t('settings.interests')} icon={<Heart size={16} className="text-gray-400" />}>
                  <Input
                    value={interests}
                    onChange={(e) => { setInterests(e.target.value); markChanged(); }}
                    placeholder={t('settings.interests_placeholder')}
                    className="!border-0 !bg-transparent !p-0 !ring-0 !outline-none focus:!ring-0"
                  />
                </SettingsField>
              </GroupedCard>
            </div>
          ) : null}

          {/* Privacy Tab */}
          {tab === 'privacy' ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-1 text-lg font-black">{t('settings.privacy_title')}</h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">{t('settings.privacy_desc')}</p>
                <GroupedCard noPad>
                  <SettingsToggle
                    checked={showLikes}
                    onChange={(v) => {
                      setShowLikes(v);
                      autoSave({ privacy: { ...(user.privacy || {}), show_likes: v, profile_private: profilePrivate } });
                    }}
                    title={t('settings.privacy_likes')}
                    description={t('settings.privacy_likes_desc')}
                  />
                  <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                  <SettingsToggle
                    checked={profilePrivate}
                    onChange={(v) => {
                      setProfilePrivate(v);
                      autoSave({ privacy: { ...(user.privacy || {}), show_likes: showLikes, profile_private: v } });
                    }}
                    title={t('settings.privacy_private')}
                    description={t('settings.privacy_private_desc')}
                  />
                </GroupedCard>
              </div>
            </div>
          ) : null}

          {/* Notifications Tab */}
          {tab === 'notifications' ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-1 text-lg font-black">{t('settings.notif_title')}</h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">{t('settings.notif_desc')}</p>
                <GroupedCard noPad>
                  <SettingsToggle
                    checked={notifyLikes}
                    onChange={(v) => {
                      setNotifyLikes(v);
                      autoSave({ notification_settings: { ...(user.notification_settings || {}), likes: v, comments: notifyComments, follows: notifyFollows } });
                    }}
                    title={t('settings.notif_likes')}
                    description={t('settings.notif_likes_desc')}
                  />
                  <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                  <SettingsToggle
                    checked={notifyComments}
                    onChange={(v) => {
                      setNotifyComments(v);
                      autoSave({ notification_settings: { ...(user.notification_settings || {}), likes: notifyLikes, comments: v, follows: notifyFollows } });
                    }}
                    title={t('settings.notif_comments')}
                    description={t('settings.notif_comments_desc')}
                  />
                  <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                  <SettingsToggle
                    checked={notifyFollows}
                    onChange={(v) => {
                      setNotifyFollows(v);
                      autoSave({ notification_settings: { ...(user.notification_settings || {}), likes: notifyLikes, comments: notifyComments, follows: v } });
                    }}
                    title={t('settings.notif_follows')}
                    description={t('settings.notif_follows_desc')}
                  />
                </GroupedCard>
              </div>
            </div>
          ) : null}

          {/* Appearance Tab */}
          {tab === 'appearance' ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-1 text-lg font-black">{t('settings.theme_title')}</h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">{t('settings.theme_desc')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ThemeCard
                    active={theme === 'light'}
                    onClick={() => setTheme('light')}
                    icon={<Sun size={24} />}
                    label={t('settings.theme_light')}
                    description={t('settings.theme_light_desc')}
                    colors="from-amber-50 to-orange-50"
                    borderColor="border-amber-200"
                    iconColor="text-amber-500"
                  />
                  <ThemeCard
                    active={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                    icon={<Moon size={24} />}
                    label={t('settings.theme_dark')}
                    description={t('settings.theme_dark_desc')}
                    colors="from-zinc-800 to-zinc-900"
                    borderColor="border-zinc-700"
                    iconColor="text-indigo-400"
                    dark
                  />
                  <ThemeCard
                    active={theme === 'system'}
                    onClick={() => setTheme('system')}
                    icon={<Monitor size={24} />}
                    label={t('settings.theme_system')}
                    description={t('settings.theme_system_desc')}
                    colors="from-gray-50 to-zinc-800"
                    borderColor="border-gray-300"
                    iconColor="text-gray-500"
                    split
                  />
                </div>
              </div>

              {/* Language selection */}
              <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-1 text-lg font-black">{t('settings.language_title')}</h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">{t('settings.language_desc')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { code: 'ru' as const, label: t('settings.language_ru'), flag: '🇷🇺' },
                    { code: 'en' as const, label: t('settings.language_en'), flag: '🇬🇧' },
                    { code: 'uz' as const, label: t('settings.language_uz'), flag: '🇺🇿' },
                  ].map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setLang(item.code)}
                      className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                        lang === item.code
                          ? 'border-[#FF6B00] shadow-lg shadow-orange-500/10'
                          : 'border-gray-200 hover:border-gray-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="mb-3 text-2xl">{item.flag}</div>
                      <p className="text-sm font-black">{item.label}</p>
                      {lang === item.code && (
                        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B00] text-white">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Sessions Tab */}
          {tab === 'sessions' ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-1 text-lg font-black">{t('settings.sessions_title')}</h2>
                <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">{t('settings.sessions_desc')}</p>
                {sessions.length ? (
                  <div className="space-y-2">
                    {sessions.map((session, index) => (
                      <div
                        key={String(session.id || index)}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-200/50 text-gray-400 dark:bg-zinc-800">
                          <Smartphone size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{formatUserAgent(String(session.user_agent || t('settings.sessions_unknown')))}</p>
                          <p className="text-xs text-gray-400">{String(session.ip_address || t('settings.sessions_ip_hidden'))}</p>
                        </div>
                        {index === 0 ? (
                          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-black text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {t('settings.sessions_current')}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{t('settings.sessions_no_data')}</p>
                )}
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-4 text-lg font-black">{t('settings.account_title')}</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => api.revokeSessions().then(() => logout())}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3.5 text-left text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      <Shield size={18} />
                    </div>
                    <div>
                      <p>{t('settings.account_revoke')}</p>
                      <p className="text-xs font-normal text-gray-400">{t('settings.account_revoke_desc')}</p>
                    </div>
                  </button>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-xl border border-red-100 p-3.5 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      <LogOut size={18} />
                    </div>
                    <div>
                      <p>{t('settings.account_logout')}</p>
                      <p className="text-xs font-normal text-red-400/70">{t('settings.account_logout_desc')}</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sticky Unsaved Changes Bar */}
      {hasChanges && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm font-bold text-gray-700 dark:text-zinc-200">{t('common.unsaved_changes')}</span>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={resetChanges} className="h-9 px-4 text-xs">
                {t('common.discard')}
              </Button>
              <Button onClick={save} loading={saving} className="h-9 px-4 text-xs">
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Helper Components ---------- */

function GroupedCard({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900 ${noPad ? '' : ''}`}>
      {children}
    </div>
  );
}

function SettingsField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 transition-colors focus-within:bg-gray-50/50 dark:focus-within:bg-zinc-800/40">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
        {children}
      </div>
    </div>
  );
}

function SettingsToggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-800/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] dark:border-zinc-700 dark:bg-zinc-950"
      />
      <span className="min-w-0">
        <span className="block text-sm font-black">{title}</span>
        <span className="block text-xs text-gray-500 dark:text-zinc-400">{description}</span>
      </span>
    </label>
  );
}

function ThemeCard({
  active,
  onClick,
  icon,
  label,
  description,
  colors,
  borderColor,
  iconColor,
  dark,
  split,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  colors: string;
  borderColor: string;
  iconColor: string;
  dark?: boolean;
  split?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
        active
          ? 'border-[#FF6B00] shadow-lg shadow-orange-500/10'
          : `${borderColor} hover:border-gray-400 dark:hover:border-zinc-600`
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colors} opacity-50`} />
      {split ? <div className="absolute inset-y-0 right-0 w-1/2 bg-zinc-800/80" /> : null}
      <div className="relative">
        <div className={`mb-3 ${iconColor}`}>{icon}</div>
        <p className={`text-sm font-black ${dark ? 'text-white' : ''}`}>{label}</p>
        <p className={`mt-0.5 text-xs ${dark ? 'text-zinc-400' : 'text-gray-500'}`}>{description}</p>
      </div>
      {active ? (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B00] text-white">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}
    </button>
  );
}

function formatUserAgent(ua: string): string {
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Apple Safari';
  if (ua.includes('Edge')) return 'Microsoft Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.length > 50) return ua.slice(0, 50) + '…';
  return ua;
}
