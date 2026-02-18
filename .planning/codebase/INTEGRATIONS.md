# External Integrations

**Analysis Date:** 2026-02-18

## APIs & External Services

**URL Content Extraction:**
- Jina Reader API - Extract page text from URLs (r.jina.ai)
  - SDK/Client: Direct fetch (no SDK)
  - Auth: Keyless for <1000 RPD (optional API key via JINA_API_KEY)
  - Used in: `functions/classify/index.ts` (fetchJinaContent), `functions/summarize/index.ts` (fetchJinaContent)
  - Timeout: 8 seconds
  - Fallback: Returns raw URL if Jina fails; no error thrown

**AI Inference (via InsForge AI Gateway):**
- OpenAI GPT-4o-mini - Classification of shared content
  - SDK/Client: InsForge AI Gateway (`client.ai.chat.completions.create()`)
  - Model: `openai/gpt-4o-mini`
  - Used in: `functions/classify/index.ts` (classifyWithAI)
  - Supports multimodal input (text + base64 image)
  - Temperature: 0.1 (low randomness)

- Anthropic Claude Sonnet 4.5 - On-demand content summarization
  - SDK/Client: InsForge AI Gateway (`client.ai.chat.completions.create()`)
  - Model: `anthropic/claude-sonnet-4.5`
  - Used in: `functions/summarize/index.ts`
  - Temperature: 0.3
  - Accessed server-side only (via edge function)

## Data Storage

**Databases:**
- PostgreSQL (via InsForge)
  - Connection: Managed by InsForge at `process.env.EXPO_PUBLIC_INSFORGE_URL`
  - Client: `@insforge/sdk` (uses `client.database.from('table')` pattern)
  - Tables: `items`, `actions`
  - Row-level security (RLS): Enabled — users can only CRUD their own rows (`user_id = auth.uid()`)
  - Edge functions bypass RLS using service role token

**File Storage:**
- InsForge Storage (S3-compatible)
  - Connection: Managed by InsForge SDK via `client.storage.from('bucket')`
  - Bucket: `item-images`
  - Path pattern: `{userId}/{timestamp}-{fileName}`
  - Used for: Storing user-uploaded images and screenshots
  - Access: Presigned URLs returned from upload, used in classification

**Caching:**
- None — direct database queries on each request

## Authentication & Identity

**Auth Provider:**
- InsForge Auth (custom JWT-based)
  - Implementation: Direct REST API calls (SDK auth is browser-only)
  - Endpoints:
    - Sign up: `POST /api/auth/users` (email/password)
    - Sign in: `POST /api/auth/sessions` (email/password)
    - Email verification: `POST /api/auth/email/verify` (email/otp)
    - Resend verification: `POST /api/auth/email/send-verification` (email)
    - Get current user: `GET /api/auth/profiles/current` (requires token)
  - Token persistence: Encrypted via `expo-secure-store` (secure enclave on iOS)
  - Token usage: Set on SDK via `insforge.getHttpClient().setAuthToken(token)` for database/storage/function calls
  - Email verification: Code-based (OTP sent to user email)
  - Auth code path: `services/insforge.ts` (signUp, signIn, signOut, getCurrentUser, verifyEmail, resendVerificationEmail)

## Monitoring & Observability

**Error Tracking:**
- None detected — errors logged to console only

**Logs:**
- Console.log/console.error for development
- No centralized logging service integrated

## CI/CD & Deployment

**Hosting:**
- InsForge backend (via EAS) at `https://a4vmjw99.us-west.insforge.app` (from memory context)
- iOS App Store (via EAS Build + TestFlight for preview)

**CI Pipeline:**
- EAS Build (Expo Application Services)
  - Development profile: Simulator build (`distribution: "internal"`, `simulator: true`)
  - Preview profile: Device build (`distribution: "internal"`, `simulator: false`)
  - Production profile: App Store build (`autoIncrement: true`)

**OTA Updates:**
- Expo Updates (built-in to Expo 52)
- Branch-based: `--branch preview` mentioned in build commands

## Environment Configuration

**Required env vars (development):**
- `EXPO_PUBLIC_INSFORGE_URL` - InsForge base URL (e.g., `https://a4vmjw99.us-west.insforge.app`)
- `EXPO_PUBLIC_INSFORGE_ANON_KEY` - Anon key for client initialization

**Edge function env vars (InsForge Secret Manager):**
- `INSFORGE_BASE_URL` - Base URL passed to edge function SDK client (Deno.env.get())
- Model credentials are NOT stored; accessed via InsForge AI Gateway

**Secrets location:**
- Development: `.env` file (not committed; see `.env.example`)
- Production: InsForge Secret Manager (managed via InsForge dashboard)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Realtime pub/sub (channel-based, not traditional webhooks)
  - Implementation: `client.realtime.publish(channel, event, payload)`
  - Used in: `functions/classify/index.ts` to notify client of item updates
  - Channel pattern: `items:{userId}` (e.g., `items:b148f20a-8e9e-4fea-a46b-027b9b31eb46`)
  - Events: `item_updated`, `item_created`

## Native Platform Integrations

**iOS Calendar:**
- Framework: `expo-calendar` 14.0.6
- Used for: `add_to_calendar` action (creates calendar events)
- Permissions: `NSCalendarsUsageDescription` in app.json

**iOS Photo Library:**
- Framework: `expo-image-picker` 16.0.0
- Used for: Selecting images from library or camera
- Permissions: `NSPhotoLibraryUsageDescription` in app.json

**iOS Notifications:**
- Framework: `expo-notifications` 0.29.0
- Used for: `set_reminder` action (local notifications for time-sensitive items)
- Permissions: `NSUserNotificationsUsageDescription` in app.json

**iOS Share Extension:**
- Framework: `expo-share-extension` 5.0.5
- Entry point: `share-extension/index.tsx`
- Activation rules (app.json):
  - Text sharing
  - Web URLs (max 1)
  - Images (max 1)

**Secure Storage:**
- Framework: `expo-secure-store` 14.0.0
- Used for: Storing JWT access token (encrypted in iOS Secure Enclave)
- Key: `insforge_access_token`
- Accessed in: `services/insforge.ts` (saveToken, clearToken, getCurrentUser)

---

*Integration audit: 2026-02-18*
