# Architecture

**Analysis Date:** 2026-02-18

## Pattern Overview

**Overall:** Event-driven, layer-separated iOS app with real-time sync and background async processing.

**Key Characteristics:**
- Share extension triggers item capture and heuristic classification (fast, optimistic)
- Server-side edge function handles expensive classification (async, deterministic)
- Zustand stores manage local state with optimistic updates and rollback
- Realtime subscription pushes server updates back to client UI
- Action execution is separated from action storage (store → service → database)

## Layers

**Presentation Layer (Screens & Components):**
- Purpose: Render UI, handle user interactions, display items and actions
- Location: `app/` directory
- Contains: Expo Router screens (tabs, modals, flows)
- Depends on: Zustand stores (items, auth, actions), InsForge service
- Used by: Mobile app navigation

**State Management Layer (Zustand Stores):**
- Purpose: Local state (user auth, items list, actions), cache management, derived data
- Location: `stores/` directory
  - `auth.ts`: User session, verification state, setup completion
  - `items.ts`: Items list, loading, filters (by status/category/search)
  - `actions.ts`: Actions list, execution dispatch
- Depends on: InsForge service (database calls)
- Used by: All screens and share extension

**Service Layer (Domain Logic & API Integration):**
- Purpose: Encapsulate InsForge SDK, edge function calls, business logic
- Location: `services/` directory
  - `insforge.ts`: All database, auth, storage, functions, realtime calls
  - `share-handler.ts`: Share extension pipeline (detect type → heuristic classify → save → trigger async classify)
  - `classifier.ts`: Heuristic fallback when Gemini unavailable
  - `actions.ts`: Execute specific action types (calendar, reminder, contact, etc.)
- Depends on: InsForge SDK, external APIs (Jina), utilities
- Used by: Stores, share extension, screens

**Edge Functions (Serverless Processing):**
- Purpose: Expensive async tasks using service role (bypasses RLS)
- Location: `functions/` directory (Deno runtime)
  - `classify/index.ts`: Full classification pipeline (Jina → AI → database update → realtime notify)
  - `summarize/index.ts`: On-demand text summarization
- Triggers: Called from client via InsForge function invoke
- Auth: Uses service role via `edgeFunctionToken` header

**Utilities & Constants:**
- `utils/url-patterns.ts`: URL → category heuristics, URL detection
- `utils/format.ts`: Date/text formatting helpers
- `constants/categories.ts`: 12 content categories with icons/colors/keywords
- `constants/config.ts`: App configuration, API URLs, timeouts

**Type Definitions:**
- `types/item.ts`: Item, RawCapture, Category, ContentType, ItemStatus, ExtractedData
- `types/action.ts`: Action, ActionType, ActionStatus
- `types/classification.ts`: AI response shapes

## Data Flow

**Item Lifecycle (Share → Classify → Update):**

1. User shares via iOS Share Sheet
2. Share extension (`share-extension/index.tsx`):
   - Gets auth user from SecureStore
   - Calls `processSharedContent()` with shared input
3. `services/share-handler.ts`:
   - Detects content type (link/text/image) via `detectContentType()`
   - Runs heuristic classification (instant feedback)
   - Saves item to InsForge (status: "pending")
   - Uploads image to storage if present
   - Triggers async `/classify` edge function
   - Returns immediately (dismisses extension in <2 sec)
4. Edge function `/functions/classify/index.ts` (background):
   - Fetches item from database
   - If URL: calls Jina Reader to extract page text
   - If image: downloads from storage, converts to base64
   - Sends to AI (gpt-4o-mini) with classification prompt
   - Parses JSON response (category, title, description, extracted_data, suggested_actions)
   - Updates item (status: "classified", category, confidence, extracted_data)
   - Batch-creates action rows in `actions` table
   - Publishes to realtime channel `items:{userId}` with updated item
5. Realtime subscription in `stores/items.ts`:
   - Receives `item_updated` event
   - Updates local state (Zustand)
   - UI re-renders with new classification

**Action Execution (Suggested → Completed):**

1. User sees suggested action in inbox or item detail
2. Taps action pill or "Execute" button
3. `stores/actions.ts` `executeAndUpdate()`:
   - Optimistically marks action as "completed" (local state)
   - Calls `services/actions.ts` `executeAction(action)`
4. Action executor:
   - Dispatches to specific handler (calendar, reminder, contact, etc.)
   - Each handler calls InsForge or device APIs
   - Returns result
5. On success: action stays "completed" in database
6. On failure: Zustand rollback restores previous state, error thrown

**State Management:**

