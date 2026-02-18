# Codebase Concerns

**Analysis Date:** 2026-02-18

## Critical Issues

**Hardcoded test credentials in source code:**
- Issue: `services/insforge.ts` lines 172-175 contains hardcoded test user email (`ada.test@example.com`) and password (`AdaTest12345`) in the `devAutoLogin()` function. While guarded by `__DEV__`, this is committed to the repo and visible to anyone with access.
- Files: `services/insforge.ts` lines 170-181
- Impact: Credential exposure in version control. If the repo is ever public, the test account is compromised.
- Fix approach: Move test credentials to a `.env.development` file (which is gitignored). Read them via `process.env.EXPO_DEV_EMAIL` / `process.env.EXPO_DEV_PASSWORD`. Alternatively, remove devAutoLogin entirely and rely on a persistent token in SecureStore.

**No token refresh mechanism:**
- Issue: The auth system stores a single access token in SecureStore but has no refresh token flow. When the token expires, the user's only path is: in development, auto-login fires (masking the problem); in production, the user is silently logged out.
- Files: `services/insforge.ts` lines 145-166 (getCurrentUser), `stores/auth.ts` lines 73-91 (initialize)
- Impact: Users will be randomly logged out when tokens expire. No proactive refresh means lost sessions, especially for users who open the app infrequently.
- Fix approach: Store both access and refresh tokens. Add a `refreshToken()` function that calls the InsForge refresh endpoint. Call it when `getCurrentUser()` gets a 401, before falling back to null. Add a token expiry check on app foreground.

**No input validation on user content:**
- Issue: Zero validation or sanitization anywhere in the pipeline. Content from share extension, manual add input, and edge function responses is passed directly to DB operations and rendered in the UI without any checks.
- Files: `services/share-handler.ts` (processSharedContent), `app/(tabs)/index.tsx` line 66 (handleAdd), `services/insforge.ts` lines 204-223 (saveItem), `functions/classify/index.ts` line 39 (req.json body)
- Impact: Potential for injection attacks via crafted share content. Malformed URLs could cause crashes in URL parsing. Extremely long content could cause memory issues in the share extension (120MB limit).
- Fix approach: Add a `validateContent()` function in `services/share-handler.ts` that: (1) enforces `maxTextLength` from config, (2) validates URLs with `URL` constructor, (3) strips null bytes and control characters, (4) validates edge function request bodies with a schema validator (e.g., zod).

## High Priority

**Swallowed classification errors:**
- Issue: `triggerClassify()` failures are silently swallowed with `.catch(() => {})` in two places. If classification consistently fails (quota exhausted, function misconfigured, auth issues), users see "pending" items forever with no feedback.
- Files: `services/share-handler.ts` line 78, `app/(tabs)/index.tsx` line 68
- Impact: Users have no way to know classification failed. Items stay in "pending" status indefinitely. No retry mechanism exists.
- Fix approach: (1) Track classification failures in the item store (add a `classifyError` field or status). (2) Show a retry button on items stuck in "pending" for more than 30 seconds. (3) At minimum log the error: `triggerClassify(item.id).catch(err => console.warn('Classification trigger failed:', err))`.

**DRY violation: fetchJinaContent duplicated across edge functions:**
- Issue: `fetchJinaContent()` is copy-pasted identically in `functions/classify/index.ts` (line 172) and `functions/summarize/index.ts` (line 127). Similarly, `jsonResponse()` and `CORS_HEADERS` are duplicated in both files.
- Files: `functions/classify/index.ts` lines 16-20, 172-195, 321-332; `functions/summarize/index.ts` lines 10-14, 127-146, 161-172
- Impact: Bug fixes or behavior changes to Jina fetching must be applied in two places. Violates the project's "DRY is non-negotiable" principle.
- Fix approach: Create a shared `functions/_shared/jina.ts` and `functions/_shared/response.ts`. Import in both edge functions. Note: InsForge edge functions use Deno -- verify shared imports work with their deployment model.

