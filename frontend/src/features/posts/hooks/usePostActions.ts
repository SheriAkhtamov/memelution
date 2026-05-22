import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { redirectToLogin } from '../../../utils/authRedirect';

export function usePostActions(postId: string) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const requireAuth = () => {
    if (!user) {
      redirectToLogin();
      return false;
    }
    return true;
  };
  const invalidatePost = () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['post', postId] });
  };
  return { user, requireAuth, invalidatePost };
}
