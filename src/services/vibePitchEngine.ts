/**
 * VibePitch Studio Engine:
 * - InputBoundsValidator (strict client-side + Firestore schema limits)
 * - 7-Niche Offer Catalog & Quote Calculator (HOME_TRADES, SALON_AND_CLEANERS, DENTAL_AND_TUTORS,
 *   AUTO_DETAILING, BOUTIQUE_FITNESS, ECOMMERCE_SHOPIFY, SAAS_AI_REMEDIATION)
 * - PipelineStage Sequential State Machine
 * - PitchScriptGenerator (6-Part Script Bundle)
 * - 30-Day Guest-to-Cloud Lifecycle Evaluator (Day 1–19 Active, Day 20–30 Soft Prompt, Day 31+ Hard Gate)
 */

export enum NicheKey {
  HOME_TRADES = 'HOME_TRADES',
  SALON_AND_CLEANERS = 'SALON_AND_CLEANERS',
  DENTAL_AND_TUTORS = 'DENTAL_AND_TUTORS',
  AUTO_DETAILING = 'AUTO_DETAILING',
  BOUTIQUE_FITNESS = 'BOUTIQUE_FITNESS',
  ECOMMERCE_SHOPIFY = 'ECOMMERCE_SHOPIFY',
  SAAS_AI_REMEDIATION = 'SAAS_AI_REMEDIATION',
}

export enum OfferArchetype {
  ONE_PAGE_LEAD_GEN = 'ONE_PAGE_LEAD_GEN',
  BOOKING_AND_GALLERY = 'BOOKING_AND_GALLERY',
  TRUST_AND_INTAKE_PORTAL = 'TRUST_AND_INTAKE_PORTAL',
  MOBILE_BOOKING_FUNNEL = 'MOBILE_BOOKING_FUNNEL',
  CLASS_SCHEDULE_MEMBERSHIP = 'CLASS_SCHEDULE_MEMBERSHIP',
  CONVERSION_STOREFRONT = 'CONVERSION_STOREFRONT',
  PRODUCTION_HARDENING_AUDIT = 'PRODUCTION_HARDENING_AUDIT',
}

export enum PipelineStage {
  PROSPECT = 'PROSPECT',
  PITCHED = 'PITCHED',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  DELIVERED = 'DELIVERED',
  RETAINER_ACTIVE = 'RETAINER_ACTIVE',
}

export enum PitchChannelType {
  IN_PERSON_SCRIPT = 'IN_PERSON_SCRIPT',
  COLD_CALL_SCRIPT = 'COLD_CALL_SCRIPT',
  TEXT_DM_OUTREACH = 'TEXT_DM_OUTREACH',
  EMAIL_FOLLOW_UP = 'EMAIL_FOLLOW_UP',
  OBJECTION_PLAYBOOK = 'OBJECTION_PLAYBOOK',
  SCOPE_GUARDRAIL_SUMMARY = 'SCOPE_GUARDRAIL_SUMMARY',
}

export interface ScopeGuardrailConfig {
  maxIncludedPages: number;
  maxRevisionRounds: number;
  depositPercent: number;
  estimatedDeliveryDays: number;
  excludesCustomBackend: boolean;
}

export interface NicheCatalogPreset {
  niche: NicheKey;
  title: string;
  subtitle: string;
  archetype: OfferArchetype;
  recommendedSetupFeeUsd: number;
  setupFeeRangeText: string;
  recommendedMonthlyRetainerUsd: number;
  retainerRangeText: string;
  primaryPainPoint: string;
  coreDeliverables: string[];
  defaultScopeGuardrail: ScopeGuardrailConfig;
}

export interface NormalizedProspectInput {
  businessName: string;
  contactName: string;
  websiteGapNote: string;
}

export interface NormalizedLeadFinancials {
  setupFeeOffer: number;
  monthlyRetainerOffer: number;
  depositPercent: number;
  depositAmountUsd: number;
  completionBalanceUsd: number;
  firstYearTotalValueUsd: number;
  notes: string;
}

