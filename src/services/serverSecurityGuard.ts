/**
 * Server Security Guard for Gemini API Routes & `/live` WebSocket (`server.ts`)
 *
 * Remediates High-Risk Server Vulnerabilities:
 * 1. Authentication Enforcement: Verifies Firebase ID tokens (JWT structure, audience, issuer,
 *    expiration, and IdentityToolkit/Google public key verification) on all `/api/gemini/*`
 *    endpoints and `/live` WebSocket upgrades.
 * 2. Sliding-Window Rate Limiting: Per-IP and Per-User sliding-window request rate limiters,
 *    with stricter limits on costly media generation endpoints.
 * 3. Weighted Daily Request Quotas: Tracks per-user and global daily quota unit consumption
 *    across text (1–2 units), audio/vision (5 units), image/music (10 units), and video/live (25 units),
 *    plus concurrent `/live` WebSocket session caps.
 * 4. Error Sanitization: Never returns raw `error.message` or stack traces to clients; maps all
 *    internal exceptions to safe public error messages and redacts sensitive tokens in server logs.
 */

import crypto from 'node:crypto';

export type GeminiEndpointCategory =
  | 'FAST_ASSIST'
  | 'CHAT_AND_GROUNDING'
  | 'VISION_AND_SPEECH'
  | 'IMAGE_AND_MUSIC'
  | 'VIDEO_AND_LIVE';

export interface EndpointQuotaPolicy {
  category: GeminiEndpointCategory;
  costUnits: number;
  maxRequestsPerMinute: number;
  maxPromptLength: number;
}

export const ENDPOINT_POLICIES: Record<string, EndpointQuotaPolicy> = {
  '/api/gemini/fast-assist': {
    category: 'FAST_ASSIST',
    costUnits: 1,
    maxRequestsPerMinute: 15,
    maxPromptLength: 2000,
  },
  '/api/gemini/chat': {
    category: 'CHAT_AND_GROUNDING',
    costUnits: 2,
    maxRequestsPerMinute: 12,
    maxPromptLength: 4000,
  },
  '/api/gemini/search-grounding': {
    category: 'CHAT_AND_GROUNDING',
    costUnits: 2,
    maxRequestsPerMinute: 10,
    maxPromptLength: 1000,
  },
  '/api/gemini/maps-grounding': {
    category: 'CHAT_AND_GROUNDING',
    costUnits: 2,
    maxRequestsPerMinute: 10,
    maxPromptLength: 1000,
  },
  '/api/gemini/transcribe': {
    category: 'VISION_AND_SPEECH',
    costUnits: 3,
    maxRequestsPerMinute: 8,
    maxPromptLength: 1000,
  },
  '/api/gemini/analyze-media': {
    category: 'VISION_AND_SPEECH',
    costUnits: 5,
    maxRequestsPerMinute: 6,
    maxPromptLength: 3000,
  },
  '/api/gemini/tts': {
    category: 'VISION_AND_SPEECH',
    costUnits: 5,
    maxRequestsPerMinute: 6,
    maxPromptLength: 2500,
  },
  '/api/gemini/generate-image': {
    category: 'IMAGE_AND_MUSIC',
    costUnits: 10,
    maxRequestsPerMinute: 4,
    maxPromptLength: 2000,
  },
  '/api/gemini/generate-music': {
    category: 'IMAGE_AND_MUSIC',
    costUnits: 10,
    maxRequestsPerMinute: 4,
    maxPromptLength: 2000,
  },
  '/api/gemini/generate-video': {
    category: 'VIDEO_AND_LIVE',
    costUnits: 25,
    maxRequestsPerMinute: 2,
    maxPromptLength: 2000,
  },
  '/live': {
    category: 'VIDEO_AND_LIVE',
    costUnits: 25,
    maxRequestsPerMinute: 3,
    maxPromptLength: 2000,
  },
};

export interface VerifiedClientIdentity {
  uid: string;
  email?: string;
  isAdmin: boolean;
}

