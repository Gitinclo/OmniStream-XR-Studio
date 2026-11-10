# VibePitch Studio — 4-Phase Audit, Optimization, Testing & Global Compliance Plan

## Phase 1: Codebase Audit, Bug Fixing & Refactoring
1. **Static & Runtime Audit**:
   - Inspect all Kotlin source files (`MainActivity.kt`, `VibePitchViewModel.kt`, `VibePitchRepository.kt`, `LocalGuestSessionManager.kt`, `GoogleAuthHelper.kt`, `VibePitchModels.kt`, and all Compose screens) for unused imports, compiler warnings, null-safety edge cases, input bounds, and coroutine cancellation handling.
2. **Input Sanitization & Bounds Hardening**:
   - Enforce strict character length and numeric bounds in `VibePitchViewModel` and `LocalGuestSessionManager` so that every prospect, lead, playbook task, and business profile created locally in Guest Mode is guaranteed to pass `firestore.rules` schema validation upon Day 20 / Day 30 cloud migration (`businessName <= 100`, `contactName <= 100`, `websiteGapNote <= 300`, `tagline <= 150`, `notes <= 500`, `depositPercent in 0..100`, `setupFeeOffer in 0..50000`, `monthlyRetainerOffer in 0..5000`).
3. **Clean Up Legacy Template Artifacts**:
   - Replace placeholder tests in `ExampleUnitTest.kt` and `ExampleRobolectricTest.kt` with production-grade test suites.

---

## Phase 2: Dependency & Architecture Optimization
1. **Gradle & Version Catalog Audit (`app/build.gradle.kts` & `gradle/libs.versions.toml`)**:
   - Preserve the container-verified SDK and plugin compatibility matrix (`compileSdk 36`, `targetSdk 36`, `minSdk 24`, Kotlin/Compose/Firebase BOM) while commenting out any unused third-party libraries in `app/build.gradle.kts` to minimize APK size and speed up builds.
   - Verify zero deprecated API calls across Kotlin and Jetpack Compose components.

---

## Phase 3: Comprehensive Function Testing & Validation
1. **Unit & Domain Model Test Suite (`VibePitchUnitTest.kt` / `ExampleUnitTest.kt`)**:
   - Test all 7 `NicheKey` presets, `RevenueStreamMode` mappings, `PipelineStage` transitions, `NicheCatalog` packages/add-ons, quote & deposit calculation math, and all 6 pitch/proposal/scope/referral script generators across `OfferArchetype` and `ScopeGuardrailConfig`.
2. **Robolectric Guest Session & ViewModel Test Suite (`ExampleRobolectricTest.kt`)**:
   - Test `LocalGuestSessionManager` CRUD operations (prospect creation, stage advancement, deletion, lead capture, playbook task toggling, pending `BusinessAccountProfile` staging, and Day 1 / Day 20 / Day 31 lifecycle calculation).
   - Test `VibePitchViewModel` in Guest Mode (niche switching, revenue stream switching, quote calculation, lead submission validation, and custom branding persistence).
3. **Firestore Security Rules & Repository Emulator Suite (`firestore.test.js` & `VibePitchRepositoryRuleTest.kt`)**:
   - Expand `firestore.test.js` and `VibePitchRepositoryRuleTest.kt` to verify all 7 vertical `NicheKey` values (`HOME_TRADES`, `SALON_AND_CLEANERS`, `DENTAL_AND_TUTORS`, `AUTO_DETAILING`, `BOUTIQUE_FITNESS`, `ECOMMERCE_SHOPIFY`, `SAAS_AI_REMEDIATION`), unauthenticated denial, cross-user isolation, and guest-to-cloud migration (`migrateGuestDataToCloud`).
   - Run both Tier 1 (`node --test firestore.test.js`) and Tier 2 (`gradle :app:testDebugUnitTest`) suites to 100% green pass rate.

---

## Phase 4: Documentation & Global Compliance Suite (+ In-App Viewer)
1. **Root Repository Markdown Suite (8 Complete, Non-Placeholder Documents)**:
   - `/README.md`: Project overview, multi-stream architecture, 30-day Guest Account to Permanent Business Account flow, Firebase Firestore & Credential Manager setup, and test/build commands.
   - `/SECURITY.md`: Supported versions, zero-trust Firestore rules architecture, payment/PII offloading guardrails (Stripe Links / Google Forms / Managed OAuth), secret management, and vulnerability reporting SLAs.
   - `/PRIVACY.md`: Global privacy policy aligned with 150+ jurisdictions as of October 2026 (GDPR, UK GDPR, CCPA/CPRA, India DPDP Act, Brazil LGPD, China PIPL, Canada PIPEDA, Australia Privacy Act, and ISO/IEC 27701), covering on-device Guest storage vs. cloud Business Account storage, data retention, user rights, and cross-border transfers.
   - `/TERMS_AND_CONDITIONS.md`: Complete terms of service covering acceptable use, white-label demo & pitch usage, payment/PII guardrail responsibilities, intellectual property, liability limitations, and dispute resolution.
   - `/ACCOUNT.md`: Documentation of the 30-Day Guest Account lifecycle (`Days 1–19` active, `Days 20–30` dismissible upgrade prompt, `Day 31+` required upgrade gate), Google Sign-In via Jetpack `CredentialManager`, automatic guest-to-cloud data migration, RBAC/owner-isolation rules, and account/data deletion procedures.
   - `/CONTRIBUTING.md`: Branching strategy, conventional commits, PR checklist, Kotlin/Compose style rules, and emulator testing workflow.
   - `/CODE_OF_CONDUCT.md`: Contributor Covenant v2.1 community standards, enforcement responsibilities, and reporting procedures.
   - `/ROADMAP.md`: Product and technical roadmap structured into Short-Term (Q4 2026), Mid-Term (2027), and Long-Term milestones.
2. **In-App Compliance, Security & Legal Docs Hub (`ComplianceDocsDialog.kt`)**:
   - Add an accessible **Docs & Compliance** button in the top bar / Playbook screen that opens an interactive in-app viewer where users can browse the summaries and key clauses of all 8 documents (`README`, `SECURITY`, `PRIVACY`, `TERMS`, `ACCOUNT`, `CONTRIBUTING`, `CODE OF CONDUCT`, and `ROADMAP`) directly inside the Android app.
