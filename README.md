# OmniStream XR Studio — Architecture & Engineering Blueprint

## 1. Executive Summary
OmniStream XR Studio is a unified WebXR spatial media, bioscience visualization, AI production, and commercial agency platform built on **Vanilla TypeScript**, **Three.js (r186)**, **XR Blocks (v0.24.0)**, and **Firebase Firestore**.

## 2. Core Architectural Pillars
1. **AES-256-GCM Authenticated Encryption Engine (`/src/services/cryptoAes256.ts`)**:
   - Native WebCrypto `AES-256-GCM` with 256-bit keys, 12-byte CSPRNG IVs, and 128-bit authentication tags.
   - Associated Authenticated Data (`AAD`) binding (`user_id:<uid>|record_id:<id>`) to prevent cross-record ciphertext splicing.
   - Canonical URL-safe Base64 wire format: `[12-byte IV | 16-byte AuthTag | Ciphertext]`.
   - 64 KB sequential chunked streaming encryption with counter-bound AAD.
2. **Realme 8 5G (Dimensity 700 / 90Hz / 4GB RAM) Hardware Governor (`/src/services/hardwareGovernor.ts`)**:
   - Real-time 90Hz (`11.1ms` budget) and 60Hz (`16.6ms` budget) frame pacing monitor using pre-allocated `Float32Array` ring buffers.
   - Dynamic Mali-G57 MC2 GPU render scaling (`NATIVE_1080P` vs `SAVER_720P_SCALE`).
   - 4GB LPDDR4X RAM `availMem` floor tracking, one-click `performMemoryTrim()`, and UFS 2.1 sequential async I/O queueing.
3. **VibePitch Studio 7-Vertical Quote & Script Engine (`/src/services/vibePitchEngine.ts`)**:
   - Deterministic `InputBoundsValidator` mirroring Firestore schema limits.
   - 7 commercial vertical presets, 6-channel pitch script generator, and 30-day guest-to-cloud lifecycle evaluation.
4. **Admin, GM & Moderator Governance (`creatergame31@gmail.com`)**:
   - Full role-based access control (`/admin_roles`, `/moderation_tickets`, `/content_reports`) supervised by Primary Admin `creatergame31@gmail.com`.
