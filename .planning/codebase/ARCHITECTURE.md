# Architecture

**Analysis Date:** 2026-02-18

## Pattern Overview

**Overall:** Client-server architecture with Expo (React Native) frontend, InsForge BaaS backend, and Deno edge functions for server-side AI processing.

**Key Characteristics:**
- Single centralized service layer (`services/insforge.ts`) mediates ALL backend communication — no other file imports `@insforge/sdk`
- Zustand stores manage client-side state with optimistic updates and snapshot-based rollback
- Edge functions handle heavyweight AI/ML work server-side, triggered fire-and-forget from client
- Realtime channel-based pub/sub pushes classification results back to client
- Share extension runs as a separate iOS process with strict 120MB memory / 2s time constraints
- Auth bypasses SDK's browser-dependent module, using direct REST `fetch()` instead

## Layers

**UI Layer (Screens):**
- Purpose: React Native screens rendered by expo-router file-based routing
- Location: `app/`
- Contains: Screen components (tabs, modals, onboarding flow), inline StyleSheet definitions
- Depends on: Stores (`stores/`), Services (`services/insforge.ts`), Constants (`constants/`), Utils (`utils/`)
- Used by: expo-router navigation system

**Store Layer (State Management):**
- Purpose: Global state with Zustand; holds items, actions, and auth data in memory
- Location: `stores/`
- Contains: Three stores — `auth.ts` (216 lines), `items.ts` (241 lines), `actions.ts` (112 lines)
- Depends on: Services (`services/insforge.ts`, `services/actions.ts`)
- Used by: UI layer screens, root layout

**Service Layer (Backend Communication):**
- Purpose: All InsForge SDK calls, auth REST calls, action execution, content processing
- Location: `services/`
- Contains: `insforge.ts` (490 lines — DB/auth/storage/functions/realtime), `actions.ts` (178 lines — action execution via expo-calendar/notifications), `classifier.ts` (257 lines — heuristic fallback), `share-handler.ts` (110 lines — share extension pipeline)
- Depends on: `@insforge/sdk`, `expo-calendar`, `expo-notifications`, `expo-secure-store`
- Used by: Store layer, share extension entry point

**Edge Functions (Server-Side AI):**
- Purpose: Heavyweight AI classification and summarization, runs on Deno
- Location: `functions/`
- Contains: `classify/index.ts` (332 lines), `summarize/index.ts` (172 lines)
- Depends on: `npm:@insforge/sdk` (Deno import), Jina Reader API, InsForge AI Gateway
- Used by: Triggered via `insforge.functions.invoke()` from client service layer
- Runtime: Deno (excluded from `tsconfig.json`)

**Type Layer:**
- Purpose: TypeScript type definitions shared across all layers
- Location: `types/`
- Contains: `item.ts` (74 lines), `action.ts` (46 lines), `classification.ts` (30 lines)
- Depends on: Nothing
- Used by: All other layers

**Constants Layer:**
- Purpose: Static configuration and category definitions
- Location: `constants/`
- Contains: `categories.ts` (158 lines — 12 category definitions with keywords/colors/icons), `config.ts` (34 lines — app-wide config), `actions.ts` (29 lines — action labels and placeholder set)
- Depends on: Types (`types/item.ts`)
- Used by: UI layer, classifier service, share handler

**Utils Layer:**
- Purpose: Pure utility functions with no side effects
- Location: `utils/`
- Contains: `format.ts` (95 lines — timeAgo, smartDate, truncate, cleanUrl, confidenceLabel, capitalize), `url-patterns.ts` (118 lines — domain-to-category mapping rules, URL detection)
- Depends on: Types (`types/item.ts`)
- Used by: UI layer, classifier service, share handler

## Data Flow

**Item Creation (Main App — Manual Add via Inbox FAB):**

1. User types content in Inbox FAB input (`app/(tabs)/index.tsx` line 58, `handleAdd`)
2. `isLikelyUrl()` from `utils/url-patterns.ts` determines content type
3. `saveItem()` in `services/insforge.ts` inserts row to `items` table with status `pending`
4. `prependItem()` adds item to Zustand store immediately (optimistic UI)
5. `triggerClassify(item.id)` fires and forgets — invokes edge function
6. Edge function (`functions/classify/index.ts`) fetches item, runs Jina Reader (if URL), calls AI via InsForge AI Gateway, updates DB, creates action rows, publishes realtime event
7. Realtime subscription in `stores/items.ts` `startRealtime` receives `item_updated` event
8. Store upserts item (replaces if exists, prepends if new) — UI re-renders