export interface RateLimitAndQuotaDecision {
  allowed: boolean;
  statusCode: 200 | 401 | 403 | 429;
  errorCode: string;
  publicMessage: string;
  remainingRequestsInWindow: number;
  remainingDailyQuotaUnits: number;
  retryAfterSeconds?: number;
}

export interface PublicErrorEnvelope {
  error: string;
  code: string;
  requestId: string;
}

const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  CHAT_ERROR: 'Unable to process chat request right now. Please try again shortly.',
  ANALYZE_MEDIA_ERROR: 'Unable to analyze media right now. Please verify the file format and try again.',
  FAST_ASSIST_ERROR: 'Unable to generate assistant suggestions right now.',
  SEARCH_GROUNDING_ERROR: 'Unable to complete search grounding query right now.',
  MAPS_GROUNDING_ERROR: 'Unable to complete maps grounding query right now.',
  GENERATE_IMAGE_ERROR: 'Unable to generate image right now. Please try again shortly.',
  GENERATE_VIDEO_ERROR: 'Unable to generate video right now. Please try again shortly.',
  GENERATE_MUSIC_ERROR: 'Unable to generate music stream right now.',
  TTS_ERROR: 'Unable to synthesize speech audio right now.',
  TRANSCRIBE_ERROR: 'Unable to transcribe audio clip right now.',
  LIVE_SESSION_ERROR: 'Live voice session encountered a temporary service error.',
  INTERNAL_ERROR: 'An unexpected server error occurred. Please try again later.',
};

/**
 * Redacts API keys, Bearer tokens, and sensitive credentials from server-side log strings.
 */
export function redactSensitiveErrorDetails(raw: string): string {
  return String(raw || '')
    .replace(/AIza[0-9A-Za-z\-_]{25,}/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/key=[0-9A-Za-z\-_]{16,}/gi, 'key=[REDACTED]')
    .slice(0, 500);
}

/**
 * Converts any internal exception into a safe, generic public error envelope without
 * leaking raw `error.message`, stack traces, or upstream provider details to clients.
 */
export function sanitizeServerError(
  _error: unknown,
  contextCode: keyof typeof PUBLIC_ERROR_MESSAGES | string = 'INTERNAL_ERROR'
): PublicErrorEnvelope {
  const safeMessage =
    PUBLIC_ERROR_MESSAGES[contextCode] || PUBLIC_ERROR_MESSAGES.INTERNAL_ERROR;
  const requestId = `req_${crypto.randomBytes(6).toString('hex')}`;
  return {
    error: safeMessage,
    code: contextCode,
    requestId,
  };
}

/**
 * Extracts a Bearer token from an HTTP Authorization header or a WebSocket upgrade URL query `?token=...`.
 */
export function extractBearerOrQueryToken(
  authorizationHeader?: string,
  requestUrl?: string
): string | null {
  if (typeof authorizationHeader === 'string') {
    const trimmed = authorizationHeader.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      const token = trimmed.slice(7).trim();
      if (token.length >= 20 && token.length <= 4096) {
        return token;
      }
    }
  }
  if (typeof requestUrl === 'string' && requestUrl.includes('token=')) {
    try {
      const parsed = new URL(requestUrl, 'http://localhost:3000');
      const qToken = parsed.searchParams.get('token')?.trim();
      if (qToken && qToken.length >= 20 && qToken.length <= 4096) {
        return qToken;
      }
    } catch {
      return null;
    }
  }
  return null;
}

interface JwtParts {
  header: { alg?: string; kid?: string; typ?: string };
  payload: {
    iss?: string;
    aud?: string;
    sub?: string;
    user_id?: string;
    email?: string;
    exp?: number;
    iat?: number;
  };
  signedContent: string;
  signatureBytes: Buffer;
}