**Client-side search does not scale:**
- Issue: `searchItems()` in `stores/items.ts` (line 223) performs a full scan of all items in memory, joining 6 fields and doing `toLowerCase().includes()`. No server-side search, no debounce.
- Files: `stores/items.ts` lines 223-240, `app/(tabs)/search.tsx` line 21
- Impact: Works fine for <100 items. At 1000+ items, search becomes sluggish. At 10000+ items, memory pressure and UI jank. The `items` array holds the entire user history in memory with no pagination.
- Fix approach: (1) Short-term: add a debounced search that delays the filter by 200ms. (2) Medium-term: implement server-side full-text search via InsForge database query with `ilike` or `textSearch`. (3) Long-term: use pgvector for semantic search as noted in CLAUDE.md.

**All items loaded into memory at once:**
- Issue: `getItems()` in `services/insforge.ts` (line 226) fetches ALL items for a user with no default limit. `fetchItems()` in `stores/items.ts` (line 47) stores them all in the Zustand store.
- Files: `services/insforge.ts` lines 226-253, `stores/items.ts` lines 47-59
- Impact: Memory usage grows linearly with user history. The main app will struggle with thousands of items, especially on older devices.
- Fix approach: Add pagination to `getItems()` with a default limit (e.g., 50). Implement infinite scroll in Inbox and Library screens. Fetch older items on demand.

## Medium Priority

**102 hardcoded color values across 13 files (no theme system):**
- Issue: Colors like `#0F0F14` (background), `#1A1A24` (card), `#6366F1` (primary), `#6B7280` (muted), `#9CA3AF` (secondary text) are hardcoded in StyleSheet.create() calls across every screen and component. 98 occurrences in `app/` alone, plus 4 in `share-extension/`.
- Files: All files in `app/`, `share-extension/index.tsx`
- Impact: (1) Changing the color scheme requires editing every file. (2) No dark/light mode support possible without a theme system. (3) Inconsistency risk when adding new screens.
- Fix approach: Create a `constants/theme.ts` with a `COLORS` object. Replace all hardcoded hex values with `COLORS.background`, `COLORS.card`, `COLORS.primary`, etc. This is a mechanical refactor but touches many files.

**Optimistic updates don't notify the user on rollback:**
- Issue: Store operations (`archiveItem`, `deleteItem`, `toggleStar`, `updateNote`, `dismissAction`) all follow the pattern: optimistic update -> API call -> on failure, `console.error` + silent rollback. The user sees the action succeed, then it silently reverts.
- Files: `stores/items.ts` lines 80-98, 100-113, 140-160, 162-178; `stores/actions.ts` lines 75-93
- Impact: Users think their action worked (star toggled, item archived) but it silently reverts. No toast, alert, or visual indicator of failure. Confusing UX.
- Fix approach: Add an `error` state to stores that the UI can subscribe to, or trigger an Alert/Toast on rollback. Example: `set({ error: 'Failed to archive. Please try again.' })` and clear it after a timeout.

**Edge function classify does not check update result:**
- Issue: In `functions/classify/index.ts` lines 85-97, the item update call does not check the `error` return value. If the update fails, classification results are lost silently.
- Files: `functions/classify/index.ts` lines 85-97
- Impact: Classification completes, AI is billed, but the result never persists. Item stays "pending" forever.
- Fix approach: Check the `error` from the `.update()` call and return an error response if it fails. Consider retrying once.

**Summarize function does not publish realtime event:**
- Issue: Per MEMORY.md, InsForge realtime is channel-based pub/sub, NOT postgres_changes. The classify edge function manually publishes to realtime (lines 122-132 of `functions/classify/index.ts`), but the summarize function does NOT publish any realtime event after updating the item.
- Files: `functions/summarize/index.ts` (no realtime publish after lines 79-93), `functions/classify/index.ts` lines 122-132
- Impact: After summarization completes, the client never gets notified. The user must manually pull-to-refresh to see the summary. The `refreshItem()` call in `app/item/[id].tsx` line 84 partially mitigates this for the detail screen, but only if the user is still on that screen.
- Fix approach: Add realtime publish in the summarize function after updating the item, same pattern as classify.

