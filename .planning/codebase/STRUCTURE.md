# Codebase Structure

**Analysis Date:** 2026-02-18

## Directory Layout

```
ada/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout + auth gate + realtime init
│   ├── welcome.tsx               # Onboarding: welcome screen
│   ├── onboarding.tsx            # Onboarding: sign in/sign up
│   ├── permissions.tsx           # Onboarding: request calendar/contacts access
│   ├── setup-guide.tsx           # Onboarding: setup walkthrough
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── _layout.tsx           # Tab navigator + bottom tab bar
│   │   ├── index.tsx             # Inbox (pending + recent items)
│   │   ├── library.tsx           # Browse by category
│   │   ├── search.tsx            # Search items
│   │   ├── tasks.tsx             # View/manage actions
│   │   └── settings.tsx          # User preferences, logout
│   └── item/
│       └── [id].tsx              # Item detail (modal overlay)
│
├── services/                      # Domain logic & API integration
│   ├── insforge.ts               # All InsForge SDK calls (database, auth, storage, functions, realtime)
│   ├── share-handler.ts          # Share extension pipeline
│   ├── classifier.ts             # Heuristic fallback classifier
│   └── actions.ts                # Action executors (calendar, reminder, contact, etc.)
│
├── stores/                        # Zustand state management
│   ├── auth.ts                   # User auth state + email verification flow
│   ├── items.ts                  # Items list + filters + realtime subscription
│   └── actions.ts                # Actions list + execution dispatch
│
├── types/                         # TypeScript interfaces & types
│   ├── item.ts                   # Item, Category, ItemStatus, ContentType, RawCapture, ExtractedData
│   ├── action.ts                 # Action, ActionType, ActionStatus
│   └── classification.ts         # AI response schemas
│
├── constants/                     # Compile-time constants
│   ├── categories.ts             # 12 categories with icons, colors, keywords
│   └── config.ts                 # App config, API URLs, timeouts
│
├── utils/                         # Shared utilities
│   ├── url-patterns.ts           # URL detection, domain → category heuristics
│   └── format.ts                 # Date/text formatting (timeAgo, truncate)
│
├── functions/                     # InsForge Edge Functions (Deno)
│   ├── classify/
│   │   └── index.ts              # Main classification pipeline
│   └── summarize/
│       └── index.ts              # On-demand summarization
│
├── share-extension/               # iOS share extension
│   └── index.tsx                 # Share extension UI + entry point
│
├── __tests__/                     # Test files (Vitest)
│   ├── classifier.test.ts
│   ├── url-patterns.test.ts
│   ├── format.test.ts
│   ├── insforge-service.test.ts
│   ├── insforge-queries.test.ts
│   ├── auth-store.test.ts
│   ├── items-store.test.ts
│   ├── actions-store.test.ts
│   ├── actions.test.ts
│   ├── share-handler.test.ts
│   └── categories.test.ts
│
├── assets/                        # Images, icons
│   ├── icon.png
│   └── splash.png
│
├── app.json                       # Expo config (name, version, plugins, share extension)
├── eas.json                       # EAS Build profiles
├── babel.config.js                # Babel preset (Expo)
├── tsconfig.json                  # TypeScript config (strict mode)
├── vitest.config.ts              # Vitest test runner config
├── package.json                   # Dependencies (Expo, Zustand, InsForge, Vitest, etc.)
├── CLAUDE.md                      # Project documentation
└── .env                           # Environment variables (InsForge URL, anon key)
```

## Directory Purposes

**app/ (Expo Router):**
- Purpose: All screens and navigation flows
- Contains: TSX screens for authentication, tabs, modals, detail views
- Key files: `_layout.tsx` (root), `(tabs)/_layout.tsx` (tab navigator), `(tabs)/index.tsx` (inbox)

**services/:**
- Purpose: Business logic, external API integration, data transformations
- Contains: InsForge SDK wrapper, share pipeline, classifier, action executors
- Key files: `insforge.ts` (≈480 lines, all DB/auth/storage/functions), `share-handler.ts` (item pipeline)

**stores/:**
- Purpose: Client-side state management (user session, items, actions)
- Contains: Zustand store definitions with selectors and async actions
- Key files: `auth.ts` (auth state + setup), `items.ts` (items + realtime), `actions.ts` (actions execution)

**types/:**
- Purpose: Shared TypeScript interfaces (single source of truth)
- Contains: Type definitions for Item, Action, Classification, Category, ContentType
- Key files: `item.ts` (domain entity), `action.ts` (action entity), `classification.ts` (AI response schema)

**constants/:**
- Purpose: Compile-time configuration and lookup tables
- Contains: Category definitions (icons, colors, keywords), app config (URLs, timeouts)
- Key files: `categories.ts` (12 categories), `config.ts` (InsForge URL, AI models, limits)

**utils/:**
- Purpose: Shared pure functions (no side effects, no state)
- Contains: URL heuristics, formatting helpers
- Key files: `url-patterns.ts` (domain rules, URL detection), `format.ts` (date/text helpers)

**functions/:**
- Purpose: Deno edge functions (run on InsForge serverless)
- Contains: Classification pipeline, summarization
- Key files: `classify/index.ts` (Jina → AI → DB update)

