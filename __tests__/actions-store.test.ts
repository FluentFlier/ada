/**
 * Tests for actions Zustand store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useActionsStore } from '@/stores/actions';
import type { Action } from '@/types/action';

vi.mock('@/services/insforge', () => ({
  getActionsForUser: vi.fn(),
  updateActionStatus: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    cause: unknown;
    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = 'DatabaseError';
      this.cause = cause;
    }
  },
}));

vi.mock('@/services/actions', () => ({
  executeAction: vi.fn(),
  ActionError: class ActionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ActionError';
    }
  },
}));

import {
  getActionsForUser as mockGetActions,
  updateActionStatus as mockUpdateStatus,
} from '@/services/insforge';

import { executeAction as mockExecute } from '@/services/actions';

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'act-1',
    user_id: 'u1',
    item_id: 'item-1',
    type: 'add_to_calendar',
    status: 'suggested',
    action_data: { label: 'Test action' },
    result: null,
    created_at: '2026-02-18T00:00:00Z',
    completed_at: null,
    ...overrides,
  };
}

function resetStore() {
  useActionsStore.setState({
    actions: [],
    loading: false,
    error: null,
  });
}

describe('actions store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('fetchActions', () => {
    it('loads actions into state', async () => {
      const actions = [
        makeAction({ id: 'a1' }),
        makeAction({ id: 'a2' }),
      ];
      vi.mocked(mockGetActions).mockResolvedValue(actions);

      await useActionsStore.getState().fetchActions('u1');

      const state = useActionsStore.getState();
      expect(state.actions).toEqual(actions);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(mockGetActions).mockRejectedValue(
        new Error('db down'),
      );

      await useActionsStore.getState().fetchActions('u1');

      const state = useActionsStore.getState();
      expect(state.actions).toEqual([]);
      expect(state.error).toBe('Failed to load actions.');
      expect(state.loading).toBe(false);
    });
  });

  describe('executeAndUpdate', () => {
    it('optimistically marks action as completed', async () => {
      const action = makeAction({ id: 'e1', status: 'suggested' });
      useActionsStore.setState({ actions: [action] });

      vi.mocked(mockExecute).mockResolvedValue({});

      await useActionsStore.getState().executeAndUpdate(action);

      expect(
        useActionsStore.getState().actions[0].status,
      ).toBe('completed');
    });

    it('rolls back on execution failure', async () => {
      const action = makeAction({ id: 'e1', status: 'suggested' });
      useActionsStore.setState({ actions: [action] });

      vi.mocked(mockExecute).mockRejectedValue(
        new Error('failed'),
      );

      await expect(
        useActionsStore.getState().executeAndUpdate(action),
      ).rejects.toThrow('failed');

      expect(
        useActionsStore.getState().actions[0].status,
      ).toBe('suggested');
    });
  });

  describe('dismissAction', () => {
    it('optimistically marks action as dismissed', async () => {
      const action = makeAction({ id: 'd1', status: 'suggested' });
      useActionsStore.setState({ actions: [action] });

      vi.mocked(mockUpdateStatus).mockResolvedValue(undefined);

      await useActionsStore.getState().dismissAction('d1');

      expect(
        useActionsStore.getState().actions[0].status,
      ).toBe('dismissed');
    });

    it('rolls back on API failure', async () => {
      const action = makeAction({ id: 'd1', status: 'suggested' });
      useActionsStore.setState({ actions: [action] });

      vi.mocked(mockUpdateStatus).mockRejectedValue(
        new Error('fail'),
      );

      await useActionsStore.getState().dismissAction('d1');

      expect(
        useActionsStore.getState().actions[0].status,
      ).toBe('suggested');
    });
  });

  describe('derived selectors', () => {
    const actions = [
      makeAction({ id: '1', status: 'suggested', item_id: 'i1' }),
      makeAction({ id: '2', status: 'completed', item_id: 'i1' }),
      makeAction({ id: '3', status: 'dismissed', item_id: 'i2' }),
      makeAction({ id: '4', status: 'approved', item_id: 'i2' }),
    ];

    beforeEach(() => {
      useActionsStore.setState({ actions });
    });

    describe('getPending', () => {
      it('returns suggested and approved actions', () => {
        const pending = useActionsStore.getState().getPending();
        expect(pending).toHaveLength(2);
        expect(pending.map((a) => a.id)).toEqual(['1', '4']);
      });
    });

    describe('getCompleted', () => {
      it('returns only completed actions', () => {
        const completed = useActionsStore.getState().getCompleted();
        expect(completed).toHaveLength(1);
        expect(completed[0].id).toBe('2');
      });
    });

    describe('getForItem', () => {
      it('returns non-dismissed actions for item', () => {
        const forI1 = useActionsStore.getState().getForItem('i1');
        expect(forI1).toHaveLength(2);
      });

      it('excludes dismissed actions', () => {
        const forI2 = useActionsStore.getState().getForItem('i2');
        expect(forI2).toHaveLength(1);
        expect(forI2[0].id).toBe('4');
      });

      it('returns empty for unknown item', () => {
        const result = useActionsStore
          .getState()
          .getForItem('unknown');
        expect(result).toEqual([]);
      });
    });
  });
});
