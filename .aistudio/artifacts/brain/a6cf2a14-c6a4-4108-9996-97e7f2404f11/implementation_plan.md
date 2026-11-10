# OmniStream XR Studio — AES-256-GCM Cryptography, 90Hz/4GB Hardware Telemetry HUD, 100-Guardrail & 8-Doc Compliance Hub, and VibePitch Studio Suite

Deliver a unified upgrade to **OmniStream XR Studio** integrating all four attached specifications:
1. **AES-256-GCM Authenticated Encryption Engine (WebCrypto + AAD Context Binding & Chunked Streaming)**
2. **Realme 8 5G (Dimensity 700 / 90Hz / 4GB LPDDR4X RAM) Hardware & Thermal Governor + Top-Bar Telemetry Pill & Interactive HUD Modal**
3. **100 Vibe Coding Agent Guardrails Catalog & 8-Document Global Compliance Hub (`README`, `SECURITY`, `PRIVACY`, `TERMS`, `ACCOUNT`, `CONTRIBUTING`, `CODE OF CONDUCT`, `ROADMAP`)**
4. **VibePitch Studio 7-Vertical Quote Calculator, Input Bounds Validator, 30-Day Guest-to-Cloud Lifecycle, & 6-Part Pitch Script Generator**

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions were confirmed during Phase 1 and govern this execution plan:

- **Confirmed Decision 1 — Unified Specification Integration**: Integrate all attached specifications into OmniStream XR Studio:
  - **AES-256-GCM AEAD Engine**: Production-grade WebCrypto `AES-GCM` (256-bit key, unique 96-bit / 12-byte random IV per encryption, 128-bit authentication tag, Associated Authenticated Data `AAD` binding to user/record IDs, and 64 KB sequential chunked streaming for large payloads).
  - **90Hz / 60Hz Thermal & 4GB RAM Hardware Governor**: Real-time `requestAnimationFrame` frame-budget monitor (`11.1ms` @ 90 FPS vs `16.6ms` @ 60 FPS thermal saver), 500ms-throttled telemetry emissions, non-destructive `720p Fill-Rate Saver` vs `1080p Native` GPU render scaling for the Three.js / WebXR canvas, and non-blocking 4GB heap cache trimming.
  - **100 Vibe Coding Guardrails & 8-Doc Global Compliance Suite**: Searchable interactive catalog of all 100 guardrails across 10 engineering categories plus the 8-tab Global Compliance & Governance viewer (`ISO/IEC 27701` & 150+ jurisdictions) and repository markdown documents.
  - **VibePitch Studio 7-Niche Sales & Pitch Engine**: Interactive B2B quote & deposit calculator (`InputBoundsValidator` enforcing `setupFeeOffer` in `0..50,000`, `monthlyRetainerOffer` in `0..5,000`, `depositPercent` in `0..100`), 6-part pitch script generator across all 7 verticals (`HOME_TRADES`, `SALON_AND_CLEANERS`, `DENTAL_AND_TUTORS`, `AUTO_DETAILING`, `BOUTIQUE_FITNESS`, `ECOMMERCE_SHOPIFY`, `SAAS_AI_REMEDIATION`), and 30-day Guest-to-Cloud lifecycle manager.
- **Confirmed Decision 2 — WebCrypto AES-256-GCM with AAD User Binding**: Generate and manage a 256-bit `CryptoKey` via the browser's native WebCrypto API (`crypto.subtle`), enforce a fresh 12-byte `crypto.getRandomValues` nonce on every encryption operation, and bind immutable context (`user_id:<uid>|record_id:<id>`) as `additionalData` (AAD) so ciphertext cannot be transplanted across users or records.
- **Confirmed Decision 3 — Top-Bar 90Hz Telemetry Pill + Interactive HUD & Compliance Modals**: Surface a high-contrast `90Hz · <ms>ms · 4GB OK` telemetry trigger and `Docs & Compliance` trigger directly in the top bar that open the **Realme 8 5G Hardware & Thermal HUD Modal** and the **8-Doc Global Compliance & 100-Guardrail Hub Modal**, while also providing full workspace access inside the **Workspace & Vault** and **Studio Dashboard** views.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **Cryptographic Data Protection (AES-256-GCM + AAD)**: Upgrades OmniStream XR's encryption service to pack `[12-byte IV + Ciphertext + 16-byte AuthTag]` into a URL-safe Base64 token bound to an immutable `additionalData` (AAD) context string, plus support for 64 KB chunked streaming encryption with counter-bound AAD for large media manifests.
  - **90Hz Frame-Budget & 4GB RAM Governor**: Tracks frame durations in a ring buffer and emits UI telemetry every 500ms to prevent DOM thrashing. Automatically or manually switches between `AUTO_90HZ_THERMAL_GUARD` (`11.1ms` budget), `LOCKED_90HZ`, and `THERMAL_SAVER_60HZ` (`16.6ms` budget), dynamically scales the Three.js WebGL renderer pixel ratio (`NATIVE_1080P` vs `SAVER_720P_SCALE`), and provides a 1-tap **Purge Cache & Trim 4GB Heap** action.
  - **100 Vibe Coding Guardrails & 8-Document Compliance Hub**: Embeds all 100 engineering guardrails (Categories I–X: Code Preservation, Modularity, Dependencies, TypeScript, Security, Frontend UX, Backend/DB Safety, Error Handling, Terminal Limits, Self-Verification) and all 8 governance documents (`README`, `SECURITY`, `PRIVACY`, `TERMS`, `ACCOUNT`, `CONTRIBUTING`, `CODE OF CONDUCT`, `ROADMAP`) with live filtering and clipboard export.
  - **VibePitch Studio 7-Niche B2B Engine & InputBoundsValidator**: Provides the complete 7-vertical catalog, `InputBoundsValidator` (`businessName <= 100`, `contactName <= 100`, `websiteGapNote <= 300`, `tagline <= 150`, `notes <= 500`, `depositPercent 0..100`, `setupFeeOffer 0..50,000`, `monthlyRetainerOffer 0..5,000`), 6-part script generator, and 30-day Guest-to-Cloud lifecycle evaluator (`Day 1–19` active, `Day 20–30` soft prompt, `Day 31+` hard gate + Firestore cloud migration).
