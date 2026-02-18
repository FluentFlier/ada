# External Integrations

**Analysis Date:** 2026-02-18

## Service: InsForge (Primary Backend)

**Purpose:** All-in-one backend -- database, auth, storage, edge functions, AI gateway, realtime

**SDK/Client:** `@insforge/sdk` (latest)

**Client initialization** (`services/insforge.ts` lines 27-30):
```typescript
import { createClient } from '@insforge/sdk';
export const insforge = createClient({
  baseUrl: CONFIG.insforge.url,    // EXPO_PUBLIC_INSFORGE_URL
  anonKey: CONFIG.insforge.anonKey, // EXPO_PUBLIC_INSFORGE_ANON_KEY
});
```

**Auth approach:** Direct REST calls (SDK auth module is browser-only, uses `document.cookie`/`localStorage`).
- Token stored in `expo-secure-store` under key `insforge_access_token`
- Token set on SDK via `insforge.getHttpClient().setAuthToken(token)` after auth
- All REST auth calls use `Authorization: Bearer ${ANON_KEY}` header

### InsForge Subsystem: Database

**SDK pattern:** `insforge.database.from('table')` (NOT `insforge.from()`)

**Tables accessed:** `items`, `actions`

**Query patterns used:**
```typescript
// Select with filters
insforge.database.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false });

// Insert (MUST chain .select() to get returned data)
insforge.database.from('items').insert({ ... }).select();

// Update
insforge.database.from('items').update({ ... }).eq('id', itemId).select();

// Delete
insforge.database.from('items').delete().eq('id', itemId);

// Single row
insforge.database.from('items').select('*').eq('id', itemId).single();

// Join (actions with items)
insforge.database.from('actions').select('*, item:items(*)').eq('user_id', userId);
```

**Row-level security:** All tables enforce `user_id = auth.uid()`. Edge functions authenticate via `edgeFunctionToken`.

**Used in:** `services/insforge.ts` (all CRUD), `functions/classify/index.ts`, `functions/summarize/index.ts`

### InsForge Subsystem: Auth REST API

**Endpoints (direct `fetch`, not SDK):**

| Method | Endpoint | Purpose | File:Line |
|--------|----------|---------|-----------|
| POST | `/api/auth/users` | Sign up (email/password) | `services/insforge.ts:119` |
| POST | `/api/auth/sessions` | Sign in (email/password) | `services/insforge.ts:131` |
| GET | `/api/auth/profiles/current` | Get current user profile | `services/insforge.ts:154` |
| POST | `/api/auth/email/verify` | Verify email with OTP code | `services/insforge.ts:183` |
| POST | `/api/auth/email/send-verification` | Resend verification code | `services/insforge.ts:196` |

**Token lifecycle:**
1. Sign in/up returns `accessToken`
2. Saved to `expo-secure-store` via `saveToken()`
3. Set on SDK via `insforge.getHttpClient().setAuthToken(token)`
4. On app restart: `getCurrentUser()` reads token from SecureStore, validates via `/api/auth/profiles/current`
5. On sign out: `clearToken()` removes from both SDK and SecureStore

**Dev mode:** Auto-login with test user (`ada.test@example.com`) guarded by `__DEV__` flag (`services/insforge.ts:170`)

### InsForge Subsystem: Storage

**Bucket:** `item-images`

**Upload** (client-side, `services/insforge.ts:389-405`):
```typescript
const path = `${userId}/${Date.now()}-${fileName}`;
const { data, error } = await insforge.storage.from('item-images').upload(path, blob);
```

**Download** (server-side, `functions/classify/index.ts:143-168`):
```typescript
const { data, error } = await client.storage.from('item-images').download(storagePath);
```

**Used for:** Storing shared images/screenshots. Upload happens in share handler; download happens in classify function for image-based classification.

### InsForge Subsystem: Edge Functions

**Functions deployed:**

| Function | Purpose | Trigger | File |
|----------|---------|---------|------|
| `classify` | AI classification pipeline | `insforge.functions.invoke('classify', { body: { item_id } })` | `functions/classify/index.ts` |
| `summarize` | On-demand content summarization | `insforge.functions.invoke('summarize', { body: { item_id, action_id } })` | `functions/summarize/index.ts` |

**Runtime:** Deno with `npm:@insforge/sdk` import

**Auth in edge functions:** Extract `Authorization` header from request, pass as `edgeFunctionToken` to client:
```typescript
const client = createClient({
  baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
  edgeFunctionToken: userToken,
});
```

### InsForge Subsystem: AI Gateway

