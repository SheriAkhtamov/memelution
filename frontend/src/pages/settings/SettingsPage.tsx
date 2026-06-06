import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AtSign,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  Hash,
  Heart,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  User as UserIcon,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import { Avatar, ConfirmDialog, useToast } from '../../shared/ui';
import { ProductEmptyState } from '../../shared/ui/ProductEmptyState';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../shared/i18n';
import type { User } from '../../shared/types';

type SettingsTab = 'profile' | 'privacy' | 'notifications' | 'appearance' | 'sessions';

const CHIP_TONES: Array<'orange' | 'purple' | 'blue'> = ['orange', 'purple', 'blue'];
const SUGGESTED_INTERESTS = [
  'мемы', 'айти', 'музыка', 'игры', 'спорт', 'кино', 'книги', 'путешествия',
  'еда', 'технологии', 'искусство', 'наука', 'фотография', 'дизайн', 'животные',
];

function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

function isValidUsernameShape(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

function chipToneFor(index: number): 'orange' | 'purple' | 'blue' {
  return CHIP_TONES[index % CHIP_TONES.length];
}

function deviceKind(ua: string): 'desktop' | 'mobile' | 'tablet' {
  const lower = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)/.test(lower)) return 'tablet';
  if (/(mobi|iphone|ipod|android.*mobile)/.test(lower)) return 'mobile';
  return 'desktop';
}

function browserLabel(ua: string): string {
  if (ua.includes('Edg/') || ua.includes('Edge')) return 'Microsoft Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Safari')) return 'Apple Safari';
  return 'Браузер';
}

function formatLastSeen(value: unknown, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (!value) return t('settings.sessions_active_now');
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return t('settings.sessions_active_now');
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSec < 60) return t('settings.sessions_active_now');
  if (diffSec < 60 * 60) return t('settings.sessions_min_ago', { n: Math.floor(diffSec / 60) });
  if (diffSec < 60 * 60 * 24) return t('settings.sessions_hour_ago', { n: Math.floor(diffSec / 3600) });
  return t('settings.sessions_last_seen', { when: date.toLocaleDateString() });
}

