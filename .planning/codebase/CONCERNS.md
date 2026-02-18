# Codebase Concerns

**Analysis Date:** 2026-02-18

## Tech Debt

**Bare exception handlers in realtime subscription:**
- Issue: `insforge.realtime.connect().catch()` swallows errors without logging (line 450 in `services/insforge.ts`)
- Files: `services/insforge.ts` (lines 446–452)
- Impact: Realtime connection failures silently fail. App stops receiving item updates but user sees no error.
- Fix approach: Add explicit error logging and implement retry strategy with exponential backoff. Consider surface UI alert if realtime fails to connect on app init.

**Missing error recovery for classification failures:**
- Issue: `triggerClassify()` catches errors and swallows them (line 416 in `services/insforge.ts`). If Gemini classifies fails, item stays in "pending" state forever.
- Files: `services/insforge.ts` (lines 409–418), `app/(tabs)/index.tsx` (line 66)
- Impact: User saves item, sees "pending" forever if network drops during classification. No way to retry.
- Fix approach: Store retry count in items table. After 3 failed attempts, set status to "pending_review" and show UI flag. Add manual "retry classification" UI.

**Share extension image upload non-fatal error handling:**
- Issue: Image upload failure in share extension swallows error and continues (line 73 in `services/share-handler.ts`). Item gets saved with original imageUri instead of storage path, causing classify to fail.
- Files: `services/share-handler.ts` (lines 62–75)
- Impact: Screenshots/images from share extension may classify incorrectly if upload fails.
- Fix approach: If image upload fails, still update item.raw_content to imageUri fallback, but mark extracted_data with "image_upload_failed" flag so classify function can handle it.

**Unverified realtime event message shapes:**
- Issue: Realtime message parsing assumes `{ item?: Item }` structure (line 440 in `services/insforge.ts`) with no validation.
- Files: `services/insforge.ts` (lines 439–444)
- Impact: If server sends malformed realtime message, app silently drops the update.
- Fix approach: Validate incoming realtime messages with type guard before updating state. Log invalid messages for debugging.

## Known Bugs

**Share extension dismissal timing race:**
- Symptoms: Share extension sometimes closes before user sees "Saved" feedback (dismissal timeout is 500ms, but upload+save can take 700ms+)
- Files: `share-extension/index.tsx` (line 58), `constants/config.ts` (line 25)
- Trigger: Share image from Photos app on slower networks
- Workaround: User must dismiss manually; does not affect data (item is still saved)
- Fix approach: Measure actual processing time, use minimum of 1 second delay. Consider showing a progress spinner instead of fixed delay.

**Realtime subscription doesn't unsubscribe on logout:**
- Symptoms: Realtime channel for old user ID remains subscribed after sign-out
- Files: `app/_layout.tsx` (line 60), `stores/items.ts` (line 182–184)
- Trigger: User signs out → sign in as different user → realtime gets messages for both user IDs
- Workaround: App restart fixes it
- Fix approach: Call `insforge.realtime.disconnect()` in cleanup or on logout. Verify subscription lifecycle.

**Note update doesn't optimistically update correctly:**
- Symptoms: User types note, tabs away, tabs back → note shows old value briefly before updating
- Files: `app/item/[id].tsx` (lines 277–282)
- Trigger: Network is slow; optimistic update code path not fully optimistic
- Workaround: Edit note again
- Fix approach: Capture noteText state before blur, use that for optimistic update in store.

## Security Considerations

**Dev auto-login hardcoded in production code:**
- Risk: Test user credentials hardcoded in `insforge.ts` behind `__DEV__` check. If __DEV__ flag is accidentally enabled in release build, app auto-logs in anyone.
- Files: `services/insforge.ts` (lines 169–181)
- Current mitigation: `__DEV__` check, expo strip in release builds
- Recommendations: Move dev credentials to separate dev-only module. Consider removing entirely in favor of QR code/manual auth during testing. Add compile-time assertion that __DEV__ is false in production builds.

**Email verification code not rate-limited on backend:**
- Risk: Server endpoint allows unlimited resend of email verification codes without rate limiting
- Files: `stores/auth.ts` (line 149) calls `resendVerificationEmail()`
- Current mitigation: No client-side rate limiting
- Recommendations: Add client-side debounce on resend button (minimum 30s between attempts). Backend should enforce rate limit (e.g., max 5 resends per email per hour).

**No CSRF protection on direct REST auth calls:**
- Risk: Auth endpoints accept POST without CSRF tokens (lines 51–57 in `services/insforge.ts`)
- Files: `services/insforge.ts` (lines 49–86)
- Current mitigation: Auth header with bearer token
- Recommendations: Verify that InsForge validates auth token on all auth endpoints. If endpoints are truly stateless, CSRF is mitigated, but document this assumption.

**Realtime channel names include userId in plaintext:**
- Risk: Channel name `items:${userId}` is visible in network traffic if TLS is compromised
- Files: `services/insforge.ts` (line 437), `functions/classify/index.ts` (line 124)
- Current mitigation: TLS encryption in transit
- Recommendations: Minor risk if InsForge does proper auth on subscriptions. Ensure RLS on items table prevents cross-user access. Consider audit of InsForge security model.

