# Testing Patterns

**Analysis Date:** 2026-02-18

## Framework & Config

**Runner:**
- Vitest 2.x (`vitest` in `devDependencies`)
- Config: `vitest.config.ts`
- Environment: `node` (no jsdom -- tests focus on services/logic, not UI rendering)
- Globals enabled: `globals: true` -- `describe`, `it`, `expect` available without import

**Assertion Library:**
- Vitest built-in `expect()` (Chai-compatible matchers)

**Path Alias:**
- `@/` resolves to project root via `resolve.alias` in `vitest.config.ts`

**Run Commands:**
```bash
npx vitest run              # Run all tests (190 tests, ~700ms)
npx vitest watch            # Watch mode
npm test                    # Alias for vitest run
npm run test:watch          # Alias for vitest watch
```

**Config file (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

## Test Files

| File | Tests | What's Tested |
|------|-------|---------------|
| `__tests__/url-patterns.test.ts` | 16 | `matchUrlToCategory`, `extractDomain`, `isLikelyUrl` -- domain-to-category mapping, URL detection |
| `__tests__/classifier.test.ts` | 12 | `classifyHeuristic` -- URL classification, keyword matching, data extraction, action suggestions |
| `__tests__/format.test.ts` | 13 | `timeAgo`, `truncate`, `cleanUrl`, `confidenceLabel`, `capitalize` -- all formatting utils |
| `__tests__/categories.test.ts` | 22 | `CATEGORIES` structure validation, `CATEGORY_LIST`, `getCategoryDef` -- data integrity |
| `__tests__/share-handler.test.ts` | 5 | Content type detection via `classifyHeuristic` -- URL, text, empty, rich text |
| `__tests__/insforge-service.test.ts` | 17 | Error classes (`AuthError`, `DatabaseError`, `StorageError`, `FunctionError`) -- hierarchy, cause preservation |
| `__tests__/insforge-queries.test.ts` | 9 | `toggleStar`, `updateUserNote`, `getActionsForUser` -- database query builder mocking |
| `__tests__/auth-store.test.ts` | 15 | `useAuthStore` -- initialize, signUp, signIn, verifyEmail, resendCode, signOut, clearError, resetVerification |
| `__tests__/items-store.test.ts` | 22 | `useItemsStore` -- fetchItems, refreshItem, archiveItem, deleteItem, reclassify, toggleStar, updateNote, startRealtime, derived accessors |
| `__tests__/actions-store.test.ts` | 10 | `useActionsStore` -- fetchActions, executeAndUpdate, dismissAction, getPending, getCompleted, getForItem |
| `__tests__/actions.test.ts` | 19 | `executeAction` dispatcher, `executeCalendarAction`, `executeReminderAction`, `executeSummarizeAction`, `ActionError` |

**Totals:** 11 test files, 190 tests, all passing.

## Test Structure

**Suite Organization -- nested `describe` blocks per function:**

```typescript
describe('items store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('fetchItems', () => {
    it('loads items into state', async () => { /* ... */ });
    it('sets error on failure', async () => { /* ... */ });
  });

  describe('archiveItem', () => {
    it('optimistically sets status to archived', async () => { /* ... */ });
    it('rolls back to previous state on API failure', async () => { /* ... */ });
  });

  describe('derived accessors', () => {
    describe('getByStatus', () => { /* ... */ });
    describe('getByCategory', () => { /* ... */ });
    describe('searchItems', () => { /* ... */ });
  });
});
```

**Test Naming -- behavior-focused verb phrases:**
- `'classifies YouTube URL as entertainment'`
- `'optimistically sets status to archived'`
- `'rolls back to previous state on API failure'`
- `'returns null for unknown domains'`
- `'handles empty content gracefully'`

**Each test has one reason to fail.** No multi-assertion tests where failure is ambiguous.

## Mock Patterns

**Framework:** Vitest `vi` module

### Pattern 1: Simple module mock (most common)

Used for `@/services/insforge`, `expo-secure-store`, `@/services/actions`:

```typescript
// Mock entire module with inline factory
vi.mock('@/services/insforge', () => ({
  getItems: vi.fn(),
  getItemById: vi.fn(),
  archiveItem: vi.fn(),
  deleteItem: vi.fn(),
  toggleStar: vi.fn(),
  subscribeToItems: vi.fn(),
  triggerClassify: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    cause: unknown;
    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = 'DatabaseError';
      this.cause = cause;
    }
  },
}));

// Import mocked functions for test control (after vi.mock)
import {
  getItems as mockGetItems,
  archiveItem as mockArchiveItem,
} from '@/services/insforge';
```

### Pattern 2: Expo native module mock

Used for `expo-calendar`, `expo-notifications`, `react-native`:

```typescript
vi.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: vi.fn(),
  getCalendarsAsync: vi.fn(),
  createCalendarAsync: vi.fn(),
  createEventAsync: vi.fn(),
  EntityTypes: { EVENT: 'event' },
  CalendarType: { LOCAL: 'local' },
  CalendarAccessLevel: { OWNER: 'owner' },
}));
```

### Pattern 3: SDK chain mock with `vi.hoisted`

Used in `__tests__/insforge-queries.test.ts` for mocking the InsForge SDK's chainable query builder:

```typescript
const {
  mockDatabase, mockSelect, mockEq, mockOrder, mockUpdate,
} = vi.hoisted(() => ({
  mockDatabase: { from: vi.fn() },
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockUpdate: vi.fn(),
}));

function setupChain(finalResult: { data: unknown; error: unknown }) {
  mockSelect.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
    then: (resolve: (v: unknown) => void) => resolve(finalResult),
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    select: mockSelect,
    then: (resolve: (v: unknown) => void) => resolve(finalResult),
  });
  // ... setup full chain
  mockDatabase.from.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  });
}
```

### Mock Rules

**What to mock:**
- External SDKs and native modules: `@insforge/sdk`, `expo-calendar`, `expo-notifications`, `expo-secure-store`
- Service modules when testing stores: `@/services/insforge`, `@/services/actions`
- `react-native` Platform when needed: `vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))`

**What NOT to mock:**
- Pure utility functions: `utils/format.ts`, `utils/url-patterns.ts` -- test them directly
- Constants: `CATEGORIES`, `CONFIG`, `DOMAIN_RULES` -- use real data
- The module being tested itself

**Between tests:** Always `vi.clearAllMocks()` in `beforeEach`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});
```

**Type-safe mock control:** Use `vi.mocked()`:

```typescript
vi.mocked(mockGetItems).mockResolvedValue(items);
vi.mocked(mockArchiveItem).mockRejectedValue(new Error('fail'));
```

## Fixtures and Factories

**Factory function pattern -- one per major type:**

```typescript
// From __tests__/items-store.test.ts
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
```

```typescript
// From __tests__/actions-store.test.ts
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
```

**Usage:**
```typescript
const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
const item = makeItem({ id: 'a1', status: 'classified', category: 'travel' as Category });
```

**Store reset helpers:**
```typescript
function resetStore() {
  useItemsStore.setState({ items: [], loading: false, error: null });
}
```

**Location:** Factory functions defined at top of each test file, after imports and mocks.

## Coverage

**Requirements:** None enforced. No coverage config, no CI threshold.

**No coverage command configured.** To add coverage:
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests (pure functions, no mocks):**
- `__tests__/classifier.test.ts` -- heuristic classification logic
- `__tests__/format.test.ts` -- formatting utilities (uses `vi.useFakeTimers()` for time)
- `__tests__/url-patterns.test.ts` -- URL pattern matching
- `__tests__/categories.test.ts` -- category data integrity validation

**Unit Tests (mocked dependencies):**
- `__tests__/insforge-service.test.ts` -- error class behavior
- `__tests__/insforge-queries.test.ts` -- database query functions
- `__tests__/auth-store.test.ts` -- auth state transitions
- `__tests__/items-store.test.ts` -- items state transitions + optimistic updates
- `__tests__/actions-store.test.ts` -- actions state transitions

**Integration Tests (multiple modules interacting):**
- `__tests__/actions.test.ts` -- action execution dispatching through expo-calendar, expo-notifications, and InsForge
- `__tests__/share-handler.test.ts` -- share handler feeding into classifier

**E2E Tests:**
- Not present. No Detox or Maestro setup.

**Not tested:**
- UI components (screens in `app/`)
- Edge functions (`functions/classify/index.ts`, `functions/summarize/index.ts`)
- React hooks
- Real API integration

## Common Patterns

### Async Testing

```typescript
it('loads items into state', async () => {
  const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
  vi.mocked(mockGetItems).mockResolvedValue(items);

  await useItemsStore.getState().fetchItems('u1');

  const state = useItemsStore.getState();
  expect(state.items).toEqual(items);
  expect(state.loading).toBe(false);
  expect(state.error).toBeNull();
});
```

### Error Testing

```typescript
// Test domain-specific error message
it('sets AuthError message on auth failure', async () => {
  vi.mocked(mockSignUp).mockRejectedValue(
    new AuthError('Email already registered'),
  );

  await useAuthStore.getState().signUp('a@b.com', 'pass');

  expect(useAuthStore.getState().error).toBe('Email already registered');
  expect(useAuthStore.getState().loading).toBe(false);
});

