# OmniStream XR Studio

**License:** [MIT](./LICENSE) · **Version:** `1.0.0` · **Changelog:** [CHANGELOG.md](./CHANGELOG.md)

**OmniStream XR Studio** is a full-stack WebXR spatial media, Lumen video streaming, bioscience 3D molecular visualization, commercial agency quoting (**VibePitch Studio**), and multimodal Gemini AI platform built with **Vanilla TypeScript (`.ts`)**, **Three.js (`0.186.0`)**, **XR Blocks (`0.24.0`)**, **Express**, and **Firebase Firestore**.

---

## 1. Project Maturity & Repository History

- **Current Status (`v1.0.0`)**: Feature-complete reference application with 11 automated test suites (`npm test`), strict TypeScript type-checking (`npm run lint`), and ESLint-verified Firestore Security Rules (`npm run lint:rules`).
- **Why the Git Commit History is Compact**: This codebase was iteratively developed, tested, and verified inside **Google AI Studio Build** and exported to GitHub as a squashed release snapshot. See [CHANGELOG.md](./CHANGELOG.md) and [ROADMAP.md](./ROADMAP.md) for the milestone history (`v0.1.0` through `v1.0.0`).
- **Guest Mode vs. Authenticated Cloud Mode**:
  - **Without Google Sign-In (Guest Mode)**: You can immediately explore the 3D WebXR Broadcast Rig, Lumen Video catalog, Bioscience 3D PDB/AlphaFold viewer, local AES-256-GCM Vault, 90Hz Hardware Telemetry HUD, VibePitch Studio quote calculator, and Compliance Hub locally in your browser.
  - **With Google Sign-In (Authenticated Mode)**: Unlocks cloud-persisted Firestore videos, comments, playlists, content reports (`/content_reports`), moderation tickets (`/moderation_tickets`), YouTube Data API v3 Liked Videos sync, and authenticated `/api/gemini/*` & `/live` WebSocket AI endpoints.

---

## 2. Prerequisites

- **Node.js**: `v20.12+` or `v22.6+` recommended (`node --version`)
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

### 4.2 Firebase & Firestore Configuration (`firebase-applet-config.json`)
The repository includes `firebase-applet-config.json` pointing to the provisioned Firestore database:
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

## 6. Running Tests & Linting

All tests run entirely in Node.js with zero external emulator processes required:

```bash
# 1. Run all 11 behavioral Firestore Security Rules & service unit test suites
npm test

# 2. Lint Firestore Security Rules with @firebase/eslint-plugin-security-rules
npm run lint:rules

# 3. Run TypeScript static type-checking across client, server, and tests
npm run lint
```

### What `npm test` Verifies (11 Test Suites)
1. **Dirty Dozen `#1–#12` Adversarial Suite (`firestore.rules.test.ts`)**: Compiles `firestore.rules` into an executable ANTLR4 AST and verifies that all 12 adversarial attacks in [`security_spec.md`](./security_spec.md) return `PERMISSION_DENIED`.
2. **Behavioral CRUD & RBAC Across All 7 Collections (`firestore.rules.test.ts`)**: Tests allowed (`assertSucceeds`) and denied (`assertFails`) `getDoc`, `getDocs`, `setDoc`, `updateDoc`, and `deleteDoc` operations on `/videos`, `/videos/{videoId}/comments`, `/playlists`, `/users`, `/admins`, `/moderation_tickets`, `/content_reports`, and `/{document=**}`.
3. **4-Tier Role Hierarchy & Least-Privilege Matrix (`firestore.rules.test.ts`)**: Verifies `SUPER_ADMIN` vs. `ADMIN` vs. `GM` vs. `MODERATOR` vs. invalid `/admins` documents.
4. **Rule Mutation Sensitivity Proof (`firestore.rules.test.ts`)**: Proves that weakening expressions in `firestore.rules` changes runtime test outcomes.
5. **AES-256-GCM + AAD Encryption & Tamper Rejection (`src/services/suite.test.ts`)**: Verifies 256-bit WebCrypto encryption, unique 12-byte IVs, and `AEADBadTagException` on AAD or ciphertext tampering.
6. **AES-256-GCM 64 KB Chunked Streaming (`src/services/suite.test.ts`)**: Verifies multi-chunk stream encryption and counter-bound AAD reassembly.
7. **Realme 8 5G (90Hz / 4GB RAM) Hardware Governor (`src/services/suite.test.ts`)**: Verifies `11.11ms` (90Hz) and `16.67ms` (60Hz) frame budgets, thermal fallback, `720p` scaling, and memory trim.
8. **VibePitch Studio Engine & 30-Day Guest Lifecycle (`src/services/suite.test.ts`)**: Verifies `InputBoundsValidator`, 7 vertical presets, 6 outreach scripts, and 30-day guest-to-cloud state transitions.
9. **100 Vibe Coding Guardrails & 8 Compliance Docs Completeness (`src/services/suite.test.ts`)**: Verifies all 100 guardrails (`#1–#100`) and 8 compliance specifications.
10. **Server Security Guard — RS256 Firebase JWT Verification (`src/services/suite.test.ts`)**: Verifies cryptographic RS256 signature validation, audience/issuer/expiry checks, and Bearer/WebSocket token extraction.
11. **Server Security Guard — Rate Limiting, Quotas & Error Sanitization (`src/services/suite.test.ts`)**: Verifies per-IP and per-user sliding-window rate limits, weighted daily quotas, `/live` WebSocket concurrency caps, and error redaction.

