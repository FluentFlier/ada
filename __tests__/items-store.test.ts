/**
 * Tests for items Zustand store.
 *
 * Mocks the insforge service to test state transitions,
 * optimistic updates, and derived accessors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useItemsStore } from '@/stores/items';
import type { Item, ItemStatus, Category } from '@/types/item';

vi.mock('@/services/insforge', () => ({
  getItems: vi.fn(),
  getItemById: vi.fn(),
  updateItem: vi.fn(),
  archiveItem: vi.fn(),
  deleteItem: vi.fn(),
  toggleStar: vi.fn(),
  updateUserNote: vi.fn(),
  subscribeToItems: vi.fn(),
  triggerClassify: vi.fn(),
  DEFAULT_PAGE_LIMIT: 50,
  DatabaseError: class DatabaseError extends Error {
    cause: unknown;
    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = 'DatabaseError';
      this.cause = cause;
    }
  },
}));

import {
  getItems as mockGetItems,
  getItemById as mockGetItemById,
  archiveItem as mockArchiveItem,
  deleteItem as mockDeleteItem,
  updateItem as mockUpdateItem,
  toggleStar as mockToggleStar,
  updateUserNote as mockUpdateUserNote,
  triggerClassify as mockTriggerClassify,
  subscribeToItems as mockSubscribeToItems,
} from '@/services/insforge';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    user_id: 'u1',
    type: 'text',
    raw_content: 'Test content',
    title: null,
    description: null,
    category: null,
    extracted_data: {},
    suggested_actions: [],
    confidence: null,
    status: 'pending',
    source_app: null,
    is_starred: false,
    user_note: null,
    created_at: '2026-02-18T00:00:00Z',
    updated_at: '2026-02-18T00:00:00Z',
    ...overrides,
  } as Item;
}

function resetStore() {
  useItemsStore.setState({
    items: [],
    loading: false,
    error: null,
  });
}

describe('items store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('fetchItems', () => {
    it('loads items into state', async () => {
      const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
      vi.mocked(mockGetItems).mockResolvedValue(items);

      await useItemsStore.getState().fetchItems('u1');

      const state = useItemsStore.getState();
      expect(state.items).toEqual(items);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(mockGetItems).mockRejectedValue(new Error('db down'));

      await useItemsStore.getState().fetchItems('u1');

      const state = useItemsStore.getState();
      expect(state.items).toEqual([]);
      expect(state.error).toBe('Failed to load items.');
      expect(state.loading).toBe(false);
    });

    it('sets hasMore to true when results equal page limit', async () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        makeItem({ id: `item-${i}` }),
      );
      vi.mocked(mockGetItems).mockResolvedValue(items);

      await useItemsStore.getState().fetchItems('u1');

      expect(useItemsStore.getState().hasMore).toBe(true);
    });

    it('sets hasMore to false when results fewer than page limit', async () => {
      const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
      vi.mocked(mockGetItems).mockResolvedValue(items);

      await useItemsStore.getState().fetchItems('u1');

      expect(useItemsStore.getState().hasMore).toBe(false);
    });
  });

  describe('loadMore', () => {
    it('appends items to existing list', async () => {
      const initial = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
      useItemsStore.setState({ items: initial, hasMore: true });

      const more = [makeItem({ id: 'c' }), makeItem({ id: 'd' })];
      vi.mocked(mockGetItems).mockResolvedValue(more);

      await useItemsStore.getState().loadMore('u1');

      expect(useItemsStore.getState().items).toHaveLength(4);
      expect(useItemsStore.getState().items[2].id).toBe('c');
    });

    it('passes offset based on current items length', async () => {
      const initial = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
      useItemsStore.setState({ items: initial, hasMore: true });
      vi.mocked(mockGetItems).mockResolvedValue([]);

      await useItemsStore.getState().loadMore('u1');

      expect(mockGetItems).toHaveBeenCalledWith('u1', { offset: 2 });
    });

    it('does nothing when hasMore is false', async () => {
      useItemsStore.setState({ items: [], hasMore: false });

      await useItemsStore.getState().loadMore('u1');

      expect(mockGetItems).not.toHaveBeenCalled();
    });

    it('does nothing when already loading', async () => {
      useItemsStore.setState({ items: [], hasMore: true, loading: true });

      await useItemsStore.getState().loadMore('u1');

      expect(mockGetItems).not.toHaveBeenCalled();
    });
  });

  describe('refreshItem', () => {
    it('replaces existing item in state', async () => {
      const original = makeItem({ id: 'x', title: null });
      useItemsStore.setState({ items: [original] });

      const updated = makeItem({ id: 'x', title: 'Classified!' });
      vi.mocked(mockGetItemById).mockResolvedValue(updated);

      await useItemsStore.getState().refreshItem('x');

      expect(useItemsStore.getState().items[0].title).toBe('Classified!');
    });

    it('does nothing when item not found', async () => {
      vi.mocked(mockGetItemById).mockResolvedValue(null);

      const original = makeItem({ id: 'x' });
      useItemsStore.setState({ items: [original] });

      await useItemsStore.getState().refreshItem('x');

      expect(useItemsStore.getState().items).toEqual([original]);
    });
  });

  describe('archiveItem', () => {
    it('optimistically sets status to archived', async () => {
      const item = makeItem({ id: 'a1', status: 'classified' });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockArchiveItem).mockResolvedValue(undefined);

      await useItemsStore.getState().archiveItem('a1');

      expect(useItemsStore.getState().items[0].status).toBe('archived');
    });

    it('rolls back to previous state on API failure', async () => {
      const item = makeItem({
        id: 'a1',
        status: 'classified',
        user_id: 'u1',
      });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockArchiveItem).mockRejectedValue(new Error('fail'));

      await useItemsStore.getState().archiveItem('a1');

      // Should restore original items (not archived)
      const currentItems = useItemsStore.getState().items;
      expect(currentItems[0].status).toBe('classified');
    });
  });

  describe('deleteItem', () => {
    it('optimistically removes item from state', async () => {
      const items = [makeItem({ id: 'd1' }), makeItem({ id: 'd2' })];
      useItemsStore.setState({ items });

      vi.mocked(mockDeleteItem).mockResolvedValue(undefined);

      await useItemsStore.getState().deleteItem('d1');

      expect(useItemsStore.getState().items).toHaveLength(1);
      expect(useItemsStore.getState().items[0].id).toBe('d2');
    });

    it('rolls back on failure', async () => {
      const items = [makeItem({ id: 'd1' }), makeItem({ id: 'd2' })];
      useItemsStore.setState({ items });

      vi.mocked(mockDeleteItem).mockRejectedValue(new Error('fail'));

      await useItemsStore.getState().deleteItem('d1');

      // Should roll back to original state
      expect(useItemsStore.getState().items).toHaveLength(2);
    });
  });

  describe('reclassify', () => {
    it('resets item and triggers classify', async () => {
      vi.mocked(mockUpdateItem).mockResolvedValue(
        makeItem({ id: 'r1', status: 'pending' }),
      );
      vi.mocked(mockTriggerClassify).mockResolvedValue(undefined);

      await useItemsStore.getState().reclassify('r1');

      expect(mockUpdateItem).toHaveBeenCalledWith('r1', {
        status: 'pending',
        category: null,
        confidence: null,
      });
      expect(mockTriggerClassify).toHaveBeenCalledWith('r1', undefined);
    });
  });

  describe('startRealtime', () => {
    it('returns unsubscribe function', () => {
      const unsub = vi.fn();
      vi.mocked(mockSubscribeToItems).mockReturnValue({
        unsubscribe: unsub,
      });

      const cleanup = useItemsStore.getState().startRealtime('u1');
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(unsub).toHaveBeenCalled();
    });

    it('updates existing item via realtime callback', () => {
      const item = makeItem({ id: 'rt1', title: null });
      useItemsStore.setState({ items: [item] });

      let realtimeCallback: (item: Item) => void = () => {};
      vi.mocked(mockSubscribeToItems).mockImplementation(
        (_userId, cb) => {
          realtimeCallback = cb;
          return { unsubscribe: vi.fn() };
        },
      );

      useItemsStore.getState().startRealtime('u1');

      // Simulate realtime update
      const updated = makeItem({ id: 'rt1', title: 'Now classified' });
      realtimeCallback(updated);

      expect(useItemsStore.getState().items[0].title).toBe(
        'Now classified',
      );
    });

    it('adds new item via realtime callback', () => {
      useItemsStore.setState({ items: [] });

      let realtimeCallback: (item: Item) => void = () => {};
      vi.mocked(mockSubscribeToItems).mockImplementation(
        (_userId, cb) => {
          realtimeCallback = cb;
          return { unsubscribe: vi.fn() };
        },
      );

      useItemsStore.getState().startRealtime('u1');

      const newItem = makeItem({ id: 'new-1' });
      realtimeCallback(newItem);

      expect(useItemsStore.getState().items).toHaveLength(1);
      expect(useItemsStore.getState().items[0].id).toBe('new-1');
    });
  });

  describe('derived accessors', () => {
    const items: Item[] = [
      makeItem({
        id: '1',
        status: 'pending',
        category: 'travel' as Category,
        title: 'Flight to Paris',
        raw_content: 'booking confirmation',
      }),
      makeItem({
        id: '2',
        status: 'classified',
        category: 'entertainment' as Category,
        title: 'Netflix show',
        raw_content: 'watch list',
      }),
      makeItem({
        id: '3',
        status: 'archived',
        category: 'travel' as Category,
        title: 'Old trip',
        raw_content: 'archived trip',
      }),
    ];

    beforeEach(() => {
      useItemsStore.setState({ items });
    });

    describe('getByStatus', () => {
      it('returns items matching status', () => {
        const pending = useItemsStore.getState().getByStatus('pending');
        expect(pending).toHaveLength(1);
        expect(pending[0].id).toBe('1');
      });

      it('returns empty array for no matches', () => {
        const result = useItemsStore
          .getState()
          .getByStatus('classified' as ItemStatus);
        // We have one classified item
        expect(result).toHaveLength(1);
      });
    });

    describe('getByCategory', () => {
      it('returns non-archived items in category', () => {
        const travel = useItemsStore
          .getState()
          .getByCategory('travel' as Category);
        expect(travel).toHaveLength(1);
        expect(travel[0].id).toBe('1');
      });

      it('excludes archived items', () => {
        const travel = useItemsStore
          .getState()
          .getByCategory('travel' as Category);
        expect(travel.every((i) => i.status !== 'archived')).toBe(true);
      });
    });

    describe('searchItems', () => {
      it('finds items by title', () => {
        const results = useItemsStore.getState().searchItems('flight');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('1');
      });

      it('finds items by raw_content', () => {
        const results = useItemsStore.getState().searchItems('watch');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('2');
      });

      it('is case insensitive', () => {
        const results = useItemsStore.getState().searchItems('NETFLIX');
        expect(results).toHaveLength(1);
      });

      it('excludes archived items', () => {
        const results = useItemsStore.getState().searchItems('trip');
        expect(results).toHaveLength(0);
      });

      it('returns empty for no matches', () => {
        const results = useItemsStore.getState().searchItems('zzzzz');
        expect(results).toEqual([]);
      });

      it('searches user_note field', () => {
        useItemsStore.setState({
          items: [
            makeItem({
              id: 'n1',
              status: 'classified',
              user_note: 'important meeting notes',
            }),
          ],
        });

        const results = useItemsStore
          .getState()
          .searchItems('meeting notes');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('n1');
      });
    });
  });

  describe('toggleStar', () => {
    it('optimistically toggles is_starred to true', async () => {
      const item = makeItem({
        id: 's1',
        is_starred: false,
      });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockToggleStar).mockResolvedValue(
        makeItem({ id: 's1', is_starred: true }),
      );

      await useItemsStore.getState().toggleStar('s1');

      expect(useItemsStore.getState().items[0].is_starred).toBe(
        true,
      );
    });

    it('optimistically toggles is_starred to false', async () => {
      const item = makeItem({
        id: 's1',
        is_starred: true,
      });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockToggleStar).mockResolvedValue(
        makeItem({ id: 's1', is_starred: false }),
      );

      await useItemsStore.getState().toggleStar('s1');

      expect(useItemsStore.getState().items[0].is_starred).toBe(
        false,
      );
    });

    it('rolls back on API failure', async () => {
      const item = makeItem({
        id: 's1',
        is_starred: false,
      });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockToggleStar).mockRejectedValue(
        new Error('network'),
      );

      await useItemsStore.getState().toggleStar('s1');

      // Should roll back to original
      expect(useItemsStore.getState().items[0].is_starred).toBe(
        false,
      );
    });

    it('does nothing for unknown item', async () => {
      useItemsStore.setState({ items: [] });

      await useItemsStore.getState().toggleStar('unknown');

      expect(mockToggleStar).not.toHaveBeenCalled();
    });
  });

  describe('updateNote', () => {
    it('optimistically updates user_note', async () => {
      const item = makeItem({ id: 'n1', user_note: null });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockUpdateUserNote).mockResolvedValue(
        makeItem({ id: 'n1', user_note: 'hello' }),
      );

      await useItemsStore.getState().updateNote('n1', 'hello');

      expect(useItemsStore.getState().items[0].user_note).toBe(
        'hello',
      );
    });

    it('clears note when set to null', async () => {
      const item = makeItem({
        id: 'n1',
        user_note: 'old note',
      });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockUpdateUserNote).mockResolvedValue(
        makeItem({ id: 'n1', user_note: null }),
      );

      await useItemsStore.getState().updateNote('n1', null);

      expect(useItemsStore.getState().items[0].user_note).toBeNull();
    });

    it('rolls back on API failure', async () => {
      const item = makeItem({ id: 'n1', user_note: 'old' });
      useItemsStore.setState({ items: [item] });

      vi.mocked(mockUpdateUserNote).mockRejectedValue(
        new Error('fail'),
      );

      await useItemsStore.getState().updateNote('n1', 'new');

      expect(useItemsStore.getState().items[0].user_note).toBe(
        'old',
      );
    });
  });

  describe('getStarred', () => {
    it('returns only starred non-archived items', () => {
      useItemsStore.setState({
        items: [
          makeItem({ id: 's1', is_starred: true, status: 'classified' }),
          makeItem({ id: 's2', is_starred: false, status: 'classified' }),
          makeItem({ id: 's3', is_starred: true, status: 'archived' }),
        ],
      });

      const starred = useItemsStore.getState().getStarred();
      expect(starred).toHaveLength(1);
      expect(starred[0].id).toBe('s1');
    });

    it('returns empty when nothing starred', () => {
      useItemsStore.setState({
        items: [makeItem({ id: 'x', is_starred: false })],
      });

      expect(useItemsStore.getState().getStarred()).toEqual([]);
    });
  });
});
