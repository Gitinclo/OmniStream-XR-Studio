# OmniStream XR Studio

**License:** [MIT](./LICENSE) · **Version:** `1.0.0` · **Changelog:** [CHANGELOG.md](./CHANGELOG.md)

**OmniStream XR Studio** is a full-stack WebXR spatial media, Lumen video streaming, bioscience 3D molecular visualization, commercial agency quoting (**VibePitch Studio**), and multimodal Gemini AI platform built with **Vanilla TypeScript (`.ts`)**, **Three.js (`0.186.0`)**, **XR Blocks (`0.24.0`)**, **Express**, and **Firebase Firestore**.

---

## 1. Project Maturity & Repository History

- **Current Status (`v1.0.0`)**: Feature-complete reference application with 12 automated test suites (`npm test`) including official **Firebase Firestore Emulator** (`cloud-firestore-emulator`) security rules verification (`npm run test:emulator`), strict TypeScript type-checking (`npm run lint`), and ESLint-verified Firestore Security Rules (`npm run lint:rules`).
- **Why the Git Commit History is Compact**: This codebase was iteratively developed, tested, and verified inside **Google AI Studio Build** and exported to GitHub as a squashed release snapshot. See [CHANGELOG.md](./CHANGELOG.md) and [ROADMAP.md](./ROADMAP.md) for the milestone history (`v0.1.0` through `v1.0.0`).
- **Guest Mode vs. Authenticated Cloud Mode**:
  - **Without Google Sign-In (Guest Mode)**: You can immediately explore the 3D WebXR Broadcast Rig, Lumen Video catalog, Bioscience 3D PDB/AlphaFold viewer, local AES-256-GCM Vault, 90Hz Hardware Telemetry HUD, VibePitch Studio quote calculator, and Compliance Hub locally in your browser.
  - **With Google Sign-In (Authenticated Mode)**: Unlocks cloud-persisted Firestore videos, comments, playlists, content reports (`/content_reports`), moderation tickets (`/moderation_tickets`), YouTube Data API v3 Liked Videos sync, and authenticated `/api/gemini/*` & `/live` WebSocket AI endpoints.

---

## 2. Prerequisites

- **Node.js**: `v20.12+` or `v22.6+` recommended (`node --version`)
- **Java Runtime (for Firestore Emulator tests)**: OpenJDK `21+` (`java -version`) and `firebase-tools` (`firebase --version`). The test harness (`src/services/firestoreRulesHarness.ts`) also auto-detects or bootstraps the OpenJDK 21 runtime and `cloud-firestore-emulator` binary if missing.
- **Package Manager**: `npm` (v10+) or `bun`
- **Browser / Device**:
  - **Desktop**: Chrome, Edge, or Brave with WebGL2 enabled (includes built-in XR Blocks desktop simulator controls).
  - **XR Headset**: Android XR device (e.g., Samsung Galaxy XR, XREAL Aura) or WebXR-compatible headset browser.
- **API Keys & Cloud Services**:
  - **Gemini API Key (`GEMINI_API_KEY`)**: Required only for server-side `/api/gemini/*` and `/live` WebSocket AI features. Obtain a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
  - **Firebase Project**: Pre-configured in `firebase-applet-config.json` (or replace with your own Firebase Web App config).

---

## 3. Installation

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <your-repo-url> omnistream-xr-studio
   cd omnistream-xr-studio
   npm install
   ```

---

## 4. Configuration

### 4.1 Environment Variables (`.env`)
Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Edit `.env` and provide your server-side Gemini API key:

```dotenv
# Required for /api/gemini/* routes and /live WebSocket
GEMINI_API_KEY=your_gemini_api_key_here

