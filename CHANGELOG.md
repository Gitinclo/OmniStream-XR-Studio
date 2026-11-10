# Changelog & Project Maturity History

All notable engineering milestones for **OmniStream XR Studio** are documented in this file.

> **Note on Git Repository History**: This project was authored and iteratively verified inside **Google AI Studio Build** and exported to GitHub as a consolidated snapshot, which is why the public Git commit log contains a compact initial commit history rather than every intermediate workspace save.

## [1.0.0] — 2026-11-10
### Added
- **Live Hardware Telemetry HUD Component (`src/ui/HardwareTelemetryHud.ts` & `src/services/hardwareGovernor.ts`)**:
  - Dedicated Top-Bar Telemetry Pill, collapsible bottom-right Floating Telemetry HUD (`#hw-telemetry-floating-hud`), and Governor Modal displaying real-time **Frame Rate** (`currentFps`, `1% Low FPS`, 24-sample frame-time sparkline), **Memory Usage** (`usedRamMb / 4096 MB`, `memoryUsagePercent%`, `availableRamMb MB Free`, segmented LPDDR4X bar), and **GPU Temperature & Clock** (`gpuTempCelsius°C`, `socTempCelsius°C`, `gpuClockMhz MHz`, `gpuLoadPercent%`, and `28–58°C` thermal sensor slider).
- **Official Firebase Firestore Emulator Test Suite (`firestore.rules.test.ts`, `src/services/firestoreRulesHarness.ts`, `firebase.json`, `.firebaserc`)**:
  - Replaced custom rules evaluator with the official **Firebase Firestore Emulator (`cloud-firestore-emulator-v1.22.0.jar`)** and `@firebase/rules-unit-testing`'s `initializeTestEnvironment` + `firebase/firestore` SDK (`12/12` test suites passing via `npm test` and `npm run test:emulator`).
- **Practical Setup, Configuration & Operations Guide (`README.md`)**: Step-by-step installation, `.env` and Firebase configuration, development/production run scripts, emulator test instructions, project maturity notes, and directory map.
- **Open-Source Licensing (`LICENSE`)**: Added standard MIT License and updated `package.json` metadata.
- **4-Tier Firestore RBAC Enforcement (`firestore.rules` & `firestore.rules.test.ts`)**:
  - Replaced broad `exists(/admins/{uid})` checks with `hasStaffRole(allowedRoles)` verifying document existence, `targetUid == request.auth.uid`, and `role in allowedRoles` across `SUPER_ADMIN`, `ADMIN`, `GM`, and `MODERATOR`.

## [0.4.0] — 2026-11-10
### Added
- **Zero-Trust Gemini API Security Governor (`src/services/serverSecurityGuard.ts` & `server.ts`)**:
  - Enforced RS256 Firebase ID Token verification on all 10 `/api/gemini/*` endpoints and `/live` WebSocket upgrades, sliding-window per-IP and per-user rate limiters, weighted daily quotas, scoped payload limits (`64kb` / `10mb`), and sanitized error envelopes.

## [0.3.0] — 2026-11-09
### Added
- **WebCrypto AES-256-GCM + AAD Encryption Engine (`src/services/cryptoAes256.ts`)**: 256-bit keys, 12-byte CSPRNG IVs, 128-bit auth tags, `user_id|record_id` Associated Authenticated Data binding, and 64 KB chunked streaming.
- **Realme 8 5G (90Hz / 4GB RAM) Hardware Governor (`src/services/hardwareGovernor.ts`)**: 90Hz (`11.11ms`) and 60Hz (`16.67ms`) frame pacing ring buffers, `SAVER_720P_SCALE` GPU downscaling, and memory trim.
- **VibePitch Studio (`src/services/vibePitchEngine.ts`) & 100 Guardrails Hub (`src/services/complianceAndGuardrails.ts`)**.

## [0.2.0] — 2026-11-06
### Added
- **Admin / GM / Moderator Governance & Content Reporting (`src/services/firebase.ts`)**: Role registry (`/admins`), moderation tickets (`/moderation_tickets`), and user content reports (`/content_reports`) supervised by `creatergame31@gmail.com`.

## [0.1.0] — 2026-11-03
### Added
- **Spatial WebXR 32K Studio, Lumen Video Platform & YouTube Data API v3 (`src/scene/SpatialStudio.ts`, `src/ui/LumenView.ts`, `src/services/youtube.ts`)**.
