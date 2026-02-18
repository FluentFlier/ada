# Technology Stack

**Analysis Date:** 2026-02-18

## Languages

**Primary:**
- TypeScript ^5.5.0 - All application code (strict mode enforced)

**Secondary:**
- JavaScript - Babel config only (`babel.config.js`)
- Deno (TypeScript) - Edge function runtime (`functions/classify/index.ts`, `functions/summarize/index.ts`)

## Runtime

**Client Environment:**
- React Native 0.76.9 via Expo SDK ~52.0.0
- iOS only (no Android configured; `supportsTablet: false` in `app.json`)
- Expo Go / Development Client for dev, EAS Build for production

**Server Environment:**
- Deno runtime for InsForge Edge Functions
- Import specifier: `npm:@insforge/sdk` (Deno npm compat)
- Environment via `Deno.env.get()`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)
- No `.nvmrc` or `.node-version` file

## Frameworks

**Core:**
- Expo ~52.0.0 - Mobile development platform with managed workflow and OTA updates
- expo-router ~4.0.0 - File-based routing with typed routes (`app.json` → `experiments.typedRoutes: true`)
- React 18.3.1 - UI library
- React Native 0.76.9 - Native rendering

**State Management:**
- Zustand ^5.0.0 - Two stores:
  - `stores/auth.ts` - Auth state (user, loading, email verification flow)
  - `stores/items.ts` - Items state with realtime subscription, optimistic updates, derived accessors

**Testing:**
- Vitest ^2.0.0 - Test runner
- Config: `vitest.config.ts` (globals enabled, node environment)
- 11 test files in `__tests__/` covering services, stores, utilities

**Build/Dev:**
- Babel via `babel-preset-expo` - Transpilation (`babel.config.js`)
- TypeScript ^5.5.0 - Type checking only (`npx tsc --noEmit`)
- ESLint ^9.0.0 - Linting (script in `package.json`, no separate config file found)
- EAS CLI >= 12.0.0 - Build and deployment (`eas.json`)

## Key Dependencies

**Critical (runtime):**

| Package | Version | Purpose | Key Files |
|---------|---------|---------|-----------|
| `@insforge/sdk` | latest | All backend: DB, auth, storage, functions, AI gateway, realtime | `services/insforge.ts`, `functions/*/index.ts` |
| `expo-router` | ~4.0.0 | File-based routing for app screens | `app/` directory |
| `zustand` | ^5.0.0 | Client state management | `stores/auth.ts`, `stores/items.ts` |
| `expo-share-extension` | ^5.0.5 | iOS Share Sheet integration | `share-extension/index.tsx` |
| `expo-secure-store` | ~14.0.0 | Secure token persistence | `services/insforge.ts` |
| `zod` | ^3.23.0 | Schema validation | Listed but not heavily used yet |
| `date-fns` | ^4.0.0 | Date utilities | Listed but manual date utils exist in `utils/format.ts` |

**Platform Integration:**

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-calendar` | ~14.0.6 | iOS Calendar events (add_to_calendar action) |
| `expo-notifications` | ~0.29.0 | Local notifications (set_reminder action) |
| `expo-image-picker` | ~16.0.0 | Image selection from share extension |
| `expo-status-bar` | ~2.0.0 | Status bar styling |
| `react-native-safe-area-context` | 4.12.0 | Safe area insets |
| `react-native-screens` | ~4.4.0 | Native screen containers |
| `@expo/vector-icons` | ~14.0.4 | Icon library for category badges |

**Dev Dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.5.0 | Type checking (`npx tsc --noEmit`) |
| `vitest` | ^2.0.0 | Test runner |
| `eslint` | ^9.0.0 | Linting |
| `@types/react` | ~18.3.0 | React type definitions |
| `ajv` | ^8.18.0 | JSON schema validation (dev) |
| `ajv-keywords` | ^5.1.0 | Extended AJV keywords (runtime dep, used for schema validation) |

## TypeScript Configuration

**Config file:** `tsconfig.json`

**Key settings:**
- Extends `expo/tsconfig.base`
- `strict: true` with additional checks: `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- `exactOptionalPropertyTypes: false`
- Path alias: `@/*` maps to project root — use `@/services/insforge` not `../services/insforge`
- `functions/` directory excluded from client compilation (edge functions use Deno runtime)
- Typed routes enabled via `app.json` → `experiments.typedRoutes: true`

## Configuration Files

| File | Purpose |
|------|---------|
| `app.json` | Expo config: name "Ada", scheme "ada", dark UI, iOS-only, share extension activation rules, plugin configs |
| `eas.json` | EAS Build profiles: development (simulator), preview (device), production (auto-increment) |
| `babel.config.js` | Minimal: just `babel-preset-expo` |
| `tsconfig.json` | TypeScript strict mode, path aliases, excludes `functions/` |
| `vitest.config.ts` | Test config: globals, node env, `@/` alias, includes `__tests__/**/*.test.ts` |
| `constants/config.ts` | Runtime app config: InsForge URLs, AI model names, timeouts, share extension limits |

## Environment

**Client env vars (`.env` file, `EXPO_PUBLIC_` prefix):**
- `EXPO_PUBLIC_INSFORGE_URL` - InsForge instance base URL
- `EXPO_PUBLIC_INSFORGE_ANON_KEY` - InsForge anonymous API key

**Edge function secrets (InsForge Secret Manager, accessed via `Deno.env.get()`):**
- `INSFORGE_BASE_URL` - InsForge base URL for server-side SDK
- AI API keys managed by InsForge AI Gateway (not directly stored)

**No `.env.example` found in the repo.**

## Build Profiles (eas.json)

| Profile | Distribution | Simulator | Notes |
|---------|-------------|-----------|-------|
| `development` | internal | yes | Development client for simulator |
| `preview` | internal | no | TestFlight / device testing |
| `production` | App Store | no | Auto-increment version |

## Platform Requirements

**Development:**
- macOS with Xcode (iOS simulator)
- Node.js (no specific version pinned, Expo 52 implies Node 18+)
- npm
- EAS CLI >= 12.0.0

**Production:**
- iOS only
- Apple Developer account for App Store / TestFlight
- InsForge backend instance

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | `expo start` - Dev server |
| `npm run ios` | `expo start --ios` - Dev server + iOS simulator |
| `npm run typecheck` | `tsc --noEmit` - Type checking |
| `npm test` | `vitest run` - Run all tests |
| `npm run test:watch` | `vitest watch` - Watch mode |
| `npm run lint` | `eslint . --ext .ts,.tsx` - Lint |

## Project Stats

- ~5,739 lines of TypeScript/TSX
- 11 test files in `__tests__/` (190 tests)
- 0 TypeScript errors
- iOS-only target

---

*Stack analysis: 2026-02-18*
