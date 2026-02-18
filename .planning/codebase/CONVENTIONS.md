# Coding Conventions

**Analysis Date:** 2026-02-18

## Naming Patterns

**Files:**
- Service modules: lowercase with hyphens, describe function: `classifier.ts`, `share-handler.ts`, `url-patterns.ts`
- Store modules: lowercase with hyphens, describe Zustand store: `auth.ts`, `items.ts`, `actions.ts`
- Type definition files: singular noun, lowercase: `item.ts`, `action.ts`, `classification.ts`
- Constants/config modules: descriptive lowercase: `categories.ts`, `config.ts`
- Test files: same name as source with `.test.ts` suffix: `classifier.test.ts`, `items-store.test.ts`

**Functions:**
- camelCase universally
- Action creators/executors: verb prefix: `executeCalendarAction`, `executeReminderAction`, `fetchItems`, `saveItem`
- Derived/query functions: `getByStatus`, `getByCategory`, `getStarred`, `searchItems`
- Utilities: descriptive verbs: `timeAgo`, `truncate`, `cleanUrl`, `confidenceLabel`, `matchUrlToCategory`
- Private/internal functions: camelCase, used as named export but conceptually private when prefixed with intent `extractDataFromText`, `estimateUrgency`, `buildResult`, `matchByKeywords`

**Variables:**
- State variables: camelCase: `items`, `loading`, `error`, `pendingEmail`, `hasCompletedSetup`
- Constants: UPPER_SNAKE_CASE only for module-level constants: `TOKEN_KEY = 'insforge_access_token'`, `MINUTE = 60_000`, `DOMAIN_RULES`, `CATEGORIES`
- Boolean properties: `is_` or `has_` or `needs_`: `is_starred`, `is_likely_url`, `hasCompletedSetup`, `needsEmailVerification`
- Loop/temporary variables: single letter acceptable in tight loops only: `for (const [categoryId, def] of Object.entries(...))`

**Types:**
- Named exports, PascalCase: `Item`, `Category`, `ContentType`, `Action`, `ActionStatus`, `ExtractedData`
- Type unions: uppercase variants: `type ItemStatus = 'pending' | 'classified' | 'archived'`
- Interfaces (rare, only for complex shapes): PascalCase: `ItemsState`, `AuthState`, `HeuristicInput`
- Never use `any`, use `unknown` + type guards

## Code Style

**Formatting:**
- Prettier (implicit via TypeScript strict): not explicitly configured, follows expo defaults
- Line length: 100 characters soft limit (observed consistently)
- Indentation: 2 spaces
- Semicolons: required
- Trailing commas: yes (arrays/objects spanning lines)
- No trailing whitespace

