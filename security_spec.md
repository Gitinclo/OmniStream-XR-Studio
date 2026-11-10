# Firestore Zero-Trust Security Specification (Phase 0 TDD)

## 1. Data Invariants & Master Sources of Truth
1. **Default Deny**: All unspecified paths (`/{document=**}`) deny all reads and writes.
2. **Verified Identity**: All writes (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **4-Tier Role-Based Access Control (RBAC) Hierarchy (`SUPER_ADMIN` > `ADMIN` > `GM` > `MODERATOR`)**:
   - Every `/admins/{uid}` role check (`hasStaffRole(allowedRoles)`) verifies **both** document existence (`exists(...)`), identity binding (`get(...).data.targetUid == request.auth.uid`), **and** explicit `role` membership (`get(...).data.role in allowedRoles`). Merely having a document in `/admins/{uid}` never grants blanket admin status.
   - **Tier 1 — `isSuperAdmin()`** (`creatergame31@gmail.com` with `email_verified == true`, or `/admins/{uid}` with `role == 'SUPER_ADMIN'`):
     - Full authority over `/admins/{adminId}` (can create, update, and delete any staff tier: `SUPER_ADMIN`, `ADMIN`, `GM`, `MODERATOR`) plus all `ADMIN`, `GM`, and `MODERATOR` permissions.
   - **Tier 2 — `isAdmin()`** (`isSuperAdmin()` or `/admins/{uid}` with `role == 'ADMIN'`):
     - Can create, update, and delete **subordinate** staff roles (`GM`, `MODERATOR`) in `/admins/{adminId}`, but **cannot** create, modify, or delete `SUPER_ADMIN` or `ADMIN` documents (preventing horizontal or vertical privilege escalation).
     - Can delete `/videos/{videoId}`, `/moderation_tickets/{ticketId}`, and `/content_reports/{reportId}`, edit comments, resolve `'ADMIN'` category tickets, and override terminal states (`RESOLVED`, `ACTIONED`, `DISMISSED`).
   - **Tier 3 — `isGM()`** (`isAdmin()` or `/admins/{uid}` with `role == 'GM'`):
     - **Cannot** create, update, or delete `/admins/{adminId}` documents or read other staff members' `/admins` docs.
     - **Cannot** delete `/videos`, `/moderation_tickets`, or `/content_reports`.
     - **Can** update full video metadata (`title`, `description`, `category`, `resolution`, `ageRating`), delete abusive comments, review non-terminal `/content_reports` (`OPEN`, `IN_REVIEW`), and resolve non-terminal `/moderation_tickets` in `GM`, `MODERATOR`, or `CONTACT` categories (cannot resolve `ADMIN` category tickets).
   - **Tier 4 — `isModerator()`** (`isGM()` or `/admins/{uid}` with `role == 'MODERATOR'`):
     - **Cannot** create, update, or delete `/admins/{adminId}` documents.
     - **Cannot** delete `/videos`, `/moderation_tickets`, or `/content_reports`, and **cannot** edit video `title`/`description`/`category`/`resolution` or comment `text`.
     - **Can** restrict video `ageRating` (`['ageRating', 'updatedAt']`), delete abusive comments, review non-terminal `/content_reports` (`OPEN`, `IN_REVIEW`), and resolve non-terminal `/moderation_tickets` in `MODERATOR` or `CONTACT` categories (cannot resolve `ADMIN` or `GM` category tickets).
4. **Master Gate Relational Sync**:
   - `/videos/{videoId}/comments/{commentId}` requires `exists(/databases/$(database)/documents/videos/$(videoId))` on create and update.
5. **PII, Profile & Entitlement Isolation (`/users/{userId}` & `/subscriptions/{subscriptionId}`)**:
   - `/users/{userId}` and `/subscriptions/{subscriptionId}` are strictly isolated to `docId == request.auth.uid && existing().ownerId == request.auth.uid` (with read/entitlement oversight restricted to `isAdmin()`).
   - **`isPremium` & Paid Subscription Entitlement Enforcement**: Regular users cannot grant themselves premium status or paid subscription tiers (`PRO_8K_CREATOR`, `STUDIO_32K_ENTERPRISE`) directly in Firestore:
     - On `/users/{userId}` `create`: `incoming().isPremium == false || isAdmin()` — non-admin users must initialize `isPremium: false`.
     - On `/users/{userId}` `update`: Profile owners (`userId == request.auth.uid`) can only modify `['displayName', 'parentalControlMode', 'updatedAt']` or `['lastWatchedVideoId', 'lastWatchedProgressSec', 'updatedAt']` with `incoming().isPremium == existing().isPremium`. Only `isAdmin()` (`SUPER_ADMIN` or `ADMIN`) or trusted server-side entitlement authority can update `['isPremium', 'updatedAt']`.
     - On `/subscriptions/{subscriptionId}` `create`: Regular users can only initialize `FREE_STANDARD` (`incoming().planId == 'FREE_STANDARD' && incoming().isPremium == false && incoming().dailyQuotaUnits == 250 && incoming().priceUsdPerPeriod == 0`) unless `isAdmin()`.
     - On `/subscriptions/{subscriptionId}` `update`: Subscribers can update their cancellation preference or payment method (`['status', 'cancelAtPeriodEnd', 'paymentMethodLast4', 'updatedAt']`) while keeping `planId`, `isPremium`, `dailyQuotaUnits`, `maxStreamResolution`, and `priceUsdPerPeriod` immutable. Provisioning paid tiers (`PRO_8K_CREATOR`, `STUDIO_32K_ENTERPRISE`) in Firestore is restricted to `isAdmin()` or the server-side subscription authority (`/api/subscriptions/*`).
6. **Terminal State Locking**:
   - `/moderation_tickets/{ticketId}` locks non-admin updates once `existing().status == 'RESOLVED'`, while retaining an `isAdmin()` (`SUPER_ADMIN` / `ADMIN`) override to reopen or amend tickets.
   - `/content_reports/{reportId}` locks non-admin updates once `existing().status` reaches `'ACTIONED'` or `'DISMISSED'`, while retaining an `isAdmin()` (`SUPER_ADMIN` / `ADMIN`) override.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Video**: Adding `"isFeatured": true` to `/videos/vid_1` -> `PERMISSION_DENIED` (`hasOnly` check).
2. **Email Spoofing Attack on Admin**: `email: "creatergame31@gmail.com"` with `email_verified: false` attempting to create `/admins/uid_2` -> `PERMISSION_DENIED` (`isVerifiedUser()` check).
3. **Self-Assigned Admin Privilege, Vertical Role Escalation & Self-Granted `isPremium` / Paid Subscription Entitlement**: Regular user `uid_regular` or `MODERATOR` / `GM` / `ADMIN` attempting to grant `SUPER_ADMIN` in `/admins/{uid}`, or a non-admin user attempting to set `isPremium: true` on `/users/{userId}` or `planId: 'STUDIO_32K_ENTERPRISE'` on `/subscriptions/{subscriptionId}` -> `PERMISSION_DENIED` (`isSuperAdmin()` / `isAdmin()` / `hasStaffRole` check).
4. **Orphaned Comment Creation**: Creating `/videos/non_existent_vid/comments/cmt_1` -> `PERMISSION_DENIED` (`exists()` Master Gate check).
5. **Identity Spoofing on Video Create**: User `uid_a` setting `ownerId: "uid_b"` -> `PERMISSION_DENIED`.
6. **Cross-User Profile & Subscription Read (PII Blanket Test)**: User `uid_a` reading `/users/uid_b` or `/subscriptions/uid_b` -> `PERMISSION_DENIED`.
7. **Unbounded String / Resource Poisoning**: Creating a comment with a 2,000-char `text` field -> `PERMISSION_DENIED` (`text.size() <= 500`).
8. **ID Poisoning Attack**: Document ID containing spaces or `$` (`/videos/bad$id`) -> `PERMISSION_DENIED` (`isValidId()` regex guard).
9. **Immutable Field Tampering**: Updating `ownerId` or `createdAt` on `/videos/vid_1` -> `PERMISSION_DENIED`.
10. **View Counter Manipulation**: Incrementing `views` by +1000 in a single update -> `PERMISSION_DENIED` (`incoming().views == existing().views + 1`).
11. **Terminal State Bypass & Role Scope Violation on Moderation Ticket / Content Report**: Regular user or lower-tier staff (`MODERATOR`/`GM`) mutating terminal `RESOLVED`/`ACTIONED` records or out-of-tier ticket categories -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Supplying a past/future `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
