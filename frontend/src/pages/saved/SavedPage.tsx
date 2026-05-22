import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { Button, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Textarea, useToast } from '../../shared/ui';
import { PostCard } from '../../features/posts/components/PostCard';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../shared/i18n';

export function SavedPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [collectionId, setCollectionId] = useState(params.get('collection') || '');
  const [sort, setSort] = useState('saved_desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [editingCollection, setEditingCollection] = useState('');
  const collectionsQuery = useQuery({ queryKey: ['save-collections'], queryFn: api.saveCollections, enabled: Boolean(user) });
  const postsQuery = useQuery({ queryKey: ['saved', q, collectionId, sort], queryFn: () => api.saved(q, collectionId || undefined, sort), enabled: Boolean(user) });
  const create = useMutation({
    mutationFn: () => api.createSaveCollection({ name, description, visibility }),
    onSuccess: () => {
      setModalOpen(false);
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      toast.show({ title: t('saved.collection_created'), tone: 'success' });
    },
  });
  const update = useMutation({
    mutationFn: () => api.updateSaveCollection(editingCollection, { name, description, visibility }),
    onSuccess: () => {
      setModalOpen(false);
      setEditingCollection('');
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      toast.show({ title: t('saved.collection_updated'), tone: 'success' });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSaveCollection(id),
    onSuccess: () => {
      setCollectionId('');
      queryClient.invalidateQueries({ queryKey: ['save-collections'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast.show({ title: t('saved.collection_deleted'), tone: 'success' });
    },
  });

  if (!user) return <div className="p-3 sm:p-4"><EmptyState title={t('common.required')} description={t('saved.login_desc')} /></div>;

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#F3F4F6]/90 px-3 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-black"><Bookmark className="text-[#FF6B00]" /> {t('saved.title')}</h1>
          <div className="flex gap-2">
            {collectionId ? <Button variant="outline" onClick={() => {
              const current = collectionsQuery.data?.find((item) => item.id === collectionId);
              if (!current) return;
              setEditingCollection(current.id);
              setName(current.name);
              setDescription(current.description || '');
              setVisibility(current.visibility);
              setModalOpen(true);
            }}>{t('saved.edit')}</Button> : null}
            {collectionId ? <Button variant="outline" onClick={() => remove.mutate(collectionId)} loading={remove.isPending}>{t('saved.delete')}</Button> : null}
            <Button onClick={() => { setEditingCollection(''); setName(''); setDescription(''); setVisibility('private'); setModalOpen(true); }}><Plus size={16} /> {t('saved.collection')}</Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_220px_220px]">
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('saved.search')} />
          <Select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="">{t('saved.all')}</option>
            {(collectionsQuery.data || []).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="saved_desc">{t('saved.sort_recent')}</option>
            <option value="saved_asc">{t('saved.sort_old')}</option>
            <option value="post_newest">{t('saved.sort_new')}</option>
            <option value="popular">{t('saved.sort_popular')}</option>
          </Select>
        </div>
      </header>
      <div className="space-y-5 p-3 sm:p-4">
        {postsQuery.isLoading ? <Skeleton className="h-72" /> : postsQuery.isError ? <ErrorState description={t('saved.load_error')} onRetry={() => postsQuery.refetch()} /> : postsQuery.data?.length ? postsQuery.data.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState title={t('saved.empty_title')} description={t('saved.empty_desc')} icon={<BookmarkCheck size={32} />} />}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('saved.new_collection')}>
        <div className="space-y-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('saved.name')} />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('saved.description')} />
          <Select value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'public')}>
            <option value="private">{t('saved.private')}</option>
            <option value="public">{t('saved.public')}</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('saved.cancel')}</Button>
            <Button onClick={() => editingCollection ? update.mutate() : create.mutate()} loading={create.isPending || update.isPending} disabled={!name.trim()}>{editingCollection ? t('saved.save') : t('saved.create')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