export interface PitchScriptArtifact {
  channel: PitchChannelType;
  label: string;
  headline: string;
  bodyText: string;
}

export type GuestLifecycleStatus =
  | {
      state: 'ACTIVE_TRIAL';
      daysElapsed: number;
      daysRemaining: number;
      bannerText: string;
      requiresAuthGate: false;
    }
  | {
      state: 'SOFT_PROMPT_WINDOW';
      daysElapsed: number;
      daysRemaining: number;
      bannerText: string;
      requiresAuthGate: false;
    }
  | {
      state: 'EXPIRED_REQUIRES_AUTH';
      daysElapsed: number;
      daysRemaining: 0;
      bannerText: string;
      requiresAuthGate: true;
    };

/**
 * Exact Firestore & Client-Side InputBoundsValidator
 */
export const InputBoundsValidator = {
  MAX_BUSINESS_NAME_LEN: 100,
  MAX_CONTACT_NAME_LEN: 100,
  MAX_WEBSITE_GAP_NOTE_LEN: 300,
  MAX_TAGLINE_LEN: 150,
  MAX_NOTES_LEN: 500,
  MIN_SETUP_FEE_USD: 0,
  MAX_SETUP_FEE_USD: 50000,
  MIN_MONTHLY_RETAINER_USD: 0,
  MAX_MONTHLY_RETAINER_USD: 5000,
  MIN_DEPOSIT_PERCENT: 0,
  MAX_DEPOSIT_PERCENT: 100,

  clampDepositPercent(percent: number): number {
    if (!Number.isFinite(percent)) return 50;
    return Math.max(
      this.MIN_DEPOSIT_PERCENT,
      Math.min(this.MAX_DEPOSIT_PERCENT, Math.round(percent))
    );
  },

  clampSetupFeeOffer(amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    return Math.max(
      this.MIN_SETUP_FEE_USD,
      Math.min(this.MAX_SETUP_FEE_USD, Math.round(amount))
    );
  },

  clampMonthlyRetainerOffer(amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    return Math.max(
      this.MIN_MONTHLY_RETAINER_USD,
      Math.min(this.MAX_MONTHLY_RETAINER_USD, Math.round(amount))
    );
  },

  normalizeProspectInput(
    businessName: string,
    contactName: string,
    websiteGapNote: string
  ): NormalizedProspectInput {
    const cleanBiz = (businessName || '')
      .trim()
      .slice(0, this.MAX_BUSINESS_NAME_LEN);
    const cleanContact = (contactName || '')
      .trim()
      .slice(0, this.MAX_CONTACT_NAME_LEN);
    const cleanGap = (websiteGapNote || '')
      .trim()
      .slice(0, this.MAX_WEBSITE_GAP_NOTE_LEN);

    return {
      businessName: cleanBiz || 'Target Local Business',
      contactName: cleanContact || 'Owner / Decision Maker',
      websiteGapNote:
        cleanGap ||
        'No mobile-responsive click-to-call quote funnel or instant booking capture.',
    };
  },

  normalizeBusinessProfileTagline(tagline: string): string {
    return (tagline || '').trim().slice(0, this.MAX_TAGLINE_LEN);
  },

  normalizeLeadNotes(notes: string): string {
    return (notes || '').trim().slice(0, this.MAX_NOTES_LEN);
  },

  normalizeLeadFinancials(
    setupFeeOffer: number,
    monthlyRetainerOffer: number,
    depositPercent: number,
    notes: string = ''
  ): NormalizedLeadFinancials {
    const safeSetup = this.clampSetupFeeOffer(setupFeeOffer);
    const safeRetainer = this.clampMonthlyRetainerOffer(monthlyRetainerOffer);
    const safeDepositPct = this.clampDepositPercent(depositPercent);
    const depositAmountUsd = Math.round((safeSetup * safeDepositPct) / 100);
    const completionBalanceUsd = Math.max(0, safeSetup - depositAmountUsd);
    const firstYearTotalValueUsd = safeSetup + safeRetainer * 12;

    return {
      setupFeeOffer: safeSetup,
      monthlyRetainerOffer: safeRetainer,
      depositPercent: safeDepositPct,
      depositAmountUsd,
      completionBalanceUsd,
      firstYearTotalValueUsd,
      notes: this.normalizeLeadNotes(notes),
    };
  },
};