# Optional server settings (defaults to port 3000)
PORT=3000
NODE_ENV=development
```

> **Security Note**: `GEMINI_API_KEY` is read exclusively by the Express backend (`server.ts`) via `process.env.GEMINI_API_KEY` and is never exposed to client bundles.

### 4.2 Firebase & Firestore Configuration (`firebase-applet-config.json` & `firebase.json`)
The repository includes `firebase-applet-config.json` pointing to the provisioned Firestore database, and `firebase.json` / `.firebaserc` configuring the local Firebase Firestore Emulator (`127.0.0.1:8088`):
- **Firebase Project ID**: `gen-lang-client-0029274497`
- **Firestore Database ID**: `ai-studio-omnistreamxrstud-a6cf2a14-c6a4-4108-9996-97e7f2404f11`
- **Bootstrapped Super-Admin / GM / Moderator Email**: `creatergame31@gmail.com`

If you want to connect your own Firebase project instead:
1. Enable **Authentication -> Google Sign-In** and **Cloud Firestore** in the [Firebase Console](https://console.firebase.google.com/).
2. Replace the fields in `firebase-applet-config.json` (`projectId`, `appId`, `apiKey`, `authDomain`, `firestoreDatabaseId`) with your Firebase Web App configuration.
3. Deploy `firestore.rules` to your Firestore instance using the Firebase CLI:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

---

## 5. Running the Application

### 5.1 Development Mode (Express + Vite Middleware)
Starts the unified Express backend and Vite frontend server on **`http://localhost:3000`**:

```bash
npm run dev
```

Open **`http://localhost:3000`** in your browser.
- Use the top navigation bar or bottom dock to switch between **Lumen Video**, **YouTube Likes**, **Studio Dashboard**, **3D Rig & Game**, **8K/32K Stream Hub**, **Live & AI Studio**, **Gemini 4 Intelligence**, **Bioscience 3D**, **Workspace & Vault**, **VibePitch Studio**, and **Admin / GM / Moderator**.

### 5.2 Production Build & Start
Compile the optimized client bundle into `dist/` and start the production server on port `3000`:

```bash
npm run build
npm start
```

---

## 6. Running Tests & Linting (Firebase Emulator-Backed)

All Firestore Security Rules tests execute directly against the **official Firebase Firestore Emulator (`cloud-firestore-emulator`)** using `@firebase/rules-unit-testing` (`initializeTestEnvironment`, `assertSucceeds`, `assertFails`) and the `firebase/firestore` client SDK (`getDoc`, `getDocs`, `setDoc`, `updateDoc`, `deleteDoc`, `serverTimestamp`, `Timestamp`):

```bash
# 1. Run all 12 test suites (auto-starts or connects to the Firebase Firestore Emulator on 127.0.0.1:8088)
npm test

# 2. Or run the Firestore rules suite explicitly via `firebase emulators:exec`
npm run test:emulator

# 3. Lint Firestore Security Rules with @firebase/eslint-plugin-security-rules
npm run lint:rules

# 4. Run TypeScript static type-checking across client, server, and tests
npm run lint
```

