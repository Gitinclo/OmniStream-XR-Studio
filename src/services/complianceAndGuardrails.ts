/**
 * 100 Vibe Coding Agent Guardrails (Categories I–X) & 8-Document Global Compliance Hub
 *
 * Implements:
 * 1. Complete 100-Guardrail Specification across 10 engineering categories (10 guardrails per category)
 * 2. Complete 8-Document Global Compliance & Governance Suite (`README.md`, `SECURITY.md`,
 *    `PRIVACY.md`, `TERMS_AND_CONDITIONS.md`, `ACCOUNT.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ROADMAP.md`)
 */

export type GuardrailCategoryId =
  | 'CAT_1_CODE_PRESERVATION'
  | 'CAT_2_ARCHITECTURE_MODULARITY'
  | 'CAT_3_DEPENDENCY_ENV'
  | 'CAT_4_TYPESCRIPT_CONTRACTS'
  | 'CAT_5_SECURITY_AUTH'
  | 'CAT_6_FRONTEND_UX'
  | 'CAT_7_BACKEND_DB_SAFETY'
  | 'CAT_8_ERROR_LOGGING'
  | 'CAT_9_TERMINAL_GIT'
  | 'CAT_10_SELF_VERIFICATION';

export interface VibeGuardrailItem {
  id: number;
  category: GuardrailCategoryId;
  categoryLabel: string;
  title: string;
  rule: string;
  enforcement: 'ACTIVE_ENFORCED';
}

export interface ComplianceDocEntry {
  filename:
    | 'README.md'
    | 'SECURITY.md'
    | 'PRIVACY.md'
    | 'TERMS_AND_CONDITIONS.md'
    | 'ACCOUNT.md'
    | 'CONTRIBUTING.md'
    | 'CODE_OF_CONDUCT.md'
    | 'ROADMAP.md';
  title: string;
  badge: string;
  frameworksCovered: string[];
  summary: string;
  markdownContent: string;
}

export const GUARDRAIL_CATEGORIES: Array<{
  id: 'ALL' | GuardrailCategoryId;
  label: string;
  range: string;
}> = [
  { id: 'ALL', label: 'All 100 Guardrails', range: '#1–#100' },
  { id: 'CAT_1_CODE_PRESERVATION', label: 'I. Code Preservation & Anti-Destruction', range: '#1–#10' },
  { id: 'CAT_2_ARCHITECTURE_MODULARITY', label: 'II. Architecture & Modularity', range: '#11–#20' },
  { id: 'CAT_3_DEPENDENCY_ENV', label: 'III. Dependency & Environment', range: '#21–#30' },
  { id: 'CAT_4_TYPESCRIPT_CONTRACTS', label: 'IV. TypeScript & Data Contracts', range: '#31–#40' },
  { id: 'CAT_5_SECURITY_AUTH', label: 'V. Security & Authentication', range: '#41–#50' },
  { id: 'CAT_6_FRONTEND_UX', label: 'VI. Frontend UI/UX & Accessibility', range: '#51–#60' },
  { id: 'CAT_7_BACKEND_DB_SAFETY', label: 'VII. Backend, API & Database Safety', range: '#61–#70' },
  { id: 'CAT_8_ERROR_LOGGING', label: 'VIII. Error Handling & Telemetry', range: '#71–#80' },
  { id: 'CAT_9_TERMINAL_GIT', label: 'IX. Terminal & Git Limits', range: '#81–#90' },
  { id: 'CAT_10_SELF_VERIFICATION', label: 'X. Self-Verification & Loop Prevention', range: '#91–#100' },
];

