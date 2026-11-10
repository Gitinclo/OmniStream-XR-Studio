# Contributing & Engineering Standards (CONTRIBUTING.md)

## 1. Framework & Language Constraints
- **Strictly Vanilla TypeScript (`.ts`)**: Do not introduce React, JSX, or `.tsx` files.
- **XR Blocks Architecture**: 3D scene scripts extend `xb.Script` (`/src/scene/SpatialStudio.ts`).
- **Modular Services**: Place pure domain logic in `/src/services/*.ts` and UI views in `/src/ui/*.ts`.

## 2. Hardware, Cryptographic & Security Rules Guardrails
- **90Hz Frame Pacing**: Never allocate temporary `THREE.Vector3` / `THREE.Matrix4` objects inside `update()`; use module-scope scratch objects and ring buffers.
- **AES-256-GCM Discipline**: All sensitive payloads must use `encryptAes256GcmWithAad()` with a unique 12-byte IV and mandatory `AAD` context string.
- **Schema Parity**: Every client form mutation must pass through `InputBoundsValidator` before calling Firestore.
- **Firebase Emulator-Backed Security Rules & 4-Tier RBAC Testing**: Never rely on regex matching or custom in-memory evaluators to test `firestore.rules`. All security rule changes must be verified against the official **Firebase Firestore Emulator** (`cloud-firestore-emulator`) in `firestore.rules.test.ts` via `@firebase/rules-unit-testing` (`initializeTestEnvironment`, `assertSucceeds`, `assertFails`) across all 12 "Dirty Dozen" adversarial payloads, all 7 collections, and all 4 staff tiers (`SUPER_ADMIN`, `ADMIN`, `GM`, `MODERATOR`).

## 3. Verification Checklist Before Merge
1. Run all 12 emulator-backed & unit test suites: `npm test` (or `npm run test:emulator`)
2. Lint Firestore Security Rules: `npm run lint:rules` (`eslint firestore.rules`)
3. Run TypeScript build & linter: `npm run build` and `npm run lint`.
