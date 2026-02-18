/**
 * Items state — Zustand store with realtime subscription.
 */

import { create } from 'zustand';
import {
  getItems,
  getItemById,
  updateItem as apiUpdateItem,
  archiveItem as apiArchiveItem,
  deleteItem as apiDeleteItem,
  toggleStar as apiToggleStar,
  updateUserNote as apiUpdateUserNote,
  subscribeToItems,
  triggerClassify,
  DatabaseError,
} from '@/services/insforge';
import type { Item, ItemStatus, Category } from '@/types/item';

interface ItemsState {
  items: Item[];
  loading: boolean;
  error: string | null;

  fetchItems: (userId: string) => Promise<void>;
  prependItem: (item: Item) => void;
  refreshItem: (itemId: string) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  reclassify: (itemId: string) => Promise<void>;
  toggleStar: (itemId: string) => Promise<void>;
  updateNote: (itemId: string, note: string | null) => Promise<void>;
  startRealtime: (userId: string) => () => void;

  // Derived
  getByStatus: (status: ItemStatus) => Item[];
  getByCategory: (category: Category) => Item[];
  getStarred: () => Item[];
  searchItems: (query: string) => Item[];
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchItems: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const items = await getItems(userId);
      set({ items, loading: false });
    } catch (err) {
      const message =
        err instanceof DatabaseError
          ? err.message
          : 'Failed to load items.';
      set({ error: message, loading: false });
    }
  },

  prependItem: (item: Item) => {
    set((state) => ({ items: [item, ...state.items] }));
  },

  refreshItem: async (itemId: string) => {
    try {
      const updated = await getItemById(itemId);
      if (!updated) return;

      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? updated : item,
        ),
      }));
    } catch (err) {
      console.error('Failed to refresh item:', err);
    }
  },

  archiveItem: async (itemId: string) => {
    const prev = get().items;

    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, status: 'archived' as ItemStatus }
          : item,
      ),
    }));

    try {
      await apiArchiveItem(itemId);
    } catch (err) {
      console.error('Archive failed, rolling back:', err);
      set({ items: prev });
    }
  },

  deleteItem: async (itemId: string) => {
    const prev = get().items;

    set((state) => ({
      items: state.items.filter((item) => item.id !== itemId),
    }));

    try {
      await apiDeleteItem(itemId);
    } catch (err) {
      console.error('Delete failed, rolling back:', err);
      set({ items: prev });
    }
  },

  reclassify: async (itemId: string) => {
    const prev = get().items;

    // Optimistic: mark as pending
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId
          ? { ...i, status: 'pending' as ItemStatus, category: null, confidence: null }
          : i,
      ),
    }));

    try {
      await apiUpdateItem(itemId, {
        status: 'pending',
        category: null,
        confidence: null,
      });
      await triggerClassify(itemId);
    } catch (err) {
      set({ items: prev });
      throw err;
    }
  },

  toggleStar: async (itemId: string) => {
    const prev = get().items;
    const item = prev.find((i) => i.id === itemId);
    if (!item) return;

    const newStarred = !item.is_starred;

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, is_starred: newStarred } : i,
      ),
    }));

    try {
      await apiToggleStar(itemId, newStarred);
    } catch (err) {
      console.error('Toggle star failed, rolling back:', err);
      set({ items: prev });
    }
  },

  updateNote: async (itemId: string, note: string | null) => {
    const prev = get().items;

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, user_note: note } : i,
      ),
    }));

    try {
      await apiUpdateUserNote(itemId, note);
    } catch (err) {
      console.error('Update note failed, rolling back:', err);
      set({ items: prev });
    }
  },

  startRealtime: (userId: string) => {
    const subscription = subscribeToItems(userId, (updatedItem) => {
      set((state) => {
        const exists = state.items.some(
          (item) => item.id === updatedItem.id,
        );

        if (exists) {
          return {
            items: state.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item,
            ),
          };
        }

        return { items: [updatedItem, ...state.items] };
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  // ─── Derived Accessors ───────────────────────────────────────────

  getByStatus: (status: ItemStatus) => {
    return get().items.filter((item) => item.status === status);
  },

  getByCategory: (category: Category) => {
    return get().items.filter(
      (item) =>
        item.category === category && item.status !== 'archived',
    );
  },

  getStarred: () => {
    return get().items.filter(
      (item) => item.is_starred && item.status !== 'archived',
    );
  },

  searchItems: (query: string) => {
    const lower = query.toLowerCase();
    return get().items.filter((item) => {
      if (item.status === 'archived') return false;
      const searchable = [
        item.title,
        item.description,
        item.raw_content,
        item.category,
        item.source_app,
        item.user_note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(lower);
    });
  },
}));
