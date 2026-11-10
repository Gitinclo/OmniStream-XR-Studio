import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  buildCanonicalAadContext,
  encryptAes256GcmWithAad,
  decryptAes256GcmWithAad,
  encryptChunkedStreamAes256Gcm,
  decryptChunkedStreamAes256Gcm,
  GCM_IV_BYTE_LENGTH,
  GCM_TAG_BYTE_LENGTH,
  base64UrlToBytes,
} from './cryptoAes256';

import {
  RealmeHardwareGovernor,
  RefreshRateMode,
  GpuRenderScaleMode,
  ThermalStatusLevel,
} from './hardwareGovernor';

import {
  InputBoundsValidator,
  NicheKey,
  NICHE_CATALOG,
  PipelineStage,
  getNextPipelineStage,
  generateAllSixPitchScripts,
  evaluateGuestLifecycleAt,
} from './vibePitchEngine';

import {
  VIBE_CODING_100_GUARDRAILS,
  COMPLIANCE_DOCS_CATALOG,
  filterGuardrails,
} from './complianceAndGuardrails';

import {
  extractBearerOrQueryToken,
  verifyFirebaseIdToken,
  GeminiApiSecurityGovernor,
  sanitizeServerError,
  redactSensitiveErrorDetails,
  clampPromptText,
} from './serverSecurityGuard';

test('AES-256-GCM + AAD encrypts and decrypts with unique 12B IV and rejects tampered AAD', async () => {
  const aad = buildCanonicalAadContext('creatergame31@gmail.com', 'vault_rec_01');
  assert.equal(aad, 'user_id:creatergame31@gmail.com|record_id:vault_rec_01');

  const secret = 'omnistream-master-key-2026';
  const plaintext = 'Confidential 32K Spatial Master Key & HIPAA Consent Log';

  const env1 = await encryptAes256GcmWithAad(plaintext, secret, aad);
  const env2 = await encryptAes256GcmWithAad(plaintext, secret, aad);

  // Every encryption call must generate a unique 12-byte (24 hex chars) CSPRNG IV
  assert.equal(env1.ivHex.length, GCM_IV_BYTE_LENGTH * 2);
  assert.equal(env1.authTagHex.length, GCM_TAG_BYTE_LENGTH * 2);
  assert.notEqual(env1.ivHex, env2.ivHex);
  assert.notEqual(env1.packedBase64Url, env2.packedBase64Url);

  // Packed bytes = 12B IV + 16B Tag + Ciphertext
  const rawPacked = base64UrlToBytes(env1.packedBase64Url);
  assert.equal(
    rawPacked.byteLength,
    GCM_IV_BYTE_LENGTH + GCM_TAG_BYTE_LENGTH + env1.ciphertextByteLength
  );

  // Valid AAD decrypts cleanly
  const decrypted = await decryptAes256GcmWithAad(env1.packedBase64Url, secret, aad);
  assert.equal(decrypted, plaintext);

  // Tampered AAD (e.g. transplanted to another user or record) must throw AEADBadTagException
  const tamperedAad = buildCanonicalAadContext('attacker@evil.example', 'vault_rec_01');
  await assert.rejects(
    async () => {
      await decryptAes256GcmWithAad(env1.packedBase64Url, secret, tamperedAad);
    },
    /AEADBadTagException/
  );
});

test('AES-256-GCM 64KB chunked streaming encrypts and reassembles multi-chunk payloads', async () => {
  const aad = buildCanonicalAadContext('creatergame31@gmail.com', 'stream_manifest_32k');
  const secret = 'stream-chunk-secret-256';
  const payload = 'OMNISTREAM-32K-BLOCK-'.repeat(40); // ~840 bytes, split with 256B test chunk size

  const streamEncrypted = await encryptChunkedStreamAes256Gcm(payload, secret, aad, 256);
  assert.equal(streamEncrypted.chunkCount >= 4, true);

  const restored = await decryptChunkedStreamAes256Gcm(streamEncrypted, secret, aad);
  assert.equal(restored, payload);

  // Reordering chunks must fail counter-bound AAD verification
  const reordered = {
    ...streamEncrypted,
    chunksBase64Url: [...streamEncrypted.chunksBase64Url].reverse(),
  };
  await assert.rejects(
    async () => {
      await decryptChunkedStreamAes256Gcm(reordered, secret, aad);
    },
    /AEADBadTagException/
  );
});

