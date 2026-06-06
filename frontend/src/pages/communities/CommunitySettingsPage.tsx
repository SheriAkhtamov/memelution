import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  Check,
  ChevronRight,
  FileText,
  Flame,
  Globe,
  Image as ImageIcon,
  Languages,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Palette,
  Send,
  Settings as SettingsIcon,
  Shield,
  SlidersHorizontal,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Avatar, Button, ConfirmDialog, ErrorState, Input, Modal, Select, Skeleton, Switch, Textarea, useToast } from '../../shared/ui';
import { useCommunitySettings, COMMUNITY_SETTINGS_SECTIONS, type CommunitySettingsTab } from '../../features/communities/useCommunitySettings';
import { useTranslation } from '../../shared/i18n';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_COVER_SIZE = 8 * 1024 * 1024;

export function CommunitySettingsPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [active, setActive] = useState<CommunitySettingsTab>('general');
  const [sectionOpen, setSectionOpen] = useState(false);
  const settings = useCommunitySettings(slug);
  const { community, communityQuery, draft, original, isDirty, reset, save, update, updateSetting } = settings;

  const canManage = communityQuery.data?.role === 'creator'
    || communityQuery.data?.role === 'admin'
    || communityQuery.data?.role === 'moderator'
    || user?.role === 'global_admin';

  useUnsavedGuard(isDirty);

  if (communityQuery.isLoading) {
    return (
      <div className="csp-skeleton">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="csp-skeleton-grid">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (communityQuery.isError || !community || !original || !draft) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          description={communityQuery.error instanceof Error ? communityQuery.error.message : t('community.not_found_page')}
          onRetry={() => communityQuery.refetch()}
        />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState title={t('community.access_denied')} description={t('community.access_denied_desc')} />
      </div>
    );
  }

  const sectionLabels: Record<CommunitySettingsTab, string> = {
    general: t('community.settings_section_general'),
    branding: t('community.settings_section_branding'),
    access: t('community.settings_section_access'),
    rules: t('community.settings_section_rules'),
    members: t('community.settings_section_members'),
    banned: t('community.settings_section_banned'),
    moderation: t('community.settings_section_moderation'),
    danger: t('community.settings_section_danger'),
  };

  return (
    <div className="csp-shell">
      <StickyTopBar
        slug={slug}
        communityName={community.name}
        isDirty={isDirty}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={reset}
      />

      <div className="csp-mobile-tabs">
        <button
          type="button"
          aria-expanded={sectionOpen}
          aria-controls="csp-section-nav"
          onClick={() => setSectionOpen((value) => !value)}
          className="csp-mobile-tabs-trigger"
        >
          <SettingsIcon size={16} />
          {sectionLabels[active]}
          <ChevronRight size={16} className={cn('transition-transform', sectionOpen && 'rotate-90')} />
        </button>
        {sectionOpen ? (
          <div id="csp-section-nav" className="csp-mobile-tabs-list">
            {COMMUNITY_SETTINGS_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.icon];
              return (
                <button
                  key={section.id}
                  type="button"
                  data-active={active === section.id}
                  onClick={() => {
                    setActive(section.id);
                    setSectionOpen(false);
                    scrollToSection(section.id);
                  }}
                  className="csp-section-link"
                >
                  <Icon size={16} />
                  {sectionLabels[section.id]}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="csp-grid">
        <aside className="csp-rail" aria-label={t('community.settings_nav')}>
          <div className="csp-rail-head">
            <p className="csp-rail-eyebrow">{t('community.settings_eyebrow')}</p>
            <h2 className="csp-rail-title">{t('community.settings_title')}</h2>
          </div>
          <nav className="csp-rail-list">
            {COMMUNITY_SETTINGS_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.icon];
              return (
                <button
                  key={section.id}
                  type="button"
                  data-active={active === section.id}
                  onClick={() => {
                    setActive(section.id);
                    scrollToSection(section.id);
                  }}
                  className="csp-section-link"
                >
                  <Icon size={16} />
                  {sectionLabels[section.id]}
                  <ChevronRight size={14} className="csp-section-link-chevron" />
                </button>
              );
            })}
          </nav>
          <div className="csp-rail-foot">
            <Link to={`/communities/${slug}`} className="csp-rail-back">
              <ArrowLeft size={14} />
              {t('community.back_to_community')}
            </Link>
          </div>
        </aside>

        <main className="csp-main">
          <SectionHeader
            id="general"
            eyebrow={t('community.settings_section_general_eyebrow')}
            title={t('community.settings_section_general')}
            description={t('community.settings_section_general_desc')}
          />
          <Section anchor="general">
            <GeneralSection draft={draft} update={update} />
            <CommunityLivePreview draft={draft} membersCount={community.members_count} postsCount={community.posts_count} />
          </Section>

          <SectionHeader
            id="branding"
            eyebrow={t('community.settings_section_branding_eyebrow')}
            title={t('community.settings_section_branding')}
            description={t('community.settings_section_branding_desc')}
          />
          <Section anchor="branding">
            <BrandingSection
              draft={draft}
              uploadAvatar={settings.uploadAvatar}
              uploadCover={settings.uploadCover}
              onClearAvatar={() => update('avatar_url', '')}
              onClearCover={() => update('cover_url', '')}
            />
          </Section>

          <SectionHeader
            id="access"
            eyebrow={t('community.settings_section_access_eyebrow')}
            title={t('community.settings_section_access')}
            description={t('community.settings_section_access_desc')}
          />
          <Section anchor="access">
            <AccessSection draft={draft} update={update} updateSetting={updateSetting} />
          </Section>

          <SectionHeader
            id="rules"
            eyebrow={t('community.settings_section_rules_eyebrow')}
            title={t('community.settings_section_rules')}
            description={t('community.settings_section_rules_desc')}
          />
          <Section anchor="rules">
            <RulesSection draft={draft} update={update} />
          </Section>

          <SectionHeader
            id="members"
            eyebrow={t('community.settings_section_members_eyebrow')}
            title={t('community.settings_section_members')}
            description={t('community.settings_section_members_desc')}
          />
          <Section anchor="members">
            <MembersSection settings={settings} />
          </Section>

          <SectionHeader
            id="banned"
            eyebrow={t('community.settings_section_banned_eyebrow')}
            title={t('community.settings_section_banned')}
            description={t('community.settings_section_banned_desc')}
          />
          <Section anchor="banned">
            <BannedSection settings={settings} />
          </Section>

          <SectionHeader
            id="moderation"
            eyebrow={t('community.settings_section_moderation_eyebrow')}
            title={t('community.settings_section_moderation')}
            description={t('community.settings_section_moderation_desc')}
          />
          <Section anchor="moderation">
            <ModerationSection draft={draft} updateSetting={updateSetting} />
          </Section>

          <SectionHeader
            id="danger"
            eyebrow={t('community.settings_section_danger_eyebrow')}
            title={t('community.settings_section_danger')}
            description={t('community.settings_section_danger_desc')}
            tone="danger"
          />
          <Section anchor="danger">
            <DangerZoneSection slug={slug} communityName={community.name} />
          </Section>
        </main>
      </div>
    </div>
  );
}

