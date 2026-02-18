# Coding Conventions

**Analysis Date:** 2026-02-18

## Naming Patterns

| Context | Convention | Example |
|---------|-----------|---------|
| Source files | `kebab-case.ts` | `share-handler.ts`, `url-patterns.ts` |
| Type files | Singular noun | `types/item.ts`, `types/action.ts` |
| Constant files | Plural noun | `constants/categories.ts`, `constants/actions.ts` |
| Store files | Singular domain noun | `stores/auth.ts`, `stores/items.ts` |
| Test files | `{module-name}.test.ts` | `__tests__/classifier.test.ts`, `__tests__/items-store.test.ts` |
| Functions | camelCase, verb prefix | `saveItem`, `fetchItems`, `getByStatus`, `executeCalendarAction` |
| Boolean functions | `is`/`has` prefix | `isLikelyUrl` |
| Local variables | camelCase | `bestCategory`, `trimmed`, `hoursUntil` |
| Module constants | UPPER_SNAKE_CASE | `DOMAIN_RULES`, `TOKEN_KEY`, `CLASSIFY_PROMPT` |
| Exported constants | UPPER_SNAKE_CASE | `CONFIG`, `CATEGORIES`, `CATEGORY_LIST`, `ACTION_LABELS` |
| Interfaces | PascalCase | `AuthUser`, `ShareInput`, `CategoryDefinition` |
| Type aliases | PascalCase | `ContentType`, `ItemStatus`, `ActionType` |
| Union types | String literal unions | `type ItemStatus = 'pending' \| 'classified' \| 'archived'` |
| Zustand hooks | `use{Domain}Store` | `useAuthStore`, `useItemsStore`, `useActionsStore` |
| State interfaces | `{Domain}State` | `AuthState`, `ItemsState`, `ActionsState` |

## File Organization

**Service layer** (`services/`):
- `services/insforge.ts` is the single gateway to all backend operations. No other file imports `@insforge/sdk` directly.
- One file per responsibility: `classifier.ts` (heuristic logic), `share-handler.ts` (share extension), `actions.ts` (action execution)
- Service functions are pure async functions -- no stored state, no side effects beyond API calls

**Stores** (`stores/`):
- One Zustand store per domain: `auth.ts`, `items.ts`, `actions.ts`
- Each store owns its state + mutations + derived accessors
- Stores import from `services/` but never from each other

**Types** (`types/`):
- One file per domain: `item.ts`, `action.ts`, `classification.ts`
- Export both interfaces and union string types from same file
- Always import with `import type { ... }` syntax

**Constants** (`constants/`):
- Immutable data + lookup functions co-located: `CATEGORIES` object + `getCategoryDef()` in `categories.ts`
- Export `as const` for config objects: `export const CONFIG = { ... } as const` in `config.ts`

**Utils** (`utils/`):
- Pure functions only, no I/O, no state: `format.ts`, `url-patterns.ts`
- Regexes compiled as module-level constants, not inside functions

## Import Ordering

Always follow this order, separated by blank lines:

```typescript
// 1. External packages (react, react-native, expo, third-party)
import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 2. Internal modules (services, stores, constants, utils)
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { getCategoryDef } from '@/constants/categories';
import { timeAgo, truncate } from '@/utils/format';

// 3. Type-only imports (always last, always use `import type`)
import type { Item, Category } from '@/types/item';
```

**Path Aliases:**
- Always use `@/` prefix for project imports: `@/services/insforge`, `@/constants/categories`
- Relative imports only within the same directory: `./insforge`, `./classifier`
- Configured in `tsconfig.json` (`"@/*": ["./*"]`) and `vitest.config.ts` (resolve alias)

**Wildcard imports:**
- Only for modules exporting many named constants: `import * as Calendar from 'expo-calendar'`, `import * as SecureStore from 'expo-secure-store'`
- Never for internal modules

## Error Handling Patterns

**Custom Error Hierarchy in `services/insforge.ts`:**

```typescript
class AdaError extends Error {
  public readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}

export class AuthError extends AdaError {}
export class DatabaseError extends AdaError {}
export class StorageError extends AdaError {}
export class FunctionError extends AdaError {}
```

Separate `ActionError` in `services/actions.ts`:

```typescript
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}
```

**Service Layer -- fail fast, include context:**

