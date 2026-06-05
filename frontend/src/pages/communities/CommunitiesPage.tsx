import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  FileText,
  Film,
  Gamepad2,
  Globe,
  Grid2X2,
  Lock,
  MessageSquare,
  Monitor,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Community, Post } from '../../shared/types';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, Skeleton, Tabs, Textarea, useToast } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { PostComposer } from '../../features/posts/components/PostComposer';
import { useAuthStore } from '../../store/authStore';
import { useCommunity } from '../../features/communities/useCommunity';
import { useTranslation } from '../../shared/i18n';
import { ProductEmptyState } from '../../shared/ui/ProductEmptyState';
import { authRedirectUrl } from '../../utils/authRedirect';

type CommunityCategory = 'all' | 'memes' | 'it' | 'games' | 'cinema' | 'humor' | 'education';
type CommunityTypeFilter = 'all' | 'public' | 'closed' | 'private' | 'joined';

const COMMUNITY_SECTION_LIMIT = 5;

const COMMUNITY_CATEGORIES: Array<{
  id: CommunityCategory;
  labelKey: string;
  icon: LucideIcon;
  keywords: string[];
}> = [
  { id: 'all', labelKey: 'community.category_all', icon: Grid2X2, keywords: [] },
  { id: 'memes', labelKey: 'community.category_memes', icon: Smile, keywords: ['мем', 'meme', 'mem'] },
  { id: 'it', labelKey: 'community.category_it', icon: Monitor, keywords: ['it', 'айти', 'код', 'code', 'dev', 'программ', 'tech', 'тех', 'дизайн', 'design', 'нейро', 'neuro'] },
  { id: 'games', labelKey: 'community.category_games', icon: Gamepad2, keywords: ['игр', 'game', 'gaming', 'гейм'] },
  { id: 'cinema', labelKey: 'community.category_cinema', icon: Film, keywords: ['кино', 'film', 'movie', 'сериал'] },
  { id: 'humor', labelKey: 'community.category_humor', icon: Smile, keywords: ['юмор', 'humor', 'fun', 'смеш', 'шут'] },
  { id: 'education', labelKey: 'community.category_education', icon: BookOpen, keywords: ['образ', 'learn', 'study', 'учеб', 'наук'] },
];