## Performance Bottlenecks

**N+1 item fetch on realtime update:**
- Problem: Each realtime message causes full state update; no batching of multiple updates
- Files: `stores/items.ts` (lines 164–180)
- Cause: Zustand state update triggered on every realtime message, causes re-render even if item not visible
- Improvement path: Batch realtime updates (e.g., 500ms debounce) before state update. Memoize item list rendering to prevent unnecessary child re-renders.

**Full items list fetched on app init:**
- Problem: `fetchItems()` loads ALL items for user without pagination (line 49 in `stores/items.ts`)
- Files: `stores/items.ts` (lines 46–58), `services/insforge.ts` (lines 226–253)
- Cause: No limit clause in getItems() query
- Improvement path: Add cursor-based pagination. Load first 50 items, then lazy-load more on scroll. Consider RLS to ensure user can only fetch their own items.

**Search iterates full in-memory items array:**
- Problem: `searchItems()` filters entire items array on every keystroke (line 206 in `stores/items.ts`)
- Files: `stores/items.ts` (lines 206–223)
- Cause: No backend search, all filtering client-side
- Improvement path: Add ElasticSearch or InsForge full-text search if user base grows. For MVP, acceptable (items load in memory). Add debounce on search input to reduce iterations.

**Image download in classify function blocks JSON parsing:**
- Problem: Image base64 conversion happens sequentially before AI call (lines 68–82 in `functions/classify/index.ts`)
- Files: `functions/classify/index.ts` (lines 68–82)
- Cause: Image processing and Jina Reader run serially; could be parallelized
- Improvement path: Run image download and Jina Reader in parallel with `Promise.all()`. Allows Jina to fetch while image downloads.

**Realtime connection not pooled across store instances:**
- Problem: Multiple subscriptions to realtime channel could cause duplicate connections if multiple components subscribe
- Files: `services/insforge.ts` (lines 433–461)
- Cause: Each call to `subscribeToItems()` calls `realtime.connect()` without checking if already connected
- Improvement path: Add singleton pattern or connection state tracker. Reuse connection if already established.

## Fragile Areas

**Calendar creation fallback is platform-specific but not tested:**
- Files: `services/actions.ts` (lines 26–61)
- Why fragile: Calendar source type differs between iOS and Android; fallback creates local calendar but logic is fragile with hardcoded type casts
- Safe modification: Add integration tests for calendar creation on both platforms. Mock Calendar API to verify fallback path.
- Test coverage: No test coverage for `getDefaultCalendarId()` or calendar creation logic

**AI model swap risk in classify/summarize functions:**
- Files: `functions/classify/index.ts` (line 286), `functions/summarize/index.ts` (line 53)
- Why fragile: Model names are hardcoded (`openai/gpt-4o-mini`, `anthropic/claude-sonnet-4.5`). If models deprecate or API changes, entire pipeline fails.
- Safe modification: Move model names to environment variables or constants. Document fallback strategy if model is unavailable.
- Test coverage: No tests for model selection or fallback behavior

**Jina Reader URL extraction assumes specific response format:**
- Files: `functions/classify/index.ts` (lines 172–195)
- Why fragile: Code assumes Jina returns plain text response; if API changes format or returns HTML, content parsing fails silently (line 184 fallback to raw URL)
- Safe modification: Add content-type validation on Jina response. Log actual response format in errors.
- Test coverage: No tests for Jina Reader failure scenarios

**Action data type casting without validation:**
- Files: `app/item/[id].tsx` (lines 220, 222), `services/actions.ts` (lines 66, 103)
- Why fragile: Action data cast to specific types without runtime validation (e.g., `as CalendarActionData`). If server returns unexpected structure, undefined field access crashes app.
- Safe modification: Add type guard functions to validate action data shapes before casting.
- Test coverage: No tests for malformed action data from server

**Heuristic classifier keyword matching assumes stable category keywords:**
- Files: `services/classifier.ts` (lines 76–89)
- Why fragile: Keyword matching depends on CATEGORIES definitions (line 12). If keywords are edited, classification behavior changes silently.
- Safe modification: Add unit tests that verify specific keywords map to expected categories. Document category keyword requirements.
- Test coverage: Tests exist (`__tests__/classifier.test.ts`) but don't cover all keyword edge cases

## Scaling Limits

**Realtime channel subscription doesn't handle large user bases:**
- Current capacity: Each user gets one realtime channel. Works for MVP.
- Limit: If 10k+ concurrent users, InsForge realtime infrastructure could saturate
- Scaling path: Implement connection pooling. Consider switching to webhook-based updates for non-real-time use cases.

**Items table without indexes on common filters:**
- Current capacity: Assuming <10k items per user, full table scans acceptable
- Limit: Once users have >100k items, unindexed queries (category, status) will slow down
- Scaling path: Add database indexes on `(user_id, status)`, `(user_id, category)`, `(user_id, created_at)` via InsForge migrations.