export function decodeAndValidateJwtClaims(
  idToken: string,
  expectedProjectId: string,
  nowEpochSeconds: number = Math.floor(Date.now() / 1000)
): JwtParts | null {
  const segments = (idToken || '').split('.');
  if (segments.length !== 3) return null;

  try {
    const headerJson = Buffer.from(segments[0], 'base64url').toString('utf8');
    const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf8');
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      return null;
    }

    const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
    if (payload.aud !== expectedProjectId || payload.iss !== expectedIssuer) {
      return null;
    }

    const uid = payload.sub || payload.user_id;
    if (typeof uid !== 'string' || uid.trim().length === 0 || uid.length > 128) {
      return null;
    }

    if (typeof payload.exp !== 'number' || payload.exp <= nowEpochSeconds) {
      return null;
    }

    if (typeof payload.iat !== 'number' || payload.iat > nowEpochSeconds + 300) {
      return null;
    }

    return {
      header,
      payload,
      signedContent: `${segments[0]}.${segments[1]}`,
      signatureBytes: Buffer.from(segments[2], 'base64url'),
    };
  } catch {
    return null;
  }
}

let cachedGoogleCerts: { certs: Record<string, string>; expiresAtMs: number } | null = null;

async function fetchGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAtMs > now) {
    return cachedGoogleCerts.certs;
  }
  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Google public certs: ${response.status}`);
  }
  const certs = (await response.json()) as Record<string, string>;
  // Cache for 1 hour
  cachedGoogleCerts = {
    certs,
    expiresAtMs: now + 60 * 60 * 1000,
  };
  return certs;
}

/**
 * Cryptographically verifies a Firebase Auth ID token (RS256 signature + claims)
 * against Google's X.509 public certificates for `securetoken@system.gserviceaccount.com`.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProjectId: string,
  primaryAdminEmail: string = 'creatergame31@gmail.com',
  customCertsForTesting?: Record<string, string>,
  nowEpochSeconds?: number
): Promise<VerifiedClientIdentity | null> {
  const decoded = decodeAndValidateJwtClaims(idToken, expectedProjectId, nowEpochSeconds);
  if (!decoded || !decoded.header.kid) {
    return null;
  }

  try {
    const certs = customCertsForTesting ?? (await fetchGoogleSecureTokenCerts());
    const certPem = certs[decoded.header.kid];
    if (!certPem) {
      return null;
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(decoded.signedContent);
    verifier.end();

    const isValidSig = verifier.verify(certPem, decoded.signatureBytes);
    if (!isValidSig) {
      return null;
    }

    const uid = String(decoded.payload.sub || decoded.payload.user_id);
    const email =
      typeof decoded.payload.email === 'string'
        ? decoded.payload.email.toLowerCase()
        : undefined;

    return {
      uid,
      email,
      isAdmin: email === primaryAdminEmail.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export interface SecurityGuardOptions {
  windowMs?: number;
  maxIpRequestsPerWindow?: number;
  defaultUserDailyQuotaUnits?: number;
  adminUserDailyQuotaUnits?: number;
  globalDailyQuotaUnits?: number;
  maxConcurrentLiveSessionsPerUser?: number;
  maxGlobalConcurrentLiveSessions?: number;
}

/**
 * Stateful Rate Limiter & Weighted Quota Governor for `/api/gemini/*` and `/live`.
 */
export class GeminiApiSecurityGovernor {
  private readonly windowMs: number;
  private readonly maxIpRequestsPerWindow: number;
  private readonly defaultUserDailyQuotaUnits: number;
  private readonly adminUserDailyQuotaUnits: number;
  private readonly globalDailyQuotaUnits: number;
  private readonly maxConcurrentLiveSessionsPerUser: number;
  private readonly maxGlobalConcurrentLiveSessions: number;

  private ipRequestTimestamps = new Map<string, number[]>();
  private userEndpointTimestamps = new Map<string, number[]>();
  private userDailyQuotaUsed = new Map<string, { dayKey: string; units: number }>();
  private globalDailyQuota = { dayKey: '', units: 0 };
  private activeLiveSessionsByUser = new Map<string, number>();
  private totalActiveLiveSessions = 0;