export function CommunitiesPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommunityCategory>('all');
  const [typeFilter, setTypeFilter] = useState<CommunityTypeFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [showAllNew, setShowAllNew] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ['communities', q], queryFn: () => api.communities(q), staleTime: 30_000 });

  const visibleCommunities = useMemo(() => {
    const category = COMMUNITY_CATEGORIES.find((item) => item.id === activeCategory);
    const categoryKeywords = category?.keywords || [];

    return (query.data || []).filter((community) => {
      if (typeFilter === 'joined' && community.membership !== 'active') return false;
      if (typeFilter !== 'all' && typeFilter !== 'joined' && community.type !== typeFilter) return false;
      if (!categoryKeywords.length) return true;

      const haystack = [
        community.name,
        community.description,
        community.slug,
        community.language,
        community.type,
      ].join(' ').toLowerCase();

      return categoryKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    });
  }, [activeCategory, query.data, typeFilter]);

  const sortedByActivity = useMemo(
    () => [...visibleCommunities].sort((a, b) => communityActivity(b) - communityActivity(a)),
    [visibleCommunities],
  );
  const popularCandidates = sortedByActivity;
  const visiblePopular = showAllPopular ? popularCandidates : popularCandidates.slice(0, COMMUNITY_SECTION_LIMIT);
  const popularIds = new Set(popularCandidates.slice(0, COMMUNITY_SECTION_LIMIT).map((community) => community.id));
  const newCandidates = visibleCommunities.filter((community) => !popularIds.has(community.id));
  const visibleNew = showAllNew ? newCandidates : newCandidates.slice(0, COMMUNITY_SECTION_LIMIT);
  const activeFilterCount = (activeCategory !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);
  const hasSearchContext = Boolean(q.trim() || activeFilterCount);

  return (
    <div>
      <header className="page-header sticky top-16 z-20 px-4 py-5 sm:top-0 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <span className="page-icon-tile bg-[linear-gradient(145deg,#9B5CFF,#7C3AED)]"><Users size={22} /></span>
            <div className="min-w-0">
              <h1 className="page-title">{t('community.title')}</h1>
              <p className="page-subtitle mt-1.5">{t('community.subtitle')}</p>
            </div>
          </div>
          <Link
            to="/communities/new"
            className="motion-control inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#FF7A1A,#FF5A00)] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,107,0,0.24)] hover:brightness-105"
          >
            <Plus size={18} /> {t('common.create')}
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="relative block min-w-0">
            <span className="sr-only">{t('community.search')}</span>
            <Search size={24} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t('community.search')}
              className="h-14 w-full rounded-2xl border border-[var(--app-line)] bg-white pl-14 pr-4 text-base font-semibold text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-950"
            />
          </label>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="community-extra-filters"
            onClick={() => setFiltersOpen((value) => !value)}
            className="motion-control inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--app-line)] bg-white px-5 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <SlidersHorizontal size={19} />
            {t('community.filters')}
            {activeFilterCount ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-[#FF6B00]">{activeFilterCount}</span> : null}
          </button>
        </div>

        {filtersOpen ? (
          <div id="community-extra-filters" className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-[var(--app-line)] bg-white p-2 shadow-sm dark:bg-zinc-950">
            {(['all', 'public', 'closed', 'private', 'joined'] as CommunityTypeFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                data-active={typeFilter === filter}
                onClick={() => setTypeFilter(filter)}
                className="community-filter-chip"
              >
                {t(`community.filter_${filter}`)}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <nav className="border-b border-[var(--app-line)] bg-white/72 px-3 py-3 backdrop-blur dark:bg-zinc-950/72 sm:px-5" aria-label={t('community.categories')} id="community-category-tabs">
        <div ref={categoryRailRef} className="flex items-center gap-2 overflow-x-auto scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {COMMUNITY_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                type="button"
                data-active={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
                className="community-category-pill"
              >
                <Icon size={18} />
                {t(category.labelKey)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => categoryRailRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
            className="community-category-pill community-category-pill--icon"
            aria-label={t('community.scroll_categories')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </nav>

      <div className="space-y-5 p-3 sm:p-5 lg:p-6">
        {query.isLoading ? (
          <CommunitiesDiscoverySkeleton />
        ) : query.isError ? (
          <ErrorState description={t('community.load_error')} onRetry={() => query.refetch()} />
        ) : visibleCommunities.length ? (
          <>
            <CommunitySection
              title={t('community.popular_section')}
              icon={<Sparkles size={19} className="text-[#FF6B00]" />}
              action={popularCandidates.length > COMMUNITY_SECTION_LIMIT ? (
                <button type="button" onClick={() => setShowAllPopular((value) => !value)} className="community-section-action">
                  {showAllPopular ? t('community.show_less') : t('community.show_all')}
                </button>
              ) : null}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {visiblePopular.map((community) => <CommunityCard key={community.id} community={community} variant="featured" />)}
              </div>
            </CommunitySection>

            {newCandidates.length ? (
              <CommunitySection
                title={t('community.new_section')}
                icon={<Star size={19} className="text-amber-400" fill="currentColor" />}
                action={newCandidates.length > COMMUNITY_SECTION_LIMIT ? (
                  <button type="button" onClick={() => setShowAllNew((value) => !value)} className="community-section-action">
                    {showAllNew ? t('community.show_less') : t('community.show_all')}
                  </button>
                ) : null}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {visibleNew.map((community) => <CommunityCard key={community.id} community={community} variant="compact" />)}
                </div>
              </CommunitySection>
            ) : null}
          </>
        ) : (
          <ProductEmptyState
            className="sm:min-h-[34rem]"
            title={t('community.not_found')}
            description={hasSearchContext ? t('community.not_found_desc') : t('community.empty_desc')}
            tone="rocket"
            icon={<Users size={38} />}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasSearchContext ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQ('');
                      setActiveCategory('all');
                      setTypeFilter('all');
                    }}
                    className="motion-control inline-flex h-12 items-center justify-center rounded-xl border border-[var(--app-line)] bg-white px-5 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  >
                    {t('community.reset_filters')}
                  </button>
                ) : null}
                <Link
                  to="/communities/new"
                  className="motion-control inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#FF7A1A,#FF5A00)] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,107,0,0.24)] hover:brightness-105"
                >
                  <Plus size={17} /> {t('common.create')}
                </Link>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}

function communityActivity(community: Community) {
  return (community.members_count || 0) * 2 + (community.posts_count || 0);
}

function CommunitySection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="community-section">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <h2 className="truncate text-xl font-black tracking-[-0.035em] text-[var(--app-ink)]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CommunitiesDiscoverySkeleton() {
  return (
    <>
      <section className="community-section">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-7 w-56 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[19.25rem] rounded-[1.2rem]" />
          ))}
        </div>
      </section>
      <section className="community-section">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-7 w-48 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[14.5rem] rounded-[1.2rem]" />
          ))}
        </div>
      </section>
    </>
  );
}

export function CreateCommunityPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState(t('community.rules_hint'));
  const [type, setType] = useState('public');
  const mutation = useMutation({
    mutationFn: () => api.createCommunity({ name, slug: slug || undefined, description, rules, type, settings: { premoderation: false, allow_polls: true } }),
    onSuccess: (community) => {
      toast.show({ title: t('community.created'), tone: 'success' });
      navigate(`/communities/${community.slug}`);
    },
    onError: (event) => toast.show({ title: event instanceof Error ? event.message : t('community.create_error'), tone: 'error' }),
  });
  if (!user) return <NeedAuthBlock />;
  const TYPE_OPTIONS = [
    { value: 'public', label: t('community.type_public'), desc: t('community.type_public_desc'), icon: Globe },
    { value: 'closed', label: t('community.type_closed'), desc: t('community.type_closed_desc'), icon: UserCheck },
    { value: 'private', label: t('community.type_private'), desc: t('community.type_private_desc'), icon: Lock },
  ];
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 px-3 py-5 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/90 sm:px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <Plus size={18} />
          </div>
          <h1 className="text-2xl font-black tracking-tight">{t('community.create_title')}</h1>
        </div>
      </header>
      <div className="p-3 sm:p-4">
        <section className="space-y-6 rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.name')}</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('community.name_placeholder')} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.slug')}</label>
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="memes-and-humor" />
            <p className="mt-1 text-xs text-gray-400">{t('community.slug_auto')}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.description')}</label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('community.desc_placeholder')} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.rules')}</label>
            <Textarea value={rules} onChange={(event) => setRules(event.target.value)} placeholder={t('community.rules_placeholder')} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.type')}</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setType(opt.value)} className={`rounded-xl border p-3 text-left transition-all ${
                  type === opt.value ? 'border-[#FF6B00] bg-orange-50 ring-1 ring-[#FF6B00]/30 dark:bg-orange-950/20' : 'border-gray-200 hover:border-gray-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}>
                  <opt.icon size={18} className={type === opt.value ? 'text-[#FF6B00]' : 'text-gray-400'} />
                  <p className="mt-1.5 text-sm font-black">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} className="w-full">{t('common.create')}</Button>
        </section>
      </div>
    </div>
  );
}