**`action_data` type safety is weak:**
- Issue: `action_data` is typed as `Record<string, unknown>` in `types/action.ts` line 27. The action execution code uses `as unknown as CalendarActionData` (line 66) and `as unknown as ReminderActionData` (line 103) in `services/actions.ts`. No runtime validation of the shape.
- Files: `types/action.ts` line 27, `services/actions.ts` lines 66, 103
- Impact: If the AI returns malformed action data (missing `start_time`, invalid `remind_at`), the code will crash at runtime when accessing properties. `Calendar.createEventAsync` with `new Date(undefined)` produces an invalid date.
- Fix approach: Add runtime validation before accessing action_data properties. Use a type guard function: `function isCalendarData(data: unknown): data is CalendarActionData`. Throw an `ActionError` with a clear message if validation fails.

**Missing `hooks/` directory (planned but not created):**
- Issue: `CLAUDE.md` project structure lists `hooks/useItems.ts` and `hooks/useAuth.ts` but no `hooks/` directory exists. Store hooks are imported directly from stores.
- Files: Project root (missing `hooks/` directory)
- Impact: No impact on functionality. But the documented structure diverges from reality, which could confuse contributors.
- Fix approach: Either create the hooks directory with convenience wrappers as documented, or update CLAUDE.md to reflect the current direct-store-import pattern.

**Realtime subscription doesn't unsubscribe on logout:**
- Issue: `_layout.tsx` line 60 returns an unsubscribe function, but the signOut flow in `stores/auth.ts` line 191 calls `disconnectRealtime()` which tries `insforge.realtime.disconnect?.()`. The `?` optional chaining suggests uncertainty about whether disconnect exists. If a user signs out and signs in as a different user, the old channel subscription may persist.
- Files: `app/_layout.tsx` line 60, `stores/auth.ts` line 191, `services/insforge.ts` lines 466-473
- Impact: Potential for receiving realtime events for a previous user's items after re-login.
- Fix approach: Ensure `startRealtime()` return value (unsubscribe) is called during signOut, before `disconnectRealtime()`. Track active subscription in the store.

## Low Priority

**`insforge.ts` at 490 lines, approaching 500-line limit:**
- Issue: `services/insforge.ts` is the largest file at 490 lines and serves as auth, items CRUD, actions CRUD, storage, edge functions, realtime, and error types all in one.
- Files: `services/insforge.ts` (490 lines)
- Impact: File is near the 500-line hard limit from CLAUDE.md. Adding any new DB operations will require a split.
- Fix approach: Split into `services/insforge-auth.ts`, `services/insforge-items.ts`, `services/insforge-actions.ts`, re-exporting from a barrel `services/insforge.ts`.

**`app/item/[id].tsx` at 468 lines, mostly styles:**
- Issue: The item detail screen is 468 lines, with ~140 lines of StyleSheet at the bottom. The render function itself is long but within limits.
- Files: `app/item/[id].tsx` (468 lines)
- Impact: Approaching the 500-line limit. Adding more sections (e.g., related items, tags) will push it over.
- Fix approach: Extract styles to a co-located `item-detail.styles.ts` or extract sub-components (ExtractedDataSection, ActionsSection) into separate files.

**Bare `catch {}` blocks in 12 locations:**
- Issue: 12 `catch {}` or `catch { /* comment */ }` blocks that discard error information entirely. While many are in fallback paths where failure is acceptable, the lack of any logging makes debugging harder.
- Files: `services/classifier.ts` lines 166, 196; `services/insforge.ts` lines 161, 178, 470; `functions/summarize/index.ts` lines 117, 141; `app/permissions.tsx` line 25; `utils/url-patterns.ts` line 106; `stores/auth.ts` line 88; `utils/format.ts` line 74; `app/(tabs)/settings.tsx` line 27
- Impact: When things go wrong in production, there is zero diagnostic information from these paths. Especially concerning in `stores/auth.ts` line 88 where initialization failure is silently swallowed.
- Fix approach: At minimum, add `console.warn` in each catch block. For critical paths like auth initialization, set an error state that can be displayed to the user.