export const NICHE_CATALOG: NicheCatalogPreset[] = [
  {
    niche: NicheKey.HOME_TRADES,
    title: 'Home Trades (HVAC, Plumbing, Roofing, Landscaping)',
    subtitle: 'High-ticket emergency call & quote request capture',
    archetype: OfferArchetype.ONE_PAGE_LEAD_GEN,
    recommendedSetupFeeUsd: 550,
    setupFeeRangeText: '$400 – $750 Setup',
    recommendedMonthlyRetainerUsd: 65,
    retainerRangeText: '$49 – $99 / mo Hosting & Care',
    primaryPainPoint:
      'Missed emergency calls after-hours and slow desktop-only contact forms that lose high-margin jobs.',
    coreDeliverables: [
      'Sticky mobile Click-to-Call & 60-Second Instant Quote Estimator',
      'Service-area Geo-Trust badges & Before/After project gallery',
      'Automated SMS/Email lead alert routing',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 3,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 5,
      excludesCustomBackend: true,
    },
  },
  {
    niche: NicheKey.SALON_AND_CLEANERS,
    title: 'Salons, Barbershops & Dry Cleaners',
    subtitle: 'Visual lookbook & frictionless appointment booking',
    archetype: OfferArchetype.BOOKING_AND_GALLERY,
    recommendedSetupFeeUsd: 450,
    setupFeeRangeText: '$350 – $600 Setup',
    recommendedMonthlyRetainerUsd: 49,
    retainerRangeText: '$39 – $79 / mo Hosting & Care',
    primaryPainPoint:
      'Instagram DMs getting buried and clients dropping off when price menus require PDF zooming.',
    coreDeliverables: [
      'Mobile-first interactive Service & Tiered Pricing Menu',
      'Embedded 1-Tap Calendar/Square/Fresha Booking Integration',
      'High-speed visual transformation gallery & Google Review carousel',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 3,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 4,
      excludesCustomBackend: true,
    },
  },
  {
    niche: NicheKey.DENTAL_AND_TUTORS,
    title: 'Dental Clinics, Chiropractors & Private Tutors',
    subtitle: 'High-trust credentials & new-patient/student intake portal',
    archetype: OfferArchetype.TRUST_AND_INTAKE_PORTAL,
    recommendedSetupFeeUsd: 750,
    setupFeeRangeText: '$600 – $950 Setup',
    recommendedMonthlyRetainerUsd: 89,
    retainerRangeText: '$69 – $129 / mo Hosting & Care',
    primaryPainPoint:
      'Outdated 2016 brochure layout that erodes clinical/academic authority and forces phone tag.',
    coreDeliverables: [
      'Practitioner/Tutor Authority Profile & Credentials Showcase',
      'Structured New Patient / Student Assessment Intake Funnel',
      'FAQ Accordion & Local Search Schema.org Markup',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 4,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 6,
      excludesCustomBackend: true,
    },
  },
  {
    niche: NicheKey.AUTO_DETAILING,
    title: 'Mobile Auto Detailing, Ceramic Coating & Tint Shops',
    subtitle: 'Package tier configurator & deposit booking funnel',
    archetype: OfferArchetype.MOBILE_BOOKING_FUNNEL,
    recommendedSetupFeeUsd: 550,
    setupFeeRangeText: '$450 – $700 Setup',
    recommendedMonthlyRetainerUsd: 59,
    retainerRangeText: '$49 – $89 / mo Hosting & Care',
    primaryPainPoint:
      'No-show appointments and tire-kickers texting "how much for interior?" all day.',
    coreDeliverables: [
      'Vehicle Size (Sedan / SUV / Truck) Interactive Package Selector',
      'Before/After Paint Correction Slider & Ceramic Warranty Specs',
      'Deposit-backed Booking Calendar link to eliminate no-shows',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 3,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 5,
      excludesCustomBackend: true,
    },
  },
  {
    niche: NicheKey.BOUTIQUE_FITNESS,
    title: 'Boutique Fitness, Yoga, Pilates & Martial Arts Studios',
    subtitle: 'Class timetable & trial pass conversion engine',
    archetype: OfferArchetype.CLASS_SCHEDULE_MEMBERSHIP,
    recommendedSetupFeeUsd: 650,
    setupFeeRangeText: '$500 – $850 Setup',
    recommendedMonthlyRetainerUsd: 75,
    retainerRangeText: '$59 – $99 / mo Hosting & Care',
    primaryPainPoint:
      'New locals cannot find the weekly class schedule or claim an intro trial pass in under 3 clicks.',
    coreDeliverables: [
      'Filterable Weekly Class Schedule & Instructor Spotlights',
      '7-Day Intro Trial Pass / First-Class-Free Lead Capture',
      'Membership Tier Comparison & Studio Virtual Tour',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 4,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 5,
      excludesCustomBackend: true,
    },
  },
  {
    niche: NicheKey.ECOMMERCE_SHOPIFY,
    title: 'E-Commerce & Direct-to-Consumer (Shopify / Woo)',
    subtitle: 'High-converting product landing page & checkout speed optimization',
    archetype: OfferArchetype.CONVERSION_STOREFRONT,
    recommendedSetupFeeUsd: 1100,
    setupFeeRangeText: '$850 – $1,800 Setup',
    recommendedMonthlyRetainerUsd: 149,
    retainerRangeText: '$99 – $249 / mo CRO & Care',
    primaryPainPoint:
      'Bloated third-party scripts causing >4s mobile load times and 75%+ cart abandonment.',
    coreDeliverables: [
      'Sub-1.5s LCP Product Hero & Sticky Mobile Add-to-Cart Bar',
      'Bundle/Upsell Tier Selector & Verified UGC Review Matrix',
      'Script De-bloating & Core Web Vitals 90+ Optimization',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 5,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 7,
      excludesCustomBackend: true,
    },
  },
  {
    niche: NicheKey.SAAS_AI_REMEDIATION,
    title: 'Vibe-Coded SaaS & AI App Production Hardening',
    subtitle: 'Security audit, AES-256-GCM vault, RBAC rules & 90Hz optimization',
    archetype: OfferArchetype.PRODUCTION_HARDENING_AUDIT,
    recommendedSetupFeeUsd: 1650,
    setupFeeRangeText: '$1,200 – $3,500 Audit & Fix',
    recommendedMonthlyRetainerUsd: 249,
    retainerRangeText: '$199 – $499 / mo DevSecOps Retainer',
    primaryPainPoint:
      'AI-generated prototype works in demo mode but has open Firestore rules, unencrypted PII, or 4GB RAM OOM crashes.',
    coreDeliverables: [
      'Firestore RBAC Rules Hardening & InputBoundsValidator Enforcement',
      'AES-256-GCM + AAD Field Encryption & Zero-Leak Secret Proxy',
      '90Hz Frame Pacing & 100 Vibe Coding Guardrails Verification Suite',
    ],
    defaultScopeGuardrail: {
      maxIncludedPages: 5,
      maxRevisionRounds: 2,
      depositPercent: 50,
      estimatedDeliveryDays: 7,
      excludesCustomBackend: false,
    },
  },
];