test('RealmeHardwareGovernor manages 90Hz/60Hz frame budgets, thermal fallback, 720p scale, and 4GB RAM trim', async () => {
  const gov = new RealmeHardwareGovernor();

  // Default: AUTO_90HZ_THERMAL_GUARD + NOMINAL thermal => 90 FPS (11.1ms budget)
  let snap = gov.getSnapshot();
  assert.equal(snap.targetFps, 90);
  assert.equal(snap.frameBudgetMs, 11.1);
  assert.equal(snap.pixelRatioScale, 1.0);

  // MODERATE thermal in AUTO_90HZ_THERMAL_GUARD drops to 60 FPS (16.6ms budget)
  snap = gov.setThermalStatusLevel(ThermalStatusLevel.MODERATE);
  assert.equal(snap.targetFps, 60);
  assert.equal(snap.frameBudgetMs, 16.6);

  // LOCKED_90HZ keeps 90 FPS even when thermal is MODERATE
  snap = gov.setRefreshRateMode(RefreshRateMode.LOCKED_90HZ);
  assert.equal(snap.targetFps, 90);
  assert.equal(snap.frameBudgetMs, 11.1);

  // SAVER_720P_SCALE sets pixelRatioScale to 0.67
  snap = gov.setGpuRenderScaleMode(GpuRenderScaleMode.SAVER_720P_SCALE);
  assert.equal(snap.pixelRatioScale, 0.67);

  // 4GB LPDDR4X memory trim frees cached MBs
  const beforeAvail = snap.availableRamMb;
  const trimmed = gov.performMemoryTrim(80);
  assert.equal(trimmed.availableRamMb > beforeAvail, true);
  assert.equal(trimmed.lastMemoryTrimSavedMb > 0, true);

  // UFS 2.1 sequential queue executes tasks in order
  const order: number[] = [];
  await Promise.all([
    gov.enqueueSequentialUfsIo(() => order.push(1)),
    gov.enqueueSequentialUfsIo(() => order.push(2)),
  ]);
  assert.deepEqual(order, [1, 2]);
});

test('InputBoundsValidator, 7-Niche Catalog, 6-Script Generator, and 30-Day Guest Lifecycle', () => {
  assert.equal(NICHE_CATALOG.length, 7);

  // Clamping numeric bounds
  assert.equal(InputBoundsValidator.clampDepositPercent(-15), 0);
  assert.equal(InputBoundsValidator.clampDepositPercent(145), 100);
  assert.equal(InputBoundsValidator.clampSetupFeeOffer(999999), 50000);
  assert.equal(InputBoundsValidator.clampMonthlyRetainerOffer(12000), 5000);

  // Truncating string bounds
  const longText = 'X'.repeat(600);
  const norm = InputBoundsValidator.normalizeProspectInput(longText, longText, longText);
  assert.equal(norm.businessName.length, 100);
  assert.equal(norm.contactName.length, 100);
  assert.equal(norm.websiteGapNote.length, 300);

  // PipelineStage transitions
  assert.equal(getNextPipelineStage(PipelineStage.PROSPECT), PipelineStage.PITCHED);
  assert.equal(getNextPipelineStage(PipelineStage.PITCHED), PipelineStage.DEPOSIT_PAID);
  assert.equal(getNextPipelineStage(PipelineStage.DEPOSIT_PAID), PipelineStage.DELIVERED);
  assert.equal(getNextPipelineStage(PipelineStage.DELIVERED), PipelineStage.RETAINER_ACTIVE);

  // 6-Script bundle generation
  const scripts = generateAllSixPitchScripts({
    niche: NicheKey.HOME_TRADES,
    businessName: 'Apex HVAC & Plumbing',
    contactName: 'Jordan Vance',
    websiteGapNote: 'No mobile click-to-call button on emergency landing page',
    setupFeeOffer: 600,
    monthlyRetainerOffer: 75,
    depositPercent: 50,
  });
  assert.equal(scripts.length, 6);
  assert.equal(scripts[0].bodyText.includes('Apex HVAC & Plumbing'), true);
  assert.equal(scripts[0].bodyText.includes('$300 deposit'), true);

  // 30-Day Guest Lifecycle evaluation
  const day0 = 1_700_000_000_000;
  const msPerDay = 24 * 60 * 60 * 1000;
  assert.equal(evaluateGuestLifecycleAt(day0, day0 + 4 * msPerDay).state, 'ACTIVE_TRIAL');
  assert.equal(evaluateGuestLifecycleAt(day0, day0 + 22 * msPerDay).state, 'SOFT_PROMPT_WINDOW');
  const expired = evaluateGuestLifecycleAt(day0, day0 + 32 * msPerDay);
  assert.equal(expired.state, 'EXPIRED_REQUIRES_AUTH');
  assert.equal(expired.requiresAuthGate, true);
});