- **Target Audience / Persona**: Creators, sales/pitch engineers, and platform administrators (`creatergame31@gmail.com`) running OmniStream XR Studio across desktop, WebXR headsets, and 90Hz mobile 5G devices.
- **Key Value**: Combines authenticated cryptographic security, deterministic 90 FPS hardware governance, strict schema bounds validation, and global regulatory compliance in a single cohesive interface.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Top-Bar 90Hz Telemetry Pill & Hardware Optimizer HUD**:
     - The top bar displays a live tabular-numeral status button (`90Hz · 8.2ms · 4GB OK` or `60Hz Saver · 14.1ms`).
     - Clicking the button opens the **Realme 8 5G (Dimensity 700 / 90Hz / 4GB RAM) Hardware Optimizer HUD Modal**, featuring:
       - **SoC & Thread Affinity Telemetry**: Displays the `MediaTek Dimensity 700 (2x A76 @ 2.2GHz + 6x A55 @ 2.0GHz)` topology and sequential UFS 2.1 async I/O queue status.
       - **Refresh Rate & Thermal Mode Selector**: Interactive buttons to switch between `Auto 90Hz/60Hz Thermal Guard`, `Locked 90Hz (11.1ms)`, and `60Hz Thermal Saver (16.6ms)`, plus a thermal simulation toggle (`NOMINAL`, `LIGHT`, `MODERATE (60Hz Cap)`, `CRITICAL THROTTLE`).
       - **Mali-G57 MC2 GPU Render Scale**: Toggle between `1080x2400 Native (MSAA Active)` and `720p Fill-Rate Saver` (which dynamically adjusts the Three.js WebGL renderer pixel ratio without distorting 2D UI layout).
       - **4GB LPDDR4X Heap & Cache Trim**: Displays live memory usage and a **Trim Memory & Flush Caches (`MANUAL_4GB_PURGE`)** button that evicts cached scripts, YouTube responses, and guardrail buffers.
  2. **Docs & Global Compliance + 100-Guardrail Modal**:
     - Clicking **Docs & Compliance** in the top bar opens the interactive **Global Compliance & 100-Guardrail Hub Modal**.
     - Users can switch across all 8 compliance tabs (`README`, `SECURITY`, `PRIVACY`, `TERMS`, `ACCOUNT`, `CONTRIBUTING`, `CODE OF CONDUCT`, `ROADMAP`) or browse/search all **100 Vibe Coding Agent Guardrails** by category (`I` through `X`) and copy individual or condensed rulesets.
  3. **AES-256-GCM + AAD Interactive Vault & VibePitch Studio Workbench**:
     - Inside **Workspace & Vault** (and accessible from the HUD), users can encrypt and decrypt payloads using **AES-256-GCM** with custom or auto-bound **Associated Authenticated Data (`AAD`)** (e.g., `user_id:creatergame31@gmail.com|record_id:vault_01`), inspect the packed `Base64URL(12B IV + 16B AuthTag + Ciphertext)` structure, test AAD tampering detection (verifying that mismatched AAD immediately throws an authentication tag failure), and test 64 KB chunked streaming encryption.
     - Users can also configure any of the **7 VibePitch Verticals**, clamp pricing inputs via `InputBoundsValidator`, generate all **6 Pitch & Scope Scripts**, manage local guest prospects/leads, and test Day 1 / Day 20 / Day 31 guest lifecycle states or sync prospects to Firestore.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast precision instrumentation aligned with OmniStream XR's Obsidian Slate (`#0B0F19`), Electric Indigo (`#6366F1`), and Emerald (`#10B981`) dark/light dual theme.
  - *Typography & Tabular Discipline*: Crisp geometric display headers paired with `font-mono tabular-nums` for all frame timings (`8.2ms / 11.1ms`), memory counters (`MB`), quote figures (`$0–$50,000`), and cryptographic nonces/tags.
  - *Anti-Slop & GPU-Friendly Surfaces*: Flat single-elevation surfaces with 1px structural borders (`border-slate-800`), unboxed metadata with middle-dot (`·`) separators, and zero multi-pass blur overdraw during `SAVER_720P_SCALE` mode.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native WebCrypto AES-256-GCM with Context-Bound AAD & Base64URL Packing**
  - *Chosen Approach*: Use `window.crypto.subtle` (`AES-GCM`, 256-bit key, 96-bit random IV via `crypto.getRandomValues(new Uint8Array(12))`, 128-bit tag) and pass the UTF-8 encoded `aad` string (`user_id:<uid>`) into `additionalData`. Pack `[12-byte IV | 16-byte AuthTag | Ciphertext]` into a single URL-safe Base64 token, plus a dedicated chunked streaming helper for multi-chunk payloads where each 64 KB chunk binds its chunk index into the AAD/nonce.
  - *Why*: Matches the exact specification in `Implement_AES-256_for_a_specific_application.pdf`, requires zero external npm dependencies, prevents nonce reuse, and guarantees cryptographic integrity against cross-record ciphertext splicing.
