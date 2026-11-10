# Contributing & Engineering Standards (CONTRIBUTING.md)

## 1. Framework & Language Constraints
- **Strictly Vanilla TypeScript (`.ts`)**: Do not introduce React, JSX, or `.tsx` files.
- **XR Blocks Architecture**: 3D scene scripts extend `xb.Script` (`/src/scene/SpatialStudio.ts`).
- **Modular Services**: Place pure domain logic in `/src/services/*.ts` and UI views in `/src/ui/*.ts`.

## 2. Hardware & Cryptographic Guardrails
- **90Hz Frame Pacing**: Never allocate temporary `THREE.Vector3` / `THREE.Matrix4` objects inside `update()`; use module-scope scratch objects and ring buffers.
- **AES-256-GCM Discipline**: All sensitive payloads must use `encryptAes256GcmWithAad()` with a unique 12-byte IV and mandatory `AAD` context string.
- **Schema Parity**: Every client form mutation must pass through `InputBoundsValidator` before calling Firestore.

## 3. Verification Checklist Before Merge
1. Run unit tests: `npx --yes tsx --test src/services/suite.test.ts`
2. Run TypeScript build & linter: `npm run build` and `npm run lint`.