### What `npm test` Verifies (13 Test Suites)
1. **Firebase Firestore Emulator Verification (`firestore.rules.test.ts`)**: Verifies active HTTP connection to the official `cloud-firestore-emulator` (`/emulator/v1/projects/{projectId}:securityRules`) and confirms `firestore.rules` is compiled and loaded by the emulator.
2. **Dirty Dozen `#1–#12` Adversarial Suite on Firebase Emulator (`firestore.rules.test.ts`)**: Executes all 12 adversarial payloads in [`security_spec.md`](./security_spec.md) (including self-granted `isPremium: true` on `/users/{userId}` create and update) against the Firebase Firestore Emulator and verifies every attack returns `PERMISSION_DENIED`.
3. **Behavioral CRUD & RBAC Across All 8 Collections on Firebase Emulator (`firestore.rules.test.ts`)**: Tests allowed (`assertSucceeds`) and denied (`assertFails`) `getDoc`, `getDocs`, `setDoc`, `updateDoc`, and `deleteDoc` operations on `/videos`, `/videos/{videoId}/comments`, `/playlists`, `/users` (verifying regular users must create with `isPremium: false` and cannot self-update `isPremium`, while `isAdmin()` can grant/revoke `isPremium`), `/admins`, `/moderation_tickets`, `/content_reports`, `/subscriptions`, and `/{document=**}`.
4. **4-Tier Role Hierarchy & Least-Privilege Matrix on Firebase Emulator (`firestore.rules.test.ts`)**: Verifies `SUPER_ADMIN` vs. `ADMIN` vs. `GM` vs. `MODERATOR` vs. invalid `/admins` documents on the Firebase Emulator.
5. **Rule Mutation Sensitivity Proof on Firebase Emulator (`firestore.rules.test.ts`)**: Loads mutated rulesets into the Firebase Firestore Emulator to prove that weakening `isVerifiedUser()` or `hasStaffRole(allowedRoles)` flips test outcomes from denied to allowed.
6. **AES-256-GCM + AAD Encryption & Tamper Rejection (`src/services/suite.test.ts`)**: Verifies 256-bit WebCrypto encryption, unique 12-byte IVs, and `AEADBadTagException` on AAD or ciphertext tampering.
7. **AES-256-GCM 64 KB Chunked Streaming (`src/services/suite.test.ts`)**: Verifies multi-chunk stream encryption and counter-bound AAD reassembly.
8. **Realme 8 5G (90Hz / 4GB RAM) Hardware Governor & Telemetry HUD (`src/services/suite.test.ts`, `src/ui/HardwareTelemetryHud.ts`)**: Verifies live Frame Rate (`currentFps`, `onePercentLowFps`, 24-sample frame-time sparkline), 4GB LPDDR4X Memory Usage (`usedRamMb`, `memoryUsagePercent`, `availableRamMb`, RAM trim), and ARM Mali-G57 MC2 GPU Temperature (`gpuTempCelsius°C`, `socTempCelsius°C`, `gpuClockMhz`, `gpuLoadPercent`, `setGpuTemperatureCelsius()`), plus Top-Bar pill, Floating HUD, and Governor Modal rendering.
9. **VibePitch Studio Engine & 30-Day Guest Lifecycle (`src/services/suite.test.ts`)**: Verifies `InputBoundsValidator`, 7 vertical presets, 6 outreach scripts, and 30-day guest-to-cloud state transitions.
10. **100 Vibe Coding Guardrails & 8 Compliance Docs Completeness (`src/services/suite.test.ts`)**: Verifies all 100 guardrails (`#1–#100`) and 8 compliance specifications.
11. **Server Security Guard — RS256 Firebase JWT Verification (`src/services/suite.test.ts`)**: Verifies cryptographic RS256 signature validation, audience/issuer/expiry checks, and Bearer/WebSocket token extraction.
12. **Server Security Guard — Rate Limiting, Quotas, Server Entitlements & Error Sanitization (`src/services/suite.test.ts`)**: Verifies per-IP and per-user sliding-window rate limits, weighted daily quotas (`250` standard / `500` premium / `1,000` admin), server-authoritative `isPremium` entitlement enforcement (`getUserEntitlement`, `setUserEntitlement`), `/live` WebSocket concurrency caps, and error redaction.
13. **Subscription & Billing Engine (`src/services/subscriptionEngine.ts`, `src/services/suite.test.ts`)**: Verifies 3-tier pricing (`FREE_STANDARD`, `PRO_8K_CREATOR`, `STUDIO_32K_ENTERPRISE`), annual 20% discount math (`$180/yr` Pro 8K, `$468/yr` Studio 32K), invoice generation, and server-side `checkoutUserSubscription` / `cancelUserSubscription` synchronization with `isPremium` and daily AI quota allowances (`250` / `500` / `1,000` units/day).

---

## 7. Project Structure

