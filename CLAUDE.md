# Ada — AI Personal Secretary

> "Share anything. It's handled."

Ada is an iOS app where users share anything (links, screenshots, text, images) from any app
via the iOS Share Sheet. Ada autonomously classifies, organizes, and suggests actions — like a
personal secretary that files everything and handles the follow-up.

---

## Global Engineering Standards

### Philosophy

- DRY is non-negotiable — flag repetition aggressively, even across files
- Well-tested code is non-negotiable — too many tests > too few tests
- "Engineered enough" — not under-engineered (fragile, hacky) and not over-engineered
  (premature abstraction, unnecessary complexity)
- Handle more edge cases, not fewer — thoughtfulness > speed
- Explicit over clever — readable code beats dense one-liners
- No speculative features — don't add features, flags, or config unless actively needed
- No premature abstraction — don't create utilities until you've written the same code
  three times
- Replace, don't deprecate — when a new impl replaces an old one, remove the old one
  entirely
- Justify new dependencies — each dependency is attack surface and maintenance burden

### Plan Mode Review Protocol

Review plans thoroughly before making any code changes. For every issue or
recommendation: explain concrete tradeoffs, give an opinionated recommendation, and
ask for my input before assuming a direction.

**Before Starting** — ask which review mode:

1. **BIG CHANGE** — Work interactively, one section at a time
   (Architecture → Code Quality → Tests → Performance), max 4 top issues per section
2. **SMALL CHANGE** — Work interactively, ONE question per review section

**Review Sections:**

1. **Architecture** — system design and component boundaries, dependency graph and
   coupling, data flow patterns and bottlenecks, scaling characteristics and single
   points of failure, security architecture (auth, data access, API boundaries).

2. **Code Quality** — code organization and module structure, DRY violations (be
   aggressive), error handling and missing edge cases (call out explicitly), technical
   debt hotspots, areas over- or under-engineered relative to philosophy above.

3. **Tests** — coverage gaps (unit, integration, e2e), test quality and assertion
   strength, missing edge case coverage (be thorough), untested failure modes and
   error paths.

4. **Performance** — N+1 queries and database access patterns, memory-usage concerns,
   caching opportunities, slow or high-complexity code paths.

**Issue Reporting Format:**

For every specific issue (bug, smell, design concern, or risk):
1. Describe the problem concretely with file and line references
2. Present 2–3 options including "do nothing" where reasonable
3. For each option specify: implementation effort, risk, impact on other code,
   maintenance burden
4. Give your recommended option and why, mapped to philosophy above
5. Ask whether I agree or want a different direction before proceeding

NUMBER each issue (e.g., Issue 1, Issue 2). Give LETTERS for options within each issue
(e.g., Option A, Option B). Recommended option is always listed first.

**Interaction Rules:**
- Do not assume my priorities on timeline or scale
- After each review section, pause and ask for feedback before moving on
- For each stage, output explanation and pros/cons AND your opinionated recommendation,
  then ask me to confirm

### Code Quality Hard Limits

- Max function/method length: 50 lines (excluding comments/blanks)
- Max file length: 500 lines — split if larger
- Max cyclomatic complexity per function: 10
- Max line width: 100 characters
- Max function parameters: 5 — use an options/config object beyond that
- No `any` types in TypeScript — use `unknown` + type guards
- No bare `except`/`catch` — always catch specific errors
- Named exports over default exports (except screen components for expo-router)

### Testing Standards

- Every new feature needs tests before it's considered done
- Test the interface, not the implementation — tests should survive refactors
- Name tests as behaviors: `test_returns_error_when_input_is_empty` not `test_validate`
- Each test should have exactly one reason to fail
- Use factories/fixtures over hardcoded test data
- Test edge cases: empty inputs, boundary values, error paths, concurrent access
- Integration tests for anything touching I/O (database, network, filesystem)
- Use `vitest` for testing

### Workflow Conventions

**Commits:**
- Atomic commits — one logical change per commit
- Conventional commit messages: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore, perf
- No "WIP" commits on shared branches

**Code Review Order:**
When reviewing code, evaluate in this order:
correctness → security → performance → readability → style.
Don't bikeshed style when there are correctness issues.

**Error Handling:**
- Fail fast, fail loud — surface errors early rather than propagating bad state
- Include context in errors: what happened, what was expected, what to do about it
- Distinguish recoverable vs unrecoverable errors — don't retry what can't succeed

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Expo 52 + expo-router | File-based routing, OTA updates, share extension |
| Backend | **InsForge** (DB, Auth, Storage, Functions, AI) | All-in-one, MCP-native |
| AI | Gemini 2.5 Flash-Lite (classify) + Flash (summarize) | Free tier, multimodal |
| URL Extraction | Jina Reader API | Turns URLs into clean text for Gemini |
| State | Zustand | Minimal, no boilerplate |
| Language | TypeScript strict mode | Everywhere |

## CRITICAL: InsForge MCP Integration

**Before writing ANY InsForge integration code, you MUST call the `fetch-docs` MCP tool.**
This is not optional. InsForge's SDK patterns update frequently. The MCP tool returns the
latest, accurate SDK documentation.

