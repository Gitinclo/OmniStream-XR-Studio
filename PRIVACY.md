# Global Privacy Policy (PRIVACY.md)

## 1. Scope & Regulatory Alignment
This Privacy Notice governs **OmniStream XR Studio** in accordance with **EU/UK GDPR**, **California CCPA/CPRA**, **India Digital Personal Data Protection Act (DPDP 2023)**, and **Brazil LGPD**.

## 2. Data Minimization & Client-Side Encryption
- **Guest Mode (Days 1–30)**: Local preferences, Lumen video states, and VibePitch prospect drafts remain stored on your local device unless you explicitly authenticate with Google.
- **Authenticated Cloud Sync**: When signed in via Firebase Auth, user-owned records (`/users/{uid}/playlists`, `/videos`, `/content_reports`) are scoped to your `uid`. Sensitive vault payloads are encrypted client-side using **AES-256-GCM with AAD binding** before transmission.
- **YouTube & Google Workspace Scopes**: OAuth scopes are used solely for user-initiated actions (viewing liked videos, reading Drive/Calendar summaries, or creating confirmed events/manifests).

## 3. Your Global Privacy Rights
- **Right of Access & Portability (GDPR Art. 15 & 20 / CCPA)**: Export analytics CSVs, stream manifests, and pitch scripts at any time.
- **Right to Erasure ("Right to be Forgotten" — GDPR Art. 17 / DPDP)**: Delete your comments, playlists, tickets, or content reports directly from the UI or request full account purge via `creatergame31@gmail.com`.
