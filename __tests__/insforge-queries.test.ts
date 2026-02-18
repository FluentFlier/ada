/**
 * Tests for InsForge service layer — new query functions.
 * Tests toggleStar, updateUserNote, getActionsForUser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factory runs
const {
  mockDatabase,
  mockSelect,
  mockEq,
  mockOrder,
  mockUpdate,
  mockInsert,
  mockSingle,
  mockLimit,
} = vi.hoisted(() => ({
  mockDatabase: { from: vi.fn() },
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockSingle: vi.fn(),
  mockLimit: vi.fn(),
}));

function setupChain(finalResult: {
  data: unknown;
  error: unknown;
}) {
  // mockSelect must be both chainable (for mid-chain use) and
  // thenable (for end-of-chain await after update/insert).
  mockSelect.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    limit: mockLimit,
    then: (resolve: (v: unknown) => void) =>
      resolve(finalResult),
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    select: mockSelect,
    order: mockOrder,
    single: mockSingle,
    then: (resolve: (v: unknown) => void) =>
      resolve(finalResult),
  });
  mockOrder.mockReturnValue({
    eq: mockEq,
    limit: mockLimit,
    then: (resolve: (v: unknown) => void) =>
      resolve(finalResult),
  });
  mockUpdate.mockReturnValue({
    eq: mockEq,
    select: mockSelect,
  });
  mockInsert.mockReturnValue({
    select: mockSelect,
  });
  mockSingle.mockResolvedValue(finalResult);
  mockLimit.mockResolvedValue(finalResult);

  mockDatabase.from.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    delete: vi.fn().mockReturnValue({ eq: mockEq }),
    eq: mockEq,
  });
}

vi.mock('@insforge/sdk', () => ({
  createClient: () => ({
    database: mockDatabase,
    getHttpClient: () => ({ setAuthToken: vi.fn() }),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
    realtime: {
      connect: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      unsubscribe: vi.fn(),
    },
  }),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import {
  toggleStar,
  updateUserNote,
  getActionsForUser,
} from '@/services/insforge';

describe('insforge service - new queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleStar', () => {
    it('calls update with is_starred and returns item', async () => {
      const mockItem = { id: 'i1', is_starred: true };
      setupChain({ data: [mockItem], error: null });

      const result = await toggleStar('i1', true);
      expect(result).toEqual(mockItem);
      expect(mockDatabase.from).toHaveBeenCalledWith('items');
    });

    it('throws DatabaseError on failure', async () => {
      setupChain({
        data: null,
        error: { message: 'db error' },
      });

      await expect(toggleStar('i1', false)).rejects.toThrow(
        'Failed to toggle star',
      );
    });

    it('throws when update returns empty data', async () => {
      setupChain({ data: [], error: null });

      await expect(toggleStar('i1', true)).rejects.toThrow(
        'Toggle star returned no data',
      );
    });
  });

  describe('updateUserNote', () => {
    it('calls update with user_note and returns item', async () => {
      const mockItem = { id: 'i1', user_note: 'my note' };
      setupChain({ data: [mockItem], error: null });

      const result = await updateUserNote('i1', 'my note');
      expect(result).toEqual(mockItem);
    });

    it('handles null note (clearing)', async () => {
      const mockItem = { id: 'i1', user_note: null };
      setupChain({ data: [mockItem], error: null });

      const result = await updateUserNote('i1', null);
      expect(result).toEqual(mockItem);
    });

    it('throws DatabaseError on failure', async () => {
      setupChain({
        data: null,
        error: { message: 'db error' },
      });

      await expect(
        updateUserNote('i1', 'test'),
      ).rejects.toThrow('Failed to update note');
    });
  });

  describe('getActionsForUser', () => {
    it('fetches actions for a user with join', async () => {
      const mockActions = [
        { id: 'a1', user_id: 'u1', item: { id: 'i1' } },
      ];
      setupChain({ data: mockActions, error: null });

      const result = await getActionsForUser('u1');
      expect(result).toEqual(mockActions);
      expect(mockDatabase.from).toHaveBeenCalledWith('actions');
    });

    it('filters by status when provided', async () => {
      setupChain({ data: [], error: null });

      await getActionsForUser('u1', { status: 'suggested' });
      expect(mockDatabase.from).toHaveBeenCalledWith('actions');
    });

    it('throws DatabaseError on failure', async () => {
      setupChain({
        data: null,
        error: { message: 'db error' },
      });

      await expect(
        getActionsForUser('u1'),
      ).rejects.toThrow('Failed to fetch user actions');
    });
  });
});