```text
├── server.ts                         # Express + WebSocket (/live) server with RS256 JWT, subscription, entitlement & quota guard
├── firestore.rules                   # Production Firestore Security Rules (4-tier RBAC + /users & /subscriptions entitlement guards)
├── firestore.rules.test.ts           # Emulator-backed Firestore Rules test suite (@firebase/rules-unit-testing)
├── firebase.json                     # Firebase CLI & Firestore Emulator configuration (127.0.0.1:8088)
├── .firebaserc                       # Firebase project alias configuration
├── firebase-blueprint.json           # Canonical entity JSON schemas and collection path mappings
├── firebase-applet-config.json       # Firebase client SDK configuration
├── security_spec.md                  # Phase 0 Security TDD specification & Dirty Dozen payloads
├── LICENSE                           # MIT License
├── CHANGELOG.md                      # Version history & AI Studio Build export notes
└── src/
    ├── index.ts                      # Application entry point & XR Blocks bootstrap
    ├── index.css                     # Global Tailwind CSS v4 styles
    ├── scene/
    │   └── SpatialStudio.ts          # WebXR 3D Broadcast Rig, 36-node CDN ring & PDB molecular viewer
    ├── services/
    │   ├── serverSecurityGuard.ts    # RS256 Firebase ID token verifier, rate limiter, quota, entitlement & subscription governor
    │   ├── subscriptionEngine.ts     # 3-tier subscription catalog, monthly/annual pricing math & invoice generator
    │   ├── firestoreRulesHarness.ts  # Firebase Firestore Emulator lifecycle manager & @firebase/rules-unit-testing harness
    │   ├── firebase.ts               # Firebase Auth, Firestore CRUD helpers, server entitlement/subscription client & error handler
    │   ├── cryptoAes256.ts           # NIST SP 800-38D WebCrypto AES-256-GCM + AAD engine
    │   ├── hardwareGovernor.ts       # 90Hz/60Hz frame governor, GPU temp/clock monitor & 4GB RAM governor
    │   ├── vibePitchEngine.ts        # 7-vertical quote calculator, bounds validator & 6-script engine
    │   ├── complianceAndGuardrails.ts# 100 Vibe Coding Guardrails & 8-Document Compliance catalog
    │   ├── youtube.ts                # YouTube Data API v3 Liked Videos & quota telemetry service
    │   ├── catalog.ts                # Deterministic seed streams, codecs & spatial audio presets
    │   └── suite.test.ts             # Unit test suite for all pure domain, HUD, subscription & security services
    └── ui/
        ├── AppShell.ts               # Main 2D HUD, modals, Gemini AI studio & Admin/GM console
        ├── SubscriptionView.ts       # Plans & Billing workspace (3-tier matrix, annual toggle, quota meter & invoice ledger)
        ├── HardwareTelemetryHud.ts   # Live Frame Rate, 4GB RAM Memory Usage & GPU Temp HUD component
        ├── ComplianceAndHardwareModals.ts # Compliance Hub, Hardware Governor Modal & AES-256 Vault UI
        └── LumenPlatformView.ts      # Lumen Video Platform player, search, comments & playlists UI
```

---

## 8. Architecture, RBAC & Quota Reference