**Item Creation (Share Extension — iOS Share Sheet):**

1. iOS Share Sheet invokes `share-extension/index.tsx`
2. `getCurrentUser()` checks for stored auth token
3. `processSharedContent()` in `services/share-handler.ts` orchestrates:
   a. `detectContentType()` determines link/text/image from `ShareInput`
   b. `classifyHeuristic()` from `services/classifier.ts` runs instant client-side classification
   c. `saveItem()` persists to InsForge DB with status `pending`
   d. `uploadImage()` if image content (errors caught non-fatally)
   e. `triggerClassify()` fires and forgets
4. Category hint shown briefly, then `close()` from `expo-share-extension` dismisses (500ms delay via `CONFIG.shareExtension.dismissDelayMs`)
5. Main app's realtime subscription picks up the classified item asynchronously

**Heuristic Classification Pipeline (Client-Side, `services/classifier.ts`):**

1. **Strategy 1 — URL domain matching** (highest confidence, 0.6-0.9): Match URL against 40+ domain rules in `utils/url-patterns.ts` (e.g., youtube.com → entertainment at 0.85)
2. **Strategy 2 — Keyword matching** (medium confidence, 0.4-0.7): Match text against category keyword lists in `constants/categories.ts` (requires 2+ keyword hits)
3. **Strategy 3 — Fallback**: Return category `other` with confidence 0.3
4. Additionally extracts: dates (regex), prices ($X.XX), emails, phone numbers, urgency estimation
5. Suggests actions based on extracted data (calendar if dates, reminder if urgent, summarize if learning/entertainment)

**AI Classification Pipeline (Server-Side, `functions/classify/index.ts`):**

1. Extract user token from Authorization header, create InsForge client with `edgeFunctionToken`
2. Fetch item from DB by `item_id`
3. Content preparation:
   - Links: Jina Reader (`https://r.jina.ai/{url}`) extracts page text (8s timeout, 15k char limit)
   - Images: Download from InsForge storage, convert to base64
   - Text: Use raw content directly
4. AI Gateway call: `client.ai.chat.completions.create()` with model `openai/gpt-4o-mini`, temperature 0.1
5. Parse JSON response (strip markdown fences if present)
6. Fallback if parse fails: category `other`, confidence 0.3, empty actions
7. Update item in DB: set category, title, description, extracted_data, confidence, status `classified`
8. Batch-insert action rows into `actions` table with status `suggested`
9. Publish `item_updated` event to realtime channel `items:{userId}`

**Action Execution (User Approves Suggested Action):**

1. User taps "Execute" button on action pill (Inbox, Item Detail, or Tasks screen)
2. `executeAndUpdate()` in `stores/actions.ts`:
   - Saves `prev` snapshot of actions array
   - Optimistically marks action as `completed` (or `approved` for summarize)
3. `executeAction()` in `services/actions.ts` dispatches by type:
   - `add_to_calendar`: Request calendar permissions → find/create calendar → `Calendar.createEventAsync()` → update action to `completed`
   - `set_reminder`: Request notification permissions → validate future date (min 10s) → `Notifications.scheduleNotificationAsync()` → update action to `completed`
   - `summarize`: Call `triggerSummarize(itemId, actionId)` → edge function handles AI + DB update
   - `save_contact`, `create_note`, `track_price`: Throw `ActionError` with "coming soon" message
4. On failure: store rolls back to `prev` state, error re-thrown for UI Alert

**Authentication Flow:**

1. App launches → `app/_layout.tsx` calls `useAuthStore().initialize()`
2. `initialize()` in `stores/auth.ts` calls:
   - `getCurrentUser()` — checks `expo-secure-store` for persisted token
   - `SecureStore.getItemAsync(SETUP_KEY)` — checks if onboarding is complete
3. If token found: validates via `GET /api/auth/profiles/current`, restores `AuthUser`
4. If no token + `__DEV__`: `devAutoLogin()` signs in with test credentials (`ada.test@example.com`)
5. Root layout route guard redirects based on `user` and `hasCompletedSetup`:
   - No user → `/welcome` (first-run) or `/onboarding` (returning)
   - User, no setup → `/permissions` → `/setup-guide`
   - User, setup done → `/(tabs)`
