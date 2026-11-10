import {
  HardwareTelemetryState,
  RefreshRateMode,
  GpuRenderScaleMode,
  ThermalStatusLevel,
} from '../services/hardwareGovernor';

export interface FormattedTelemetryMetrics {
  // Frame Rate
  fpsHeadline: string;
  fpsSubline: string;
  frameTimeHeadline: string;
  frameBudgetStatus: 'WITHIN_BUDGET' | 'JANK_WARNING';
  // Memory Usage
  ramHeadline: string;
  ramPercentText: string;
  ramBreakdownText: string;
  ramUsageRatioPercent: number;
  // GPU Temperature
  gpuTempHeadline: string;
  socTempText: string;
  gpuClockAndLoadText: string;
  gpuTempGaugePercent: number;
  thermalSeverityClass: string;
}

/**
 * Pure helper that formats `HardwareTelemetryState` into human-readable HUD strings
 * and normalized gauge percentages for Frame Rate, Memory Usage, and GPU Temperature.
 */
export function formatHardwareTelemetryMetrics(
  hw: HardwareTelemetryState
): FormattedTelemetryMetrics {
  const frameBudgetStatus =
    hw.avgFrameTimeMs <= hw.frameBudgetMs ? 'WITHIN_BUDGET' : 'JANK_WARNING';

  const ramUsageRatioPercent = Math.max(
    5,
    Math.min(100, Math.round(hw.memoryUsagePercent))
  );

  // Normalize GPU temp [25°C .. 65°C] to [0% .. 100%] gauge width
  const gpuTempGaugePercent = Math.max(
    4,
    Math.min(100, Math.round(((hw.gpuTempCelsius - 25.0) / (65.0 - 25.0)) * 100))
  );

  const thermalSeverityClass =
    hw.thermalLevel === ThermalStatusLevel.NOMINAL
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : hw.thermalLevel === ThermalStatusLevel.LIGHT
      ? 'text-sky-400 border-sky-500/30 bg-sky-500/10'
      : hw.thermalLevel === ThermalStatusLevel.MODERATE
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/40 bg-rose-500/15';

  return {
    fpsHeadline: `${hw.currentFps.toFixed(1)} FPS`,
    fpsSubline: `1% Low: ${hw.onePercentLowFps.toFixed(1)} FPS · Target ${hw.targetFps}Hz`,
    frameTimeHeadline: `${hw.avgFrameTimeMs.toFixed(1)}ms / ${hw.ninetyFifthFrameTimeMs.toFixed(1)}ms`,
    frameBudgetStatus,
    ramHeadline: `${hw.usedRamMb} / ${hw.totalRamMb} MB (${hw.memoryUsagePercent.toFixed(1)}%)`,
    ramPercentText: `${hw.memoryUsagePercent.toFixed(1)}% (${hw.availableRamMb}MB Free)`,
    ramBreakdownText: `Heap ${hw.usedHeapMb}MB · Cache ${hw.cachedThumbnailMb}MB · OS ${hw.systemReserveMb}MB`,
    ramUsageRatioPercent,
    gpuTempHeadline: `${hw.gpuTempCelsius.toFixed(1)}°C`,
    socTempText: `SoC ${hw.socTempCelsius.toFixed(1)}°C`,
    gpuClockAndLoadText: `${hw.gpuClockMhz} MHz · ${hw.gpuLoadPercent}% Load`,
    gpuTempGaugePercent,
    thermalSeverityClass,
  };
}

/**
 * Renders the 24-sample frame-time sparkline bars color-coded against the active frame budget
 */
function renderFrameTimeSparklineBars(hw: HardwareTelemetryState): string {
  const samples =
    hw.recentFrameTimesMs.length > 0 ? hw.recentFrameTimesMs : [hw.avgFrameTimeMs];
  const maxMs = Math.max(hw.frameBudgetMs * 1.45, ...samples, 16.6);

  return samples
    .map((ms) => {
      const heightPct = Math.max(14, Math.min(100, Math.round((ms / maxMs) * 100)));
      const barColor =
        ms > hw.frameBudgetMs
          ? 'bg-rose-400'
          : ms > hw.frameBudgetMs * 0.85
          ? 'bg-amber-400'
          : 'bg-emerald-400';
      return `<span title="${ms.toFixed(1)}ms" class="flex-1 rounded-t ${barColor}" style="height:${heightPct}%"></span>`;
    })
    .join('');
}

