# Changelog & Project Maturity History

All notable engineering milestones for **OmniStream XR Studio** are documented in this file.

> **Note on Git Repository History**: This project was authored and iteratively verified inside **Google AI Studio Build** and exported to GitHub as a consolidated snapshot, which is why the public Git commit log contains a compact initial commit history rather than every intermediate workspace save.

## [1.0.0] — 2026-11-10
### Added
- **Practical Setup, Configuration & Operations Guide (`README.md`)**: Step-by-step installation, `.env` and Firebase configuration, development/production run scripts, test suite instructions, project maturity notes, and directory map.
- **Open-Source Licensing (`LICENSE`)**: Added standard MIT License and updated `package.json` metadata.
- **4-Tier Firestore RBAC Enforcement (`firestore.rules` & `firestore.rules.test.ts`)**:
  - Replaced broad `exists(/admins/{uid})` checks with `hasStaffRole(allowedRoles)` verifying document existence, `targetUid == request.auth.uid`, and `role in allowedRoles` across `SUPER_ADMIN`, `ADMIN`, `GM`, and `MODERATOR`.
  - Added behavioral role-hierarchy and mutation-sensitivity tests (`11/11` passing).

## [0.4.0] — 2026-11-10
### Added
- **Behavioral Firestore Security Rules Engine (`src/services/firestoreRulesHarness.ts` & `firestore.rules.test.ts`)**:
  - Compiled `firestore.rules` with `@firebase/eslint-plugin-security-rules/parser` (ANTLR4 AST) and verified all 12 "Dirty Dozen" adversarial payloads and 7-collection CRUD behaviors using `@firebase/rules-unit-testing` (`assertSucceeds` / `assertFails`).
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
