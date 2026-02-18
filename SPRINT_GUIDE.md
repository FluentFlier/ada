# Ada — Sprint Guide

## Prerequisites (What You Do Manually)

### 1. Create InsForge project (~5 min)
1. Go to https://insforge.dev → Sign up → Create project
2. Copy your project URL and anon key from the dashboard
3. Create `.env` in project root (see `.env.example`)

### 2. Get API keys (~5 min)
1. **Gemini**: https://aistudio.google.com/apikey → Create key
2. **Jina Reader**: Optional — keyless works for <1,000 requests/day
3. Add keys to InsForge Secret Manager (Claude Code does this via MCP)

### 3. Install tools
```bash
npm install -g eas-cli    # EAS Build
# Xcode must be installed for iOS simulator
```

### 4. Initialize project
```bash
npx create-expo-app@latest ada --template blank-typescript
cd ada
# Copy starter kit files into project, overwriting defaults
npm install
git init && git add -A && git commit -m "chore: initial scaffold"
eas login && eas init
```

---

## Sprint 0: Compile & Boot (Day 1)

**Goal**: App boots to onboarding screen with no errors.

### Claude Code tasks:
1. Call InsForge MCP `fetch-docs` — read SDK patterns
2. Create InsForge tables via MCP (items, actions)
3. Set InsForge secrets via MCP (GEMINI_API_KEY)
4. Fix any import/type errors: `npx tsc --noEmit`
5. Verify app boots: `npx expo start --ios`
6. Run tests: `npx vitest run`

```bash
git commit -m "feat(setup): sprint-0 complete, app boots"
```

---

## Sprint 1: Core Data Flow (Day 2-4)

**Goal**: Create item → classify via Gemini → see in inbox with realtime.

### Tasks:
1. Auth flow: sign up → sign in → session persists
2. Manual item creation (Add button in inbox for POC)
3. Deploy classify edge function to InsForge
4. Verify: create item → function classifies → realtime updates UI
5. Item detail screen shows extracted data + suggested actions
6. Library filters by category
7. Search works across items

### Validate:
- Create an item with a URL → see it go from "pending" to "classified"
- Check that category, title, description populate correctly
- Verify actions table has suggested actions for the item

```bash
git commit -m "feat(core): sprint-1 complete, classification pipeline works"
```

---

## Sprint 2: Share Extension (Day 5-7)

**Goal**: Share from Safari → appears in inbox, classified.

### Tasks:
1. Configure expo-share-extension in app.json
2. Build dev client: `eas build --platform ios --profile development`
3. Test in simulator: share URL from Safari → "Save to Ada"
4. Verify heuristic pre-classification shows category hint
5. Verify async Gemini classification updates after dismiss
6. Test: share text, share image, share from different apps

```bash
git commit -m "feat(share): sprint-2 complete, share extension works"
```

---

## Sprint 3: Actions & Polish (Day 8-12)

### Tasks:
1. Action approval flow (approve → execute)
2. Calendar integration (expo-calendar)
3. Reminder notifications (expo-notifications)
4. Summarize action (Gemini Flash via InsForge AI Gateway)
5. Empty states, error handling, pull-to-refresh
6. App icon + splash screen

```bash
git commit -m "feat(actions): sprint-3 complete, actions executable"
```

---

## Sprint 4: Ship (Day 13-14)

1. Full test suite passes
2. Build preview: `eas build --platform ios --profile preview`
3. Test on real device (when Apple Dev enrolled)
4. Fix edge cases
5. Share with friends for feedback