export class HardwareTelemetryHud {
  /**
   * Renders the Top-Bar Telemetry Pill displaying live Frame Rate (FPS), Memory Usage (%), and GPU Temperature (°C).
   */
  public static renderHeaderTelemetryPill(hw: HardwareTelemetryState): string {
    const formatted = formatHardwareTelemetryMetrics(hw);

    return `
      <button
        type="button"
        id="btn-open-hardware-hud"
        aria-label="Open 90Hz Realme 8 5G Hardware Telemetry HUD"
        title="Realme 8 5G (Dimensity 700 / Mali-G57 MC2) Live Frame Rate, 4GB LPDDR4X Memory & GPU Temperature HUD"
        class="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-mono-code tabular-nums cursor-pointer hover:opacity-90 transition ${formatted.thermalSeverityClass}"
      >
        <span class="w-2 h-2 rounded-full bg-current"></span>
        <span data-hw-live="header-pill">${hw.currentFps.toFixed(0)} FPS (${hw.targetFps}Hz) · ${hw.avgFrameTimeMs.toFixed(1)}ms · RAM ${hw.memoryUsagePercent.toFixed(0)}% (${hw.availableRamMb}MB Free) · GPU ${hw.gpuTempCelsius.toFixed(1)}°C</span>
      </button>
    `;
  }