test('100 Vibe Coding Agent Guardrails and 8 Compliance Documents completeness', () => {
  assert.equal(VIBE_CODING_100_GUARDRAILS.length, 100);
  assert.equal(VIBE_CODING_100_GUARDRAILS[0].id, 1);
  assert.equal(VIBE_CODING_100_GUARDRAILS[99].id, 100);

  const secRules = filterGuardrails('CAT_5_SECURITY_AUTH', '');
  assert.equal(secRules.length, 10);

  const aesMatches = filterGuardrails('ALL', 'AES-256-GCM');
  assert.equal(aesMatches.length >= 1, true);

  assert.equal(COMPLIANCE_DOCS_CATALOG.length, 8);
  const filenames = COMPLIANCE_DOCS_CATALOG.map((d) => d.filename);
  assert.deepEqual(filenames, [
    'README.md',
    'SECURITY.md',
    'PRIVACY.md',
    'TERMS_AND_CONDITIONS.md',
    'ACCOUNT.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'ROADMAP.md',
  ]);
});

test('serverSecurityGuard: RS256 Firebase JWT verification, audience/issuer/expiry checks, and token extraction', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const projectId = 'gen-lang-client-0029274497';
  const nowSec = 1_750_000_000;

  const signJwt = (header: Record<string, unknown>, payload: Record<string, unknown>) => {
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${h}.${p}`);
    signer.end();
    const sig = signer.sign(privateKey).toString('base64url');
    return `${h}.${p}.${sig}`;
  };

  const validToken = signJwt(
    { alg: 'RS256', kid: 'key_2026_1' },
    {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'uid_creator_31',
      email: 'creatergame31@gmail.com',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    }
  );

  // Extract from Authorization header or WebSocket URL query `?token=...`
  assert.equal(extractBearerOrQueryToken(`Bearer ${validToken}`, undefined), validToken);
  assert.equal(extractBearerOrQueryToken(undefined, `/live?token=${encodeURIComponent(validToken)}`), validToken);
  assert.equal(extractBearerOrQueryToken('Basic abc', undefined), null);

  // Valid token passes cryptographic verification and detects admin role
  const verified = await verifyFirebaseIdToken(
    validToken,
    projectId,
    'creatergame31@gmail.com',
    { key_2026_1: publicKey },
    nowSec
  );
  assert.notEqual(verified, null);
  assert.equal(verified?.uid, 'uid_creator_31');
  assert.equal(verified?.email, 'creatergame31@gmail.com');
  assert.equal(verified?.isAdmin, true);

  // Missing/empty token rejected (returns null)
  const missing = await verifyFirebaseIdToken(
    '',
    projectId,
    'creatergame31@gmail.com',
    { key_2026_1: publicKey },
    nowSec
  );
  assert.equal(missing, null);

  // Expired token rejected
  const expired = await verifyFirebaseIdToken(
    validToken,
    projectId,
    'creatergame31@gmail.com',
    { key_2026_1: publicKey },
    nowSec + 7200
  );
  assert.equal(expired, null);

  // Wrong audience rejected
  const wrongAud = await verifyFirebaseIdToken(
    validToken,
    'another-project-id',
    'creatergame31@gmail.com',
    { key_2026_1: publicKey },
    nowSec
  );
  assert.equal(wrongAud, null);

  // Tampered payload fails RSA signature verification
  const parts = validToken.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'attacker_uid',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    })
  ).toString('base64url');
  const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  const forgedRes = await verifyFirebaseIdToken(
    forgedToken,
    projectId,
    'creatergame31@gmail.com',
    { key_2026_1: publicKey },
    nowSec
  );
  assert.equal(forgedRes, null);
});

test('serverSecurityGuard: rate limiting, weighted daily quotas, WebSocket concurrency, and error sanitization', () => {
  const gov = new GeminiApiSecurityGovernor({
    windowMs: 60_000,
    maxIpRequestsPerWindow: 20,
    defaultUserDailyQuotaUnits: 50,
    adminUserDailyQuotaUnits: 200,
    globalDailyQuotaUnits: 100,
    maxConcurrentLiveSessionsPerUser: 1,
    maxGlobalConcurrentLiveSessions: 2,
  });

  const now = 1_750_000_000_000;
  const userIdentity = { uid: 'user_1', email: 'viewer@example.com', isAdmin: false };

  // Unauthenticated request rejected with 401
  const unauth = gov.checkAndConsumeQuota({
    ip: '203.0.113.10',
    endpoint: '/api/gemini/chat',
    identity: null,
    nowMs: now,
  });
  assert.equal(unauth.allowed, false);
  assert.equal(unauth.statusCode, 401);
  assert.equal(unauth.errorCode, 'UNAUTHENTICATED');

  // Costly endpoint (/api/gemini/generate-video has maxRequestsPerMinute=2, costUnits=25)
  const r1 = gov.checkAndConsumeQuota({
    ip: '203.0.113.10',
    endpoint: '/api/gemini/generate-video',
    identity: userIdentity,
    nowMs: now + 100,
  });
  assert.equal(r1.allowed, true);
  assert.equal(r1.remainingDailyQuotaUnits, 25);

  const r2 = gov.checkAndConsumeQuota({
    ip: '203.0.113.10',
    endpoint: '/api/gemini/generate-video',
    identity: userIdentity,
    nowMs: now + 1000,
  });
  assert.equal(r2.allowed, true);
  assert.equal(r2.remainingDailyQuotaUnits, 0);

  // 3rd video generation in same 1-min window hits endpoint rate limit (429)
  const r3 = gov.checkAndConsumeQuota({
    ip: '203.0.113.10',
    endpoint: '/api/gemini/generate-video',
    identity: userIdentity,
    nowMs: now + 2000,
  });
  assert.equal(r3.allowed, false);
  assert.equal(r3.statusCode, 429);
  assert.equal(r3.errorCode, 'USER_ENDPOINT_RATE_LIMIT');

  // Even on another endpoint ('/api/gemini/chat'), user_1's daily quota (50 units) is now exhausted
  const r4 = gov.checkAndConsumeQuota({
    ip: '203.0.113.10',
    endpoint: '/api/gemini/chat',
    identity: userIdentity,
    nowMs: now + 3000,
  });
  assert.equal(r4.allowed, false);
  assert.equal(r4.statusCode, 429);
  assert.equal(r4.errorCode, 'DAILY_QUOTA_EXCEEDED');

  // Live WebSocket concurrency slots
  const ws1 = gov.acquireLiveWebSocketSlot('user_2');
  assert.equal(ws1.allowed, true);
  // Second concurrent connection for same user rejected
  const ws2 = gov.acquireLiveWebSocketSlot('user_2');
  assert.equal(ws2.allowed, false);

  // Releasing slot allows reconnecting
  gov.releaseLiveWebSocketSlot('user_2');
  const ws3 = gov.acquireLiveWebSocketSlot('user_2');
  assert.equal(ws3.allowed, true);
  gov.releaseLiveWebSocketSlot('user_2');

  // Error sanitization never leaks raw internal error message or API keys
  const internalErr = new Error(
    'GoogleGenAIError: failed request with key AIzaSyD1234567890abcdefghijklmnop and stack trace at /app/server.ts:95'
  );
  const sanitized = sanitizeServerError(internalErr, 'CHAT_ERROR');
  assert.equal(sanitized.code, 'CHAT_ERROR');
  assert.equal(sanitized.error.includes('AIzaSy'), false);
  assert.equal(sanitized.error.includes('/app/server.ts'), false);
  assert.equal(sanitized.requestId.startsWith('req_'), true);

  const redactedLog = redactSensitiveErrorDetails(internalErr.message);
  assert.equal(redactedLog.includes('AIzaSyD1234567890'), false);
  assert.equal(redactedLog.includes('[REDACTED_GOOGLE_API_KEY]'), true);

  assert.equal(clampPromptText('A'.repeat(5000), 'fallback', 100).length, 100);
});