**Image storage in single bucket with no partitioning:**
- Current capacity: InsForge S3 bucket stores all user images without organization
- Limit: As object count grows, listing/cleanup becomes slow
- Scaling path: Partition storage by user_id prefix (e.g., `s3://item-images/user-id-123/...`). Add lifecycle rules to archive old images.

**AI Gateway rate limits (Gemini + Claude):**
- Current capacity: Gemini free tier = 1,000 RPD / 15 RPM for gpt-4o-mini. Claude Sonnet = rate varies.
- Limit: If >15 concurrent classification requests, queue will back up
- Scaling path: Implement per-user rate limiting client-side. Add queue with priority for urgent items. Upgrade to paid tier if MVP gains traction.

## Dependencies at Risk

**expo-calendar with platform-specific issues:**
- Risk: Calendar source type requires `type` field on iOS and Android but type differs between platforms (line 48 in `services/actions.ts`)
- Impact: Calendar events may fail to create if source type is wrong
- Migration plan: If issues persist, consider simpler calendar integration (e.g., opening calendar app with event data as URL params) or switch to user-facing calendar selection flow.

**insforge/sdk browser-dependent auth module:**
- Risk: InsForge SDK auth module relies on `document.cookie` / `localStorage` which don't exist in React Native. Had to build custom REST auth layer.
- Impact: Any SDK updates may break auth if they change API assumptions
- Migration plan: Monitor InsForge SDK releases. Consider request to InsForge to provide React Native auth mode or switch to direct REST API entirely.

**expo-secure-store not encrypted on Android <5:**
- Risk: SecureStore uses SharedPreferences fallback on older Android versions, which is not encrypted
- Impact: Auth token could be readable if device is physically compromised
- Migration plan: Document minimum Android 5 requirement. Consider warning on older devices.

**Gemini Flash-Lite context size (32K tokens):**
- Risk: Classification prompt + large extracted text could exceed context window
- Impact: AI call fails or returns truncated response
- Mitigation: Jina Reader truncates at 15,000 chars (line 188 in `functions/classify/index.ts`) and text content is capped by share extension (line 105 in `services/share-handler.ts`)
- Recommendation: Test with actual large URLs (e.g., Wikipedia articles) to verify truncation is sufficient.

## Missing Critical Features

**No conflict resolution for simultaneous item edits:**
- Problem: If user edits note while realtime update arrives, local state could diverge from server
- Blocks: Multi-device sync, offline mode
- Fix approach: Implement last-write-wins (timestamp-based) or operational transformation (OT). For MVP, acceptable to lose local edit if realtime update arrives.

**No support for image compression before upload:**
- Problem: Share extension allows 5MB images but doesn't compress; could hit bandwidth limits on slow networks
- Blocks: Large-scale image sharing
- Fix approach: Add image compression utility using `react-native-image-resizer` before upload.

**No offline support — all data is remote-first:**
- Problem: User can't view previously loaded items if network is down
- Blocks: Offline-first usage
- Fix approach: Cache items in local SQLite (via `expo-sqlite`). Implement sync queue for offline actions. Requires significant architecture change.

## Test Coverage Gaps

**Calendar creation not tested:**
- What's not tested: `getDefaultCalendarId()`, calendar event creation, fallback calendar creation on missing primary calendar
- Files: `services/actions.ts` (lines 26–61)
- Risk: Calendar code could break and not be caught until user tests it manually
- Priority: High — core action type

**Realtime subscription edge cases:**
- What's not tested: Realtime connection failure, message arrival while disconnected, duplicate subscriptions
- Files: `services/insforge.ts` (lines 433–461), `stores/items.ts` (lines 163–185)
- Risk: Realtime updates could silently fail and user sees stale data
- Priority: High — critical for UX

**Share extension timeout scenarios:**
- What's not tested: Network timeout during image upload, classification trigger failure, share extension abort signals
- Files: `share-extension/index.tsx`, `services/share-handler.ts`
- Risk: Share extension could hang or dismiss without saving on slow networks
- Priority: Medium — affects first-time user experience

**Classify function JSON parsing fallback:**
- What's not tested: AI response with invalid JSON, missing required fields, extra fields in response
- Files: `functions/classify/index.ts` (lines 293–311)
- Risk: Malformed AI response silently falls back to low-confidence classification with empty actions
- Priority: Medium — could cause poor categorization

**Action execution error handling:**
- What's not tested: Calendar permission denial, invalid reminder time, network failure during action execute
- Files: `services/actions.ts` (lines 145–169), `stores/actions.ts` (lines 51–70)
- Risk: Action execution failures could leave actions in inconsistent state (marked completed but not actually executed)
- Priority: High — affects data integrity

**URL pattern matching edge cases:**
- What's not tested: Malformed URLs, redirects, IDNs (international domain names), URL with query params vs. without
- Files: `utils/url-patterns.ts`
- Risk: Classification could misidentify content type based on URL pattern alone
- Priority: Low — Gemini should catch misclassifications

---

*Concerns audit: 2026-02-18*
