import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiWsBase } from '../../shared/api/client';
import { useAuthStore } from '../../store/authStore';

type Notification = { id: string; type: string; data: Record<string, unknown>; is_read: boolean; created_at: string };

function patchIsRead(list: Notification[] | undefined, id: string, isRead: boolean): Notification[] {
  if (!list) return list;
  return list.map((item) => item.id === id ? { ...item, is_read: isRead } : item);
}

function markAllRead(list: Notification[] | undefined): Notification[] {
  if (!list) return list;
  return list.map((item) => item.is_read ? item : { ...item, is_read: true });
}

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, enabled: Boolean(user), refetchInterval: 30_000 });
  const read = useMutation({
    mutationFn: (id: string) => api.readNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications']);
      queryClient.setQueryData<Notification[]>(['notifications'], (current) => patchIsRead(current, id, true));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: api.readAllNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications']);
      queryClient.setQueryData<Notification[]>(['notifications'], (current) => markAllRead(current));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !user) return;
    const socket = new WebSocket(`${apiWsBase()}/api/ws/notifications?token=${encodeURIComponent(token)}`);
    socket.onmessage = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
    return () => socket.close();
  }, [queryClient, user]);

  return { query, read, readAll };
}