type CommunityTab = 'feed' | 'popular' | 'new' | 'media' | 'members' | 'rules' | 'manage';

export function CommunityPage() {
  const { slug = '' } = useParams();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<CommunityTab>('feed');
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const { query, join, members: membersQuery, requests: requestsQuery } = useCommunity(slug, tab);

  if (query.isLoading) return <div className="p-3 sm:p-4"><Skeleton className="h-96" /></div>;
  if (query.isError || !query.data) return <div className="p-3 sm:p-4"><ErrorState description={query.error instanceof Error ? query.error.message : t('community.not_found_page')} onRetry={() => query.refetch()} /></div>;

  const { community } = query.data;
  const canManage = query.data.role === 'creator' || query.data.role === 'admin' || query.data.role === 'moderator' || user?.role === 'global_admin';
  const canPost = Boolean(user && (query.data.membership === 'active' || canManage));

  return (
    <div>
      <div className="space-y-5 p-3 sm:p-4">
        <section className="rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="relative h-44 overflow-hidden rounded-t-2xl bg-gradient-to-br from-[#FF6B00]/80 via-[#FF8C38]/60 to-[#7C3AED]/80 sm:h-52">
            {community.cover_url ? <img src={community.cover_url} alt="" className="h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          <div className="relative z-10 px-5 pb-5">
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
              <Avatar src={community.avatar_url} name={community.name} className="h-24 w-24 rounded-2xl border-4 border-white shadow-lg dark:border-zinc-900" />
              <div className="flex gap-2">
                {canManage ? <Link to={`/communities/${community.slug}/settings`}><Button variant="outline"><Settings size={16} /> {t('community.manage')}</Button></Link> : null}
                <Button onClick={() => {
                  if (query.data.membership === 'active') {
                    setConfirmLeaveOpen(true);
                  } else {
                    join.mutate();
                  }
                }} loading={join.isPending}>{query.data.membership === 'active' ? t('community.leave') : community.type === 'closed' ? t('community.request') : t('community.join')}</Button>
              </div>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight">{community.name}</h1>
            <p className="mt-1 text-gray-600 dark:text-zinc-300">{community.description}</p>
            <div className="mt-3 flex items-center gap-4 text-sm font-bold text-gray-400">
              <span className="flex items-center gap-1.5"><Users size={15} className="text-purple-500" />{community.members_count} {t('community.members')}</span>
              <span className="flex items-center gap-1.5"><MessageSquare size={15} className="text-orange-500" />{community.posts_count} {t('community.posts')}</span>
            </div>
            <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/70 px-4 py-3 text-sm font-bold text-purple-800 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-200">
              {canPost ? 'Сообщество готово к свежему мему: публикации отсюда попадают в ленты участников.' : 'Вступите, чтобы получать мемы сообщества и участвовать в обсуждениях.'}
            </div>
          </div>
        </section>
        <Tabs
          value={tab}
          onChange={(value) => setTab(value as CommunityTab)}
          items={[
            { id: 'feed', label: t('community.tab_posts') },
            { id: 'popular', label: t('community.tab_popular') },
            { id: 'new', label: t('community.tab_new') },
            { id: 'media', label: t('community.tab_media') },
            { id: 'members', label: t('community.tab_members') },
            { id: 'rules', label: t('community.tab_rules') },
            ...(canManage ? [{ id: 'manage' as CommunityTab, label: t('community.tab_panel') }] : []),
          ]}
        />
        {tab === 'rules' ? (
          <section className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm whitespace-pre-wrap dark:border-zinc-800/60 dark:bg-zinc-900/50">
            <div className="mb-3 flex items-center gap-2"><FileText size={18} className="text-purple-500" /><h2 className="font-black">{t('community.rules_title')}</h2></div>
            <p className="text-gray-600 leading-relaxed dark:text-zinc-300">{community.rules || t('community.rules_empty')}</p>
          </section>
        ) : tab === 'members' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(membersQuery.data || []).map((member) => {
              const ROLE_COLORS: Record<string, string> = { creator: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400', admin: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400', moderator: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' };
              return (
                <Link key={member.user.id} to={`/user/${member.user.username}`} className="flex items-center gap-3 rounded-2xl border border-gray-200/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50">
                  <div className="relative">
                    <Avatar src={member.user.avatar_url} name={member.user.display_name} className="h-11 w-11 rounded-xl" />
                    {member.role === 'creator' && <Crown size={10} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-500 p-0.5 text-white ring-2 ring-white dark:ring-zinc-900" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{member.user.display_name}</p>
                    <p className="truncate text-sm text-gray-400">@{member.user.username}</p>
                  </div>
                  {member.role !== 'member' && <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[member.role] || 'text-gray-500 bg-gray-100'}`}>{member.role}</span>}
                </Link>
              );
            })}
          </div>
        ) : tab === 'manage' ? (
          <CommunityManagement slug={slug} requests={requestsQuery.data || []} members={membersQuery.data || []} />
        ) : (
          <div className="space-y-5">
            {canPost ? <PostComposer communityId={community.id} defaultExpanded={query.data.posts.length === 0} onCreated={() => queryClient.invalidateQueries({ queryKey: ['community', slug] })} /> : null}
            {query.data.posts.length ? query.data.posts.map((post: Post) => <PostCard key={post.id} post={post} onDeleted={() => queryClient.invalidateQueries({ queryKey: ['community', slug] })} />) : <EmptyState title={t('community.posts_empty')} />}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        title="Выйти из сообщества?"
        description="Вы потеряете доступ к публикациям и обсуждениям."
        confirmText="Выйти"
        onConfirm={() => {
          setConfirmLeaveOpen(false);
          join.mutate();
        }}
      />
    </div>
  );
}

function CommunityManagement({ slug, requests }: { slug: string; requests: Array<{ id: string; user: { display_name: string; username: string } }> ; members: unknown[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const action = (promise: Promise<unknown>) => promise.then(() => {
    toast.show({ title: t('common.done'), tone: 'success' });
    queryClient.invalidateQueries({ queryKey: ['community-requests', slug] });
    queryClient.invalidateQueries({ queryKey: ['community-members', slug] });
  });
  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label={t('community.requests')} value={requests.length} icon={UserPlus} color="text-blue-500" />
        <Metric label={t('community.moderation')} value={t('community.moderation_on')} icon={Shield} color="text-emerald-500" />
        <Metric label={t('community.analytics')} value={t('community.analytics_basic')} icon={PenLine} color="text-purple-500" />
      </div>
      <div className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-blue-500" />
          <h2 className="text-lg font-black">{t('community.join_requests')}</h2>
          {requests.length > 0 && <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{requests.length}</span>}
        </div>
        {requests.length ? (
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/40">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={(request.user as any).avatar_url} name={request.user.display_name} className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-black text-sm">{request.user.display_name}</p>
                    <p className="truncate text-xs text-gray-400">@{request.user.username}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => action(api.rejectCommunityRequest(slug, request.id))} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"><X size={14} /></button>
                  <button onClick={() => action(api.approveCommunityRequest(slug, request.id))} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400"><Check size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center dark:bg-zinc-800/30">
            <UserCheck size={24} className="mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-gray-400">{t('community.no_requests')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function CommunityCard({ community, variant }: { community: Community; variant: 'featured' | 'compact' }) {
  const { t } = useTranslation();
  const TypeIcon = community.type === 'private' ? Lock : community.type === 'closed' ? UserCheck : Globe;
  const mediaClassName = variant === 'featured' ? 'community-card-media h-36' : 'community-card-media h-20';
  return (
    <article className="community-card">
      <Link to={`/communities/${community.slug}`} className="group block min-w-0" aria-label={community.name}>
        <CommunityMedia community={community} className={mediaClassName} />
        <div className="mt-4 min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-[0.95rem] font-black tracking-[-0.02em] text-[var(--app-ink)]">{community.name}</h3>
            <TypeIcon size={14} className="shrink-0 text-[#7C3AED]" />
          </div>
          <p className={`${variant === 'featured' ? 'min-h-10' : 'min-h-9'} mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-gray-500 dark:text-zinc-400`}>
            {community.description || t('community.no_description')}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs font-bold text-gray-500 dark:text-zinc-500">
            <span className="flex items-center gap-1"><Users size={13} />{community.members_count} {t('community.members')}</span>
            {variant === 'featured' ? <span className="flex items-center gap-1"><MessageSquare size={13} />{community.posts_count}</span> : null}
          </div>
        </div>
      </Link>
      <CommunityAction community={community} />
    </article>
  );
}

function CommunityMedia({ community, className }: { community: Community; className: string }) {
  const initial = community.name.trim().slice(0, 1).toUpperCase() || 'M';

  if (community.cover_url) {
    return (
      <div className={className}>
        <img src={community.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
    );
  }

  if (community.avatar_url) {
    return (
      <div className={className}>
        <img src={community.avatar_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
    );
  }

  return (
    <div className={`${className} community-card-fallback`} aria-hidden="true">
      <span>{initial}</span>
    </div>
  );
}

function CommunityAction({ community }: { community: Community }) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isJoined = community.membership === 'active';
  const mutation = useMutation({
    mutationFn: () => api.joinCommunity(community.slug, false),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community', community.slug] });
      toast.show({
        title: result.membership === 'active' ? t('community.joined') : t('community.request_sent'),
        tone: 'success',
      });
    },
    onError: (event) => toast.show({ title: event instanceof Error ? event.message : t('community.join_error'), tone: 'error' }),
  });

  if (isJoined) {
    return (
      <Link to={`/communities/${community.slug}`} className="community-card-action community-card-action--secondary">
        {t('community.open')}
      </Link>
    );
  }

  if (!user) {
    return (
      <Link to={authRedirectUrl(`/communities/${community.slug}`)} className="community-card-action">
        {community.type === 'closed' ? t('community.request') : t('community.join')}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="community-card-action">
      {mutation.isPending ? t('community.joining') : community.type === 'closed' ? t('community.request') : t('community.join')}
    </button>
  );
}

function Metric({ label, value, icon: Icon, color }: { label: string; value: string | number; icon?: typeof Users; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
      {Icon && <Icon size={18} className={`mb-2 ${color || 'text-gray-400'}`} />}
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-black">{value}</p>
    </div>
  );
}

function NeedAuthBlock() {
  const { t } = useTranslation();
  return <div className="p-3 sm:p-4"><EmptyState title={t('common.required')} description={t('community.login_required')} /></div>;
}