- **Decision 2: 500ms-Throttled Frame Telemetry & Non-Destructive 720p WebGL Scaling**
  - *Chosen Approach*: Sample `requestAnimationFrame` frame deltas in a ring buffer (`p50`, `p95`, last frame ms) and emit UI updates once every 500ms (`lastUiEmitTimestampMs >= 500`), while applying `SAVER_720P_SCALE` strictly to the Three.js WebGL renderer pixel ratio (`renderer.setPixelRatio`) rather than mutating root CSS zoom/density.
  - *Why*:Directly implements the critical engineering refinements from `Application_optimisation_plan.pdf`—preventing 90-recomposition-per-second UI overhead and protecting 1080x2400 layout geometry while cutting Mali-G57 GPU fill-rate load.
- **Decision 3: Unified Client + Firestore Schema Bounds via `InputBoundsValidator`**
  - *Chosen Approach*: Implement `InputBoundsValidator` enforcing `businessName <= 100`, `contactName <= 100`, `websiteGapNote <= 300`, `tagline <= 150`, `notes <= 500`, `depositPercent in 0..100`, `setupFeeOffer in 0..50000`, and `monthlyRetainerOffer in 0..5000` across both local Guest Mode (`LocalGuestSessionManager`) and Firestore rules/migrations.
  - *Why*: Guarantees that every record created in Guest Mode (`Days 1–30`) passes zero-trust `firestore.rules` validation during cloud migration without truncation errors or permission rejections.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 Top Navigation Bar (AppShell Header)                         │
│  • 90Hz Telemetry Trigger ("90Hz · 8.2ms · 4GB OK") -> Hardware HUD Modal    │
│  • Docs & Compliance Trigger -> 8-Doc Compliance & 100-Guardrail Modal       │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
                ▼                                              ▼
