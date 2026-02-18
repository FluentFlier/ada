# Codebase Structure

**Analysis Date:** 2026-02-18

## Directory Layout

```
Ada/
├── app/                               # Expo Router (file-based routing)
│   ├── _layout.tsx                    # Root layout: auth gate, realtime init, route guard
│   ├── welcome.tsx                    # First-run welcome carousel (3 pages)
│   ├── onboarding.tsx                 # Sign in / sign up / email verification
│   ├── permissions.tsx                # Request calendar permissions (post-auth)
│   ├── setup-guide.tsx                # 4-step share sheet setup walkthrough
│   ├── (tabs)/                        # Tab-based main navigation
│   │   ├── _layout.tsx                # Tab navigator (5 tabs: Inbox, Library, Search, Tasks, Settings)
│   │   ├── index.tsx                  # Inbox: pending + recent items, FAB to add
│   │   ├── library.tsx                # Browse by category with horizontal filter pills
│   │   ├── search.tsx                 # Client-side search across all item fields
│   │   ├── tasks.tsx                  # Pending + completed actions with execute/dismiss
│   │   └── settings.tsx               # Account info, stats, sign out
│   └── item/
│       └── [id].tsx                   # Item detail modal: extracted data, actions, notes
│
├── services/                          # Domain logic & API integration
│   ├── insforge.ts                    # ALL InsForge SDK calls: database, auth, storage, functions, realtime
│   ├── share-handler.ts              # Share extension pipeline: detect type → classify → save → trigger
│   ├── classifier.ts                  # Heuristic fallback classifier (URL domains + keywords)
│   └── actions.ts                     # Action executors: calendar, reminder, summarize dispatch
│
├── stores/                            # Zustand state management
│   ├── auth.ts                        # User session, email verification, setup completion
│   ├── items.ts                       # Items list, optimistic mutations, realtime subscription
│   └── actions.ts                     # Actions list, execute/dismiss with optimistic rollback
│
├── types/                             # TypeScript interfaces & type unions
│   ├── item.ts                        # Item, Category (12-union), ContentType, ItemStatus, ExtractedData, RawCapture
│   ├── action.ts                      # Action, ActionType (6-union), ActionStatus, CalendarActionData, ReminderActionData
│   └── classification.ts             # ClassificationResult, ClassifyRequest, ClassifyResponse
│
├── constants/                         # Compile-time constants & lookup tables
│   ├── categories.ts                  # 12 categories: id, label, icon, color, bgColor, keywords[]
│   ├── config.ts                      # InsForge URL/key, AI models, Jina config, share extension limits
│   └── actions.ts                     # ACTION_LABELS, ACTION_LABELS_SHORT, PLACEHOLDER_ACTIONS set
│
├── utils/                             # Pure utility functions (no side effects)
│   ├── url-patterns.ts                # 40+ domain→category rules, matchUrlToCategory(), isLikelyUrl()
│   └── format.ts                      # timeAgo(), smartDate(), truncate(), cleanUrl(), confidenceLabel()
│
├── functions/                         # InsForge Edge Functions (Deno runtime)
│   ├── classify/
│   │   └── index.ts                   # Classification: Jina Reader → gpt-4o-mini → DB update → realtime
│   └── summarize/
│       └── index.ts                   # Summarization: Jina Reader → claude-sonnet-4.5 → action update
│
├── share-extension/                   # iOS Share Extension (separate process)
│   └── index.tsx                      # Entry point: auth check → processSharedContent → dismiss
│
├── __tests__/                         # Vitest test files
│   ├── classifier.test.ts            # Heuristic classifier unit tests
│   ├── url-patterns.test.ts          # URL pattern matching tests
│   ├── format.test.ts                # Formatting utility tests
│   ├── insforge-service.test.ts      # InsForge service layer tests
│   ├── insforge-queries.test.ts      # Database query tests
│   ├── auth-store.test.ts            # Auth Zustand store tests
│   ├── items-store.test.ts           # Items Zustand store tests
│   ├── actions-store.test.ts         # Actions Zustand store tests
│   ├── actions.test.ts               # Action execution service tests
│   ├── share-handler.test.ts         # Share handler pipeline tests
│   └── categories.test.ts            # Category definitions tests
│
├── assets/                            # Static assets
│   ├── icon.png                       # App icon
│   └── splash.png                     # Splash screen image
│
├── ada/                               # Unused subdirectory (empty or experimental)
│
├── app.json                           # Expo config: name, version, plugins, share extension setup
├── eas.json                           # EAS Build profiles (development, preview, production)
├── babel.config.js                    # Babel preset (expo)
├── tsconfig.json                      # TypeScript: strict mode, path alias @/ → ./
├── vitest.config.ts                   # Vitest: globals, node env, @/ alias, __tests__/**/*.test.ts
├── package.json                       # Dependencies, scripts (start, test, typecheck, lint)
├── CLAUDE.md                          # Project documentation and engineering standards
└── .env                               # Environment variables (InsForge URL, anon key) — DO NOT READ
```