**`useEffect` dependency in share extension:**
- Issue: `share-extension/index.tsx` lines 28-30 calls `handleShare(props)` inside a `useEffect` with an empty dependency array. `handleShare` is defined inline and captures `props`.
- Files: `share-extension/index.tsx` lines 28-30
- Impact: No functional impact (props are static in share extensions), but may trigger ESLint exhaustive-deps warnings.
- Fix approach: Move `handleShare` outside the component or add `props` to the dependency array.

**`Dimensions.get('window')` called at module level:**
- Issue: `app/welcome.tsx` line 19 calls `Dimensions.get('window')` at module scope. This captures the window width once and never updates.
- Files: `app/welcome.tsx` line 19
- Impact: If the device rotates or if using multitasking on iPad, the carousel pages will have the wrong width. Minor for a phone-only app.
- Fix approach: Use `useWindowDimensions()` hook from react-native instead.

## Security Considerations

**CORS wildcard on edge functions:**
- Risk: Both edge functions use `Access-Control-Allow-Origin: *` which allows any origin to call these endpoints.
- Files: `functions/classify/index.ts` line 17, `functions/summarize/index.ts` line 11
- Current mitigation: Functions require a valid auth token, so unauthenticated access is blocked.
- Recommendations: For production, restrict CORS to the specific app origin. For mobile-only backends, consider whether CORS headers are even needed (they are a browser-only concern).

**No rate limiting on auth endpoints (client-side):**
- Risk: The onboarding screen allows unlimited sign-in/sign-up attempts. While server-side rate limiting may exist on InsForge, the client does not throttle or implement exponential backoff.
- Files: `app/onboarding.tsx` (AuthStep component), `services/insforge.ts` (signIn/signUp functions)
- Current mitigation: InsForge likely has server-side rate limiting.
- Recommendations: Add client-side throttling: disable the submit button for 2 seconds after failure, increasing exponentially. Track failed attempts and show a "too many attempts" message after 5 failures.

**Share extension authenticates via stored token with no expiry check:**
- Risk: The share extension calls `getCurrentUser()` which reads the token from SecureStore and makes an API call. If the token is expired, the API call fails, and in production the user sees "Open Ada to sign in first" with no way to fix it from the extension.
- Files: `share-extension/index.tsx` line 34, `services/insforge.ts` lines 145-166
- Current mitigation: Error message directs user to open the main app.
- Recommendations: When `getCurrentUser()` fails in the share extension, attempt a token refresh before giving up. Store the refresh token in SecureStore alongside the access token.

**No CSRF protection on direct REST auth calls:**
- Risk: Auth endpoints accept POST without CSRF tokens (lines 51-57 in `services/insforge.ts`). This is a mobile app so browser-based CSRF is not applicable, but the endpoints are potentially callable from any HTTP client.
- Files: `services/insforge.ts` lines 49-86
- Current mitigation: Auth header with bearer token (anon key for auth endpoints).
- Recommendations: Low risk for mobile-only use. Document this assumption. Verify InsForge validates the anon key on auth endpoints.

## Performance Considerations

**Search re-filters on every keystroke (no debounce):**
- Problem: `app/(tabs)/search.tsx` line 21 calls `searchItems(query)` on every render when query changes. The `searchItems` function in `stores/items.ts` line 223 iterates all items, joins 6 fields, and does string matching.
- Files: `app/(tabs)/search.tsx` line 21, `stores/items.ts` lines 223-240
- Cause: No debounce on the search input. FlatList re-renders on every state change.
- Improvement path: Debounce the query with a 200-300ms delay using `useRef` + `setTimeout` (same pattern as the note debounce in `app/item/[id].tsx`). Consider memoizing the searchable string per item.