```
# In Claude Code, ALWAYS do this first:
→ Call InsForge MCP: fetch-docs
→ Read the returned SDK patterns for database, auth, storage, functions, AI
→ THEN write code using those exact patterns
```

InsForge client initialization (verify via fetch-docs):
```typescript
import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  baseUrl: process.env.EXPO_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY!,
});
```

### InsForge provides ALL of these — do NOT add Supabase:
- **Database**: PostgreSQL with auto-generated REST APIs
- **Auth**: JWT + OAuth (Google, GitHub, Apple, Discord)
- **Storage**: S3-compatible file storage with presigned URLs
- **Edge Functions**: Serverless with Secret Manager
- **Realtime**: WebSocket pub/sub
- **AI Gateway**: Unified SDK for Gemini, OpenAI, Anthropic
- **pgvector**: Vector embeddings for future semantic search

---

## Architecture

```
iOS Share Sheet → expo-share-extension
  → Quick heuristic classification (instant, client-side)
  → Save to InsForge `items` table (status: "pending")
  → Upload images to InsForge Storage
  → Dismiss extension (<2 seconds)

InsForge Edge Function: /classify
  → If URL: Jina Reader extracts page content (r.jina.ai)
  → Gemini 2.5 Flash-Lite classifies (via InsForge AI Gateway)
  → Updates item (status: "classified")
  → Creates suggested action rows

InsForge Realtime → pushes update to app

Main App (Expo Router tabs)
  → Inbox: pending + recently classified items
  → Library: browse by category
  → Search: find anything
  → Item Detail: view extracted data, approve/dismiss actions
```

### Data Flow (One Item Lifecycle)

```
Share → saveItem() → InsForge DB (pending)
                   → triggerClassify() → Edge Function
                                        → Jina Reader (if URL)
                                        → Gemini Flash-Lite
                                        → Update DB (classified)
                                        → Create actions
                   ← Realtime subscription ← UI updates
```

---

## Database Schema

Tables are created via InsForge MCP. Schema for reference:

### items
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| user_id | UUID FK → auth.users | required |
| type | TEXT | 'link' \| 'text' \| 'image' \| 'screenshot' |
| raw_content | TEXT | URL, text, or storage path |
| title | TEXT | nullable, set after classification |
| description | TEXT | nullable, set after classification |
| category | TEXT | one of 12 categories, nullable until classified |
| extracted_data | JSONB | dates, prices, contacts, urgency |
| suggested_actions | JSONB | array of action objects |
| confidence | FLOAT | 0-1, classification confidence |
| status | TEXT | 'pending' \| 'classified' \| 'archived' |
| source_app | TEXT | which app shared from |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto |

### actions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| user_id | UUID FK → auth.users | required |
| item_id | UUID FK → items | required |
| type | TEXT | action type enum |
| status | TEXT | 'suggested' \| 'approved' \| 'completed' \| 'dismissed' \| 'failed' |
| action_data | JSONB | action-specific payload |
| result | JSONB | nullable, execution result |
| created_at | TIMESTAMPTZ | auto |
| completed_at | TIMESTAMPTZ | nullable |

### Row Level Security
- All tables: users can only CRUD their own rows (`user_id = auth.uid()`)
- Edge functions use service role to bypass RLS

---

## Content Categories (12)

| ID | Label | Icon | Use Case |
|----|-------|------|----------|
| events_plans | Events & Plans | calendar | concerts, meetups, RSVPs |
| food_dining | Food & Dining | restaurant | restaurants, recipes |
| shopping_deals | Shopping & Deals | cart | products, wishlists, coupons |
| travel | Travel | airplane | flights, hotels, itineraries |
| jobs_career | Jobs & Career | briefcase | postings, applications |
| learning | Learning | school | articles, tutorials, papers |
| entertainment | Entertainment | film | movies, music, books |
| health_fitness | Health & Fitness | fitness | workouts, appointments |
| finance | Finance | wallet | bills, investments |
| social | Social | people | contacts, profiles |
| inspiration | Inspiration | sparkles | quotes, ideas, design |
| other | Other | folder | catch-all |

---

## Action Types

| Type | Trigger | What it does |
|------|---------|-------------|
| add_to_calendar | Date detected in content | Create calendar event |
| set_reminder | Deadline/urgency detected | Schedule notification |
| save_contact | Contact info detected | Save to contacts |
| summarize | Long content (article, paper) | Generate summary via Gemini |
| create_note | Key points extracted | Structured note |
| track_price | Product with price detected | Monitor for price drops |

---

## Project Structure