const SECTION_ICONS: Record<'home' | 'palette' | 'lock' | 'file' | 'users' | 'ban' | 'shield' | 'flame', typeof Users> = {
  home: SettingsIcon,
  palette: Palette,
  lock: Lock,
  file: FileText,
  users: Users,
  ban: Ban,
  shield: Shield,
  flame: Flame,
};

function scrollToSection(id: CommunitySettingsTab) {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(`csp-section-${id}`);
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({ top, behavior: 'smooth' });
}

function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}

function StickyTopBar({
  slug,
  communityName,
  isDirty,
  saving,
  onSave,
  onDiscard,
}: {
  slug: string;
  communityName: string;
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="csp-sticky">
      <Link to={`/communities/${slug}`} className="csp-sticky-back" aria-label={t('community.back_to_community')}>
        <ArrowLeft size={16} />
        <span className="csp-sticky-back-text">{communityName}</span>
      </Link>
      <div className="csp-sticky-center">
        <span className="csp-sticky-eyebrow">{t('community.settings_title')}</span>
        {isDirty ? (
          <span className="csp-sticky-dirty">
            <span className="csp-sticky-dirty-dot" aria-hidden />
            {t('community.unsaved_changes')}
          </span>
        ) : (
          <span className="csp-sticky-clean">
            <Check size={13} />
            {t('community.all_saved')}
          </span>
        )}
      </div>
      <div className="csp-sticky-actions">
        <Button variant="ghost" onClick={onDiscard} disabled={!isDirty || saving}>
          {t('common.discard')}
        </Button>
        <Button onClick={onSave} loading={saving} disabled={!isDirty}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  tone,
}: {
  id: CommunitySettingsTab;
  eyebrow: string;
  title: string;
  description: string;
  tone?: 'danger';
}) {
  return (
    <header id={`csp-section-${id}`} className={cn('csp-section-header', tone === 'danger' && 'is-danger')}>
      <p className="csp-section-eyebrow">{eyebrow}</p>
      <h2 className="csp-section-title">{title}</h2>
      <p className="csp-section-desc">{description}</p>
    </header>
  );
}

