# Testing Patterns

**Analysis Date:** 2026-02-18

## Test Framework

**Runner:**
- Vitest 2.0.0
- Config: `vitest.config.ts`
- Environment: Node (not jsdom/happy-dom, tests are service/logic focused)
- Globals enabled: `describe`, `it`, `expect` available without imports

**Assertion Library:**
- Vitest built-in expect() (Chai-compatible)

**Run Commands:**
```bash
npm test                # Run all tests (vitest run)
npm run test:watch     # Watch mode (vitest watch)
```

Test coverage not measured; no coverage config present.

## Test File Organization

**Location:**
- Co-located: `__tests__/` directory at repo root
- Test naming: `[source-name].test.ts`
- One test file per source module

**Examples:**
- `services/classifier.ts` → `__tests__/classifier.test.ts`
- `stores/items.ts` → `__tests__/items-store.test.ts`
- `utils/format.ts` → `__tests__/format.test.ts`
- `services/actions.ts` → `__tests__/actions.test.ts`

**Current test files (11 total):**
```
__tests__/
├── classifier.test.ts
├── format.test.ts
├── url-patterns.test.ts
├── categories.test.ts
├── share-handler.test.ts
├── insforge-service.test.ts
├── insforge-queries.test.ts
├── auth-store.test.ts
├── items-store.test.ts
├── actions-store.test.ts
└── actions.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
describe('classifyHeuristic', () => {
  it('classifies YouTube URL as entertainment', () => {
    // Arrange
    const result = classifyHeuristic({
      content: 'https://youtube.com/watch?v=abc123',
      type: 'link',
    });

    // Assert
    expect(result.category).toBe('entertainment');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts prices from text', () => {
    const result = classifyHeuristic({
      content: 'Great deal on headphones for $49.99!',
      type: 'text',
    });
    expect(result.extracted_data.prices).toBeDefined();
    expect(result.extracted_data.prices![0].amount).toBe(49.99);
  });
});
```

**Patterns:**
- One `describe()` per function/class
- Test names are behaviors: `test_returns_error_when_input_is_empty` style (naming via verb phrases)
- Arrange-Act-Assert (AAA) structure implicit (no explicit comments)
- Avoid testing implementation, test observable behavior
- Each test has one reason to fail

## Mocking

**Framework:** vitest's `vi` module

**Mock Setup Pattern:**
```typescript
// Mock before importing the tested module
vi.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: vi.fn(),
  getCalendarsAsync: vi.fn(),
  createEventAsync: vi.fn(),
  EntityTypes: { EVENT: 'event' },
  CalendarType: { LOCAL: 'local' },
}));

// Mock dependencies
vi.mock('@/services/insforge', () => ({
  updateActionStatus: vi.fn(),
  triggerSummarize: vi.fn(),
}));

// Import mocks for control
import {
  updateActionStatus as mockUpdateActionStatus,
} from '@/services/insforge';

describe('actions service', () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Clear between tests
  });

  it('calls updateActionStatus', async () => {
    vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

    // ... test ...

    expect(mockUpdateActionStatus).toHaveBeenCalledWith('a1', 'completed');
  });
});
```

**What to Mock:**
- External dependencies: expo modules, InsForge SDK, SecureStore
- Service modules called by the code under test
- Never mock the module being tested

**What NOT to Mock:**
- Pure utilities: `utils/format.ts`, `utils/url-patterns.ts`
- Type definitions
- Constants (CATEGORIES, DOMAIN_RULES)
- Heuristic classification logic when testing stores that depend on it

**Mocking Strategy:**
- Use factory functions to create mock objects inline: `vi.fn().mockResolvedValue(data)`
- Clear all mocks before each test: `beforeEach(() => vi.clearAllMocks())`
- Type mocks correctly: `vi.mocked(mockFunction)` to get proper TypeScript support

## Fixtures and Factories

**Test Data Factory:**

