import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiWsBase } from '../../shared/api/client';
import { useAuthStore } from '../../store/authStore';
import type { Message } from '../../shared/types';

type OptimisticMessage = Message & { tempId: string; status: 'pending' | 'failed' };

export function useMessages(initialChat = '') {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const [active, setActive] = useState(initialChat);
  const [typingMap, setTypingMap] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const typing = typingMap[active] || '';

  const chatsQuery = useQuery({ queryKey: ['chats'], queryFn: api.chats, enabled: Boolean(user), refetchInterval: 20_000 });
  const activeChat = useMemo(() => chatsQuery.data?.find((chat) => chat.id === active), [active, chatsQuery.data]);
  const messagesQuery = useQuery({ queryKey: ['messages', active], queryFn: () => api.messages(active), enabled: Boolean(user && active) });
  const chatDetailQuery = useQuery({ queryKey: ['chatDetail', active], queryFn: () => api.chatDetail(active), enabled: Boolean(user && active) });

  useEffect(() => {
    if (initialChat) setActive(initialChat);
  }, [initialChat]);

  useEffect(() => {
    if (!active && chatsQuery.data?.[0]) setActive(chatsQuery.data[0].id);
  }, [active, chatsQuery.data]);

  useEffect(() => {
    if (!active) return;
    api.readChat(active).then(() => queryClient.invalidateQueries({ queryKey: ['chats'] }));
  }, [active, queryClient]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !user) return;
    const socket = new WebSocket(`${apiWsBase()}/api/ws/chats?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'chat_message' || data.event === 'message_deleted' || data.event === 'message_edited' || data.event === 'read_receipt') {
          queryClient.invalidateQueries({ queryKey: ['messages', data.chat_id] });
          queryClient.invalidateQueries({ queryKey: ['chats'] });
        }
        if (data.event === 'chat_deleted' || data.event === 'chat_member_left') {
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          if (data.chat_id === active) setActive('');
        }
        if (data.event === 'typing' && data.chat_id) {
          const name = data.user?.display_name || 'Typing';
          const chatId = data.chat_id;
          setTypingMap((prev) => ({ ...prev, [chatId]: name }));
          window.setTimeout(() => setTypingMap((prev) => {
            const next = { ...prev };
            if (next[chatId] === name) delete next[chatId];
            return next;
          }), 2200);
        }
      } catch {
        // Ignore malformed socket payloads.
      }
    };
    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [active, queryClient, user]);

  const create = useMutation({
    mutationFn: (username: string) => api.createChat(username),
    onSuccess: (chat) => {
      setActive(chat.id);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['messages', chat.id] });
    },
  });
  const send = useMutation({
    mutationFn: (payload: { text?: string; shared_post_id?: string; media_url?: string; reply_to_message_id?: string }) =>
      api.sendMessage(active, payload.text || '', payload.shared_post_id, payload.media_url, payload.reply_to_message_id),
    onMutate: (payload) => {
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const msg: OptimisticMessage = {
        id: tempId,
        tempId,
        chat_id: active,
        sender: user!,
        text: payload.text || '',
        media_url: payload.media_url,
        shared_post_id: payload.shared_post_id,
        reply_to_message_id: payload.reply_to_message_id,
        is_deleted: false,
        created_at: new Date().toISOString(),
        edited_at: null,
        read_count: 0,
        status: 'pending',
      };
      setOptimistic((prev) => [...prev, msg]);
      return tempId;
    },
    onSuccess: (_data, _payload, tempId) => {
      setOptimistic((prev) => prev.filter((m) => m.tempId !== tempId));
      queryClient.invalidateQueries({ queryKey: ['messages', active] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setReplyTo(null);
    },
    onError: (_error, _payload, tempId) => {
      setOptimistic((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m)));
      queryClient.invalidateQueries({ queryKey: ['messages', active] });
    },
  });
  const editMessage = useMutation({
    mutationFn: (payload: { id: string; text: string }) => api.updateMessage(payload.id, payload.text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', active] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
  const deleteMessage = useMutation({
    mutationFn: (id: string) => api.deleteMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', active] }),
  });
  const leaveChat = useMutation({
    mutationFn: () => api.leaveChat(active),
    onSuccess: () => {
      setActive('');
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
  const forwardMessage = useMutation({
    mutationFn: (payload: { messageId: string; targetChatId: string }) =>
      api.forwardMessage(payload.messageId, payload.targetChatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', active] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
  const uploadAndSend = useMutation({
    mutationFn: async (file: File) => {
      const media = await api.uploadMedia(file);
      return api.sendMessage(active, '', undefined, media.url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', active] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const notifyTyping = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN && active) {
      socketRef.current.send(JSON.stringify({ event: 'typing', chat_id: active }));
    }
  };

  const removeOptimistic = (tempId: string) => setOptimistic((prev) => prev.filter((m) => m.tempId !== tempId));

  return { active, setActive, activeChat, chatsQuery, messagesQuery, chatDetailQuery, typing, typingMap, replyTo, setReplyTo, create, send, editMessage, deleteMessage, leaveChat, forwardMessage, uploadAndSend, notifyTyping, optimistic, removeOptimistic };
}