```typescript
// Every database call checks both error AND empty data
const { data, error } = await insforge.database.from('items').insert({...}).select();
if (error) throw new DatabaseError('Failed to save item', error);
if (!data || data.length === 0) throw new DatabaseError('Insert returned no data');
```

**Store Layer -- catch specific errors, show user-friendly messages:**

```typescript
catch (err) {
  const message = err instanceof AuthError
    ? err.message
    : 'Sign in failed. Check your credentials.';
  set({ error: message, loading: false });
}
```

**Recoverable vs Unrecoverable:**
- Recoverable (logged, not thrown): classification trigger failure, image upload failure in share handler, realtime connection failure
- Pattern: `triggerClassify(item.id).catch(() => {})` or try/catch with `console.error`
- Unrecoverable (thrown, surfaced to user): database errors, auth errors, permission denials

**Edge Functions:**
- Non-fatal errors: `console.warn` + fallback behavior
- Fatal errors: return JSON error response with status code
- Summarize function marks action as `failed` in catch block so user sees the error state

## State Management Patterns

**Zustand Store Structure:**

```typescript
interface DomainState {
  // Data
  items: Item[];
  loading: boolean;
  error: string | null;

  // Async mutations
  fetchItems: (userId: string) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;

  // Derived accessors (synchronous, use get())
  getByStatus: (status: ItemStatus) => Item[];
  searchItems: (query: string) => Item[];
}

export const useDomainStore = create<DomainState>((set, get) => ({
  // ... initial state + implementations
}));
```

**Optimistic Update Pattern (used everywhere):**

```typescript
archiveItem: async (itemId: string) => {
  const prev = get().items;                    // 1. Snapshot previous state

  set((state) => ({                            // 2. Optimistic update
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, status: 'archived' as ItemStatus } : item,
    ),
  }));

  try {
    await apiArchiveItem(itemId);              // 3. API call
  } catch (err) {
    console.error('Archive failed, rolling back:', err);
    set({ items: prev });                      // 4. Rollback on failure
  }
},
```

**Selector Pattern in Components:**

```typescript
// Individual selector -- minimizes re-renders
const user = useAuthStore((s) => s.user);

// Destructure when multiple values needed
const { items, loading, fetchItems } = useItemsStore();
```

**Store Reset for Tests:**

```typescript
function resetStore() {
  useItemsStore.setState({ items: [], loading: false, error: null });
}
```

## Component Patterns

**Screen Components (expo-router):**
- Use `export default function ScreenName()` -- required by expo-router file-based routing
- Screens are self-contained -- no extracted sub-components yet
- All screens in `app/` directory: tabs in `app/(tabs)/`, modals in `app/item/[id].tsx`

**Auth Gate in `app/_layout.tsx`:**

```typescript
useEffect(() => {
  if (!initialized) return;
  const currentRoute = segments[0];
  if (!user && !inAuth) {
    router.replace(hasCompletedSetup ? '/onboarding' : '/welcome');
  } else if (user && inAuth) {
    router.replace(hasCompletedSetup ? '/' : '/permissions');
  }
}, [user, initialized, hasCompletedSetup, segments, router]);
```

**Data Fetching -- once in root layout when user available:**

```typescript
useEffect(() => {
  if (!user) return;
  fetchItems(user.id);
  fetchActions(user.id);
  const unsubscribe = startRealtime(user.id);
  return unsubscribe;
}, [user, fetchItems, fetchActions, startRealtime]);
```

**FlatList with Pull-to-Refresh:**

```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  contentContainerStyle={styles.list}
  refreshControl={
    <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#6366F1" />
  }
  ListEmptyComponent={<EmptyState />}
/>
```

**Conditional Rendering -- use ternary, not `&&`:**

```typescript
{item.description ? (
  <Text style={styles.description}>{truncate(item.description, 120)}</Text>
) : null}
```

## Style Patterns