### 8.1 Seven Core Architectural Pillars
1. **Server-Side Gemini API Security, Subscription & Entitlement Governor (`src/services/serverSecurityGuard.ts`, `src/services/subscriptionEngine.ts` & `server.ts`)**: Mandatory RS256 Firebase ID Token verification on all 10 `/api/gemini/*` routes, `/api/entitlements/*` routes, `/api/subscriptions/*` routes, and `/live` WebSocket upgrades; server-authoritative `isPremium` entitlement & subscription tier enforcement (`FREE_STANDARD`, `PRO_8K_CREATOR`, `STUDIO_32K_ENTERPRISE`); sliding-window rate limits; weighted daily quotas (`250` standard / `500` Pro 8K / `1,000` Studio 32K & Admin); `64kb`/`10mb` body caps; and sanitized `{ error, code, requestId }` responses.
2. **Firebase Emulator-Backed Firestore Security Rules, Entitlement Isolation & 4-Tier RBAC (`firestore.rules`, `src/services/firestoreRulesHarness.ts`, `firestore.rules.test.ts`)**: Official `cloud-firestore-emulator` + `@firebase/rules-unit-testing` verification, strict role enforcement via `hasStaffRole(allowedRoles)` across `SUPER_ADMIN`, `ADMIN`, `GM`, and `MODERATOR`, and `/users/{userId}` + `/subscriptions/{subscriptionId}` entitlement protection (`incoming().isPremium == false || isAdmin()` on create; owners cannot self-upgrade `isPremium` or paid `planId`).
3. **AES-256-GCM Authenticated Encryption Engine (`src/services/cryptoAes256.ts`)**: WebCrypto `AES-256-GCM` with 12-byte CSPRNG IVs, 128-bit auth tags, `user_id:<uid>|record_id:<id>` AAD binding, and 64 KB chunked streaming.
4. **Realme 8 5G (Dimensity 700 / 90Hz / 4GB LPDDR4X RAM) Hardware Telemetry Governor & Live HUD (`src/services/hardwareGovernor.ts` & `src/ui/HardwareTelemetryHud.ts`)**: Real-time **Frame Rate** (`currentFps`, `1% Low FPS`, 24-frame sparkline from a zero-GC `Float32Array(120)` ring buffer), **Memory Usage** (`usedRamMb / 4096 MB`, `memoryUsagePercent%`, `availableRamMb MB Free`, segmented LPDDR4X bar, and one-click/auto `Level 80` RAM trim), and **GPU Temperature & Clock** (`gpuTempCelsius°C`, `socTempCelsius°C`, `gpuClockMhz MHz`, `gpuLoadPercent%` load, interactive `28–58°C` thermal sensor simulator, `45°C` 60Hz throttle, and `50°C` `SAVER_720P_SCALE` downscaling) rendered via a Top-Bar Telemetry Pill, a collapsible bottom-right Floating Telemetry HUD (`#hw-telemetry-floating-hud`), and the full Hardware Governor Modal.
5. **VibePitch Studio 7-Vertical Quote & Script Engine (`src/services/vibePitchEngine.ts`)**: `InputBoundsValidator`, 7 local business verticals, 6 outreach scripts, and 30-day guest-to-cloud lifecycle.
6. **Spatial WebXR 32K Studio, Lumen Video & YouTube Data API v3 (`src/scene/SpatialStudio.ts`, `src/ui/LumenPlatformView.ts`, `src/services/youtube.ts`)**: 8-part 3D Broadcast Rig, 36-node `InstancedMesh` CDN ring, RCSB PDB / AlphaFold molecular viewer, and OAuth 2.0 YouTube Likes manager.
7. **Admin / GM / Moderator Governance & Global Compliance Hub (`src/services/firebase.ts`, `src/services/complianceAndGuardrails.ts`)**: Supervised by `creatergame31@gmail.com` with 100 Vibe Coding Guardrails and 8 compliance docs.

### 8.2 Firestore 4-Tier RBAC Permission Matrix (`firestore.rules`)

