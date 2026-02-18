/**
 * Tests for auth Zustand store.
 *
 * Mocks the insforge service to test state transitions in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { AuthError } from '@/services/insforge';

// Mock expo-secure-store
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

// Mock the entire insforge service module
vi.mock('@/services/insforge', () => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
  disconnectRealtime: vi.fn(),
  AuthError: class AuthError extends Error {
    cause: unknown;
    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = 'AuthError';
      this.cause = cause;
    }
  },
}));

// Import the mocked functions for test control
import {
  signUp as mockSignUp,
  signIn as mockSignIn,
  signOut as mockSignOut,
  getCurrentUser as mockGetCurrentUser,
  verifyEmail as mockVerifyEmail,
  resendVerificationEmail as mockResend,
} from '@/services/insforge';

function resetStore() {
  useAuthStore.setState({
    user: null,
    loading: false,
    error: null,
    initialized: false,
    needsEmailVerification: false,
    pendingEmail: null,
    hasCompletedSetup: false,
  });
}

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('initial state', () => {
    it('starts with no user and not initialized', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.initialized).toBe(false);
      expect(state.needsEmailVerification).toBe(false);
      expect(state.pendingEmail).toBeNull();
    });
  });

  describe('initialize', () => {
    it('sets user when session exists', async () => {
      vi.mocked(mockGetCurrentUser).mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
      } as Awaited<ReturnType<typeof mockGetCurrentUser>>);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: 'u1', email: 'test@example.com' });
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('sets user to null when no session', async () => {
      vi.mocked(mockGetCurrentUser).mockResolvedValue(null);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.initialized).toBe(true);
    });

    it('handles error gracefully', async () => {
      vi.mocked(mockGetCurrentUser).mockRejectedValue(
        new Error('Network error'),
      );

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('skips if already initialized', async () => {
      useAuthStore.setState({ initialized: true });
      await useAuthStore.getState().initialize();
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('transitions to email verification when required', async () => {
      vi.mocked(mockSignUp).mockResolvedValue({
        requireEmailVerification: true,
        accessToken: null,
      } as Awaited<ReturnType<typeof mockSignUp>>);

      await useAuthStore.getState().signUp('a@b.com', 'pass123');

      const state = useAuthStore.getState();
      expect(state.needsEmailVerification).toBe(true);
      expect(state.pendingEmail).toBe('a@b.com');
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('sets user directly when no verification needed', async () => {
      vi.mocked(mockSignUp).mockResolvedValue({
        accessToken: 'tok',
        user: { id: 'u2', email: 'b@c.com' },
      } as Awaited<ReturnType<typeof mockSignUp>>);

      await useAuthStore.getState().signUp('b@c.com', 'pass123');

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: 'u2', email: 'b@c.com' });
      expect(state.needsEmailVerification).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('sets AuthError message on auth failure', async () => {
      vi.mocked(mockSignUp).mockRejectedValue(
        new AuthError('Email already registered'),
      );

      await useAuthStore.getState().signUp('a@b.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Email already registered');
      expect(state.loading).toBe(false);
    });

    it('sets generic message on unknown error', async () => {
      vi.mocked(mockSignUp).mockRejectedValue(new Error('boom'));

      await useAuthStore.getState().signUp('a@b.com', 'pass');

      expect(useAuthStore.getState().error).toBe(
        'Sign up failed. Please try again.',
      );
    });
  });

  describe('signIn', () => {
    it('sets user on successful sign in', async () => {
      vi.mocked(mockSignIn).mockResolvedValue({
        user: { id: 'u3', email: 'c@d.com' },
      } as Awaited<ReturnType<typeof mockSignIn>>);

      await useAuthStore.getState().signIn('c@d.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: 'u3', email: 'c@d.com' });
      expect(state.needsEmailVerification).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(mockSignIn).mockRejectedValue(
        new AuthError('Invalid credentials'),
      );

      await useAuthStore.getState().signIn('a@b.com', 'wrong');

      expect(useAuthStore.getState().error).toBe('Invalid credentials');
    });
  });

  describe('verifyEmail', () => {
    it('sets user after successful verification', async () => {
      useAuthStore.setState({
        pendingEmail: 'a@b.com',
        needsEmailVerification: true,
      });

      vi.mocked(mockVerifyEmail).mockResolvedValue({
        user: { id: 'u4', email: 'a@b.com' },
      } as Awaited<ReturnType<typeof mockVerifyEmail>>);

      await useAuthStore.getState().verifyEmail('123456');

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: 'u4', email: 'a@b.com' });
      expect(state.needsEmailVerification).toBe(false);
      expect(state.pendingEmail).toBeNull();
    });

    it('sets error when no pending email', async () => {
      await useAuthStore.getState().verifyEmail('123456');
      expect(useAuthStore.getState().error).toBe(
        'No pending email to verify.',
      );
      expect(mockVerifyEmail).not.toHaveBeenCalled();
    });

    it('sets error on invalid code', async () => {
      useAuthStore.setState({ pendingEmail: 'a@b.com' });

      vi.mocked(mockVerifyEmail).mockRejectedValue(
        new AuthError('Invalid OTP'),
      );

      await useAuthStore.getState().verifyEmail('000000');

      expect(useAuthStore.getState().error).toBe('Invalid OTP');
    });
  });

  describe('resendCode', () => {
    it('calls resend with pending email', async () => {
      useAuthStore.setState({ pendingEmail: 'a@b.com' });

      vi.mocked(mockResend).mockResolvedValue({
        success: true,
        message: 'sent',
      });

      await useAuthStore.getState().resendCode();

      expect(mockResend).toHaveBeenCalledWith('a@b.com');
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('does nothing when no pending email', async () => {
      await useAuthStore.getState().resendCode();
      expect(mockResend).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('clears user on success', async () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'a@b.com' },
      });

      vi.mocked(mockSignOut).mockResolvedValue(undefined);

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('sets error on failure', async () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'a@b.com' },
      });

      vi.mocked(mockSignOut).mockRejectedValue(
        new AuthError('Session expired'),
      );

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().error).toBe('Session expired');
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      useAuthStore.setState({ error: 'something went wrong' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('resetVerification', () => {
    it('resets verification state', () => {
      useAuthStore.setState({
        needsEmailVerification: true,
        pendingEmail: 'a@b.com',
        error: 'some error',
      });

      useAuthStore.getState().resetVerification();

      const state = useAuthStore.getState();
      expect(state.needsEmailVerification).toBe(false);
      expect(state.pendingEmail).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