6. Sign up: `POST /api/auth/users` — may return `requireEmailVerification: true`
7. Email verification: `POST /api/auth/email/verify` with 6-digit OTP code
8. Token stored in `expo-secure-store` (encrypted), set on SDK via `insforge.getHttpClient().setAuthToken()`

## State Management

**Three Zustand stores, no circular dependencies:**

**`stores/auth.ts` — `useAuthStore`:**
- State: `user` (id + email), `initialized`, `loading`, `error`, `needsEmailVerification`, `pendingEmail`, `hasCompletedSetup`
- Actions: `initialize`, `signUp`, `signIn`, `signOut`, `verifyEmail`, `resendCode`, `completeSetup`, `clearError`, `resetVerification`
- Persistence: Token in `expo-secure-store` (key: `insforge_access_token`), setup flag in `expo-secure-store` (key: `ada_setup_completed`)
- Error handling: Catches `AuthError` specifically, falls back to generic messages

**`stores/items.ts` — `useItemsStore`:**
- State: `items` (full array in memory), `loading`, `error`
- Actions: `fetchItems`, `prependItem`, `refreshItem`, `archiveItem`, `deleteItem`, `reclassify`, `toggleStar`, `updateNote`, `startRealtime`
- Derived accessors: `getByStatus(status)`, `getByCategory(category)`, `getStarred()`, `searchItems(query)`
- Pattern: All mutations use optimistic updates — save `prev = get().items` snapshot before mutation, restore `set({ items: prev })` on API failure
- Realtime: `startRealtime()` returns unsubscribe function; upserts received items into store

**`stores/actions.ts` — `useActionsStore`:**
- State: `actions` (array of `ActionWithItem` — action + joined item), `loading`, `error`
- Actions: `fetchActions`, `executeAndUpdate`, `dismissAction`
- Derived accessors: `getPending()`, `getCompleted()`, `getForItem(itemId)`
- Pattern: `executeAndUpdate` optimistically sets `summarize` → `approved`, all others → `completed`; rollback on failure

**Coordination in Root Layout (`app/_layout.tsx`):**
1. Auth store initializes first (effect with `[initialize]` dep)
2. Once `user` is available, second effect fires: `fetchItems(user.id)`, `fetchActions(user.id)`, `startRealtime(user.id)`
3. Realtime unsubscribe returned as cleanup function
4. On sign out: `disconnectRealtime()` called before clearing token

## Edge Functions

**`functions/classify/index.ts` — Classification Pipeline (332 lines):**
- Trigger: `insforge.functions.invoke('classify', { body: { item_id } })`
- Auth: Extracts user's Bearer token from request, creates SDK client with `edgeFunctionToken`
- CORS: Handles OPTIONS preflight with `Access-Control-Allow-Origin: *`
- Pipeline: Fetch item → Jina Reader (if URL, 8s timeout, 15k char cap) → Download image (if image/screenshot) → AI Gateway (gpt-4o-mini, temp 0.1) → Parse JSON → Update item → Batch insert actions → Publish realtime
- AI prompt: Detailed JSON schema with 12 categories, action data schemas for `add_to_calendar`, `set_reminder`, `summarize`
- Fallback: On JSON parse failure, returns `{ category: 'other', confidence: 0.3, ...empty fields }`
- Error: Returns `{ error: 'Classification failed' }` with HTTP 500

**`functions/summarize/index.ts` — On-Demand Summarization (172 lines):**
- Trigger: `insforge.functions.invoke('summarize', { body: { item_id, action_id } })`
- Auth: Same token-based pattern as classify
- Pipeline: Fetch item → Jina Reader (if URL) → AI Gateway (claude-sonnet-4.5, temp 0.3) → Update action to `completed` with summary result → Update item description (truncated to 1000 chars)
- Prompt: "Summarize concisely: 2-3 sentence executive summary, 3-5 bullet points, action items, under 300 words"
- Error handling: On failure, marks action as `failed` with error message in `result` field; uses `req.clone()` to re-read body for cleanup
- Shared code: Both functions duplicate `fetchJinaContent()` and `jsonResponse()` helpers

## Realtime

**Channel-based pub/sub via InsForge realtime (NOT Supabase postgres_changes):**

- Channel naming: `items:{userId}` — one channel per user
- Events subscribed: `item_updated`, `item_created`
- Setup flow: `subscribeToItems()` in `services/insforge.ts`:
  1. `insforge.realtime.connect()` (async, returns promise)
  2. `insforge.realtime.subscribe(channel)`
  3. `insforge.realtime.on('item_updated', handler)` and `insforge.realtime.on('item_created', handler)`