  /**
   * Renders the persistent, collapsible on-screen Hardware Telemetry HUD widget docked in the bottom-right corner.
   * Displays real-time Frame Rate (FPS + Sparkline), Memory Usage (4GB LPDDR4X), and GPU Temperature (°C + Clock/Load).
   */
  public static renderFloatingTelemetryHud(
    hw: HardwareTelemetryState,
    collapsed: boolean
  ): string {
    const formatted = formatHardwareTelemetryMetrics(hw);
    const heapPct = Math.round((hw.usedHeapMb / hw.totalRamMb) * 100);
    const cachePct = Math.round((hw.cachedThumbnailMb / hw.totalRamMb) * 100);
    const sysPct = Math.round((hw.systemReserveMb / hw.totalRamMb) * 100);

    const tempBarColor =
      hw.gpuTempCelsius >= hw.criticalTempThresholdCelsius
        ? 'bg-rose-500'
        : hw.gpuTempCelsius >= hw.thermalThrottleThresholdCelsius
        ? 'bg-amber-400'
        : hw.gpuTempCelsius >= 40.0
        ? 'bg-sky-400'
        : 'bg-emerald-400';

    if (collapsed) {
      return `
        <aside
          id="hw-telemetry-floating-hud"
          aria-label="Hardware Telemetry HUD Monitor"
          class="pointer-events-auto fixed bottom-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090d16]/95 border border-slate-700/90 shadow-2xl font-mono-code text-[11px] text-slate-200 tabular-nums"
        >
          <span class="w-2 h-2 rounded-full ${
            hw.thermalLevel === ThermalStatusLevel.NOMINAL
              ? 'bg-emerald-400'
              : hw.thermalLevel === ThermalStatusLevel.LIGHT
              ? 'bg-sky-400'
              : hw.thermalLevel === ThermalStatusLevel.MODERATE
              ? 'bg-amber-400'
              : 'bg-rose-500'
          }"></span>
          <span data-hw-live="floating-compact">
            <strong class="text-emerald-400">${hw.currentFps.toFixed(0)} FPS</strong> ·
            <strong class="text-amber-300">RAM ${hw.memoryUsagePercent.toFixed(0)}%</strong> ·
            <strong class="text-sky-300">GPU ${hw.gpuTempCelsius.toFixed(1)}°C</strong>
          </span>
          <button
            type="button"
            id="btn-toggle-floating-hw-hud"
            aria-label="Expand Hardware Telemetry HUD"
            class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            ▴ HUD
          </button>
        </aside>
      `;
    }

    return `
      <aside
        id="hw-telemetry-floating-hud"
        aria-label="Hardware Telemetry HUD Monitor"
        class="pointer-events-auto fixed bottom-3 right-3 z-30 w-80 rounded-2xl bg-[#090d16]/95 border border-slate-700/90 p-3 shadow-2xl font-mono-code text-slate-100 space-y-2.5 tabular-nums"
      >
        <!-- HUD Header -->
        <div class="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-2 h-2 rounded-full shrink-0 ${
              hw.thermalLevel === ThermalStatusLevel.NOMINAL
                ? 'bg-emerald-400'
                : hw.thermalLevel === ThermalStatusLevel.LIGHT
                ? 'bg-sky-400'
                : hw.thermalLevel === ThermalStatusLevel.MODERATE
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }"></span>
            <div class="truncate">
              <div class="text-[11px] font-bold text-white tracking-tight truncate">HARDWARE TELEMETRY HUD</div>
              <div class="text-[9px] text-slate-400 truncate">Dimensity 700 · Mali-G57 MC2 · 4GB RAM</div>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              id="btn-floating-open-hw-modal"
              title="Open Full Hardware & Thermal Governor Settings"
              class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
            >
              Governor ⚙
            </button>
            <button
              type="button"
              id="btn-toggle-floating-hw-hud"
              aria-label="Minimize Hardware Telemetry HUD"
              title="Minimize Telemetry HUD"
              class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              ▾
            </button>
          </div>
        </div>

        <!-- 1. Frame Rate & Frame-Time Sparkline -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-slate-400 uppercase">Frame Rate (${hw.targetFps}Hz Budget ${hw.frameBudgetMs}ms)</span>
            <span data-hw-live="fps-headline" class="font-bold text-emerald-400 text-xs">${formatted.fpsHeadline}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-300">
            <span data-hw-live="fps-subline">${formatted.fpsSubline}</span>
            <span data-hw-live="frame-time">${hw.avgFrameTimeMs.toFixed(1)}ms avg</span>
          </div>
          <div
            data-hw-live="sparkline"
            aria-label="Recent 24 frame times sparkline"
            class="h-6 w-full flex items-end gap-0.5 pt-1 border-b border-slate-800"
          >
            ${renderFrameTimeSparklineBars(hw)}
          </div>
        </div>

        <!-- 2. Memory Usage (4GB LPDDR4X RAM) -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-slate-400 uppercase">4GB LPDDR4X Memory</span>
            <span data-hw-live="ram-headline" class="font-bold ${hw.isLowMemoryFloorTriggered ? 'text-rose-400' : 'text-amber-300'}">
              ${hw.usedRamMb} / ${hw.totalRamMb} MB (${hw.memoryUsagePercent.toFixed(0)}%)
            </span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800">
            <div title="JS & WebGL Heap (${hw.usedHeapMb} MB)" class="bg-sky-400 h-full" style="width:${heapPct}%"></div>
            <div title="Thumbnail & Stream Cache (${hw.cachedThumbnailMb} MB)" class="bg-amber-400 h-full" style="width:${cachePct}%"></div>
            <div title="Android OS Reserve (${hw.systemReserveMb} MB)" class="bg-slate-600 h-full" style="width:${sysPct}%"></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span data-hw-live="ram-breakdown">Free: <strong class="text-slate-200">${hw.availableRamMb}MB</strong> · Cache: ${hw.cachedThumbnailMb}MB</span>
            <button
              type="button"
              id="btn-floating-hw-trim"
              class="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:bg-amber-400/30 text-[9px] font-bold cursor-pointer"
            >
              ⚡ Trim RAM
            </button>
          </div>
        </div>

        <!-- 3. GPU Temperature & Clock (ARM Mali-G57 MC2) -->
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-slate-400 uppercase">Mali-G57 GPU Temp &amp; Clock</span>
            <span data-hw-live="gpu-temp" class="font-bold ${
              hw.gpuTempCelsius >= hw.criticalTempThresholdCelsius
                ? 'text-rose-400'
                : hw.gpuTempCelsius >= hw.thermalThrottleThresholdCelsius
                ? 'text-amber-400'
                : 'text-sky-300'
            }">
              ${hw.gpuTempCelsius.toFixed(1)}°C (${hw.thermalLevel})
            </span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              data-hw-live="gpu-temp-bar"
              class="${tempBarColor} h-full transition-all"
              style="width:${formatted.gpuTempGaugePercent}%"
            ></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span data-hw-live="gpu-clock">${hw.gpuClockMhz} MHz · ${hw.gpuLoadPercent}% Load · ${formatted.socTempText}</span>
            <span class="text-slate-300">${Math.round(hw.pixelRatioScale * 100)}% Scale</span>
          </div>
        </div>
      </aside>
    `;
  }

