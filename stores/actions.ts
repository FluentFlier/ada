/**
 * Actions state — Zustand store for user actions across all items.
 */

import { create } from 'zustand';
import {
  getActionsForUser,
  updateActionStatus,
  DatabaseError,
  DEFAULT_PAGE_LIMIT,
} from '@/services/insforge';
import { executeAction } from '@/services/actions';
import type { Action, ActionStatus } from '@/types/action';
import type { Item } from '@/types/item';

export type ActionWithItem = Action & { item?: Item };

interface ActionsState {
  actions: ActionWithItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;

  fetchActions: (userId: string) => Promise<void>;
  loadMore: (userId: string) => Promise<void>;
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
  hasMore: true,

  fetchActions: async (userId: string) => {
    set({ loading: true, error: null, hasMore: true });
    try {
      const actions = await getActionsForUser(userId);
      set({
        actions,
        loading: false,
        hasMore: actions.length >= DEFAULT_PAGE_LIMIT,
      });
    } catch (err) {
      const message =
        err instanceof DatabaseError
          ? err.message
          : 'Failed to load actions.';
      set({ error: message, loading: false });
    }
  },

  loadMore: async (userId: string) => {
    const { loading, hasMore, actions } = get();
    if (loading || !hasMore) return;

    set({ loading: true, error: null });
    try {
      const moreActions = await getActionsForUser(userId, {
        offset: actions.length,
      });
      set({
        actions: [...actions, ...moreActions],
        loading: false,
        hasMore: moreActions.length >= DEFAULT_PAGE_LIMIT,
      });
    } catch (err) {
      const message =
        err instanceof DatabaseError
          ? err.message
          : 'Failed to load more actions.';
      set({ error: message, loading: false });
    }
  },

  executeAndUpdate: async (action: Action) => {
    const prev = get().actions;

    // Optimistic: summarize goes to 'approved' (server confirms later),
    // everything else goes to 'completed' immediately
    const optimisticStatus: ActionStatus =
      action.type === 'summarize' ? 'approved' : 'completed';

    set((state) => ({
      actions: state.actions.map((a) =>
        a.id === action.id
          ? { ...a, status: optimisticStatus }
          : a,
      ),
    }));

    try {
      await executeAction(action);
    } catch (err) {
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