**Inbox sorts all items on every render:**
- Problem: `app/(tabs)/index.tsx` lines 40-52 filters and sorts items in `useMemo` keyed on `[items]`. Since `items` is a new array reference from Zustand on every state change (including realtime updates), the sort runs on every update.
- Files: `app/(tabs)/index.tsx` lines 40-52
- Cause: Zustand returns new array references on any state change that touches `items`.
- Improvement path: Use `shallow` comparison from zustand or select items with a selector that returns a stable reference when the actual data hasn't changed.

**Share extension calls getCurrentUser() which may trigger devAutoLogin network request:**
- Problem: In development, every share extension invocation potentially makes a sign-in API call (devAutoLogin). This adds network latency to the 2-second window.
- Files: `services/insforge.ts` lines 145-181, `share-extension/index.tsx` line 34
- Cause: `devAutoLogin` is called when no token is in SecureStore.
- Improvement path: In the share extension path, skip devAutoLogin and fail fast if no token exists.

**Image base64 conversion in edge function uses inefficient char-by-char concatenation:**
- Problem: `functions/classify/index.ts` lines 159-163 converts image bytes to base64 using `String.fromCharCode` in a loop with string concatenation, which is O(n^2) for large images.
- Files: `functions/classify/index.ts` lines 159-163
- Cause: Manual base64 encoding instead of using built-in `btoa` with a typed array view.
- Improvement path: Use a more efficient approach, e.g., chunk the Uint8Array or use a library. For Deno, `btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))` with spread may work for small images but will stack overflow for large ones. Consider using Deno's built-in base64 encoding.

## Scalability Considerations

**All user items loaded in a single query with no pagination:**
- Current capacity: Works for users with <500 items (typical early adopter).
- Limit: At 5000+ items, initial load will be slow and memory-heavy. At 50000+ items, the query itself may time out.
- Scaling path: (1) Add pagination with cursor-based scrolling. (2) Load only recent items on app start (last 7 days or last 50). (3) Add server-side filtering so library/search screens don't need all items in memory.
- Files: `services/insforge.ts` line 226 (getItems), `stores/items.ts` line 47 (fetchItems)

**Actions fetched for all items at once:**
- Current capacity: Fine for <200 actions.
- Limit: Each classified item can have 1-3 actions. At 5000 items, that's 5000-15000 action rows loaded into memory.
- Scaling path: Fetch actions lazily per-item or per-page, rather than all at once.
- Files: `services/insforge.ts` lines 347-364 (getActionsForUser), `stores/actions.ts` line 37 (fetchActions)

**Realtime subscription lifecycle not managed:**
- Current capacity: Works for single-device use.
- Limit: No reconnection logic if websocket drops. No heartbeat. Multiple app opens could create duplicate subscriptions. `insforge.realtime.connect()` is called with `.then()` but if the promise resolves after the component unmounts (e.g., user navigates away during connection), the subscription is orphaned.
- Scaling path: Add connection state tracking. Disconnect/reconnect on app foreground/background lifecycle events. Add reconnection logic with exponential backoff.
- Files: `services/insforge.ts` lines 433-464 (subscribeToItems)

**AI Gateway rate limits:**
- Current capacity: gpt-4o-mini via InsForge AI Gateway (unknown rate limits). Claude Sonnet for summarization.
- Limit: If many users classify items concurrently, the AI gateway becomes the bottleneck. No client-side queuing or backoff.
- Scaling path: Implement per-user rate limiting. Add a queue with priority for urgent items. Consider fallback to heuristic classification when AI is unavailable.
- Files: `functions/classify/index.ts` line 291 (AI call), `functions/summarize/index.ts` line 66 (AI call)

## Dependencies at Risk

