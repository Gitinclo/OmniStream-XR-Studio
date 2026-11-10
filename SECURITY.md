# Security Policy & Cryptographic Specification (SECURITY.md)

## 1. Authenticated Encryption Standard (NIST SP 800-38D)
- **Algorithm**: `AES-256-GCM` (Galois/Counter Mode) via WebCrypto `crypto.subtle`.
- **Key Length**: 256 bits (32 bytes).
- **Initialization Vector (IV)**: 12 bytes (96 bits) generated freshly per encryption operation via `crypto.getRandomValues(new Uint8Array(12))`. IV reuse with the same key is strictly prohibited.
- **Authentication Tag**: 128 bits (16 bytes) verified prior to releasing any decrypted plaintext.
- **Packed Wire Layout**: `[12-byte IV | 16-byte AuthTag | Ciphertext]` encoded in URL-safe Base64 (`-` and `_`, no padding `=`).
- **Associated Authenticated Data (AAD)**: Every ciphertext is cryptographically bound to `user_id:<uid>|record_id:<id>`. Modifying the AAD or transplanting ciphertext to another record triggers an immediate `AEADBadTagException`.

## 2. OAuth 2.0 & Secret Hygiene
- Google Workspace and YouTube Data API v3 OAuth 2.0 access tokens are cached strictly in volatile memory (`cachedAccessToken`) and never written to `localStorage` or `sessionStorage`.
- Server-side Gemini API keys are accessed exclusively on the Express backend via `process.env.GEMINI_API_KEY`.

## 3. Role-Based Access Control & Reporting
- Primary Administration, Game Master (GM), and Moderator authority is bound to `creatergame31@gmail.com`.
- Security disclosures and content reports may be submitted directly via the in-app **Report Content** modal (`/content_reports`) or dispatched to `creatergame31@gmail.com`.