## Directory Purposes

**`app/` (Expo Router):**
- Purpose: All screens and navigation flows, file-based routing
- Contains: 11 TSX screen files across root, tabs group, and item modal
- Key files: `_layout.tsx` (root auth gate, 102 lines), `(tabs)/index.tsx` (inbox, 367 lines), `item/[id].tsx` (detail, 468 lines)
- Route groups: `(tabs)/` for main tab navigation, `item/` for modal presentation

**`services/`:**
- Purpose: Business logic, InsForge SDK integration, action execution
- Contains: 4 service modules totaling ~1,035 lines
- Key files: `insforge.ts` (490 lines — single gateway to all backend APIs), `classifier.ts` (257 lines — heuristic classification engine)
- Rule: Only `insforge.ts` imports `@insforge/sdk` directly

**`stores/`:**
- Purpose: Client-side state management with Zustand
- Contains: 3 store files totaling ~569 lines
- Key files: `items.ts` (241 lines — includes realtime subscription), `auth.ts` (216 lines — full auth flow with email verification)
- Pattern: All stores export a single `use{Name}Store` hook created with `create<State>()`

**`types/`:**
- Purpose: Shared TypeScript interfaces and type unions (single source of truth)
- Contains: 3 type definition files totaling ~150 lines
- Key files: `item.ts` (74 lines — defines `Item`, `Category` 12-value union, `ContentType`, `ExtractedData`)
- Note: `CATEGORY_VALUES` array exported from `types/item.ts` is the canonical list of category IDs

**`constants/`:**
- Purpose: Compile-time configuration, lookup tables, display labels
- Contains: 3 files totaling ~222 lines
- Key files: `categories.ts` (158 lines — 12 category definitions with keywords for heuristic matching)
- `config.ts` (34 lines) is `as const` frozen object

**`utils/`:**
- Purpose: Pure functions with no side effects, no imports from services or stores
- Contains: 2 utility files totaling ~213 lines
- Key files: `url-patterns.ts` (118 lines — 40+ domain matching rules)

**`functions/`:**
- Purpose: InsForge Edge Functions running on Deno serverless
- Contains: 2 edge function directories with `index.ts` entry points
- Key files: `classify/index.ts` (332 lines), `summarize/index.ts` (172 lines)
- Note: Excluded from `tsconfig.json` — uses Deno-specific imports (`npm:@insforge/sdk`, `Deno.env.get()`)

**`share-extension/`:**
- Purpose: iOS Share Extension entry point (separate iOS process)
- Contains: Single `index.tsx` file (119 lines)
- Constraint: Must dismiss in <2 seconds, 120MB memory limit

**`__tests__/`:**
- Purpose: All test files in one directory (not co-located)
- Contains: 11 test files totaling ~2,036 lines
- Pattern: `{module-name}.test.ts` naming convention
- Runner: Vitest with `globals: true` (no need to import `describe`/`it`/`expect`)

## Key File Locations

**Entry Points:**
- `app/_layout.tsx`: Root layout — auth gate, store initialization, realtime setup (102 lines)
- `share-extension/index.tsx`: Share extension — auth check, pipeline call, dismiss (119 lines)
- `app/(tabs)/_layout.tsx`: Tab navigator — 5 tabs with icons (81 lines)
- `functions/classify/index.ts`: Classify edge function entry (332 lines)
- `functions/summarize/index.ts`: Summarize edge function entry (172 lines)

**Configuration:**
- `constants/config.ts`: InsForge URL, AI model names, Jina URL, timeouts, share extension limits (34 lines)
- `constants/categories.ts`: 12 categories with icons, colors, keywords for heuristic matching (158 lines)
- `constants/actions.ts`: Action display labels and placeholder action set (29 lines)
- `tsconfig.json`: TypeScript strict mode, `@/` path alias to project root (23 lines)
- `vitest.config.ts`: Test runner config with `@/` alias resolution (15 lines)
- `package.json`: Scripts — `start`, `ios`, `typecheck`, `test`, `test:watch`, `lint` (42 lines)

**Core Logic:**
- `services/insforge.ts`: ALL backend API calls — auth REST, database CRUD, storage upload, function invoke, realtime subscribe (490 lines)
- `services/classifier.ts`: Heuristic classifier — URL domain matching, keyword matching, data extraction, urgency estimation, action suggestion (257 lines)
- `services/share-handler.ts`: Share extension pipeline — detect type, heuristic classify, save, upload image, trigger async classify (110 lines)
- `services/actions.ts`: Action execution — calendar event creation, notification scheduling, summarize dispatch (178 lines)
- `functions/classify/index.ts`: Server-side AI classification — Jina Reader, gpt-4o-mini, DB update, action creation, realtime publish (332 lines)

