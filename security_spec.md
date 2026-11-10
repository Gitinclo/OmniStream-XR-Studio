# Firestore Zero-Trust Security Specification (Phase 0 TDD)

## 1. Data Invariants & Master Sources of Truth
1. **Default Deny**: All unspecified paths (`/{document=**}`) deny all reads and writes.
2. **Verified Identity**: All writes (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Bootstrapped Super-Admin / GM / Moderator Authority (`creatergame31@gmail.com`)**:
   - `isAdmin()` is true ONLY if `isVerifiedUser()` is true AND (`request.auth.token.email == 'creatergame31@gmail.com'` OR `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`).
   - Unverified email tokens spoofing `creatergame31@gmail.com` (`email_verified == false`) are rejected.
4. **Master Gate Relational Sync**:
   - `/videos/{videoId}/comments/{commentId}` requires `exists(/databases/$(database)/documents/videos/$(videoId))` on create and update.
5. **PII & Profile Isolation**:
   - `/users/{userId}` is strictly isolated to `userId == request.auth.uid && existing().ownerId == request.auth.uid`.
6. **Terminal State Locking**:
   - `/moderation_tickets/{ticketId}` locks non-admin updates once `existing().status == 'RESOLVED'`, while retaining an `isAdmin()` override so `creatergame31@gmail.com` can reopen or amend tickets.
   - `/content_reports/{reportId}` allows reporters to create `OPEN` reports with empty `resolutionNotes` and only update `details` while `existing().status == 'OPEN'`, whereas admins (`isAdmin()`) can review, update `status` (`OPEN`, `IN_REVIEW`, `ACTIONED`, `DISMISSED`), `severity`, and `resolutionNotes`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Video**: Adding `"isFeatured": true` to `/videos/vid_1` -> `PERMISSION_DENIED` (`hasOnly` check).
2. **Email Spoofing Attack on Admin**: `email: "creatergame31@gmail.com"` with `email_verified: false` attempting to create `/admins/uid_2` -> `PERMISSION_DENIED` (`isVerifiedUser()` check).
3. **Self-Assigned Admin Privilege**: Regular user `uid_regular` attempting to write `/admins/uid_regular` -> `PERMISSION_DENIED` (`isAdmin()` check).
4. **Orphaned Comment Creation**: Creating `/videos/non_existent_vid/comments/cmt_1` -> `PERMISSION_DENIED` (`exists()` Master Gate check).
5. **Identity Spoofing on Video Create**: User `uid_a` setting `ownerId: "uid_b"` -> `PERMISSION_DENIED`.
6. **Cross-User Profile Read (PII Blanket Test)**: User `uid_a` reading `/users/uid_b` -> `PERMISSION_DENIED`.
7. **Unbounded String / Resource Poisoning**: Creating a comment with a 2,000-char `text` field -> `PERMISSION_DENIED` (`text.size() <= 500`).
8. **ID Poisoning Attack**: Document ID containing spaces or `$` (`/videos/bad$id`) -> `PERMISSION_DENIED` (`isValidId()` regex guard).
9. **Immutable Field Tampering**: Updating `ownerId` or `createdAt` on `/videos/vid_1` -> `PERMISSION_DENIED`.
10. **View Counter Manipulation**: Incrementing `views` by +1000 in a single update -> `PERMISSION_DENIED` (`incoming().views == existing().views + 1`).
11. **Terminal State Bypass on Moderation Ticket / Content Report**: Regular user updating `status` or `resolutionNotes` on `/content_reports/rep_1` -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Supplying a past/future `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
