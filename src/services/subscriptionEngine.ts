/**
 * OmniStream XR Studio — Subscription & Billing Domain Engine
 *
 * Pure, deterministic domain logic for subscription tiers, monthly/annual billing
 * cycles, server-governed entitlement mapping (`isPremium`, `dailyQuotaUnits`,
 * `maxStreamResolution`), proration/savings math, and invoice generation.
 */

export type SubscriptionPlanId =
  | 'FREE_STANDARD'
  | 'PRO_8K_CREATOR'
  | 'STUDIO_32K_ENTERPRISE';

export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'CANCELED_AT_PERIOD_END'
  | 'PAST_DUE';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  targetAudience: string;
  tagline: string;
  monthlyPriceUsd: number;
  annualMonthlyEquivalentUsd: number;
  annualTotalUsd: number;
  maxStreamResolution: '4K' | '8K' | '32K';
  dailyQuotaUnits: number;
  isPremiumAdFree: boolean;
  vaultCapacityKb: number;
  maxConcurrentLiveSessions: number;
  badge?: string;
  features: string[];
}

export interface SubscriptionInvoiceRecord {
  invoiceId: string;
  uid: string;
  planId: SubscriptionPlanId;
  planName: string;
  billingCycle: BillingCycle;
  amountUsd: number;
  currency: 'USD';
  status: 'PAID' | 'ZERO_DOLLAR';
  paymentMethodSummary: string;
  issuedAtIso: string;
  periodStartIso: string;
  periodEndIso: string;
}

export interface UserSubscriptionRecord {
  subscriptionId: string;
  ownerId: string;
  email?: string;
  planId: SubscriptionPlanId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  isPremium: boolean;
  maxStreamResolution: '4K' | '8K' | '32K';
  dailyQuotaUnits: number;
  priceUsdPerPeriod: number;
  paymentMethodLast4: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStartIso: string;
  currentPeriodEndIso: string;
  verifiedBy: 'SERVER_SUBSCRIPTION_AUTHORITY' | 'GUEST_PREVIEW_SANDBOX';
  updatedAtIso: string;
}

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanId,
  SubscriptionPlanDefinition
> = {
  FREE_STANDARD: {
    id: 'FREE_STANDARD',
    name: 'Standard Explorer',
    targetAudience: 'For individual viewers & 30-day spatial evaluators',
    tagline: 'Core 4K spatial playback, 3D Packet Runner rig, and starter Gemini Studio quota.',
    monthlyPriceUsd: 0,
    annualMonthlyEquivalentUsd: 0,
    annualTotalUsd: 0,
    maxStreamResolution: '4K',
    dailyQuotaUnits: 250,
    isPremiumAdFree: false,
    vaultCapacityKb: 16,
    maxConcurrentLiveSessions: 1,
    features: [
      'Up to 4K Studio (60fps) adaptive stream playback',
      '250 daily weighted Gemini AI Studio quota units',
      'Ad-supported stream hub (isPremium: false)',
      '16 KB AES-256-GCM encrypted vault payload limit',
      '1 concurrent Gemini 3.8 Live voice co-producer session',
      'Standard community moderation & support queue',
    ],
  },
  PRO_8K_CREATOR: {
    id: 'PRO_8K_CREATOR',
    name: 'Pro 8K Creator',
    targetAudience: 'For independent creators, streamers & spatial producers',
    tagline: 'Ad-free 8K 120fps streaming, doubled AI Studio quota, and full 64KB E2EE Vault.',
    monthlyPriceUsd: 19,
    annualMonthlyEquivalentUsd: 15,
    annualTotalUsd: 180,
    maxStreamResolution: '8K',
    dailyQuotaUnits: 500,
    isPremiumAdFree: true,
    vaultCapacityKb: 64,
    maxConcurrentLiveSessions: 2,
    badge: 'MOST POPULAR',
    features: [
      'Up to 8K Ultra HD (120fps) HDR spatial playback',
      '500 daily weighted Gemini AI Studio quota units (2x Standard)',
      'Verified Ad-Free Premium entitlement (isPremium: true)',
      'Background audio mode & offline encrypted stream caching',
      'Full 64 KB AES-256-GCM + AAD chunked stream vault',
      'Omni 1.1 Flash video generation & Lyria 3 soundtrack export',
    ],
  },
  STUDIO_32K_ENTERPRISE: {
    id: 'STUDIO_32K_ENTERPRISE',
    name: 'Studio 32K Enterprise',
    targetAudience: 'For broadcast studios, XR labs & multi-seat production teams',
    tagline: 'Uncompressed 32K Master ABR, 1,000 daily AI quota units, and priority GM/Admin SLA.',
    monthlyPriceUsd: 49,
    annualMonthlyEquivalentUsd: 39,
    annualTotalUsd: 468,
    maxStreamResolution: '32K',
    dailyQuotaUnits: 1000,
    isPremiumAdFree: true,
    vaultCapacityKb: 64,
    maxConcurrentLiveSessions: 5,
    badge: '32K MASTER SLA',
    features: [
      'Full 32K Master (Auto ABR) + 36-node Spatial CDN telemetry',
      '1,000 daily weighted Gemini AI Studio quota units (4x Standard)',
      'Verified Ad-Free Premium Enterprise entitlement (isPremium: true)',
      'Gemini 4 Argon High-Thinking + Multi-Speaker Broadcast TTS',
      'AlphaFold / RCSB PDB 3D molecular workbench export',
      'Priority GM & Admin escalation SLA (creatergame31@gmail.com)',
    ],
  },
};

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlanId[] = [
  'FREE_STANDARD',
  'PRO_8K_CREATOR',
  'STUDIO_32K_ENTERPRISE',
];

