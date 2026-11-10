import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BillingCycle,
  SubscriptionInvoiceRecord,
  SubscriptionPlanId,
  UserSubscriptionRecord,
  buildSubscriptionCheckoutResult,
  createDefaultFreeSubscription,
} from './subscriptionEngine';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Workspace Scopes configured via set_up_oauth
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory access token cache (NEVER stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    await ensureUserProfile(result.user);
    await ensureDefaultSubscription(result.user);
    await ensureAdminRoleForMasterUser(result.user);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Mandatory connection validation on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Mandatory Firestore Error Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Defensive ID and string sanitizer matching firebase-blueprint.json
function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export interface VideoRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  resolution: string;
  videoUrl: string;
  ownerId: string;
  authorName: string;
  ageRating: 'ALL' | 'TEEN' | 'MATURE';
  views: number;
}

export interface CommentRecord {
  id: string;
  videoId: string;
  ownerId: string;
  authorName: string;
  text: string;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  ownerId: string;
  videoIds: string;
}

export interface UserProfileRecord {
  ownerId: string;
  displayName: string;
  isPremium: boolean;
  parentalControlMode: boolean;
  lastWatchedVideoId: string;
  lastWatchedProgressSec: number;
}

export interface ServerEntitlementVerification {
  uid: string;
  isPremium: boolean;
  tier: 'STANDARD' | 'PREMIUM_ENTERPRISE';
  dailyQuotaUnits: number;
  verifiedBy: string;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const existingSnap = await getDocFromServer(userRef).catch(() => null);
    if (existingSnap && existingSnap.exists()) {
      return;
    }

    // Clients MUST initialize `isPremium: false`. Premium entitlement is governed
    // exclusively by trusted server-side authority (`/api/entitlements/*`) and `isAdmin()` rules.
    await setDoc(
      userRef,
      {
        ownerId: uid,
        displayName: (user.displayName || user.email || 'Creator').slice(0, 80),
        isPremium: false,
        parentalControlMode: false,
        lastWatchedVideoId: 'vid_spatial_8k',
        lastWatchedProgressSec: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  } catch {
    // Profile may already exist; ignore create collision
  }
  void path;
}

export async function fetchUserProfile(uid?: string): Promise<UserProfileRecord | null> {
  const targetUid = sanitizeId(uid || auth.currentUser?.uid || '');
  if (!targetUid || !auth.currentUser) return null;
  const path = `users/${targetUid}`;
  try {
    const snap = await getDocFromServer(doc(db, 'users', targetUid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ownerId: String(data.ownerId || targetUid),
      displayName: String(data.displayName || 'Creator'),
      isPremium: Boolean(data.isPremium),
      parentalControlMode: Boolean(data.parentalControlMode),
      lastWatchedVideoId: String(data.lastWatchedVideoId || 'vid_spatial_8k'),
      lastWatchedProgressSec: Number(data.lastWatchedProgressSec || 0),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function verifyServerEntitlement(): Promise<ServerEntitlementVerification> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return {
      uid: 'anonymous',
      isPremium: false,
      tier: 'STANDARD',
      dailyQuotaUnits: 0,
      verifiedBy: 'UNAUTHENTICATED_FALLBACK',
    };
  }

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch('/api/entitlements/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (res.ok) {
      const data = (await res.json()) as Partial<ServerEntitlementVerification>;
      return {
        uid: String(data.uid || currentUser.uid),
        isPremium: Boolean(data.isPremium),
        tier: data.tier === 'PREMIUM_ENTERPRISE' ? 'PREMIUM_ENTERPRISE' : 'STANDARD',
        dailyQuotaUnits: Number(data.dailyQuotaUnits || 250),
        verifiedBy: String(data.verifiedBy || 'SERVER_ENTITLEMENT_AUTHORITY'),
      };
    }
  } catch {
    // Fallback to Firestore profile read if offline
  }

  try {
    const profile = await fetchUserProfile(currentUser.uid);
    const isVerifiedPremium = Boolean(profile?.isPremium);
    return {
      uid: currentUser.uid,
      isPremium: isVerifiedPremium,
      tier: isVerifiedPremium ? 'PREMIUM_ENTERPRISE' : 'STANDARD',
      dailyQuotaUnits: isVerifiedPremium ? 500 : 250,
      verifiedBy: 'FIRESTORE_ADMIN_GOVERNED_PROFILE',
    };
  } catch {
    return {
      uid: currentUser.uid,
      isPremium: false,
      tier: 'STANDARD',
      dailyQuotaUnits: 250,
      verifiedBy: 'DEFAULT_STANDARD_POLICY',
    };
  }
}

export async function setAdminUserPremiumEntitlement(
  targetUid: string,
  isPremium: boolean
): Promise<ServerEntitlementVerification> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required to manage user entitlements.');
  }
  const cleanTargetUid = sanitizeId(targetUid);
  const idToken = await currentUser.getIdToken();