export function getNichePreset(niche: NicheKey): NicheCatalogPreset {
  return NICHE_CATALOG.find((item) => item.niche === niche) || NICHE_CATALOG[0];
}

const PIPELINE_ORDER: PipelineStage[] = [
  PipelineStage.PROSPECT,
  PipelineStage.PITCHED,
  PipelineStage.DEPOSIT_PAID,
  PipelineStage.DELIVERED,
  PipelineStage.RETAINER_ACTIVE,
];

export function getNextPipelineStage(current: PipelineStage): PipelineStage {
  const idx = PIPELINE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PIPELINE_ORDER.length - 1) {
    return PipelineStage.RETAINER_ACTIVE;
  }
  return PIPELINE_ORDER[idx + 1];
}

export function generateAllSixPitchScripts(params: {
  niche: NicheKey;
  businessName: string;
  contactName: string;
  websiteGapNote: string;
  setupFeeOffer: number;
  monthlyRetainerOffer: number;
  depositPercent: number;
  consultantName?: string;
}): PitchScriptArtifact[] {
  const preset = getNichePreset(params.niche);
  const prospect = InputBoundsValidator.normalizeProspectInput(
    params.businessName,
    params.contactName,
    params.websiteGapNote
  );
  const financials = InputBoundsValidator.normalizeLeadFinancials(
    params.setupFeeOffer,
    params.monthlyRetainerOffer,
    params.depositPercent
  );
  const consultant = (params.consultantName || 'OmniStream VibePitch Studio').trim();
  const scope = preset.defaultScopeGuardrail;

  return [
    {
      channel: PitchChannelType.IN_PERSON_SCRIPT,
      label: '1. Walk-In / In-Person Demo Opener',
      headline: `60-Second Live Preview Pitch for ${prospect.businessName}`,
      bodyText: `Hi ${prospect.contactName}, I'm with ${consultant}. I noticed when searching for ${preset.title.split('(')[0].trim()} locally that ${prospect.businessName} had a quick gap: "${prospect.websiteGapNote}". Instead of just emailing you about it, I built a live interactive 90Hz mobile preview right here on my phone showing how customers can book or request a quote in 2 taps. Take a look—if you like it, we can have it live on your domain in ${scope.estimatedDeliveryDays} days for a flat $${financials.setupFeeOffer} setup ($${financials.depositAmountUsd} deposit to start, $${financials.completionBalanceUsd} on launch).`,
    },
    {
      channel: PitchChannelType.COLD_CALL_SCRIPT,
      label: '2. Warm Phone / Discovery Opener',
      headline: `Direct Value Call Script (${preset.niche})`,
      bodyText: `Hey ${prospect.contactName}, quick call regarding ${prospect.businessName}. We noticed "${prospect.websiteGapNote}" is costing mobile visitors who are ready to book. We already mocked up a dedicated ${preset.archetype.replace(/_/g, ' ')} prototype tailored for ${prospect.businessName}—including ${preset.coreDeliverables[0]}. Can I text you the private preview link right now so you can test it on your phone in 30 seconds?`,
    },
    {
      channel: PitchChannelType.TEXT_DM_OUTREACH,
      label: '3. SMS / Instagram DM 2-Tap Link',
      headline: `Short Mobile Message with Live Prototype Hook`,
      bodyText: `Hey ${prospect.contactName}! Built a fast mobile preview for ${prospect.businessName} to fix "${prospect.websiteGapNote}" and add ${preset.coreDeliverables[0]}. No obligation—want me to send the live preview link here? (${scope.estimatedDeliveryDays}-day turnaround · $${financials.setupFeeOffer} flat setup).`,
    },
    {
      channel: PitchChannelType.EMAIL_FOLLOW_UP,
      label: '4. Executive Proposal & ROI Email',
      headline: `Subject: Interactive Prototype for ${prospect.businessName} (${scope.estimatedDeliveryDays}-Day Launch Plan)`,
      bodyText: `Hi ${prospect.contactName},\n\nGreat speaking with you about ${prospect.businessName}. Based on our audit ("${prospect.websiteGapNote}"), here is the turnkey rollout plan:\n\n• Core Deliverables:\n  1. ${preset.coreDeliverables[0]}\n  2. ${preset.coreDeliverables[1]}\n  3. ${preset.coreDeliverables[2]}\n• Fixed Investment: $${financials.setupFeeOffer} one-time setup (${financials.depositPercent}% deposit = $${financials.depositAmountUsd} today, $${financials.completionBalanceUsd} upon approval & launch)\n• Optional Managed Care & Hosting: $${financials.monthlyRetainerOffer}/mo (1st-Year Total Partnership Value: $${financials.firstYearTotalValueUsd})\n\nReply "GO" and we will lock in your ${scope.estimatedDeliveryDays}-day launch window.\n\n— ${consultant}`,
    },
    {
      channel: PitchChannelType.OBJECTION_PLAYBOOK,
      label: '5. Objection Playbook (Price / Timing / DIY)',
      headline: `3-Point Rebuttal Matrix for ${preset.title}`,
      bodyText: `1. "We already get referrals / use social media": Social profiles bury your pricing and phone number under 10 posts. Even 1 saved high-intent customer per month pays for the $${financials.setupFeeOffer} setup.\n2. "I don't have time to write content": You don't have to—we pre-wrote the copy and built the ${preset.archetype.replace(/_/g, ' ')} layout already. We just verify your phone/booking link.\n3. "What if I don't like it?": It's capped at a ${financials.depositPercent}% start deposit ($${financials.depositAmountUsd}) with ${scope.maxRevisionRounds} structured revision rounds before the final $${financials.completionBalanceUsd} balance is due.`,
    },
    {
      channel: PitchChannelType.SCOPE_GUARDRAIL_SUMMARY,
      label: '6. Anti-Scope-Creep Statement of Work (SOW)',
      headline: `Fixed-Scope Guardrail Clause (${scope.maxIncludedPages} Pages · ${scope.maxRevisionRounds} Revisions)`,
      bodyText: `SCOPE BOUNDARY FOR ${prospect.businessName.toUpperCase()}:\n• Included Views/Pages: Up to ${scope.maxIncludedPages} high-conversion sections/pages.\n• Revision Cap: ${scope.maxRevisionRounds} consolidated revision rounds included.\n• Turnaround Target: ${scope.estimatedDeliveryDays} business days from deposit receipt ($${financials.depositAmountUsd}).\n• Architectural Boundary: ${
        scope.excludesCustomBackend
          ? 'Excludes custom multi-tenant backend/ERP databases (uses turnkey embedded booking/lead capture).'
          : 'Includes production Firestore RBAC rules, AES-256-GCM field encryption, and 90Hz telemetry verification.'
      }`,
    },
  ];
}