export function isValidSubscriptionPlanId(
  value: unknown
): value is SubscriptionPlanId {
  return (
    value === 'FREE_STANDARD' ||
    value === 'PRO_8K_CREATOR' ||
    value === 'STUDIO_32K_ENTERPRISE'
  );
}

export function isValidBillingCycle(value: unknown): value is BillingCycle {
  return value === 'MONTHLY' || value === 'ANNUAL';
}

export function getSubscriptionPlan(
  planId: SubscriptionPlanId | string
): SubscriptionPlanDefinition {
  if (isValidSubscriptionPlanId(planId)) {
    return SUBSCRIPTION_PLANS[planId];
  }
  return SUBSCRIPTION_PLANS.FREE_STANDARD;
}

export function computePlanPeriodPriceUsd(
  planId: SubscriptionPlanId,
  billingCycle: BillingCycle
): number {
  const plan = SUBSCRIPTION_PLANS[planId];
  return billingCycle === 'ANNUAL' ? plan.annualTotalUsd : plan.monthlyPriceUsd;
}

export function computeEffectiveMonthlyPriceUsd(
  planId: SubscriptionPlanId,
  billingCycle: BillingCycle
): number {
  const plan = SUBSCRIPTION_PLANS[planId];
  return billingCycle === 'ANNUAL'
    ? plan.annualMonthlyEquivalentUsd
    : plan.monthlyPriceUsd;
}

export function computeAnnualSavingsPercent(
  planId: SubscriptionPlanId
): number {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (plan.monthlyPriceUsd <= 0) return 0;
  const fullYearMonthly = plan.monthlyPriceUsd * 12;
  const saved = fullYearMonthly - plan.annualTotalUsd;
  return Math.round((saved / fullYearMonthly) * 100);
}

export function calculateBillingPeriodBounds(
  nowMs: number,
  billingCycle: BillingCycle
): { startIso: string; endIso: string } {
  const startIso = new Date(nowMs).toISOString();
  const durationDays = billingCycle === 'ANNUAL' ? 365 : 30;
  const endIso = new Date(
    nowMs + durationDays * 24 * 60 * 60 * 1000
  ).toISOString();
  return { startIso, endIso };
}

export function sanitizePaymentLast4(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return '4242';
}