**State Management:**
- `stores/auth.ts`: Auth state — initialize, signUp, signIn, signOut, verifyEmail, completeSetup (216 lines)
- `stores/items.ts`: Items state — CRUD, optimistic updates, realtime subscription, search/filter accessors (241 lines)
- `stores/actions.ts`: Actions state — fetch, execute with optimistic update, dismiss (112 lines)

**Type Definitions:**
- `types/item.ts`: `Item`, `Category`, `ContentType`, `ItemStatus`, `ExtractedData`, `SuggestedAction`, `RawCapture` (74 lines)
- `types/action.ts`: `Action`, `ActionType`, `ActionStatus`, `CalendarActionData`, `ReminderActionData` (46 lines)
- `types/classification.ts`: `ClassificationResult`, `ClassifyRequest`, `ClassifyResponse` (30 lines)

**Screens (by line count):**
- `app/item/[id].tsx`: Item detail with actions, notes, archive/delete (468 lines)
- `app/(tabs)/index.tsx`: Inbox with FAB add, action pills, pull-to-refresh (367 lines)
- `app/onboarding.tsx`: Sign in/up + email verification (305 lines)
- `app/(tabs)/tasks.tsx`: Actions list with section headers (249 lines)
- `app/(tabs)/library.tsx`: Category browser with filter pills (193 lines)
- `app/welcome.tsx`: Welcome carousel (179 lines)
- `app/setup-guide.tsx`: Setup walkthrough (167 lines)
- `app/(tabs)/settings.tsx`: Account info and sign out (129 lines)
- `app/(tabs)/search.tsx`: Search with 2-char minimum (115 lines)
- `app/permissions.tsx`: Calendar permission request (105 lines)

**Testing:**
- `__tests__/items-store.test.ts`: Items store tests (508 lines — largest test file)
- `__tests__/actions.test.ts`: Action execution tests (427 lines)
- `__tests__/auth-store.test.ts`: Auth store tests (315 lines)
- `__tests__/actions-store.test.ts`: Actions store tests (208 lines)
- `__tests__/insforge-queries.test.ts`: Database query tests (199 lines)
- `__tests__/insforge-service.test.ts`: InsForge service tests (185 lines)
- `__tests__/classifier.test.ts`: Heuristic classifier tests (121 lines)
- `__tests__/categories.test.ts`: Category definition tests (113 lines)
- `__tests__/url-patterns.test.ts`: URL pattern tests (111 lines)
- `__tests__/format.test.ts`: Format utility tests (107 lines)
- `__tests__/share-handler.test.ts`: Share handler tests (59 lines)

## Naming Conventions

**Files:**
- Screen components: `kebab-case.tsx` (expo-router convention) — e.g., `setup-guide.tsx`, `[id].tsx`
- Services: `kebab-case.ts` — e.g., `share-handler.ts`, `insforge.ts`
- Stores: `lowercase.ts` — e.g., `auth.ts`, `items.ts`, `actions.ts`
- Types: `lowercase.ts` — e.g., `item.ts`, `action.ts`, `classification.ts`
- Constants: `kebab-case.ts` — e.g., `categories.ts`, `config.ts`
- Utils: `kebab-case.ts` — e.g., `url-patterns.ts`, `format.ts`
- Tests: `{module-name}.test.ts` — e.g., `classifier.test.ts`, `auth-store.test.ts`
- Edge functions: `index.ts` inside named directory — e.g., `functions/classify/index.ts`

**Directories:**
- `kebab-case` for all directories — e.g., `share-extension/`, `__tests__/`
- expo-router groups use `(parens)` — e.g., `(tabs)/`
- Dynamic routes use `[brackets]` — e.g., `item/[id].tsx`

## Module Dependencies

**Dependency Graph (simplified, arrows = "imports from"):**

```
app/ screens
  → stores/ (useAuthStore, useItemsStore, useActionsStore)
  → services/insforge.ts (saveItem, triggerClassify)
  → constants/ (categories, config, actions)
  → utils/ (format, url-patterns)
  → types/ (Item, Action, Category)

stores/
  → services/insforge.ts (getItems, saveItem, subscribeToItems, etc.)
  → services/actions.ts (executeAction)
  → types/

services/insforge.ts
  → @insforge/sdk (createClient)
  → expo-secure-store
  → constants/config.ts (CONFIG)
  → types/

services/classifier.ts
  → constants/categories.ts (CATEGORIES)
  → utils/url-patterns.ts (matchUrlToCategory, isLikelyUrl)
  → types/

services/share-handler.ts
  → services/insforge.ts (saveItem, uploadImage, updateItem, triggerClassify)
  → services/classifier.ts (classifyHeuristic)
  → utils/url-patterns.ts (isLikelyUrl)
  → constants/config.ts (CONFIG)
  → types/

services/actions.ts
  → services/insforge.ts (updateActionStatus, triggerSummarize)
  → expo-calendar
  → expo-notifications
  → types/

share-extension/index.tsx
  → services/share-handler.ts (processSharedContent)
  → services/insforge.ts (getCurrentUser)
  → constants/ (categories, config)

functions/ (Deno — completely separate dependency tree)
  → npm:@insforge/sdk
  → Deno.env
  → Jina Reader API (fetch)
```

