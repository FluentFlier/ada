/**
 * Tests for insforge service layer error types and utilities.
 *
 * Tests the exported error classes and their behavior.
 * Database/storage/auth functions are tested indirectly through
 * store tests since they require complex SDK mocking.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the SDK (must come before importing the service)
vi.mock('@insforge/sdk', () => ({
  createClient: vi.fn(() => ({
    database: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
      })),
    },
    functions: {
      invoke: vi.fn(),
    },
    realtime: {
      connect: vi.fn(() => Promise.resolve()),
      subscribe: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      unsubscribe: vi.fn(),
    },
    getHttpClient: vi.fn(() => ({
      setAuthToken: vi.fn(),
    })),
  })),
}));

// Mock SecureStore
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

// Mock config
vi.mock('@/constants/config', () => ({
  CONFIG: {
    insforge: {
      url: 'https://test.insforge.app',
      anonKey: 'test-anon-key',
    },
  },
}));

import {
  AuthError,
  DatabaseError,
  StorageError,
  FunctionError,
} from '@/services/insforge';

describe('insforge service error types', () => {
  describe('AuthError', () => {
    it('has correct name and message', () => {
      const err = new AuthError('auth failed');
      expect(err.name).toBe('AuthError');
      expect(err.message).toBe('auth failed');
      expect(err).toBeInstanceOf(Error);
    });

    it('preserves cause', () => {
      const cause = { code: 401 };
      const err = new AuthError('unauthorized', cause);
      expect(err.cause).toBe(cause);
    });

    it('has a stack trace', () => {
      const err = new AuthError('test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AuthError');
    });
  });

  describe('DatabaseError', () => {
    it('has correct name and message', () => {
      const err = new DatabaseError('query failed');
      expect(err.name).toBe('DatabaseError');
      expect(err.message).toBe('query failed');
    });

    it('preserves SDK error as cause', () => {
      const sdkError = { message: 'row not found', code: 'PGRST116' };
      const err = new DatabaseError('Failed to fetch', sdkError);
      expect(err.cause).toEqual(sdkError);
    });

    it('works without cause', () => {
      const err = new DatabaseError('no data');
      expect(err.cause).toBeUndefined();
    });
  });

  describe('StorageError', () => {
    it('has correct name and message', () => {
      const err = new StorageError('upload failed');
      expect(err.name).toBe('StorageError');
      expect(err.message).toBe('upload failed');
    });

    it('preserves cause', () => {
      const cause = { statusCode: 413 };
      const err = new StorageError('too large', cause);
      expect(err.cause).toEqual(cause);
    });
  });

  describe('FunctionError', () => {
    it('has correct name and message', () => {
      const err = new FunctionError('function timeout');
      expect(err.name).toBe('FunctionError');
      expect(err.message).toBe('function timeout');
    });
  });

  describe('error hierarchy', () => {
    it('all error types extend Error', () => {
      const errors = [
        new AuthError('a'),
        new DatabaseError('b'),
        new StorageError('c'),
        new FunctionError('d'),
      ];

      for (const err of errors) {
        expect(err).toBeInstanceOf(Error);
        expect(err.stack).toBeDefined();
      }
    });

    it('errors are distinguishable by name', () => {
      const auth = new AuthError('x');
      const db = new DatabaseError('x');
      const storage = new StorageError('x');
      const fn = new FunctionError('x');

      const names = new Set([auth.name, db.name, storage.name, fn.name]);
      expect(names.size).toBe(4);
    });

    it('errors can be caught by type using instanceof', () => {
      const errors = [
        new AuthError('a'),
        new DatabaseError('b'),
        new StorageError('c'),
        new FunctionError('d'),
      ];

      // All are Error instances
      expect(errors.every((e) => e instanceof Error)).toBe(true);

      // But they have distinct names
      expect(errors[0].name).toBe('AuthError');
      expect(errors[1].name).toBe('DatabaseError');
      expect(errors[2].name).toBe('StorageError');
      expect(errors[3].name).toBe('FunctionError');
    });

    it('errors with same message are distinguishable', () => {
      const auth = new AuthError('something went wrong');
      const db = new DatabaseError('something went wrong');

      expect(auth.name).not.toBe(db.name);
      expect(auth.message).toBe(db.message);
    });
  });
});