**Linting:**
- TypeScript strict mode enabled: `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `exactOptionalPropertyTypes: false`
- ESLint configured (no `.eslintrc` found, uses defaults)
- No bare `any` types — always use `unknown` with type guards

Example of type guard pattern from `services/insforge.ts`:
```typescript
// Instead of: const json = data as any
const json = await res.json();  // typed from context
// For truly unknown: const msg = payload as { item?: Item }
```

## Import Organization

**Order:**
1. External/SDK imports: `import { createClient } from '@insforge/sdk'`, `import { create } from 'zustand'`
2. React/Expo imports: `import { Platform } from 'react-native'`, `import * as Calendar from 'expo-calendar'`
3. Local service/store imports: `import { getItems, archiveItem } from '@/services/insforge'`
4. Type imports: `import type { Item, ItemStatus } from '@/types/item'`
5. No wildcard `import *` except for modules exporting many constants (e.g., `import * as Calendar`)

**Path Aliases:**
- Configured: `@/*` maps to root directory
- Usage: `@/services/classifier`, `@/stores/items`, `@/types/item`, `@/utils/format`, `@/constants/categories`

## Error Handling

**Patterns:**
- Custom error classes extend `Error`: `class DatabaseError extends Error`, `class ActionError extends Error`
- Errors include context: `throw new DatabaseError('Failed to fetch items', error)` where error is the cause
- Error type narrowing: `err instanceof DatabaseError ? err.message : 'generic fallback'`
- Try-catch blocks catch specific errors, re-throw or convert: in stores, catch specific errors and convert to readable messages
- API failures: log via `console.error()` when non-critical, throw for critical paths
- Example from `services/insforge.ts`:
  ```typescript
  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`;
    throw new AuthError(msg, json);
  }
  ```

**Fail-fast approach:**
- Don't propagate bad state
- Empty data validation: `if (!data || data.length === 0) throw new DatabaseError(...)`
- Null checks early: `if (!updated) return;`

## Logging

**Framework:** console (no special logger)

**Patterns:**
- Errors: `console.error('Context:', err)`
- Warnings: rarely used (no pattern yet)
- Info/debug: no info logs, only critical errors logged
- Location examples:
  - `services/insforge.ts` logs realtime connection failures: `console.error('Realtime connect failed:', err)`
  - Store catch blocks: `console.error('Archive failed, rolling back:', err)`

## Comments

**When to Comment:**
- Module header: explain purpose and constraints (e.g., auth uses REST not SDK)
- Non-obvious algorithms: extract data patterns, urgency estimation
- Workarounds: why something is done that way (e.g., `// DEV ONLY: auto-login`)
- Adapted from external code: cite source (e.g., `// Adapted from Stash analyzer.ts`)

**JSDoc/TSDoc:**
- Minimal: one-line summaries for public functions
- Examples from `services/classifier.ts`:
  ```typescript
  /**
   * Run heuristic classification on raw content.
   * Fast, deterministic, works offline.
   */
  export function classifyHeuristic(input: HeuristicInput): ClassificationResult
  ```
- Not used for obvious getters/setters
- Type signatures are self-documenting

## Function Design

**Size:** Max 50 lines (observed limit, no function exceeds this)

**Parameters:** Max 5; use options object for more
- Example: `getItems(userId, options?: { status?, category?, limit? })`
- Async functions take data + options: `function saveItem(userId: string, capture: RawCapture)`

**Return Values:**
- Explicit types on all exports
- Never void unless intentional: `async function signOut(): Promise<void>`
- Async always returns Promise: `Promise<Item>`, `Promise<Item[]>`, `Promise<void>`
- Query functions return arrays (never null): `.slice(0, 3)` not `null`

**Async/Await:**
- Universally used over `.then()`
- Error handling: try-catch blocks
- Concurrency: `Promise.all()` for parallel operations
- Example from `stores/auth.ts`:
  ```typescript
  const [user, setupDone] = await Promise.all([
    getCurrentUser(),
    SecureStore.getItemAsync(SETUP_KEY),
  ]);
  ```

## Module Design

**Exports:**
- Named exports for functions and types: `export function saveItem(...)`, `export type Item = ...`
- No default exports except screen components (Expo Router pattern)
- Singleton services exported as named: `export const insforge = createClient(...)`
- Store exports: `export const useItemsStore = create<ItemsState>(...)`

**Barrel Files:**
- Not used; imports are explicit `from '@/services/insforge'` not `from '@/services'`

**Separation of Concerns:**
- Services handle I/O: `insforge.ts`, `actions.ts`, `share-handler.ts`
- Stores handle state: `auth.ts`, `items.ts`, `actions.ts`
- Types live in `types/`
- Constants live in `constants/`
- Utils are pure: `format.ts`, `url-patterns.ts`, `classifier.ts`

## Zustand Store Patterns

**Structure:**
- State interface describes all fields: `interface ItemsState { items: Item[]; loading: boolean; ... }`
- Create store with `create<State>((set, get) => ({ ... }))`
- All actions are methods on the state object
- Derived accessors alongside mutations

**Optimistic Updates:**
```typescript
// Save previous state
const prev = get().items;

// Optimistic update
set((state) => ({
  items: state.items.map((item) =>
    item.id === itemId ? { ...item, status: 'archived' } : item
  ),
}));

// Try API call, roll back on failure
try {
  await apiArchiveItem(itemId);
} catch (err) {
  set({ items: prev });
}
```

**Error State:**
- Always include `error: string | null` field
- Set on failure: `set({ error: message, loading: false })`
- Clear on retry: `set({ error: null })`

## Class Definitions

**Error Classes:**
```typescript
class AdaError extends Error {
  public readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}
```

**Specific errors extend AdaError:**
```typescript
export class DatabaseError extends AdaError {}
export class AuthError extends AdaError {}
```

## Regular Expressions

**Compiled as module-level constants:**
```typescript
const DATE_PATTERN = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/g;
const PRICE_PATTERN = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
```

**Named, reusable, tested individually**

---

*Convention analysis: 2026-02-18*
