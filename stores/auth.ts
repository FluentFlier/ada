/**
 * Auth state — Zustand store.
 *
 * Auth functions use direct REST calls (not the SDK's browser-dependent
 * auth module). Token is stored in SecureStore and set on the SDK client.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  signUp as apiSignUp,
  signIn as apiSignIn,
  signOut as apiSignOut,
  getCurrentUser,
  verifyEmail as apiVerifyEmail,
  resendVerificationEmail as apiResend,
  disconnectRealtime,
  AuthError,
} from '@/services/insforge';

const SETUP_KEY = 'ada_setup_completed';

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
  hasCompletedSetup: boolean;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
  completeSetup: () => Promise<void>;
  clearError: () => void;
  resetVerification: () => void;
}

function extractUser(data: unknown): User | null {
  // Direct user object (from getCurrentUser / profile endpoint)
  const direct = data as { id?: string; email?: string };
  if (direct?.id && direct?.email) {
    return { id: direct.id, email: direct.email };
  }

  // Nested user object (from signIn/signUp/verifyEmail)
  const nested = data as { user?: { id?: string; email?: string } };
  if (nested?.user?.id && nested?.user?.email) {
    return { id: nested.user.id, email: nested.user.email };
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
  hasCompletedSetup: false,

  initialize: async () => {
    if (get().initialized) return;

    try {
      set({ loading: true });
      const [user, setupDone] = await Promise.all([
        getCurrentUser(),
        SecureStore.getItemAsync(SETUP_KEY),
      ]);
      set({
        user: user ? { id: user.id, email: user.email } : null,
        hasCompletedSetup: setupDone === 'true',
        initialized: true,
        loading: false,
      });
    } catch (err: unknown) {
      console.warn('Auth initialization failed:', err);
      set({ initialized: true, loading: false, user: null });
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiSignUp(email, password);

      if (data.requireEmailVerification) {
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

  verifyEmail: async (code: string) => {
    const email = get().pendingEmail;
    if (!email) {
      set({ error: 'No pending email to verify.' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await apiVerifyEmail(email, code);
      const user = extractUser(data);
      set({
        user,
        loading: false,
        needsEmailVerification: false,
        pendingEmail: null,
      });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'Invalid code. Please try again.';
      set({ error: message, loading: false });
    }
  },

  resendCode: async () => {
    const email = get().pendingEmail;
    if (!email) return;

    set({ loading: true, error: null });
    try {
      await apiResend(email);
      set({ loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'Failed to resend code.';
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

      // If email not verified, redirect to verification flow
      if (message.toLowerCase().includes('verification required')) {
        set({
          needsEmailVerification: true,
          pendingEmail: email,
          loading: false,
          error: null,
        });
        return;
      }

      set({ error: message, loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      disconnectRealtime();
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

  completeSetup: async () => {
    await SecureStore.setItemAsync(SETUP_KEY, 'true');
    set({ hasCompletedSetup: true });
  },

  clearError: () => set({ error: null }),

  resetVerification: () =>
    set({
      needsEmailVerification: false,
      pendingEmail: null,
      error: null,
    }),
}));