  constructor(options: SecurityGuardOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.maxIpRequestsPerWindow = options.maxIpRequestsPerWindow ?? 30;
    this.defaultUserDailyQuotaUnits = options.defaultUserDailyQuotaUnits ?? 250;
    this.adminUserDailyQuotaUnits = options.adminUserDailyQuotaUnits ?? 1000;
    this.globalDailyQuotaUnits = options.globalDailyQuotaUnits ?? 5000;
    this.maxConcurrentLiveSessionsPerUser = options.maxConcurrentLiveSessionsPerUser ?? 1;
    this.maxGlobalConcurrentLiveSessions = options.maxGlobalConcurrentLiveSessions ?? 5;
  }

  private getDayKey(nowMs: number): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  private pruneWindow(timestamps: number[], nowMs: number): number[] {
    const cutoff = nowMs - this.windowMs;
    return timestamps.filter((t) => t > cutoff);
  }

  /**
   * Evaluates IP rate limits, authentication status, per-endpoint rate limits, and daily weighted quotas.
   */
  public checkAndConsumeQuota(params: {
    ip: string;
    endpoint: string;
    identity: VerifiedClientIdentity | null;
    nowMs?: number;
  }): RateLimitAndQuotaDecision {
    const nowMs = params.nowMs ?? Date.now();
    const ipKey = params.ip || 'unknown_ip';

    // 1. Per-IP sliding-window rate limit (protects even before auth or during floods)
    const ipHistory = this.pruneWindow(this.ipRequestTimestamps.get(ipKey) || [], nowMs);
    if (ipHistory.length >= this.maxIpRequestsPerWindow) {
      this.ipRequestTimestamps.set(ipKey, ipHistory);
      return {
        allowed: false,
        statusCode: 429,
        errorCode: 'IP_RATE_LIMIT_EXCEEDED',
        publicMessage: 'Too many requests from this network address. Please wait 60 seconds and try again.',
        remainingRequestsInWindow: 0,
        remainingDailyQuotaUnits: 0,
        retryAfterSeconds: 60,
      };
    }
    ipHistory.push(nowMs);
    this.ipRequestTimestamps.set(ipKey, ipHistory);

    // 2. Authentication requirement
    if (!params.identity) {
      return {
        allowed: false,
        statusCode: 401,
        errorCode: 'UNAUTHENTICATED',
        publicMessage: 'Authentication required. Please sign in with Google to access Gemini Studio APIs.',
        remainingRequestsInWindow: Math.max(0, this.maxIpRequestsPerWindow - ipHistory.length),
        remainingDailyQuotaUnits: 0,
      };
    }

    const policy = ENDPOINT_POLICIES[params.endpoint] || {
      category: 'CHAT_AND_GROUNDING',
      costUnits: 2,
      maxRequestsPerMinute: 10,
      maxPromptLength: 2000,
    };

    // 3. Per-user, per-endpoint sliding-window rate limit
    const userEndpointKey = `${params.identity.uid}:${params.endpoint}`;
    const userHistory = this.pruneWindow(
      this.userEndpointTimestamps.get(userEndpointKey) || [],
      nowMs
    );
    if (userHistory.length >= policy.maxRequestsPerMinute) {
      this.userEndpointTimestamps.set(userEndpointKey, userHistory);
      return {
        allowed: false,
        statusCode: 429,
        errorCode: 'USER_ENDPOINT_RATE_LIMIT',
        publicMessage: `Rate limit reached for ${params.endpoint} (max ${policy.maxRequestsPerMinute} requests/min). Please wait before retrying.`,
        remainingRequestsInWindow: 0,
        remainingDailyQuotaUnits: this.getRemainingUserQuota(params.identity, nowMs),
        retryAfterSeconds: 60,
      };
    }

    // 4. Daily weighted quota check (user + global)
    const dayKey = this.getDayKey(nowMs);
    if (this.globalDailyQuota.dayKey !== dayKey) {
      this.globalDailyQuota = { dayKey, units: 0 };
    }

    const userMaxDaily = params.identity.isAdmin
      ? this.adminUserDailyQuotaUnits
      : this.defaultUserDailyQuotaUnits;

    const currentUserQuota = this.userDailyQuotaUsed.get(params.identity.uid);
    const usedUnits =
      currentUserQuota && currentUserQuota.dayKey === dayKey ? currentUserQuota.units : 0;

    if (
      usedUnits + policy.costUnits > userMaxDaily ||
      this.globalDailyQuota.units + policy.costUnits > this.globalDailyQuotaUnits
    ) {
      return {
        allowed: false,
        statusCode: 429,
        errorCode: 'DAILY_QUOTA_EXCEEDED',
        publicMessage: 'Daily AI Studio request quota reached for your account. Quota resets at 00:00 UTC.',
        remainingRequestsInWindow: Math.max(0, policy.maxRequestsPerMinute - userHistory.length),
        remainingDailyQuotaUnits: Math.max(0, userMaxDaily - usedUnits),
        retryAfterSeconds: 3600,
      };
    }

    // Consume rate-limit slot and quota units
    userHistory.push(nowMs);
    this.userEndpointTimestamps.set(userEndpointKey, userHistory);

    const newUsedUnits = usedUnits + policy.costUnits;
    this.userDailyQuotaUsed.set(params.identity.uid, {
      dayKey,
      units: newUsedUnits,
    });
    this.globalDailyQuota.units += policy.costUnits;

    return {
      allowed: true,
      statusCode: 200,
      errorCode: 'OK',
      publicMessage: 'Allowed',
      remainingRequestsInWindow: Math.max(0, policy.maxRequestsPerMinute - userHistory.length),
      remainingDailyQuotaUnits: Math.max(0, userMaxDaily - newUsedUnits),
    };
  }