**Always use `StyleSheet.create()` at bottom of each file:**

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14' },
  card: {
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
});
```

**Dark Theme Color Palette -- use these exact hex values:**

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#0F0F14` | Screen backgrounds |
| Surface | `#1A1A24` | Cards, inputs, rows |
| Surface elevated | `#2A2A3A` | Action pills, nested surfaces |
| Primary | `#6366F1` | Accent, active tabs, buttons, links, FAB |
| Primary light | `#818CF8` | Action pill text, URL link text |
| Text primary | `#FFFFFF` | Titles, labels |
| Text secondary | `#9CA3AF` | Descriptions, values |
| Text muted | `#6B7280` | Metadata, inactive tabs, placeholders |
| Danger | `#EF4444` | Delete, error text, sign out |
| Warning | `#F59E0B` | Pending dots, star icons, coming soon, re-classify |
| Success | `#10B981` | Completed actions |
| Border | `#1A1A24` | Tab bar border top |

**No external styling library.** No Tailwind, no styled-components. Pure `StyleSheet.create`.

## Comments

**File-level JSDoc -- every file starts with one:**

```typescript
/**
 * Heuristic classifier -- client-side fallback.
 * Adapted from Stash queue.ts and analyzer.ts.
 *
 * Used in two scenarios:
 * 1. Share extension: instant category hint before Gemini runs
 * 2. Gemini quota exhausted: fallback classification
 */
```

**Section Headers -- ASCII dividers for logical groupings:**

```typescript
// --- Auth -------------------------------------------------------
// --- Items ------------------------------------------------------
// --- Error Types ------------------------------------------------
```

**When to Comment:**
- Module purpose and constraints (e.g., auth uses REST not SDK, share extension must dismiss in <2s)
- Non-obvious algorithms and business rules
- Workarounds and their justification
- Adapted patterns with source attribution: `// Adapted from Stash deadline-extractor.ts`

**JSDoc on exported functions -- minimal, one-line:**

```typescript
/** Set token on SDK so database/storage/functions include Authorization. */
function setToken(token: string | null) {
```

**Do not comment:**
- Obvious getters/setters
- Self-documenting type signatures
- Redundant restatements of what code does

## Function Design

**Size:** Max 50 lines per function (per CLAUDE.md). No function in the codebase exceeds this.

**Parameters:** Max 5. Use options object beyond that:

```typescript
export async function getItems(
  userId: string,
  options: { status?: ItemStatus; category?: Category; limit?: number } = {},
): Promise<Item[]> {
```

**Return Values:**
- Explicit return types on all exported functions
- Service functions return typed data or throw domain errors -- never return `null` for errors
- Exception: `getItemById` returns `Item | null` for not-found
- Store derived accessors always return arrays (empty array, never null)
- Async functions always return `Promise<T>`

**Async/Await:**
- Universally used over `.then()` chains
- Parallel operations with `Promise.all()`:
```typescript
const [user, setupDone] = await Promise.all([
  getCurrentUser(),
  SecureStore.getItemAsync(SETUP_KEY),
]);
```

## Module Design

**Exports:**
- Named exports for everything: `export function saveItem(...)`, `export type Item = ...`
- `export default function` only for screen components (expo-router requires it)
- Singleton services: `export const insforge = createClient(...)`
- Store hooks: `export const useItemsStore = create<ItemsState>(...)`

**No Barrel Files:**
- Direct imports always: `from '@/services/insforge'` not `from '@/services'`

**Separation of Concerns:**
- Services handle I/O: `insforge.ts`, `actions.ts`, `share-handler.ts`
- Stores handle state: `auth.ts`, `items.ts`, `actions.ts`
- Utils are pure (no imports of services/stores): `format.ts`, `url-patterns.ts`
- Types and constants have zero runtime dependencies on services/stores

## Edge Functions (`functions/`)

**Runtime:** Deno (not Node). Import SDK with `npm:` prefix: `import { createClient } from 'npm:@insforge/sdk'`

**Pattern:**
```typescript
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  // ... auth check, business logic, return jsonResponse(...)
}
```

**Auth:** Extract Bearer token from `Authorization` header, pass as `edgeFunctionToken` to SDK client.

**Env vars:** `Deno.env.get('INSFORGE_BASE_URL')` -- not `process.env`.

**Excluded from client tsconfig** -- `"exclude": ["functions"]` in `tsconfig.json`.

## Regex Patterns

**Compiled as module-level constants in `services/classifier.ts`:**

```typescript
const DATE_PATTERN = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/g;
const PRICE_PATTERN = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:\+1\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
```

Named, reusable, never defined inline inside functions.

---

*Convention analysis: 2026-02-18*
