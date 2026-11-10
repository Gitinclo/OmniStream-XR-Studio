/**
 * Firestore Security Rules Behavioral Test Suite
 * (Dirty Dozen + Full CRUD + 4-Tier Role Hierarchy Verification)
 *
 * Executes real document operations (`getDoc`, `getDocs`, `setDoc`, `updateDoc`, `deleteDoc`)
 * against the ANTLR4-compiled `firestore.rules` AST and verifies outcomes with
 * `@firebase/rules-unit-testing`'s `assertSucceeds` and `assertFails`.
 *
 * Verifies:
 * 1. All 12 "Dirty Dozen" adversarial payloads defined in `security_spec.md` return `PERMISSION_DENIED`.
 * 2. Positive ("Allowed") and negative ("Denied") behavioral invariants across all 7 collections:
 *    - `/videos/{videoId}`
 *    - `/videos/{videoId}/comments/{commentId}`
 *    - `/playlists/{playlistId}`
 *    - `/users/{userId}`
 *    - `/admins/{adminId}`
 *    - `/moderation_tickets/{ticketId}`
 *    - `/content_reports/{reportId}`
 *    - Global default-deny catch-all `/{document=**}`
 * 3. Strict 4-Tier Role Hierarchy (`SUPER_ADMIN` > `ADMIN` > `GM` > `MODERATOR`):
 *    - `hasStaffRole(allowedRoles)` inspects `get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role`
 *      and `data.targetUid == request.auth.uid` rather than granting blanket admin access on `exists()`.
 *    - Tests role-specific permissions and vertical/horizontal privilege-escalation blocks for each tier.
 * 4. Rule mutation sensitivity proof (proving tests evaluate actual rule behavior from `firestore.rules`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  initializeRulesTestEnvironment,
  assertSucceeds,
  assertFails,
  doc,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  customTimestamp,
} from './src/services/firestoreRulesHarness';

const PRIMARY_ADMIN_EMAIL = 'creatergame31@gmail.com';

function createValidVideoPayload(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: '32K Spatial Cinema Masterclass',
    description: 'High-bitrate volumetric streaming guide.',
    category: 'Tech',
    resolution: '32K',
    videoUrl: 'https://cdn.omnistream.xr/streams/master_32k.mp4',
    ownerId,
    authorName: 'Alice Creator',
    ageRating: 'ALL',
    views: 10,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function createValidCommentPayload(
  videoId: string,
  ownerId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    videoId,
    ownerId,
    authorName: 'Alice Creator',
    text: 'Crystal clear spatial projection at 90Hz!',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function createValidPlaylistPayload(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: 'My 32K Spatial Favorites',
    ownerId,
    videoIds: 'vid_1,vid_2',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function createValidUserProfilePayload(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerId,
    displayName: 'Alice Spatial',
    isPremium: true,
    parentalControlMode: false,
    lastWatchedVideoId: 'vid_1',
    lastWatchedProgressSec: 120,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function createValidAdminRolePayload(
  targetUid: string,
  assignedByUid: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    targetUid,
    email: 'moderator@omnistream.xr',
    role: 'MODERATOR',
    permissions: 'REVIEW_REPORTS,MODERATE_COMMENTS',
    assignedByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function createValidModerationTicketPayload(
  ownerId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    ownerId,
    senderName: 'Alice Creator',
    recipientEmail: PRIMARY_ADMIN_EMAIL,
    category: 'ADMIN',
    subject: 'Requesting 32K stream verification badge',
    message: 'Hello Admin, please review our studio channel verification request.',
    status: 'OPEN',
    adminReply: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function createValidContentReportPayload(
  reporterId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    targetId: 'vid_1',
    targetType: 'LUMEN_VIDEO',
    targetTitle: '32K Spatial Cinema Masterclass',
    reporterId,
    reporterName: 'Alice Creator',
    assignedAdminEmail: PRIMARY_ADMIN_EMAIL,
    reason: 'SPAM_OR_MISLEADING',
    severity: 'HIGH',
    details: 'Video metadata contains misleading bitrate claims.',
    status: 'OPEN',
    resolutionNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

test('Dirty Dozen #1–#12: All 12 adversarial payloads in security_spec.md return PERMISSION_DENIED', async () => {
  const testEnv = await initializeRulesTestEnvironment();

  try {
    // Seed baseline valid documents with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const db = adminCtx.firestore();
      await setDoc(doc(db, 'videos/vid_1'), createValidVideoPayload('uid_alice'));
      await setDoc(doc(db, 'users/uid_bob'), createValidUserProfilePayload('uid_bob'));
      await setDoc(
        doc(db, 'moderation_tickets/tkt_resolved'),
        createValidModerationTicketPayload('uid_alice', {
          status: 'RESOLVED',
          adminReply: 'Closed by Admin.',
        })
      );
      await setDoc(
        doc(db, 'content_reports/rep_open'),
        createValidContentReportPayload('uid_alice')
      );
      await setDoc(
        doc(db, 'content_reports/rep_actioned'),
        createValidContentReportPayload('uid_alice', {
          status: 'ACTIONED',
          resolutionNotes: 'Removed offending stream.',
        })
      );
    });

    const aliceDb = testEnv
      .authenticatedContext('uid_alice', {
        email: 'alice@example.com',
        email_verified: true,
      })
      .firestore();

    const spoofedAdminDb = testEnv
      .authenticatedContext('uid_spoofer', {
        email: PRIMARY_ADMIN_EMAIL,
        email_verified: false, // Spoofed unverified email!
      })
      .firestore();

    // 1. Dirty Dozen #1: Shadow Field Injection on Video (`isFeatured: true` not in `hasOnly`)
    await assertFails(
      setDoc(
        doc(aliceDb, 'videos/vid_shadow'),
        createValidVideoPayload('uid_alice', { isFeatured: true })
      )
    );

    // 2. Dirty Dozen #2: Email Spoofing Attack on Admin (`email: creatergame31@gmail.com` with `email_verified: false`)
    await assertFails(
      setDoc(
        doc(spoofedAdminDb, 'admins/uid_spoofer'),
        createValidAdminRolePayload('uid_spoofer', 'uid_spoofer', { role: 'SUPER_ADMIN' })
      )
    );
    await assertFails(deleteDoc(doc(spoofedAdminDb, 'videos/vid_1')));

    // 3. Dirty Dozen #3: Self-Assigned Admin Privilege by regular verified user
    await assertFails(
      setDoc(
        doc(aliceDb, 'admins/uid_alice'),
        createValidAdminRolePayload('uid_alice', 'uid_alice', { role: 'SUPER_ADMIN' })
      )
    );

    // 4. Dirty Dozen #4: Orphaned Comment Creation (parent `/videos/non_existent_vid` does not exist)
    await assertFails(
      setDoc(
        doc(aliceDb, 'videos/non_existent_vid/comments/cmt_orphan'),
        createValidCommentPayload('non_existent_vid', 'uid_alice')
      )
    );

    // 5. Dirty Dozen #5: Identity Spoofing on Video Create (`uid_alice` sets `ownerId: 'uid_bob'`)
    await assertFails(
      setDoc(doc(aliceDb, 'videos/vid_spoof'), createValidVideoPayload('uid_bob'))
    );

    // 6. Dirty Dozen #6: Cross-User Profile Read (PII Blanket Test — `uid_alice` reading `/users/uid_bob`)
    await assertFails(getDoc(doc(aliceDb, 'users/uid_bob')));
    await assertFails(
      getDocs(query(collection(aliceDb, 'users'), where('ownerId', '==', 'uid_bob')))
    );

    // 7. Dirty Dozen #7: Unbounded String / Resource Poisoning (2,000-char comment text > 500 max)
    await assertFails(
      setDoc(
        doc(aliceDb, 'videos/vid_1/comments/cmt_oversized'),
        createValidCommentPayload('vid_1', 'uid_alice', {
          text: 'X'.repeat(2000),
        })
      )
    );

    // 8. Dirty Dozen #8: ID Poisoning Attack (`$` or spaces in document ID fails `isValidId` regex)
    await assertFails(
      setDoc(doc(aliceDb, 'videos/bad$id_123'), createValidVideoPayload('uid_alice'))
    );
    await assertFails(getDoc(doc(aliceDb, 'videos/bad$id_123')));

    // 9. Dirty Dozen #9: Immutable Field Tampering (`ownerId` or `createdAt` modified on update)
    testEnv.advanceClockMs(5000);
    await assertFails(
      updateDoc(doc(aliceDb, 'videos/vid_1'), {
        ownerId: 'uid_bob',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'videos/vid_1'), {
        title: 'Updated Title',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 10. Dirty Dozen #10: View Counter Manipulation (incrementing `views` by +1000 instead of +1)
    await assertFails(
      updateDoc(doc(aliceDb, 'videos/vid_1'), {
        views: 1010,
        updatedAt: serverTimestamp(),
      })
    );

    // 11. Dirty Dozen #11: Terminal State Bypass & Status Escalation on Moderation Ticket / Content Report
    // 11a. Regular reporter cannot self-action or write resolutionNotes on `/content_reports/rep_open`
    await assertFails(
      updateDoc(doc(aliceDb, 'content_reports/rep_open'), {
        status: 'ACTIONED',
        resolutionNotes: 'Forged admin resolution',
        updatedAt: serverTimestamp(),
      })
    );
    // 11b. Regular reporter cannot edit `details` once report is no longer `OPEN` (`rep_actioned`)
    await assertFails(
      updateDoc(doc(aliceDb, 'content_reports/rep_actioned'), {
        details: 'Trying to mutate closed report details',
        updatedAt: serverTimestamp(),
      })
    );
    // 11c. Regular sender cannot edit `message` on a `RESOLVED` moderation ticket (`tkt_resolved`)
    await assertFails(
      updateDoc(doc(aliceDb, 'moderation_tickets/tkt_resolved'), {
        message: 'Trying to mutate resolved ticket',
        updatedAt: serverTimestamp(),
      })
    );

    // 12. Dirty Dozen #12: Client Timestamp Forgery (supplying a forged past/future timestamp instead of `request.time`)
    await assertFails(
      setDoc(
        doc(aliceDb, 'videos/vid_forged_ts'),
        createValidVideoPayload('uid_alice', {
          createdAt: customTimestamp(1_600_000_000_000),
          updatedAt: serverTimestamp(),
        })
      )
    );
  } finally {
    await testEnv.cleanup();
  }
});

test('Behavioral CRUD & RBAC: Allowed and denied operations across all 7 collections and Primary Admin (creatergame31@gmail.com)', async () => {
  const testEnv = await initializeRulesTestEnvironment();

  try {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv
      .authenticatedContext('uid_alice', {
        email: 'alice@example.com',
        email_verified: true,
      })
      .firestore();
    const bobDb = testEnv
      .authenticatedContext('uid_bob', {
        email: 'bob@example.com',
        email_verified: true,
      })
      .firestore();
    const primaryAdminDb = testEnv
      .authenticatedContext('uid_master_admin', {
        email: PRIMARY_ADMIN_EMAIL,
        email_verified: true,
      })
      .firestore();
    const delegatedModDb = testEnv
      .authenticatedContext('uid_mod_staff', {
        email: 'mod@omnistream.xr',
        email_verified: true,
      })
      .firestore();

    // 0. Global Default-Deny Catch-All (`/{document=**}`) denies unknown collections even to Primary Admin
    await assertFails(getDoc(doc(primaryAdminDb, 'unmapped_collection/doc_1')));
    await assertFails(
      setDoc(doc(primaryAdminDb, 'unmapped_collection/doc_1'), { anyField: 'val' })
    );

    // 1. Videos (`/videos/{videoId}`)
    // Unauthenticated cannot create or read videos
    await assertFails(
      setDoc(doc(unauthDb, 'videos/vid_100'), createValidVideoPayload('uid_alice'))
    );
    // Alice creates a valid video
    await assertSucceeds(
      setDoc(doc(aliceDb, 'videos/vid_100'), createValidVideoPayload('uid_alice'))
    );
    await assertFails(getDoc(doc(unauthDb, 'videos/vid_100')));
    // Signed-in users can get and list valid videos
    await assertSucceeds(getDoc(doc(bobDb, 'videos/vid_100')));
    await assertSucceeds(
      getDocs(query(collection(bobDb, 'videos'), where('ageRating', '==', 'ALL')))
    );
    // Bob (non-owner) can increment `views` by +1, but cannot edit Alice's video title or delete it
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(bobDb, 'videos/vid_100'), {
        views: 11,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(bobDb, 'videos/vid_100'), {
        title: 'Hacked by Bob',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(bobDb, 'videos/vid_100')));

    // Alice (owner) can update her video metadata
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'videos/vid_100'), {
        title: '32K Spatial Cinema Masterclass (Director Cut)',
        updatedAt: serverTimestamp(),
      })
    );

    // Primary Admin (`creatergame31@gmail.com`) can moderate `ageRating` on Alice's video
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(primaryAdminDb, 'videos/vid_100'), {
        ageRating: 'TEEN',
        updatedAt: serverTimestamp(),
      })
    );

    // 2. Comments Subcollection (`/videos/{videoId}/comments/{commentId}`)
    await assertSucceeds(
      setDoc(
        doc(bobDb, 'videos/vid_100/comments/cmt_1'),
        createValidCommentPayload('vid_100', 'uid_bob')
      )
    );
    await assertSucceeds(getDoc(doc(aliceDb, 'videos/vid_100/comments/cmt_1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(aliceDb, 'videos/vid_100/comments'),
          where('videoId', '==', 'vid_100')
        )
      )
    );
    // Bob can update `text` on his own comment; Alice cannot edit Bob's comment
    await assertSucceeds(
      updateDoc(doc(bobDb, 'videos/vid_100/comments/cmt_1'), {
        text: 'Edited by Bob: 90Hz frame pacing is locked!',
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'videos/vid_100/comments/cmt_1'), {
        text: 'Alice trying to edit Bob comment',
      })
    );

    // 3. Playlists (`/playlists/{playlistId}`) & User Profiles (`/users/{userId}`)
    await assertSucceeds(
      setDoc(doc(aliceDb, 'playlists/pl_alice'), createValidPlaylistPayload('uid_alice'))
    );
    await assertSucceeds(getDoc(doc(aliceDb, 'playlists/pl_alice')));
    await assertSucceeds(
      getDocs(query(collection(aliceDb, 'playlists'), where('ownerId', '==', 'uid_alice')))
    );
    await assertFails(getDoc(doc(bobDb, 'playlists/pl_alice')));
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'playlists/pl_alice'), {
        name: 'Updated 32K Playlist',
        videoIds: 'vid_100',
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/uid_alice'), createValidUserProfilePayload('uid_alice'))
    );
    await assertSucceeds(getDoc(doc(aliceDb, 'users/uid_alice')));
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'users/uid_alice'), {
        lastWatchedVideoId: 'vid_100',
        lastWatchedProgressSec: 340,
        updatedAt: serverTimestamp(),
      })
    );

    // 4. Admin Role Registry (`/admins/{adminId}`) & Delegated Moderator Authority
    // Before being added to `/admins/uid_mod_staff`, `delegatedModDb` cannot moderate comments
    await assertFails(deleteDoc(doc(delegatedModDb, 'videos/vid_100/comments/cmt_1')));

    // Primary Admin (`creatergame31@gmail.com`) provisions `uid_mod_staff` with `role: 'MODERATOR'`
    await assertSucceeds(
      setDoc(
        doc(primaryAdminDb, 'admins/uid_mod_staff'),
        createValidAdminRolePayload('uid_mod_staff', 'uid_master_admin', { role: 'MODERATOR' })
      )
    );
    await assertSucceeds(getDoc(doc(delegatedModDb, 'admins/uid_mod_staff')));

    // Now `delegatedModDb` is recognized by `isModerator()` via `hasStaffRole` and can delete comments!
    await assertSucceeds(deleteDoc(doc(delegatedModDb, 'videos/vid_100/comments/cmt_1')));

    // 5. Moderation Tickets (`/moderation_tickets/{ticketId}`)
    await assertSucceeds(
      setDoc(
        doc(aliceDb, 'moderation_tickets/tkt_100'),
        createValidModerationTicketPayload('uid_alice')
      )
    );
    // Sender can update `message` while ticket is not `RESOLVED`
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'moderation_tickets/tkt_100'), {
        message: 'Updated ticket details with stream ID vid_100.',
        updatedAt: serverTimestamp(),
      })
    );
    // Primary Admin can list tickets addressed to `creatergame31@gmail.com` and resolve them
    await assertSucceeds(
      getDocs(
        query(
          collection(primaryAdminDb, 'moderation_tickets'),
          where('recipientEmail', '==', PRIMARY_ADMIN_EMAIL)
        )
      )
    );
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(primaryAdminDb, 'moderation_tickets/tkt_100'), {
        status: 'RESOLVED',
        adminReply: 'Verified your 32K studio channel.',
        updatedAt: serverTimestamp(),
      })
    );
    // Once `RESOLVED`, Alice can no longer edit `message`, but Primary Admin CAN reopen/override
    testEnv.advanceClockMs(1000);
    await assertFails(
      updateDoc(doc(aliceDb, 'moderation_tickets/tkt_100'), {
        message: 'Alice trying to edit after RESOLVED',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(primaryAdminDb, 'moderation_tickets/tkt_100'), {
        status: 'IN_REVIEW',
        adminReply: 'Reopened by Admin for follow-up.',
        updatedAt: serverTimestamp(),
      })
    );

    // 6. Content Reports (`/content_reports/{reportId}`)
    await assertSucceeds(
      setDoc(
        doc(aliceDb, 'content_reports/rep_100'),
        createValidContentReportPayload('uid_alice')
      )
    );
    // Reporter can update `details` while `status == 'OPEN'`
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'content_reports/rep_100'), {
        details: 'Updated timestamp of the issue at 04:15.',
        updatedAt: serverTimestamp(),
      })
    );
    // Bob (unrelated user) cannot read or update Alice's report
    await assertFails(getDoc(doc(bobDb, 'content_reports/rep_100')));
    // Primary Admin can list reports assigned to `creatergame31@gmail.com` and action them
    const adminReportsSnap = await assertSucceeds(
      getDocs(
        query(
          collection(primaryAdminDb, 'content_reports'),
          where('assignedAdminEmail', '==', PRIMARY_ADMIN_EMAIL)
        )
      )
    );
    assert.equal(adminReportsSnap.docs.length, 1);

    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(primaryAdminDb, 'content_reports/rep_100'), {
        status: 'ACTIONED',
        severity: 'CRITICAL',
        resolutionNotes: 'Reviewed in Admin Dashboard and restricted stream.',
        updatedAt: serverTimestamp(),
      })
    );
  } finally {
    await testEnv.cleanup();
  }
});

test('Role Hierarchy & Least-Privilege Matrix: SUPER_ADMIN vs ADMIN vs GM vs MODERATOR vs Invalid /admins doc', async () => {
  const testEnv = await initializeRulesTestEnvironment();

  try {
    // Seed baseline content and staff documents across all 4 tiers + 1 invalid/corrupted `/admins` doc
    await testEnv.withSecurityRulesDisabled(async (seedCtx) => {
      const db = seedCtx.firestore();

      // Baseline videos & comments owned by regular creator `uid_creator`
      await setDoc(doc(db, 'videos/vid_main'), createValidVideoPayload('uid_creator'));
      await setDoc(doc(db, 'videos/vid_to_delete_by_admin'), createValidVideoPayload('uid_creator'));
      await setDoc(
        doc(db, 'videos/vid_main/comments/cmt_1'),
        createValidCommentPayload('vid_main', 'uid_creator')
      );
      await setDoc(
        doc(db, 'videos/vid_main/comments/cmt_2'),
        createValidCommentPayload('vid_main', 'uid_creator')
      );

      // Baseline moderation tickets for each category: ADMIN, GM, MODERATOR, and a RESOLVED ticket
      await setDoc(
        doc(db, 'moderation_tickets/tkt_admin_cat'),
        createValidModerationTicketPayload('uid_creator', { category: 'ADMIN', status: 'OPEN' })
      );
      await setDoc(
        doc(db, 'moderation_tickets/tkt_gm_cat'),
        createValidModerationTicketPayload('uid_creator', { category: 'GM', status: 'OPEN' })
      );
      await setDoc(
        doc(db, 'moderation_tickets/tkt_mod_cat'),
        createValidModerationTicketPayload('uid_creator', { category: 'MODERATOR', status: 'OPEN' })
      );
      await setDoc(
        doc(db, 'moderation_tickets/tkt_closed'),
        createValidModerationTicketPayload('uid_creator', {
          category: 'CONTACT',
          status: 'RESOLVED',
          adminReply: 'Closed.',
        })
      );

      // Baseline content reports: OPEN and terminal ACTIONED
      await setDoc(
        doc(db, 'content_reports/rep_active'),
        createValidContentReportPayload('uid_creator', { status: 'OPEN' })
      );
      await setDoc(
        doc(db, 'content_reports/rep_terminal'),
        createValidContentReportPayload('uid_creator', {
          status: 'ACTIONED',
          resolutionNotes: 'Already actioned.',
        })
      );

      // Seed `/admins/{uid}` staff documents for each role tier
      await setDoc(
        doc(db, 'admins/uid_super_admin'),
        createValidAdminRolePayload('uid_super_admin', 'uid_master_admin', {
          email: 'super@omnistream.xr',
          role: 'SUPER_ADMIN',
        })
      );
      await setDoc(
        doc(db, 'admins/uid_admin'),
        createValidAdminRolePayload('uid_admin', 'uid_super_admin', {
          email: 'admin@omnistream.xr',
          role: 'ADMIN',
        })
      );
      await setDoc(
        doc(db, 'admins/uid_gm'),
        createValidAdminRolePayload('uid_gm', 'uid_admin', {
          email: 'gm@omnistream.xr',
          role: 'GM',
        })
      );
      await setDoc(
        doc(db, 'admins/uid_moderator'),
        createValidAdminRolePayload('uid_moderator', 'uid_admin', {
          email: 'mod@omnistream.xr',
          role: 'MODERATOR',
        })
      );
      // Corrupted / unrecognized role document in `/admins/{uid}` to prove `exists()` alone never grants access
      await setDoc(
        doc(db, 'admins/uid_invalid_role'),
        createValidAdminRolePayload('uid_invalid_role', 'uid_super_admin', {
          email: 'viewer@omnistream.xr',
          role: 'VIEWER_ONLY', // Not in ['SUPER_ADMIN', 'ADMIN', 'GM', 'MODERATOR']
        })
      );
      // Mismatched `targetUid` document in `/admins/{uid}`
      await setDoc(
        doc(db, 'admins/uid_mismatched_target'),
        createValidAdminRolePayload('someone_else_uid', 'uid_super_admin', {
          email: 'mismatch@omnistream.xr',
          role: 'SUPER_ADMIN',
        })
      );
    });

    const superAdminDb = testEnv
      .authenticatedContext('uid_super_admin', {
        email: 'super@omnistream.xr',
        email_verified: true,
      })
      .firestore();
    const adminDb = testEnv
      .authenticatedContext('uid_admin', {
        email: 'admin@omnistream.xr',
        email_verified: true,
      })
      .firestore();
    const gmDb = testEnv
      .authenticatedContext('uid_gm', {
        email: 'gm@omnistream.xr',
        email_verified: true,
      })
      .firestore();
    const modDb = testEnv
      .authenticatedContext('uid_moderator', {
        email: 'mod@omnistream.xr',
        email_verified: true,
      })
      .firestore();
    const invalidRoleDb = testEnv
      .authenticatedContext('uid_invalid_role', {
        email: 'viewer@omnistream.xr',
        email_verified: true,
      })
      .firestore();
    const mismatchedTargetDb = testEnv
      .authenticatedContext('uid_mismatched_target', {
        email: 'mismatch@omnistream.xr',
        email_verified: true,
      })
      .firestore();

    // =========================================================================
    // A. Unrecognized role or mismatched targetUid in `/admins/{uid}` grants ZERO staff privileges
    // =========================================================================
    await assertFails(deleteDoc(doc(invalidRoleDb, 'videos/vid_main/comments/cmt_1')));
    await assertFails(getDoc(doc(invalidRoleDb, 'content_reports/rep_active')));
    await assertFails(getDoc(doc(invalidRoleDb, 'moderation_tickets/tkt_mod_cat')));
    await assertFails(deleteDoc(doc(mismatchedTargetDb, 'videos/vid_main/comments/cmt_1')));
    await assertFails(getDoc(doc(mismatchedTargetDb, 'admins/uid_admin')));

    // =========================================================================
    // B. Tier 4 (`MODERATOR`): Least-privilege moderation without admin/GM powers
    // =========================================================================
    // 1. Moderator CAN read their own `/admins/uid_moderator` doc, but CANNOT read `/admins/uid_admin`
    await assertSucceeds(getDoc(doc(modDb, 'admins/uid_moderator')));
    await assertFails(getDoc(doc(modDb, 'admins/uid_admin')));

    // 2. Moderator CANNOT create, update, or delete any `/admins/{id}` doc (no self-promotion or staff creation!)
    testEnv.advanceClockMs(1000);
    await assertFails(
      updateDoc(doc(modDb, 'admins/uid_moderator'), {
        role: 'SUPER_ADMIN',
        assignedByUid: 'uid_moderator',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(
        doc(modDb, 'admins/uid_new_mod'),
        createValidAdminRolePayload('uid_new_mod', 'uid_moderator', { role: 'MODERATOR' })
      )
    );
    await assertFails(deleteDoc(doc(modDb, 'admins/uid_gm')));

    // 3. Moderator CAN restrict `ageRating` on `/videos/vid_main`, but CANNOT edit `title` or delete the video
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(modDb, 'videos/vid_main'), {
        ageRating: 'MATURE',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(modDb, 'videos/vid_main'), {
        title: 'Moderator attempting to rewrite creator title',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(modDb, 'videos/vid_main')));

    // 4. Moderator CAN delete abusive comments, but CANNOT rewrite another user's comment `text`
    await assertFails(
      updateDoc(doc(modDb, 'videos/vid_main/comments/cmt_1'), {
        text: 'Moderator rewriting user comment text',
      })
    );
    await assertSucceeds(deleteDoc(doc(modDb, 'videos/vid_main/comments/cmt_1')));

    // 5. Moderator CAN resolve `MODERATOR` category tickets, but CANNOT resolve `GM` or `ADMIN` category tickets,
    //    CANNOT reopen terminal `RESOLVED` tickets, and CANNOT delete tickets
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(modDb, 'moderation_tickets/tkt_mod_cat'), {
        status: 'IN_REVIEW',
        adminReply: 'Moderator reviewing ticket.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(modDb, 'moderation_tickets/tkt_gm_cat'), {
        status: 'IN_REVIEW',
        adminReply: 'Moderator trying to handle GM ticket.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(modDb, 'moderation_tickets/tkt_admin_cat'), {
        status: 'IN_REVIEW',
        adminReply: 'Moderator trying to handle ADMIN ticket.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(modDb, 'moderation_tickets/tkt_closed'), {
        status: 'OPEN',
        adminReply: 'Moderator trying to reopen RESOLVED ticket.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(modDb, 'moderation_tickets/tkt_mod_cat')));

    // 6. Moderator CAN review active (`OPEN`/`IN_REVIEW`) content reports, but CANNOT override terminal `ACTIONED` reports or delete reports
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(modDb, 'content_reports/rep_active'), {
        status: 'IN_REVIEW',
        severity: 'HIGH',
        resolutionNotes: 'Triaged by Moderator.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(modDb, 'content_reports/rep_terminal'), {
        status: 'OPEN',
        severity: 'LOW',
        resolutionNotes: 'Moderator trying to reopen terminal report.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(modDb, 'content_reports/rep_active')));

    // =========================================================================
    // C. Tier 3 (`GM` / Game Master): Full video metadata & GM ticket control, no `/admins` or destructive delete
    // =========================================================================
    // 1. GM CANNOT create, update, or delete `/admins/{id}` documents or read other staff docs
    await assertFails(getDoc(doc(gmDb, 'admins/uid_admin')));
    await assertFails(
      setDoc(
        doc(gmDb, 'admins/uid_gm_sub'),
        createValidAdminRolePayload('uid_gm_sub', 'uid_gm', { role: 'MODERATOR' })
      )
    );
    await assertFails(
      updateDoc(doc(gmDb, 'admins/uid_gm'), {
        role: 'ADMIN',
        assignedByUid: 'uid_gm',
        updatedAt: serverTimestamp(),
      })
    );

    // 2. GM CAN update full video metadata (`title`, `description`, `category`, `resolution`, `ageRating`),
    //    but CANNOT delete `/videos/vid_main`
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(gmDb, 'videos/vid_main'), {
        title: '32K Spatial Cinema Masterclass [GM Verified]',
        category: 'Learning',
        ageRating: 'TEEN',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(gmDb, 'videos/vid_main')));

    // 3. GM CAN resolve `GM` category tickets, but CANNOT resolve `ADMIN` category tickets or reopen `RESOLVED` tickets
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(gmDb, 'moderation_tickets/tkt_gm_cat'), {
        status: 'RESOLVED',
        adminReply: 'Resolved by Game Master.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(gmDb, 'moderation_tickets/tkt_admin_cat'), {
        status: 'RESOLVED',
        adminReply: 'GM trying to resolve ADMIN category ticket.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(gmDb, 'moderation_tickets/tkt_closed'), {
        status: 'IN_REVIEW',
        adminReply: 'GM trying to reopen RESOLVED ticket.',
        updatedAt: serverTimestamp(),
      })
    );

    // =========================================================================
    // D. Tier 2 (`ADMIN`): Manages subordinate roles (`GM`, `MODERATOR`) and platform resources,
    //    but CANNOT grant/modify/delete `SUPER_ADMIN` or `ADMIN`
    // =========================================================================
    // 1. ADMIN CAN read other `/admins` docs and CAN create/update/delete `GM` and `MODERATOR` roles
    await assertSucceeds(getDoc(doc(adminDb, 'admins/uid_moderator')));
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      setDoc(
        doc(adminDb, 'admins/uid_new_mod'),
        createValidAdminRolePayload('uid_new_mod', 'uid_admin', { role: 'MODERATOR' })
      )
    );
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(adminDb, 'admins/uid_new_mod'), {
        role: 'GM',
        assignedByUid: 'uid_admin',
        updatedAt: serverTimestamp(),
      })
    );

    // 2. ADMIN CANNOT create a `SUPER_ADMIN` or `ADMIN`, CANNOT promote `uid_new_mod` to `ADMIN` or `SUPER_ADMIN`,
    //    and CANNOT update or delete `uid_super_admin` or `uid_admin`
    testEnv.advanceClockMs(1000);
    await assertFails(
      setDoc(
        doc(adminDb, 'admins/uid_rogue_super'),
        createValidAdminRolePayload('uid_rogue_super', 'uid_admin', { role: 'SUPER_ADMIN' })
      )
    );
    await assertFails(
      setDoc(
        doc(adminDb, 'admins/uid_rogue_admin'),
        createValidAdminRolePayload('uid_rogue_admin', 'uid_admin', { role: 'ADMIN' })
      )
    );
    await assertFails(
      updateDoc(doc(adminDb, 'admins/uid_new_mod'), {
        role: 'ADMIN',
        assignedByUid: 'uid_admin',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(adminDb, 'admins/uid_super_admin'), {
        role: 'MODERATOR',
        assignedByUid: 'uid_admin',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(adminDb, 'admins/uid_super_admin')));
    await assertFails(deleteDoc(doc(adminDb, 'admins/uid_admin')));

    // 3. ADMIN CAN delete subordinate `GM`/`MODERATOR` staff, resolve `ADMIN` tickets, reopen terminal tickets/reports, and delete videos
    await assertSucceeds(deleteDoc(doc(adminDb, 'admins/uid_new_mod')));
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(adminDb, 'moderation_tickets/tkt_admin_cat'), {
        status: 'RESOLVED',
        adminReply: 'Resolved by ADMIN.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(adminDb, 'moderation_tickets/tkt_closed'), {
        status: 'IN_REVIEW',
        adminReply: 'Reopened by ADMIN.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(adminDb, 'content_reports/rep_terminal'), {
        status: 'IN_REVIEW',
        severity: 'CRITICAL',
        resolutionNotes: 'Reopened by ADMIN for audit.',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(deleteDoc(doc(adminDb, 'videos/vid_to_delete_by_admin')));

    // =========================================================================
    // E. Tier 1 (`SUPER_ADMIN`): Full authority over `/admins` including `ADMIN` and `SUPER_ADMIN` tiers
    // =========================================================================
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      setDoc(
        doc(superAdminDb, 'admins/uid_promoted_admin'),
        createValidAdminRolePayload('uid_promoted_admin', 'uid_super_admin', { role: 'ADMIN' })
      )
    );
    testEnv.advanceClockMs(1000);
    await assertSucceeds(
      updateDoc(doc(superAdminDb, 'admins/uid_promoted_admin'), {
        role: 'SUPER_ADMIN',
        assignedByUid: 'uid_super_admin',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(deleteDoc(doc(superAdminDb, 'admins/uid_promoted_admin')));
  } finally {
    await testEnv.cleanup();
  }
});

test('Rule Mutation Sensitivity Proof: Weakening firestore.rules expressions changes runtime evaluation outcomes', async () => {
  const productionRules = fs.readFileSync('firestore.rules', 'utf8');

  // 1. Mutate `isVerifiedUser()` by removing `&& request.auth.token.email_verified == true`
  const unverifiedWeakRules = productionRules.replace(
    'return isSignedIn() && request.auth.token.email_verified == true;',
    'return isSignedIn();'
  );
  assert.notEqual(unverifiedWeakRules, productionRules);

  // 2. Mutate `hasStaffRole(allowedRoles)` to ignore `allowedRoles` (`exists(...)` only, the old broad admin bug)
  const broadAdminWeakRules = productionRules.replace(
    '&& get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in allowedRoles;',
    ';'
  );
  assert.notEqual(broadAdminWeakRules, productionRules);

  const prodEnv = await initializeRulesTestEnvironment({ rulesSource: productionRules });
  const unverifiedWeakEnv = await initializeRulesTestEnvironment({
    rulesSource: unverifiedWeakRules,
  });
  const broadAdminWeakEnv = await initializeRulesTestEnvironment({
    rulesSource: broadAdminWeakRules,
  });

  try {
    // Proof A: `email_verified` enforcement
    const spooferInProd = prodEnv
      .authenticatedContext('uid_spoofer', {
        email: PRIMARY_ADMIN_EMAIL,
        email_verified: false,
      })
      .firestore();
    const spooferInWeak = unverifiedWeakEnv
      .authenticatedContext('uid_spoofer', {
        email: PRIMARY_ADMIN_EMAIL,
        email_verified: false,
      })
      .firestore();

    const payload = createValidAdminRolePayload('uid_spoofer', 'uid_spoofer', {
      role: 'SUPER_ADMIN',
    });

    await assertFails(setDoc(doc(spooferInProd, 'admins/uid_spoofer'), payload));
    await assertSucceeds(setDoc(doc(spooferInWeak, 'admins/uid_spoofer'), payload));

    // Proof B: Role-hierarchy enforcement (`MODERATOR` attempting to delete a video or escalate to `SUPER_ADMIN`)
    await prodEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'videos/vid_1'), createValidVideoPayload('uid_creator'));
      await setDoc(
        doc(db, 'admins/uid_mod'),
        createValidAdminRolePayload('uid_mod', 'uid_master', { role: 'MODERATOR' })
      );
    });
    await broadAdminWeakEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'videos/vid_1'), createValidVideoPayload('uid_creator'));
      await setDoc(
        doc(db, 'admins/uid_mod'),
        createValidAdminRolePayload('uid_mod', 'uid_master', { role: 'MODERATOR' })
      );
    });

    const modInProd = prodEnv
      .authenticatedContext('uid_mod', { email: 'mod@omnistream.xr', email_verified: true })
      .firestore();
    const modInBroadWeak = broadAdminWeakEnv
      .authenticatedContext('uid_mod', { email: 'mod@omnistream.xr', email_verified: true })
      .firestore();

    // Production rules deny a MODERATOR from deleting a video or creating a SUPER_ADMIN
    await assertFails(deleteDoc(doc(modInProd, 'videos/vid_1')));
    await assertFails(
      setDoc(
        doc(modInProd, 'admins/uid_mod_escalated'),
        createValidAdminRolePayload('uid_mod_escalated', 'uid_mod', { role: 'SUPER_ADMIN' })
      )
    );

    // Weakened rules (where `data.role in allowedRoles` was removed) allow both — proving the role check is actively enforced!
    await assertSucceeds(deleteDoc(doc(modInBroadWeak, 'videos/vid_1')));
    await assertSucceeds(
      setDoc(
        doc(modInBroadWeak, 'admins/uid_mod_escalated'),
        createValidAdminRolePayload('uid_mod_escalated', 'uid_mod', { role: 'SUPER_ADMIN' })
      )
    );
  } finally {
    await prodEnv.cleanup();
    await unverifiedWeakEnv.cleanup();
    await broadAdminWeakEnv.cleanup();
  }
});