/**
 * Evaluates the 30-Day Guest-to-Cloud Lifecycle at any given epoch timestamp:
 * - Day 1–19: Frictionless local trial (`ACTIVE_TRIAL`)
 * - Day 20–30: Non-blocking soft backup prompt (`SOFT_PROMPT_WINDOW`)
 * - Day 31+: Hard authentication gate requiring Google Sign-In to migrate local records (`EXPIRED_REQUIRES_AUTH`)
 */
export function evaluateGuestLifecycleAt(
  installEpochMillis: number,
  currentEpochMillis: number
): GuestLifecycleStatus {
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsedMs = Math.max(0, currentEpochMillis - installEpochMillis);
  const daysElapsed = Math.floor(elapsedMs / msPerDay) + 1; // 1-indexed day of trial
  const daysRemaining = Math.max(0, 30 - daysElapsed);

  if (daysElapsed <= 19) {
    return {
      state: 'ACTIVE_TRIAL',
      daysElapsed,
      daysRemaining,
      bannerText: `Guest Mode Active (Day ${daysElapsed} of 30) · ${daysRemaining} days remaining before cloud backup requirement.`,
      requiresAuthGate: false,
    };
  }

  if (daysElapsed <= 30) {
    return {
      state: 'SOFT_PROMPT_WINDOW',
      daysElapsed,
      daysRemaining,
      bannerText: `Cloud Backup Recommended (Day ${daysElapsed} of 30) · Only ${daysRemaining} day(s) left in local guest window. Link Google Account to sync leads to Firestore.`,
      requiresAuthGate: false,
    };
  }

  return {
    state: 'EXPIRED_REQUIRES_AUTH',
    daysElapsed,
    daysRemaining: 0,
    bannerText: `30-Day Local Guest Window Complete (Day ${daysElapsed}) · Sign in with Google to migrate your local leads and unlock permanent encrypted Firestore sync.`,
    requiresAuthGate: true,
  };
}
