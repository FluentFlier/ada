/**
 * Auth state — Zustand store.
 *
 * Uses InsForge auth SDK:
 * - signUp() → signInWithPassword() → signOut()
 * - getCurrentSession() to restore session on app launch
 */

import { create } from 'zustand';
import {
  signUp as apiSignUp,
  signIn as apiSignIn,
  signOut as apiSignOut,
  getCurrentUser,
  AuthError,
} from '@/services/insforge';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  needsEmailVerification: boolean;
  pendingEmail: string | null;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function extractUser(data: unknown): User | null {
  const obj = data as { user?: { id?: string; email?: string } };
  if (obj?.user?.id && obj?.user?.email) {
    return { id: obj.user.id, email: obj.user.email };
  }
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,
  needsEmailVerification: false,
  pendingEmail: null,

  initialize: async () => {
    if (get().initialized) return;

    try {
      set({ loading: true });
      const user = await getCurrentUser();
      set({
        user: user ? { id: user.id, email: user.email } : null,
        initialized: true,
        loading: false,
      });
    } catch {
      set({ initialized: true, loading: false, user: null });
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiSignUp(email, password);
      const result = data as {
        requireEmailVerification?: boolean;
        user?: { id?: string; email?: string };
        accessToken?: string | null;
      };

      if (result?.requireEmailVerification) {
        set({
          needsEmailVerification: true,
          pendingEmail: email,
          loading: false,
        });
        return;
      }

      const user = extractUser(data);
      set({ user, loading: false });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'Sign up failed. Please try again.';
      set({ error: message, loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiSignIn(email, password);
      const user = extractUser(data);
      set({ user, loading: false, needsEmailVerification: false });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'Sign in failed. Check your credentials.';
      set({ error: message, loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await apiSignOut();
      set({ user: null, loading: false });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'Sign out failed.';
      set({ error: message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
