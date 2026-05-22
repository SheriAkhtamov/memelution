import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, Clock, Crown, FileText, Globe, Image, Lock, MessageSquare, PenLine, Plus, Search, Settings, Shield, Upload, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Community, Post } from '../../shared/types';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Tabs, Textarea, useToast } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { PostComposer } from '../../features/posts/components/PostComposer';
import { useAuthStore } from '../../store/authStore';
import { useCommunity } from '../../features/communities/useCommunity';
import { useTranslation } from '../../shared/i18n';

export function CommunitiesPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['communities', q], queryFn: () => api.communities(q), staleTime: 30_000 });
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 px-3 py-5 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/90 sm:px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-200/50 dark:shadow-purple-900/30">
              <Users size={18} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">{t('community.title')}</h1>
          </div>
          <Link to="/communities/new"><Button><Plus size={16} /> {t('common.create')}</Button></Link>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('community.search')} className="pl-10" />
        </div>
      </header>
      <div className="p-3 sm:p-4">
        {query.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : query.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {query.data.map((community) => <CommunityCard key={community.id} community={community} />)}
          </div>
        ) : <EmptyState title={t('community.not_found')} description={t('community.not_found_desc')} action={<Link to="/communities/new"><Button><Plus size={16} /> {t('common.create')}</Button></Link>} />}
      </div>
    </div>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
                {canManage ? <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings size={16} /> {t('community.manage')}</Button> : null}
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
      <CommunitySettings open={settingsOpen} onClose={() => setSettingsOpen(false)} slug={slug} community={community} />
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

function CommunitySettings({ open, onClose, slug, community }: { open: boolean; onClose: () => void; slug: string; community: Community }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState({ name: community.name, slug: community.slug, description: community.description, avatar_url: community.avatar_url || '', cover_url: community.cover_url || '', rules: community.rules });
  const mutation = useMutation({
    mutationFn: () => api.updateCommunity(slug, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
      toast.show({ title: t('community.settings_saved'), tone: 'success' });
      onClose();
    },
  });
  const uploadAvatar = useMutation({
    mutationFn: (file: File) => api.uploadCommunityAvatar(slug, file),
    onSuccess: (next) => {
      setDraft((value) => ({ ...value, avatar_url: next.avatar_url || '' }));
      queryClient.invalidateQueries({ queryKey: ['community'] });
      toast.show({ title: t('community.avatar_updated'), tone: 'success' });
    },
  });
  const uploadCover = useMutation({
    mutationFn: (file: File) => api.uploadCommunityCover(slug, file),
    onSuccess: (next) => {
      setDraft((value) => ({ ...value, cover_url: next.cover_url || '' }));
      queryClient.invalidateQueries({ queryKey: ['community'] });
      toast.show({ title: t('community.cover_updated'), tone: 'success' });
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={t('community.settings_title')}>
      <div className="space-y-5">
        {/* Media uploads */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="group cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-4 text-center transition-all hover:border-orange-300 hover:bg-orange-50/30 dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:border-orange-800">
            <Camera size={24} className="mx-auto mb-1 text-gray-400 transition-colors group-hover:text-orange-500" />
            <p className="text-sm font-bold text-gray-500">{uploadAvatar.isPending ? t('common.loading') : t('community.avatar')}</p>
            <p className="text-xs text-gray-400">{t('community.click_to_upload')}</p>
            <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadAvatar.mutate(event.target.files[0])} />
          </label>
          <label className="group cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-4 text-center transition-all hover:border-orange-300 hover:bg-orange-50/30 dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:border-orange-800">
            <Image size={24} className="mx-auto mb-1 text-gray-400 transition-colors group-hover:text-orange-500" />
            <p className="text-sm font-bold text-gray-500">{uploadCover.isPending ? t('common.loading') : t('community.cover')}</p>
            <p className="text-xs text-gray-400">{t('community.click_to_upload')}</p>
            <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadCover.mutate(event.target.files[0])} />
          </label>
        </div>
        {/* Fields */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.name_short')}</label>
          <Input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder={t('community.name_short')} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Slug</label>
          <Input value={draft.slug} onChange={(event) => setDraft((value) => ({ ...value, slug: event.target.value }))} placeholder="slug" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.description')}</label>
          <Textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder={t('community.desc_placeholder')} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t('community.rules')}</label>
          <Textarea value={draft.rules} onChange={(event) => setDraft((value) => ({ ...value, rules: event.target.value }))} placeholder={t('community.rules_placeholder')} />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function CommunityCard({ community }: { community: Community }) {
  const TypeIcon = community.type === 'private' ? Lock : community.type === 'closed' ? UserCheck : Globe;
  return (
    <Link to={`/communities/${community.slug}`} className="group overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50">
      <div className="h-20 bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-orange-500/20 dark:from-purple-900/30 dark:via-pink-900/20 dark:to-orange-900/30">
        {community.cover_url && <img src={community.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="-mt-6 px-4 pb-4">
        <Avatar src={community.avatar_url} name={community.name} className="h-12 w-12 rounded-xl border-2 border-white shadow-sm dark:border-zinc-900" />
        <div className="mt-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-black">{community.name}</p>
            <TypeIcon size={14} className="shrink-0 text-gray-400" />
          </div>
          <p className="line-clamp-2 text-sm text-gray-500 dark:text-zinc-400">{community.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs font-bold text-gray-400">
            <span className="flex items-center gap-1"><Users size={12} />{community.members_count}</span>
            <span className="flex items-center gap-1"><MessageSquare size={12} />{community.posts_count}</span>
          </div>
        </div>
      </div>
    </Link>
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