const RAW_GUARDRAILS: Array<{
  cat: GuardrailCategoryId;
  catLabel: string;
  items: Array<[string, string]>;
}> = [
  {
    cat: 'CAT_1_CODE_PRESERVATION',
    catLabel: 'I. Code Preservation & Anti-Destruction',
    items: [
      ['No Silent Feature Deletion', 'Never delete working routes, handlers, or business logic unless explicitly instructed.'],
      ['Surgical Diffs Only', 'Modify only the contiguous lines required for the feature; preserve surrounding working code.'],
      ['Zero Placeholder Truncation', 'Never emit "// ... rest of code" or "TODO: implement later" in production files.'],
      ['Preserve Existing Exports', 'Maintain existing exported function names and type signatures across shared modules.'],
      ['Read Before Write', 'Always inspect unknown pre-existing files before applying surgical replacements.'],
      ['Protect Seed & Demo Data', 'Keep deterministic fallback/seed datasets intact so offline and guest flows never break.'],
      ['Retain Validation Rules', 'Never strip existing form or schema bounds validation when restyling UI components.'],
      ['Keep Keyboard Shortcuts Working', 'Preserve existing hotkeys (Space, H, Escape, J/L) when adding new event listeners.'],
      ['Non-Destructive State Migrations', 'Provide backward-compatible defaults when extending persisted localStorage or Firestore schemas.'],
      ['Immutable Audit Trails', 'Never overwrite or delete primary admin/moderator attribution records during state updates.'],
    ],
  },
  {
    cat: 'CAT_2_ARCHITECTURE_MODULARITY',
    catLabel: 'II. Architecture & Modularity',
    items: [
      ['Single Responsibility Modules', 'Separate pure domain logic (crypto, telemetry, pricing) into dedicated service files.'],
      ['Decouple Pure Logic from DOM', 'Keep math, state machines, and validators free of DOM dependencies for fast unit testing.'],
      ['Unidirectional Data Flow', 'Flow state changes predictably from domain services into UI render passes.'],
      ['Explicit Dependency Injection', 'Pass callbacks and configuration objects explicitly rather than relying on hidden globals.'],
      ['Cohesive View Renderers', 'Group complex modals and workbenches into dedicated, self-contained render methods.'],
      ['Zero Circular Imports', 'Maintain a strict DAG from constants/types -> services -> scene/views -> AppShell.'],
      ['Stateless Formatting Helpers', 'Implement currency, duration, and byte-packing formatters as pure deterministic functions.'],
      ['Bounded File Complexity', 'Extract new subsystems into `/src/services/*` rather than bloating a single monolith.'],
      ['Cleanup Lifecycle Subscriptions', 'Always store and invoke unsubscribe callbacks for Firestore snapshots and timers.'],
      ['Hardware Abstraction Boundary', 'Isolate WebGL/Three.js renderer scaling and frame-budget governors behind a clean service API.'],
    ],
  },
  {
    cat: 'CAT_3_DEPENDENCY_ENV',
    catLabel: 'III. Dependency & Environment',
    items: [
      ['Lockfile & Version Discipline', 'Respect pinned framework versions (xrblocks@0.24.0, three@0.186.0) without arbitrary upgrades.'],
      ['Zero Phantom Imports', 'Never import an npm package that is not declared in package.json or built into the runtime.'],
      ['Prefer Native Web APIs', 'Use native WebCrypto (crypto.subtle), Intl, and Fetch instead of heavy third-party polyfills.'],
      ['Batch Package Installations', 'Install any required dependencies in a single batched command rather than sequential runs.'],
      ['Declare Env Vars in .env.example', 'Document every environment variable in .env.example with safe placeholder values.'],
      ['Port 3000 Binding', 'Ensure development and production servers bind strictly to 0.0.0.0:3000.'],
      ['No Client-Side Secret Exposure', 'Never expose private server keys via VITE_ prefixes or inline client bundles.'],
      ['Graceful Offline/Sandbox Fallbacks', 'Detect missing external APIs or hardware capabilities and degrade gracefully.'],
      ['Deterministic Build Scripts', 'Ensure npm run build and npm run lint execute cleanly without interactive prompts.'],
      ['Zero Native Binary Bloat', 'Avoid native C++ addons that fail in containerized or cross-platform WebXR builds.'],
    ],
  },
  {
    cat: 'CAT_4_TYPESCRIPT_CONTRACTS',
    catLabel: 'IV. TypeScript & Data Contracts',
    items: [
      ['Strict Type Safety', 'Define explicit interfaces and enums for all domain payloads, Firestore records, and UI states.'],
      ['Standard TypeScript Enums', 'Use standard TypeScript enums (RefreshRateMode, NicheKey, PipelineStage) for finite states.'],
      ['Exhaustive Union Handling', 'Handle all union variants (ACTIVE_TRIAL, SOFT_PROMPT_WINDOW, EXPIRED_REQUIRES_AUTH) explicitly.'],
      ['Input Bounds Clamping', 'Enforce numeric min/max clamping (NaN/Infinity guards) at every user input boundary.'],
      ['String Length Normalization', 'Trim and slice all user-supplied strings to match exact Firestore security rule limits.'],
      ['Null & Undefined Guards', 'Use optional chaining and nullish coalescing when reading DOM elements or external API JSON.'],
      ['Typed Event Payloads', 'Validate dataset attributes and form values before casting to domain union types.'],
      ['Immutable Return Snapshots', 'Return fresh readonly-safe state snapshots from telemetry and quota services.'],
      ['Top-Level ES Imports Only', 'Place all import declarations at the top of the module; avoid mid-file CommonJS require().'],
      ['Zero Implicit Any', 'Annotate function parameters and return types on all exported service APIs.'],
    ],
  },
  {
    cat: 'CAT_5_SECURITY_AUTH',
    catLabel: 'V. Security & Authentication',
    items: [
      ['AES-256-GCM Authenticated Encryption', 'Use 256-bit keys, 12-byte CSPRNG IVs, and 128-bit auth tags; never use ECB or unauthenticated CBC.'],
      ['Unique CSPRNG IV Per Encryption', 'Generate a fresh 12-byte IV via crypto.getRandomValues() for every single encrypt operation.'],
      ['Mandatory AAD Context Binding', 'Bind user_id and record_id into Associated Authenticated Data (AAD) to prevent ciphertext splicing.'],
      ['In-Memory OAuth Token Caching', 'Cache Google OAuth access tokens strictly in memory; never persist tokens in localStorage.'],
      ['Explicit Mutating Action Confirmation', 'Require explicit user confirmation before creating Calendar events, Drive files, or ratings.'],
      ['RBAC Master Admin Verification', 'Enforce server/Firestore verification for primary admin (creatergame31@gmail.com) and staff roles.'],
      ['64KB Chunked Stream Encryption', 'Encrypt large payloads in 64KB sequential chunks with counter-bound AAD to prevent OOM.'],
      ['Constant-Time Tag Verification', 'Rely on WebCrypto subtle.decrypt to verify the 128-bit GCM tag before releasing plaintext.'],
      ['Sanitize Dynamic HTML Strings', 'Escape or bound user-supplied text before rendering into template literals.'],
      ['Cross-Origin Isolation Safe Links', 'Include rel="noopener noreferrer" on all external target="_blank" anchor links.'],
    ],
  },
  {
    cat: 'CAT_6_FRONTEND_UX',
    catLabel: 'VI. Frontend UI/UX & Accessibility',
    items: [
      ['Native Accessible Controls', 'Use semantic <button>, <input>, <select>, <label>, <nav>, and <main> elements; never clickable <div>s.'],
      ['Tabular Numerals on Metrics', 'Apply tabular-nums / font-mono-code to all frame times, memory counters, and financial quotes.'],
      ['90Hz Frame Budget Discipline', 'Keep main-thread UI updates under 11.1ms (90Hz) by throttling telemetry DOM renders to 500ms.'],
      ['High-Contrast Readability', 'Maintain WCAG AA/AAA contrast ratios in both Dark Studio (#090d16) and Daylight themes.'],
      ['Zero Overlapping Viewports', 'Hide 3D rig footer controls on 2D workspaces so dashboards have 100% unobstructed viewports.'],
      ['Responsive Touch Targets', 'Ensure buttons and interactive pills have comfortable padding and horizontal scroll on mobile.'],
      ['No Blocking Native Alerts', 'Never call window.alert(), window.confirm(), or window.prompt() inside the iframe runtime.'],
      ['Immediate Visual Feedback', 'Provide instant toast, banner, or state updates on every button click or form submission.'],
      ['Clear Empty & Loading States', 'Render informative empty, loading, and fallback states for every async feed or table.'],
      ['Referrer-Policy on External Images', 'Include lowercase referrerpolicy="no-referrer" on external <img> elements.'],
    ],
  },
  {
    cat: 'CAT_7_BACKEND_DB_SAFETY',
    catLabel: 'VII. Backend, API & Database Safety',
    items: [
      ['Mirror Firestore Security Rules', 'Validate ownerId, string lengths, and numeric bounds on the client before calling Firestore.'],
      ['Structured Firestore Error Envelopes', 'Wrap Firestore errors with operationType, path, and authInfo for deterministic debugging.'],
      ['Sequential UFS 2.1 I/O Queueing', 'Serialize local storage and persistence writes onto a sequential queue to prevent I/O saturation.'],
      ['Idempotent Role Provisioning', 'Use setDoc with merge:true when provisioning admin/staff roles to avoid duplicate records.'],
      ['Graceful Unauthenticated Degradation', 'Skip protected Firestore listeners when currentUser is null and fall back to seed data.'],
      ['Quota-Aware API Caching', 'Cache YouTube Data API v3 responses in memory and track daily quota unit consumption.'],
      ['Bounded Query Payloads', 'Limit collection fetches and paginate large lists to protect 4GB RAM devices.'],
      ['Server-Side Gemini API Proxy', 'Route Gemini and AI studio requests through server-side /api/gemini/* endpoints.'],
      ['Immutable Ownership Fields', 'Prevent client updates from mutating ownerId or creator attribution after document creation.'],
      ['Transactional Integrity', 'Update local optimistic state and persist asynchronously with deterministic rollback/catch handling.'],
    ],
  },
  {
    cat: 'CAT_8_ERROR_LOGGING',
    catLabel: 'VIII. Error Handling & Telemetry',
    items: [
      ['Zero Unhandled Promise Rejections', 'Attach .catch() or try/catch blocks to every async Firebase, WebCrypto, and Fetch call.'],
      ['Actionable User Error Messages', 'Translate raw exceptions into clear, single-sentence recovery guidance in the UI.'],
      ['AEAD Tamper Detection Reporting', 'Surface explicit AEADBadTagException diagnostics when ciphertext or AAD verification fails.'],
      ['Ring-Buffer Telemetry Storage', 'Store high-frequency 90Hz frame timings in pre-allocated Float32Array ring buffers (zero GC).'],
      ['4GB LPDDR4X Memory Trim Hooks', 'Monitor heap/cache pressure and expose one-click and automatic CRITICAL thermal memory trimming.'],
      ['No Sensitive Data in Logs', 'Never log raw passphrases, cryptographic keys, or OAuth bearer tokens to the console.'],
      ['WebGL Software Renderer Detection', 'Detect SwiftShader/software WebGL and automatically disable expensive shadows/transmission.'],
      ['WebSocket Reconnection & Cleanup', 'Close AudioContext and WebSocket streams cleanly when stopping live sessions.'],
      ['Window Blur Input Reset', 'Clear held keyboard movement keys on window blur so 3D rigs never drift endlessly.'],
      ['Quota & Rate-Limit Telemetry', 'Display real-time API quota usage and cache hit status in workspace headers.'],
    ],
  },
  {
    cat: 'CAT_9_TERMINAL_GIT',
    catLabel: 'IX. Terminal & Git Limits',
    items: [
      ['Non-Interactive CLI Execution', 'Pass --yes or non-interactive flags to CLI runners; never block on stdin prompts.'],
      ['Protect .gitignore Hygiene', 'Keep node_modules, dist, and .playwright-cli excluded from version control.'],
      ['No Destructive Filesystem Commands', 'Never run unchecked rm -rf on source or asset directories.'],
      ['Headless Browser Session Cleanup', 'Always close playwright-cli browser sessions on exit so Chromium processes never leak RAM.'],
      ['Workspace-Root Relative Commands', 'Execute shell commands from the workspace root without chaining cd commands.'],
      ['Fast TypeScript Unit Test Runner', 'Execute unit tests via npx --yes tsx --test for sub-second verification of pure logic.'],
      ['No Ad-Hoc Background Daemons', 'Use managed dev server tools rather than spawning unmanaged background node processes.'],
      ['Artifact Path Discipline', 'Write plan and verification artifacts strictly to their designated artifact directories.'],
      ['Clean Root Compliance Docs', 'Maintain standardized root Markdown documentation (README, SECURITY, PRIVACY, etc.).'],
      ['Deterministic Asset Paths', 'Reference uploaded local assets via /assets/aistudio/... or /public/assets/... paths accurately.'],
    ],
  },
  {
    cat: 'CAT_10_SELF_VERIFICATION',
    catLabel: 'X. Self-Verification & Loop Prevention',
    items: [
      ['Unit Test Gate Before Browser Check', 'Run and pass deterministic node:test suites on pure services before visual browser inspection.'],
      ['Compile + Lint Co-Verification', 'Verify both TypeScript compilation (compile_applet) and ESLint (lint_applet) before finishing.'],
      ['Restart Dev Server After Edits', 'Restart the dev server after code modifications because HMR is disabled in the container.'],
      ['Snapshot-First DOM Verification', 'Use accessibility snapshots to verify button refs, labels, and state updates efficiently.'],
      ['Verify End-to-End State Mutation', 'Confirm that clicking controls updates actual application state, counts, and views.'],
      ['Bounded Verification Rounds', 'Cap browser verification to at most 1–2 focused rounds to prevent token exhaustion.'],
      ['Visual Hierarchy & Anti-Slop Audit', 'Verify clean alignment, tabular numbers, and zero overlapping modals at 1440x900.'],
      ['Test Negative & Edge Cases', 'Verify AAD tamper rejection, input bounds clamping, and Day 31 guest expiry gates in tests.'],
      ['Zero Stale Check Completion', 'Always re-verify build and tests after the final code edit before concluding the turn.'],
      ['Honest Verification Reporting', 'Report exact unit test counts, verified user journeys, and compliance status transparently.'],
    ],
  },
];