```
ada/
├── CLAUDE.md                          ← YOU ARE HERE
├── SPRINT_GUIDE.md                    ← Build roadmap with checkpoints
├── app.json                           ← Expo config + share extension
├── eas.json                           ← EAS Build profiles
├── package.json
├── tsconfig.json
├── babel.config.js
├── .env.example
│
├── app/                               ← Expo Router (file-based routing)
│   ├── _layout.tsx                    ← Root layout (auth gate, realtime)
│   ├── onboarding.tsx                 ← Sign in / sign up
│   ├── (tabs)/
│   │   ├── _layout.tsx                ← Tab navigator
│   │   ├── index.tsx                  ← Inbox
│   │   ├── library.tsx                ← Browse by category
│   │   ├── search.tsx                 ← Search items
│   │   └── settings.tsx               ← Preferences
│   └── item/
│       └── [id].tsx                   ← Item detail + actions
│
├── services/
│   ├── insforge.ts                    ← InsForge client + all DB/auth/storage ops
│   ├── classifier.ts                  ← Heuristic fallback classifier (client-side)
│   └── share-handler.ts              ← Share extension content processor
│
├── stores/
│   ├── auth.ts                        ← Auth state (Zustand)
│   ├── items.ts                       ← Items + realtime (Zustand)
│   └── actions.ts                     ← Actions state (Zustand)
│
├── types/
│   ├── item.ts                        ← Item, Category, ContentType
│   ├── action.ts                      ← Action, ActionType, ActionStatus
│   └── classification.ts             ← Gemini response shapes
│
├── constants/
│   ├── categories.ts                  ← 12 categories with icons/colors/keywords
│   ├── config.ts                      ← App config, API URLs, rate limits
│   ├── actions.ts                     ← Action type definitions
│   └── theme.ts                       ← Colors, spacing, typography
│
├── utils/
│   ├── url-patterns.ts                ← URL → quick category mapping
│   └── format.ts                      ← Date, text formatting
│
├── share-extension/
│   └── index.tsx                      ← Share extension entry point
│
├── functions/                         ← InsForge Edge Functions
│   ├── classify/index.ts             ← Gemini classification pipeline
│   └── summarize/index.ts            ← On-demand summarization
│
├── __tests__/                         ← Test files (13 files)
│   ├── classifier.test.ts
│   ├── url-patterns.test.ts
│   ├── format.test.ts
│   ├── insforge-service.test.ts
│   ├── insforge-queries.test.ts
│   ├── share-handler.test.ts
│   ├── auth-store.test.ts
│   ├── items-store.test.ts
│   ├── actions-store.test.ts
│   ├── actions.test.ts
│   ├── categories.test.ts
│   ├── classify-edge.test.ts
│   └── summarize-edge.test.ts
│
└── assets/
    ├── icon.png
    └── splash.png
```

---

## Key Constraints

- Share extension memory limit: 120MB. Expo baseline ~50MB. Keep it thin.
- Extension must dismiss in <2 seconds. No heavy processing.
- Gemini free tier: Flash-Lite 1,000 RPD / 15 RPM. Flash 250 RPD / 10 RPM.
- Jina Reader free tier: 1,000 RPD (keyless).
- All AI calls happen server-side in edge functions. Gemini key never in client.
- InsForge handles auth tokens automatically — don't roll your own JWT logic.

---

## Environment Variables

```bash
EXPO_PUBLIC_INSFORGE_URL=https://your-app.region.insforge.app
EXPO_PUBLIC_INSFORGE_ANON_KEY=your-anon-key
# Edge function secrets (set via InsForge Secret Manager):
INSFORGE_BASE_URL=https://your-app.region.insforge.app
GEMINI_API_KEY=AIza...
JINA_API_KEY=jina_...  # Optional, keyless works for <1000 RPD
```

---

## Patterns Adapted from Stash Codebase

These patterns were extracted from a previous project (Stash) and adapted for Ada:

1. **URL pattern routing** (from analyzer.ts) → `utils/url-patterns.ts`
   Quick-classify URLs by domain before hitting Gemini. YouTube → entertainment,
   Amazon → shopping. Gives instant feedback in share extension.

2. **Heuristic fallback** (from queue.ts) → `services/classifier.ts`
   When Gemini quota is exhausted or network is down, classify using keyword matching
   against category definitions. Low confidence (0.5) — Gemini refines later.

3. **Urgency/deadline extraction** (from deadline-extractor.ts) → classify function
   <24h = critical, <72h = high, <1 week = medium, else low.
   Folded into the Gemini classification prompt.

4. **Actions as DB rows** (from notifications.ts) → `actions` table
   Store suggested actions as database rows with status lifecycle
   (suggested → approved → completed), not as push notifications.

5. **Find-or-create category** (from executor.ts) → auto-categorization
   Items get assigned to existing categories. No user-created categories at MVP.

### Patterns explicitly SKIPPED from Stash:
- 4-agent orchestration (one Gemini call replaces all)
- Supermemory (pgvector in InsForge handles semantic search later)
- Redis queues (InsForge realtime replaces)
- Python bridge, LiveKit voice
- Video frame extraction (Gemini handles video URLs)

---

## Build Commands

```bash
# Development
npx expo start --ios                    # Dev server + iOS simulator

# Type checking
npx tsc --noEmit                        # Verify types

# Testing
npx vitest run                          # Run all tests
npx vitest watch                        # Watch mode

# InsForge (via MCP — Claude Code handles this)
# Tables, functions, secrets are managed through InsForge MCP

# Building (requires Xcode for simulator, Apple Dev for device)
eas build --platform ios --profile development   # Simulator build
eas build --platform ios --profile preview       # TestFlight

# OTA Updates
eas update --branch preview --message "description"
```
