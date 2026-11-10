import test from 'node:test';
import assert from 'node:assert/strict';

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