- Handler: Receives `{ item: Item }` payload, passes to store callback
- Publisher: Edge function `classify/index.ts` publishes after DB update:
  ```
  client.realtime.publish(`items:${userId}`, 'item_updated', { item: updatedItem })
  ```
- Cleanup: `unsubscribe()` removes event handlers via `.off()`, unsubscribes from channel
- Disconnect: `disconnectRealtime()` called on sign out (tolerates not-connected state)
- Cancellation: `cancelled` flag prevents handlers from being attached if `connect()` resolves after cleanup

**Limitation:** No realtime channel for actions. Action creation by edge functions is not pushed to client. The client fetches actions on app load (`fetchActions`) and can refresh individual items, but new actions from classification only appear after a manual refresh or re-fetch.

## Entry Points

**Main App:**
- Location: `app/_layout.tsx` (102 lines)
- Triggers: App startup via expo-router
- Responsibilities: Auth gate with route protection, store initialization, realtime subscription lifecycle

**Share Extension:**
- Location: `share-extension/index.tsx` (119 lines)
- Triggers: iOS Share Sheet → Ada selection
- Responsibilities: Auth check, content processing pipeline, brief visual feedback, auto-dismiss

**Edge Function — Classify:**
- Location: `functions/classify/index.ts` (332 lines)
- Triggers: HTTP POST from `insforge.functions.invoke('classify')`
- Responsibilities: Full AI classification pipeline with Jina content extraction

**Edge Function — Summarize:**
- Location: `functions/summarize/index.ts` (172 lines)
- Triggers: HTTP POST from `insforge.functions.invoke('summarize')`
- Responsibilities: AI-powered content summarization with action status management

## Error Handling

**Strategy:** Fail fast with typed errors; optimistic updates with rollback; fire-and-forget for non-critical async work.

**Error Hierarchy (defined in `services/insforge.ts`):**
```
AdaError (base — has `cause` property)
├── AuthError       — auth endpoint failures
├── DatabaseError   — InsForge database query failures
├── StorageError    — InsForge storage upload/download failures
└── FunctionError   — InsForge edge function invocation failures

ActionError (separate, in `services/actions.ts`)
└── Permission denied, unsupported action type, invalid data
```

**Patterns:**
- **Optimistic rollback:** Every store mutation saves `const prev = get().items` before making changes, then `set({ items: prev })` in catch block
- **Fire-and-forget:** `triggerClassify()` errors are caught and logged but not thrown — classification failure is recoverable (item stays `pending`, user can reclassify)
- **Share extension resilience:** Image upload failure is non-fatal (logged, continues). Auth failure shows error briefly then dismisses. All errors lead to dismiss within 1.5s
- **Edge function error responses:** Return JSON `{ error: '...' }` with appropriate HTTP status. Summarize function additionally marks action as `failed` with error details
- **Store error messages:** Stores catch typed errors (`AuthError`, `DatabaseError`) for specific messages, fall back to generic user-friendly messages for unknown errors

## Cross-Cutting Concerns

**Logging:** `console.error` and `console.warn` throughout for non-fatal failures. No structured logging framework. Edge functions log via `console.error`/`console.warn` (Deno runtime).

**Validation:** TypeScript strict mode enforced. `zod` is listed in `package.json` but not imported in any source file. Validation relies on TypeScript types + InsForge RLS. Edge function AI prompt enforces JSON schema; fallback handles malformed responses.

**Authentication:** Direct REST `fetch()` to InsForge auth endpoints (`/api/auth/users`, `/api/auth/sessions`, `/api/auth/profiles/current`, `/api/auth/email/verify`, `/api/auth/email/send-verification`). Token persisted in `expo-secure-store`. Token set on SDK via `insforge.getHttpClient().setAuthToken()`. RLS enforces `user_id = auth.uid()` on all tables.

**Search:** Client-side only — `searchItems()` in `stores/items.ts` does case-insensitive substring matching across `title`, `description`, `raw_content`, `category`, `source_app`, and `user_note` fields. Requires minimum 2 characters. All items loaded into memory on app start.

**Theming:** Dark theme hardcoded throughout with consistent color palette: background `#0F0F14`, card `#1A1A24`, border `#2A2A3A`, primary `#6366F1` (indigo), text white/gray scale. No theme provider or dynamic theming.

---

*Architecture analysis: 2026-02-18*
