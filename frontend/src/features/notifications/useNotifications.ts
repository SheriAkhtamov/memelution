import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiWsBase } from '../../shared/api/client';
import { useAuthStore } from '../../store/authStore';

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, enabled: Boolean(user), refetchInterval: 30_000 });
  const read = useMutation({ mutationFn: (id: string) => api.readNotification(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: api.readAllNotifications, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !user) return;
    const socket = new WebSocket(`${apiWsBase()}/api/ws/notifications?token=${encodeURIComponent(token)}`);
    socket.onmessage = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
    return () => socket.close();
  }, [queryClient, user]);

  return { query, read, readAll };
}
