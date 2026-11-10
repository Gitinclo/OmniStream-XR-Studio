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
  HardwareTelemetryHud,
  formatHardwareTelemetryMetrics,
} from '../ui/HardwareTelemetryHud';

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

import {
  SUBSCRIPTION_PLANS,
  computeAnnualSavingsPercent,
  computeEffectiveMonthlyPriceUsd,
  computePlanPeriodPriceUsd,
  buildSubscriptionCheckoutResult,
} from './subscriptionEngine';

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

test('RealmeHardwareGovernor & HardwareTelemetryHud manage Frame Rate, Memory Usage, and GPU Temperature', async () => {
  const gov = new RealmeHardwareGovernor();

  // Default: AUTO_90HZ_THERMAL_GUARD + NOMINAL thermal => 90 FPS (11.1ms budget), ~36.8°C GPU @ 955MHz
  let snap = gov.getSnapshot();
  assert.equal(snap.targetFps, 90);
  assert.equal(snap.frameBudgetMs, 11.1);
  assert.equal(snap.pixelRatioScale, 1.0);
  assert.equal(snap.currentFps > 85, true);
  assert.equal(snap.onePercentLowFps > 75, true);
  assert.equal(snap.recentFrameTimesMs.length, 24);
  assert.equal(snap.totalRamMb, 4096);
  assert.equal(snap.usedRamMb + snap.availableRamMb, 4096);
  assert.equal(snap.memoryUsagePercent > 50 && snap.memoryUsagePercent < 90, true);
  assert.equal(snap.gpuClockMhz, 955);
  assert.equal(snap.gpuTempCelsius >= 35 && snap.gpuTempCelsius < 40, true);

  // Setting GPU temperature to 46.5°C triggers MODERATE thermal and drops refresh to 60Hz (720MHz GPU clock)
  snap = gov.setGpuTemperatureCelsius(46.5);
  assert.equal(snap.thermalLevel, ThermalStatusLevel.MODERATE);
  assert.equal(snap.targetFps, 60);
  assert.equal(snap.frameBudgetMs, 16.6);
  assert.equal(snap.gpuClockMhz, 720);

  // Setting GPU temperature to 52.0°C triggers CRITICAL thermal, 0.67x 720p scale, 550MHz clock, and auto RAM trim
  const beforeCriticalAvailRam = snap.availableRamMb;
  snap = gov.setGpuTemperatureCelsius(52.0);
  assert.equal(snap.thermalLevel, ThermalStatusLevel.CRITICAL);
  assert.equal(snap.pixelRatioScale, 0.67);
  assert.equal(snap.gpuClockMhz, 550);
  assert.equal(snap.availableRamMb > beforeCriticalAvailRam, true);
  assert.equal(snap.lastMemoryTrimSavedMb > 0, true);

  // LOCKED_90HZ keeps 90 FPS even when thermal is MODERATE
  gov.setThermalStatusLevel(ThermalStatusLevel.MODERATE);
  snap = gov.setRefreshRateMode(RefreshRateMode.LOCKED_90HZ);
  assert.equal(snap.targetFps, 90);
  assert.equal(snap.frameBudgetMs, 11.1);

  // SAVER_720P_SCALE sets pixelRatioScale to 0.67
  snap = gov.setGpuRenderScaleMode(GpuRenderScaleMode.SAVER_720P_SCALE);
  assert.equal(snap.pixelRatioScale, 0.67);

  // Verify HardwareTelemetryHud formatting and component rendering
  const formatted = formatHardwareTelemetryMetrics(snap);
  assert.equal(formatted.fpsHeadline.includes('FPS'), true);
  assert.equal(formatted.ramHeadline.includes('4096 MB'), true);
  assert.equal(formatted.gpuTempHeadline.includes('°C'), true);

  const pillHtml = HardwareTelemetryHud.renderHeaderTelemetryPill(snap);
  assert.equal(pillHtml.includes('FPS'), true);
  assert.equal(pillHtml.includes('RAM'), true);
  assert.equal(pillHtml.includes('GPU'), true);

  const expandedHudHtml = HardwareTelemetryHud.renderFloatingTelemetryHud(snap, false);
  assert.equal(expandedHudHtml.includes('HARDWARE TELEMETRY HUD'), true);
  assert.equal(expandedHudHtml.includes('4GB LPDDR4X Memory'), true);
  assert.equal(expandedHudHtml.includes('Mali-G57 GPU Temp'), true);

  const collapsedHudHtml = HardwareTelemetryHud.renderFloatingTelemetryHud(snap, true);
  assert.equal(collapsedHudHtml.includes('floating-compact'), true);

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

  // Server-side entitlement authority: regular users default to isPremium=false and cannot self-grant
  const defaultEntitlement = gov.getUserEntitlement(userIdentity, now);
  assert.equal(defaultEntitlement.isPremium, false);
  assert.equal(defaultEntitlement.tier, 'STANDARD');
  assert.equal(defaultEntitlement.dailyQuotaUnits, 50);

  // Unauthenticated caller attempting to modify entitlements gets 401
  const unauthGrant = gov.setUserEntitlement({
    actor: null,
    targetUid: 'user_1',
    isPremium: true,
    nowMs: now,
  });
  assert.equal(unauthGrant.allowed, false);
  assert.equal(unauthGrant.statusCode, 401);

  // Regular user attempting to self-grant isPremium=true gets 403 ENTITLEMENT_ADMIN_REQUIRED
  const selfGrantAttempt = gov.setUserEntitlement({
    actor: userIdentity,
    targetUid: 'user_1',
    isPremium: true,
    nowMs: now,
  });
  assert.equal(selfGrantAttempt.allowed, false);
  assert.equal(selfGrantAttempt.statusCode, 403);
  assert.equal(selfGrantAttempt.errorCode, 'ENTITLEMENT_ADMIN_REQUIRED');

  // Verified Admin can grant and revoke premium status on the server
  const adminIdentity = {
    uid: 'uid_admin_master',
    email: 'creatergame31@gmail.com',
    isAdmin: true,
  };
  const adminGrant = gov.setUserEntitlement({
    actor: adminIdentity,
    targetUid: 'user_3',
    targetEmail: 'pro_creator@example.com',
    isPremium: true,
    nowMs: now,
  });
  assert.equal(adminGrant.allowed, true);
  assert.equal(adminGrant.statusCode, 200);
  assert.equal(adminGrant.record?.isPremium, true);
  assert.equal(adminGrant.record?.tier, 'PREMIUM_ENTERPRISE');
  assert.equal(adminGrant.record?.verifiedBy, 'SERVER_ENTITLEMENT_AUTHORITY');

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

test('Subscription & Billing Engine: 3-tier pricing, annual 20% savings, invoice ledger, and server entitlement/quota sync', () => {
  assert.equal(SUBSCRIPTION_PLANS.FREE_STANDARD.monthlyPriceUsd, 0);
  assert.equal(SUBSCRIPTION_PLANS.PRO_8K_CREATOR.monthlyPriceUsd, 19);
  assert.equal(SUBSCRIPTION_PLANS.STUDIO_32K_ENTERPRISE.monthlyPriceUsd, 49);

  // Annual pricing & ~20% savings
  assert.equal(computePlanPeriodPriceUsd('PRO_8K_CREATOR', 'ANNUAL'), 180);
  assert.equal(computeEffectiveMonthlyPriceUsd('PRO_8K_CREATOR', 'ANNUAL'), 15);
  assert.equal(computeAnnualSavingsPercent('PRO_8K_CREATOR') >= 20, true);

  assert.equal(computePlanPeriodPriceUsd('STUDIO_32K_ENTERPRISE', 'ANNUAL'), 468);
  assert.equal(computeEffectiveMonthlyPriceUsd('STUDIO_32K_ENTERPRISE', 'ANNUAL'), 39);
  assert.equal(computeAnnualSavingsPercent('STUDIO_32K_ENTERPRISE') >= 20, true);

  // Pure checkout builder
  const checkoutBuilt = buildSubscriptionCheckoutResult({
    ownerId: 'uid_sub_1',
    email: 'creator@omnistream.xr',
    planId: 'PRO_8K_CREATOR',
    billingCycle: 'ANNUAL',
    paymentMethodLast4: '8899',
    nowMs: 1_750_000_000_000,
  });
  assert.equal(checkoutBuilt.subscription.isPremium, true);
  assert.equal(checkoutBuilt.subscription.dailyQuotaUnits, 500);
  assert.equal(checkoutBuilt.subscription.maxStreamResolution, '8K');
  assert.equal(checkoutBuilt.invoice.amountUsd, 180);
  assert.equal(checkoutBuilt.invoice.status, 'PAID');
  assert.equal(checkoutBuilt.invoice.paymentMethodSummary, 'Visa •••• 8899');

  // Server Governor integration: subscribing updates entitlement & daily quota immediately
  const gov = new GeminiApiSecurityGovernor();
  const subscriber = {
    uid: 'uid_sub_live',
    email: 'studio@omnistream.xr',
    isAdmin: false,
  };

  // Default state is FREE_STANDARD (250 units/day, isPremium: false)
  const initial = gov.getUserSubscription(subscriber);
  assert.equal(initial.subscription.planId, 'FREE_STANDARD');
  assert.equal(initial.entitlement.isPremium, false);
  assert.equal(initial.remainingDailyQuotaUnits, 250);

  // Upgrade to STUDIO_32K_ENTERPRISE -> 1,000 units/day, isPremium: true
  const upgraded = gov.checkoutUserSubscription({
    identity: subscriber,
    planId: 'STUDIO_32K_ENTERPRISE',
    billingCycle: 'MONTHLY',
    paymentMethodLast4: '4242',
  });
  assert.equal(upgraded.allowed, true);
  assert.equal(upgraded.subscription?.planId, 'STUDIO_32K_ENTERPRISE');
  assert.equal(upgraded.entitlement?.isPremium, true);
  assert.equal(upgraded.entitlement?.dailyQuotaUnits, 1000);
  assert.equal(upgraded.remainingDailyQuotaUnits, 1000);

  // Cancel at period end preserves active premium benefits until period end
  const cancelAtEnd = gov.cancelUserSubscription({
    identity: subscriber,
    immediate: false,
  });
  assert.equal(cancelAtEnd.allowed, true);
  assert.equal(cancelAtEnd.subscription?.status, 'CANCELED_AT_PERIOD_END');
  assert.equal(cancelAtEnd.subscription?.cancelAtPeriodEnd, true);
  assert.equal(cancelAtEnd.entitlement?.isPremium, true);

  // Immediate downgrade resets to FREE_STANDARD (isPremium: false, 250 units/day)
  const immediateDowngrade = gov.cancelUserSubscription({
    identity: subscriber,
    immediate: true,
  });
  assert.equal(immediateDowngrade.allowed, true);
  assert.equal(immediateDowngrade.subscription?.planId, 'FREE_STANDARD');
  assert.equal(immediateDowngrade.entitlement?.isPremium, false);
  assert.equal(immediateDowngrade.entitlement?.dailyQuotaUnits, 250);
});


