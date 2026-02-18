# Technology Stack

**Analysis Date:** 2026-02-18

## Languages

**Primary:**
- TypeScript 5.5.0 - All application code, with strict mode enforced
- JavaScript (Babel transpilation) - Expo/React Native runtime

**Secondary:**
- Deno - Edge function runtime for InsForge functions (Deno v1+)

## Runtime

**Environment:**
- React Native 0.76.9 - Core iOS app framework
- Node.js (implied by npm/package-lock.json) - Development environment

**Package Manager:**
- npm - Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Expo 52.0.0 - Mobile development platform with OTA updates
- expo-router 4.0.0 - File-based routing (Expo Router), used in `app/` directory structure
- React 18.3.1 - UI library
- React Native 0.76.9 - Cross-platform mobile framework

**Testing:**
- vitest 2.0.0 - Unit test runner
- No explicit assertion library listed; likely uses vitest's native asserts

**Build/Dev:**
- Babel via babel-preset-expo - JavaScript transpilation
- TypeScript tsc - Type checking (`npx tsc --noEmit`)
- ESLint 9.0.0 - Linting

**State Management:**
- Zustand 5.0.0 - Minimal React state management
- Location: `stores/auth.ts` and `stores/items.ts`

**Native Integrations:**
- expo-secure-store 14.0.0 - Secure token persistence (SecureStore)
- expo-calendar 14.0.6 - Calendar event creation
- expo-image-picker 16.0.0 - Image/photo selection
- expo-notifications 0.29.0 - Local and push notifications
- expo-share-extension 5.0.5 - iOS Share Sheet extension
- expo-status-bar 2.0.0 - Status bar styling
- react-native-safe-area-context 4.12.0 - Safe area handling
- react-native-screens 4.4.0 - Native screen performance

**Icons & UI:**
- @expo/vector-icons 14.0.4 - Icon library

## Key Dependencies

**Critical:**
- @insforge/sdk latest - All-in-one backend (database, auth, storage, functions, AI, realtime)
  - Used in `services/insforge.ts` (client initialization and all DB/auth/storage ops)
  - Used in edge functions: `functions/classify/index.ts`, `functions/summarize/index.ts`
  - Provides OpenAI-compatible AI gateway and channel-based pub/sub realtime

**Utilities:**
- zod 3.23.0 - Schema validation (imported in ecosystem but see types/item.ts for type definitions)
- date-fns 4.0.0 - Date manipulation and formatting
- ajv 8.18.0 - JSON Schema validation
- ajv-keywords 5.1.0 - Custom ajv keywords for validation

## Configuration

**Environment:**
- `.env` file required at root with:
  - `EXPO_PUBLIC_INSFORGE_URL` - InsForge backend base URL
  - `EXPO_PUBLIC_INSFORGE_ANON_KEY` - Public anonymous API key
  - Edge function environment variables (via InsForge Secret Manager):
    - `GEMINI_API_KEY` (note: memory note references `gpt-4o-mini` and `claude-sonnet-4.5`, AI models are accessed via InsForge AI Gateway)
    - `JINA_API_KEY` - Optional; Jina Reader is keyless for <1000 RPD

**Path Aliases:**
- `@/*` → Root directory (tsconfig.json: `"@/*": ["./*"]`)

**Build:**
- `babel.config.js` - Babel preset for Expo
- `app.json` - Expo configuration with:
  - Bundle identifier: `com.ada.app`
  - Share extension activation rules (text, web URLs, images)
  - Plugin configurations for expo-router, expo-secure-store, expo-share-extension, expo-calendar, expo-notifications
  - Dark mode UI style
- `tsconfig.json` - TypeScript strict mode enabled
- `vitest.config.ts` - Test runner configuration with node environment and global test APIs
- `eas.json` - EAS Build profiles (development for simulator, preview, production)

## Platform Requirements

**Development:**
- macOS with Xcode for iOS simulator
- npm 9+ (inferred from package.json)
- Node.js 18+ (implied by Expo 52 and TypeScript 5.5)
- EAS CLI for building (version >= 12.0.0 per eas.json)

**Production:**
- iOS 13+ (inferred from expo-router, expo-secure-store, other native modules)
- Apple Developer account for App Store distribution
- TestFlight for preview builds

---

*Stack analysis: 2026-02-18*