export const VIBE_CODING_100_GUARDRAILS: VibeGuardrailItem[] = (() => {
  const list: VibeGuardrailItem[] = [];
  let counter = 1;
  for (const group of RAW_GUARDRAILS) {
    for (const [title, rule] of group.items) {
      list.push({
        id: counter++,
        category: group.cat,
        categoryLabel: group.catLabel,
        title,
        rule,
        enforcement: 'ACTIVE_ENFORCED',
      });
    }
  }
  return list;
})();

export function filterGuardrails(
  category: 'ALL' | GuardrailCategoryId,
  searchQuery: string
): VibeGuardrailItem[] {
  const q = (searchQuery || '').trim().toLowerCase();
  return VIBE_CODING_100_GUARDRAILS.filter((item) => {
    const matchesCat = category === 'ALL' || item.category === category;
    if (!matchesCat) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.rule.toLowerCase().includes(q) ||
      item.categoryLabel.toLowerCase().includes(q) ||
      `#${item.id}` === q
    );
  });
}

export const COMPLIANCE_DOCS_CATALOG: ComplianceDocEntry[] = [
  {
    filename: 'README.md',
    title: 'Architecture & Hardware Optimization Blueprint',
    badge: 'SYSTEM ARCHITECTURE',
    frameworksCovered: ['WebXR / XR Blocks v0.24', 'AES-256-GCM + AAD', 'Realme 8 5G (90Hz / 4GB RAM)', 'Firebase Firestore RBAC'],
    summary:
      'Master architectural overview of OmniStream XR Studio: 32K Spatial Cinema, Lumen Video Platform, YouTube Likes API v3, AES-256-GCM Vault, Realme 8 5G 90Hz Governor, and VibePitch Studio.',
    markdownContent: `# OmniStream XR Studio — Architecture & Engineering Blueprint

## 1. Executive Summary
OmniStream XR Studio is a unified WebXR spatial media, bioscience visualization, AI production, and commercial agency platform built on **Vanilla TypeScript**, **Three.js (r186)**, **XR Blocks (v0.24.0)**, and **Firebase Firestore**.

## 2. Core Architectural Pillars
1. **AES-256-GCM Authenticated Encryption Engine (\`/src/services/cryptoAes256.ts\`)**:
   - Native WebCrypto \`AES-256-GCM\` with 256-bit keys, 12-byte CSPRNG IVs, and 128-bit authentication tags.
   - Associated Authenticated Data (\`AAD\`) binding (\`user_id:<uid>|record_id:<id>\`) to prevent cross-record ciphertext splicing.
   - Canonical URL-safe Base64 wire format: \`[12-byte IV | 16-byte AuthTag | Ciphertext]\`.
   - 64 KB sequential chunked streaming encryption with counter-bound AAD.
2. **Realme 8 5G (Dimensity 700 / 90Hz / 4GB RAM) Hardware Governor (\`/src/services/hardwareGovernor.ts\`)**:
   - Real-time 90Hz (\`11.1ms\` budget) and 60Hz (\`16.6ms\` budget) frame pacing monitor using pre-allocated \`Float32Array\` ring buffers.
   - Dynamic Mali-G57 MC2 GPU render scaling (\`NATIVE_1080P\` vs \`SAVER_720P_SCALE\`).
   - 4GB LPDDR4X RAM \`availMem\` floor tracking, one-click \`performMemoryTrim()\`, and UFS 2.1 sequential async I/O queueing.
3. **VibePitch Studio 7-Vertical Quote & Script Engine (\`/src/services/vibePitchEngine.ts\`)**:
   - Deterministic \`InputBoundsValidator\` mirroring Firestore schema limits.
   - 7 commercial vertical presets, 6-channel pitch script generator, and 30-day guest-to-cloud lifecycle evaluation.
4. **Admin, GM & Moderator Governance (\`creatergame31@gmail.com\`)**:
   - Full role-based access control (\`/admin_roles\`, \`/moderation_tickets\`, \`/content_reports\`) supervised by Primary Admin \`creatergame31@gmail.com\`.`,
  },
  {
    filename: 'SECURITY.md',
    title: 'Cryptographic & RBAC Security Specification',
    badge: 'AES-256-GCM · OWASP',
    frameworksCovered: ['NIST SP 800-38D (AES-GCM)', 'OWASP Top 10', 'Firestore RBAC', 'Zero-Trust OAuth'],
    summary:
      'Defines the AES-256-GCM cryptographic envelope, 12-byte CSPRNG nonce discipline, AAD context binding, Firestore security rules, and vulnerability reporting to creatergame31@gmail.com.',
    markdownContent: `# Security Policy & Cryptographic Specification (SECURITY.md)

## 1. Authenticated Encryption Standard (NIST SP 800-38D)
- **Algorithm**: \`AES-256-GCM\` (Galois/Counter Mode) via WebCrypto \`crypto.subtle\`.
- **Key Length**: 256 bits (32 bytes).
- **Initialization Vector (IV)**: 12 bytes (96 bits) generated freshly per encryption operation via \`crypto.getRandomValues(new Uint8Array(12))\`. IV reuse with the same key is strictly prohibited.
- **Authentication Tag**: 128 bits (16 bytes) verified prior to releasing any decrypted plaintext.
- **Packed Wire Layout**: \`[12-byte IV | 16-byte AuthTag | Ciphertext]\` encoded in URL-safe Base64 (\`-\` and \`_\`, no padding \`=\`).
- **Associated Authenticated Data (AAD)**: Every ciphertext is cryptographically bound to \`user_id:<uid>|record_id:<id>\`. Modifying the AAD or transplanting ciphertext to another record triggers an immediate \`AEADBadTagException\`.

## 2. OAuth 2.0 & Secret Hygiene
- Google Workspace and YouTube Data API v3 OAuth 2.0 access tokens are cached strictly in volatile memory (\`cachedAccessToken\`) and never written to \`localStorage\` or \`sessionStorage\`.
- Server-side Gemini API keys are accessed exclusively on the Express backend via \`process.env.GEMINI_API_KEY\`.

## 3. Role-Based Access Control & Reporting
- Primary Administration, Game Master (GM), and Moderator authority is bound to \`creatergame31@gmail.com\`.
- Security disclosures and content reports may be submitted directly via the in-app **Report Content** modal (\`/content_reports\`) or dispatched to \`creatergame31@gmail.com\`.`,
  },
  {
    filename: 'PRIVACY.md',
    title: 'Global Privacy & Data Protection Notice',
    badge: 'GDPR · CCPA/CPRA · DPDP · LGPD',
    frameworksCovered: ['EU/UK GDPR (Art. 13/14/17/20)', 'California CCPA/CPRA', 'India DPDP Act 2023', 'Brazil LGPD'],
    summary:
      'Comprehensive data minimization, lawful basis, client-side AES-256-GCM encryption before cloud persistence, and global data subject rights.',
    markdownContent: `# Global Privacy Policy (PRIVACY.md)

## 1. Scope & Regulatory Alignment
This Privacy Notice governs **OmniStream XR Studio** in accordance with **EU/UK GDPR**, **California CCPA/CPRA**, **India Digital Personal Data Protection Act (DPDP 2023)**, and **Brazil LGPD**.

## 2. Data Minimization & Client-Side Encryption
- **Guest Mode (Days 1–30)**: Local preferences, Lumen video states, and VibePitch prospect drafts remain stored on your local device unless you explicitly authenticate with Google.
- **Authenticated Cloud Sync**: When signed in via Firebase Auth, user-owned records (\`/users/{uid}/playlists\`, \`/videos\`, \`/content_reports\`) are scoped to your \`uid\`. Sensitive vault payloads are encrypted client-side using **AES-256-GCM with AAD binding** before transmission.
- **YouTube & Google Workspace Scopes**: OAuth scopes are used solely for user-initiated actions (viewing liked videos, reading Drive/Calendar summaries, or creating confirmed events/manifests).

## 3. Your Global Privacy Rights
- **Right of Access & Portability (GDPR Art. 15 & 20 / CCPA)**: Export analytics CSVs, stream manifests, and pitch scripts at any time.
- **Right to Erasure ("Right to be Forgotten" — GDPR Art. 17 / DPDP)**: Delete your comments, playlists, tickets, or content reports directly from the UI or request full account purge via \`creatergame31@gmail.com\`.`,
  },
  {
    filename: 'TERMS_AND_CONDITIONS.md',
    title: 'Terms of Service & Scope Guardrails',
    badge: 'COMMERCIAL & PLATFORM TERMS',
    frameworksCovered: ['Platform Acceptable Use', '30-Day Guest Trial Terms', 'VibePitch SOW Guardrails'],
    summary:
      'Governs platform usage, 30-day guest-to-cloud lifecycle rules, intellectual property, and fixed-scope commercial guardrails.',
    markdownContent: `# Terms and Conditions of Service (TERMS_AND_CONDITIONS.md)

## 1. Acceptance of Terms
By accessing **OmniStream XR Studio**, you agree to these Terms and Conditions and our Community Code of Conduct.

## 2. 30-Day Guest-to-Cloud Lifecycle
- **Days 1–19 (Active Local Trial)**: Full access to local workspace tools without mandatory registration.
- **Days 20–30 (Soft Cloud Backup Window)**: Non-blocking reminders to link your Google Account so local records are backed up to Firestore.
- **Day 31+ (Cloud Migration Gate)**: Continued creation of new commercial pipeline records requires Google Authentication to prevent local browser storage loss.

## 3. Commercial Scope Guardrails (VibePitch Studio)
All generated client proposals enforce explicit scope boundaries (\`maxIncludedPages <= 5\`, \`maxRevisionRounds = 2\`, \`50% upfront deposit\`) to protect both creators and clients from unbounded scope creep.

## 4. Content Moderation & Governance
Users may flag policy violations using the **Report Content** workflow (\`/content_reports\`). Primary Admin & Moderator (\`creatergame31@gmail.com\`) reserves the right to review, restrict age ratings, or remove flagged streams and comments.`,
  },
  {
    filename: 'ACCOUNT.md',
    title: 'Account Lifecycle, RBAC & Data Deletion Guide',
    badge: 'AUTH · RBAC · DELETION',
    frameworksCovered: ['Firebase Auth (Google OAuth)', '30-Day Guest Migration', 'Right to Erasure Workflow'],
    summary:
      'Documents guest vs. authenticated states, admin/GM/moderator role hierarchy, in-memory token lifecycle, and instant data deletion.',
    markdownContent: `# Account Lifecycle & Data Governance (ACCOUNT.md)

## 1. Account Tiers & Role Hierarchy
1. **Guest Explorer (Days 1–30)**: Local-first evaluation with deterministic seed data and local persistence.
2. **Authenticated Creator (Google Sign-In)**: Cloud-synced playlists, comments, YouTube Likes management, and Workspace connectors.
3. **Staff Roles (\`/admin_roles\`)**: \`MODERATOR\`, \`ADMIN\`, \`GM\` (Game Master), and \`SUPER_ADMIN\`.
4. **Primary Master Authority**: \`creatergame31@gmail.com\` holds permanent \`SUPER_ADMIN\`, \`GM\`, \`ADMIN\`, and \`MODERATOR\` privileges.

## 2. Session & Token Security
- Signing out via the top-bar **Sign Out** button immediately detaches all active Firestore real-time listeners (\`unsubscribeComments\`, \`unsubscribeContentReports\`), clears the in-memory YouTube OAuth token cache, and resets session state.

## 3. Data Deletion & Right to Erasure
- Users can delete their own comments, moderation tickets, and content reports directly in the UI, or contact \`creatergame31@gmail.com\` for complete profile purge.`,
  },
  {
    filename: 'CONTRIBUTING.md',
    title: 'Engineering Standards & 100 Guardrails Workflow',
    badge: '100 GUARDRAILS · QA',
    frameworksCovered: ['Vanilla TypeScript (.ts)', 'XR Blocks v0.24', 'node:test + tsx', '90Hz Performance Budget'],
    summary:
      'Developer handbook enforcing Vanilla TypeScript modularity, InputBoundsValidator parity, 90Hz frame budgets, and mandatory unit + browser verification.',
    markdownContent: `# Contributing & Engineering Standards (CONTRIBUTING.md)

## 1. Framework & Language Constraints
- **Strictly Vanilla TypeScript (\`.ts\`)**: Do not introduce React, JSX, or \`.tsx\` files.
- **XR Blocks Architecture**: 3D scene scripts extend \`xb.Script\` (\`/src/scene/SpatialStudio.ts\`).
- **Modular Services**: Place pure domain logic in \`/src/services/*.ts\` and UI views in \`/src/ui/*.ts\`.

## 2. Hardware & Cryptographic Guardrails
- **90Hz Frame Pacing**: Never allocate temporary \`THREE.Vector3\` / \`THREE.Matrix4\` objects inside \`update()\`; use module-scope scratch objects and ring buffers.
- **AES-256-GCM Discipline**: All sensitive payloads must use \`encryptAes256GcmWithAad()\` with a unique 12-byte IV and mandatory \`AAD\` context string.
- **Schema Parity**: Every client form mutation must pass through \`InputBoundsValidator\` before calling Firestore.

## 3. Verification Checklist Before Merge
1. Run unit tests: \`npx --yes tsx --test src/services/suite.test.ts\`
2. Run TypeScript build & linter: \`npm run build\` and \`npm run lint\`.`,
  },
  {
    filename: 'CODE_OF_CONDUCT.md',
    title: 'Community Standards & Moderation SLA',
    badge: 'TRUST & SAFETY',
    frameworksCovered: ['Contributor Covenant v2.1', 'Firestore /content_reports Queue', 'GM Fair-Play Rules'],
    summary:
      'Establishes respectful community norms, age-rating classifications (ALL, TEEN, MATURE), and the Firestore /content_reports escalation workflow.',
    markdownContent: `# Community Code of Conduct (CODE_OF_CONDUCT.md)

## 1. Our Pledge
We are committed to providing a harassment-free, inclusive, and high-integrity spatial media and engineering community for all creators, viewers, and developers.

## 2. Content Standards & Age Classifications
- All streams in the **8K/32K Stream Hub** and **Lumen Video Platform** must carry an accurate age classification (\`ALL\`, \`TEEN\`, or \`MATURE\`).
- Spam, misleading metadata, copyright infringement, and abusive comments are strictly prohibited.

## 3. Reporting & Enforcement Workflow (\`/content_reports\`)
- Any user can click **Report Content** on any video, stream, or comment to create a real-time report in Firestore (\`/content_reports\`).
- Reports are routed to Primary Admin / GM / Moderator **\`creatergame31@gmail.com\`** and reviewed in the **Studio Dashboard** and **Admin Console** with full audit notes and one-click content removal.`,
  },
  {
    filename: 'ROADMAP.md',
    title: 'Product & Engineering Roadmap (Phases 1–4)',
    badge: 'MILESTONES COMPLETE',
    frameworksCovered: ['Phase 1: Core XR & YouTube API', 'Phase 2: AES-256-GCM & RBAC', 'Phase 3: 90Hz Realme 8 5G Governor', 'Phase 4: VibePitch & 100 Guardrails'],
    summary:
      'Tracks completed engineering milestones across Spatial WebXR, YouTube Data API v3, AES-256-GCM encryption, Realme 8 5G 90Hz optimization, and VibePitch Studio.',
    markdownContent: `# OmniStream XR Studio — Product & Engineering Roadmap (ROADMAP.md)

## Phase 1: Spatial WebXR Core, Lumen Video & YouTube Data API v3 [COMPLETED]
- 8-part composite 3D Broadcast Rig + 36-node InstancedMesh CDN ring + AlphaFold pLDDT 3D molecular viewer.
- Lumen Video Platform & YouTube Data API v3 Liked Videos manager with OAuth 2.0 and quota telemetry.

## Phase 2: Administration, GM Deck & Firestore Content Reporting [COMPLETED]
- Dedicated Admin / GM / Moderator Console for \`creatergame31@gmail.com\`.
- End-to-end **Report Content** modal writing to \`/content_reports\` with live Admin Dashboard review queue.

## Phase 3: AES-256-GCM + AAD Vault & Realme 8 5G 90Hz Hardware Governor [COMPLETED]
- WebCrypto \`AES-256-GCM\` with 12-byte CSPRNG IV, 128-bit auth tag, \`AAD\` binding (\`user_id|record_id\`), and 64 KB chunked streaming.
- MediaTek Dimensity 700 / Mali-G57 MC2 90Hz (\`11.1ms\`) & 60Hz (\`16.6ms\`) governor, \`720p\` scale toggle, and 4GB LPDDR4X RAM trim.

## Phase 4: VibePitch Studio, 100 Guardrails & 8-Doc Compliance Hub [COMPLETED]
- 7-Niche Quote Calculator, \`InputBoundsValidator\`, 6-Channel Pitch Script Generator, and 30-Day Guest-to-Cloud Lifecycle.
- Full 100 Vibe Coding Agent Guardrails Inspector and 8-Document Global Compliance Hub.`,
  },
];