**OpenAI-compatible API:** `client.ai.chat.completions.create()`

| Model | Purpose | Temperature | File |
|-------|---------|-------------|------|
| `openai/gpt-4o-mini` | Classification (category, title, extraction, actions) | 0.1 | `functions/classify/index.ts:291` |
| `anthropic/claude-sonnet-4.5` | Summarization (executive summary, bullets, actions) | 0.3 | `functions/summarize/index.ts:67` |

**Multimodal support:** Classification supports `image_url` content type with base64 data for image/screenshot classification (`functions/classify/index.ts:277-289`).

**Used only server-side** in edge functions. API keys managed by InsForge, never exposed to client.

### InsForge Subsystem: Realtime

**Pattern:** Channel-based pub/sub (NOT Supabase-style postgres_changes)

**Client subscription** (`services/insforge.ts:433-464`):
```typescript
insforge.realtime.connect();
insforge.realtime.subscribe(`items:${userId}`);
insforge.realtime.on('item_updated', handler);
insforge.realtime.on('item_created', handler);
```

**Server publish** (`functions/classify/index.ts:122-132`):
```typescript
await client.realtime.connect();
await client.realtime.subscribe(`items:${userId}`);
await client.realtime.publish(`items:${userId}`, 'item_updated', { item: updatedItem });
```

**Channel naming:** `items:${userId}`
**Events:** `item_updated`, `item_created`
**Disconnection:** `insforge.realtime.disconnect?.()` on sign out

**Error handling:** Connection/publish failures are logged but non-fatal.

---

## Service: Jina Reader API

**Purpose:** Convert URLs to clean plain text for AI classification and summarization

**SDK/Client:** Direct `fetch` calls (no SDK)

**Base URL:** `https://r.jina.ai/{url}` (configured in `constants/config.ts:19`)

**Auth:** Keyless for free tier (<1,000 RPD). Optional `JINA_API_KEY` for higher limits.

**Usage locations:**
- `functions/classify/index.ts:172-195` (`fetchJinaContent()`)
- `functions/summarize/index.ts:127-146` (`fetchJinaContent()`)

**Request pattern:**
```typescript
const response = await fetch(`https://r.jina.ai/${url}`, {
  headers: { Accept: 'text/plain' },
  signal: controller.signal,  // 8 second timeout
});
const text = await response.text();
return text.slice(0, 15_000);  // Truncate to 15K chars
```

**Error handling:**
- 8-second timeout via `AbortController` (`constants/config.ts:21`)
- Falls back to raw URL on any failure (HTTP error, timeout, network)
- Non-fatal: classification proceeds with raw URL text

**Rate limits:** 1,000 RPD keyless. Higher with API key.

**Note:** `fetchJinaContent()` is duplicated in both edge functions. Candidate for shared utility.

---

## Service: OpenAI (via InsForge AI Gateway)

**Purpose:** Content classification -- categorization, title generation, data extraction, action suggestions

**Model:** `openai/gpt-4o-mini`

**Configuration** (`constants/config.ts:12-13`):
```typescript
classifyModel: 'openai/gpt-4o-mini',
classifyTimeoutMs: 10_000,
```

**Usage:** `functions/classify/index.ts:259-316`

**Prompt structure** (`CLASSIFY_PROMPT` at line 213):
- System role: "Ada, an AI personal secretary"
- Output: Structured JSON with `category` (1 of 12), `confidence` (0-1), `title`, `description`, `extracted_data` (dates, prices, contacts, locations, urgency), `suggested_actions` (add_to_calendar, set_reminder, summarize)
- Action data schemas enforced in prompt

**Response parsing:**
- Strips markdown code fences (`\`\`\`json`) before `JSON.parse()`
- On parse failure: returns `{ category: 'other', confidence: 0.3 }` safe defaults
- Never throws on malformed AI response

---

## Service: Anthropic (via InsForge AI Gateway)

**Purpose:** On-demand summarization triggered by user approving a "summarize" action

**Model:** `anthropic/claude-sonnet-4.5`

**Configuration** (`constants/config.ts:14`):
```typescript
summarizeModel: 'anthropic/claude-sonnet-4.5',
summarizeTimeoutMs: 15_000,
```

**Usage:** `functions/summarize/index.ts:66-75`

**Prompt output format** (`SUMMARIZE_PROMPT` at line 150):
1. Executive summary (2-3 sentences)
2. 3-5 key bullet points
3. Action items mentioned
4. Max 300 words total

**Result handling:**
- Summary stored in `actions.result.summary`
- Also updates `items.description` (truncated to 1,000 chars)
- On failure: marks action as `failed` with error message in `result`

