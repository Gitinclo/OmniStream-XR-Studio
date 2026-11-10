# Account Lifecycle & Data Governance (ACCOUNT.md)

## 1. Account Tiers & 4-Tier Staff Role Hierarchy
1. **Guest Explorer (Days 1–30)**: Local-first evaluation with deterministic seed data and local persistence.
2. **Authenticated Creator (Google Sign-In)**: Cloud-synced playlists, comments, YouTube Likes management, authenticated Gemini Studio API access, and Workspace connectors.
3. **4-Tier Staff Hierarchy (`/admins/{uid}` enforced via `hasStaffRole(allowedRoles)` in `/firestore.rules`)**:
   - **`MODERATOR` (`isModerator()`)**: Can restrict video `ageRating`, delete abusive comments, review active (`OPEN`/`IN_REVIEW`) content reports, and resolve non-terminal `MODERATOR`/`CONTACT` tickets. Cannot manage `/admins`, edit video titles, or delete videos/tickets/reports.
   - **`GM` / Game Master (`isGM()`)**: Includes `MODERATOR` permissions plus updating full video metadata and resolving non-terminal `GM` category tickets. Cannot manage `/admins` or delete videos/tickets/reports.
   - **`ADMIN` (`isAdmin()`)**: Includes `GM` permissions plus reading `/admins`, managing subordinate staff (`GM`, `MODERATOR`), deleting videos/tickets/reports, resolving `ADMIN` tickets, and overriding terminal states (`RESOLVED`, `ACTIONED`, `DISMISSED`). Cannot grant, modify, or delete `SUPER_ADMIN` or `ADMIN` roles.
   - **`SUPER_ADMIN` (`isSuperAdmin()`)**: Full administrative authority across all collections and all staff tiers (`SUPER_ADMIN`, `ADMIN`, `GM`, `MODERATOR`).
4. **Primary Master Authority**: `creatergame31@gmail.com` (`email_verified == true`) holds permanent `SUPER_ADMIN`, `ADMIN`, `GM`, and `MODERATOR` privileges.

## 2. Session & Token Security
- Signing out via the top-bar **Sign Out** button immediately detaches all active Firestore real-time listeners (`unsubscribeComments`, `unsubscribeContentReports`), clears the in-memory YouTube OAuth token cache, and resets session state.

## 3. Data Deletion & Right to Erasure
- Users can delete their own comments, moderation tickets, and content reports directly in the UI, or contact `creatergame31@gmail.com` for complete profile purge.