---

## 7. Project Structure

```text
├── server.ts                         # Express + WebSocket (/live) server with RS256 JWT & quota guard
├── firestore.rules                   # Production Firestore Security Rules (4-tier RBAC + schema guards)
├── firestore.rules.test.ts           # Behavioral Firestore Rules test suite (Dirty Dozen + 4-tier RBAC)
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
    │   ├── serverSecurityGuard.ts    # RS256 Firebase ID token verifier, rate limiter & quota governor
    │   ├── firestoreRulesHarness.ts  # ANTLR4 AST compiler & behavioral evaluator for firestore.rules
    │   ├── firebase.ts               # Firebase Auth, Firestore CRUD helpers & error handler
    │   ├── cryptoAes256.ts           # NIST SP 800-38D WebCrypto AES-256-GCM + AAD engine
    │   ├── hardwareGovernor.ts       # 90Hz/60Hz frame governor, 720p scaler & 4GB RAM monitor
    │   ├── vibePitchEngine.ts        # 7-vertical quote calculator, bounds validator & 6-script engine
    │   ├── complianceAndGuardrails.ts# 100 Vibe Coding Guardrails & 8-Document Compliance catalog
    │   ├── youtube.ts                # YouTube Data API v3 Liked Videos & quota telemetry service
    │   ├── catalog.ts                # Deterministic seed streams, codecs & spatial audio presets
    │   └── suite.test.ts             # Unit test suite for all pure domain & security services
    └── ui/
        ├── AppShell.ts               # Main 2D HUD, modals, Gemini AI studio & Admin/GM console
        └── LumenView.ts              # Lumen Video Platform player, search, comments & playlists UI
```

---

## 8. Architecture, RBAC & Quota Reference

### 8.1 Seven Core Architectural Pillars
1. **Server-Side Gemini API Security Governor (`src/services/serverSecurityGuard.ts` & `server.ts`)**: Mandatory RS256 Firebase ID Token verification on all 10 `/api/gemini/*` routes and `/live` WebSocket upgrades, sliding-window rate limits, weighted daily quotas, `64kb`/`10mb` body caps, and sanitized `{ error, code, requestId }` responses.
2. **Behavioral Firestore Security Rules Engine & 4-Tier RBAC (`firestore.rules`, `src/services/firestoreRulesHarness.ts`, `firestore.rules.test.ts`)**: Executable ANTLR4 AST evaluation and strict role verification via `hasStaffRole(allowedRoles)` across `SUPER_ADMIN`, `ADMIN`, `GM`, and `MODERATOR`.
3. **AES-256-GCM Authenticated Encryption Engine (`src/services/cryptoAes256.ts`)**: WebCrypto `AES-256-GCM` with 12-byte CSPRNG IVs, 128-bit auth tags, `user_id:<uid>|record_id:<id>` AAD binding, and 64 KB chunked streaming.
4. **Realme 8 5G (Dimensity 700 / 90Hz / 4GB LPDDR4X RAM) Hardware Governor (`src/services/hardwareGovernor.ts`)**: Zero-GC `Float32Array(120)` frame-pacing ring buffers, `SAVER_720P_SCALE` GPU downscaling, and `750 MB` RAM floor trim.
5. **VibePitch Studio 7-Vertical Quote & Script Engine (`src/services/vibePitchEngine.ts`)**: `InputBoundsValidator`, 7 local business verticals, 6 outreach scripts, and 30-day guest-to-cloud lifecycle.
6. **Spatial WebXR 32K Studio, Lumen Video & YouTube Data API v3 (`src/scene/SpatialStudio.ts`, `src/ui/LumenView.ts`, `src/services/youtube.ts`)**: 8-part 3D Broadcast Rig, 36-node `InstancedMesh` CDN ring, RCSB PDB / AlphaFold molecular viewer, and OAuth 2.0 YouTube Likes manager.
7. **Admin / GM / Moderator Governance & Global Compliance Hub (`src/services/firebase.ts`, `src/services/complianceAndGuardrails.ts`)**: Supervised by `creatergame31@gmail.com` with 100 Vibe Coding Guardrails and 8 compliance docs.

### 8.2 Firestore 4-Tier RBAC Permission Matrix (`firestore.rules`)

| Operation / Collection | `MODERATOR` (`isModerator()`) | `GM` (`isGM()`) | `ADMIN` (`isAdmin()`) | `SUPER_ADMIN` (`isSuperAdmin()`) |
| :--- | :---: | :---: | :---: | :---: |
| **Read own `/admins/{uid}`** | Allowed | Allowed | Allowed | Allowed |
| **Read other `/admins/{adminId}`** | Denied | Denied | Allowed | Allowed |
| **Create / Update / Delete `GM` & `MODERATOR` in `/admins`** | Denied | Denied | Allowed | Allowed |
| **Create / Update / Delete `SUPER_ADMIN` & `ADMIN` in `/admins`** | Denied | Denied | Denied | Allowed |
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

### 8.3 Gemini API Endpoint Quota & Rate-Limit Matrix (`server.ts`)

| Endpoint | Category | Cost Units | Max Req / Min (User) | Max Prompt Chars | Body Limit |
| :--- | :--- | :---: | :---: | :---: | :---: |
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
| `WS /live?token=<idToken>` | `VIDEO_AND_LIVE` | `25` | `3 / min` (1 concurrent) | `2,000` | `128kb/msg` |

---

## 9. License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full license text.
