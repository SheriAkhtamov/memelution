import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { trackEvent } from '../../shared/lib/analytics';
import { useToast } from '../../shared/ui';

export function useCommunity(slug: string, tab: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['community', slug, tab], queryFn: () => api.community(slug, tab), enabled: Boolean(slug) });
  const join = useMutation({
    mutationFn: () => api.joinCommunity(slug, query.data?.membership === 'active'),
    onSuccess: (result) => {
      if (result.membership === 'active') {
        trackEvent('community_joined', {
          slug,
          community_id: query.data?.community.id,
          source: 'community_header',
        });
      } else {
        toast.show({
          title: 'Вы вышли из сообщества',
          tone: 'success',
          duration: 5000,
          action: {
            label: 'Отменить',
            onClick: () => {
              api.joinCommunity(slug, false).then(() => {
                queryClient.invalidateQueries({ queryKey: ['community', slug] });
                toast.show({ title: 'Возвращены в сообщество', tone: 'success' });
              }).catch(() => {
                toast.show({ title: 'Не удалось вернуться', tone: 'error' });
              });
            },
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
    },
  });
  const members = useQuery({ queryKey: ['community-members', slug], queryFn: () => api.communityMembers(slug), enabled: Boolean(slug && tab === 'members') });
  const requests = useQuery({ queryKey: ['community-requests', slug], queryFn: () => api.communityRequests(slug), enabled: Boolean(slug && tab === 'manage') });
  return { query, join, members, requests };
}