```typescript
// From items-store.test.ts
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

**Usage:**
```typescript
const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
const item = makeItem({ status: 'classified', category: 'travel' });
```

**Location:**
- Defined at top of test file, after imports and mocks
- One factory per major type tested
- From `auth-store.test.ts`: no factory (simpler fixtures), data passed inline to mocks

**Reset Functions:**

```typescript
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
});
```

## Test Types

**Unit Tests:**
- Scope: Single function/store action
- Approach: Mock all dependencies, test pure logic or state transitions
- Examples:
  - `classifier.test.ts`: heuristic classification logic (pure functions, no mocks)
  - `format.test.ts`: formatting utilities (pure functions, fake time with `vi.useFakeTimers()`)
  - `auth-store.test.ts`: auth state transitions (mocks insforge + SecureStore)

**Integration Tests:**
- Scope: Multiple modules interacting
- Approach: Mock I/O boundaries (API, filesystem), test orchestration
- Examples:
  - `items-store.test.ts`: store mutations + API calls (mocks insforge, tests realtime flow)
  - `actions.test.ts`: action execution service calling expo-calendar/notifications + InsForge
  - `insforge-queries.test.ts`: database query builders (mocks SDK responses)

**E2E Tests:**
- Not present; Expo + React Native apps typically use detox or similar
- Ada testing is unit + integration focused

## Common Patterns

**Async Testing:**

```typescript
// From items-store.test.ts
it('loads items into state', async () => {
  const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
  vi.mocked(mockGetItems).mockResolvedValue(items);

  await useItemsStore.getState().fetchItems('u1');

  const state = useItemsStore.getState();
  expect(state.items).toEqual(items);
  expect(state.loading).toBe(false);
});
```

**Key points:**
- `async/await` always used
- Mock returns: `.mockResolvedValue()` for success, `.mockRejectedValue()` for errors
- State checked after await completes
- No callbacks or `.then()` chains

**Error Testing:**

```typescript
// From auth-store.test.ts
it('sets AuthError message on auth failure', async () => {
  vi.mocked(mockSignUp).mockRejectedValue(
    new AuthError('Email already registered')
  );

  await useAuthStore.getState().signUp('a@b.com', 'pass');

  const state = useAuthStore.getState();
  expect(state.error).toBe('Email already registered');
  expect(state.loading).toBe(false);
});

// Generic error fallback
it('sets generic message on unknown error', async () => {
  vi.mocked(mockSignUp).mockRejectedValue(new Error('boom'));

  await useAuthStore.getState().signUp('a@b.com', 'pass');

  expect(useItemsStore.getState().error).toBe(
    'Sign up failed. Please try again.',
  );
});
```

**Optimistic Updates Testing:**

```typescript
// From items-store.test.ts
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

  // Should restore original items (not archived)
  expect(useItemsStore.getState().items[0].status).toBe('classified');
});
```

**Derived Accessors Testing:**

```typescript
// From items-store.test.ts
describe('getByCategory', () => {
  it('returns non-archived items in category', () => {
    const travel = useItemsStore
      .getState()
      .getByCategory('travel' as Category);
    expect(travel).toHaveLength(1);
    expect(travel[0].id).toBe('1');
  });

  it('excludes archived items', () => {
    const travel = useItemsStore.getState().getByCategory('travel');
    expect(travel.every((i) => i.status !== 'archived')).toBe(true);
  });
});
```

**Time-Based Testing:**

```typescript
// From format.test.ts
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
});
```

**Store Realtime Subscription Testing:**

```typescript
// From items-store.test.ts
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
```

## Edge Case Coverage

**Tested consistently:**
- Empty inputs: `it('returns empty for no matches', () => { ... })`
- Null/undefined: `it('handles null/undefined', () => { expect(...).toBe('') })`
- Boundary values: confidence scores 0.85, 0.6, <0.6
- Error paths: every action tested with success and failure
- Rollback scenarios: optimistic updates tested with failure + rollback
- Missing resources: `it('returns empty array for no matches', () => { ... })`

**Example coverage from classifier.test.ts:**
- Unrecognizable content → falls back to 'other'
- Mixed content (price + date + contacts) → limits actions to 3 max
- Empty content → returns valid shape with 'other' category
- All content types tested: link, text

## Assertion Patterns

**Common expectations:**
- Exact matches: `expect(value).toBe(expected)`
- Array membership: `expect(array).toHaveLength(3)`, `expect(array).toContain(item)`
- Type checks: `expect(value).toBeDefined()`, `expect(value).toBeNull()`
- Truthy/falsy: `expect(bool).toBe(true)`, `expect(result).toBeFalsy()`
- Ranges: `expect(score).toBeGreaterThan(0.5)`, `expect(score).toBeLessThan(0.85)`
- Mock calls: `expect(mockFn).toHaveBeenCalled()`, `expect(mockFn).toHaveBeenCalledWith(args)`
- Collections: `expect(array).toEqual([...])` (deep equality)

**Not used:**
- Snapshots (no `.toMatchSnapshot()`)
- Custom matchers
- `toBeDefined()` rarely; prefer explicit checks

## Notes on Current Coverage

**Well-tested:**
- Service layer: `insforge.ts`, `actions.ts` (mocked I/O, happy paths + errors)
- State management: all store files (optimistic updates, error handling, derived accessors)
- Pure utilities: `format.ts`, `url-patterns.ts`, `classifier.ts` (comprehensive edge cases)

**Not tested yet:**
- UI components (screens, share extension)
- Edge functions themselves (`functions/classify/index.ts`, `functions/summarize/index.ts`)
- React hooks (none explicitly tested; integrated into components)
- Real API integration (all mocked)

**Philosophy:**
- Test behavior, not implementation
- All async code tested
- All state transitions covered
- Error paths required
- Mocks are conservative (mock external dependencies, not internals)

---

*Testing analysis: 2026-02-18*
