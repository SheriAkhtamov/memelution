import { create } from 'zustand';
import { api } from '../api';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoaded: boolean;
  adminLogin: (payload: { login: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (payload: Partial<User>) => Promise<User>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isLoaded: false,
  adminLogin: async (payload) => {
    const data = await api.adminLogin(payload);
    localStorage.setItem('auth_token', data.token);
    set({ user: data.user, token: data.token, isLoaded: true });
  },
  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Token may already be invalid; local logout should still complete.
    }
    localStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },
  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ isLoaded: true });
      return;
    }
    try {
      const user = await api.me();
      set({ user, token, isLoaded: true });
    } catch (e) {
      if ((e as { status?: number })?.status === 401) {
        set({ isLoaded: true, user: null, token: null });
        localStorage.removeItem('auth_token');
      } else {
        set({ isLoaded: true });
      }
    }
  },
  updateProfile: async (payload) => {
    const user = await api.updateMe(payload);
    set({ user });
    return user;
  },
  setUser: (user) => set({ user }),
}));
