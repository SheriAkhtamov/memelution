import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Info, LogOut, MessageSquare, MoreVertical, Plus, Search, Send, SlidersHorizontal, X } from 'lucide-react';
import { AnimatedNumber, Avatar, Button, ConfirmDialog, ErrorState, Input, Modal, Skeleton, Tabs, useToast } from '../../shared/ui';
import { ProductEmptyState } from '../../shared/ui/ProductEmptyState';
import { MessageBubble, MessageRepliedPreview } from '../../features/messages/MessageBubble';
import { useAuthStore } from '../../store/authStore';
import { useMessages } from '../../features/messages/useMessages';
import { hapticMedium } from '../../utils/haptic';
import { useTranslation } from '../../shared/i18n';
import type { Chat } from '../../shared/types';

type ChatFolder = 'all' | 'unread' | 'groups';

export function MessagesPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatFolder, setChatFolder] = useState<ChatFolder>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState('');
  const [forwardSearch, setForwardSearch] = useState('');
  const toast = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const DRAFT_KEY = 'memelution-msg-draft';
  const loadDraft = (chatId: string) => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return '';
      const drafts = JSON.parse(raw) as Record<string, string>;
      return drafts[chatId] || '';
    } catch { return ''; }
  };
  const saveDraft = (chatId: string, txt: string) => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const drafts: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (txt.trim()) drafts[chatId] = txt;
      else delete drafts[chatId];
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    } catch {}
  };

  const { active, setActive, activeChat, chatsQuery, messagesQuery, chatDetailQuery, typing, typingMap, replyTo, setReplyTo, create, send, editMessage, deleteMessage, leaveChat, forwardMessage, uploadAndSend, notifyTyping, optimistic, removeOptimistic, sendReaction } = useMessages(params.get('chat') || '');

  const totalUnread = useMemo(() => (chatsQuery.data || []).reduce((sum, chat) => sum + (chat.unread_count || 0), 0), [chatsQuery.data]);

  const filteredChats = useMemo(() => {
    if (!chatsQuery.data) return [];
    let items = chatsQuery.data;
    if (chatFolder === 'unread') items = items.filter((chat) => (chat.unread_count || 0) > 0);
    if (chatFolder === 'groups') items = items.filter((chat) => chat.type !== 'direct');
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((chat) => {
      const peer = chat.members[0];
      const name = (chat.title || peer?.display_name || '').toLowerCase();
      const username = (peer?.username || '').toLowerCase();
      const latest = (chat.latest_message?.text || '').toLowerCase();
      return name.includes(q) || username.includes(q) || latest.includes(q);
    });
  }, [chatFolder, chatsQuery.data, searchQuery]);

  const allMessages = useMemo(() => (
    [...(messagesQuery.data?.items || []), ...optimistic.filter((message) => message.chat_id === active)]
  ), [active, messagesQuery.data?.items, optimistic]);

  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return allMessages;
    return allMessages.filter((message) => (
      (message.text || '').toLowerCase().includes(query)
      || (message.sender?.display_name || '').toLowerCase().includes(query)
      || (message.sender?.username || '').toLowerCase().includes(query)
    ));
  }, [allMessages, messageSearch]);

  const selectChat = (chatId: string) => {
    setActive(chatId);
    setMessageSearch('');
    setChatSearchOpen(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (chatId) next.set('chat', chatId);
      else next.delete('chat');
      return next;
    }, { replace: true });
  };

  const handleCreateChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = username.replace(/^@/, '').trim();
    if (!normalized) return;
    create.mutate(normalized, { onSuccess: () => setUsername('') });
  };

  const cycleFolder = () => {
    setChatFolder((current) => {
      if (current === 'all') return 'unread';
      if (current === 'unread') return 'groups';
      return 'all';
    });
  };

  const sendCurrentMessage = () => {
    const nextText = text.trim();
    if (!nextText || !active || send.isPending) return;
    send.mutate({ text: nextText, reply_to_message_id: replyTo?.id }, { onSuccess: () => { setText(''); hapticMedium(); } });
  };

  const handleEditStart = (message: { id: string; text: string }) => {
    setEditingId(message.id);
    setEditText(message.text);
  };
  const handleEditCancel = () => {
    setEditingId(null);
    setEditText('');
  };
  const handleEditSave = () => {
    if (!editingId || !editText.trim()) return;
    editMessage.mutate({ id: editingId, text: editText.trim() });
    setEditingId(null);
    setEditText('');
  };
  const handleForward = (id: string) => {
    setForwardMessageId(id);
    setForwardOpen(true);
  };
  const handleForwardSend = (targetChatId: string) => {
    if (!forwardMessageId) return;
    forwardMessage.mutate({ messageId: forwardMessageId, targetChatId });
    setForwardOpen(false);
    setForwardMessageId('');
  };

  useEffect(() => {
    // Scroll to unread divider if present, otherwise to bottom
    const unreadDivider = document.getElementById('unread-divider');
    if (unreadDivider) {
      unreadDivider.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messagesQuery.data?.items.length, active]);

  useEffect(() => {
    if (active) {
      const draft = loadDraft(active);
      setText(draft);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setText('');
    }
  }, [active]);

  useEffect(() => {
    if (!active || params.get('chat') === active) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('chat', active);
      return next;
    }, { replace: true });
  }, [active, params, setParams]);

  useEffect(() => {
    if (active && text) saveDraft(active, text);
    else if (active) saveDraft(active, '');
  }, [active, text]);

  if (!user) {
    return (
      <div className="messages-page p-3 sm:p-6">
        <ProductEmptyState
          title={t('common.required')}
          description={t('messages.login_required')}
          icon={<MessageSquare size={34} />}
          tone="flame"
        />
      </div>
    );
  }

  const activeTitle = activeChat ? getChatTitle(activeChat, t('messages.chat_title')) : t('messages.chat_title');
  const activeSubtitle = activeChat
    ? typing
      ? `${typing} ${t('messages.typing')}`
      : activeChat.members.map((member) => `@${member.username}`).join(', ') || t('messages.direct_chat')
    : '';
  const groupedMessages = groupMessages(visibleMessages, lang);
  const noMatchingMessages = Boolean(messageSearch.trim() && allMessages.length && !visibleMessages.length);

  return (
    <div className="messages-page px-3 py-5 sm:px-6 lg:py-7">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="page-icon-tile">
            <MessageSquare size={24} />
          </span>
          <h1 className="page-title truncate">{t('messages.title')}</h1>
        </div>
        {totalUnread ? (
          <span className="messages-unread-summary">
            <AnimatedNumber value={totalUnread > 99 ? '99+' : totalUnread} />
          </span>
        ) : null}
      </header>
      <section className="messages-layout">
        <aside className={`messages-inbox ${active ? 'hidden lg:flex' : 'flex'}`}>
          <div className="messages-inbox-controls">
            <form className="messages-create-form" onSubmit={handleCreateChat}>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect="off"
                className="messages-create-input"
              />
              <Button
                type="submit"
                className="messages-create-button"
                loading={create.isPending}
                disabled={!username.trim()}
                aria-label={t('messages.chats')}
              >
                <Plus size={20} />
              </Button>
            </form>
            {create.isError ? <p className="messages-create-error">{t('messages.create_error')}</p> : null}
            <div className="messages-tabs-wrap">
              <Tabs
                value={chatFolder}
                onChange={(value) => setChatFolder(value as ChatFolder)}
                items={[
                  { id: 'all', label: t('messages.filter_all') },
                  { id: 'unread', label: t('messages.filter_unread') },
                  { id: 'groups', label: t('messages.filter_conversations') },
                ]}
              />
            </div>
            <div className="messages-search-row">
              <div className="messages-search-field">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('messages.search')}
                  className="messages-search-input"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="messages-input-clear"
                    aria-label={t('messages.search_clear')}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={cycleFolder} className="messages-filter-button" aria-label={t('messages.filter_cycle')}>
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>
          <div className="messages-chat-list" aria-label={t('messages.chats')}>
            {chatsQuery.isLoading ? (
              <ChatListSkeleton />
            ) : chatsQuery.isError ? (
              <div className="p-4">
                <ErrorState description={t('messages.load_error')} onRetry={() => chatsQuery.refetch()} />
              </div>
            ) : filteredChats.length ? filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                active={active === chat.id}
                lang={lang}
                titleFallback={t('messages.chat_title')}
                emptyLabel={t('messages.empty_chat')}
                typingLabel={typingMap[chat.id] ? `${typingMap[chat.id]} ${t('messages.typing')}` : ''}
                onSelect={() => selectChat(chat.id)}
              />
            )) : (
              <CompactEmptyState
                title={t('messages.empty_list')}
                description={searchQuery.trim() ? t('messages.no_matching_messages_desc') : t('messages.empty_list_desc')}
              />
            )}
          </div>
        </aside>

        <section key={active || 'empty'} className={`messages-chat-panel motion-route-enter ${active ? 'flex' : 'hidden lg:flex'}`}>
          {activeChat ? (
            <>
              <div className="messages-chat-header">
                <button onClick={() => selectChat('')} className="messages-back-button lg:hidden" aria-label={t('messages.back')}>
                  <ArrowLeft size={20} />
                </button>
                <Avatar src={activeChat.avatar_url || activeChat.members[0]?.avatar_url} name={activeTitle} className="messages-active-avatar" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black tracking-[-0.02em]">{activeTitle}</p>
                  <p className="truncate text-xs font-bold text-[var(--app-muted)]">{activeSubtitle}</p>
                </div>
                <div className="messages-header-actions" role="group" aria-label={t('messages.chat_actions')}>
                  <button
                    type="button"
                    onClick={() => setChatSearchOpen((value) => {
                      const next = !value;
                      if (!next) setMessageSearch('');
                      return next;
                    })}
                    className="messages-header-action"
                    aria-label={t('messages.search_in_chat')}
                    aria-pressed={chatSearchOpen}
                  >
                    <Search size={18} />
                  </button>
                  <button type="button" onClick={() => setInfoOpen(true)} className="messages-header-action" aria-label={t('messages.info')}>
                    <Info size={18} />
                  </button>
                  <button type="button" onClick={() => setInfoOpen(true)} className="messages-header-action" aria-label={t('messages.info')}>
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
              {chatSearchOpen ? (
                <div className="messages-active-search">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                  <Input
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    placeholder={t('messages.search_in_chat')}
                    className="messages-active-search-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMessageSearch('');
                      setChatSearchOpen(false);
                    }}
                    className="messages-input-clear"
                    aria-label={t('messages.close_chat_search')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}
              <div className="messages-thread" aria-live="polite">
                {messagesQuery.isLoading ? (
                  <MessageThreadSkeleton />
                ) : messagesQuery.isError ? (
                  <ErrorState description={t('messages.load_error')} onRetry={() => messagesQuery.refetch()} />
                ) : allMessages.length ? noMatchingMessages ? (
                  <CompactEmptyState
                    title={t('messages.no_matching_messages')}
                    description={t('messages.no_matching_messages_desc')}
                  />
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date} className="contents">
                      <div className="messages-date-pill">{group.date}</div>
                      {group.items.map((message) => {
                        const isOptimistic = message.id.startsWith('optimistic-');
                        const unreadCount = activeChat?.unread_count || 0;
                        const realCount = messagesQuery.data?.items.length || 0;
                        const globalIdx = allMessages.indexOf(message);
                        const dividerIdx = realCount - unreadCount;
                        const showUnreadDivider = !messageSearch.trim() && !isOptimistic && unreadCount > 0 && globalIdx === dividerIdx;

                        return (
                          <div key={message.id}>
                            {showUnreadDivider && (
                              <div id="unread-divider" className="messages-unread-divider">
                                <div />
                                <span>{unreadCount} {t('messages.unread')}</span>
                                <div />
                              </div>
                            )}
                            <MessageBubble
                              message={message}
                              mine={message.sender.id === user.id}
                              editing={!isOptimistic && editingId === message.id}
                              editText={editText}
                              onEditChange={setEditText}
                              onEditSave={handleEditSave}
                              onEditCancel={handleEditCancel}
                              repliedMessage={findRepliedMessage(allMessages, message.reply_to_message_id)}
                              onRetry={isOptimistic && 'status' in message && message.status === 'failed' ? () => {
                                setText(message.text || '');
                                removeOptimistic(message.id);
                              } : undefined}
                              onReact={isOptimistic ? undefined : (emoji, reacted) => sendReaction.mutate({ messageId: message.id, emoji, reacted })}
                              actions={isOptimistic ? undefined : {
                                onReply: () => setReplyTo({ id: message.id, text: message.text, sender: message.sender.display_name }),
                                onEdit: () => handleEditStart(message as { id: string; text: string }),
                                onDelete: () => deleteMessage.mutate(message.id),
                                onForward: () => handleForward(message.id),
                                onCopy: () => {
                                  navigator.clipboard.writeText(message.text || '');
                                  toast.show({ title: t('messages.copied'), tone: 'success' });
                                },
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <ProductEmptyState
                    title={t('messages.start')}
                    description={t('messages.start_desc')}
                    icon={<MessageSquare size={32} />}
                    tone="flame"
                    className="messages-chat-empty"
                  />
                )}
                <div ref={bottomRef} />
              </div>
              <div className="messages-composer">
                <MessageRepliedPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />
                <div className="messages-composer-row">
                  <label className="messages-attach-button" title={t('messages.add_media')} aria-label={t('messages.add_media')}>
                    <ImagePlus size={18} aria-hidden="true" />
                    <input type="file" accept="image/*,video/mp4" className="sr-only" onChange={(event) => event.target.files?.[0] && uploadAndSend.mutate(event.target.files[0])} />
                  </label>
                  <textarea
                    ref={inputRef}
                    value={text}
                    rows={1}
                    aria-label={t('messages.input_placeholder')}
                    onChange={(event) => { setText(event.target.value); notifyTyping(); }}
                    onInput={(event) => {
                      const el = event.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendCurrentMessage();
                      }
                    }}
                    placeholder={t('messages.input_placeholder')}
                    className="messages-composer-input"
                  />
                  <Button onClick={sendCurrentMessage} loading={send.isPending} disabled={!text.trim()} className="messages-send-button" aria-label={t('messages.input_placeholder')}>
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </>
          ) : active && chatsQuery.isLoading ? (
            <MessageThreadSkeleton />
          ) : (
            <div className="flex flex-1 items-center justify-center p-5">
              <ProductEmptyState
                title={t('messages.select_chat')}
                description={t('messages.empty_list_desc')}
                icon={<MessageSquare size={32} />}
                tone="flame"
                className="messages-chat-empty"
              />
            </div>
          )}
        </section>
      </section>
      <Modal open={forwardOpen} onClose={() => setForwardOpen(false)} title={t('messages.forward_title')}>
        <div className="space-y-2">
          <Input value={forwardSearch} onChange={(event) => setForwardSearch(event.target.value)} placeholder={t('messages.forward_search')} />
          {(chatsQuery.data || [])
            .filter((chat) => {
              const peer = chat.members[0];
              const query = forwardSearch.trim().toLowerCase();
              const title = `${chat.title || ''} ${peer?.display_name || ''} ${peer?.username || ''}`.toLowerCase();
              return !query || title.includes(query);
            })
            .map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleForwardSend(chat.id)}
                className="motion-control flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-900"
              >
                <Avatar src={chat.avatar_url || chat.members[0]?.avatar_url} name={chat.title || chat.members[0]?.display_name} className="h-11 w-11 rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{chat.title || chat.members[0]?.display_name || t('messages.chat_title')}</span>
                  <span className="block truncate text-xs text-gray-400">{chat.latest_message?.text || t('messages.chat_title')}</span>
                </span>
              </button>
            ))}
        </div>
      </Modal>
      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title={t('messages.info_title')}>
        {chatDetailQuery.isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-xs font-black uppercase text-gray-400">{t('messages.members')}</p>
              <div className="space-y-2">
                {(chatDetailQuery.data?.members || activeChat?.members || []).map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 dark:hover:bg-zinc-900">
                    <Avatar src={member.avatar_url} name={member.display_name} className="h-11 w-11 rounded-xl" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{member.display_name}</span>
                      <span className="block truncate text-xs text-gray-400">@{member.username}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <p className="mb-2 text-xs font-black uppercase text-gray-400">{t('messages.media')}</p>
              {chatDetailQuery.data?.shared_media?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {chatDetailQuery.data.shared_media.slice(0, 9).map((item) => (
                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-zinc-900">
                      {item.url.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                        <video src={item.url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-gray-50 p-3 text-sm font-bold text-gray-400 dark:bg-zinc-900">{t('messages.media_empty')}</p>
              )}
            </section>
            <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-zinc-800">
              <Button variant="danger" onClick={() => setDeleteConfirm(true)} loading={leaveChat.isPending}>
                <LogOut size={16} /> {t('messages.leave')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title={t('messages.leave_title')}
        description={t('messages.leave_desc')}
        confirmText={t('messages.leave_confirm')}
        onConfirm={() => leaveChat.mutate(undefined, {
          onSuccess: () => {
            setDeleteConfirm(false);
            setInfoOpen(false);
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete('chat');
              return next;
            }, { replace: true });
          },
        })}
      />
    </div>
  );
}

function findRepliedMessage(items: Array<{ id: string; text: string; sender: { display_name: string } }>, id?: string) {
  if (!id) return null;
  const message = items.find((item) => item.id === id);
  return message ? { id: message.id, text: message.text, sender: message.sender.display_name } : null;
}

function ChatListItem({
  chat,
  active,
  lang,
  titleFallback,
  emptyLabel,
  typingLabel,
  onSelect,
}: {
  chat: Chat;
  active: boolean;
  lang: string;
  titleFallback: string;
  emptyLabel: string;
  typingLabel: string;
  onSelect: () => void;
}) {
  const peer = chat.members[0];
  const title = getChatTitle(chat, titleFallback);
  const latest = typingLabel || chat.latest_message?.text || emptyLabel;
  return (
    <button type="button" onClick={onSelect} className="messages-chat-row" data-active={active} data-unread={Boolean(chat.unread_count)}>
      <Avatar src={chat.avatar_url || peer?.avatar_url} name={title} className="messages-chat-row-avatar" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="messages-chat-row-title">{title}</span>
          {typingLabel ? <span className="messages-typing-dot" aria-hidden="true" /> : null}
          <span className="messages-chat-row-time">{formatChatTime(chat.latest_message?.created_at, lang)}</span>
        </span>
        <span className={`messages-chat-row-preview ${typingLabel ? 'is-typing' : ''}`}>{latest}</span>
      </span>
      {chat.unread_count ? (
        <span className="messages-chat-row-badge motion-pop" data-active="true">
          <AnimatedNumber value={chat.unread_count > 9 ? '9+' : chat.unread_count} />
        </span>
      ) : null}
    </button>
  );
}

function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl px-2 py-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageThreadSkeleton() {
  return (
    <div className="messages-thread">
      <Skeleton className="mx-auto h-7 w-32 rounded-full" />
      <Skeleton className="h-11 w-60 rounded-2xl" />
      <Skeleton className="ml-auto h-11 w-52 rounded-2xl" />
      <Skeleton className="h-28 w-72 rounded-2xl" />
      <Skeleton className="ml-auto h-11 w-64 rounded-2xl" />
      <Skeleton className="h-11 w-56 rounded-2xl" />
    </div>
  );
}

function CompactEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="messages-compact-empty">
      <span className="messages-compact-empty-icon"><MessageSquare size={22} /></span>
      <p>{title}</p>
      {description ? <span>{description}</span> : null}
    </div>
  );
}

function getChatTitle(chat: Chat, fallback: string) {
  return chat.title || chat.members[0]?.display_name || fallback;
}

function formatChatTime(value: string | undefined, lang: string) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const locale = lang === 'en' ? 'en-US' : 'ru-RU';
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    if (lang === 'en') return 'Yesterday';
    if (lang === 'uz') return 'Kecha';
    return 'Вчера';
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function groupMessages<T extends { created_at: string }>(items: T[], lang: string) {
  const groups: Array<{ date: string; items: T[] }> = [];
  for (const item of items) {
    const date = new Date(item.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long' });
    const last = groups[groups.length - 1];
    if (last?.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}