**Key rule:** Only `services/insforge.ts` imports `@insforge/sdk`. All other modules go through it.

## Where to Add New Code

**New Feature (e.g., tag system, collections):**
- Types: Add to `types/{feature}.ts` if introducing a new domain entity
- Service: Create `services/{feature}.ts` for business logic and API calls
- Store: Create `stores/{feature}.ts` if feature needs persistent client state
- Screen: Add screen in `app/` following expo-router conventions
- Constants: Add display constants to `constants/{feature}.ts`
- Tests: Add `__tests__/{feature}.test.ts` and `__tests__/{feature}-store.test.ts`

**New Tab Screen:**
- Create `app/(tabs)/{name}.tsx` with default export function
- Add `<Tabs.Screen>` entry in `app/(tabs)/_layout.tsx`
- Use existing stores via hooks (`useItemsStore`, `useAuthStore`, etc.)

**New Modal/Detail Screen:**
- Create `app/{name}.tsx` or `app/{group}/[param].tsx`
- Add `<Stack.Screen>` entry in `app/_layout.tsx` with `presentation: 'modal'` if modal
- For protected routes, ensure root layout auth guard handles the route

**New Action Type:**
1. Add to `ActionType` union in `types/action.ts`
2. Add execution handler in `services/actions.ts` `executeAction()` switch statement
3. Add display labels in `constants/actions.ts` (`ACTION_LABELS`, `ACTION_LABELS_SHORT`)
4. If not yet implemented, add to `PLACEHOLDER_ACTIONS` set in `constants/actions.ts`
5. Update AI prompt in `functions/classify/index.ts` to include the new action type in suggestions
6. Add tests in `__tests__/actions.test.ts`

**New Edge Function:**
1. Create `functions/{name}/index.ts`
2. Export default async `handler(req: Request): Promise<Response>`
3. Use `Deno.env.get()` for secrets, `npm:@insforge/sdk` for SDK
4. Include CORS headers and OPTIONS handling
5. Extract auth token from `Authorization` header, pass as `edgeFunctionToken`
6. Add invoke helper in `services/insforge.ts`: `export async function trigger{Name}(...) { ... }`

**New Category:**
1. Add to `Category` union type in `types/item.ts`
2. Add to `CATEGORY_VALUES` array in `types/item.ts`
3. Add definition (id, label, icon, color, bgColor, keywords) in `constants/categories.ts`
4. Update AI prompt in `functions/classify/index.ts` to include the new category

**New Utility:**
- Add to existing file if related (e.g., new date helper → `utils/format.ts`)
- Create new `utils/{name}.ts` if unrelated to existing utilities
- Must be pure functions — no side effects, no imports from `services/` or `stores/`
- Add tests in `__tests__/{name}.test.ts`

**New Constant/Config:**
- App-wide config: Add to `constants/config.ts` `CONFIG` object (it is `as const`)
- Display labels: Add to appropriate file in `constants/`

## Special Directories

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**`.expo/`:**
- Purpose: Expo CLI metadata, generated type definitions
- Generated: Yes (managed by Expo)
- Committed: Partially (`.expo/types/` may be committed for router types)

**`functions/`:**
- Purpose: Edge functions deployed to InsForge
- Generated: No (hand-written)
- Committed: Yes
- Note: Excluded from `tsconfig.json` — uses Deno runtime with different module resolution

**`ada/`:**
- Purpose: Unknown/unused subdirectory
- Generated: No
- Committed: Yes but appears empty or experimental

**`assets/`:**
- Purpose: Static image assets (app icon, splash screen)
- Generated: No
- Committed: Yes

## Import Aliases

**Path alias `@/` resolves to project root:**
- Configured in: `tsconfig.json` (`"paths": { "@/*": ["./*"] }`)
- Also configured in: `vitest.config.ts` (`resolve.alias: { '@': path.resolve(__dirname, '.') }`)
- Usage: `import { useAuthStore } from '@/stores/auth'`
- All non-relative imports use `@/` prefix

---

*Structure analysis: 2026-02-18*