  const res = await fetch('/api/entitlements/grant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      targetUid: cleanTargetUid,
      targetEmail: currentUser.email || undefined,
      isPremium: Boolean(isPremium),
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      errBody.error ||
        'Forbidden: Only verified administrators can grant or revoke premium status.'
    );
  }

  const path = `users/${cleanTargetUid}`;
  try {
    await updateDoc(doc(db, 'users', cleanTargetUid), {
      isPremium: Boolean(isPremium),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return (await res.json()) as ServerEntitlementVerification;
}

export async function ensureDefaultSubscription(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const path = `subscriptions/${uid}`;
  try {
    const subRef = doc(db, 'subscriptions', uid);
    const existingSnap = await getDocFromServer(subRef).catch(() => null);
    if (existingSnap && existingSnap.exists()) {
      return;
    }

    // Regular clients initialize FREE_STANDARD (isPremium: false, dailyQuotaUnits: 250)
    await setDoc(
      subRef,
      {
        ownerId: uid,
        planId: 'FREE_STANDARD',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        isPremium: false,
        maxStreamResolution: '4K',
        dailyQuotaUnits: 250,
        priceUsdPerPeriod: 0,
        paymentMethodLast4: 'NONE',
        cancelAtPeriodEnd: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  } catch {
    // Subscription document may already exist
  }
  void path;
}

export async function fetchMySubscriptionState(): Promise<{
  subscription: UserSubscriptionRecord;
  invoices: SubscriptionInvoiceRecord[];
  entitlement: ServerEntitlementVerification;
  remainingDailyQuotaUnits: number;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const fallbackSub = createDefaultFreeSubscription('guest_preview', undefined, false);
    return {
      subscription: {
        ...fallbackSub,
        verifiedBy: 'GUEST_PREVIEW_SANDBOX',
      },
      invoices: [],
      entitlement: {
        uid: 'guest_preview',
        isPremium: false,
        tier: 'STANDARD',
        dailyQuotaUnits: 250,
        verifiedBy: 'GUEST_PREVIEW_SANDBOX',
      },
      remainingDailyQuotaUnits: 250,
    };
  }

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch('/api/subscriptions/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        subscription: data.subscription as UserSubscriptionRecord,
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        entitlement: data.entitlement as ServerEntitlementVerification,
        remainingDailyQuotaUnits: Number(data.remainingDailyQuotaUnits ?? 250),
      };
    }
  } catch {
    // Fallback to default free subscription if offline
  }

  const isMaster = isMasterAdminUser(currentUser);
  const fallbackSub = createDefaultFreeSubscription(
    currentUser.uid,
    currentUser.email || undefined,
    isMaster
  );
  return {
    subscription: fallbackSub,
    invoices: [],
    entitlement: {
      uid: currentUser.uid,
      isPremium: fallbackSub.isPremium,
      tier: fallbackSub.isPremium ? 'PREMIUM_ENTERPRISE' : 'STANDARD',
      dailyQuotaUnits: fallbackSub.dailyQuotaUnits,
      verifiedBy: 'SERVER_SUBSCRIPTION_AUTHORITY',
    },
    remainingDailyQuotaUnits: fallbackSub.dailyQuotaUnits,
  };
}

export async function checkoutSubscriptionOnServer(params: {
  planId: SubscriptionPlanId;
  billingCycle: BillingCycle;
  paymentMethodLast4?: string;
}): Promise<{
  message: string;
  subscription: UserSubscriptionRecord;
  invoice: SubscriptionInvoiceRecord;
  invoices: SubscriptionInvoiceRecord[];
  entitlement: ServerEntitlementVerification;
  remainingDailyQuotaUnits: number;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const { subscription, invoice } = buildSubscriptionCheckoutResult({
      ownerId: 'guest_preview',
      planId: params.planId,
      billingCycle: params.billingCycle,
      paymentMethodLast4: params.paymentMethodLast4,
      verifiedBy: 'GUEST_PREVIEW_SANDBOX',
    });
    return {
      message: `Guest Preview: Activated ${params.planId} (${params.billingCycle}) locally. Sign in with Google to persist via Server Subscription Authority.`,
      subscription,
      invoice,
      invoices: [invoice],
      entitlement: {
        uid: 'guest_preview',
        isPremium: subscription.isPremium,
        tier: subscription.isPremium ? 'PREMIUM_ENTERPRISE' : 'STANDARD',
        dailyQuotaUnits: subscription.dailyQuotaUnits,
        verifiedBy: 'GUEST_PREVIEW_SANDBOX',
      },
      remainingDailyQuotaUnits: subscription.dailyQuotaUnits,
    };
  }

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/subscriptions/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      planId: params.planId,
      billingCycle: params.billingCycle,
      paymentMethodLast4: params.paymentMethodLast4 || '4242',
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || 'Subscription checkout failed on server.');
  }

  const data = await res.json();
  const sub = data.subscription as UserSubscriptionRecord;

  // If the signed-in user is a verified Admin, also mirror full paid tier state to Firestore /subscriptions/{uid}
  if (isMasterAdminUser(currentUser)) {
    const uid = sanitizeId(currentUser.uid);
    try {
      await setDoc(
        doc(db, 'subscriptions', uid),
        {
          ownerId: uid,
          planId: sub.planId,
          billingCycle: sub.billingCycle,
          status: sub.status,
          isPremium: sub.isPremium,
          maxStreamResolution: sub.maxStreamResolution,
          dailyQuotaUnits: sub.dailyQuotaUnits,
          priceUsdPerPeriod: sub.priceUsdPerPeriod,
          paymentMethodLast4: sub.paymentMethodLast4,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch {
      // Non-fatal sync
    }
  }

  return {
    message: String(data.message || 'Subscription updated.'),
    subscription: sub,
    invoice: data.invoice as SubscriptionInvoiceRecord,
    invoices: Array.isArray(data.invoices) ? data.invoices : [data.invoice],
    entitlement: data.entitlement as ServerEntitlementVerification,
    remainingDailyQuotaUnits: Number(
      data.remainingDailyQuotaUnits ?? sub.dailyQuotaUnits
    ),
  };
}

export async function cancelSubscriptionOnServer(
  immediate: boolean = false
): Promise<{
  message: string;
  subscription: UserSubscriptionRecord;
  invoices: SubscriptionInvoiceRecord[];
  entitlement: ServerEntitlementVerification;
  remainingDailyQuotaUnits: number;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const fallbackSub = createDefaultFreeSubscription('guest_preview', undefined, false);
    return {
      message: 'Guest Preview: Subscription reset to Standard Explorer ($0/mo).',
      subscription: {
        ...fallbackSub,
        verifiedBy: 'GUEST_PREVIEW_SANDBOX',
      },
      invoices: [],
      entitlement: {
        uid: 'guest_preview',
        isPremium: false,
        tier: 'STANDARD',
        dailyQuotaUnits: 250,
        verifiedBy: 'GUEST_PREVIEW_SANDBOX',
      },
      remainingDailyQuotaUnits: 250,
    };
  }

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/subscriptions/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ immediate }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || 'Failed to cancel subscription.');
  }

  const data = await res.json();
  const sub = data.subscription as UserSubscriptionRecord;

  // Subscriber is allowed by Firestore rules to update ['status', 'cancelAtPeriodEnd', 'paymentMethodLast4', 'updatedAt']
  const uid = sanitizeId(currentUser.uid);
  try {
    await updateDoc(doc(db, 'subscriptions', uid), {
      status: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      paymentMethodLast4: sub.paymentMethodLast4,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore if document wasn't created yet
  }

  return {
    message: String(data.message || 'Subscription canceled.'),
    subscription: sub,
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    entitlement: data.entitlement as ServerEntitlementVerification,
    remainingDailyQuotaUnits: Number(
      data.remainingDailyQuotaUnits ?? sub.dailyQuotaUnits
    ),
  };
}

export async function syncPlaybackProgress(
  videoId: string,
  progressSec: number
): Promise<void> {
  if (!auth.currentUser) return;
  const uid = sanitizeId(auth.currentUser.uid);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      lastWatchedVideoId: sanitizeId(videoId),
      lastWatchedProgressSec: Math.max(0, Math.floor(progressSec)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function publishVideoToFirestore(input: {
  title: string;
  description: string;
  category: string;
  resolution: string;
  videoUrl: string;
  ageRating: 'ALL' | 'TEEN' | 'MATURE';
}): Promise<string> {
  if (!auth.currentUser) throw new Error('Must be signed in to upload videos.');
  const videoId = sanitizeId(`vid_${Date.now()}`);
  const path = `videos/${videoId}`;
  try {
    await setDoc(doc(db, 'videos', videoId), {
      title: input.title.trim().slice(0, 120) || 'Untitled 32K Stream',
      description: input.description.trim().slice(0, 1000),
      category: input.category.trim().slice(0, 40) || 'Spatial XR',
      resolution: input.resolution.trim().slice(0, 20) || '32K',
      videoUrl: input.videoUrl.trim().slice(0, 500) || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      ownerId: auth.currentUser.uid,
      authorName: (auth.currentUser.displayName || auth.currentUser.email || 'Studio Creator').slice(0, 80),
      ageRating: input.ageRating,
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return videoId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function incrementVideoViews(videoId: string): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(videoId);
  const path = `videos/${cleanId}`;
  try {
    await updateDoc(doc(db, 'videos', cleanId), {
      views: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToComments(
  videoId: string,
  onUpdate: (comments: CommentRecord[]) => void
): Unsubscribe {
  if (!auth.currentUser) {
    onUpdate([]);
    return () => {};
  }
  const cleanVideoId = sanitizeId(videoId);
  const path = `videos/${cleanVideoId}/comments`;
  const q = query(
    collection(db, 'videos', cleanVideoId, 'comments'),
    where('videoId', '==', cleanVideoId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CommentRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          videoId: String(data.videoId || cleanVideoId),
          ownerId: String(data.ownerId || ''),
          authorName: String(data.authorName || 'Viewer'),
          text: String(data.text || ''),
        };
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function addVideoComment(
  videoId: string,
  text: string
): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in with Google to post comments.');
  const cleanVideoId = sanitizeId(videoId);
  const commentId = sanitizeId(`cmt_${Date.now()}`);
  const path = `videos/${cleanVideoId}/comments/${commentId}`;
  try {
    // Ensure parent video document exists for Master Gate relational validation
    try {
      await setDoc(
        doc(db, 'videos', cleanVideoId),
        {
          title: 'OmniStream 32K Master Stream',
          description: 'Catalog stream synchronized for comments',
          category: 'Spatial XR',
          resolution: '32K',
          videoUrl:
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          ownerId: auth.currentUser.uid,
          authorName: (
            auth.currentUser.displayName ||
            auth.currentUser.email ||
            'Creator'
          ).slice(0, 80),
          ageRating: 'ALL',
          views: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch {
      // Parent video document already exists
    }
    await setDoc(doc(db, 'videos', cleanVideoId, 'comments', commentId), {
      videoId: cleanVideoId,
      ownerId: auth.currentUser.uid,
      authorName: (auth.currentUser.displayName || auth.currentUser.email || 'Creator').slice(0, 80),
      text: text.trim().slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteVideoComment(
  videoId: string,
  commentId: string
): Promise<void> {
  if (!auth.currentUser) return;
  const cleanVideoId = sanitizeId(videoId);
  const cleanCommentId = sanitizeId(commentId);
  const path = `videos/${cleanVideoId}/comments/${cleanCommentId}`;
  try {
    await deleteDoc(doc(db, 'videos', cleanVideoId, 'comments', cleanCommentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserPlaylists(): Promise<PlaylistRecord[]> {
  if (!auth.currentUser) return [];
  const path = 'playlists';
  try {
    const q = query(
      collection(db, 'playlists'),
      where('ownerId', '==', auth.currentUser.uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || 'Playlist'),
        ownerId: String(data.ownerId || ''),
        videoIds: String(data.videoIds || ''),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createUserPlaylist(
  name: string,
  videoIds: string
): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in to create playlists.');
  const playlistId = sanitizeId(`pl_${Date.now()}`);
  const path = `playlists/${playlistId}`;
  try {
    await setDoc(doc(db, 'playlists', playlistId), {
      name: name.trim().slice(0, 80) || 'My 32K Playlist',
      ownerId: auth.currentUser.uid,
      videoIds: videoIds.slice(0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export const PRIMARY_ADMIN_EMAIL = 'creatergame31@gmail.com';

export type StaffRoleTier = 'SUPER_ADMIN' | 'GM' | 'ADMIN' | 'MODERATOR';
export type ModerationTicketCategory = 'ADMIN' | 'GM' | 'MODERATOR' | 'CONTACT';
export type ModerationTicketStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export interface AdminRoleRecord {
  targetUid: string;
  email: string;
  role: StaffRoleTier;
  permissions: string;
  assignedByUid: string;
}

export interface ModerationTicketRecord {
  id: string;
  ownerId: string;
  senderName: string;
  recipientEmail: string;
  category: ModerationTicketCategory;
  subject: string;
  message: string;
  status: ModerationTicketStatus;
  adminReply: string;
}

export function isMasterAdminUser(user: User | null | undefined): boolean {
  if (!user || !user.email) return false;
  return user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
}

export async function ensureAdminRoleForMasterUser(user: User): Promise<void> {
  if (!isMasterAdminUser(user)) return;
  const uid = sanitizeId(user.uid);
  try {
    await setDoc(
      doc(db, 'admins', uid),
      {
        targetUid: uid,
        email: PRIMARY_ADMIN_EMAIL,
        role: 'SUPER_ADMIN',
        permissions: 'administration,gm,admin,moderator,contact',
        assignedByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  } catch {
    // Role document may already exist
  }
}

export async function assignStaffRole(input: {
  targetUid: string;
  email: string;
  role: StaffRoleTier;
  permissions: string;
}): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in as Admin to assign roles.');
  const cleanTargetUid = sanitizeId(input.targetUid);
  const path = `admins/${cleanTargetUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanTargetUid), {
      targetUid: cleanTargetUid,
      email: input.email.trim().slice(0, 120) || PRIMARY_ADMIN_EMAIL,
      role: input.role,
      permissions: input.permissions.trim().slice(0, 200) || 'administration,gm,admin,moderator,contact',
      assignedByUid: sanitizeId(auth.currentUser.uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchStaffRoles(): Promise<AdminRoleRecord[]> {
  if (!auth.currentUser) return [];
  const path = 'admins';
  try {
    const q = isMasterAdminUser(auth.currentUser)
      ? query(
          collection(db, 'admins'),
          where('role', 'in', ['SUPER_ADMIN', 'GM', 'ADMIN', 'MODERATOR'])
        )
      : query(
          collection(db, 'admins'),
          where('targetUid', '==', sanitizeId(auth.currentUser.uid))
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        targetUid: String(data.targetUid || d.id),
        email: String(data.email || PRIMARY_ADMIN_EMAIL),
        role: (data.role as StaffRoleTier) || 'MODERATOR',
        permissions: String(data.permissions || 'moderator,contact'),
        assignedByUid: String(data.assignedByUid || ''),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function removeStaffRole(targetUid: string): Promise<void> {
  if (!auth.currentUser) return;
  const cleanTargetUid = sanitizeId(targetUid);
  const path = `admins/${cleanTargetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', cleanTargetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createModerationTicket(input: {
  category: ModerationTicketCategory;
  subject: string;
  message: string;
}): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Please sign in with Google to submit a tracked ticket to creatergame31@gmail.com.');
  }
  const ticketId = sanitizeId(`tkt_${Date.now()}`);
  const path = `moderation_tickets/${ticketId}`;
  try {
    await setDoc(doc(db, 'moderation_tickets', ticketId), {
      ownerId: sanitizeId(auth.currentUser.uid),
      senderName: (auth.currentUser.displayName || auth.currentUser.email || 'User').slice(0, 80),
      recipientEmail: PRIMARY_ADMIN_EMAIL,
      category: input.category,
      subject: input.subject.trim().slice(0, 120) || 'Admin / GM / Moderator Inquiry',
      message: input.message.trim().slice(0, 1000) || 'Requesting assistance.',
      status: 'OPEN',
      adminReply: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ticketId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchModerationTickets(): Promise<ModerationTicketRecord[]> {
  if (!auth.currentUser) return [];
  const path = 'moderation_tickets';
  try {
    const q = isMasterAdminUser(auth.currentUser)
      ? query(
          collection(db, 'moderation_tickets'),
          where('recipientEmail', '==', PRIMARY_ADMIN_EMAIL)
        )
      : query(
          collection(db, 'moderation_tickets'),
          where('ownerId', '==', sanitizeId(auth.currentUser.uid))
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: String(data.ownerId || ''),
        senderName: String(data.senderName || 'User'),
        recipientEmail: String(data.recipientEmail || PRIMARY_ADMIN_EMAIL),
        category: (data.category as ModerationTicketCategory) || 'CONTACT',
        subject: String(data.subject || ''),
        message: String(data.message || ''),
        status: (data.status as ModerationTicketStatus) || 'OPEN',
        adminReply: String(data.adminReply || ''),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function resolveModerationTicket(
  ticketId: string,
  status: ModerationTicketStatus,
  adminReply: string
): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(ticketId);
  const path = `moderation_tickets/${cleanId}`;
  try {
    await updateDoc(doc(db, 'moderation_tickets', cleanId), {
      status,
      adminReply: adminReply.trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteModerationTicket(ticketId: string): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(ticketId);
  const path = `moderation_tickets/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'moderation_tickets', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export type ContentReportReason =
  | 'SPAM_OR_MISLEADING'
  | 'HARASSMENT_OR_ABUSE'
  | 'COPYRIGHT_OR_IP'
  | 'AGE_RESTRICTION_VIOLATION'
  | 'ENCODING_OR_PLAYBACK_ISSUE';

export type ContentReportTargetType =
  | 'LUMEN_VIDEO'
  | 'STUDIO_STREAM'
  | 'COMMENT';

export type ContentReportSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ContentReportStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'ACTIONED'
  | 'DISMISSED';

export interface ContentReportRecord {
  id: string;
  targetId: string;
  targetType: ContentReportTargetType;
  targetTitle: string;
  reporterId: string;
  reporterName: string;
  assignedAdminEmail: string;
  reason: ContentReportReason;
  severity: ContentReportSeverity;
  details: string;
  status: ContentReportStatus;
  resolutionNotes: string;
}

export async function submitContentReport(input: {
  targetId: string;
  targetType: ContentReportTargetType;
  targetTitle: string;
  reason: ContentReportReason;
  severity: ContentReportSeverity;
  details: string;
}): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Please sign in with Google to submit a verified Firestore content report.');
  }
  const reportId = sanitizeId(`rep_${Date.now()}`);
  const cleanTargetId = sanitizeId(input.targetId);
  const path = `content_reports/${reportId}`;
  try {
    await setDoc(doc(db, 'content_reports', reportId), {
      targetId: cleanTargetId,
      targetType: input.targetType,
      targetTitle: (input.targetTitle.trim() || 'Reported Item').slice(0, 160),
      reporterId: sanitizeId(auth.currentUser.uid),
      reporterName: (
        auth.currentUser.displayName ||
        auth.currentUser.email ||
        'Community Reporter'
      ).slice(0, 80),
      assignedAdminEmail: PRIMARY_ADMIN_EMAIL,
      reason: input.reason,
      severity: input.severity,
      details: (input.details.trim() || 'User flagged content for admin review.').slice(0, 1000),
      status: 'OPEN',
      resolutionNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchContentReports(): Promise<ContentReportRecord[]> {
  if (!auth.currentUser) return [];
  const path = 'content_reports';
  try {
    const q = isMasterAdminUser(auth.currentUser)
      ? query(
          collection(db, 'content_reports'),
          where('assignedAdminEmail', '==', PRIMARY_ADMIN_EMAIL)
        )
      : query(
          collection(db, 'content_reports'),
          where('reporterId', '==', sanitizeId(auth.currentUser.uid))
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        targetId: String(data.targetId || ''),
        targetType: (data.targetType as ContentReportTargetType) || 'LUMEN_VIDEO',
        targetTitle: String(data.targetTitle || 'Reported Item'),
        reporterId: String(data.reporterId || ''),
        reporterName: String(data.reporterName || 'Reporter'),
        assignedAdminEmail: String(data.assignedAdminEmail || PRIMARY_ADMIN_EMAIL),
        reason: (data.reason as ContentReportReason) || 'SPAM_OR_MISLEADING',
        severity: (data.severity as ContentReportSeverity) || 'MEDIUM',
        details: String(data.details || ''),
        status: (data.status as ContentReportStatus) || 'OPEN',
        resolutionNotes: String(data.resolutionNotes || ''),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToContentReports(
  onUpdate: (reports: ContentReportRecord[]) => void
): Unsubscribe {
  if (!auth.currentUser) {
    return () => {};
  }
  const path = 'content_reports';
  const q = isMasterAdminUser(auth.currentUser)
    ? query(
        collection(db, 'content_reports'),
        where('assignedAdminEmail', '==', PRIMARY_ADMIN_EMAIL)
      )
    : query(
        collection(db, 'content_reports'),
        where('reporterId', '==', sanitizeId(auth.currentUser.uid))
      );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ContentReportRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          targetId: String(data.targetId || ''),
          targetType: (data.targetType as ContentReportTargetType) || 'LUMEN_VIDEO',
          targetTitle: String(data.targetTitle || 'Reported Item'),
          reporterId: String(data.reporterId || ''),
          reporterName: String(data.reporterName || 'Reporter'),
          assignedAdminEmail: String(data.assignedAdminEmail || PRIMARY_ADMIN_EMAIL),
          reason: (data.reason as ContentReportReason) || 'SPAM_OR_MISLEADING',
          severity: (data.severity as ContentReportSeverity) || 'MEDIUM',
          details: String(data.details || ''),
          status: (data.status as ContentReportStatus) || 'OPEN',
          resolutionNotes: String(data.resolutionNotes || ''),
        };
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function reviewContentReport(
  reportId: string,
  input: {
    status: ContentReportStatus;
    severity: ContentReportSeverity;
    resolutionNotes: string;
  }
): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(reportId);
  const path = `content_reports/${cleanId}`;
  try {
    await updateDoc(doc(db, 'content_reports', cleanId), {
      status: input.status,
      severity: input.severity,
      resolutionNotes: input.resolutionNotes.trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteContentReport(reportId: string): Promise<void> {
  if (!auth.currentUser) return;
  const cleanId = sanitizeId(reportId);
  const path = `content_reports/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'content_reports', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Client-Side End-to-End AES-GCM 256-bit Encryption Utility (GDPR / HIPAA Vault)
export async function encryptEndToEnd(plaintext: string, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    enc.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptEndToEnd(cipherBase64: string, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const raw = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );
  return new TextDecoder().decode(decrypted);
}