---

## Data Storage

**Database:**
- PostgreSQL (InsForge managed)
- Connection: `@insforge/sdk` database client
- Tables: `items` (content storage + classification), `actions` (suggested/completed actions)
- RLS: All tables enforce `user_id = auth.uid()`

**File Storage:**
- InsForge Storage (S3-compatible)
- Bucket: `item-images`
- Path: `${userId}/${timestamp}-${fileName}`
- Upload: client-side in `services/insforge.ts:389`
- Download: server-side in `functions/classify/index.ts:143`

**Local Storage:**
- `expo-secure-store`: Auth token (`insforge_access_token`), setup flag (`ada_setup_completed`)
- No AsyncStorage, SQLite, or MMKV usage

**Caching:** None (no Redis, no in-memory cache)

---

## Authentication & Identity

**Provider:** InsForge Auth (custom JWT)

**Flow:**
1. User signs up with email/password -> OTP email verification required
2. After verification, `accessToken` returned and stored in SecureStore
3. Token set on SDK for all subsequent API calls
4. On app restart, token loaded from SecureStore and validated against `/api/auth/profiles/current`

**Files:**
- `services/insforge.ts` - Auth REST functions
- `stores/auth.ts` - Auth state (Zustand store)
- `app/_layout.tsx` - Auth gate routing
- `app/onboarding.tsx` - Sign in / sign up UI

---

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Bugsnag, etc.)

**Logging:** `console.error()` / `console.warn()` only. No structured logging.

---

## CI/CD & Deployment

**Client hosting:** iOS App Store via EAS Build + EAS Submit

**Backend hosting:** InsForge (managed platform at `https://a4vmjw99.us-west.insforge.app`)

**Edge functions:** Deployed to InsForge (Deno runtime)

**CI Pipeline:** None configured (no GitHub Actions, etc.)

**OTA Updates:** `eas update --branch preview --message "description"`

---

## Environment Configuration

**Required client env vars (`.env`):**

| Variable | Purpose | Location |
|----------|---------|----------|
| `EXPO_PUBLIC_INSFORGE_URL` | InsForge instance URL | `constants/config.ts`, `services/insforge.ts` |
| `EXPO_PUBLIC_INSFORGE_ANON_KEY` | Anonymous API key | `constants/config.ts`, `services/insforge.ts` |

**Edge function env vars (InsForge Secret Manager):**

| Variable | Purpose | Access |
|----------|---------|--------|
| `INSFORGE_BASE_URL` | InsForge URL for server SDK | `Deno.env.get('INSFORGE_BASE_URL')` |
| AI API keys | Model access | Managed by InsForge AI Gateway (not directly accessed) |

**Optional:**

| Variable | Purpose | Notes |
|----------|---------|-------|
| `JINA_API_KEY` | Higher Jina Reader rate limits | Keyless works for <1000 RPD |

---

## iOS Native Integrations

| Framework | Version | Purpose | Permission |
|-----------|---------|---------|------------|
| `expo-calendar` | ~14.0.6 | Calendar events (add_to_calendar) | `NSCalendarsUsageDescription` |
| `expo-notifications` | ~0.29.0 | Local notifications (set_reminder) | `NSUserNotificationsUsageDescription` |
| `expo-image-picker` | ~16.0.0 | Image selection | `NSPhotoLibraryUsageDescription` |
| `expo-share-extension` | ^5.0.5 | Share Sheet entry point | Activation rules in `app.json` |
| `expo-secure-store` | ~14.0.0 | Encrypted token storage | None needed |

**Share extension activation rules** (`app.json`):
- `NSExtensionActivationSupportsText: true`
- `NSExtensionActivationSupportsWebURLWithMaxCount: 1`
- `NSExtensionActivationSupportsImageWithMaxCount: 1`

**Share extension exports used:** `close`, `openHostApp`, `InitialProps` (NOT `useShareIntent`)

---

## Rate Limits Summary

| Service | Limit | Scope | Impact |
|---------|-------|-------|--------|
| Jina Reader (keyless) | 1,000 RPD | Per IP | URL content extraction degrades to raw URL |
| InsForge AI Gateway | Platform-managed | Per project | Classification/summarization unavailable |
| Share extension memory | 120 MB | iOS hard limit | App baseline ~50 MB, keep processing thin |
| Share extension dismiss | <2 seconds | UX requirement | No heavy processing in extension |

---

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None (realtime pub/sub is used instead of traditional webhooks)

---

*Integration audit: 2026-02-18*
