# Realme 8 5G (Dimensity 700 / 90Hz / 4GB RAM) Hardware & Performance Optimization Plan

Deliver a dedicated hardware-level optimization layer and interactive **Realme 8 5G Performance & Thermal HUD** tailored to the **MediaTek Dimensity 700 (MT6833)** SoC, **90Hz 1080x2400 (20:9) IPS LCD**, **ARM Mali-G57 MC2 GPU**, **4GB LPDDR4X RAM baseline**, and **UFS 2.1 storage** so VibePitch Studio sustains sub-11.1ms frame times at 90 FPS without memory pressure or thermal throttling.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following hardware optimization and UX choices were confirmed during Phase 1 and govern this execution plan:

- **Confirmed Decision 1 — Both Background Optimizations & Live HUD Panel**: Implement under-the-hood SoC, RAM, display, and UFS 2.1 I/O optimizations alongside an interactive **Realme 8 5G Hardware Telemetry & Optimizer HUD** accessible from the top app bar.
- **Confirmed Decision 2 — Auto 90Hz with 60Hz Thermal Fallback + Manual Toggle**: Automatically negotiate the 90Hz display mode (11.1ms frame budget) during normal operation, dynamically drop to a 60Hz (16.6ms) thermal-saver cap when Android `PowerManager` reports elevated thermal status or battery saver, and allow manual user override (`Auto 90Hz/60Hz`, `Lock 90Hz`, `Lock 60Hz Thermal Saver`).
- **Confirmed Decision 3 — Full Dimensity 700 & 4GB RAM Optimization Suite**: Cover all hardware subsystems: Cortex-A76 / Cortex-A55 thread scheduling, 4GB LPDDR4X memory trim & Compose `@Immutable`/`@Stable` stability, Mali-G57 MC2 overdraw/render-scale governance, and non-blocking UFS 2.1 storage streaming.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **Cortex-A76 / Cortex-A55 Heterogeneous Thread Pinning & Coroutine Dispatchers**: Keeps UI/Compose frame traversal strictly on the main thread (scheduled on the two 2.2 GHz Cortex-A76 performance cores) while routing JSON serialization, pitch script generation, 100-guardrail catalog filtering, and Firestore/local transformations to a bounded 6-thread efficiency pool (`THREAD_PRIORITY_BACKGROUND`) sized for the six 2.0 GHz Cortex-A55 cores.
  - **90Hz Display & Frame-Time Governor (11.1ms Budget)**: Queries `Display.supportedModes` on Android 11–13 (Realme UI 4.0) to select the native `1080x2400 @ 90Hz` mode (or falls back to `60Hz` during thermal throttling), tracks real-time Choreographer frame durations (`p50`, `p95`, jank count > 11.1ms), and exposes 180Hz touch-sampling responsiveness by eliminating main-thread I/O blocks.
  - **4GB LPDDR4X RAM Guardrail & Low-Memory Trim Engine**: Monitors JVM/Native heap footprint and hooks into Android `ComponentCallbacks2.onTrimMemory` (`TRIM_MEMORY_RUNNING_LOW`, `TRIM_MEMORY_UI_HIDDEN`). Enforces bounded in-memory caches, applies `@Immutable`/`@Stable` contracts to all UI state models to skip redundant Compose allocations, and provides a 1-tap **Purge Cache & Trim 4GB Heap** action.
  - **Mali-G57 MC2 GPU & UFS 2.1 Async I/O Pipeline**: Eliminates expensive multi-pass alpha blurs in favor of hardware-accelerated flat/gradient drawables, dynamically adjusts visual render complexity (`1080p Full Quality` vs `720p Fill-Rate Saver` during heavy thermal/GPU load), and moves all `SharedPreferences`/JSON decoding off the main thread onto a dedicated UFS 2.1 sequential I/O dispatcher.