  /**
   * Renders the full interactive Realme 8 5G Hardware & Thermal Governor Modal
   */
  public static renderHardwareGovernorModal(
    hw: HardwareTelemetryState,
    statusBanner: string
  ): string {
    const formatted = formatHardwareTelemetryMetrics(hw);

    return `
      <div role="dialog" aria-modal="true" aria-label="Realme 8 5G Hardware and Thermal Governor HUD" class="fixed inset-0 z-50 pointer-events-auto bg-black/80 flex items-center justify-center p-3 md:p-6">
        <div class="max-w-4xl w-full max-h-[92vh] overflow-y-auto rounded-2xl bg-[#090d16] text-slate-100 border border-emerald-500/40 p-5 shadow-2xl space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  90Hz HARDWARE TELEMETRY &amp; THERMAL GOVERNOR
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
            statusBanner
              ? `<div class="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono-code text-emerald-300">
                   ${statusBanner}
                 </div>`
              : ''
          }

          <!-- Primary Telemetry KPI Grid: Frame Rate, Frame Pacing, 4GB Memory Usage, and GPU Temperature -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-code tabular-nums">
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase">Live Frame Rate &amp; Target</div>
              <div class="text-lg font-bold text-emerald-400 mt-0.5">${hw.currentFps.toFixed(1)} FPS (${hw.targetFps}Hz)</div>
              <div class="text-[11px] text-slate-400">1% Low: ${hw.onePercentLowFps.toFixed(1)} FPS · Budget ${hw.frameBudgetMs}ms</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase">Frame Pacing (Avg / P95)</div>
              <div class="text-lg font-bold text-sky-400 mt-0.5">${hw.avgFrameTimeMs.toFixed(1)}ms / ${hw.ninetyFifthFrameTimeMs.toFixed(1)}ms</div>
              <div class="text-[11px] text-slate-400">Jank Frames: ${hw.jankFrameCount} / ${hw.totalSampledFrames}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase">4GB LPDDR4X Memory Usage</div>
              <div class="text-lg font-bold ${hw.isLowMemoryFloorTriggered ? 'text-rose-400' : 'text-amber-300'} mt-0.5">
                ${hw.usedRamMb} / ${hw.totalRamMb} MB (${hw.memoryUsagePercent.toFixed(1)}%)
              </div>
              <div class="text-[11px] text-slate-400">${hw.availableRamMb}MB Free · Heap ${hw.usedHeapMb}MB · Cache ${hw.cachedThumbnailMb}MB</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase">Mali-G57 GPU Temp &amp; Clock</div>
              <div class="text-lg font-bold ${
                hw.gpuTempCelsius >= hw.criticalTempThresholdCelsius
                  ? 'text-rose-400'
                  : hw.gpuTempCelsius >= hw.thermalThrottleThresholdCelsius
                  ? 'text-amber-400'
                  : 'text-indigo-300'
              } mt-0.5">
                ${hw.gpuTempCelsius.toFixed(1)}°C · ${hw.gpuClockMhz} MHz
              </div>
              <div class="text-[11px] text-slate-400">Load: ${hw.gpuLoadPercent}% · ${formatted.socTempText} · ${Math.round(hw.pixelRatioScale * 100)}% Scale</div>
            </div>
          </div>

          <!-- 24-Frame Pacing Sparkline & GPU Thermal Threshold Bar -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono-code tabular-nums">
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-emerald-400">Real-Time Frame Pacing Sparkline (Last 24 Frames)</span>
                <span class="text-[11px] text-slate-400">Target ≤ ${hw.frameBudgetMs}ms</span>
              </div>
              <div class="h-10 w-full flex items-end gap-1 pt-1 border-b border-slate-800">
                ${renderFrameTimeSparklineBars(hw)}
              </div>
            </div>

            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label for="slider-hw-gpu-temp" class="font-bold text-sky-400">GPU Die Temperature Sensor Simulator (°C)</label>
                <span class="text-[11px] text-amber-300">Throttle ≥ ${hw.thermalThrottleThresholdCelsius}°C · Critical ≥ ${hw.criticalTempThresholdCelsius}°C</span>
              </div>
              <input
                id="slider-hw-gpu-temp"
                type="range"
                min="28"
                max="58"
                step="0.5"
                value="${hw.gpuTempCelsius}"
                class="w-full accent-sky-400 cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>28°C Cool</span>
                <span>40°C Light</span>
                <span>45°C Moderate (60Hz)</span>
                <span>50°C+ Critical (720p + RAM Trim)</span>
              </div>
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
                  <div>UFS Seq I/O Ops: <strong class="text-sky-300">${hw.ufsCompletedOps} (Q: ${hw.ufsSequentialQueueDepth})</strong></div>
                  <div>CPU Affinity: <strong>2× Cortex-A76 + 6× A55</strong></div>
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
   * Zero-flicker in-place DOM updater invoked when `hardwareGovernor` emits frame/memory/thermal snapshots.
   */
  public static updateLiveDom(hw: HardwareTelemetryState): void {
    if (typeof document === 'undefined') return;
    const formatted = formatHardwareTelemetryMetrics(hw);

    const headerPill = document.querySelector('[data-hw-live="header-pill"]');
    if (headerPill) {
      headerPill.textContent = `${hw.currentFps.toFixed(0)} FPS (${hw.targetFps}Hz) · ${hw.avgFrameTimeMs.toFixed(1)}ms · RAM ${hw.memoryUsagePercent.toFixed(0)}% (${hw.availableRamMb}MB Free) · GPU ${hw.gpuTempCelsius.toFixed(1)}°C`;
    }

    const compactEl = document.querySelector('[data-hw-live="floating-compact"]');
    if (compactEl) {
      compactEl.innerHTML = `<strong class="text-emerald-400">${hw.currentFps.toFixed(0)} FPS</strong> · <strong class="text-amber-300">RAM ${hw.memoryUsagePercent.toFixed(0)}%</strong> · <strong class="text-sky-300">GPU ${hw.gpuTempCelsius.toFixed(1)}°C</strong>`;
    }

    const fpsHead = document.querySelector('[data-hw-live="fps-headline"]');
    if (fpsHead) fpsHead.textContent = formatted.fpsHeadline;

    const fpsSub = document.querySelector('[data-hw-live="fps-subline"]');
    if (fpsSub) fpsSub.textContent = formatted.fpsSubline;

    const frameTimeEl = document.querySelector('[data-hw-live="frame-time"]');
    if (frameTimeEl) frameTimeEl.textContent = `${hw.avgFrameTimeMs.toFixed(1)}ms avg`;

    const sparklineEl = document.querySelector('[data-hw-live="sparkline"]');
    if (sparklineEl) {
      sparklineEl.innerHTML = renderFrameTimeSparklineBars(hw);
    }

    const ramHead = document.querySelector('[data-hw-live="ram-headline"]');
    if (ramHead) {
      ramHead.textContent = `${hw.usedRamMb} / ${hw.totalRamMb} MB (${hw.memoryUsagePercent.toFixed(0)}%)`;
    }

    const ramBreakdown = document.querySelector('[data-hw-live="ram-breakdown"]');
    if (ramBreakdown) {
      ramBreakdown.innerHTML = `Free: <strong class="text-slate-200">${hw.availableRamMb}MB</strong> · Cache: ${hw.cachedThumbnailMb}MB`;
    }

    const gpuTempEl = document.querySelector('[data-hw-live="gpu-temp"]');
    if (gpuTempEl) {
      gpuTempEl.textContent = `${hw.gpuTempCelsius.toFixed(1)}°C (${hw.thermalLevel})`;
    }

    const gpuTempBar = document.querySelector(
      '[data-hw-live="gpu-temp-bar"]'
    ) as HTMLElement | null;
    if (gpuTempBar) {
      gpuTempBar.style.width = `${formatted.gpuTempGaugePercent}%`;
    }

    const gpuClockEl = document.querySelector('[data-hw-live="gpu-clock"]');
    if (gpuClockEl) {
      gpuClockEl.textContent = `${hw.gpuClockMhz} MHz · ${hw.gpuLoadPercent}% Load · ${formatted.socTempText}`;
    }
  }
}
