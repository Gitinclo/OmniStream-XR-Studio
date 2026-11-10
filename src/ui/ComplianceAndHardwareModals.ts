import { PRIMARY_ADMIN_EMAIL } from '../services/firebase';
import { WorkspaceSummaryItem } from '../services/workspace';
import {
  AesGcmInspectionEnvelope,
  ChunkedStreamEncryptionResult,
} from '../services/cryptoAes256';
import {
  HardwareTelemetryState,
  RefreshRateMode,
  GpuRenderScaleMode,
  ThermalStatusLevel,
} from '../services/hardwareGovernor';
import {
  NICHE_CATALOG,
  NicheKey,
  getNichePreset,
  InputBoundsValidator,
  generateAllSixPitchScripts,
  evaluateGuestLifecycleAt,
  PipelineStage,
} from '../services/vibePitchEngine';
import {
  GUARDRAIL_CATEGORIES,
  GuardrailCategoryId,
  filterGuardrails,
  COMPLIANCE_DOCS_CATALOG,
} from '../services/complianceAndGuardrails';

export interface VibePitchLeadItem {
  id: string;
  niche: NicheKey;
  businessName: string;
  contactName: string;
  websiteGapNote: string;
  setupFeeOffer: number;
  monthlyRetainerOffer: number;
  depositPercent: number;
  stage: PipelineStage;
}

export interface SuiteUiState {
  // Modals
  hardwareHudModalOpen: boolean;
  complianceHubModalOpen: boolean;
  complianceActiveTab: 'DOCS_8' | 'GUARDRAILS_100';
  selectedComplianceDocFilename: string;
  guardrailCategoryFilter: 'ALL' | GuardrailCategoryId;
  guardrailSearchQuery: string;

  // Hardware Governor
  hardwareTelemetry: HardwareTelemetryState;
  hardwareStatusBanner: string;

  // AES-256-GCM + AAD Vault
  vaultPlaintext: string;
  vaultUserId: string;
  vaultRecordId: string;
  vaultEnvelope: AesGcmInspectionEnvelope | null;
  vaultDecryptedText: string;
  vaultTamperStatus: string;
  vaultChunkStreamResult: ChunkedStreamEncryptionResult | null;
  vaultChunkRestoredPreview: string;

  // VibePitch Studio
  vibeSelectedNiche: NicheKey;
  vibeBusinessName: string;
  vibeContactName: string;
  vibeWebsiteGap: string;
  vibeSetupFee: number;
  vibeMonthlyRetainer: number;
  vibeDepositPercent: number;
  vibeSimulatedTrialDay: number;
  vibeLeads: VibePitchLeadItem[];
  vibeStatusBanner: string;
}

/**
 * Renders the Top-Bar 90Hz Telemetry Pill & Docs/100-Guardrails Launcher Buttons
 */
export function renderHeaderSuiteControls(hw: HardwareTelemetryState): string {
  const thermalColor =
    hw.thermalLevel === ThermalStatusLevel.NOMINAL
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : hw.thermalLevel === ThermalStatusLevel.LIGHT
      ? 'text-sky-400 border-sky-500/30 bg-sky-500/10'
      : hw.thermalLevel === ThermalStatusLevel.MODERATE
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/40 bg-rose-500/15';

  return `
    <button
      type="button"
      id="btn-open-hardware-hud"
      aria-label="Open 90Hz Realme 8 5G Hardware Telemetry HUD"
      title="Realme 8 5G (Dimensity 700 / Mali-G57 MC2) 90Hz Frame Pacing & 4GB LPDDR4X RAM Governor"
      class="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-mono-code tabular-nums cursor-pointer hover:opacity-90 transition ${thermalColor}"
    >
      <span class="w-2 h-2 rounded-full bg-current"></span>
      <span>${hw.targetFps}Hz · ${hw.avgFrameTimeMs.toFixed(1)}ms · 4GB (${hw.availableRamMb}MB Free)</span>
    </button>
    <button
      type="button"
      id="btn-open-compliance-hub"
      aria-label="Open 100 Guardrails and 8 Compliance Docs Hub"
      title="View 8 Global Compliance Docs (README, SECURITY, PRIVACY, TERMS, ACCOUNT, CONTRIBUTING, CODE_OF_CONDUCT, ROADMAP) & 100 Vibe Coding Agent Guardrails"
      class="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 font-mono-code cursor-pointer hover:bg-sky-500/20 transition"
    >
      <span>📋 8 Docs &amp; 100 Guardrails</span>
    </button>
  `;
}