| Operation / Collection | `MODERATOR` (`isModerator()`) | `GM` (`isGM()`) | `ADMIN` (`isAdmin()`) | `SUPER_ADMIN` (`isSuperAdmin()`) |
| :--- | :---: | :---: | :---: | :---: |
| **Read own `/admins/{uid}`** | Allowed | Allowed | Allowed | Allowed |
| **Read other `/admins/{adminId}`** | Denied | Denied | Allowed | Allowed |
| **Create / Update / Delete `GM` & `MODERATOR` in `/admins`** | Denied | Denied | Allowed | Allowed |
| **Create / Update / Delete `SUPER_ADMIN` & `ADMIN` in `/admins`** | Denied | Denied | Denied | Allowed |
| **Grant / Revoke `isPremium` on `/users/{userId}`** | Denied | Denied | Allowed | Allowed |
| **Provision Paid Tiers on `/subscriptions/{subscriptionId}`** | Denied | Denied | Allowed | Allowed |
| **Restrict `ageRating` on `/videos/{videoId}`** | Allowed | Allowed | Allowed | Allowed |
| **Update full metadata (`title`, `description`, etc.) on `/videos`** | Denied | Allowed | Allowed | Allowed |
| **Delete `/videos/{videoId}` (non-owner)** | Denied | Denied | Allowed | Allowed |
| **Delete abusive `/videos/{videoId}/comments/{commentId}`** | Allowed | Allowed | Allowed | Allowed |
| **Edit another user's comment `text`** | Denied | Denied | Allowed | Allowed |
| **Resolve non-terminal `MODERATOR` / `CONTACT` tickets** | Allowed | Allowed | Allowed | Allowed |
| **Resolve non-terminal `GM` category tickets** | Denied | Allowed | Allowed | Allowed |
| **Resolve `ADMIN` tickets or reopen terminal `RESOLVED` tickets** | Denied | Denied | Allowed | Allowed |
| **Review active (`OPEN` / `IN_REVIEW`) `/content_reports`** | Allowed | Allowed | Allowed | Allowed |
| **Override terminal (`ACTIONED` / `DISMISSED`) `/content_reports`** | Denied | Denied | Allowed | Allowed |
| **Delete `/moderation_tickets` or `/content_reports` (non-owner)** | Denied | Denied | Allowed | Allowed |

### 8.3 Gemini API, Subscription & Entitlement Endpoint Matrix (`server.ts`)

| Endpoint | Category | Cost Units | Max Req / Min (User) | Max Prompt Chars | Body Limit |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `GET /api/entitlements/me` | `ENTITLEMENT_VERIFY` | `0` | RS256 Auth Verified | — | — |
| `POST /api/entitlements/grant` | `ENTITLEMENT_ADMIN` | `0` | Admin Only (`403` for non-admin) | — | `64kb` |
| `GET /api/subscriptions/plans` | `SUBSCRIPTION_CATALOG` | `0` | Public Catalog | — | — |
| `GET /api/subscriptions/me` | `SUBSCRIPTION_STATE` | `0` | RS256 Auth Verified | — | — |
| `POST /api/subscriptions/checkout` | `SUBSCRIPTION_BILLING` | `0` | RS256 Auth Verified | — | `64kb` |
| `POST /api/subscriptions/cancel` | `SUBSCRIPTION_BILLING` | `0` | RS256 Auth Verified | — | `64kb` |
| `POST /api/gemini/fast-assist` | `FAST_ASSIST` | `1` | `15 / min` | `2,000` | `64kb` |
| `POST /api/gemini/chat` | `CHAT_AND_GROUNDING` | `2` | `12 / min` | `4,000` | `64kb` |
| `POST /api/gemini/search-grounding` | `CHAT_AND_GROUNDING` | `2` | `10 / min` | `1,000` | `64kb` |
| `POST /api/gemini/maps-grounding` | `CHAT_AND_GROUNDING` | `2` | `10 / min` | `1,000` | `64kb` |
| `POST /api/gemini/transcribe` | `VISION_AND_SPEECH` | `3` | `8 / min` | `1,000` | `10mb` |
| `POST /api/gemini/analyze-media` | `VISION_AND_SPEECH` | `5` | `6 / min` | `3,000` | `10mb` |
| `POST /api/gemini/tts` | `VISION_AND_SPEECH` | `5` | `6 / min` | `2,500` | `64kb` |
| `POST /api/gemini/generate-image` | `IMAGE_AND_MUSIC` | `10` | `4 / min` | `2,000` | `10mb` |
| `POST /api/gemini/generate-music` | `IMAGE_AND_MUSIC` | `10` | `4 / min` | `2,000` | `64kb` |
| `POST /api/gemini/generate-video` | `VIDEO_AND_LIVE` | `25` | `2 / min` | `2,000` | `10mb` |
| `WS /live?token=<idToken>` | `VIDEO_AND_LIVE` | `25` | `3 / min` (1 concurrent) | `2,000` | `64kb/msg` |

---

## 9. License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full license text.