- **Target Audience / Persona**: Agency founders and field sales reps running live client demos on mid-range 5G Android devices (specifically the Realme 8 5G 4GB/64GB and 4GB/128GB models) who need instant 90Hz scrolling and zero low-memory crashes.
- **Key Value**: Guarantees silky 90 FPS live client demos within the 11.1ms frame budget while protecting battery and thermals inside the Realme 8 5G's 7nm / 5000mAh chassis.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Automatic Boot & Window Refresh Negotiation**: On launch, the hardware governor detects display capabilities, selects the optimal `1080x2400 @ 90Hz` mode, preloads UFS 2.1 guest/local data asynchronously on the A55 background pool, and registers thermal and 4GB memory trim observers.
  2. **Top-Bar Hardware Telemetry Pill (`90Hz • 4GB Ok`)**: A compact, high-contrast status badge in the top app bar displays the active refresh target (`90Hz` or `60Hz Cap`) and frame-time health. Tapping it opens the **Realme 8 5G Hardware & Performance HUD Dialog**.
  3. **Interactive Realme 8 5G Optimizer HUD**:
     - **SoC & Thread Affinity Card**: Visualizes the **Dimensity 700 (2x A76 @ 2.2GHz + 6x A55 @ 2.0GHz)** topology, active background worker threads, and thread priority pinning status.
     - **Display & Frame-Time Budget Card**: Displays live frame-time telemetry against the **11.1ms (90 FPS)** and **16.6ms (60 FPS)** budgets, plus interactive filter chips to switch between **Auto (90Hz w/ Thermal Cap)**, **Locked 90Hz**, and **60Hz Thermal Saver**.
     - **Mali-G57 MC2 GPU & Render Scale Card**: Shows GPU fill-rate mode (`1080x2400 Native` vs `720p Render Scale Saver` + `ASTC / 4x MSAA Profile`) with a toggle to force 720p fill-rate reduction during long pitch sessions.
     - **4GB LPDDR4X RAM & UFS 2.1 I/O Card**: Shows live heap usage vs budget, low-memory trim state, UFS 2.1 async read/write latency, and a **Trim Memory & Flush Caches** button.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision hardware-instrumentation telemetry seamlessly integrated into VibePitch Studio's Obsidian Slate (`#0B0F19`), Electric Indigo (`#6366F1`), and Emerald Conversion (`#10B981`) palette.
  - *Color & Status Coding*: Emerald (`#10B981`) for `< 11.1ms` 90 FPS lock and healthy RAM; Amber (`#F59E0B`) for `60Hz Thermal Saver` or moderate memory trim; Rose (`#F43F5E`) for thermal throttling or critical memory pressure.
  - *GPU-Friendly Styling*: Uses single-pass flat vector canvas gauges and crisp borders instead of multi-layer translucent blurs to protect the dual-core Mali-G57 MC2 fill rate.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Cooperative A76/A55 Thread Scheduling via Priority-Pinned Coroutine Dispatchers**
  - *Chosen Approach*: Create a dedicated `DimensityThreadScheduler` with a 6-thread pool setting `Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)` (which Android's Linux EAS scheduler automatically maps to the six Cortex-A55 efficiency cores) while keeping UI state emissions and Compose frame callbacks at `THREAD_PRIORITY_DISPLAY` / `URGENT_DISPLAY` on the two Cortex-A76 cores.
  - *Why*: Unprivileged Android apps cannot issue root `sched_setaffinity` syscalls across arbitrary CPUs on stock Realme UI 4.0 without risking `SecurityException`s, whereas Linux Energy Aware Scheduling (EAS) on Android 11–13 deterministically routes `THREAD_PRIORITY_BACKGROUND` threads to the A55 cluster and `THREAD_PRIORITY_DISPLAY` to the A76 cluster, alongside optional best-effort native thread affinity hints.
  - *Alternatives Considered*: Default `Dispatchers.Default` (creates 8 unconstrained threads that contend with the main thread on the two A76 cores during heavy JSON or guardrail filtering).
- **Decision 2: Adaptive 90Hz / 60Hz Window Mode + Choreographer Frame Telemetry**
  - *Chosen Approach*: Use `Window.attributes.preferredDisplayModeId` (and Android 11+ `FrameRate` hints) paired with `PowerManager.OnThermalStatusChangedListener` (`THERMAL_STATUS_MODERATE` or higher triggers automatic 60Hz fallback and 720p density scaling).
  - *Why*: Delivers true 90Hz responsiveness during client demos while preventing the 7nm Dimensity 700 in its plastic chassis from thermal throttling during extended sessions.
- **Decision 3: Strict 4GB LPDDR4X Heap Discipline & Async UFS 2.1 Persistence**
  - *Chosen Approach*: Annotate all domain/UI models with `@Immutable`, add explicit `key` and `contentType` parameters to all `LazyColumn` items, cache generated pitch scripts by state hash, and move `LocalGuestSessionManager` JSON decoding/encoding to a sequential UFS 2.1 background channel.
  - *Why*: Eliminates main-thread disk stalls on UFS 2.1 storage and prevents GC pauses that would otherwise push frame times past 11.1ms on the 4GB RAM model.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   MainActivity (Window 90Hz/60Hz & Trim)                   │
│  • WindowManager.LayoutParams.preferredDisplayModeId (90Hz <-> 60Hz Cap)   │
│  • ComponentCallbacks2.onTrimMemory -> RealmeHardwareOptimizer.onTrim()    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 RealmeHardwareOptimizer (Hardware Governor)                │
├──────────────────────┬──────────────────────────┬──────────────────────────┤
│ DimensityCpuScheduler│ DisplayFrameGovernor     │ MemoryAndUfsGuardrail    │
│ • 2x A76 UI Priority │ • 90Hz (11.1ms) Target   │ • 4GB LPDDR4X Heap Watch │
│ • 6x A55 Bg Pool     │ • 60Hz (16.6ms) Thermal  │ • UFS 2.1 Async JSON I/O │
│ • EAS Thread Pinning │ • Choreographer P95 FPS  │ • Mali-G57 720p Scale    │
└──────────┬───────────┴──────────────┬───────────┴─────────────┬────────────┘
           │                          │                         │
           ▼                          ▼                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             VibePitchViewModel & LocalGuestSessionManager                  │
│  • Offloads PitchScriptGenerator & Guardrails filter to A55 Bg Dispatcher  │
│  • Streams UFS 2.1 SharedPreferences JSON asynchronously without UI block  │
│  • Exposes HardwareTelemetryState to TopAppBar & Optimizer HUD Dialog      │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             Jetpack Compose 90Hz UI & Realme8HardwareHudDialog             │
│  • @Immutable UI states + LazyColumn keys/contentTypes (0 redundant alloc) │
│  • TopAppBar 90Hz/60Hz Telemetry Chip + Interactive Hardware Optimizer HUD │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **`RefreshRateMode`**: Enum (`AUTO_90HZ_THERMAL_GUARD`, `LOCKED_90HZ`, `THERMAL_SAVER_60HZ`) controlling target refresh rate and frame budget (`11.1ms` vs `16.6ms`).
- **`GpuRenderScaleMode`**: Enum (`NATIVE_1080P`, `SAVER_720P_SCALE`) controlling density/render-scale optimization and single-pass Mali-G57 MC2 shader paths.
- **`HardwareTelemetryState`** (`@Immutable`):
  - `socModel`: `"MediaTek Dimensity 700 (2x A76 @ 2.2GHz + 6x A55 @ 2.0GHz)"`
  - `gpuModel`: `"ARM Mali-G57 MC2 @ 955MHz (Vulkan 1.1 / OpenGL ES 3.2)"`
  - `refreshRateMode`: Active `RefreshRateMode`, `targetFps` (`90` or `60`), `frameBudgetMs` (`11.1f` or `16.6f`), `lastFrameTimeMs`, and `withinFrameBudget: Boolean`.
  - `gpuRenderScaleMode`: Active `GpuRenderScaleMode`, `astcAndMsaaEnabled: Boolean`.
  - `ramUsedMb`, `ramMaxMb`, `isLowMemory4GbBaseline: Boolean`, `lastMemoryTrimLevel: String`.
  - `ufsAsyncIoQueueDepth: Int`, `thermalStatusLabel: String`, `isThermalThrottlingActive: Boolean`.

### Interactive Component & State Mapping
- **Top-Bar Hardware Chip (`hardware_telemetry_chip`)**: Displays live `90Hz • <frame_ms>ms` or `60Hz Saver` badge; clicking opens `Realme8HardwareHudDialog`.
- **Refresh Rate Mode Selector (`refresh_mode_auto`, `refresh_mode_90hz`, `refresh_mode_60hz`)**: Updates `RefreshRateMode` in `RealmeHardwareOptimizer`, immediately re-applies the window `preferredDisplayModeId`, and updates the frame budget threshold (`11.1ms` vs `16.6ms`).
- **Mali-G57 Render Scale Toggle (`gpu_render_scale_toggle`)**: Switches between `1080x2400 Native (405 PPI)` and `720p Fill-Rate Saver` for heavy scenes or thermal stress.
- **4GB RAM Trim Action (`trim_memory_action_button`)**: Invokes `RealmeHardwareOptimizer.performMemoryTrim()`, clearing cached script/guardrail buffers, compacting local session caches, and updating live heap telemetry.
- **Automated Verification (`RealmeHardwareOptimizationTest`)**: Unit and Robolectric tests verifying A76/A55 dispatcher execution, 90Hz/60Hz frame budget math (`11.1ms` vs `16.6ms`), thermal fallback transitions, 4GB memory trim handling, and Compose HUD interactions.