/**
 * Renders the interactive Realme 8 5G (Dimensity 700 / 90Hz / 4GB LPDDR4X RAM) Hardware & Thermal Optimizer HUD Modal
 */
export function renderHardwareHudModal(state: SuiteUiState): string {
  if (!state.hardwareHudModalOpen) return '';
  const hw = state.hardwareTelemetry;

  return `
    <div role="dialog" aria-modal="true" aria-label="Realme 8 5G Hardware and Thermal Governor HUD" class="fixed inset-0 z-50 pointer-events-auto bg-black/80 flex items-center justify-center p-3 md:p-6">
      <div class="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-[#090d16] text-slate-100 border border-emerald-500/40 p-5 shadow-2xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                90Hz HARDWARE &amp; THERMAL GOVERNOR
              </span>
              <span class="text-xs font-mono-code text-slate-400">${hw.deviceModel}</span>
            </div>
            <h2 class="text-base md:text-lg font-bold text-white mt-1">
              MediaTek Dimensity 700 (MT6833) · ARM Mali-G57 MC2 · 4GB LPDDR4X RAM
            </h2>
          </div>
          <button type="button" id="btn-close-hardware-hud" aria-label="Close Hardware HUD Modal" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
            ✕ Close HUD
          </button>
        </div>

        ${
          state.hardwareStatusBanner
            ? `<div class="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono-code text-emerald-300">
                 ${state.hardwareStatusBanner}
               </div>`
            : ''
        }

        <!-- Primary Telemetry KPI Grid (Tabular Numerals) -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono-code tabular-nums">
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[10px] text-slate-400 uppercase">Target Refresh &amp; Budget</div>
            <div class="text-lg font-bold text-emerald-400 mt-0.5">${hw.targetFps} FPS (${hw.frameBudgetMs}ms)</div>
            <div class="text-[11px] text-slate-400">Mode: ${hw.refreshRateMode}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[10px] text-slate-400 uppercase">Frame Pacing (Avg / P95)</div>
            <div class="text-lg font-bold text-sky-400 mt-0.5">${hw.avgFrameTimeMs.toFixed(1)}ms / ${hw.ninetyFifthFrameTimeMs.toFixed(1)}ms</div>
            <div class="text-[11px] text-slate-400">Jank Frames: ${hw.jankFrameCount} / ${hw.totalSampledFrames}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[10px] text-slate-400 uppercase">4GB LPDDR4X RAM Floor</div>
            <div class="text-lg font-bold ${hw.isLowMemoryFloorTriggered ? 'text-rose-400' : 'text-amber-300'} mt-0.5">
              ${hw.availableRamMb} MB Free
            </div>
            <div class="text-[11px] text-slate-400">Heap: ${hw.usedHeapMb}MB · Cache: ${hw.cachedThumbnailMb}MB</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div class="text-[10px] text-slate-400 uppercase">Mali-G57 GPU &amp; UFS 2.1 I/O</div>
            <div class="text-lg font-bold text-indigo-300 mt-0.5">${Math.round(hw.pixelRatioScale * 100)}% Scale</div>
            <div class="text-[11px] text-slate-400">UFS Seq Ops: ${hw.ufsCompletedOps} (Q: ${hw.ufsSequentialQueueDepth})</div>
          </div>
        </div>

        <!-- Interactive Governor Controls -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- 1. Refresh Rate Governor -->
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-emerald-400 uppercase">1. 90Hz / 60Hz Display Governor</div>
            <p class="text-[11px] text-slate-400">
              Controls frame pacing budget (11.11ms @ 90Hz vs 16.67ms @ 60Hz) on the 1080×2400 FHD+ panel.
            </p>
            <div class="flex flex-col gap-1.5">
              <button type="button" data-hw-refresh="${RefreshRateMode.AUTO_90HZ_THERMAL_GUARD}" class="btn-hw-refresh px-3 py-1.5 rounded-lg text-xs font-mono-code text-left border cursor-pointer ${
                hw.refreshRateMode === RefreshRateMode.AUTO_90HZ_THERMAL_GUARD
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }">
                ● Auto 90Hz + Thermal Guard
              </button>
              <button type="button" data-hw-refresh="${RefreshRateMode.LOCKED_90HZ}" class="btn-hw-refresh px-3 py-1.5 rounded-lg text-xs font-mono-code text-left border cursor-pointer ${
                hw.refreshRateMode === RefreshRateMode.LOCKED_90HZ
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }">
                ● Locked 90Hz (11.1ms Peak)
              </button>
              <button type="button" data-hw-refresh="${RefreshRateMode.THERMAL_SAVER_60HZ}" class="btn-hw-refresh px-3 py-1.5 rounded-lg text-xs font-mono-code text-left border cursor-pointer ${
                hw.refreshRateMode === RefreshRateMode.THERMAL_SAVER_60HZ
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }">
                ● 60Hz Battery &amp; Thermal Saver (16.6ms)
              </button>
            </div>
          </div>

          <!-- 2. Mali-G57 MC2 GPU Render Scale & Thermal Simulator -->
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-sky-400 uppercase">2. Mali-G57 MC2 GPU &amp; Thermal State</div>
            <p class="text-[11px] text-slate-400">
              Prevents GPU fill-rate bottlenecks on 2.59M pixels by dynamically scaling WebGL backbuffer to 720p (0.67x).
            </p>
            <div class="flex gap-1.5">
              <button type="button" data-hw-scale="${GpuRenderScaleMode.NATIVE_1080P}" class="btn-hw-scale flex-1 py-1.5 rounded-lg text-xs font-mono-code border cursor-pointer ${
                hw.gpuRenderScaleMode === GpuRenderScaleMode.NATIVE_1080P
                  ? 'bg-sky-400 text-slate-950 font-bold border-sky-300'
                  : 'bg-slate-950 text-slate-300 border-slate-800'
              }">
                1080p Native
              </button>
              <button type="button" data-hw-scale="${GpuRenderScaleMode.SAVER_720P_SCALE}" class="btn-hw-scale flex-1 py-1.5 rounded-lg text-xs font-mono-code border cursor-pointer ${
                hw.gpuRenderScaleMode === GpuRenderScaleMode.SAVER_720P_SCALE
                  ? 'bg-sky-400 text-slate-950 font-bold border-sky-300'
                  : 'bg-slate-950 text-slate-300 border-slate-800'
              }">
                720p Scale (0.67x)
              </button>
            </div>
            <div class="pt-1">
              <div class="text-[11px] font-mono-code text-slate-400 mb-1">Simulate Thermal Sensor State:</div>
              <div class="grid grid-cols-2 gap-1.5">
                ${[
                  ThermalStatusLevel.NOMINAL,
                  ThermalStatusLevel.LIGHT,
                  ThermalStatusLevel.MODERATE,
                  ThermalStatusLevel.CRITICAL,
                ]
                  .map(
                    (lvl) => `
                  <button type="button" data-hw-thermal="${lvl}" class="btn-hw-thermal py-1 px-2 rounded text-[11px] font-mono-code border cursor-pointer ${
                      hw.thermalLevel === lvl
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }">
                    ${lvl}
                  </button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <!-- 3. 4GB LPDDR4X RAM Trim & UFS 2.1 Sequential I/O -->
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 flex flex-col justify-between">
            <div class="space-y-2">
              <div class="text-xs font-bold text-amber-400 uppercase">3. 4GB LPDDR4X RAM &amp; UFS 2.1 Guard</div>
              <p class="text-[11px] text-slate-400">
                Evicts off-screen RGB_565 thumbnail bitmaps and flushes decoded stream buffers to prevent Android Low Memory Killer (LMK) OOM kills.
              </p>
              <div class="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono-code space-y-0.5 tabular-nums">
                <div>Last Trim Saved: <strong class="text-emerald-400">${hw.lastMemoryTrimSavedMb} MB</strong></div>
                <div>CPU Affinity: <strong>2× Cortex-A76 (2.2GHz)</strong></div>
                <div>Bg Workers: <strong>6× Cortex-A55 (2.0GHz)</strong></div>
              </div>
            </div>
            <div class="flex flex-col gap-1.5 pt-1">
              <button type="button" id="btn-hw-trim-memory" class="w-full py-2 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer">
                ⚡ Run 4GB Heap &amp; Cache Trim (Level 80)
              </button>
              <button type="button" id="btn-hw-ufs-flush" class="w-full py-1.5 rounded-lg text-xs font-mono-code bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700 cursor-pointer">
                Enqueue Sequential UFS 2.1 Batch Write
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the 8-Document Global Compliance & 100 Vibe Coding Agent Guardrails Modal
 */
