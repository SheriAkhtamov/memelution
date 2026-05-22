import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { Globe, Hash, Image as ImageIcon, Lock, Paperclip, Plus, Send, Smile, Users, Vote, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../shared/api/client';
import type { Community, CreatePostParams, Post } from '../../../shared/types';
import { Avatar, Button, ConfirmDialog, Modal, Select, Switch, useToast } from '../../../shared/ui';
import { useAuthStore } from '../../../store/authStore';
import { redirectToLogin } from '../../../utils/authRedirect';
import { MemeEditor } from '../../meme-editor/MemeEditor';
import { useTranslation } from '../../../shared/i18n';
import { trackEvent } from '../../../shared/lib/analytics';

const DRAFT_KEY = 'memelution-post-draft-v2';
const MAX_TEXT = 500;
const MAX_FILE_MB = 50;
const MAX_TAGS = 8;

type ComposerMode = 'inline' | 'modal';

function normalizedTags(text: string, tagsInput: string) {
  const tags = Array.from(
    new Set(
      tagsInput
        .split(/[\s,]+/)
        .map((item) => item.replace(/^#/, '').trim().toLowerCase())
        .filter((item) => /^[\wа-яё_]{2,80}$/iu.test(item)),
    ),
  ).slice(0, MAX_TAGS);
  const existingTags = new Set(Array.from(text.matchAll(/#([\wа-яё_]{2,80})/giu), (match) => match[1].toLowerCase()));
  return tags.filter((tag) => !existingTags.has(tag));
}

function buildPostText(text: string, tagsInput: string) {
  const tagLine = normalizedTags(text, tagsInput).map((tag) => `#${tag}`).join(' ');
  return [text.trim(), tagLine].filter(Boolean).join('\n\n');
}

export function PollBuilder({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const { t } = useTranslation();
  const update = (index: number, value: string) => onChange(options.map((item, itemIndex) => (itemIndex === index ? value : item)));
  const add = () => {
    if (options.length < 6) onChange([...options, '']);
  };
  const remove = (index: number) => {
    if (options.length > 2) onChange(options.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-black text-[#7C3AED]">
          <Vote size={16} /> {t('post_composer.poll_options')}
        </p>
        <button
          type="button"
          onClick={add}
          disabled={options.length >= 6}
          className="flex h-7 items-center gap-1 rounded-full bg-[#7C3AED]/10 px-3 text-xs font-black text-[#7C3AED] transition-colors hover:bg-[#7C3AED]/20 disabled:opacity-40"
        >
          <Plus size={12} /> {t('post_composer.poll_option')}
        </button>
      </div>
      {options.map((option, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={option}
            onChange={(event) => update(index, event.target.value)}
            placeholder={t('post_composer.poll_option') + ' ' + (index + 1)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-purple-100 bg-white px-3 text-sm font-bold outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-purple-100 dark:border-purple-900/50 dark:bg-zinc-950 dark:focus:ring-purple-950"
          />
          <button
            type="button"
            aria-label={t('post_composer.poll_remove')}
            onClick={() => remove(index)}
            className="h-9 w-9 rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
            disabled={options.length <= 2}
          >
            <X size={14} className="mx-auto" />
          </button>
        </div>
      ))}
      <p className="text-xs font-bold text-purple-500/70 dark:text-purple-300/50">{t('post_composer.poll_min_hint')}</p>
    </div>
  );
}

export function PostComposer({
  open,
  onClose,
  mode = 'inline',
  communityId,
  onCreated,
  defaultExpanded = false,
  autoFocus = false,
}: {
  open?: boolean;
  onClose?: () => void;
  mode?: ComposerMode;
  communityId?: string;
  onCreated?: (post: Post) => void;
  defaultExpanded?: boolean;
  autoFocus?: boolean;
}) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [type, setType] = useState<CreatePostParams['type']>('text');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState(communityId || '');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollResults, setPollResults] = useState<'always' | 'after_vote'>('after_vote');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [showPoll, setShowPoll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(mode === 'modal' || defaultExpanded);
  const [memeEditorOpen, setMemeEditorOpen] = useState(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [publishedPost, setPublishedPost] = useState<Post | null>(null);

  const communitiesQuery = useQuery({
    queryKey: ['communities', 'composer'],
    queryFn: () => api.communities(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  // Fetch trending hashtags for autocomplete
  const trendsQuery = useQuery({
    queryKey: ['trends', 'day'],
    queryFn: () => api.trends('day'),
    staleTime: 60_000,
  });
  const trendingHashtags: string[] = (trendsQuery.data as { hashtags?: { name: string }[] })?.hashtags?.map((h: { name: string }) => h.name) || [];

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 56)}px`;
  }, [text]);

  useEffect(() => {
    if (mode === 'modal' && open) setExpanded(true);
  }, [mode, open]);

  useEffect(() => {
    if (!defaultExpanded) return;
    setExpanded(true);
    if (autoFocus) window.setTimeout(() => textareaRef.current?.focus(), 80);
  }, [autoFocus, defaultExpanded]);

  // Draft persistence
  useEffect(() => {
    if (!user || communityId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { text?: string; tagsInput?: string; pollOptions?: string[]; selectedCommunity?: string; showPoll?: boolean };
      setText(draft.text || '');
      setTagsInput(draft.tagsInput || '');
      setPollOptions(draft.pollOptions?.length ? draft.pollOptions : ['', '']);
      setSelectedCommunity(draft.selectedCommunity || '');
      if (draft.showPoll) setShowPoll(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [communityId, user]);

  useEffect(() => {
    if (!user || communityId) return;
    const payload = JSON.stringify({ text, tagsInput, pollOptions, selectedCommunity, showPoll });
    const timer = window.setTimeout(() => localStorage.setItem(DRAFT_KEY, payload), 500);
    return () => window.clearTimeout(timer);
  }, [communityId, pollOptions, selectedCommunity, showPoll, tagsInput, text, user]);

  const previewUrls = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const selectedCommunityName = useMemo(() => {
    if (communityId) return '';
    return (communitiesQuery.data || []).find((community: Community) => community.id === selectedCommunity)?.name || '';
  }, [communitiesQuery.data, communityId, selectedCommunity]);
  const previewText = useMemo(() => buildPostText(text, tagsInput), [tagsInput, text]);
  useEffect(() => () => {
    previewUrls.forEach((item) => URL.revokeObjectURL(item.url));
  }, [previewUrls]);

  const mutation = useMutation({
    mutationFn: (payload: CreatePostParams) => api.createPost(payload),
    onSuccess: (post) => {
      setPublishedPost(post);
      setText('');
      setTagsInput('');
      setType('text');
      setFiles([]);
      setPollOptions(['', '']);
      setShowPoll(false);
      setShowSettings(false);
      setExpanded(mode === 'modal');
      setError('');
      localStorage.removeItem(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['community', selectedCommunity] });
      trackEvent('meme_created', {
        post_id: post.id,
        community_id: post.community_id || selectedCommunity || communityId || null,
        has_media: Boolean(post.media_url || post.media_items?.length),
        has_poll: post.type === 'poll',
      });
      onCreated?.(post);
      toast.show({ title: t('post_composer.published'), tone: 'success' });
    },
    onError: (event) => {
      setError(event instanceof ApiError ? event.message : t('post_composer.publish_error'));
      toast.show({ title: event instanceof Error ? event.message : t('post_composer.publish_error'), tone: 'error' });
    },
  });

  const setValidatedFiles = (nextFiles: File[]) => {
    setFileError('');
    if (!nextFiles.length) {
      setFiles([]);
      return;
    }
    const accepted = nextFiles.filter((next) => next.type.startsWith('image/') || next.type === 'video/mp4');
    if (accepted.length !== nextFiles.length) {
      setExpanded(true);
      setFileError(t('post_composer.media_hint'));
      return;
    }
    if (accepted.some((next) => next.size > MAX_FILE_MB * 1024 * 1024)) {
      setExpanded(true);
      setFileError(t('post_composer.file_too_big', { max: MAX_FILE_MB }));
      return;
    }
    const merged = [...files, ...accepted].slice(0, 6);
    setType(merged.some((item) => item.type.startsWith('video/')) ? 'video' : 'meme');
    setFiles(merged);
    setExpanded(true);
  };

  const replaceFile = (index: number, next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith('image/') && next.type !== 'video/mp4') {
      setFileError(t('post_composer.media_hint'));
      return;
    }
    if (next.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(t('post_composer.file_too_big', { max: MAX_FILE_MB }));
      return;
    }
    const copy = [...files];
    copy[index] = next;
    setType(copy.some((item) => item.type.startsWith('video/')) ? 'video' : 'meme');
    setFiles(copy);
  };

  const submit = () => {
    if (!user) {
      redirectToLogin();
      return;
    }
    const finalType = showPoll ? 'poll' : type;
    const cleanOptions = pollOptions.map((item) => item.trim()).filter(Boolean);
    const finalText = buildPostText(text, tagsInput);
    if (!finalText && !files.length && !showPoll) {
      setError(t('post_composer.need_text'));
      return;
    }
    if (showPoll && cleanOptions.length < 2) {
      setError(t('post_composer.poll_min'));
      return;
    }
    if (finalText.length > MAX_TEXT) {
      setError(t('post_composer.char_limit', { max: MAX_TEXT }));
      return;
    }
    mutation.mutate({
      text: finalText,
      type: finalType,
      files,
      community_id: communityId || selectedCommunity || undefined,
      poll_options: showPoll ? cleanOptions.slice(0, 6).map((option) => ({ text: option })) : undefined,
      poll_settings: showPoll ? { results: pollResults } : undefined,
      comments_enabled: commentsEnabled,
      visibility,
    });
  };

  const visibilityIcon = visibility === 'public' ? Globe : visibility === 'followers' ? Users : Lock;
  const VisIcon = visibilityIcon;
  const charPercent = Math.min((text.length / MAX_TEXT) * 100, 100);
  const charOverflow = text.length > MAX_TEXT;
  const cleanPollOptionCount = pollOptions.map((item) => item.trim()).filter(Boolean).length;
  const hasDraft = Boolean(text.trim() || tagsInput.trim() || files.length || showPoll || showSettings);
  const collapsed = mode === 'inline' && !expanded && !hasDraft;
  const canSubmit = Boolean((text.trim() || files.length || (showPoll && cleanPollOptionCount >= 2)) && !charOverflow);
  const hasPreview = Boolean(previewText || previewUrls.length || showPoll);

  // Browser navigation guard
  useEffect(() => {
    if (!hasDraft) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDraft]);

  // SPA navigation guard
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        return hasDraft && currentLocation.pathname !== nextLocation.pathname;
      },
      [hasDraft]
    )
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm('У вас есть несохранённый черновик. Уйти?');
      if (leave) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);

  const content = (
    <div
      className="space-y-0"
      onPaste={(event) => {
        const pasted = Array.from(event.clipboardData.files).filter((item) => item.type.startsWith('image/'));
        if (pasted.length) setValidatedFiles(pasted);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setValidatedFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      {/* Avatar + Textarea area */}
      <div className="flex gap-3">
        {user ? (
          <Avatar src={user.avatar_url} name={user.display_name} className="mt-1 h-10 w-10 shrink-0" />
        ) : null}
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onFocus={() => setExpanded(true)}
            onChange={(event) => { setText(event.target.value); setExpanded(true); setError(''); setPublishedPost(null); }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                if (canSubmit && !mutation.isPending) submit();
              }
            }}
            placeholder={user ? t('post_composer.placeholder') : t('post_composer.login_required')}
            disabled={!user || mutation.isPending}
            rows={1}
            className="w-full resize-none border-0 bg-transparent py-3 text-base font-medium text-gray-900 outline-none placeholder:text-gray-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            style={{ minHeight: '56px' }}
          />
        </div>
      </div>

      {/* Error message */}
      {error ? (
        <p className="px-1 text-xs font-bold text-red-500">{error}</p>
      ) : null}

      {collapsed ? null : (
        <>

      {/* Media previews */}
      {previewUrls.length ? (
        <div className={`grid gap-2 pb-3 ${previewUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {previewUrls.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
              {item.file.type.startsWith('video/') ? (
                <video src={item.url} controls className="max-h-72 w-full bg-black" />
              ) : (
                <img src={item.url} alt="" className="max-h-72 w-full object-cover" />
              )}
              {/* Overlay controls */}
              <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80">
                  <Paperclip size={14} />
                  <input type="file" accept="image/*,video/mp4" className="hidden" onChange={(event) => replaceFile(index, event.target.files?.[0] || null)} />
                </label>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {fileError ? (
        <p className="px-1 pb-2 text-xs font-bold text-red-500">{fileError}</p>
      ) : null}

      {/* Tags input */}
      {expanded || tagsInput ? (
      <div className="pb-3">
        <label className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-500 transition-colors focus-within:border-[#FF6B00] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
          <Hash size={16} className="shrink-0 text-[#FF6B00]" />
          <input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder={t('post_composer.tags_hint')}
            disabled={!user || mutation.isPending}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500"
          />
        </label>
        {/* Hashtag autocomplete suggestions */}
        {(() => {
          const lastWord = tagsInput.split(/\s+/).filter(Boolean).pop() || '';
          if (lastWord.length < 1) return null;
          const matches = trendingHashtags.filter(
            (h) => h.toLowerCase().includes(lastWord.toLowerCase()) && !tagsInput.split(/\s+/).some((t) => t.toLowerCase() === h.toLowerCase()),
          ).slice(0, 5);
          if (!matches.length) return null;
          return (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {matches.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const words = tagsInput.split(/\s+/).filter(Boolean);
                    words[words.length - 1] = tag;
                    setTagsInput(words.join(' ') + ' ');
                  }}
                  className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-black text-[#FF6B00] transition-colors hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50"
                >
                  #{tag}
                </button>
              ))}
            </div>
          );
        })()}
      </div>
      ) : null}

      {/* Poll builder */}
      {showPoll ? (
        <div className="pb-3 space-y-3">
          <PollBuilder options={pollOptions} onChange={setPollOptions} />
          <Select value={pollResults} onChange={(event) => setPollResults(event.target.value as 'always' | 'after_vote')}>
            <option value="after_vote">{t('post_composer.poll_results_after')}</option>
            <option value="always">{t('post_composer.poll_results_now')}</option>
          </Select>
        </div>
      ) : null}

      {/* Settings row (collapsible) */}
      {expanded || showSettings ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 py-3 dark:border-zinc-800">
          {!communityId ? (
            <Select value={selectedCommunity} onChange={(event) => setSelectedCommunity(event.target.value)} className="w-auto min-w-40 !h-9 !text-xs">
              <option value="">{t('post_composer.no_community')}</option>
              {(communitiesQuery.data || []).map((community: Community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Switch checked={commentsEnabled} onChange={setCommentsEnabled} label={t('post_composer.comments')} />
        </div>
      ) : null}

      {hasPreview ? (
        <ComposerPreview
          authorName={user?.display_name}
          text={previewText}
          previewUrls={previewUrls}
          pollOptions={showPoll ? pollOptions.map((item) => item.trim()).filter(Boolean) : []}
          communityName={selectedCommunityName}
        />
      ) : null}

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center gap-1">
          {/* Attachment clip */}
          <label
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-950/30"
            title={t('post_composer.add_media')}
          >
            <Paperclip size={20} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) {
                  setValidatedFiles(Array.from(event.target.files));
                }
                event.target.value = '';
              }}
            />
          </label>

          {/* Poll toggle */}
          <button
            type="button"
            onClick={() => { setExpanded(true); setShowPoll((v) => !v); if (showPoll) { setType('text'); setPollOptions(['', '']); } else { setType('poll'); } }}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${showPoll ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-gray-400 hover:bg-purple-50 hover:text-[#7C3AED] dark:hover:bg-purple-950/30'}`}
            title={t('post_composer.add_poll')}
          >
            <Vote size={20} />
          </button>

          {/* Meme editor */}
          <button
            type="button"
            onClick={() => { setExpanded(true); setMemeEditorOpen(true); }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-950/30"
            title={t('post_composer.meme_editor')}
          >
            <ImageIcon size={20} />
          </button>

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={() => setVisibility((v) => v === 'public' ? 'followers' : v === 'followers' ? 'private' : 'public')}
            className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors ${
              visibility === 'public'
                ? 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50'
                : visibility === 'followers'
                ? 'bg-purple-50 text-[#7C3AED] hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:hover:bg-purple-950/50'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
            title={visibility === 'public' ? t('post_composer.visibility_public') : visibility === 'followers' ? t('post_composer.visibility_followers') : t('post_composer.visibility_private')}
          >
            <VisIcon size={16} />
            <span>{visibility === 'public' ? t('post_composer.visibility_public') : visibility === 'followers' ? t('post_composer.visibility_followers_label') : t('post_composer.visibility_private_label')}</span>
          </button>

          {/* Settings toggle */}
          <button
            type="button"
            onClick={() => { setExpanded(true); setShowSettings((v) => !v); }}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs transition-colors ${showSettings ? 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
            title={t('post_composer.settings')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/></svg>
          </button>

          {/* Character counter */}
          {text.length > 0 ? (
            <div className="relative ml-2 flex h-7 w-7 items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-100 dark:text-zinc-800" />
                <circle
                  cx="12" cy="12" r="10" fill="none" strokeWidth="2"
                  strokeDasharray={`${charPercent * 0.628} 62.8`}
                  className={`transition-all ${charOverflow ? 'text-red-500' : text.length > MAX_TEXT * 0.8 ? 'text-amber-500' : 'text-[#FF6B00]'}`}
                  stroke="currentColor"
                  strokeLinecap="round"
                />
              </svg>
              {text.length > MAX_TEXT * 0.8 ? (
                <span className={`absolute text-[9px] font-black ${charOverflow ? 'text-red-500' : 'text-amber-500'}`}>{MAX_TEXT - text.length}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <Button
          onClick={submit}
          loading={mutation.isPending}
          disabled={!canSubmit}
          className="h-9 rounded-full px-5"
        >
          <Send size={15} />
          <span className="hidden sm:inline">{t('common.publish')}</span>
        </Button>
      </div>

      {mutation.isPending ? (
        <div className="pt-2">
          <div className="h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
            <div className="h-full animate-pulse rounded-full bg-gradient-to-r from-[#FF6B00] to-[#7C3AED]" style={{ width: '60%' }} />
          </div>
          <p className="mt-1 text-center text-xs font-bold text-gray-400">{t('post_composer.publishing')}</p>
        </div>
      ) : null}
        </>
      )}
    </div>
  );

  const [confirmClose, setConfirmClose] = useState(false);
  const handleModalClose = () => {
    if (hasDraft) {
      setConfirmClose(true);
    } else {
      onClose?.();
    }
  };

  if (mode === 'modal') {
    return (
      <>
        <Modal open={Boolean(open)} onClose={handleModalClose} title={t('post_composer.title')}>
          {publishedPost ? (
            <PublishSuccess
              post={publishedPost}
              onCreateAnother={() => {
                setPublishedPost(null);
                setExpanded(true);
                window.setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              onClose={onClose}
            />
          ) : content}
        </Modal>
        <ConfirmDialog
          open={confirmClose}
          onClose={() => setConfirmClose(false)}
          title={t('post_composer.close_confirm')}
          description={t('post_composer.draft_desc')}
          confirmText={t('common.close')}
          tone="danger"
          onConfirm={() => { setConfirmClose(false); onClose?.(); }}
        />
        <MemeEditor
          open={memeEditorOpen}
          onClose={() => setMemeEditorOpen(false)}
          onExport={(blob) => {
            const memeFile = new File([blob], `meme-${Date.now()}.png`, { type: 'image/png' });
            setValidatedFiles([...files, memeFile]);
            setType('meme');
            setMemeEditorOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      {publishedPost ? (
        <div className="mb-4">
          <PublishSuccess post={publishedPost} onCreateAnother={() => setPublishedPost(null)} />
        </div>
      ) : null}
      {content}
    </section>
  );
}

function ComposerPreview({
  authorName,
  text,
  previewUrls,
  pollOptions,
  communityName,
}: {
  authorName?: string;
  text: string;
  previewUrls: Array<{ file: File; url: string }>;
  pollOptions: string[];
  communityName?: string;
}) {
  return (
    <div className="mb-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3 dark:border-orange-900/40 dark:bg-orange-950/15">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase text-orange-500">Предпросмотр</span>
        {communityName ? <span className="truncate text-xs font-black text-purple-600">/{communityName}</span> : null}
      </div>
      <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
        <p className="text-sm font-black text-gray-900 dark:text-zinc-100">{authorName || 'Мемолюция'}</p>
        {text ? <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-700 dark:text-zinc-200">{text}</p> : null}
        {previewUrls.length ? (
          <div className={`mt-3 grid gap-2 ${previewUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {previewUrls.slice(0, 4).map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-900">
                {item.file.type.startsWith('video/') ? (
                  <video src={item.url} className="h-28 w-full object-cover" muted />
                ) : (
                  <img src={item.url} alt="" className="h-28 w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : null}
        {pollOptions.length ? (
          <div className="mt-3 space-y-2">
            {pollOptions.map((option) => (
              <div key={option} className="rounded-lg border border-purple-100 px-3 py-2 text-sm font-black text-purple-700 dark:border-purple-900/60 dark:text-purple-300">
                {option}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PublishSuccess({
  post,
  onCreateAnother,
  onClose,
}: {
  post: Post;
  onCreateAnother: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100">
      <p className="text-lg font-black">Пост опубликован</p>
      <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">Теперь он может собирать реакции, комментарии и репосты.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/post/${post.id}`}
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-700"
        >
          Открыть пост
        </Link>
        <Button variant="outline" onClick={onCreateAnother}>Создать ещё</Button>
        {onClose ? <Button variant="ghost" onClick={onClose}>Готово</Button> : null}
      </div>
    </div>
  );
}