┌───────────────────────────────────────────┐  ┌───────────────────────────────┐
│   RealmeHardwareOptimizer (Governor)      │  │   AES-256-GCM Crypto Engine   │
│  • RefreshRateMode (Auto/90Hz/60Hz Saver) │  │  • 256-bit WebCrypto KeyGen   │
│  • 500ms Ring-Buffer Frame Telemetry      │  │  • 12-Byte CSPRNG Nonce/IV    │
│  • GpuRenderScaleMode (1080p vs 720p WebGL│  │  • AAD Context Binding        │
│  • 4GB RAM Cache Purge & UFS Async I/O    │  │  • 64KB Chunked Stream AEAD   │
└───────────────┬───────────────────────────┘  └───────────────┬───────────────┘
                │                                              │
                ▼                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│        VibePitch Studio, 100-Guardrail Catalog & Compliance Suite            │
│  • InputBoundsValidator (Exact Firestore & Local Guest Bounds Clamping)      │
│  • 7 NicheKey Presets + 6-Part Pitch/Proposal/Scope Script Generator         │
│  • 30-Day Guest Session Lifecycle (Day 1–19 / Day 20–30 / Day 31+ Gate)      │
│  • 100 Vibe Coding Guardrails (Categories I–X) + 8 Global Compliance Docs    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **AES-256-GCM Envelope (`Aes256GcmPayload`)**:
  - `token`: URL-safe Base64 string encoding `[12-byte IV | 16-byte Tag | Ciphertext]`.
  - `aad`: Immutable context string (e.g., `user_id:<uid>|record_id:<id>`).
  - `ivHex`, `tagHex`, `ciphertextBytes`, `chunkCount`: Diagnostic metadata for the interactive encryption inspector.
- **`HardwareTelemetryState` (Immutable Snapshot)**:
  - `socModel`: `"MediaTek Dimensity 700 (2x A76 @ 2.2GHz + 6x A55 @ 2.0GHz)"`
  - `gpuModel`: `"ARM Mali-G57 MC2 @ 955MHz (Vulkan 1.1 / OpenGL ES 3.2)"`
  - `refreshRateMode`: `'AUTO_90HZ_THERMAL_GUARD' | 'LOCKED_90HZ' | 'THERMAL_SAVER_60HZ'`
  - `targetFps`: `90 | 60`, `frameBudgetMs`: `11.1 | 16.6`, `lastFrameTimeMs`: number, `p95FrameTimeMs`: number, `withinFrameBudget`: boolean
  - `gpuRenderScaleMode`: `'NATIVE_1080P' | 'SAVER_720P_SCALE'`, `astcAndMsaaEnabled`: boolean
  - `ramUsedMb`: number, `ramMaxMb`: `4096`, `lastMemoryTrimLevel`: string, `ufsAsyncIoQueueDepth`: number
  - `thermalStatusLabel`: `'NOMINAL' | 'LIGHT' | 'MODERATE (60Hz Cap)' | 'CRITICAL THROTTLE'`, `isThermalThrottlingActive`: boolean
- **VibePitch Domain & Bounds (`NicheKey`, `InputBoundsValidator`, `GuestLifecycleState`)**:
  - 7 `NicheKey` presets (`HOME_TRADES`, `SALON_AND_CLEANERS`, `DENTAL_AND_TUTORS`, `AUTO_DETAILING`, `BOUTIQUE_FITNESS`, `ECOMMERCE_SHOPIFY`, `SAAS_AI_REMEDIATION`), `OfferArchetype`, `ScopeGuardrailConfig`, and 6-script output (`Cold Opener`, `Website Gap Audit`, `Live Demo Walk-Through`, `Objection Handler`, `Scope-Safe Proposal`, `Referral Ask`).
  - `InputBoundsValidator` enforcing `MAX_BUSINESS_NAME_LEN = 100`, `MAX_CONTACT_NAME_LEN = 100`, `MAX_WEBSITE_GAP_NOTE_LEN = 300`, `MAX_TAGLINE_LEN = 150`, `MAX_NOTES_LEN = 500`, `depositPercent` in `0..100`, `setupFeeOffer` in `0..50000`, `monthlyRetainerOffer` in `0..5000`.

### Interactive Component & State Mapping
- **Top-Bar Hardware Telemetry Pill (`#btn-open-hardware-hud`)**: Displays live `90Hz`/`60Hz` target and frame duration; clicking opens the Hardware Optimizer HUD Modal.
- **Hardware Optimizer HUD Controls**:
  - Refresh Rate Mode buttons (`AUTO_90HZ_THERMAL_GUARD`, `LOCKED_90HZ`, `THERMAL_SAVER_60HZ`) immediately recalculate `targetFps` (`90` vs `60`) and `frameBudgetMs` (`11.1ms` vs `16.6ms`).
  - Thermal State Simulator buttons (`NOMINAL`, `MODERATE`, `CRITICAL`) trigger automatic 60Hz fallback and 720p render scale when in Auto mode.
  - GPU Render Scale toggle (`NATIVE_1080P` vs `SAVER_720P_SCALE`) adjusts the active Three.js WebGL renderer pixel ratio in real time.
  - **Trim 4GB Heap & Flush Caches** button clears cached scripts, guardrail search buffers, and YouTube cache, recording the trim event in telemetry.
- **Compliance & 100-Guardrail Modal (`#btn-open-compliance-hub`)**:
  - Switches across all 8 compliance documents (`README.md`, `SECURITY.md`, `PRIVACY.md`, `TERMS_AND_CONDITIONS.md`, `ACCOUNT.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ROADMAP.md`) and the searchable 100 Vibe Coding Agent Guardrails browser.
- **AES-256-GCM + AAD Encryption Inspector & VibePitch Studio Panel**:
  - Interactive encrypt/decrypt form with AAD context binding, tamper-test verification button, 64 KB chunked streaming test, and the 7-niche VibePitch quote calculator, 6-script generator, and 30-day guest lifecycle simulator.