export function renderComplianceHubModal(state: SuiteUiState): string {
  if (!state.complianceHubModalOpen) return '';

  const activeDoc =
    COMPLIANCE_DOCS_CATALOG.find(
      (d) => d.filename === state.selectedComplianceDocFilename
    ) || COMPLIANCE_DOCS_CATALOG[0];

  const filteredGuardrails = filterGuardrails(
    state.guardrailCategoryFilter,
    state.guardrailSearchQuery
  );

  return `
    <div role="dialog" aria-modal="true" aria-label="Global Compliance and 100 Vibe Coding Guardrails Hub" class="fixed inset-0 z-50 pointer-events-auto bg-black/80 flex items-center justify-center p-3 md:p-6">
      <div class="max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl bg-[#090d16] text-slate-100 border border-sky-500/40 p-5 shadow-2xl space-y-4">
        <!-- Modal Header -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                PRINCIPAL QA &amp; GOVERNANCE SUITE
              </span>
              <span class="text-xs font-mono-code text-emerald-400">100 / 100 Guardrails Enforced · 8 Root Docs Active</span>
            </div>
            <h2 class="text-base md:text-lg font-bold text-white mt-1">
              Global Compliance Hub (GDPR · CCPA · DPDP · OWASP) &amp; 100 Vibe Coding Guardrails
            </h2>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" data-comp-tab="DOCS_8" class="btn-comp-tab px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              state.complianceActiveTab === 'DOCS_8'
                ? 'bg-sky-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }">
              📄 8 Compliance Docs
            </button>
            <button type="button" data-comp-tab="GUARDRAILS_100" class="btn-comp-tab px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              state.complianceActiveTab === 'GUARDRAILS_100'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }">
              🛡 100 Agent Guardrails
            </button>
            <button type="button" id="btn-close-compliance-hub" aria-label="Close Compliance Hub Modal" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer">
              ✕ Close
            </button>
          </div>
        </div>

        ${
          state.complianceActiveTab === 'DOCS_8'
            ? `
          <!-- 8 Global Compliance Documents Reader -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden min-h-[420px]">
            <div class="space-y-1.5 overflow-y-auto pr-1">
              ${COMPLIANCE_DOCS_CATALOG.map(
                (doc) => `
                <button
                  type="button"
                  data-doc-file="${doc.filename}"
                  class="btn-select-comp-doc w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                    doc.filename === activeDoc.filename
                      ? 'bg-sky-500/15 border-sky-400 text-white'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-mono-code text-xs font-bold text-sky-300">${doc.filename}</span>
                    <span class="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-slate-950 text-emerald-400">${doc.badge}</span>
                  </div>
                  <div class="text-xs font-semibold mt-1">${doc.title}</div>
                </button>`
              ).join('')}
            </div>

            <div class="md:col-span-2 bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-y-auto flex flex-col justify-between space-y-3">
              <div class="space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <span class="font-mono-code text-xs font-bold text-sky-400">/${activeDoc.filename}</span>
                    <h3 class="text-base font-bold text-white">${activeDoc.title}</h3>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    ${activeDoc.frameworksCovered
                      .map(
                        (fw) =>
                          `<span class="px-2 py-0.5 rounded text-[10px] font-mono-code bg-slate-900 border border-slate-700 text-slate-300">${fw}</span>`
                      )
                      .join('')}
                  </div>
                </div>
                <p class="text-xs text-slate-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  ${activeDoc.summary}
                </p>
                <pre class="text-xs font-mono-code text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#060911] p-3.5 rounded-xl border border-slate-800/90">${activeDoc.markdownContent}</pre>
              </div>
              <div class="flex items-center justify-between text-[11px] font-mono-code text-slate-400 pt-2 border-t border-slate-800">
                <span>Supervised by Primary Admin &amp; DPO: ${PRIMARY_ADMIN_EMAIL}</span>
                <span class="text-emerald-400">✓ Synced in Repository Root (/${activeDoc.filename})</span>
              </div>
            </div>
          </div>
        `
            : `
          <!-- 100 Vibe Coding Agent Guardrails Catalog -->
          <div class="flex flex-col gap-3 flex-1 overflow-hidden min-h-[420px]">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap gap-1">
                ${GUARDRAIL_CATEGORIES.map(
                  (cat) => `
                  <button
                    type="button"
                    data-gr-cat="${cat.id}"
                    class="btn-gr-cat px-2.5 py-1 rounded-lg text-[11px] font-mono-code border cursor-pointer ${
                      state.guardrailCategoryFilter === cat.id
                        ? 'bg-emerald-400 text-slate-950 font-bold border-emerald-300'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }"
                  >
                    ${cat.range} ${cat.id === 'ALL' ? 'All (100)' : cat.label.split('.')[1]?.trim() || cat.label}
                  </button>`
                ).join('')}
              </div>
              <input
                id="input-guardrail-search"
                type="search"
                value="${state.guardrailSearchQuery}"
                placeholder="Search 100 guardrails (e.g. AES-256, 90Hz, #41)..."
                class="bg-slate-950 text-xs text-white px-3 py-1.5 rounded-lg border border-slate-700 font-mono-code w-64"
              />
            </div>

            <div class="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-1">
              ${filteredGuardrails
                .map(
                  (gr) => `
                <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-1">
                  <div class="flex items-center justify-between">
                    <span class="font-mono-code text-xs font-bold text-emerald-400">#${gr.id} · ${gr.title}</span>
                    <span class="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      ${gr.enforcement}
                    </span>
                  </div>
                  <p class="text-xs text-slate-300">${gr.rule}</p>
                  <div class="text-[10px] font-mono-code text-slate-500">${gr.categoryLabel}</div>
                </div>`
                )
                .join('')}
            </div>
          </div>
        `
        }
      </div>
    </div>
  `;
}