export function createDefaultFreeSubscription(
  ownerId: string,
  email?: string,
  isAdmin: boolean = false,
  nowMs: number = Date.now()
): UserSubscriptionRecord {
  const cleanOwnerId = String(ownerId || 'anonymous')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  const planId: SubscriptionPlanId = isAdmin
    ? 'STUDIO_32K_ENTERPRISE'
    : 'FREE_STANDARD';
  const plan = SUBSCRIPTION_PLANS[planId];
  const bounds = calculateBillingPeriodBounds(nowMs, 'ANNUAL');

  return {
    subscriptionId: `sub_${cleanOwnerId}`,
    ownerId: cleanOwnerId,
    email,
    planId,
    billingCycle: isAdmin ? 'ANNUAL' : 'MONTHLY',
    status: 'ACTIVE',
    isPremium: plan.isPremiumAdFree,
    maxStreamResolution: plan.maxStreamResolution,
    dailyQuotaUnits: plan.dailyQuotaUnits,
    priceUsdPerPeriod: 0,
    paymentMethodLast4: isAdmin ? '0000' : 'NONE',
    cancelAtPeriodEnd: false,
    currentPeriodStartIso: bounds.startIso,
    currentPeriodEndIso: bounds.endIso,
    verifiedBy: 'SERVER_SUBSCRIPTION_AUTHORITY',
    updatedAtIso: bounds.startIso,
  };
}

export function buildSubscriptionCheckoutResult(params: {
  ownerId: string;
  email?: string;
  planId: SubscriptionPlanId;
  billingCycle: BillingCycle;
  paymentMethodLast4?: string;
  verifiedBy?: 'SERVER_SUBSCRIPTION_AUTHORITY' | 'GUEST_PREVIEW_SANDBOX';
  nowMs?: number;
}): {
  subscription: UserSubscriptionRecord;
  invoice: SubscriptionInvoiceRecord;
} {
  const nowMs = params.nowMs ?? Date.now();
  const cleanOwnerId = String(params.ownerId || 'anonymous')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  const plan = SUBSCRIPTION_PLANS[params.planId];
  const bounds = calculateBillingPeriodBounds(nowMs, params.billingCycle);
  const amountUsd = computePlanPeriodPriceUsd(
    params.planId,
    params.billingCycle
  );
  const last4 =
    params.planId === 'FREE_STANDARD'
      ? 'NONE'
      : sanitizePaymentLast4(params.paymentMethodLast4);

  const subscription: UserSubscriptionRecord = {
    subscriptionId: `sub_${cleanOwnerId}`,
    ownerId: cleanOwnerId,
    email: params.email,
    planId: params.planId,
    billingCycle: params.billingCycle,
    status: 'ACTIVE',
    isPremium: plan.isPremiumAdFree,
    maxStreamResolution: plan.maxStreamResolution,
    dailyQuotaUnits: plan.dailyQuotaUnits,
    priceUsdPerPeriod: amountUsd,
    paymentMethodLast4: last4,
    cancelAtPeriodEnd: false,
    currentPeriodStartIso: bounds.startIso,
    currentPeriodEndIso: bounds.endIso,
    verifiedBy: params.verifiedBy ?? 'SERVER_SUBSCRIPTION_AUTHORITY',
    updatedAtIso: bounds.startIso,
  };

  const invoice: SubscriptionInvoiceRecord = {
    invoiceId: `inv_${nowMs}_${cleanOwnerId.slice(0, 8)}`,
    uid: cleanOwnerId,
    planId: params.planId,
    planName: plan.name,
    billingCycle: params.billingCycle,
    amountUsd,
    currency: 'USD',
    status: amountUsd > 0 ? 'PAID' : 'ZERO_DOLLAR',
    paymentMethodSummary:
      amountUsd > 0 ? `Visa •••• ${last4}` : 'Standard Free Tier ($0.00)',
    issuedAtIso: bounds.startIso,
    periodStartIso: bounds.startIso,
    periodEndIso: bounds.endIso,
  };

  return { subscription, invoice };
}
