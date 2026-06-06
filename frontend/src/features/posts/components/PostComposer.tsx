import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { Camera, ChevronDown, FileImage, Film, Globe, Hash, Image as ImageIcon, Lock, Plus, Send, Smile, Users, Vote, X, CheckCircle2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../shared/api/client';
import type { Community, CreatePostParams, Post, User } from '../../../shared/types';
import { Avatar, Button, ConfirmDialog, IconButton, Modal, Switch, useToast } from '../../../shared/ui';
import { useAuthStore } from '../../../store/authStore';
import { redirectToLogin } from '../../../utils/authRedirect';
import { MemeEditor } from '../../meme-editor/MemeEditor';
import { useTranslation } from '../../../shared/i18n';
import { trackEvent } from '../../../shared/lib/analytics';
import { cn } from '../../../lib/utils';

const DRAFT_KEY = 'memelution-post-draft-v2';
const RECENT_EMOJIS_KEY = 'memelution-recent-emojis-v1';
const MAX_TEXT = 500;
const MAX_FILE_MB = 50;
const MAX_TAGS = 8;
const MAX_MEDIA = 6;
const MAX_RECENT_EMOJIS = 18;
const EMOJI_CATEGORIES: Array<{ key: 'smileys' | 'gestures' | 'hearts' | 'animals' | 'food' | 'objects' | 'symbols'; icon: string; emojis: string[] }> = [
  { key: 'smileys', icon: '😀', emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','🥴','😠','😡','🤬','😷','🤒','🤕','🤢','🤮','🥳','🤠','🥺','🤥','🤫','🤭','🧐','🤓'] },
  { key: 'gestures', icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄'] },
  { key: 'hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','😻','💑','💏'] },
  { key: 'animals', icon: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'] },
  { key: 'food', icon: '🍎', emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕'] },
  { key: 'objects', icon: '🎉', emojis: ['🎉','🎊','🎈','🎂','🎁','🎄','🎃','🎀','🎗️','🎟️','🎫','🎖️','🏆','🏅','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🎯','🎮','🎰','🧩','🎲','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','🎯'] },
  { key: 'symbols', icon: '✨', emojis: ['✨','💫','⭐','🌟','💥','💢','💯','💦','💨','🔥','🎵','🎶','♻️','✅','❌','❎','❓','❔','‼️','⁉️','💤','🆗','🆕','🆙','🆒','🆓','🆖','🆗','🆘','🆚','🈁','🈶','🈚','🈸','🈺','🈷️','✴️','🆎','💠','⛔','📛','💹','💱','💲','⚠️','🚫','❗','❕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠'] },
];

type ComposerMode = 'inline' | 'modal';
type Visibility = 'public' | 'followers' | 'private';
type MentionSuggestion = Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
type CaretPosition = { top: number; left: number };

function getMentionQueryAtCursor(value: string, caret: number) {
  const beforeCursor = value.slice(0, caret);
  const match = beforeCursor.match(/(^|[\s(])@([\wа-яё_]{2,30})$/iu);
  return match?.[2] || '';
}

function getCaretPosition(textarea: HTMLTextAreaElement, caret: number): CaretPosition {
  if (typeof window === 'undefined') return { top: 56, left: 0 };

  const styles = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const properties = [
    'boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight',
    'letterSpacing', 'lineHeight', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth',
  ] as const;

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  properties.forEach((property) => {
    const cssName = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    mirror.style.setProperty(cssName, styles[property]);
  });

  mirror.textContent = textarea.value.slice(0, caret);
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(caret) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
  const rawTop = marker.offsetTop - textarea.scrollTop + lineHeight + 8;
  const rawLeft = marker.offsetLeft - textarea.scrollLeft;
  const maxLeft = Math.max(textarea.clientWidth - 256, 0);

  document.body.removeChild(mirror);
  return { top: Math.max(rawTop, 44), left: Math.min(Math.max(rawLeft, 0), maxLeft) };
}

function parseTags(text: string, tagsInput: string): string[] {
  const inline = Array.from(text.matchAll(/#([\wа-яё_]{2,80})/giu), (m) => m[1].toLowerCase());
  const typed = tagsInput
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, '').trim().toLowerCase())
    .filter((t) => /^[\wа-яё_]{2,80}$/iu.test(t));
  return Array.from(new Set([...inline, ...typed])).slice(0, MAX_TAGS);
}

function buildPostText(text: string, extraTags: string[]): string {
  const inlineTags = new Set(Array.from(text.matchAll(/#([\wа-яё_]{2,80})/giu), (m) => m[1].toLowerCase()));
  const newTags = extraTags.filter((t) => !inlineTags.has(t)).map((t) => `#${t}`);
  const tagLine = newTags.join(' ');
  return [text.trim(), tagLine].filter(Boolean).join('\n\n');
}

const VISIBILITY_OPTIONS: Array<{ id: Visibility; Icon: typeof Globe; labelKey: string }> = [
  { id: 'public', Icon: Globe, labelKey: 'post_composer.visibility_public_label' },
  { id: 'followers', Icon: Users, labelKey: 'post_composer.visibility_followers_label' },
  { id: 'private', Icon: Lock, labelKey: 'post_composer.visibility_private_label' },
];

export function PollBuilder({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const { t } = useTranslation();
  const update = (index: number, value: string) => onChange(options.map((item, i) => (i === index ? value : item)));
  const add = () => { if (options.length < 6) onChange([...options, '']); };
  const remove = (index: number) => { if (options.length > 2) onChange(options.filter((_, i) => i !== index)); };

  return (
    <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <Vote size={15} /> {t('post_composer.poll_options')}
        </p>
        <button
          type="button"
          onClick={add}
          disabled={options.length >= 6}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-violet-600/10 px-2.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-600/20 disabled:opacity-40 dark:text-violet-300"
        >
          <Plus size={12} /> {t('post_composer.poll_option')}
        </button>
      </div>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex gap-1.5">
            <input
              value={option}
              onChange={(event) => update(index, event.target.value)}
              placeholder={`${t('post_composer.poll_option')} ${index + 1}`}
              className="h-9 min-w-0 flex-1 rounded-lg border border-violet-200/60 bg-white px-3 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-violet-900/40 dark:bg-zinc-950 dark:focus:ring-violet-950"
            />
            <button
              type="button"
              aria-label={t('post_composer.poll_remove')}
              onClick={() => remove(index)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
              disabled={options.length <= 2}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-medium text-violet-600/70 dark:text-violet-300/60">{t('post_composer.poll_min_hint')}</p>
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
  const gifInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const visibilityRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const isComposingRef = useRef(false);
  const listboxId = useMemo(() => `mention-listbox-${Math.random().toString(36).slice(2, 9)}`, []);

  const [text, setText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [type, setType] = useState<CreatePostParams['type']>('text');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState(communityId || '');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollResults, setPollResults] = useState<'always' | 'after_vote'>('after_vote');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [showPoll, setShowPoll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [expanded, setExpanded] = useState(mode === 'modal' || defaultExpanded);
  const [memeEditorOpen, setMemeEditorOpen] = useState(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [publishedPost, setPublishedPost] = useState<Post | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<MentionSuggestion[]>([]);
  const [mentionMenuPosition, setMentionMenuPosition] = useState<CaretPosition>({ top: 56, left: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  const communitiesQuery = useQuery({
    queryKey: ['communities', 'composer'],
    queryFn: () => api.communities(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const trendsQuery = useQuery({
    queryKey: ['trends', 'day'],
    queryFn: () => api.trends('day'),
    staleTime: 60_000,
  });
  const trendingHashtags: string[] = (trendsQuery.data as { hashtags?: { name: string }[] })?.hashtags?.map((h: { name: string }) => h.name) || [];

  const mentionQuery = useQuery({
    queryKey: ['search-autocomplete', 'mentions', suggestionQuery],
    queryFn: () => api.searchAutocomplete(suggestionQuery),
    enabled: Boolean(user) && suggestionQuery.length >= 2,
    staleTime: 30_000,
  });

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

  useEffect(() => {
    if (!user || communityId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { text?: string; tagsInput?: string; pollOptions?: string[]; selectedCommunity?: string; showPoll?: boolean; savedAt?: number };
      setText(draft.text || '');
      setTagsInput(draft.tagsInput || '');
      setPollOptions(draft.pollOptions?.length ? draft.pollOptions : ['', '']);
      setSelectedCommunity(draft.selectedCommunity || '');
      if (draft.showPoll) setShowPoll(true);
      if (draft.savedAt) setLastSavedAt(draft.savedAt);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [communityId, user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentEmojis(parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_EMOJIS));
      }
    } catch {
      localStorage.removeItem(RECENT_EMOJIS_KEY);
    }
  }, []);

  useEffect(() => {
    if (!user || communityId) return;
    const payload = JSON.stringify({ text, tagsInput, pollOptions, selectedCommunity, showPoll, savedAt: Date.now() });
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, payload);
      setLastSavedAt(Date.now());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [communityId, pollOptions, selectedCommunity, showPoll, tagsInput, text, user]);

  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  useEffect(() => {
    if (!showVisibility && !showSettings && !showEmojiPicker) return;
    const handler = (event: MouseEvent) => {
      if (showVisibility && visibilityRef.current && !visibilityRef.current.contains(event.target as Node)) {
        setShowVisibility(false);
      }
      if (showSettings && settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (showEmojiPicker && emojiButtonRef.current && !emojiButtonRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target && target.closest('[data-emoji-picker]')) return;
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker, showSettings, showVisibility]);

  const discardDraft = useCallback(() => {
    setText('');
    setTagsInput('');
    setFiles([]);
    setPollOptions(['', '']);
    setShowPoll(false);
    setShowSettings(false);
    setSelectedCommunity(communityId || '');
    setError('');
    setFileError('');
    setLastSavedAt(null);
    localStorage.removeItem(DRAFT_KEY);
    toast.show({ title: t('post_composer.draft_discarded'), tone: 'info' });
  }, [communityId, toast, t]);

  const previewUrls = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const selectedCommunityName = useMemo(() => {
    if (communityId) return '';
    return (communitiesQuery.data || []).find((community: Community) => community.id === selectedCommunity)?.name || '';
  }, [communitiesQuery.data, communityId, selectedCommunity]);
  const extraTags = useMemo(() => parseTags('', tagsInput), [tagsInput]);
  const previewText = useMemo(() => buildPostText(text, extraTags), [extraTags, text]);
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
    const merged = [...files, ...accepted].slice(0, MAX_MEDIA);
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

  useEffect(() => {
    if (suggestionQuery.length < 2) {
      setFilteredUsers([]);
      return;
    }
    const lowerQuery = suggestionQuery.toLowerCase();
    const results = new Map<string, MentionSuggestion>();
    const apiPeople: MentionSuggestion[] = (mentionQuery.data?.people || []).map((person) => ({
      id: person.id,
      username: person.username,
      display_name: person.display_name,
      avatar_url: person.avatar_url,
    }));
    apiPeople.forEach((person) => {
      const username = person.username.toLowerCase();
      const displayName = person.display_name.toLowerCase();
      if (!username.includes(lowerQuery) && !displayName.includes(lowerQuery)) return;
      if (!results.has(username)) results.set(username, person);
    });
    setFilteredUsers(Array.from(results.values()).slice(0, 5));
    setActiveSuggestionIndex(0);
  }, [mentionQuery.data?.people, suggestionQuery]);

  const insertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? text.length;
    const nextText = `${text.slice(0, caret)}${emoji}${text.slice(caret)}`;
    const nextCaret = caret + emoji.length;
    setText(nextText);
    setExpanded(true);
    setError('');
    setPublishedPost(null);
    setShowEmojiPicker(false);
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, MAX_RECENT_EMOJIS);
      try { localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }, [text]);

  const updateMentionSuggestions = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const caret = textarea.selectionStart ?? textarea.value.length;
    const nextQuery = getMentionQueryAtCursor(textarea.value, caret);
    if (nextQuery.length < 2) {
      setShowSuggestions(false);
      setSuggestionQuery('');
      return;
    }
    setSuggestionQuery(nextQuery);
    setMentionMenuPosition(getCaretPosition(textarea, caret));
    setShowSuggestions(true);
    setActiveSuggestionIndex(0);
  };

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, caret);
    const query = getMentionQueryAtCursor(text, caret);
    const mentionStart = beforeCursor.lastIndexOf(`@${query}`);
    if (mentionStart < 0) return;
    const mentionText = `@${username} `;
    const nextText = `${text.slice(0, mentionStart)}${mentionText}${text.slice(caret)}`;
    const nextCaret = mentionStart + mentionText.length;
    setText(nextText);
    setExpanded(true);
    setError('');
    setPublishedPost(null);
    setShowSuggestions(false);
    setSuggestionQuery('');
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const submit = () => {
    if (!user) {
      redirectToLogin();
      return;
    }
    const finalType = showPoll ? 'poll' : type;
    const cleanOptions = pollOptions.map((item) => item.trim()).filter(Boolean);
    const finalText = buildPostText(text, extraTags);
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

  const charPercent = Math.min((text.length / MAX_TEXT) * 100, 100);
  const charOverflow = text.length > MAX_TEXT;
  const cleanPollOptionCount = pollOptions.map((item) => item.trim()).filter(Boolean).length;
  const hasDraft = Boolean(text.trim() || tagsInput.trim() || files.length || showPoll || showSettings);
  const shouldGuardDraft = hasDraft && (mode === 'inline' || Boolean(open));
  const draftAgeMs = lastSavedAt ? now - lastSavedAt : 0;
  const draftLabel = lastSavedAt
    ? draftAgeMs < 60_000
      ? t('post_composer.draft_saved_just_now')
      : t('post_composer.draft_saved_minutes', { n: Math.max(1, Math.floor(draftAgeMs / 60_000)) })
    : null;
  const collapsed = mode === 'inline' && !expanded && !hasDraft;
  const canSubmit = Boolean((text.trim() || files.length || (showPoll && cleanPollOptionCount >= 2)) && !charOverflow);
  const hasPreview = Boolean(previewText || previewUrls.length || showPoll);
  const currentVis = VISIBILITY_OPTIONS.find((v) => v.id === visibility)!;

  useEffect(() => {
    if (!shouldGuardDraft) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldGuardDraft]);

  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const handleModalClose = () => {
    if (shouldGuardDraft) setConfirmClose(true);
    else onClose?.();
  };

  const content = (
    <div
      className="relative"
      onPaste={(event) => {
        const pasted = Array.from(event.clipboardData.files).filter((item) => item.type.startsWith('image/'));
        if (pasted.length) setValidatedFiles(pasted);
      }}
      onDragOver={(event) => { event.preventDefault(); if (!isDragging) setIsDragging(true); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        setValidatedFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/90 text-sm font-semibold text-orange-600 opacity-0 transition-opacity dark:bg-orange-950/90 dark:text-orange-300',
          isDragging && 'pointer-events-auto opacity-100',
        )}
      >
        <div className="flex items-center gap-2">
          <FileImage size={20} />
          {t('post_composer.drop_hint')}
        </div>
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={() => { setExpanded(true); window.setTimeout(() => textareaRef.current?.focus(), 50); }}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          {user ? <Avatar src={user.avatar_url} name={user.display_name} /> : <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-900" />}
          <span className="flex-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {user ? t('post_composer.placeholder') : t('post_composer.login_required')}
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white">
            <Plus size={18} />
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {user ? <Avatar src={user.avatar_url} name={user.display_name} className="mt-1" /> : null}
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                value={text}
                onFocus={(event) => { setExpanded(true); updateMentionSuggestions(event.currentTarget); }}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                onClick={(event) => updateMentionSuggestions(event.currentTarget)}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={(event) => {
                  isComposingRef.current = false;
                  updateMentionSuggestions(event.currentTarget);
                }}
                onKeyUp={(event) => {
                  if (isComposingRef.current) return;
                  if (event.key === 'Escape' || event.key === 'Enter' || event.key === 'Tab' || event.key.startsWith('Arrow')) return;
                  updateMentionSuggestions(event.currentTarget);
                }}
                onChange={(event) => {
                  setText(event.target.value);
                  setExpanded(true);
                  setError('');
                  setPublishedPost(null);
                  if (!isComposingRef.current) updateMentionSuggestions(event.currentTarget);
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    if (canSubmit && !mutation.isPending) submit();
                    return;
                  }
                  if (event.key === 'ArrowDown' && showSuggestions && filteredUsers.length) {
                    event.preventDefault();
                    setActiveSuggestionIndex((index) => (index + 1) % filteredUsers.length);
                    return;
                  }
                  if (event.key === 'ArrowUp' && showSuggestions && filteredUsers.length) {
                    event.preventDefault();
                    setActiveSuggestionIndex((index) => (index - 1 + filteredUsers.length) % filteredUsers.length);
                    return;
                  }
                  if (event.key === 'Escape') {
                    if (showSuggestions) {
                      event.preventDefault();
                      setShowSuggestions(false);
                      return;
                    }
                    if (mode === 'inline') {
                      event.preventDefault();
                      event.currentTarget.blur();
                      return;
                    }
                  }
                  if ((event.key === 'Enter' || event.key === 'Tab') && showSuggestions && filteredUsers.length) {
                    event.preventDefault();
                    insertMention(filteredUsers[activeSuggestionIndex]?.username || filteredUsers[0].username);
                  }
                }}
                placeholder={user ? t('post_composer.placeholder') : t('post_composer.login_required')}
                disabled={!user || mutation.isPending}
                rows={1}
                className="w-full resize-none border-0 bg-transparent px-1 py-2 text-[15px] font-medium leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                style={{ minHeight: '52px' }}
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                aria-controls={showSuggestions ? listboxId : undefined}
                aria-activedescendant={showSuggestions && filteredUsers.length ? `${listboxId}-opt-${activeSuggestionIndex}` : undefined}
              />
              {showSuggestions && filteredUsers.length ? (
                <div
                  className="absolute z-30 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950"
                  style={{ top: mentionMenuPosition.top, left: mentionMenuPosition.left }}
                  role="listbox"
                  id={listboxId}
                  aria-label="Mention suggestions"
                >
                  {filteredUsers.map((person, index) => (
                    <button
                      key={person.id}
                      id={`${listboxId}-opt-${index}`}
                      type="button"
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onMouseDown={(event) => { event.preventDefault(); insertMention(person.username); }}
                      className={cn(
                        'flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left transition-colors focus:outline-none',
                        index === activeSuggestionIndex
                          ? 'bg-orange-50 text-zinc-900 dark:bg-orange-950/30 dark:text-zinc-100'
                          : 'hover:bg-orange-50/60 dark:hover:bg-orange-950/20',
                      )}
                      role="option"
                      aria-selected={index === activeSuggestionIndex}
                    >
                      <Avatar src={person.avatar_url} name={person.display_name} className="h-7 w-7 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{person.display_name}</span>
                        <span className="block truncate text-xs text-zinc-400">@{person.username}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {previewUrls.length ? (
            <div className={cn('grid gap-1.5', previewUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
              {previewUrls.map((item, index) => (
                <div
                  key={`${item.file.name}-${index}`}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {item.file.type.startsWith('video/') ? (
                    <video src={item.url} controls className="max-h-80 w-full bg-black" />
                  ) : (
                    <img src={item.url} alt="" className="max-h-80 w-full object-cover" />
                  )}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80">
                      <input type="file" accept="image/*,video/mp4" className="hidden" onChange={(event) => replaceFile(index, event.target.files?.[0] || null)} />
                      <FileImage size={14} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {fileError ? <p role="alert" aria-live="assertive" className="px-1 text-xs font-medium text-red-500">{fileError}</p> : null}

          {error ? <p role="alert" aria-live="assertive" className="px-1 text-xs font-medium text-red-500">{error}</p> : null}

          {showPoll ? (
            <div className="space-y-2">
              <PollBuilder options={pollOptions} onChange={setPollOptions} />
              <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
                <input
                  type="radio"
                  id="poll-results-after"
                  name="poll-results"
                  checked={pollResults === 'after_vote'}
                  onChange={() => setPollResults('after_vote')}
                  className="accent-violet-600"
                />
                <label htmlFor="poll-results-after" className="cursor-pointer">{t('post_composer.poll_results_after')}</label>
                <input
                  type="radio"
                  id="poll-results-now"
                  name="poll-results"
                  checked={pollResults === 'always'}
                  onChange={() => setPollResults('always')}
                  className="ml-3 accent-violet-600"
                />
                <label htmlFor="poll-results-now" className="cursor-pointer">{t('post_composer.poll_results_now')}</label>
              </div>
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

          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <div className="flex items-center gap-0.5">
              <IconButton label={t('post_composer.add_media')} onClick={() => fileInputRef.current?.click()}>
                <FileImage size={18} />
              </IconButton>
              <IconButton
                label={t('post_composer.meme_editor')}
                onClick={() => { setExpanded(true); setMemeEditorOpen(true); }}
              >
                <ImageIcon size={18} />
              </IconButton>
              <IconButton
                label={t('post_composer.add_poll')}
                onClick={() => { setExpanded(true); setShowPoll((v) => !v); if (showPoll) { setType('text'); setPollOptions(['', '']); } else { setType('poll'); } }}
                className={cn(showPoll && 'bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300')}
              >
                <Vote size={18} />
              </IconButton>
              <IconButton label={t('post_composer.add_gif')} onClick={() => gifInputRef.current?.click()}>
                <Film size={18} />
              </IconButton>
              <IconButton label={t('post_composer.add_camera')} onClick={() => cameraInputRef.current?.click()}>
                <Camera size={18} />
              </IconButton>
              <div className="relative">
                <IconButton
                  ref={emojiButtonRef}
                  label={t('post_composer.add_emoji')}
                  aria-expanded={showEmojiPicker}
                  aria-haspopup="dialog"
                  onClick={() => setShowEmojiPicker((value) => !value)}
                  className={cn(showEmojiPicker && 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300')}
                >
                  <Smile size={18} />
                </IconButton>
                {showEmojiPicker ? (
                  <EmojiPicker
                    onSelect={insertEmoji}
                    recent={recentEmojis}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                ) : null}
              </div>

              <div ref={visibilityRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowVisibility((v) => !v)}
                  className={cn(
                    'ml-1 inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
                    visibility === 'public' && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300',
                    visibility === 'followers' && 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300',
                    visibility === 'private' && 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                  )}
                  title={
                    visibility === 'public' ? t('post_composer.visibility_public')
                    : visibility === 'followers' ? t('post_composer.visibility_followers')
                    : t('post_composer.visibility_private')
                  }
                >
                  <currentVis.Icon size={14} />
                  <span className="hidden sm:inline">{t(currentVis.labelKey)}</span>
                  <ChevronDown size={12} className="opacity-50" />
                </button>
                {showVisibility ? (
                  <div className="absolute bottom-full left-0 z-30 mb-1.5 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950">
                    {VISIBILITY_OPTIONS.map(({ id, Icon, labelKey }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setVisibility(id); setShowVisibility(false); }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900',
                          visibility === id && 'font-semibold text-orange-600 dark:text-orange-400',
                        )}
                      >
                        <Icon size={15} />
                        <span className="flex-1">{t(labelKey)}</span>
                        {visibility === id ? <CheckCircle2 size={14} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div ref={settingsRef} className="relative">
                <IconButton
                  label={t('post_composer.settings')}
                  onClick={() => setShowSettings((v) => !v)}
                  className={cn(showSettings && 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200')}
                >
                  <Hash size={18} />
                </IconButton>
                {showSettings ? (
                  <div className="absolute bottom-full right-0 z-30 mb-1.5 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="space-y-3">
                      {!communityId ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-zinc-500">{t('post_composer.no_community')}</label>
                          <select
                            value={selectedCommunity}
                            onChange={(event) => setSelectedCommunity(event.target.value)}
                            className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm font-medium outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            <option value="">{t('post_composer.no_community')}</option>
                            {(communitiesQuery.data || []).map((community: Community) => (
                              <option key={community.id} value={community.id}>{community.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-500">
                          <Hash size={12} className="text-orange-500" /> {t('post_composer.tags_hint')}
                        </label>
                        <input
                          value={tagsInput}
                          onChange={(event) => setTagsInput(event.target.value)}
                          placeholder="#мем #юмор"
                          className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm font-medium outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950"
                        />
                        {(() => {
                          const lastWord = tagsInput.split(/\s+/).filter(Boolean).pop() || '';
                          if (lastWord.length < 1) return null;
                          const matches = trendingHashtags.filter(
                            (h) => h.toLowerCase().includes(lastWord.toLowerCase()) && !tagsInput.split(/\s+/).some((t) => t.toLowerCase() === h.toLowerCase()),
                          ).slice(0, 5);
                          if (!matches.length) return null;
                          return (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {matches.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const words = tagsInput.split(/\s+/).filter(Boolean);
                                    words[words.length - 1] = tag;
                                    setTagsInput(words.join(' ') + ' ');
                                  }}
                                  className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50"
                                >
                                  #{tag}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">{t('post_composer.comments')}</span>
                        <Switch checked={commentsEnabled} onChange={setCommentsEnabled} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasDraft && draftLabel ? (
                <span className="hidden items-center gap-1 text-[11px] text-zinc-400 sm:inline-flex" aria-live="polite">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {draftLabel}
                </span>
              ) : null}
              {text.length > 0 ? (
                <div className="relative flex h-8 w-8 items-center justify-center" title={`${text.length} / ${MAX_TEXT}`}>
                  <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
                    <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-100 dark:text-zinc-800" />
                    <circle
                      cx="14" cy="14" r="11" fill="none" strokeWidth="2"
                      strokeDasharray={`${charPercent * 0.691} 69.1`}
                      className={cn(
                        'transition-all',
                        charOverflow ? 'text-red-500' : text.length > MAX_TEXT * 0.8 ? 'text-amber-500' : 'text-orange-500',
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  {text.length > MAX_TEXT * 0.8 ? (
                    <span className={cn('absolute text-[9px] font-bold', charOverflow ? 'text-red-500' : 'text-amber-500')}>
                      {MAX_TEXT - text.length}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {hasDraft ? (
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(true)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-red-500"
                >
                  {t('post_composer.draft_discard')}
                </button>
              ) : null}
              <Button
                onClick={submit}
                loading={mutation.isPending}
                disabled={!canSubmit}
                className="h-9 rounded-full px-4"
              >
                {!mutation.isPending ? <Send size={15} /> : null}
                <span className="hidden sm:inline">{t('common.publish')}</span>
              </Button>
            </div>
          </div>

          {mutation.isPending ? (
            <div className="space-y-1">
              <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full w-3/5 animate-pulse rounded-full bg-gradient-to-r from-orange-500 to-violet-500" />
              </div>
              <p className="text-center text-xs font-medium text-zinc-400">{t('post_composer.publishing')}</p>
            </div>
          ) : null}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) setValidatedFiles(Array.from(event.target.files));
          event.target.value = '';
        }}
      />
      <input
        ref={gifInputRef}
        type="file"
        accept="image/gif"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) setValidatedFiles(Array.from(event.target.files));
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) setValidatedFiles(Array.from(event.target.files));
          event.target.value = '';
        }}
      />
    </div>
  );

  if (mode === 'modal') {
    return (
      <>
        {shouldGuardDraft ? <DraftNavigationGuard /> : null}
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
        <ConfirmDialog
          open={confirmDiscard}
          onClose={() => setConfirmDiscard(false)}
          title={t('post_composer.draft_discard_confirm')}
          description={t('post_composer.draft_discard_desc')}
          confirmText={t('post_composer.draft_discard')}
          tone="danger"
          onConfirm={() => { setConfirmDiscard(false); discardDraft(); }}
        />
      </>
    );
  }

  return (
    <>
      {shouldGuardDraft ? <DraftNavigationGuard /> : null}
      <section className="rounded-xl border border-zinc-200 bg-white p-3 transition-shadow focus-within:shadow-md hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
        {publishedPost ? (
          <div className="mb-3">
            <PublishSuccess post={publishedPost} onCreateAnother={() => setPublishedPost(null)} />
          </div>
        ) : null}
        {content}
      </section>
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t('post_composer.draft_discard_confirm')}
        description={t('post_composer.draft_discard_desc')}
        confirmText={t('post_composer.draft_discard')}
        tone="danger"
        onConfirm={() => { setConfirmDiscard(false); discardDraft(); }}
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

function DraftNavigationGuard() {
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const leave = window.confirm('У вас есть несохранённый черновик. Уйти?');
    if (leave) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  return null;
}

function renderTextWithHashtags(value: string) {
  return value.split(/(#[\wа-яё_]{2,80})/giu).map((part, index) => {
    if (/^#[\wа-яё_]{2,80}$/iu.test(part)) {
      return (
        <span key={`${part}-${index}`} className="font-semibold text-orange-600 dark:text-orange-400">
          {part}
        </span>
      );
    }
    return part;
  });
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
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{t('post_composer.preview')}</span>
        {communityName ? <span className="truncate text-xs font-semibold text-violet-600">/{communityName}</span> : null}
      </div>
      <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-950">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{authorName || t('post_composer.brand_fallback')}</p>
        {text ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{renderTextWithHashtags(text)}</p> : null}
        {previewUrls.length ? (
          <div className={cn('mt-2.5 grid gap-1.5', previewUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {previewUrls.slice(0, 4).map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                {item.file.type.startsWith('video/') ? (
                  <video src={item.url} className="h-24 w-full object-cover" muted />
                ) : (
                  <img src={item.url} alt="" className="h-24 w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : null}
        {pollOptions.length ? (
          <div className="mt-2.5 space-y-1.5">
            {pollOptions.map((option) => (
              <div key={option} className="rounded-xl border border-violet-200/60 px-3 py-1.5 text-sm font-medium text-violet-700 dark:border-violet-900/60 dark:text-violet-300">
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
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">{t('post_composer.published')}</p>
          <p className="mt-0.5 text-sm text-emerald-700/80 dark:text-emerald-300/80">{t('post_composer.published_hint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/post/${post.id}`}
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {t('post_composer.open_post')}
            </Link>
            <button
              type="button"
              onClick={onCreateAnother}
              className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-zinc-950 dark:text-emerald-300"
            >
              {t('post_composer.create_another')}
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100/60 dark:text-emerald-300"
              >
                {t('post_composer.done')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// (ComposerPreview now uses useTranslation directly)

function EmojiPicker({
  onSelect,
  recent,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  recent: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<typeof EMOJI_CATEGORIES[number]['key']>('smileys');
  const [search, setSearch] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  const visibleEmojis = useMemo(() => {
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      const all = EMOJI_CATEGORIES.flatMap((category) => category.emojis);
      const filtered = all.filter((emoji) => emoji.includes(query));
      if (recent.length) {
        const matchedRecent = recent.filter((emoji) => emoji.includes(query));
        return { recent: matchedRecent, main: filtered };
      }
      return { recent: [], main: filtered };
    }
    const category = EMOJI_CATEGORIES.find((item) => item.key === activeCategory);
    return { recent, main: category?.emojis || [] };
  }, [activeCategory, recent, search]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      data-emoji-picker
      role="dialog"
      aria-label={t('post_composer.emoji_picker_title')}
      className="absolute bottom-full left-0 z-30 mb-1.5 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/15 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('post_composer.emoji_search')}
          aria-label={t('post_composer.emoji_search')}
          className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      {visibleEmojis.recent.length ? (
        <EmojiSection title={t('post_composer.emoji_recent')} emojis={visibleEmojis.recent} onSelect={onSelect} />
      ) : null}
      <div ref={gridRef} className="max-h-56 overflow-y-auto p-2">
        {visibleEmojis.main.length ? (
          <div className="grid grid-cols-8 gap-0.5">
            {visibleEmojis.main.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => onSelect(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-orange-50 focus:bg-orange-50 focus:outline-none dark:hover:bg-orange-950/30 dark:focus:bg-orange-950/30"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-2 py-6 text-center text-xs font-medium text-zinc-400">{t('post_composer.emoji_no_results')}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-0.5 border-t border-zinc-100 bg-zinc-50/60 p-1 dark:border-zinc-800 dark:bg-zinc-900/40">
        {EMOJI_CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => { setActiveCategory(category.key); setSearch(''); }}
            title={t(`post_composer.emoji_category_${category.key}`)}
            aria-label={t(`post_composer.emoji_category_${category.key}`)}
            aria-pressed={activeCategory === category.key && !search}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors hover:bg-white focus:bg-white focus:outline-none dark:hover:bg-zinc-800 dark:focus:bg-zinc-800',
              activeCategory === category.key && !search && 'bg-white shadow-sm dark:bg-zinc-800',
            )}
          >
            {category.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmojiSection({ title, emojis, onSelect }: { title: string; emojis: string[]; onSelect: (emoji: string) => void }) {
  return (
    <div className="border-b border-zinc-100 px-2 pb-1.5 pt-1.5 dark:border-zinc-800">
      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      <div className="grid grid-cols-8 gap-0.5">
        {emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => onSelect(emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-orange-50 focus:bg-orange-50 focus:outline-none dark:hover:bg-orange-950/30 dark:focus:bg-orange-950/30"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
