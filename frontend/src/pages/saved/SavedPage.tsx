import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Code2,
  Copy,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  Laugh,
  List,
  Lock,
  Lightbulb,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { Button, ConfirmDialog, Dropdown, DropdownItem, ErrorState, IconButton, Input, Modal, Select, Skeleton, Textarea, useToast, PageLayout, PageHeader } from '../../shared/ui';
import { ProductEmptyState } from '../../shared/ui/ProductEmptyState';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../shared/i18n';
import type { LangCode } from '../../shared/i18n';
import type { Post, SaveCollection } from '../../shared/types';
import { authRedirectUrl } from '../../utils/authRedirect';

type SavedView = 'list' | 'grid';
type CollectionGlyph = 'meme' | 'idea' | 'design' | 'film' | 'code' | 'default';

const collectionAccentCount = 5;

export function SavedPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [collectionId, setCollectionId] = useState(params.get('collection') || '');
  const [sort, setSort] = useState('saved_desc');
  const [view, setView] = useState<SavedView>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [editingCollection, setEditingCollection] = useState('');
  const [collectionToDelete, setCollectionToDelete] = useState<SaveCollection | null>(null);
  const collectionsRailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCollectionId(params.get('collection') || '');
  }, [params]);

  const collectionsQuery = useQuery({ queryKey: ['save-collections'], queryFn: api.saveCollections, enabled: Boolean(user) });
  const postsQuery = useQuery({ queryKey: ['saved', q, collectionId, sort], queryFn: () => api.saved(q, collectionId || undefined, sort), enabled: Boolean(user) });
  const collections = collectionsQuery.data || [];
  const posts = postsQuery.data || [];
  const selectedCollection = useMemo(
    () => collections.find((item) => item.id === collectionId) || null,
    [collectionId, collections],
  );

  const updateCollectionFilter = (nextCollectionId: string) => {
    setCollectionId(nextCollectionId);
    const nextParams = new URLSearchParams(params);
    if (nextCollectionId) nextParams.set('collection', nextCollectionId);
    else nextParams.delete('collection');
    setParams(nextParams, { replace: true });
  };

  const openCreateModal = () => {
    create.reset();
    update.reset();
    setEditingCollection('');
    setName('');
    setDescription('');
    setVisibility('private');
    setModalOpen(true);
  };

  const openEditModal = (collection: SaveCollection) => {
    create.reset();
    update.reset();
    setEditingCollection(collection.id);
    setName(collection.name);
    setDescription(collection.description || '');
    setVisibility(collection.visibility);
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingCollection('');
    setName('');
    setDescription('');
    setVisibility('private');
  };

  const create = useMutation({
    mutationFn: () => api.createSaveCollection({ name: name.trim(), description: description.trim(), visibility }),
    onSuccess: (collection) => {
      resetModal();
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      updateCollectionFilter(collection.id);
      toast.show({ title: t('saved.collection_created'), tone: 'success' });
    },
  });

  const update = useMutation({
    mutationFn: () => api.updateSaveCollection(editingCollection, { name: name.trim(), description: description.trim(), visibility }),
    onSuccess: () => {
      resetModal();
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      toast.show({ title: t('saved.collection_updated'), tone: 'success' });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSaveCollection(id),
    onSuccess: (_, id) => {
      if (collectionId === id) updateCollectionFilter('');
      setCollectionToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast.show({ title: t('saved.collection_deleted'), tone: 'success' });
    },
  });

  const unsave = useMutation({
    mutationFn: (postId: string) => api.savePost(postId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      toast.show({ title: t('post.unsaved'), tone: 'success' });
    },
  });

  const copyPostLink = async (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ title: t('common.copied'), tone: 'success' });
    } catch {
      toast.show({ title: t('saved.copy_failed'), tone: 'error' });
    }
  };

  const submitCollection = () => {
    if (!name.trim()) return;
    if (editingCollection) update.mutate();
    else create.mutate();
  };

  const scrollCollections = () => {
    const rail = collectionsRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: Math.min(rail.clientWidth * 0.85, 520), behavior: 'smooth' });
  };

  if (!user) {
    return (
      <div className="p-3 sm:p-5 lg:p-6">
        <ProductEmptyState
          className="sm:min-h-[34rem]"
          title={t('common.required')}
          description={t('saved.login_desc')}
          tone="flame"
          icon={<BookmarkCheck size={36} />}
          action={
            <Link to={authRedirectUrl('/saved')} className="saved-login-action">
              {t('nav.login')}
            </Link>
          }
        />
      </div>
    );
  }

  const isSearching = q.trim().length > 0;
  const emptyTitle = isSearching
    ? t('saved.search_empty_title')
    : selectedCollection
      ? t('saved.collection_empty_title', { name: selectedCollection.name })
      : t('saved.empty_title');
  const emptyDescription = isSearching
    ? t('saved.search_empty_desc')
    : selectedCollection
      ? t('saved.collection_empty_desc')
      : t('saved.empty_desc');

  return (
    <PageLayout variant="default" className="saved-page">
      <header className="page-header sticky top-16 z-20 pb-4 pt-5 sm:top-0 sm:pb-5 sm:pt-7">
        <PageHeader
          icon={Bookmark}
          title={t('saved.title')}
          tone="orange"
          actions={
            <Button className="saved-primary-action" onClick={openCreateModal}>
              <Plus size={17} /> {t('saved.collection')}
            </Button>
          }
        />

        <div className="saved-filter-bar mt-5">
          <div className="saved-filter-field saved-filter-search">
            <Search size={19} aria-hidden="true" />
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('saved.search')} className="saved-filter-input" />
          </div>
          <div className="saved-filter-field saved-filter-select">
            <BookmarkCheck size={17} aria-hidden="true" />
            <Select value={collectionId} onChange={(event) => updateCollectionFilter(event.target.value)} className="saved-filter-input saved-filter-native-select">
              <option value="">{t('saved.all')}</option>
              {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </Select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <div className="saved-filter-field saved-filter-select">
            <CalendarDays size={17} aria-hidden="true" />
            <Select value={sort} onChange={(event) => setSort(event.target.value)} className="saved-filter-input saved-filter-native-select">
              <option value="saved_desc">{t('saved.sort_recent')}</option>
              <option value="saved_asc">{t('saved.sort_old')}</option>
              <option value="post_newest">{t('saved.sort_new')}</option>
              <option value="popular">{t('saved.sort_popular')}</option>
            </Select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <section className="saved-section" aria-labelledby="saved-collections-title">
          <div className="saved-section-header">
            <h2 id="saved-collections-title">{t('saved.collections_title')}</h2>
          </div>
          <div className="saved-collections-wrap">
            <div ref={collectionsRailRef} className="saved-collections-rail">
              <Button
                onClick={openCreateModal}
                variant="ghost"
                className="saved-create-card h-auto block p-0"
              >
                <Plus size={30} aria-hidden="true" />
                <span>{t('saved.create_collection')}</span>
              </Button>
              {collectionsQuery.isLoading ? (
                <>
                  <Skeleton className="h-[8.55rem] w-[10.45rem] shrink-0 rounded-xl" />
                  <Skeleton className="h-[8.55rem] w-[10.45rem] shrink-0 rounded-xl" />
                  <Skeleton className="h-[8.55rem] w-[10.45rem] shrink-0 rounded-xl" />
                </>
              ) : collectionsQuery.isError ? (
                <div className="saved-collection-error">
                  <span>{t('saved.collections_load_error')}</span>
                  <Button variant="outline" className="h-9 rounded-xl px-3" onClick={() => collectionsQuery.refetch()}>{t('common.retry')}</Button>
                </div>
              ) : collections.length ? (
                collections.map((collection, index) => (
                  <SavedCollectionCard
                    key={collection.id}
                    collection={collection}
                    accent={(index % collectionAccentCount) + 1}
                    active={collection.id === collectionId}
                    countLabel={formatPostCount(collection.posts_count, lang)}
                    onSelect={() => updateCollectionFilter(collection.id)}
                    onEdit={() => openEditModal(collection)}
                    onDelete={() => setCollectionToDelete(collection)}
                    t={t}
                  />
                ))
              ) : (
                <div className="saved-collection-hint">
                  <BookmarkCheck size={18} />
                  <span>{t('saved.collections_empty_hint')}</span>
                </div>
              )}
            </div>
            {collections.length > 3 ? (
              <Button
                onClick={scrollCollections}
                variant="ghost"
                className="saved-rail-next h-auto p-0"
                aria-label={t('saved.scroll_collections')}
              >
                <ChevronRight size={19} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </section>

        <section className="saved-section saved-posts-section" aria-labelledby="saved-posts-title">
          <div className="saved-section-header">
            <h2 id="saved-posts-title">{t('saved.recent_title')}</h2>
            <div className="saved-view-toggle" role="group" aria-label={t('saved.view_toggle')}>
              <Button
                variant="ghost"
                className="h-auto p-2"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <List size={18} />
                <span className="sr-only">{t('saved.list_view')}</span>
              </Button>
              <Button
                variant="ghost"
                className="h-auto p-2"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <Grid2X2 size={17} />
                <span className="sr-only">{t('saved.grid_view')}</span>
              </Button>
            </div>
          </div>

          {postsQuery.isLoading ? (
            <SavedPostsSkeleton view={view} />
          ) : postsQuery.isError ? (
            <ErrorState description={t('saved.load_error')} onRetry={() => postsQuery.refetch()} />
          ) : posts.length ? (
            view === 'list' ? (
              <div className="saved-post-list">
                {posts.map((post) => (
                  <SavedPostRow
                    key={post.id}
                    post={post}
                    lang={lang}
                    collectionLabel={getPostCollectionLabel(post, selectedCollection, t)}
                    onOpen={() => navigate(`/post/${post.id}`)}
                    onCopy={() => copyPostLink(post.id)}
                    onUnsave={() => unsave.mutate(post.id)}
                    actionPending={unsave.isPending}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="saved-post-grid">
                {posts.map((post) => (
                  <SavedPostGridCard
                    key={post.id}
                    post={post}
                    lang={lang}
                    collectionLabel={getPostCollectionLabel(post, selectedCollection, t)}
                    onOpen={() => navigate(`/post/${post.id}`)}
                    onCopy={() => copyPostLink(post.id)}
                    onUnsave={() => unsave.mutate(post.id)}
                    actionPending={unsave.isPending}
                    t={t}
                  />
                ))}
              </div>
            )
          ) : (
            <ProductEmptyState
              className="saved-empty-state sm:min-h-[28rem]"
              title={emptyTitle}
              description={emptyDescription}
              tone={isSearching ? 'search' : 'flame'}
              icon={<BookmarkCheck size={36} />}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {isSearching ? <Button variant="outline" className="h-11 rounded-xl" onClick={() => setQ('')}>{t('saved.clear_search')}</Button> : null}
                  <Button className="h-11 rounded-xl" onClick={openCreateModal}><Plus size={16} /> {t('saved.collection')}</Button>
                </div>
              }
            />
          )}
        </section>
      </div>

      <Modal open={modalOpen} onClose={resetModal} title={editingCollection ? t('saved.edit_collection') : t('saved.new_collection')}>
        <div className="space-y-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('saved.name')} />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('saved.description')} />
          <Select value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'public')}>
            <option value="private">{t('saved.private')}</option>
            <option value="public">{t('saved.public')}</option>
          </Select>
          {create.isError || update.isError ? <p className="saved-modal-error">{t('saved.collection_save_error')}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetModal}>{t('saved.cancel')}</Button>
            <Button onClick={submitCollection} loading={create.isPending || update.isPending} disabled={!name.trim()}>
              {editingCollection ? t('saved.save') : t('saved.create')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(collectionToDelete)}
        onClose={() => setCollectionToDelete(null)}
        title={t('saved.delete_collection_title')}
        description={collectionToDelete ? t('saved.delete_collection_desc', { name: collectionToDelete.name }) : undefined}
        confirmText={t('saved.delete')}
        onConfirm={() => collectionToDelete && remove.mutate(collectionToDelete.id)}
        loading={remove.isPending}
      />
    </PageLayout>
  );
}

function SavedCollectionCard({
  collection,
  active,
  accent,
  countLabel,
  onSelect,
  onEdit,
  onDelete,
  t,
}: {
  collection: SaveCollection;
  active: boolean;
  accent: number;
  countLabel: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const canEdit = collection.editable !== false;
  const glyph = getCollectionGlyph(collection.name);
  return (
    <article className="saved-collection-card" data-active={active || undefined} data-accent={accent}>
      <Button
        onClick={onSelect}
        variant="ghost"
        className="saved-collection-main h-auto p-0 block w-full justify-start text-left"
        aria-pressed={active}
      >
        <span className="saved-collection-cover" data-glyph={glyph}>
          <span className="saved-collection-glyph">
            <CollectionGlyphIcon glyph={glyph} />
          </span>
        </span>
        <span className="saved-collection-copy">
          <span className="saved-collection-name">{collection.name}</span>
          <span className="saved-collection-count">{countLabel}</span>
        </span>
      </Button>
      {canEdit ? (
        <Dropdown
          trigger={
            <IconButton label={t('saved.collection_menu')} className="saved-collection-actions">
              <MoreHorizontal size={17} />
            </IconButton>
          }
        >
          <DropdownItem onClick={onEdit}>
            <Pencil size={15} /> {t('saved.edit')}
          </DropdownItem>
          <DropdownItem danger onClick={onDelete}>
            <Trash2 size={15} /> {t('saved.delete')}
          </DropdownItem>
        </Dropdown>
      ) : (
        <span className="saved-collection-lock" title={t('saved.private')}>
          <Lock size={14} />
        </span>
      )}
    </article>
  );
}

function CollectionGlyphIcon({ glyph }: { glyph: CollectionGlyph }) {
  switch (glyph) {
    case 'meme':
      return <Laugh size={28} strokeWidth={2.25} />;
    case 'idea':
      return <Lightbulb size={28} strokeWidth={2.2} />;
    case 'design':
      return <Palette size={28} strokeWidth={2.2} />;
    case 'film':
      return <Clapperboard size={28} strokeWidth={2.2} />;
    case 'code':
      return <Code2 size={28} strokeWidth={2.2} />;
    default:
      return <FolderOpen size={27} strokeWidth={2.2} />;
  }
}

function SavedPostRow({
  post,
  lang,
  collectionLabel,
  onOpen,
  onCopy,
  onUnsave,
  actionPending,
  t,
}: SavedPostItemProps) {
  const title = getPostTitle(post, t);
  return (
    <article className="saved-post-row">
      <Link to={`/post/${post.id}`} className="saved-post-thumb" aria-label={title}>
        <PostMediaPreview post={post} />
      </Link>
      <div className="saved-post-row-copy">
        <Link to={`/post/${post.id}`} className="saved-post-title">{title}</Link>
        <div className="saved-post-meta">
          {post.community ? (
            <Link to={`/communities/${post.community.slug}`}>/{post.community.name}</Link>
          ) : (
            <Link to={`/user/${post.author?.username}`}>@{post.author?.username || t('common.unknown')}</Link>
          )}
        </div>
      </div>
      <span className="saved-post-chip">{collectionLabel}</span>
      <time className="saved-post-date" dateTime={post.created_at}>{formatCompactDate(post.created_at, lang)}</time>
      <SavedPostActions onOpen={onOpen} onCopy={onCopy} onUnsave={onUnsave} pending={actionPending} t={t} />
    </article>
  );
}

function SavedPostGridCard(props: SavedPostItemProps) {
  const { post, lang, collectionLabel, onOpen, onCopy, onUnsave, actionPending, t } = props;
  const title = getPostTitle(post, t);
  return (
    <article className="saved-post-grid-card">
      <Link to={`/post/${post.id}`} className="saved-post-grid-media" aria-label={title}>
        <PostMediaPreview post={post} />
      </Link>
      <div className="saved-post-grid-body">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <Link to={`/post/${post.id}`} className="saved-post-title">{title}</Link>
          <SavedPostActions onOpen={onOpen} onCopy={onCopy} onUnsave={onUnsave} pending={actionPending} t={t} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="saved-post-chip">{collectionLabel}</span>
          <time className="saved-post-date" dateTime={post.created_at}>{formatCompactDate(post.created_at, lang)}</time>
        </div>
      </div>
    </article>
  );
}

type SavedPostItemProps = {
  post: Post;
  lang: LangCode;
  collectionLabel: string;
  onOpen: () => void;
  onCopy: () => void;
  onUnsave: () => void;
  actionPending: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function SavedPostActions({
  onOpen,
  onCopy,
  onUnsave,
  pending,
  t,
}: {
  onOpen: () => void;
  onCopy: () => void;
  onUnsave: () => void;
  pending: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <Dropdown
      trigger={
        <IconButton label={t('post.menu_actions')} className="saved-post-menu">
          <MoreHorizontal size={18} />
        </IconButton>
      }
    >
      <DropdownItem onClick={onOpen}>
        <BookmarkCheck size={15} /> {t('post_composer.open_post')}
      </DropdownItem>
      <DropdownItem onClick={onCopy}>
        <Copy size={15} /> {t('post.menu_copy')}
      </DropdownItem>
      <DropdownItem danger disabled={pending} onClick={onUnsave}>
        <Trash2 size={15} /> {t('post.menu_unsave')}
      </DropdownItem>
    </Dropdown>
  );
}

function PostMediaPreview({ post }: { post: Post }) {
  const item = post.media_items?.[0];
  const mediaUrl = item?.url || post.media_url;
  const mediaType = item?.type || post.media_type;
  if (!mediaUrl) {
    return (
      <span className="saved-post-thumb-fallback">
        <ImageIcon size={22} />
      </span>
    );
  }
  if (mediaType?.startsWith('video')) {
    return <video src={mediaUrl} muted playsInline preload="metadata" aria-label={post.media_alt || undefined} />;
  }
  return <img src={mediaUrl} alt={post.media_alt || ''} loading="lazy" decoding="async" />;
}

function SavedPostsSkeleton({ view }: { view: SavedView }) {
  if (view === 'grid') {
    return (
      <div className="saved-post-grid">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  return (
    <div className="saved-post-list">
      <Skeleton className="h-[6.7rem] rounded-xl" />
      <Skeleton className="h-[6.7rem] rounded-xl" />
      <Skeleton className="h-[6.7rem] rounded-xl" />
      <Skeleton className="h-[6.7rem] rounded-xl" />
    </div>
  );
}

function getPostTitle(post: Post, t: (key: string) => string) {
  const text = post.text
    .split('\n')
    .map((part) => part.trim())
    .find(Boolean);
  return text || t('layout.media_post');
}

function getPostCollectionLabel(
  post: Post,
  selectedCollection: SaveCollection | null,
  t: (key: string) => string,
) {
  if (selectedCollection) return selectedCollection.name;
  if (post.community?.name) return post.community.name;
  return t('saved.general_post');
}

function formatCompactDate(value: string, lang: LangCode) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = lang === 'en' ? 'en-US' : lang === 'uz' ? 'uz-UZ' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date).replace('.', '');
}

function formatPostCount(count: number, lang: LangCode) {
  if (lang === 'en') return `${count} ${count === 1 ? 'post' : 'posts'}`;
  if (lang === 'uz') return `${count} post`;
  const last = count % 10;
  const lastTwo = count % 100;
  const word = last === 1 && lastTwo !== 11 ? 'пост' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'поста' : 'постов';
  return `${count} ${word}`;
}

function getCollectionGlyph(value: string): CollectionGlyph {
  const name = value.toLocaleLowerCase();
  if (/(мем|meme|humor|юмор)/i.test(name)) return 'meme';
  if (/(иде|idea|startup|стартап|habit)/i.test(name)) return 'idea';
  if (/(design|дизайн|ui|ux|арт|art)/i.test(name)) return 'design';
  if (/(film|movie|кино|фильм)/i.test(name)) return 'film';
  if (/(code|dev|код|программ)/i.test(name)) return 'code';
  return 'default';
}
