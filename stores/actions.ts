/**
 * Actions state — Zustand store for user actions across all items.
 */

import { create } from 'zustand';
import {
  getActionsForUser,
  updateActionStatus,
  DatabaseError,
} from '@/services/insforge';
import { executeAction } from '@/services/actions';
import type { Action, ActionStatus } from '@/types/action';
import type { Item } from '@/types/item';

export type ActionWithItem = Action & { item?: Item };

interface ActionsState {
  actions: ActionWithItem[];
  loading: boolean;
  error: string | null;

  fetchActions: (userId: string) => Promise<void>;
  executeAndUpdate: (action: Action) => Promise<void>;
  dismissAction: (actionId: string) => Promise<void>;

  // Derived
  getPending: () => ActionWithItem[];
  getCompleted: () => ActionWithItem[];
  getForItem: (itemId: string) => ActionWithItem[];
}

export const useActionsStore = create<ActionsState>((set, get) => ({
  actions: [],
  loading: false,
  error: null,

  fetchActions: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const actions = await getActionsForUser(userId);
      set({ actions, loading: false });
    } catch (err) {
      const message =
        err instanceof DatabaseError
          ? err.message
          : 'Failed to load actions.';
      set({ error: message, loading: false });
    }
  },

  executeAndUpdate: async (action: Action) => {
    const prev = get().actions;

    // Optimistic: mark as completed
    set((state) => ({
      actions: state.actions.map((a) =>
        a.id === action.id
          ? { ...a, status: 'completed' as ActionStatus }
          : a,
      ),
    }));

    try {
      await executeAction(action);
    } catch (err) {
      console.error('Execute action failed, rolling back:', err);
      set({ actions: prev });
      throw err;
    }
  },

  dismissAction: async (actionId: string) => {
    const prev = get().actions;

    // Optimistic: mark as dismissed
    set((state) => ({
      actions: state.actions.map((a) =>
        a.id === actionId
          ? { ...a, status: 'dismissed' as ActionStatus }
          : a,
      ),
    }));

    try {
      await updateActionStatus(actionId, 'dismissed');
    } catch (err) {
      console.error('Dismiss failed, rolling back:', err);
      set({ actions: prev });
    }
  },

  getPending: () => {
    return get().actions.filter(
      (a) => a.status === 'suggested' || a.status === 'approved',
    );
  },

  getCompleted: () => {
    return get().actions.filter(
      (a) => a.status === 'completed',
    );
  },

  getForItem: (itemId: string) => {
    return get().actions.filter(
      (a) => a.item_id === itemId && a.status !== 'dismissed',
    );
  },
}));
