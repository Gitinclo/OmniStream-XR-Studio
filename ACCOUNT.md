# Account Lifecycle & Data Governance (ACCOUNT.md)

## 1. Account Tiers & Role Hierarchy
1. **Guest Explorer (Days 1–30)**: Local-first evaluation with deterministic seed data and local persistence.
2. **Authenticated Creator (Google Sign-In)**: Cloud-synced playlists, comments, YouTube Likes management, and Workspace connectors.
3. **Staff Roles (`/admin_roles`)**: `MODERATOR`, `ADMIN`, `GM` (Game Master), and `SUPER_ADMIN`.
4. **Primary Master Authority**: `creatergame31@gmail.com` holds permanent `SUPER_ADMIN`, `GM`, `ADMIN`, and `MODERATOR` privileges.

## 2. Session & Token Security
- Signing out via the top-bar **Sign Out** button immediately detaches all active Firestore real-time listeners (`unsubscribeComments`, `unsubscribeContentReports`), clears the in-memory YouTube OAuth token cache, and resets session state.

## 3. Data Deletion & Right to Erasure
- Users can delete their own comments, moderation tickets, and content reports directly in the UI, or contact `creatergame31@gmail.com` for complete profile purge.