**share-extension/:**
- Purpose: iOS share extension entry point
- Contains: Single TSX component (minimal—dismisses in <2 sec)
- Key files: `index.tsx` (40 lines, calls share-handler)

**__tests__/:**
- Purpose: Vitest test files
- Contains: Unit and integration tests for services, stores, utilities
- Key files: 10 test files covering classifiers, stores, handlers

## Key File Locations

**Entry Points:**

- `app/_layout.tsx`: Root layout, auth gate, realtime init (103 lines)
- `share-extension/index.tsx`: Share extension UI (112 lines)
- `app/(tabs)/_layout.tsx`: Tab navigator definition

**Configuration:**

- `constants/config.ts`: InsForge URL, AI models, timeouts (35 lines)
- `constants/categories.ts`: 12 categories with icons/colors/keywords
- `app.json`: Expo config, share extension plugin, build settings
- `tsconfig.json`: TypeScript strict mode settings
- `vitest.config.ts`: Test runner config

**Core Logic:**

- `services/insforge.ts`: All DB/auth/storage calls (479 lines)
- `services/share-handler.ts`: Share pipeline (111 lines)
- `services/classifier.ts`: Heuristic classifier fallback
- `functions/classify/index.ts`: Edge function classification (328 lines)

**State Management:**

- `stores/auth.ts`: Auth store (215 lines)
- `stores/items.ts`: Items store (225 lines)
- `stores/actions.ts`: Actions store (110 lines)

**Screens:**

- `app/(tabs)/index.tsx`: Inbox (356 lines)
- `app/(tabs)/library.tsx`: Browse by category
- `app/(tabs)/search.tsx`: Search
- `app/(tabs)/settings.tsx`: Settings + logout
- `app/item/[id].tsx`: Item detail + actions
- `app/onboarding.tsx`: Sign in/sign up form

## Naming Conventions

**Files:**

- React components: PascalCase, named exports (e.g., `function InboxScreen()`)
- Services: camelCase, all exports (e.g., `services/insforge.ts`)
- Stores: camelCase, end with `.ts`, default export (e.g., `stores/auth.ts`)
- Tests: `{module}.test.ts` (e.g., `classifier.test.ts`)
- Edge functions: `index.ts` in folder (e.g., `functions/classify/index.ts`)

**Functions:**

- Async operations: camelCase, verb-first (e.g., `saveItem()`, `fetchItems()`, `archiveItem()`)
- Selectors/accessors: get/is prefix (e.g., `getByStatus()`, `isLikelyUrl()`)
- Event handlers: handle/on prefix (e.g., `handleAdd()`, `onRefresh()`)

**Variables:**

- State: camelCase (e.g., `items`, `loading`, `error`)
- Constants: UPPER_SNAKE_CASE (e.g., `TOKEN_KEY`, `CLASSIFY_PROMPT`)
- Types/Interfaces: PascalCase (e.g., `Item`, `Action`, `AuthUser`)

**Types/Interfaces:**

- Entity types: PascalCase, no prefix (e.g., `Item`, `Action`, `User`)
- State interface: `{EntityName}State` (e.g., `ItemsState`, `AuthState`)
- Response types: `{Name}Response` (e.g., `SignUpResponse`, `ClassificationResult`)
- Error classes: `{Name}Error` (e.g., `AuthError`, `DatabaseError`)

## Where to Add New Code

**New Feature (e.g., wishlist, sharing):**
- Primary code: Create service in `services/{feature}.ts` with core logic
- Integration: Export from service and use in stores/screens
- Tests: Add `__tests__/{feature}.test.ts` with at least 80% coverage
- Types: Add to `types/{feature}.ts` if new domain entity

**New Screen/Tab:**
- Implementation: Create `app/(tabs)/{screen}.tsx` or `app/{screen}.tsx`
- State: Use existing stores (items, auth, actions) or create new store in `stores/{screen}.ts`
- Connect to router: Add `<Stack.Screen>` in root layout `_layout.tsx`

**New Utility Function:**
- Shared helpers: Add to `utils/{category}.ts` (e.g., `utils/date-helpers.ts`)
- Pure functions only (no side effects, no imports from services/stores)
- Export as named export
- Test in `__tests__/{category}.test.ts`

**New Category/Constant:**
- App-wide constants: Add to `constants/config.ts`
- Category-specific: Add to `constants/categories.ts` and update `CATEGORY_VALUES` type

**New Action Type:**
- Handler: Add case to `services/actions.ts` `executeAction()` function
- Type: Add to `ActionType` union in `types/action.ts`
- UI: Add label to `ACTION_LABELS` in screens using actions
- Tests: Test handler in `__tests__/actions.test.ts`

**Edge Function (Deno):**
- Create `functions/{name}/index.ts` (Deno module)
- Must export async `handler(req: Request): Promise<Response>`
- Use `Deno.env.get()` for secrets, `npm:@insforge/sdk` for SDK
- Invoke from client: `insforge.functions.invoke('{name}', { body: {...} })`

## Special Directories

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No

**.expo/:**
- Purpose: Expo CLI metadata, types
- Generated: Yes (managed by Expo)
- Committed: No (in .gitignore)

**.git/:**
- Purpose: Git history
- Generated: Yes
- Committed: N/A

**ada/ (subdirectory):**
- Purpose: Experimental features or separate workspace
- Currently unused/empty

---

*Structure analysis: 2026-02-18*
