import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Info, LogOut, MessageSquare, Plus, Search, Send, X } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, Skeleton, Tabs, useToast } from '../../shared/ui';
import { MessageBubble, MessageRepliedPreview } from '../../features/messages/MessageBubble';
import { useAuthStore } from '../../store/authStore';
import { useMessages } from '../../features/messages/useMessages';
import { hapticMedium } from '../../utils/haptic';
import { useTranslation } from '../../shared/i18n';

type ChatFolder = 'all' | 'unread' | 'groups';

export function MessagesPage() {
  const { user } = useAuthStore();
  const { t, lang } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const { active, setActive, activeChat, chatsQuery, messagesQuery, chatDetailQuery, typing, typingMap, replyTo, setReplyTo, create, send, editMessage, deleteMessage, leaveChat, forwardMessage, uploadAndSend, notifyTyping, optimistic, removeOptimistic } = useMessages(params.get('chat') || '');

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

  const selectChat = (chatId: string) => {
    setActive(chatId);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (chatId) next.set('chat', chatId);
      else next.delete('chat');
      return next;
    }, { replace: true });
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

  if (!user) return <div className="p-3 sm:p-4"><EmptyState title={t('common.required')} description={t('messages.login_required')} /></div>;

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#F3F4F6]/90 px-3 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-4">
        <h1 className="flex items-center gap-2 text-2xl font-black"><MessageSquare className="text-[#FF6B00]" /> {t('messages.title')}</h1>
      </header>
      <div className="p-3 sm:p-4">
        <section className="grid min-h-[680px] overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-[340px_1fr]">
          <aside className={`border-b border-gray-100 dark:border-zinc-800 lg:border-b-0 lg:border-r ${active ? 'hidden lg:block' : ''}`}>
            <div className="space-y-3 border-b border-gray-100 p-4 dark:border-zinc-800">
              <p className="font-black">{t('messages.chats')}</p>
              <div className="flex gap-2">
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@username" />
                <Button onClick={() => create.mutate(username.replace(/^@/, '').trim(), { onSuccess: () => setUsername('') })} loading={create.isPending} disabled={!username.trim()}><Plus size={16} /></Button>
              </div>
              <Tabs
                value={chatFolder}
                onChange={(value) => setChatFolder(value as ChatFolder)}
                items={[
                  { id: 'all', label: t('messages.filter_all') },
                  { id: 'unread', label: t('messages.filter_unread') },
                  { id: 'groups', label: t('messages.filter_conversations') },
                ]}
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('messages.search')}
                  className="pl-9 pr-9"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    aria-label={t('messages.search_clear')}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="max-h-[580px] overflow-y-auto">
              {chatsQuery.isLoading ? <Skeleton className="m-4 h-32" /> : filteredChats.length ? filteredChats.map((chat) => {
                const peer = chat.members[0];
                return (
                  <button key={chat.id} onClick={() => selectChat(chat.id)} className={`flex w-full gap-3 border-b border-gray-50 p-4 text-left hover:bg-gray-50 dark:border-zinc-900 dark:hover:bg-zinc-900 ${active === chat.id ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                    <Avatar src={chat.avatar_url || peer?.avatar_url} name={chat.title || peer?.display_name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-black">{chat.title || peer?.display_name || t('messages.chat_title')}</span>
                        {chat.unread_count ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{chat.unread_count}</span> : null}
                      </span>
                      <span className="block truncate text-sm text-gray-500">{typingMap[chat.id] ? <span className="font-bold text-[#2AABEE] animate-pulse">{typingMap[chat.id]} {t('messages.typing')}</span> : (chat.latest_message?.text || t('messages.empty_chat'))}</span>
                    </span>
                  </button>
                );
              }) : <EmptyState title={t('messages.empty_list')} description={t('messages.empty_list_desc')} emoji="💬" />}
            </div>
          </aside>
          <section className={`flex min-h-[680px] flex-col bg-[#F7F7F8] dark:bg-zinc-950 ${active ? '' : 'hidden lg:flex'}`}>
            {activeChat ? (
              <>
                <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <button onClick={() => selectChat('')} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 lg:hidden" aria-label={t('messages.back')}>
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar src={activeChat.avatar_url || activeChat.members[0]?.avatar_url} name={activeChat.title || activeChat.members[0]?.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{activeChat.title || activeChat.members[0]?.display_name || t('messages.chat_title')}</p>
                     <p className="truncate text-xs font-bold text-gray-400">{typing ? `${typing} ${t('messages.typing')}` : activeChat.members.map((member) => `@${member.username}`).join(', ') || t('messages.direct_chat')}</p>
                  </div>
                  <button onClick={() => setInfoOpen(true)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label={t('messages.info')}>
                    <Info size={18} />
                  </button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
                  {messagesQuery.isLoading ? <Skeleton className="h-64" /> : messagesQuery.isError ? <ErrorState description={t('messages.load_error')} onRetry={() => messagesQuery.refetch()} /> : (messagesQuery.data?.items.length || optimistic.length) ? (() => {
                    const allMessages = [...(messagesQuery.data?.items || []), ...optimistic.filter((m) => m.chat_id === active)];
                    return groupMessages(allMessages, lang).map((group) => (
                      <div key={group.date} className="contents">
                        <div className="sticky top-2 z-10 mx-auto w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-gray-400 shadow-sm dark:bg-zinc-900">{group.date}</div>
                        {group.items.map((message) => {
                          const isOptimistic = message.id.startsWith('optimistic-');
                          const allItems = allMessages;
                          const unreadCount = activeChat?.unread_count || 0;
                          const realCount = messagesQuery.data?.items.length || 0;
                          const globalIdx = allItems.indexOf(message);
                          const dividerIdx = realCount - unreadCount;
                          const showUnreadDivider = !isOptimistic && unreadCount > 0 && globalIdx === dividerIdx;

                          return (
                            <div key={message.id}>
                              {showUnreadDivider && (
                                <div id="unread-divider" className="my-3 flex items-center gap-3">
                                  <div className="h-px flex-1 bg-[#2AABEE]" />
                                  <span className="text-xs font-black text-[#2AABEE]">{unreadCount} {t('messages.unread')}</span>
                                  <div className="h-px flex-1 bg-[#2AABEE]" />
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
                                repliedMessage={findRepliedMessage(allItems, message.reply_to_message_id)}
                                onRetry={isOptimistic && 'status' in message && message.status === 'failed' ? () => {
                                  setText(message.text || '');
                                  removeOptimistic(message.id);
                                } : undefined}
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
                    ));
                  })() : <EmptyState title={t('messages.start')} description={t('messages.start_desc')} emoji="🧊" />}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <MessageRepliedPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />
                  <div className="flex gap-2 p-4">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900" title={t('messages.add_media')}>
                      <ImagePlus size={16} />
                      <input type="file" accept="image/*,video/mp4" className="hidden" onChange={(event) => event.target.files?.[0] && uploadAndSend.mutate(event.target.files[0])} />
                    </label>
                    <input
                      ref={inputRef}
                      value={text}
                      onChange={(event) => { setText(event.target.value); notifyTyping(); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          sendCurrentMessage();
                        }
                      }}
                      placeholder={t('messages.input_placeholder')}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2AABEE] focus:ring-2 focus:ring-blue-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-blue-950"
                    />
                    <Button onClick={sendCurrentMessage} loading={send.isPending} disabled={!text.trim()}><Send size={16} /></Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState title={t('messages.select_chat')} emoji="👈" />
              </div>
            )}
          </section>
        </section>
      </div>
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
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-900"
              >
                <Avatar src={chat.avatar_url || chat.members[0]?.avatar_url} name={chat.title || chat.members[0]?.display_name} />
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
                  <div key={member.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-zinc-900">
                    <Avatar src={member.avatar_url} name={member.display_name} />
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
                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-900">
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