// Test generic fallback message
it('sets generic message on unknown error', async () => {
  vi.mocked(mockSignUp).mockRejectedValue(new Error('boom'));

  await useAuthStore.getState().signUp('a@b.com', 'pass');

  expect(useAuthStore.getState().error).toBe(
    'Sign up failed. Please try again.',
  );
});

// Test thrown errors (services)
it('throws ActionError for unknown action type', async () => {
  const action = makeAction({ type: 'unknown_action' as Action['type'] });
  await expect(executeAction(action)).rejects.toThrow(ActionError);
  await expect(executeAction(action)).rejects.toThrow(
    'Unknown action type: unknown_action',
  );
});
```

### Optimistic Update + Rollback Testing

```typescript
it('optimistically sets status to archived', async () => {
  const item = makeItem({ id: 'a1', status: 'classified' });
  useItemsStore.setState({ items: [item] });
  vi.mocked(mockArchiveItem).mockResolvedValue(undefined);

  await useItemsStore.getState().archiveItem('a1');

  expect(useItemsStore.getState().items[0].status).toBe('archived');
});

it('rolls back to previous state on API failure', async () => {
  const item = makeItem({ id: 'a1', status: 'classified' });
  useItemsStore.setState({ items: [item] });
  vi.mocked(mockArchiveItem).mockRejectedValue(new Error('fail'));

  await useItemsStore.getState().archiveItem('a1');

  expect(useItemsStore.getState().items[0].status).toBe('classified');
});
```

### Time-Based Testing

```typescript
describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns just now for timestamps under a minute', () => {
    expect(timeAgo('2026-02-18T11:59:30Z')).toBe('just now');
  });

  it('returns minutes for recent timestamps', () => {
    expect(timeAgo('2026-02-18T11:55:00Z')).toBe('5m ago');
  });
});
```

### Realtime Subscription Testing

```typescript
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

  expect(useItemsStore.getState().items[0].title).toBe('Now classified');
});
```

### Parameterized Tests

```typescript
// From __tests__/categories.test.ts
it.each(ALL_CATEGORY_IDS)(
  'category "%s" has required fields',
  (id) => {
    const cat = CATEGORIES[id];
    expect(cat.label).toBeTruthy();
    expect(cat.icon).toBeTruthy();
    expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(Array.isArray(cat.keywords)).toBe(true);
  },
);
```

## Test Conventions

**Naming:** Behavior-focused phrases starting with a verb:
- `'classifies YouTube URL as entertainment'`
- `'returns null for unknown domains'`
- `'rolls back on API failure'`
- `'handles empty content gracefully'`

**Edge cases to always test:**
- Empty inputs / empty strings
- Null/undefined values
- Error paths for every success path
- Rollback for every optimistic update
- Boundary values (confidence thresholds: 0.85, 0.6)
- Unknown/unrecognized inputs (unknown domains, unknown action types)

**Assertion Patterns Used:**
- Exact matches: `expect(value).toBe(expected)`
- Deep equality: `expect(array).toEqual([...])`
- Array length: `expect(array).toHaveLength(3)`
- Defined/null: `expect(value).toBeDefined()`, `expect(value).toBeNull()`
- Ranges: `expect(score).toBeGreaterThan(0.5)`, `expect(score).toBeLessThan(0.85)`
- Mock verification: `expect(mockFn).toHaveBeenCalledWith(args)`
- Thrown errors: `await expect(fn()).rejects.toThrow('message')`
- Pattern matching: `expect(str).toMatch(/regex/)`
- Object containment: `expect.objectContaining({ key: value })`

**Not used:**
- Snapshot testing (no `.toMatchSnapshot()`)
- Custom matchers
- Test hooks like `vi.spyOn` (all mocks are module-level `vi.mock`)

---

*Testing analysis: 2026-02-18*