/**
 * Renders the full Workspace, AES-256-GCM + AAD Encryption Vault & VibePitch Studio 7-Niche Workbench
 */
export function renderUnifiedWorkspaceAndVaultView(params: {
  needsAuth: boolean;
  googleSignInButtonHtml: string;
  workspaceStatus: string;
  workspaceItems: WorkspaceSummaryItem[];
  suite: SuiteUiState;
}): string {
  const { needsAuth, googleSignInButtonHtml, workspaceStatus, workspaceItems, suite } =
    params;

  const preset = getNichePreset(suite.vibeSelectedNiche);
  const financials = InputBoundsValidator.normalizeLeadFinancials(
    suite.vibeSetupFee,
    suite.vibeMonthlyRetainer,
    suite.vibeDepositPercent
  );
  const scripts = generateAllSixPitchScripts({
    niche: suite.vibeSelectedNiche,
    businessName: suite.vibeBusinessName,
    contactName: suite.vibeContactName,
    websiteGapNote: suite.vibeWebsiteGap,
    setupFeeOffer: suite.vibeSetupFee,
    monthlyRetainerOffer: suite.vibeMonthlyRetainer,
    depositPercent: suite.vibeDepositPercent,
  });

  const nowMs = 1_700_000_000_000;
  const installMs = nowMs - Math.max(0, suite.vibeSimulatedTrialDay - 1) * 86_400_000;
  const lifecycle = evaluateGuestLifecycleAt(installMs, nowMs);

  return `
    <div class="pointer-events-auto w-full h-full flex-1 bg-[#090d16] p-4 md:p-6 overflow-y-auto space-y-5">
      <!-- Top Row: Workspace Connectors + AES-256-GCM & AAD Authenticated Encryption Workbench -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Left Column: Google Workspace Production Hub -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-sky-400 uppercase">1. Google Workspace Production Hub</span>
            ${
              needsAuth
                ? googleSignInButtonHtml
                : '<span class="text-[11px] font-mono-code text-emerald-400">OAuth Token Cached in Memory ✓</span>'
            }
          </div>
          <p class="text-xs text-slate-300">
            Access connected Google Workspace services with in-memory OAuth token isolation. Mutating actions require explicit confirmation.
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button data-ws="drive" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Drive Files</button>
            <button data-ws="calendar" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Calendar</button>
            <button data-ws="gmail" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Gmail</button>
            <button data-ws="tasks" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Tasks</button>
            <button data-ws="contacts" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Contacts</button>
            <button data-ws="chat" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Chat</button>
            <button data-ws="keep" class="btn-ws-read px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">Docs/Sheets/Slides/Forms/Meet/Keep</button>
          </div>

          <div class="flex gap-2">
            <button id="btn-ws-schedule-event" class="flex-1 py-1.5 text-xs font-bold rounded bg-sky-500 text-slate-950 hover:bg-sky-400 cursor-pointer">
              Schedule 32K Live Stream (Calendar)
            </button>
            <button id="btn-ws-export-drive" class="flex-1 py-1.5 text-xs font-bold rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300 cursor-pointer">
              Export Stream Manifest (Drive)
            </button>
          </div>

          <div class="flex-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-y-auto space-y-1.5 max-h-40">
            ${
              workspaceStatus
                ? `<div class="text-xs font-mono-code text-amber-300">${workspaceStatus}</div>`
                : ''
            }
            ${
              workspaceItems.length === 0
                ? `<div class="text-xs text-slate-500">Select a Google Workspace tool above to load live data.</div>`
                : workspaceItems
                    .map(
                      (item) => `
                  <div class="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span class="font-bold text-sky-300">[${item.service}]</span>
                      <span class="text-white ml-1">${item.title}</span>
                      <div class="text-[11px] text-slate-400">${item.subtitle}</div>
                    </div>
                    ${
                      item.link
                        ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline text-[11px]">Open ↗</a>`
                        : ''
                    }
                  </div>`
                    )
                    .join('')
            }
          </div>
        </div>

        <!-- Right Column: AES-256-GCM + AAD Context Binding & 64KB Chunked Stream Inspector -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-400 uppercase">2. AES-256-GCM + AAD &amp; 64KB Stream Vault</span>
            <span class="text-[11px] font-mono-code text-sky-300">[12B IV | 16B AuthTag | Ciphertext]</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label for="input-e2e-aad-user" class="block text-[10px] font-mono-code text-slate-400 uppercase">AAD Bound User ID</label>
              <input id="input-e2e-aad-user" type="text" value="${suite.vaultUserId}" class="w-full bg-slate-950 text-xs text-sky-300 px-2.5 py-1 rounded border border-slate-700 font-mono-code" />
            </div>
            <div>
              <label for="input-e2e-aad-record" class="block text-[10px] font-mono-code text-slate-400 uppercase">AAD Bound Record ID</label>
              <input id="input-e2e-aad-record" type="text" value="${suite.vaultRecordId}" class="w-full bg-slate-950 text-xs text-sky-300 px-2.5 py-1 rounded border border-slate-700 font-mono-code" />
            </div>
          </div>

          <div>
            <label for="input-e2e-secret" class="block text-[10px] font-mono-code text-slate-400 uppercase">Plaintext Payload to Encrypt (WebCrypto AES-256-GCM)</label>
            <input id="input-e2e-secret" type="text" value="${suite.vaultPlaintext}" class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700 font-mono-code" />
          </div>

          <div class="flex flex-wrap gap-2">
            <button id="btn-encrypt-vault" type="button" class="flex-1 py-1.5 px-3 text-xs font-bold rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300 cursor-pointer">
              Encrypt (AES-256-GCM + AAD)
            </button>
            <button id="btn-decrypt-vault" type="button" class="flex-1 py-1.5 px-3 text-xs font-bold rounded bg-sky-400 text-slate-950 hover:bg-sky-300 cursor-pointer">
              Decrypt &amp; Verify AAD
            </button>
            <button id="btn-tamper-aad-test" type="button" class="py-1.5 px-3 text-xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 cursor-pointer">
              Simulate AAD Tamper
            </button>
            <button id="btn-chunk-stream-test" type="button" class="py-1.5 px-3 text-xs font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 cursor-pointer">
              64KB Chunk Stream
            </button>
          </div>

          <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono-code text-[11px] text-slate-300 space-y-1 break-all tabular-nums">
            ${
              suite.vaultEnvelope
                ? `
              <div class="text-sky-300"><strong>AAD Context:</strong> ${suite.vaultEnvelope.aadContext}</div>
              <div><strong>12-Byte CSPRNG IV (Hex):</strong> <span class="text-amber-300">${suite.vaultEnvelope.ivHex}</span></div>
              <div><strong>16-Byte AuthTag (128-bit Hex):</strong> <span class="text-emerald-300">${suite.vaultEnvelope.authTagHex}</span></div>
              <div><strong>Packed Base64URL (${suite.vaultEnvelope.totalPackedByteLength}B):</strong> ${suite.vaultEnvelope.packedBase64Url}</div>
            `
                : `<div><strong>Ciphertext:</strong> (Click Encrypt to generate AES-256-GCM + AAD envelope)</div>`
            }
            ${
              suite.vaultDecryptedText
                ? `<div class="text-emerald-400 pt-1 border-t border-slate-800"><strong>✓ Verified Plaintext:</strong> ${suite.vaultDecryptedText}</div>`
                : ''
            }
            ${
              suite.vaultTamperStatus
                ? `<div class="text-rose-400 pt-1 border-t border-slate-800"><strong>⚠ Security Audit:</strong> ${suite.vaultTamperStatus}</div>`
                : ''
            }
            ${
              suite.vaultChunkStreamResult
                ? `<div class="text-indigo-300 pt-1 border-t border-slate-800">
                     <strong>✓ Chunked Stream Encrypted:</strong> ${suite.vaultChunkStreamResult.chunkCount} chunks (${suite.vaultChunkStreamResult.totalPlaintextBytes}B) · Restored: "${suite.vaultChunkRestoredPreview}"
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>

      <!-- Bottom Section: VibePitch Studio 7-Niche Quote Calculator, 6-Script Generator & 30-Day Guest Lifecycle -->
      <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                VIBEPITCH STUDIO · 7-VERTICAL COMMERCIAL ENGINE
              </span>
              <span class="text-xs font-mono-code text-emerald-400">InputBoundsValidator Enforced</span>
            </div>
            <h3 class="text-base font-bold text-white mt-1">
              7-Niche Turnkey Website/SaaS Quote Calculator, 6-Channel Pitch Scripts &amp; 30-Day Guest Lifecycle
            </h3>
          </div>

          <!-- 30-Day Guest Lifecycle Simulator Bar -->
          <div class="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono-code text-xs tabular-nums">
            <span class="text-slate-400">Trial Day:</span>
            ${[1, 24, 31]
              .map(
                (day) => `
              <button type="button" data-vibe-day="${day}" class="btn-vibe-day px-2 py-0.5 rounded border cursor-pointer ${
                  suite.vibeSimulatedTrialDay === day
                    ? 'bg-sky-400 text-slate-950 font-bold border-sky-300'
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                }">
                Day ${day}
              </button>`
              )
              .join('')}
          </div>
        </div>

        <!-- Guest Lifecycle Banner -->
        <div class="p-2.5 rounded-xl border font-mono-code text-xs flex flex-wrap items-center justify-between gap-2 ${
          lifecycle.state === 'ACTIVE_TRIAL'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : lifecycle.state === 'SOFT_PROMPT_WINDOW'
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            : 'bg-rose-500/20 border-rose-500/50 text-rose-200'
        }">
          <span><strong>[${lifecycle.state}]</strong> ${lifecycle.bannerText}</span>
          ${
            lifecycle.requiresAuthGate && needsAuth
              ? `<span class="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">Hard Gate Active (Sign In Required to Save New Leads)</span>`
              : `<span class="text-[11px] opacity-80">Firestore Schema Bounds: Setup ≤ $50,000 · Retainer ≤ $5,000 · Deposit 0–100%</span>`
          }
        </div>

        ${
          suite.vibeStatusBanner
            ? `<div class="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs font-mono-code text-sky-300">${suite.vibeStatusBanner}</div>`
            : ''
        }

        <!-- 7 Niche Selector Pills -->
        <div class="flex flex-wrap gap-1.5">
          ${NICHE_CATALOG.map(
            (n) => `
            <button
              type="button"
              data-vibe-niche="${n.niche}"
              class="btn-vibe-niche px-3 py-1.5 rounded-lg text-xs font-mono-code border cursor-pointer transition ${
                suite.vibeSelectedNiche === n.niche
                  ? 'bg-indigo-500 text-white font-bold border-indigo-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }"
            >
              ${n.niche.replace(/_/g, ' ')}
            </button>`
          ).join('')}
        </div>

        <!-- Calculator & Prospect Input Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Prospect & Pricing Inputs -->
          <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div class="text-xs font-bold text-indigo-300 uppercase">${preset.title}</div>
            <p class="text-[11px] text-slate-400">${preset.primaryPainPoint}</p>

            <div>
              <label for="input-vibe-biz" class="block text-[10px] font-mono-code text-slate-400">PROSPECT BUSINESS NAME (MAX 100 CHARS)</label>
              <input id="input-vibe-biz" type="text" maxlength="100" value="${suite.vibeBusinessName}" class="w-full bg-slate-900 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            </div>
            <div>
              <label for="input-vibe-contact" class="block text-[10px] font-mono-code text-slate-400">DECISION MAKER NAME (MAX 100 CHARS)</label>
              <input id="input-vibe-contact" type="text" maxlength="100" value="${suite.vibeContactName}" class="w-full bg-slate-900 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            </div>
            <div>
              <label for="input-vibe-gap" class="block text-[10px] font-mono-code text-slate-400">AUDIT / WEBSITE GAP NOTE (MAX 300 CHARS)</label>
              <input id="input-vibe-gap" type="text" maxlength="300" value="${suite.vibeWebsiteGap}" class="w-full bg-slate-900 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1 tabular-nums font-mono-code">
              <div>
                <label for="input-vibe-setup" class="block text-[10px] text-slate-400">SETUP ($)</label>
                <input id="input-vibe-setup" type="number" min="0" max="50000" value="${financials.setupFeeOffer}" class="w-full bg-slate-900 text-xs text-emerald-300 px-2 py-1 rounded border border-slate-700" />
              </div>
              <div>
                <label for="input-vibe-retainer" class="block text-[10px] text-slate-400">RETAINER/MO</label>
                <input id="input-vibe-retainer" type="number" min="0" max="5000" value="${financials.monthlyRetainerOffer}" class="w-full bg-slate-900 text-xs text-sky-300 px-2 py-1 rounded border border-slate-700" />
              </div>
              <div>
                <label for="input-vibe-deposit" class="block text-[10px] text-slate-400">DEPOSIT (%)</label>
                <input id="input-vibe-deposit" type="number" min="0" max="100" value="${financials.depositPercent}" class="w-full bg-slate-900 text-xs text-amber-300 px-2 py-1 rounded border border-slate-700" />
              </div>
            </div>

            <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono-code text-xs tabular-nums space-y-1">
              <div class="flex justify-between"><span>Upfront Deposit (${financials.depositPercent}%):</span> <strong class="text-emerald-400">$${financials.depositAmountUsd}</strong></div>
              <div class="flex justify-between"><span>Completion Balance:</span> <strong class="text-sky-300">$${financials.completionBalanceUsd}</strong></div>
              <div class="flex justify-between border-t border-slate-800 pt-1"><span>1st-Year Total Value:</span> <strong class="text-amber-300">$${financials.firstYearTotalValueUsd}</strong></div>
            </div>

            <div class="flex gap-2">
              <button type="button" id="btn-vibe-apply-inputs" class="flex-1 py-1.5 rounded-lg text-xs font-bold bg-sky-400 text-slate-950 hover:bg-sky-300 cursor-pointer">
                Recalculate &amp; Generate 6 Scripts
              </button>
              <button type="button" id="btn-vibe-save-lead" class="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 cursor-pointer">
                + Save Lead to Pipeline
              </button>
            </div>
          </div>

          <!-- 6-Channel Pitch Script Bundle -->
          <div class="lg:col-span-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between gap-3">
            <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
              <div class="text-xs font-bold text-emerald-400 uppercase">Generated 6-Part Pitch &amp; Scope Guardrail Bundle</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                ${scripts
                  .map(
                    (sc) => `
                  <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-1.5">
                    <div>
                      <div class="text-[11px] font-mono-code font-bold text-sky-400">${sc.label}</div>
                      <div class="text-xs font-semibold text-white mt-0.5">${sc.headline}</div>
                      <p class="text-[11px] text-slate-300 mt-1 whitespace-pre-line leading-relaxed">${sc.bodyText}</p>
                    </div>
                  </div>`
                  )
                  .join('')}
              </div>
            </div>

            <!-- Active Commercial Lead Pipeline -->
            <div class="border-t border-slate-800 pt-2.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-amber-300 uppercase">Commercial Pipeline (${suite.vibeLeads.length} Active Prospects)</span>
                <span class="text-[11px] font-mono-code text-slate-400">Sequential Stage Machine: PROSPECT → PITCHED → DEPOSIT_PAID → DELIVERED → RETAINER_ACTIVE</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                ${suite.vibeLeads
                  .map(
                    (lead) => `
                  <div class="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono-code tabular-nums">
                    <div class="truncate">
                      <div class="font-bold text-white truncate">${lead.businessName} <span class="text-sky-400">($${lead.setupFeeOffer} + $${lead.monthlyRetainerOffer}/mo)</span></div>
                      <div class="text-[10px] text-slate-400">${lead.niche} · Stage: <strong class="text-emerald-400">${lead.stage}</strong></div>
                    </div>
                    <button type="button" data-advance-lead="${lead.id}" class="btn-advance-lead shrink-0 px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 text-[11px] cursor-pointer">
                      Advance Stage →
                    </button>
                  </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