function Section({ anchor, children }: { anchor: CommunitySettingsTab; children: ReactNode }) {
  return (
    <section className="csp-section-body" data-anchor={anchor}>
      {children}
    </section>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('csp-card', className)}>{children}</div>;
}

function Field({
  label,
  hint,
  children,
  required,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="csp-field">
      <label className="csp-field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="csp-field-required">*</span> : null}
      </label>
      {children}
      {hint ? <p className="csp-field-hint">{hint}</p> : null}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="csp-toggle-row">
      <div className="csp-toggle-meta">
        <p className="csp-toggle-title">{title}</p>
        {description ? <p className="csp-toggle-desc">{description}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  );
}

function GeneralSection({
  draft,
  update,
}: {
  draft: ReturnType<typeof useCommunitySettings>['draft'];
  update: ReturnType<typeof useCommunitySettings>['update'];
}) {
  const { t } = useTranslation();
  if (!draft) return null;
  return (
    <div className="csp-stack">
      <Card>
        <div className="csp-grid-2">
          <Field label={t('community.field_name')} required htmlFor="csp-name">
            <Input
              id="csp-name"
              value={draft.name}
              maxLength={80}
              onChange={(event) => update('name', event.target.value)}
              placeholder={t('community.name_placeholder')}
            />
            <CharCounter current={draft.name.length} max={80} />
          </Field>
          <Field
            label={t('community.field_slug')}
            hint={t('community.slug_hint')}
            htmlFor="csp-slug"
          >
            <div className="csp-slug-wrap">
              <span className="csp-slug-prefix">/communities/</span>
              <input
                id="csp-slug"
                value={draft.slug}
                onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))}
                placeholder="my-community"
                className="csp-slug-input"
              />
            </div>
          </Field>
        </div>
        <Field label={t('community.field_description')} hint={t('community.field_description_hint')} htmlFor="csp-desc">
          <Textarea
            id="csp-desc"
            value={draft.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder={t('community.desc_placeholder')}
            maxLength={400}
            className="csp-textarea"
          />
          <CharCounter current={draft.description.length} max={400} />
        </Field>
      </Card>

      <Card>
        <h3 className="csp-card-title">{t('community.field_language')}</h3>
        <p className="csp-card-sub">{t('community.field_language_desc')}</p>
        <div className="csp-language-grid">
          {([
            { value: 'ru', label: t('community.lang_ru'), flag: '🇷🇺' },
            { value: 'uz', label: t('community.lang_uz'), flag: '🇺🇿' },
            { value: 'en', label: t('community.lang_en'), flag: '🇬🇧' },
          ] as const).map((option) => {
            const active = draft.language === option.value;
            return (
              <button
                key={option.value}
                type="button"
                data-active={active}
                onClick={() => update('language', option.value)}
                className="csp-language-pill"
              >
                <span className="csp-language-flag" aria-hidden>{option.flag}</span>
                <span>{option.label}</span>
                {active ? <Check size={14} className="ml-auto text-[#FF6B00]" /> : null}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function CharCounter({ current, max }: { current: number; max: number }) {
  const tone = current > max * 0.9 ? 'warn' : current >= max ? 'error' : 'normal';
  return (
    <span className={cn('csp-counter', tone === 'warn' && 'is-warn', tone === 'error' && 'is-error')}>
      {current}/{max}
    </span>
  );
}

function CommunityLivePreview({
  draft,
  membersCount,
  postsCount,
}: {
  draft: { name: string; description: string; type: string; cover_url: string; avatar_url: string };
  membersCount: number;
  postsCount: number;
}) {
  const { t } = useTranslation();
  const typeMeta: Record<string, { label: string; icon: typeof Globe }> = {
    public: { label: t('community.type_public'), icon: Globe },
    closed: { label: t('community.type_closed'), icon: UserCheck },
    private: { label: t('community.type_private'), icon: Lock },
  };
  const TypeIcon = typeMeta[draft.type]?.icon || Globe;
  const typeLabel = typeMeta[draft.type]?.label || draft.type;
  return (
    <Card className="csp-preview">
      <div className="csp-preview-eyebrow">
        <span>{t('community.preview_label')}</span>
        <span className="csp-preview-pulse" aria-hidden />
      </div>
      <div className="csp-preview-card">
        <div className="csp-preview-cover">
          {draft.cover_url ? (
            <img src={draft.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="csp-preview-cover-fallback">
              <ImageIcon size={28} />
            </div>
          )}
        </div>
        <div className="csp-preview-body">
          <div className="csp-preview-avatar">
            {draft.avatar_url ? (
              <img src={draft.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{(draft.name || 'M').trim().charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="csp-preview-meta">
            <h3 className="csp-preview-name">{draft.name || t('community.preview_name_placeholder')}</h3>
            <p className="csp-preview-desc">
              {draft.description || t('community.preview_desc_placeholder')}
            </p>
            <div className="csp-preview-stats">
              <span className="csp-preview-stat">
                <TypeIcon size={13} />
                {typeLabel}
              </span>
              <span className="csp-preview-stat">
                <Users size={13} />
                {membersCount} {t('community.members')}
              </span>
              <span className="csp-preview-stat">
                <MessageSquare size={13} />
                {postsCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function BrandingSection({
  draft,
  uploadAvatar,
  uploadCover,
  onClearAvatar,
  onClearCover,
}: {
  draft: { name: string; avatar_url: string; cover_url: string };
  uploadAvatar: { isPending: boolean; mutate: (file: File) => void };
  uploadCover: { isPending: boolean; mutate: (file: File) => void };
  onClearAvatar: () => void;
  onClearCover: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="csp-stack">
      <Card>
        <h3 className="csp-card-title">{t('community.field_avatar')}</h3>
        <p className="csp-card-sub">{t('community.field_avatar_desc')}</p>
        <MediaDropzone
          kind="avatar"
          url={draft.avatar_url}
          pending={uploadAvatar.isPending}
          onFile={(file) => uploadAvatar.mutate(file)}
          onClear={onClearAvatar}
          hint={t('community.avatar_hint')}
          fallbackInitial={draft.name}
        />
      </Card>
      <Card>
        <h3 className="csp-card-title">{t('community.field_cover')}</h3>
        <p className="csp-card-sub">{t('community.field_cover_desc')}</p>
        <MediaDropzone
          kind="cover"
          url={draft.cover_url}
          pending={uploadCover.isPending}
          onFile={(file) => uploadCover.mutate(file)}
          onClear={onClearCover}
          hint={t('community.cover_hint')}
          fallbackInitial={null}
        />
      </Card>
    </div>
  );
}

function MediaDropzone({
  kind,
  url,
  pending,
  onFile,
  onClear,
  hint,
  fallbackInitial,
}: {
  kind: 'avatar' | 'cover';
  url: string;
  pending: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  hint: string;
  fallbackInitial: string | null;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxSize = kind === 'avatar' ? MAX_AVATAR_SIZE : MAX_COVER_SIZE;
  const accept = 'image/png,image/jpeg,image/webp,image/gif';

  function handleFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('community.upload_image_only'));
      return;
    }
    if (file.size > maxSize) {
      setError(t('community.upload_too_large', { mb: Math.round(maxSize / 1024 / 1024) }));
      return;
    }
    onFile(file);
  }

  const ratioClass = kind === 'avatar' ? 'csp-media-avatar' : 'csp-media-cover';

  return (
    <div className="csp-media">
      <div
        className={cn('csp-media-frame', ratioClass, hover && 'is-hover', pending && 'is-pending')}
        onDragOver={(event) => {
          event.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(event) => {
          event.preventDefault();
          setHover(false);
          handleFile(event.dataTransfer.files?.[0] || null);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={kind === 'avatar' ? t('community.field_avatar') : t('community.field_cover')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0] || null)}
        />
        {pending ? (
          <div className="csp-media-overlay">
            <Loader2 size={28} className="animate-spin" />
            <p className="csp-media-overlay-text">{t('common.loading')}</p>
          </div>
        ) : url ? (
          <>
            <img src={url} alt="" className="h-full w-full object-cover" />
            <div className="csp-media-overlay">
              <Camera size={26} />
              <p className="csp-media-overlay-text">{t('community.media_replace')}</p>
            </div>
          </>
        ) : (
          <div className="csp-media-empty">
            {kind === 'avatar' ? (
              <div className="csp-media-avatar-placeholder">
                <span>{(fallbackInitial || 'M').trim().charAt(0).toUpperCase()}</span>
              </div>
            ) : (
              <ImageIcon size={32} className="text-gray-300" />
            )}
            <p className="csp-media-empty-text">
              {kind === 'avatar' ? t('community.drop_avatar') : t('community.drop_cover')}
            </p>
            <p className="csp-media-empty-hint">{hint}</p>
          </div>
        )}
      </div>
      <div className="csp-media-foot">
        <Button variant="outline" onClick={() => inputRef.current?.click()} loading={pending}>
          <Camera size={15} />
          {url ? t('community.media_replace_btn') : t('community.media_upload_btn')}
        </Button>
        {url ? (
          <Button variant="ghost" onClick={onClear} disabled={pending}>
            <Trash2 size={15} />
            {t('community.media_remove')}
          </Button>
        ) : null}
        {error ? (
          <p className="csp-media-error">
            <AlertTriangle size={14} />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AccessSection({
  draft,
  update,
  updateSetting,
}: {
  draft: ReturnType<typeof useCommunitySettings>['draft'];
  update: ReturnType<typeof useCommunitySettings>['update'];
  updateSetting: ReturnType<typeof useCommunitySettings>['updateSetting'];
}) {
  const { t } = useTranslation();
  if (!draft) return null;
  const types: Array<{ value: 'public' | 'closed' | 'private'; title: string; desc: string; icon: typeof Globe }> = [
    { value: 'public', title: t('community.type_public'), desc: t('community.type_public_desc'), icon: Globe },
    { value: 'closed', title: t('community.type_closed'), desc: t('community.type_closed_desc'), icon: UserCheck },
    { value: 'private', title: t('community.type_private'), desc: t('community.type_private_desc'), icon: Lock },
  ];
  return (
    <div className="csp-stack">
      <Card>
        <h3 className="csp-card-title">{t('community.field_visibility')}</h3>
        <p className="csp-card-sub">{t('community.field_visibility_desc')}</p>
        <div className="csp-type-grid">
          {types.map((option) => {
            const active = draft.type === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                data-active={active}
                onClick={() => update('type', option.value)}
                className="csp-type-card"
              >
                <div className="csp-type-icon"><Icon size={20} /></div>
                <div className="csp-type-meta">
                  <p className="csp-type-title">{option.title}</p>
                  <p className="csp-type-desc">{option.desc}</p>
                </div>
                {active ? (
                  <span className="csp-type-badge">
                    <Check size={12} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="csp-card-title">{t('community.field_posting')}</h3>
        <p className="csp-card-sub">{t('community.field_posting_desc')}</p>
        <div className="csp-toggle-list">
          <ToggleRow
            title={t('community.toggle_polls')}
            description={t('community.toggle_polls_desc')}
            checked={draft.settings.allow_polls}
            onChange={(value) => updateSetting('allow_polls', value)}
          />
          <ToggleRow
            title={t('community.toggle_videos')}
            description={t('community.toggle_videos_desc')}
            checked={draft.settings.allow_videos}
            onChange={(value) => updateSetting('allow_videos', value)}
          />
          <ToggleRow
            title={t('community.toggle_comments')}
            description={t('community.toggle_comments_desc')}
            checked={draft.settings.comments_enabled}
            onChange={(value) => updateSetting('comments_enabled', value)}
          />
        </div>
      </Card>
    </div>
  );
}

function RulesSection({
  draft,
  update,
}: {
  draft: ReturnType<typeof useCommunitySettings>['draft'];
  update: ReturnType<typeof useCommunitySettings>['update'];
}) {
  const { t } = useTranslation();
  if (!draft) return null;
  return (
    <div className="csp-stack">
      <Card>
        <h3 className="csp-card-title">{t('community.field_rules')}</h3>
        <p className="csp-card-sub">{t('community.field_rules_desc')}</p>
        <Textarea
          value={draft.rules}
          onChange={(event) => update('rules', event.target.value)}
          placeholder={t('community.rules_placeholder')}
          maxLength={4000}
          className="csp-textarea csp-textarea-tall"
        />
        <div className="csp-rules-meta">
          <CharCounter current={draft.rules.length} max={4000} />
          <p className="csp-field-hint">{t('community.rules_format_hint')}</p>
        </div>
      </Card>
    </div>
  );
}

function MembersSection({
  settings,
}: {
  settings: ReturnType<typeof useCommunitySettings>;
}) {
  const { t } = useTranslation();
  const members = settings.members.data || [];
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');

  function handleInvite() {
    const username = inviteUsername.trim();
    if (!username) return;
    settings.invite.mutate(username, {
      onSuccess: () => {
        setInviteUsername('');
        setInviteOpen(false);
      },
    });
  }

  return (
    <div className="csp-stack">
      <Card>
        <div className="csp-section-toolbar">
          <div>
            <h3 className="csp-card-title">{t('community.members_title')}</h3>
            <p className="csp-card-sub">{t('community.members_desc', { count: members.length })}</p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus size={15} />
            {t('community.invite_member')}
          </Button>
        </div>
        {settings.members.isLoading ? (
          <div className="csp-members">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="csp-empty">
            <Users size={28} />
            <p>{t('community.members_empty')}</p>
          </div>
        ) : (
          <ul className="csp-members">
            {members.map((member) => (
              <li key={member.id || member.user.id} className="csp-member-row">
                <Avatar
                  src={member.user.avatar_url}
                  name={member.user.display_name}
                  className="csp-member-avatar"
                />
                <div className="csp-member-meta">
                  <p className="csp-member-name">{member.user.display_name}</p>
                  <p className="csp-member-username">@{member.user.username}</p>
                </div>
                <span className={cn('csp-role-pill', `is-${member.role}`)}>{t(`community.role_${member.role}`)}</span>
                <MemberRoleMenu
                  role={member.role}
                  onChangeRole={(role) => settings.changeRole.mutate({ id: member.id || member.user.id, role })}
                  onBan={() => settings.banMember.mutate(member.id || member.user.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('community.invite_title')}>
        <p className="csp-modal-desc">{t('community.invite_desc')}</p>
        <Input
          value={inviteUsername}
          onChange={(event) => setInviteUsername(event.target.value)}
          placeholder="@username"
        />
        <div className="csp-modal-actions">
          <Button variant="outline" onClick={() => setInviteOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleInvite} loading={settings.invite.isPending}>
            <Send size={15} />
            {t('community.invite_send')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function MemberRoleMenu({
  role,
  onChangeRole,
  onBan,
}: {
  role: string;
  onChangeRole: (role: string) => void;
  onBan: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (role === 'creator') {
    return <span className="csp-creator-pill">{t('community.creator_locked')}</span>;
  }
  return (
    <div className="csp-role-menu">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="csp-role-trigger"
      >
        <SlidersHorizontal size={14} />
      </button>
      {open ? (
        <>
          <button
            className="fixed inset-0 z-30 cursor-default"
            aria-label={t('ui.close_menu')}
            onClick={() => setOpen(false)}
          />
          <div className="csp-role-popover" role="menu">
            <p className="csp-role-popover-title">{t('community.change_role')}</p>
            {(['admin', 'moderator', 'member'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="menuitem"
                data-active={role === value}
                onClick={() => {
                  onChangeRole(value);
                  setOpen(false);
                }}
                className="csp-role-popover-item"
              >
                {t(`community.role_${value}`)}
                {role === value ? <Check size={14} /> : null}
              </button>
            ))}
            <div className="csp-role-popover-sep" />
            <button
              type="button"
              role="menuitem"
              className="csp-role-popover-item is-danger"
              onClick={() => {
                onBan();
                setOpen(false);
              }}
            >
              <Ban size={14} />
              {t('community.ban')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function BannedSection({
  settings,
}: {
  settings: ReturnType<typeof useCommunitySettings>;
}) {
  const { t } = useTranslation();
  const banned = settings.banList.data || [];
  return (
    <Card>
      <div className="csp-section-toolbar">
        <div>
          <h3 className="csp-card-title">{t('community.banned_title')}</h3>
          <p className="csp-card-sub">{t('community.banned_desc', { count: banned.length })}</p>
        </div>
      </div>
      {settings.banList.isLoading ? (
        <div className="csp-members">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : banned.length === 0 ? (
        <div className="csp-empty">
          <Shield size={28} />
          <p>{t('community.banned_empty')}</p>
        </div>
      ) : (
        <ul className="csp-members">
          {banned.map((entry) => (
            <li key={entry.id} className="csp-member-row">
              <Avatar
                src={entry.user.avatar_url}
                name={entry.user.display_name}
                className="csp-member-avatar"
              />
              <div className="csp-member-meta">
                <p className="csp-member-name">{entry.user.display_name}</p>
                <p className="csp-member-username">@{entry.user.username}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => settings.unbanMember.mutate(entry.id)}
                loading={settings.unbanMember.isPending}
              >
                <Unlock size={14} />
                {t('community.unban')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ModerationSection({
  draft,
  updateSetting,
}: {
  draft: ReturnType<typeof useCommunitySettings>['draft'];
  updateSetting: ReturnType<typeof useCommunitySettings>['updateSetting'];
}) {
  const { t } = useTranslation();
  if (!draft) return null;
  return (
    <div className="csp-stack">
      <Card>
        <h3 className="csp-card-title">{t('community.moderation_title')}</h3>
        <p className="csp-card-sub">{t('community.moderation_desc')}</p>
        <div className="csp-toggle-list">
          <ToggleRow
            title={t('community.toggle_premoderation')}
            description={t('community.toggle_premoderation_desc')}
            checked={draft.settings.premoderation}
            onChange={(value) => updateSetting('premoderation', value)}
          />
          <ToggleRow
            title={t('community.toggle_hide_author')}
            description={t('community.toggle_hide_author_desc')}
            checked={draft.settings.hide_author}
            onChange={(value) => updateSetting('hide_author', value)}
          />
        </div>
      </Card>
      <Card>
        <h3 className="csp-card-title">{t('community.slow_mode_title')}</h3>
        <p className="csp-card-sub">{t('community.slow_mode_desc')}</p>
        <Field label={t('community.slow_mode_label')}>
          <Select
            value={String(draft.settings.slow_mode_seconds)}
            onChange={(event) => updateSetting('slow_mode_seconds', Number(event.target.value))}
          >
            <option value="0">{t('community.slow_mode_off')}</option>
            <option value="10">10 {t('community.slow_mode_seconds')}</option>
            <option value="30">30 {t('community.slow_mode_seconds')}</option>
            <option value="60">1 {t('community.slow_mode_minute')}</option>
            <option value="300">5 {t('community.slow_mode_minutes')}</option>
            <option value="900">15 {t('community.slow_mode_minutes')}</option>
          </Select>
        </Field>
      </Card>
    </div>
  );
}

function DangerZoneSection({ slug, communityName }: { slug: string; communityName: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  return (
    <div className="csp-stack">
      <Card className="csp-danger-card">
        <div className="csp-danger-row">
          <div className="csp-danger-meta">
            <p className="csp-danger-title">{t('community.danger_archive_title')}</p>
            <p className="csp-danger-desc">{t('community.danger_archive_desc')}</p>
          </div>
          <Button variant="outline" onClick={() => setArchiveOpen(true)}>
            {t('community.danger_archive_btn')}
          </Button>
        </div>
      </Card>
      <Card className="csp-danger-card">
        <div className="csp-danger-row">
          <div className="csp-danger-meta">
            <p className="csp-danger-title">{t('community.danger_transfer_title')}</p>
            <p className="csp-danger-desc">{t('community.danger_transfer_desc')}</p>
          </div>
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <Link2 size={15} />
            {t('community.danger_transfer_btn')}
          </Button>
        </div>
      </Card>
      <Card className="csp-danger-card is-critical">
        <div className="csp-danger-row">
          <div className="csp-danger-meta">
            <p className="csp-danger-title">{t('community.danger_delete_title')}</p>
            <p className="csp-danger-desc">{t('community.danger_delete_desc')}</p>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} />
            {t('community.danger_delete_btn')}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={t('community.danger_archive_confirm_title')}
        description={t('community.danger_archive_confirm_desc')}
        confirmText={t('community.danger_archive_btn')}
        tone="primary"
        onConfirm={() => setArchiveOpen(false)}
      />
      <ConfirmDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={t('community.danger_transfer_confirm_title')}
        description={t('community.danger_transfer_confirm_desc')}
        confirmText={t('community.danger_transfer_btn')}
        tone="primary"
        onConfirm={() => setTransferOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('community.danger_delete_confirm_title', { name: communityName })}
        description={t('community.danger_delete_confirm_desc')}
        confirmText={t('community.danger_delete_btn')}
        tone="danger"
        onConfirm={() => {
          setDeleteOpen(false);
          toast.show({ title: t('community.danger_unavailable'), tone: 'info' });
        }}
      />
    </div>
  );
}

export default CommunitySettingsPage;