**InsForge SDK (@insforge/sdk):**
- Risk: Single-vendor dependency for database, auth, storage, functions, realtime, and AI. The SDK's auth module doesn't work in React Native (requires browser APIs), forcing custom REST calls for auth.
- Impact: If InsForge has an outage, the entire app is non-functional. No offline capability.
- Migration plan: The REST-based auth layer in `services/insforge.ts` is already decoupled. Database operations use a Supabase-like query builder, so migration to Supabase would be straightforward. AI gateway uses OpenAI-compatible API.

**expo-calendar platform-specific quirks:**
- Risk: Calendar source type requires `type` field that differs between iOS and Android. Line 49 in `services/actions.ts` casts `Calendar.CalendarType.LOCAL as string` which is fragile.
- Impact: Calendar event creation may fail on certain devices/OS versions.
- Migration plan: If issues persist, consider simpler calendar integration (opening calendar app with event URL) or adding user-facing calendar selection.

## Missing Critical Features

**No offline support:**
- Problem: The app requires network connectivity for every operation. Items cannot be queued offline, and there is no local cache.
- Blocks: Users cannot use the share extension without connectivity. The 2-second dismiss target in the share extension becomes impossible on slow networks.
- Files: `services/share-handler.ts` (processSharedContent requires network), `share-extension/index.tsx`

**No retry mechanism for failed classifications:**
- Problem: If `triggerClassify()` fails silently, items stay "pending" forever. There is a "Re-classify" button on the detail screen (`app/item/[id].tsx` line 314), but users must manually find and tap it.
- Blocks: Reliable background processing. Users with intermittent connectivity will accumulate unclassified items.
- Files: `services/insforge.ts` line 409 (triggerClassify), `stores/items.ts` line 115 (reclassify)

## Test Coverage Gaps

**No tests for edge functions (HIGH):**
- What's not tested: `functions/classify/index.ts` and `functions/summarize/index.ts` have zero test coverage. These contain the core AI classification pipeline, Jina Reader integration, JSON parsing of AI responses, error handling, and realtime publishing.
- Files: `functions/classify/index.ts` (332 lines), `functions/summarize/index.ts` (172 lines)
- Risk: AI response parsing is the most fragile part of the system (JSON from an LLM). The fallback in `classifyWithAI` (lines 308-316) handles parse failure, but there are no tests for malformed responses, missing fields, or edge cases.
- Priority: High

**No tests for UI screens (MEDIUM):**
- What's not tested: All 10 screen components in `app/` have zero test coverage. No component tests, no snapshot tests, no interaction tests.
- Files: All files in `app/`, `share-extension/index.tsx`
- Risk: UI regressions will not be caught. Navigation logic in `app/_layout.tsx` (auth gate) is untested despite being critical.
- Priority: Medium -- the auth gate routing logic in `_layout.tsx` lines 33-52 is the highest priority for testing.

**No integration tests for InsForge service functions (MEDIUM):**
- What's not tested: `insforge-service.test.ts` only tests error classes. The actual `saveItem`, `getItems`, `updateItem`, `signIn`, `signUp`, `uploadImage`, `subscribeToItems` functions are not directly tested.
- Files: `__tests__/insforge-service.test.ts` (185 lines, error classes only), `services/insforge.ts` (490 lines)
- Risk: Database operations, auth flows, and storage uploads have no direct tests. They are partially covered through store tests, but store tests mock the service layer entirely.
- Priority: Medium

**No tests for action execution with native APIs (LOW):**
- What's not tested: `services/actions.ts` executeCalendarAction and executeReminderAction edge cases -- permission denied mid-flow, invalid date strings in action_data, notification scheduling with past dates.
- Files: `__tests__/actions.test.ts`, `services/actions.ts`
- Risk: Action execution touches native APIs (expo-calendar, expo-notifications) that behave differently on device vs simulator.
- Priority: Low -- integration-level concerns best tested on device.

---

*Concerns audit: 2026-02-18*