- **Optimistic updates:** User sees changes immediately (archive, delete, toggle star)
- **Rollback on failure:** If API call fails, previous state snapshot is restored
- **Realtime sync:** Server pushes classified items back to client via pubsub
- **Loading/error states:** Stored in Zustand for UI feedback

## Key Abstractions

**Item:**
- Purpose: Represents any user-shared content (link, text, image, screenshot)
- Examples: `types/item.ts`, `stores/items.ts`
- Pattern: Type-safe union with status lifecycle (pending → classified → archived)

**Action:**
- Purpose: Suggested or user-approved follow-up task from item analysis
- Examples: `types/action.ts`, `stores/actions.ts`, `services/actions.ts`
- Pattern: Database row with lifecycle (suggested → approved → completed → dismissed)

**Classification Result:**
- Purpose: Structured output from AI containing category, extracted data, suggested actions
- Examples: `types/classification.ts`, `functions/classify/index.ts`
- Pattern: JSON schema enforced by both AI prompt and TypeScript types

**Content Type Detection:**
- Purpose: Fast heuristic categorization before expensive AI
- Examples: `utils/url-patterns.ts`, `services/classifier.ts`
- Pattern: Pattern matching (domain rules) + keyword fallback + confidence scores

## Entry Points

**Main App:**
- Location: `app/_layout.tsx`
- Triggers: App startup
- Responsibilities:
  - Initialize auth store (restore token from SecureStore, call getCurrentUser)
  - Check setup completion (permissions, setup guide done?)
  - Route to onboarding or main tabs based on auth state
  - Set up realtime subscription for items and actions
  - Display loading spinner while initializing

**Share Extension:**
- Location: `share-extension/index.tsx`
- Triggers: User selects "Share" from another app, then "Ada"
- Responsibilities:
  - Get current user (if not logged in, show error)
  - Extract shared content (text, URL, images)
  - Call share handler pipeline
  - Display heuristic category hint and save confirmation
  - Auto-dismiss after 500ms

**Inbox Tab:**
- Location: `app/(tabs)/index.tsx`
- Triggers: User taps "Inbox" tab
- Responsibilities:
  - List items (excluding archived), sorted by starred first
  - Show pending indicator for items still classifying
  - Display suggested actions (first 2 as pills)
  - Refresh on pull-down
  - Manual "Add" input for POC (before share extension)

**Item Detail:**
- Location: `app/item/[id].tsx`
- Triggers: User taps item in inbox/library/search
- Responsibilities:
  - Display full item (title, description, extracted data, raw content)
  - List all actions (with execute/dismiss buttons)
  - Allow manual reclassification (reset to pending, trigger /classify)
  - Edit user note
  - Archive or delete

## Error Handling

**Strategy:** Fail fast with context, distinguish recoverable vs unrecoverable.

**Patterns:**

- **Auth errors** (expired token, invalid credentials):
  - Caught in `insforge.ts` auth functions
  - `AuthError` thrown with human message
  - Stores mark user as null, redirect to login

- **Database errors** (network, quota):
  - Caught in `insforge.ts` database functions
  - `DatabaseError` thrown with original API error
  - Stores catch, display error message, no state change

- **Classification errors** (Jina timeout, AI quota, parse failure):
  - Caught in edge function
  - Returns error response (logged, not thrown to UI)
  - Item remains status: "pending", can be manually retried via reclassify
  - Fallback classifier provides low-confidence guess if edge function fails

- **Share extension errors** (upload failed, user not authenticated):
  - Non-fatal image upload: logged, continues without image
  - User not logged in: share extension shows error, dismisses after 1.5s

- **Action execution errors** (calendar API unavailable, etc.):
  - Caught in action executor
  - Zustand rollback restores "suggested" state
  - Error message shown in Alert
  - User can retry later

## Cross-Cutting Concerns

**Logging:** Console.error/warn used throughout. No structured logging framework (keep it simple for MVP).

**Validation:** Zod not imported (type checking via TypeScript). Client-side validation minimal (rely on InsForge RLS). Edge function validates JSON structure from AI.

**Authentication:**
- Token stored in expo-secure-store (encrypted on-device)
- Set on SDK client after login via `insforge.getHttpClient().setAuthToken(token)`
- Auth routes gated in root layout via redirect logic
- Dev auto-login via test credentials in __DEV__ block

**Concurrency:** Zustand stores are single-threaded (no race conditions in practice). Optimistic updates store previous state for rollback. No mutex/lock needed.

**Rate Limiting:** InsForge RLS enforces per-user isolation. Gemini rate limits (250 RPD / 10 RPM Flash, 1000 RPD / 15 RPM Flash-Lite) respected by edge function quotas, not client-side.

---

*Architecture analysis: 2026-02-18*