export function SettingsPage({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  const { user, updateProfile, logout, setUser } = useAuthStore();
  const toast = useToast();
  const { t, lang, setLang } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>('profile');

  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);

  const [showLikes, setShowLikes] = useState(Boolean(user?.privacy?.show_likes));
  const [profilePrivate, setProfilePrivate] = useState(Boolean(user?.privacy?.profile_private));
  const [allowDms, setAllowDms] = useState(Boolean(user?.privacy?.allow_dms));
  const [notifyLikes, setNotifyLikes] = useState(user?.notification_settings?.likes !== false);
  const [notifyComments, setNotifyComments] = useState(user?.notification_settings?.comments !== false);
  const [notifyFollows, setNotifyFollows] = useState(user?.notification_settings?.follows !== false);
  const [notifyMentions, setNotifyMentions] = useState(user?.notification_settings?.mentions !== false);
  const [newsletter, setNewsletter] = useState(Boolean(user?.notification_settings?.newsletter));
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    (user?.notification_settings?.density as 'comfortable' | 'compact' | undefined) ?? 'comfortable',
  );

  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<Array<Record<string, string | boolean>>>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [switchBusy, setSwitchBusy] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [inlineToast, setInlineToast] = useState<string | null>(null);

  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const debouncedUsername = useDebounce(username, 500);

  const interestInputRef = useRef<HTMLInputElement>(null);

  const original = useRef({
    username: user?.username || '',
    displayName: user?.display_name || '',
    bio: user?.bio || '',
    website: user?.website || '',
    location: user?.location || '',
    interests: (user?.interests || []).join('|'),
  });

  const hasChanges = useMemo(() => {
    return (
      username !== original.current.username ||
      displayName !== original.current.displayName ||
      bio !== original.current.bio ||
      website !== original.current.website ||
      location !== original.current.location ||
      interests.join('|') !== original.current.interests
    );
  }, [username, displayName, bio, website, location, interests]);

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
    }
    setUsernameAvailable(null);
    setUsernameChecking(false);
    return undefined;
  }, [debouncedUsername, user?.username]);

  useEffect(() => {
    if (user) api.sessions().then(setSessions).catch(() => setSessions([]));
  }, [user]);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  useEffect(() => {
    if (!inlineToast) return;
    const id = window.setTimeout(() => setInlineToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [inlineToast]);

  useEffect(() => {
    if (user && lang !== user.language) {
      updateProfile({ language: lang }).catch(() => {});
    }
  }, [lang]);

  if (!user) {
    return (
      <div className="settings-page max-w-4xl mx-auto w-full p-3 sm:p-6">
        <ProductEmptyState
          className="sm:min-h-[34rem]"
          title={t('common.required')}
          description={t('settings.login_desc')}
          tone="flame"
          icon={<SettingsIcon size={34} />}
        />
      </div>
    );
  }

  const usernameShapeValid = isValidUsernameShape(username);
  const usernameDirty = username !== user.username;
  const usernameInvalid =
    usernameDirty && (!usernameShapeValid || usernameAvailable === false);

  const autoSave = async (partial: Parameters<typeof updateProfile>[0], label?: string) => {
    try {
      await updateProfile(partial);
      const message = label ?? t('settings.saved');
      toast.show({ title: message, tone: 'success' });
      setInlineToast(message);
    } catch (e) {
      toast.show({
        title: e instanceof Error ? e.message : t('settings.save_error'),
        tone: 'error',
      });
    }
  };

  const save = async () => {
    if (usernameInvalid) return;
    setSaving(true);
    try {
      await updateProfile({
        username,
        display_name: displayName,
        bio,
        website,
        location,
        interests,
      });
      toast.show({ title: t('settings.profile_saved'), tone: 'success' });
      setInlineToast(t('settings.profile_saved'));
      original.current = {
        username,
        displayName,
        bio,
        website,
        location,
        interests: interests.join('|'),
      };
    } catch (e) {
      toast.show({
        title: e instanceof Error ? e.message : t('settings.profile_save_error'),
        tone: 'error',
      });
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
    setInterests(original.current.interests.split('|').filter(Boolean));
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

  const switchPrivacy = async (key: 'show_likes' | 'profile_private' | 'allow_dms', value: boolean) => {
    if (key === 'show_likes') setShowLikes(value);
    if (key === 'profile_private') setProfilePrivate(value);
    if (key === 'allow_dms') setAllowDms(value);
    setSwitchBusy(key);
    try {
      await updateProfile({
        privacy: {
          ...(user.privacy || {}),
          show_likes: key === 'show_likes' ? value : showLikes,
          profile_private: key === 'profile_private' ? value : profilePrivate,
          allow_dms: key === 'allow_dms' ? value : allowDms,
        },
      });
      setInlineToast(t('settings.saved_inline'));
    } catch (e) {
      if (key === 'show_likes') setShowLikes(!value);
      if (key === 'profile_private') setProfilePrivate(!value);
      if (key === 'allow_dms') setAllowDms(!value);
      toast.show({
        title: e instanceof Error ? e.message : t('settings.save_error'),
        tone: 'error',
      });
    } finally {
      setSwitchBusy(null);
    }
  };

  const switchNotification = async (
    key: 'likes' | 'comments' | 'follows' | 'mentions' | 'newsletter',
    value: boolean,
  ) => {
    if (key === 'likes') setNotifyLikes(value);
    if (key === 'comments') setNotifyComments(value);
    if (key === 'follows') setNotifyFollows(value);
    if (key === 'mentions') setNotifyMentions(value);
    if (key === 'newsletter') setNewsletter(value);
    setSwitchBusy(key);
    try {
      const next: Record<string, unknown> = {
        ...(user.notification_settings || {}),
        likes: key === 'likes' ? value : notifyLikes,
        comments: key === 'comments' ? value : notifyComments,
        follows: key === 'follows' ? value : notifyFollows,
        mentions: key === 'mentions' ? value : notifyMentions,
        newsletter: key === 'newsletter' ? value : newsletter,
        density,
      };
      await updateProfile({ notification_settings: next });
      setInlineToast(t('settings.saved_inline'));
    } catch (e) {
      if (key === 'likes') setNotifyLikes(!value);
      if (key === 'comments') setNotifyComments(!value);
      if (key === 'follows') setNotifyFollows(!value);
      if (key === 'mentions') setNotifyMentions(!value);
      if (key === 'newsletter') setNewsletter(!value);
      toast.show({
        title: e instanceof Error ? e.message : t('settings.save_error'),
        tone: 'error',
      });
    } finally {
      setSwitchBusy(null);
    }
  };

  const handleDensity = async (value: 'comfortable' | 'compact') => {
    setDensity(value);
    setSwitchBusy('density');
    try {
      await updateProfile({
        notification_settings: {
          ...(user.notification_settings || {}),
          density: value,
        },
      });
      setInlineToast(t('settings.saved_inline'));
    } catch (e) {
      toast.show({
        title: e instanceof Error ? e.message : t('settings.save_error'),
        tone: 'error',
      });
    } finally {
      setSwitchBusy(null);
    }
  };

  const handleAddInterest = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (interests.length >= 12) return;
    if (interests.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setInterests((current) => [...current, value]);
  };

  const handleRemoveInterest = (value: string) => {
    setInterests((current) => current.filter((item) => item !== value));
  };

  const handleInterestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = e.currentTarget.value;
      if (value.trim()) {
        handleAddInterest(value);
        e.currentTarget.value = '';
      }
    } else if (e.key === 'Backspace' && e.currentTarget.value === '' && interests.length > 0) {
      e.preventDefault();
      setInterests((current) => current.slice(0, -1));
    }
  };

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      await api.revokeSessions();
      toast.show({ title: t('settings.sessions_revoke_confirm'), tone: 'success' });
      setRevokeOpen(false);
    } catch (e) {
      toast.show({
        title: e instanceof Error ? e.message : t('settings.save_error'),
        tone: 'error',
      });
    } finally {
      setRevoking(false);
    }
  };

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      toast.show({
        title: e instanceof Error ? e.message : t('settings.save_error'),
        tone: 'error',
      });
      setLoggingOut(false);
    }
  };

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon: typeof UserIcon;
    badge?: number;
  }> = [
    { id: 'profile', label: t('settings.tab_profile'), icon: UserIcon },
    { id: 'privacy', label: t('settings.tab_privacy'), icon: Eye },
    { id: 'notifications', label: t('settings.tab_notifications'), icon: Bell },
    { id: 'appearance', label: t('settings.tab_appearance'), icon: Palette },
    { id: 'sessions', label: t('settings.tab_sessions'), icon: Shield, badge: sessions.length > 1 ? sessions.length : undefined },
  ];

  return (
    <div className="settings-page max-w-4xl mx-auto w-full">
      <header className="settings-page-header">
        <span className="settings-title-icon" aria-hidden="true">
          <SettingsIcon size={30} />
        </span>
        <h1>{t('settings.title')}</h1>
      </header>

      <div className="settings-workspace">
        <nav className="settings-nav" aria-label={t('settings.title')} role="tablist">
          {tabs.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                data-active={active}
                className="settings-nav-item"
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {item.badge ? <span className="settings-nav-badge">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <section className="settings-content" role="tabpanel">
          {tab === 'profile' ? (
            <>
              <ProfileTab {...{
                user, username, displayName, bio, website, location, interests, t,
                avatarUploading, coverUploading, uploadAvatar, uploadCover,
                usernameChecking, usernameAvailable, usernameShapeValid, usernameDirty,
                setUsername, setDisplayName, setBio, setWebsite, setLocation, setInterests,
                handleAddInterest, handleRemoveInterest, handleInterestKeyDown, interestInputRef,
              }} />

              <footer className="settings-panel-footer" aria-live="polite">
                <span>{hasChanges ? t('common.unsaved_changes') : t('settings.profile_footer_note')}</span>
                <div className="settings-panel-actions">
                  <button
                    type="button"
                    className="motion-control settings-panel-button"
                    onClick={resetChanges}
                    disabled={saving || !hasChanges}
                  >
                    {t('common.discard')}
                  </button>
                  <button
                    type="button"
                    className="motion-control settings-panel-button settings-panel-button--primary"
                    onClick={save}
                    disabled={saving || usernameInvalid || !hasChanges}
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {t('settings.profile_save')}
                  </button>
                </div>
              </footer>
            </>
          ) : null}
          {tab === 'privacy' ? <PrivacyTab {...{
            t, showLikes, profilePrivate, allowDms, switchBusy, switchPrivacy,
          }} /> : null}
          {tab === 'notifications' ? <NotificationsTab {...{
            t, notifyLikes, notifyComments, notifyFollows, notifyMentions, newsletter,
            switchBusy, switchNotification,
          }} /> : null}
          {tab === 'appearance' ? <AppearanceTab {...{
            t, lang, theme, setLang, setTheme, density, switchBusy, handleDensity,
          }} /> : null}
          {tab === 'sessions' ? <SessionsTab {...{
            t, sessions, setRevokeOpen, setLogoutOpen,
          }} /> : null}
        </section>
      </div>

      {/* INLINE TOAST (after auto-save) */}
      {inlineToast ? (
        <div className="settings-save-toast" role="status">
          <Check size={14} /> {inlineToast}
        </div>
      ) : null}

      {/* DIALOGS */}
      <ConfirmDialog
        open={revokeOpen}
        title={t('settings.sessions_revoke_title')}
        description={t('settings.sessions_revoke_desc')}
        confirmText={t('settings.sessions_revoke_confirm')}
        loading={revoking}
        onClose={() => setRevokeOpen(false)}
        onConfirm={handleRevokeAll}
      />
      <ConfirmDialog
        open={logoutOpen}
        title={t('settings.sessions_logout_title')}
        description={t('settings.sessions_logout_desc')}
        confirmText={t('settings.sessions_logout_confirm')}
        loading={loggingOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}

/* ============================================================
   PROFILE TAB
   ============================================================ */

interface ProfileTabProps {
  user: User;
  username: string;
  displayName: string;
  bio: string;
  website: string;
  location: string;
  interests: string[];
  t: (key: string, values?: Record<string, string | number>) => string;
  avatarUploading: boolean;
  coverUploading: boolean;
  uploadAvatar: (file?: File) => Promise<void>;
  uploadCover: (file?: File) => Promise<void>;
  usernameChecking: boolean;
  usernameAvailable: boolean | null;
  usernameShapeValid: boolean;
  usernameDirty: boolean;
  setUsername: (v: string) => void;
  setDisplayName: (v: string) => void;
  setBio: (v: string) => void;
  setWebsite: (v: string) => void;
  setLocation: (v: string) => void;
  setInterests: (v: string[]) => void;
  handleAddInterest: (v: string) => void;
  handleRemoveInterest: (v: string) => void;
  handleInterestKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  interestInputRef: React.RefObject<HTMLInputElement>;
}

function ProfileTab({
  user, username, displayName, bio, website, location, interests, t,
  avatarUploading, coverUploading, uploadAvatar, uploadCover,
  usernameChecking, usernameAvailable, usernameShapeValid, usernameDirty,
  setUsername, setDisplayName, setBio, setWebsite, setLocation, setInterests,
  handleAddInterest, handleRemoveInterest, handleInterestKeyDown, interestInputRef,
}: ProfileTabProps) {
  return (
    <div className="settings-profile-stack">
      <ProfileMediaCard
        user={user}
        displayName={displayName}
        username={username}
        t={t}
        avatarUploading={avatarUploading}
        coverUploading={coverUploading}
        uploadAvatar={uploadAvatar}
        uploadCover={uploadCover}
      />

      <div className="settings-form-stack">
        <div className="settings-grouped-card">
          <SettingsFieldRow
            icon={<span className="settings-field-at">@</span>}
            label={t('settings.username')}
            helper={t('settings.username_helper')}
          >
            <div className="settings-input-with-status">
              <input
                type="text"
                className="settings-text-control"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('settings.username')}
                aria-invalid={usernameDirty && (!usernameShapeValid || usernameAvailable === false)}
              />
              <UsernameStatus
                t={t}
                dirty={usernameDirty}
                checking={usernameChecking}
                available={usernameAvailable}
                shapeValid={usernameShapeValid}
              />
            </div>
          </SettingsFieldRow>

          <SettingsFieldRow
            icon={<UserIcon size={18} />}
            label={t('settings.display_name')}
            helper={t('settings.display_name_helper')}
          >
            <input
              type="text"
              className="settings-text-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('settings.display_name_placeholder')}
              aria-label={t('settings.display_name')}
              maxLength={50}
            />
          </SettingsFieldRow>

          <SettingsFieldRow
            icon={<Heart size={18} />}
            label={t('settings.bio')}
            helper={t('settings.bio_helper')}
            align="start"
          >
            <div className="settings-textarea-wrap">
              <textarea
                className="settings-text-control settings-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('settings.bio_placeholder')}
                aria-label={t('settings.bio')}
                maxLength={160}
                rows={3}
              />
              <span className="settings-character-count">{bio.length} / 160</span>
            </div>
          </SettingsFieldRow>

          <SettingsFieldRow
            icon={<Link2 size={18} />}
            label={t('settings.website')}
            helper={t('settings.website_helper')}
          >
            <input
              type="url"
              className="settings-text-control"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              aria-label={t('settings.website')}
              inputMode="url"
            />
          </SettingsFieldRow>
        </div>

        <div className="settings-grouped-card">
          <SettingsFieldRow
            icon={<MapPin size={18} />}
            label={t('settings.location')}
            helper={t('settings.location_helper')}
          >
            <input
              type="text"
              className="settings-text-control"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('settings.location_placeholder')}
              aria-label={t('settings.location')}
            />
          </SettingsFieldRow>

          <SettingsFieldRow
            icon={<Hash size={18} />}
            label={t('settings.interests')}
            helper={t('settings.interests_helper')}
            align="start"
          >
            <ChipInput
              values={interests}
              t={t}
              inputRef={interestInputRef}
              onAdd={handleAddInterest}
              onRemove={handleRemoveInterest}
              onKeyDown={handleInterestKeyDown}
              onClear={() => setInterests([])}
              suggestions={SUGGESTED_INTERESTS}
            />
          </SettingsFieldRow>
        </div>
      </div>
    </div>
  );
}

function SettingsFieldRow({
  icon, label, helper, align, children,
}: {
  icon: React.ReactNode;
  label: string;
  helper?: string;
  align?: 'start';
  children: React.ReactNode;
}) {
  return (
    <div className="settings-field-row" data-align={align}>
      <span className="settings-field-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="settings-field-copy">
        <p>{label}</p>
        {helper ? <span>{helper}</span> : null}
      </div>
      <div className="settings-field-control">{children}</div>
    </div>
  );
}

function ProfileMediaCard({
  user, displayName, username, t, avatarUploading, coverUploading, uploadAvatar, uploadCover,
}: {
  user: User;
  displayName: string;
  username: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  avatarUploading: boolean;
  coverUploading: boolean;
  uploadAvatar: (file?: File) => Promise<void>;
  uploadCover: (file?: File) => Promise<void>;
}) {
  const visibleName = displayName.trim() || user.display_name || `@${user.username}`;
  const visibleUsername = username.trim() || user.username;

  return (
    <div className="settings-profile-card">
      <div className="settings-profile-cover" role="img" aria-label={t('settings.cover_label')}>
        {user.cover_url ? (
          <img src={user.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <span className="settings-cover-wave settings-cover-wave--one" aria-hidden="true" />
            <span className="settings-cover-wave settings-cover-wave--two" aria-hidden="true" />
          </>
        )}
        <label className="settings-cover-upload">
          <span className="settings-cover-upload-pill">
            {coverUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {t('settings.cover_change')}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={coverUploading}
            aria-label={t('settings.cover_change')}
            onChange={(e) => uploadCover(e.target.files?.[0])}
          />
        </label>
        {coverUploading ? (
          <div className="settings-upload-overlay" aria-hidden="true">
            <Loader2 size={24} className="animate-spin text-white" />
          </div>
        ) : null}
      </div>

      <div className="settings-profile-summary">
        <label className="settings-avatar-uploader">
          <Avatar src={user.avatar_url} name={visibleName} className="settings-profile-avatar" />
          {avatarUploading ? (
            <span className="settings-avatar-overlay" aria-hidden="true">
              <Loader2 size={22} className="animate-spin text-white" />
            </span>
          ) : null}
          <span className="settings-avatar-edit" aria-hidden="true">
            <Camera size={15} />
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={avatarUploading}
            aria-label={t('settings.avatar_change')}
            onChange={(e) => uploadAvatar(e.target.files?.[0])}
          />
        </label>
        <div className="min-w-0">
          <p className="settings-profile-name">{visibleName}</p>
          <p className="settings-profile-handle">@{visibleUsername}</p>
        </div>
      </div>
    </div>
  );
}

function UsernameStatus({
  t, dirty, checking, available, shapeValid,
}: {
  t: (key: string) => string;
  dirty: boolean;
  checking: boolean;
  available: boolean | null;
  shapeValid: boolean;
}) {
  if (!dirty) {
    return (
      <span className="settings-field-check" aria-label={t('settings.username_available')}>
        <Check size={16} />
      </span>
    );
  }
  if (checking) {
    return (
      <span className="settings-row-status" data-tone="muted">
        <Loader2 size={14} className="animate-spin" />
        {t('settings.username_checking')}
      </span>
    );
  }
  if (!shapeValid) {
    return (
      <span className="settings-row-status" data-tone="bad">
        <XCircle size={14} />
        {t('settings.username_invalid')}
      </span>
    );
  }
  if (available === false) {
    return (
      <span className="settings-row-status" data-tone="bad">
        <XCircle size={14} />
        {t('settings.username_taken_short')}
      </span>
    );
  }
  if (available === true) {
    return (
      <span className="settings-field-check" aria-label={t('settings.username_available')}>
        <CheckCircle2 size={16} />
      </span>
    );
  }
  return null;
}

/* ============================================================
   PRIVACY TAB
   ============================================================ */

interface PrivacyTabProps {
  t: (key: string) => string;
  showLikes: boolean;
  profilePrivate: boolean;
  allowDms: boolean;
  switchBusy: string | null;
  switchPrivacy: (key: 'show_likes' | 'profile_private' | 'allow_dms', value: boolean) => Promise<void>;
}

function PrivacyTab({ t, showLikes, profilePrivate, allowDms, switchBusy, switchPrivacy }: PrivacyTabProps) {
  return (
    <div>
      <SettingsSection
        title={t('settings.privacy_section_visibility')}
        subtitle={t('settings.privacy_desc')}
        tone="blue"
      >
        <SettingsSwitchRow
          icon={<Heart size={18} />}
          tone="rose"
          title={t('settings.privacy_likes')}
          description={t('settings.privacy_likes_desc_long')}
          checked={showLikes}
          busy={switchBusy === 'show_likes'}
          onChange={(v) => switchPrivacy('show_likes', v)}
        />
        <SettingsSwitchRow
          icon={<EyeOff size={18} />}
          tone="violet"
          title={t('settings.privacy_private')}
          description={t('settings.privacy_private_desc_long')}
          checked={profilePrivate}
          busy={switchBusy === 'profile_private'}
          onChange={(v) => switchPrivacy('profile_private', v)}
        />
      </SettingsSection>

      <SettingsSection
        title={t('settings.privacy_section_safety')}
        subtitle={t('settings.privacy_dm_desc')}
        tone="green"
      >
        <SettingsSwitchRow
          icon={<MessageCircle size={18} />}
          tone="blue"
          title={t('settings.privacy_dm')}
          description={t('settings.privacy_dm_desc')}
          checked={allowDms}
          busy={switchBusy === 'allow_dms'}
          onChange={(v) => switchPrivacy('allow_dms', v)}
        />
      </SettingsSection>
    </div>
  );
}

/* ============================================================
   NOTIFICATIONS TAB
   ============================================================ */

interface NotificationsTabProps {
  t: (key: string) => string;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyMentions: boolean;
  newsletter: boolean;
  switchBusy: string | null;
  switchNotification: (
    key: 'likes' | 'comments' | 'follows' | 'mentions' | 'newsletter',
    value: boolean,
  ) => Promise<void>;
}

function NotificationsTab({
  t, notifyLikes, notifyComments, notifyFollows, notifyMentions, newsletter,
  switchBusy, switchNotification,
}: NotificationsTabProps) {
  return (
    <div>
      <SettingsSection
        title={t('settings.notif_section_push')}
        subtitle={t('settings.notif_desc')}
        tone="purple"
      >
        <SettingsSwitchRow
          icon={<Heart size={18} />}
          tone="rose"
          title={t('settings.notif_likes')}
          description={t('settings.notif_likes_desc_long')}
          checked={notifyLikes}
          busy={switchBusy === 'likes'}
          onChange={(v) => switchNotification('likes', v)}
        />
        <SettingsSwitchRow
          icon={<MessageSquare size={18} />}
          tone="blue"
          title={t('settings.notif_comments')}
          description={t('settings.notif_comments_desc_long')}
          checked={notifyComments}
          busy={switchBusy === 'comments'}
          onChange={(v) => switchNotification('comments', v)}
        />
        <SettingsSwitchRow
          icon={<UserPlus size={18} />}
          tone="green"
          title={t('settings.notif_follows')}
          description={t('settings.notif_follows_desc_long')}
          checked={notifyFollows}
          busy={switchBusy === 'follows'}
          onChange={(v) => switchNotification('follows', v)}
        />
        <SettingsSwitchRow
          icon={<AtSign size={18} />}
          tone="amber"
          title={t('settings.notif_mentions')}
          description={t('settings.notif_mentions_desc')}
          checked={notifyMentions}
          busy={switchBusy === 'mentions'}
          onChange={(v) => switchNotification('mentions', v)}
        />
      </SettingsSection>

      <SettingsSection
        title={t('settings.notif_section_email')}
        tone="amber"
      >
        <SettingsSwitchRow
          icon={<Sparkles size={18} />}
          tone="amber"
          title={t('settings.notif_newsletter')}
          description={t('settings.notif_newsletter_desc')}
          checked={newsletter}
          busy={switchBusy === 'newsletter'}
          onChange={(v) => switchNotification('newsletter', v)}
        />
      </SettingsSection>
    </div>
  );
}

/* ============================================================
   APPEARANCE TAB
   ============================================================ */

interface AppearanceTabProps {
  t: (key: string) => string;
  lang: string;
  theme: string;
  setLang: (lang: 'ru' | 'en' | 'uz') => void;
  setTheme: (theme: string) => void;
  density: 'comfortable' | 'compact';
  switchBusy: string | null;
  handleDensity: (density: 'comfortable' | 'compact') => Promise<void>;
}

function AppearanceTab({
  t, lang, theme, setLang, setTheme, density, switchBusy, handleDensity,
}: AppearanceTabProps) {
  return (
    <div>
      <SettingsSection
        title={t('settings.appearance_section_theme')}
        subtitle={t('settings.theme_desc')}
        tone="purple"
      >
        <div className="settings-theme-grid">
          <SettingsThemeCard
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            label={t('settings.theme_light')}
            description={t('settings.theme_light_desc')}
            tone="light"
            icon={<Sun size={16} />}
          />
          <SettingsThemeCard
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            label={t('settings.theme_dark')}
            description={t('settings.theme_dark_desc')}
            tone="dark"
            icon={<Moon size={16} />}
          />
          <SettingsThemeCard
            active={theme === 'system'}
            onClick={() => setTheme('system')}
            label={t('settings.theme_system')}
            description={t('settings.theme_system_desc')}
            tone="split"
            icon={<Monitor size={16} />}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.appearance_section_language')}
        subtitle={t('settings.language_desc')}
        tone="blue"
      >
        <div className="settings-lang-grid">
          {([
            { code: 'ru' as const, label: t('settings.language_ru'), flag: '🇷🇺' },
            { code: 'en' as const, label: t('settings.language_en'), flag: '🇬🇧' },
            { code: 'uz' as const, label: t('settings.language_uz'), flag: '🇺🇿' },
          ]).map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setLang(item.code)}
              className="settings-lang-card"
              data-active={lang === item.code}
              aria-pressed={lang === item.code}
            >
              <span className="settings-lang-flag" aria-hidden="true">{item.flag}</span>
              <span className="settings-lang-name">{item.label}</span>
              <span className="settings-lang-check" aria-hidden="true">✓</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.appearance_section_density')}
        tone="green"
      >
        <div className="settings-theme-grid">
          <button
            type="button"
            onClick={() => handleDensity('comfortable')}
            className="settings-theme-card"
            data-active={density === 'comfortable'}
            aria-pressed={density === 'comfortable'}
          >
            <div className="settings-theme-preview" data-tone="light">
              <div className="settings-theme-preview-content">
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                </div>
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                </div>
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                </div>
              </div>
            </div>
            <p className="settings-theme-name">{t('settings.density_comfortable')}</p>
            <p className="settings-theme-desc">{t('settings.density_comfortable_desc')}</p>
          </button>
          <button
            type="button"
            onClick={() => handleDensity('compact')}
            className="settings-theme-card"
            data-active={density === 'compact'}
            aria-pressed={density === 'compact'}
          >
            <div className="settings-theme-preview" data-tone="light">
              <div className="settings-theme-preview-content">
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                </div>
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                </div>
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                </div>
                <div className="settings-theme-preview-row">
                  <div className="settings-theme-preview-bar" />
                  <div className="settings-theme-preview-bar" />
                </div>
              </div>
            </div>
            <p className="settings-theme-name">{t('settings.density_compact')}</p>
            <p className="settings-theme-desc">{t('settings.density_compact_desc')}</p>
          </button>
        </div>
        {switchBusy === 'density' ? (
          <p className="settings-row-status" data-tone="muted">
            <Loader2 size={14} className="animate-spin" />
            {t('settings.saved_inline')}
          </p>
        ) : null}
      </SettingsSection>
    </div>
  );
}

function SettingsThemeCard({
  active, onClick, label, description, tone, icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  tone: 'light' | 'dark' | 'split';
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="settings-theme-card"
      data-active={active}
      aria-pressed={active}
    >
      <div className="settings-theme-preview" data-tone={tone}>
        {tone === 'dark' ? <div className="settings-theme-preview-dark" aria-hidden="true" /> : null}
        {tone === 'split' ? <div className="settings-theme-preview-split" aria-hidden="true" /> : null}
        <div className="settings-theme-preview-content">
          <div className="settings-theme-preview-row">
            <div className="settings-theme-preview-bar" />
            <div className="settings-theme-preview-bar" />
          </div>
          <div className="settings-theme-preview-row">
            <div className="settings-theme-preview-bar" />
          </div>
        </div>
      </div>
      <p className="settings-theme-name">
        {icon}
        {label}
      </p>
      <p className="settings-theme-desc">{description}</p>
    </button>
  );
}

/* ============================================================
   SESSIONS TAB
   ============================================================ */

interface SessionsTabProps {
  t: (key: string) => string;
  sessions: Array<Record<string, string | boolean>>;
  setRevokeOpen: (v: boolean) => void;
  setLogoutOpen: (v: boolean) => void;
}

function SessionsTab({ t, sessions, setRevokeOpen, setLogoutOpen }: SessionsTabProps) {
  return (
    <div>
      <SettingsSection
        title={t('settings.security_section_sessions')}
        subtitle={t('settings.sessions_desc')}
        tone="blue"
      >
        {sessions.length === 0 ? (
          <p className="settings-row-helper" style={{ padding: '0.95rem 1.25rem' }}>
            {t('settings.sessions_no_data')}
          </p>
        ) : (
          sessions.map((session, index) => {
            const ua = String(session.user_agent || '');
            const isCurrent = index === 0 || session.current === true;
            const kind = deviceKind(ua);
            const DeviceIcon = kind === 'mobile' ? Smartphone : kind === 'tablet' ? Cpu : Monitor;
            const deviceLabel =
              kind === 'mobile' ? t('settings.sessions_device_mobile') :
              kind === 'tablet' ? t('settings.sessions_device_tablet') :
              t('settings.sessions_device_desktop');
            const lastSeen = formatLastSeen(session.last_seen || session.created_at, t);
            return (
              <div key={String(session.id || index)} className="settings-session">
                <span className="settings-session-icon" data-tone={isCurrent ? 'current' : undefined}>
                  <DeviceIcon size={18} />
                </span>
                <div className="settings-session-meta">
                  <p className="settings-session-name">{browserLabel(ua)} · {deviceLabel}</p>
                  <p className="settings-session-desc">
                    {String(session.ip_address || t('settings.sessions_ip_hidden'))} · {lastSeen}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="settings-session-tag">
                    <span className="settings-session-tag-dot" aria-hidden="true" />
                    {t('settings.sessions_current')}
                  </span>
                ) : null}
              </div>
            );
          })
        )}
        {sessions.length > 1 ? (
          <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--app-line)' }}>
            <button
              type="button"
              className="settings-action"
              data-tone="primary"
              onClick={() => setRevokeOpen(true)}
            >
              <span className="settings-action-icon">
                <Shield size={18} />
              </span>
              <div className="settings-action-meta">
                <p className="settings-action-title">{t('settings.sessions_revoke_all')}</p>
                <p className="settings-action-desc">{t('settings.sessions_revoke_desc')}</p>
              </div>
              <ChevronRight size={18} className="settings-action-cta" />
            </button>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title={t('settings.security_section_account')}
        tone="amber"
      >
        <button
          type="button"
          className="settings-action"
          onClick={() => setLogoutOpen(true)}
        >
          <span className="settings-action-icon">
            <LogOut size={18} />
          </span>
          <div className="settings-action-meta">
            <p className="settings-action-title">{t('settings.account_logout')}</p>
            <p className="settings-action-desc">{t('settings.account_logout_desc')}</p>
          </div>
          <ChevronRight size={18} className="settings-action-cta" />
        </button>
      </SettingsSection>

      <SettingsSection
        title={t('settings.security_section_danger')}
        tone="rose"
      >
        <button
          type="button"
          className="settings-action"
          data-tone="danger"
        >
          <span className="settings-action-icon">
            <Trash2 size={18} />
          </span>
          <div className="settings-action-meta">
            <p className="settings-action-title">{t('settings.account_delete')}</p>
            <p className="settings-action-desc">{t('settings.account_delete_desc')}</p>
          </div>
          <ChevronRight size={18} className="settings-action-cta" />
        </button>
      </SettingsSection>
    </div>
  );
}

/* ============================================================
   GENERIC SECTION + ROW + SWITCH + CHIP INPUT
   ============================================================ */

function SettingsSection({
  title, subtitle, tone = 'orange', children,
}: {
  title: string;
  subtitle?: string;
  tone?: 'orange' | 'purple' | 'blue' | 'green' | 'rose' | 'amber' | 'violet' | 'slate';
  children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <header className="settings-section-header" data-tone={tone}>
        <span className="settings-section-header-icon" aria-hidden="true">
          <Compass size={16} />
        </span>
        <div className="min-w-0">
          <p className="settings-section-title">{title}</p>
          {subtitle ? <p className="settings-section-subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

function SettingsRow({
  icon, tone = 'orange', label, helper, counter, counterMax, controlStatus, children,
}: {
  icon: React.ReactNode;
  tone?: 'orange' | 'purple' | 'blue' | 'green' | 'rose' | 'amber' | 'violet' | 'slate';
  label: string;
  helper?: string;
  counter?: number;
  counterMax?: number;
  controlStatus?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <span className="settings-row-icon" data-tone={tone} aria-hidden="true">
        {icon}
      </span>
      <div className="settings-row-body">
        <div className="settings-row-head">
          <span className="settings-row-label">{label}</span>
          {typeof counter === 'number' && typeof counterMax === 'number' ? (
            <span
              className="settings-row-counter"
              data-warn={counter >= counterMax * 0.8 && counter < counterMax || undefined}
              data-bad={counter >= counterMax || undefined}
            >
              {counter}/{counterMax}
            </span>
          ) : null}
        </div>
        {helper ? <p className="settings-row-helper">{helper}</p> : null}
        <div className="settings-row-control">{children}</div>
        {controlStatus}
      </div>
    </div>
  );
}

function SettingsSwitchRow({
  icon, tone = 'orange', title, description, checked, busy, onChange,
}: {
  icon: React.ReactNode;
  tone?: 'orange' | 'purple' | 'blue' | 'green' | 'rose' | 'amber' | 'violet' | 'slate';
  title: string;
  description?: string;
  checked: boolean;
  busy?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-switch-row">
      <div className="flex min-w-0 items-start gap-3">
        <span className="settings-row-icon" data-tone={tone} aria-hidden="true" style={{ marginTop: '0.15rem' }}>
          {icon}
        </span>
        <div className="settings-switch-row-meta">
          <div className="settings-switch-row-head">
            <span className="settings-switch-row-title">{title}</span>
          </div>
          {description ? <p className="settings-switch-row-desc">{description}</p> : null}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={busy || undefined}
        aria-label={title}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className="settings-switch"
        data-checked={checked || undefined}
        data-busy={busy || undefined}
      >
        <span className="settings-switch-thumb" />
        {busy ? <span className="settings-switch-spinner" aria-hidden="true" /> : null}
      </button>
    </label>
  );
}

function ChipInput({
  values, t, inputRef, onAdd, onRemove, onKeyDown, onClear, suggestions,
}: {
  values: string[];
  t: (key: string) => string;
  inputRef: React.RefObject<HTMLInputElement>;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  suggestions: string[];
}) {
  const remaining = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <div>
      <div className="chip-input" onClick={() => inputRef.current?.focus()}>
        {values.map((value, idx) => (
          <span key={value} className="chip" data-tone={chipToneFor(idx)}>
            {value}
            <button
              type="button"
              className="chip-remove"
              onClick={(e) => { e.stopPropagation(); onRemove(value); }}
              aria-label={`${t('common.discard')} ${value}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="chip-input-field"
          placeholder={values.length === 0 ? t('settings.interests_placeholder') : t('settings.interests_add')}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v) { onAdd(v); e.currentTarget.value = ''; }
          }}
          aria-label={t('settings.interests')}
        />
        {values.length > 0 ? (
          <button
            type="button"
            className="chip-remove"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            aria-label={t('common.discard')}
            style={{ marginLeft: '0.25rem' }}
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
      {remaining.length > 0 ? (
        <div className="chip-suggestions">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              className="chip-suggestion"
              onClick={() => onAdd(s)}
            >
              <Plus size={12} /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
