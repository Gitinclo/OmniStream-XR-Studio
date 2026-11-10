# Security Policy & Cryptographic Specification (SECURITY.md)

## 1. Authenticated Encryption Standard (NIST SP 800-38D)
- **Algorithm**: `AES-256-GCM` (Galois/Counter Mode) via WebCrypto `crypto.subtle`.
- **Key Length**: 256 bits (32 bytes).
- **Initialization Vector (IV)**: 12 bytes (96 bits) generated freshly per encryption operation via `crypto.getRandomValues(new Uint8Array(12))`. IV reuse with the same key is strictly prohibited.
- **Authentication Tag**: 128 bits (16 bytes) verified prior to releasing any decrypted plaintext.
- **Packed Wire Layout**: `[12-byte IV | 16-byte AuthTag | Ciphertext]` encoded in URL-safe Base64 (`-` and `_`, no padding `=`).
- **Associated Authenticated Data (AAD)**: Every ciphertext is cryptographically bound to `user_id:<uid>|record_id:<id>`. Modifying the AAD or transplanting ciphertext to another record triggers an immediate `AEADBadTagException`.
- **64 KB Chunked Stream Encryption**: Large payloads are segmented into 64 KB blocks encrypted sequentially with counter-bound AAD (`user_id:<uid>|record_id:<id>|chunk_index:<i>`) to prevent chunk reordering or truncation attacks.

## 2. Server-Side Gemini API Authentication, Rate Limiting & Quota Protection (`/src/services/serverSecurityGuard.ts`)
- **Mandatory Firebase ID Token Verification**: All `/api/gemini/*` endpoints and the `/live` WebSocket upgrade verify `RS256` Firebase ID tokens against Google's `securetoken@system.gserviceaccount.com` X.509 public certificates and validate `aud` (`gen-lang-client-0029274497`), `iss`, `exp`, `iat`, and `sub`. Unauthenticated requests are rejected with `401 Unauthorized`.
- **Sliding-Window Rate Limiting**: Enforces per-IP (`30 req/min`) and per-user/per-endpoint sliding-window rate limits (`2 req/min` for video generation, `4 req/min` for image/music generation, `6–15 req/min` for speech/vision/chat).
- **Weighted Daily Request Quotas**: Tracks per-user (`250 units/day` standard, `1,000 units/day` admin) and global (`5,000 units/day`) quota consumption, plus `/live` WebSocket concurrency caps (`1` active session per user, `10-minute` max duration, `25 frames/sec` limit).
- **Sanitized Error Envelopes & Log Redaction**: Internal exceptions never leak raw `error.message` or stack traces to clients; clients receive `{ error, code, requestId }` and server logs redact API keys and Bearer tokens via `redactSensitiveErrorDetails()`.

## 3. 4-Tier Role-Based Access Control (`SUPER_ADMIN` > `ADMIN` > `GM` > `MODERATOR`) & Firebase Emulator Verification
- **Role-Verified Staff Lookup (`hasStaffRole(allowedRoles)`)**: In `/firestore.rules`, staff authorization never relies on document `exists()` alone. Every check validates `isVerifiedUser()`, `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`, `get(...).data.targetUid == request.auth.uid`, and `get(...).data.role in allowedRoles`.
  - **`isSuperAdmin()`** (`creatergame31@gmail.com` or `role == 'SUPER_ADMIN'`): Full control over `/admins/{adminId}` across all 4 tiers.
  - **`isAdmin()`** (`SUPER_ADMIN` or `role == 'ADMIN'`): Manages subordinate staff (`GM`, `MODERATOR`), deletes `/videos`, `/moderation_tickets`, and `/content_reports`, resolves `ADMIN` category tickets, and overrides terminal states.
  - **`isGM()`** (`SUPER_ADMIN`, `ADMIN`, or `role == 'GM'`): Updates full video metadata and resolves non-terminal `GM`, `MODERATOR`, and `CONTACT` tickets; cannot manage `/admins` or delete videos/tickets/reports.
  - **`isModerator()`** (`SUPER_ADMIN`, `ADMIN`, `GM`, or `role == 'MODERATOR'`): Restricts video `ageRating`, deletes abusive comments, reviews active `OPEN`/`IN_REVIEW` content reports, and resolves non-terminal `MODERATOR`/`CONTACT` tickets.
- **Official Firebase Firestore Emulator Verification (`/firestore.rules.test.ts` & `/src/services/firestoreRulesHarness.ts`)**: Loads `firestore.rules` into the official `cloud-firestore-emulator` via `@firebase/rules-unit-testing`'s `initializeTestEnvironment` and verifies allowed (`assertSucceeds`) and denied (`assertFails`) `firebase/firestore` SDK operations across all 12 Dirty Dozen payloads, all 7 collections, and all 4 staff tiers.

## 4. OAuth 2.0 & Secret Hygiene
- Google Workspace and YouTube Data API v3 OAuth 2.0 access tokens are cached strictly in volatile memory (`cachedAccessToken`) and never written to `localStorage` or `sessionStorage`.
- Server-side Gemini API keys are accessed exclusively on the Express backend via `process.env.GEMINI_API_KEY`.