  public getRemainingUserQuota(
    identity: VerifiedClientIdentity,
    nowMs: number = Date.now()
  ): number {
    const dayKey = this.getDayKey(nowMs);
    const userMaxDaily = identity.isAdmin
      ? this.adminUserDailyQuotaUnits
      : this.defaultUserDailyQuotaUnits;
    const current = this.userDailyQuotaUsed.get(identity.uid);
    const used = current && current.dayKey === dayKey ? current.units : 0;
    return Math.max(0, userMaxDaily - used);
  }

  /**
   * Acquires a `/live` WebSocket session slot for an authenticated user.
   */
  public acquireLiveWebSocketSlot(uid: string): { allowed: boolean; reason?: string } {
    const currentForUser = this.activeLiveSessionsByUser.get(uid) || 0;
    if (currentForUser >= this.maxConcurrentLiveSessionsPerUser) {
      return {
        allowed: false,
        reason: 'Maximum concurrent Live Voice sessions (1) already active for your account.',
      };
    }
    if (this.totalActiveLiveSessions >= this.maxGlobalConcurrentLiveSessions) {
      return {
        allowed: false,
        reason: 'Server Live Voice capacity reached. Please try again shortly.',
      };
    }
    this.activeLiveSessionsByUser.set(uid, currentForUser + 1);
    this.totalActiveLiveSessions += 1;
    return { allowed: true };
  }

  public releaseLiveWebSocketSlot(uid: string): void {
    const currentForUser = this.activeLiveSessionsByUser.get(uid) || 0;
    if (currentForUser <= 1) {
      this.activeLiveSessionsByUser.delete(uid);
    } else {
      this.activeLiveSessionsByUser.set(uid, currentForUser - 1);
    }
    this.totalActiveLiveSessions = Math.max(0, this.totalActiveLiveSessions - 1);
  }
}

/**
 * Bounds and normalizes prompt strings so oversized prompts cannot inflate token billing.
 */
export function clampPromptText(
  rawPrompt: unknown,
  fallback: string,
  maxLength: number = 2000
): string {
  const str = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
  if (!str) return fallback;
  return str.slice(0, maxLength);
}
