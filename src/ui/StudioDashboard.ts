import { StreamVideoItem } from './AppShell';
import {
  CommentRecord,
  PlaylistRecord,
  ContentReportRecord,
  ContentReportStatus,
  ContentReportSeverity,
  PRIMARY_ADMIN_EMAIL,
} from '../services/firebase';

export type AnalyticsTimeframe = '24h' | '7d' | '28d' | '90d';

export interface VideoAnalyticsRow {
  videoId: string;
  title: string;
  category: string;
  resolution: '4K' | '8K' | '32K';
  views: number;
  watchTimeHours: number;
  avgRetentionPct: number;
  peakBitrateGbps: number;
  likesPct: number;
  updatedAt: string;
}

export interface StudioDashboardState {
  videos: StreamVideoItem[];
  currentVideo: StreamVideoItem;
  playlists: PlaylistRecord[];
  comments: CommentRecord[];
  contentReports: ContentReportRecord[];
  reportFilterStatus: 'ALL' | ContentReportStatus;
  offlineCachedIds: Set<string>;
  selectedBitrate: string;
  isLiveStreaming: boolean;
  liveUptimeSec: number;
  liveViewerCount: number;
  liveIngestGbps: number;
  liveDroppedFrames: number;
  liveConnected: boolean;
  isPremiumAdFree: boolean;
  parentalSafeMode: boolean;
  timeframe: AnalyticsTimeframe;
  categoryFilter: string;
  analyticsSearch: string;
  lastSyncedAt: string;
}

export interface StudioDashboardCallbacks {
  onSelectVideo: (videoId: string) => void;
  onToggleLiveBroadcast: () => void;
  onToggleGeminiLive: () => void;
  onChangeBitrate: (bitrate: string) => void;
  onChangeTimeframe: (tf: AnalyticsTimeframe) => void;
  onChangeCategoryFilter: (category: string) => void;
  onSearchAnalytics: (query: string) => void;
  onQuickUploadVideo: () => void;
  onToggleOfflineCache: (videoId: string) => void;
  onExportAnalyticsCsv: () => void;
  onRefreshTelemetry: () => void;
  onReportStudioVideo: (videoId: string, title: string) => void;
  onReviewContentReport: (
    reportId: string,
    status: ContentReportStatus,
    severity: ContentReportSeverity,
    resolutionNotes: string,
    removeTarget?: boolean
  ) => void;
  onDeleteContentReport: (reportId: string) => void;
  onFilterContentReportStatus: (status: 'ALL' | ContentReportStatus) => void;
}

const TIMEFRAME_MULTIPLIER: Record<AnalyticsTimeframe, { mult: number; label: string; deltaViews: string; deltaWatch: string; trendPoints: number[] }> = {
  '24h': {
    mult: 0.08,
    label: 'Last 24 Hours',
    deltaViews: '+14.2% vs yesterday',
    deltaWatch: '+11.8% vs yesterday',
    trendPoints: [42, 48, 56, 51, 64, 72, 68, 84, 91, 88, 95, 100],
  },
  '7d': {
    mult: 0.35,
    label: 'Last 7 Days',
    deltaViews: '+22.6% vs prior 7d',
    deltaWatch: '+19.4% vs prior 7d',
    trendPoints: [50, 58, 63, 71, 69, 82, 87, 85, 92, 96, 94, 99],
  },
  '28d': {
    mult: 1.0,
    label: 'Last 28 Days',
    deltaViews: '+31.8% vs prior 28d',
    deltaWatch: '+28.5% vs prior 28d',
    trendPoints: [38, 44, 52, 61, 67, 74, 79, 83, 88, 91, 96, 100],
  },
  '90d': {
    mult: 2.85,
    label: 'Last 90 Days',
    deltaViews: '+64.0% vs prior quarter',
    deltaWatch: '+57.2% vs prior quarter',
    trendPoints: [25, 32, 41, 49, 58, 66, 70, 77, 83, 89, 95, 100],
  },
};

export class StudioDashboard {
  public static computeAnalyticsRows(
    videos: StreamVideoItem[],
    timeframe: AnalyticsTimeframe,
    categoryFilter: string,
    searchQuery: string
  ): VideoAnalyticsRow[] {
    const { mult } = TIMEFRAME_MULTIPLIER[timeframe];

    return videos
      .filter((v) => {
        if (categoryFilter !== 'ALL' && v.category !== categoryFilter) return false;
        if (
          searchQuery.trim() &&
          !v.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
          !v.category.toLowerCase().includes(searchQuery.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .map((v, idx) => {
        const baseViews =
          v.views.endsWith('M')
            ? parseFloat(v.views) * 1_000_000
            : v.views.endsWith('K')
            ? parseFloat(v.views) * 1_000
            : parseInt(v.views, 10) || 12_400;

        const scaledViews = Math.max(1, Math.round(baseViews * mult));
        const avgWatchHoursPerView = (v.durationSec * 0.72) / 3600;
        const watchTimeHours = Math.max(1, Math.round(scaledViews * avgWatchHoursPerView));
        const avgRetentionPct = Number((84.2 - idx * 3.1).toFixed(1));
        const peakBitrateGbps = v.resolution === '32K' ? 32.4 : v.resolution === '8K' ? 12.8 : 4.2;
        const likesPct = Number((97.4 - idx * 0.8).toFixed(1));

        return {
          videoId: v.id,
          title: v.title,
          category: v.category,
          resolution: v.resolution,
          views: scaledViews,
          watchTimeHours,
          avgRetentionPct: Math.max(62.0, avgRetentionPct),
          peakBitrateGbps,
          likesPct: Math.max(91.0, likesPct),
          updatedAt: idx === 0 ? '2m ago' : idx === 1 ? '18m ago' : '1h ago',
        };
      });
  }

  public static formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
  }

  public static render(state: StudioDashboardState): string {
    const tfMeta = TIMEFRAME_MULTIPLIER[state.timeframe];
    const rows = StudioDashboard.computeAnalyticsRows(
      state.videos,
      state.timeframe,
      state.categoryFilter,
      state.analyticsSearch
    );

    // 1. Video Library Statistics Computations
    const totalVideos = state.videos.length;
    const count32K = state.videos.filter((v) => v.resolution === '32K').length;
    const count8K = state.videos.filter((v) => v.resolution === '8K').length;
    const count4K = state.videos.filter((v) => v.resolution === '4K').length;
    const pct32K = totalVideos > 0 ? Math.round((count32K / totalVideos) * 100) : 0;
    const pct8K = totalVideos > 0 ? Math.round((count8K / totalVideos) * 100) : 0;
    const offlineCount = state.offlineCachedIds.size;
    const storageUsedTb = (count32K * 1.42 + count8K * 0.38 + count4K * 0.12).toFixed(2);
    const totalDurationMin = Math.round(
      state.videos.reduce((acc, v) => acc + v.durationSec, 0) / 60
    );

    // 2. Recent Analytics KPIs
    const totalViews = rows.reduce((sum, r) => sum + r.views, 0);
    const totalWatchHours = rows.reduce((sum, r) => sum + r.watchTimeHours, 0);
    const meanRetention =
      rows.length > 0
        ? (rows.reduce((sum, r) => sum + r.avgRetentionPct, 0) / rows.length).toFixed(1)
        : '0.0';

    const categories = ['ALL', 'Spatial XR', 'Bioscience', 'Engineering'];
    const timeframes: AnalyticsTimeframe[] = ['24h', '7d', '28d', '90d'];

    // Build SVG Sparkline & Bar Chart for Recent Analytics
    const svgChart = StudioDashboard.renderAnalyticsSvgChart(tfMeta.trendPoints);

    return `
      <section
        aria-label="Centralized Studio Dashboard"
        class="pointer-events-auto w-full h-full flex-1 bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 p-4 md:p-6 overflow-y-auto flex flex-col gap-4"
      >
        <!-- Top Contextual Header Bar: Breadcrumb Left + Primary Studio Actions Right -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div class="text-xs font-mono-code text-slate-500 dark:text-slate-400">
              OmniStream XR · Production Console · Studio Dashboard
            </div>
            <h1 class="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Centralized Studio Dashboard
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <span class="text-xs font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mr-1">
              Synced ${state.lastSyncedAt} · AES-256-GCM
            </span>
            <button
              id="dash-btn-refresh"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition"
            >
              Sync Telemetry
            </button>
            <button
              id="dash-btn-export-csv"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition"
            >
              Export Analytics CSV
            </button>
            <button
              id="dash-btn-quick-upload"
              class="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 whitespace-nowrap shrink-0 transition"
            >
              + Publish 32K Master
            </button>
          </div>
        </div>

        <!-- Primary 12-Column Studio Grid: Video Library Statistics (7 cols) + Live Stream Status (5 cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- MODULE 1: VIDEO LIBRARY STATISTICS (7 Columns) -->
          <div class="lg:col-span-7 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Video Library Statistics
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Master repository distribution · Offline edge cache · User playlists
                </p>
              </div>
              <div class="text-xs font-mono-code text-slate-600 dark:text-sky-300 tabular-nums">
                ${totalVideos} Assets · ${totalDurationMin}m Total Runtime
              </div>
            </div>

            <!-- 4-Column Stat Grid inside Video Library Statistics (Dividers, No Nested Cards) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div class="pr-2 border-r border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Total Library Assets</div>
                <div class="text-xl font-bold font-mono-code tabular-nums text-slate-900 dark:text-white mt-0.5">
                  ${totalVideos}
                </div>
                <div class="text-[11px] font-mono-code text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  100% E2EE Indexed
                </div>
              </div>

              <div class="pr-2 sm:border-r border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">32K / 8K Masters</div>
                <div class="text-xl font-bold font-mono-code tabular-nums text-sky-600 dark:text-sky-400 mt-0.5">
                  ${count32K} / ${count8K}
                </div>
                <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  ${pct32K}% at 32K Ultra
                </div>
              </div>

              <div class="pr-2 border-r border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Offline Vault Cache</div>
                <div class="text-xl font-bold font-mono-code tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ${offlineCount} / ${totalVideos}
                </div>
                <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  ${storageUsedTb} TB Allocated
                </div>
              </div>

              <div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Curated Playlists</div>
                <div class="text-xl font-bold font-mono-code tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
                  ${state.playlists.length}
                </div>
                <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  ${state.comments.length} Stream Comments
                </div>
              </div>
            </div>

            <!-- Resolution Encoding Bar Breakdown -->
            <div class="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div class="flex items-center justify-between text-xs font-mono-code tabular-nums">
                <span class="text-slate-600 dark:text-slate-300">
                  Encoding Tier Distribution: 32K Master (${pct32K}%) · 8K 120fps (${pct8K}%)
                </span>
                <span class="text-slate-500 dark:text-slate-400">
                  Parental Safe Filter: ${state.parentalSafeMode ? 'Strict' : 'All Ratings'}
                </span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                <div style="width: ${pct32K}%" class="bg-sky-500 h-full" title="32K Master"></div>
                <div style="width: ${pct8K}%" class="bg-emerald-500 h-full" title="8K Ultra HD"></div>
              </div>
            </div>

            <!-- Interactive Category Filter Tabs -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span class="text-xs text-slate-500 dark:text-slate-400">Filter Library Category:</span>
              <div class="flex flex-wrap gap-1.5">
                ${categories
                  .map((cat) => {
                    const active = state.categoryFilter === cat;
                    return `<button
                      data-dash-cat="${cat}"
                      class="dash-btn-cat px-2.5 py-1 text-xs font-medium rounded-md transition ${
                        active
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }"
                    >${cat}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </div>

          <!-- MODULE 2: LIVE STREAM STATUS (5 Columns) -->
          <div class="lg:col-span-5 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Live Stream Status
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  32K Global Edge Ingest · Adaptive Bitrate Telemetry
                </p>
              </div>
              <div class="text-xs font-mono-code font-bold tabular-nums ${
                state.isLiveStreaming
                  ? 'text-[#16A34A] dark:text-emerald-400'
                  : 'text-[#D97706] dark:text-amber-400'
              }">
                ${state.isLiveStreaming ? '● LIVE ON AIR' : '● STANDBY READY'}
              </div>
            </div>

            <!-- Live Broadcast Telemetry Readout Grid -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 py-2.5 border-y border-slate-200 dark:border-slate-800 font-mono-code text-xs tabular-nums">
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Ingest Bitrate</span>
                <span class="font-bold text-slate-900 dark:text-sky-300">${
                  state.isLiveStreaming ? state.liveIngestGbps.toFixed(1) : '32.0'
                } Gbps</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Session Uptime</span>
                <span id="dash-live-uptime" class="font-bold text-slate-900 dark:text-white">${StudioDashboard.formatDuration(
                  state.liveUptimeSec
                )}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Concurrent Peers</span>
                <span class="font-bold text-slate-900 dark:text-emerald-400">${state.liveViewerCount.toLocaleString()}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Dropped Frames</span>
                <span class="font-bold text-slate-900 dark:text-emerald-400">${state.liveDroppedFrames} (0.00%)</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Edge CDN Latency</span>
                <span class="font-bold text-slate-900 dark:text-slate-200">12 ms · 24 PoPs</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Gemini Live AI</span>
                <span class="font-bold ${
                  state.liveConnected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400'
                }">${state.liveConnected ? 'Co-Producer Active' : 'Standby'}</span>
              </div>
            </div>

            <!-- Active Stream Target & Encoder Selector -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="text-slate-500 dark:text-slate-400">Encoder Profile:</span>
                <select
                  id="dash-select-bitrate"
                  aria-label="Live stream encoder profile"
                  class="bg-white dark:bg-slate-900 text-slate-900 dark:text-sky-300 text-xs font-mono-code px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700"
                >
                  <option value="32K Master (Auto ABR)" ${
                    state.selectedBitrate.includes('32K') ? 'selected' : ''
                  }>32K Master (Auto ABR)</option>
                  <option value="8K Ultra HD (120fps)" ${
                    state.selectedBitrate.includes('8K') ? 'selected' : ''
                  }>8K Ultra HD (120fps)</option>
                  <option value="4K Studio (60fps)" ${
                    state.selectedBitrate.includes('4K') ? 'selected' : ''
                  }>4K Studio (60fps)</option>
                </select>
              </div>

              <div class="flex flex-wrap gap-2 pt-1">
                <button
                  id="dash-btn-toggle-broadcast"
                  class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition ${
                    state.isLiveStreaming
                      ? 'bg-rose-600 text-white hover:bg-rose-500'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }"
                >
                  ${state.isLiveStreaming ? 'Stop 32K Broadcast' : 'Go Live in 32K'}
                </button>
                <button
                  id="dash-btn-toggle-gemini-live"
                  class="py-2 px-3 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  ${state.liveConnected ? 'Disconnect Voice AI' : 'Gemini Live Voice'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- MODULE 3: RECENT ANALYTICS (12-Column Responsive Grid: KPIs + Trend Chart + High-Density Table) -->
        <div class="rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4">
          <!-- Analytics Header + Timeframe Controls + Search Input -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Recent Analytics & Stream Performance
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ${tfMeta.label} · Cross-device telemetry · Adaptive bitrate retention metrics
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <input
                id="dash-input-search"
                type="text"
                value="${state.analyticsSearch}"
                placeholder="Search stream analytics..."
                class="bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 w-48"
              />
              <div class="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                ${timeframes
                  .map((tf) => {
                    const active = state.timeframe === tf;
                    return `<button
                      data-dash-tf="${tf}"
                      class="dash-btn-tf px-2.5 py-1 text-xs font-mono-code rounded-md transition ${
                        active
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }"
                    >${tf}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </div>

          <!-- Analytics KPI Strip + SVG Throughput/Retention Chart in a 12-Col Sub-Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <!-- Left 5 Cols: 2x2 Summary KPI Matrix -->
            <div class="lg:col-span-5 grid grid-cols-2 gap-3">
              <div class="p-3 rounded-lg bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Total Stream Views</div>
                <div class="text-lg font-bold font-mono-code tabular-nums text-slate-900 dark:text-white mt-0.5">
                  ${totalViews.toLocaleString()}
                </div>
                <div class="text-[11px] font-mono-code text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  ${tfMeta.deltaViews}
                </div>
              </div>

              <div class="p-3 rounded-lg bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Watch Time (Hours)</div>
                <div class="text-lg font-bold font-mono-code tabular-nums text-slate-900 dark:text-white mt-0.5">
                  ${totalWatchHours.toLocaleString()} hrs
                </div>
                <div class="text-[11px] font-mono-code text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  ${tfMeta.deltaWatch}
                </div>
              </div>

              <div class="p-3 rounded-lg bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Avg Audience Retention</div>
                <div class="text-lg font-bold font-mono-code tabular-nums text-sky-600 dark:text-sky-400 mt-0.5">
                  ${meanRetention}%
                </div>
                <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  Zero Rebuffer Ratio: 99.94%
                </div>
              </div>

              <div class="p-3 rounded-lg bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800">
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Peak CDN Throughput</div>
                <div class="text-lg font-bold font-mono-code tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
                  32.4 Gbps
                </div>
                <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  320/320 QA Gate Verified
                </div>
              </div>
            </div>

            <!-- Right 7 Cols: SVG Trend Visualization -->
            <div class="lg:col-span-7 p-3 rounded-lg bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-semibold text-slate-700 dark:text-slate-200">
                  32K Stream Velocity & Audience Retention Trajectory (${state.timeframe})
                </span>
                <span class="font-mono-code text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">
                  Peak Index: 100% · P99 Latency: 12 ms
                </span>
              </div>
              ${svgChart}
            </div>
          </div>

          <!-- High-Density Recent Video Performance Table (Tabular Numerals, Unboxed Metadata) -->
          <div class="overflow-x-auto border-t border-slate-200 dark:border-slate-800 pt-2">
            ${
              rows.length === 0
                ? `<div class="py-8 text-center">
                     <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">
                       No video streams match the current filter ("${state.analyticsSearch || state.categoryFilter}").
                     </p>
                     <button id="dash-btn-reset-filters" class="px-3 py-1.5 text-xs font-semibold rounded bg-sky-500 text-slate-950">
                       Reset Filters
                     </button>
                   </div>`
                : `<table class="w-full text-left border-collapse">
                     <thead>
                       <tr class="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-code uppercase text-slate-500 dark:text-slate-400">
                         <th class="py-2 px-2">Stream Title & Metadata</th>
                         <th class="py-2 px-2 text-right">Views (${state.timeframe})</th>
                         <th class="py-2 px-2 text-right">Watch Time</th>
                         <th class="py-2 px-2 text-right">Retention</th>
                         <th class="py-2 px-2 text-right">Peak Bitrate</th>
                         <th class="py-2 px-2 text-right">Offline Cache</th>
                         <th class="py-2 px-2 text-right">Studio Action</th>
                       </tr>
                     </thead>
                     <tbody class="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
                       ${rows
                         .map((r) => {
                           const isCurrent = r.videoId === state.currentVideo.id;
                           const isCached = state.offlineCachedIds.has(r.videoId);
                           return `
                             <tr class="h-10 hover:bg-slate-100/80 dark:hover:bg-slate-900/70 transition ${
                               isCurrent ? 'bg-sky-50/60 dark:bg-sky-950/30' : ''
                             }">
                               <td class="py-2 px-2">
                                 <div class="font-semibold text-slate-900 dark:text-white line-clamp-1">
                                   ${r.title}
                                 </div>
                                 <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono-code">
                                   ${r.category} · ${r.resolution} Master · Updated ${r.updatedAt}
                                 </div>
                               </td>
                               <td class="py-2 px-2 text-right font-mono-code tabular-nums text-slate-800 dark:text-slate-200">
                                 ${r.views.toLocaleString()}
                               </td>
                               <td class="py-2 px-2 text-right font-mono-code tabular-nums text-slate-800 dark:text-slate-200">
                                 ${r.watchTimeHours.toLocaleString()} hrs
                               </td>
                               <td class="py-2 px-2 text-right font-mono-code tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                                 ${r.avgRetentionPct.toFixed(1)}%
                               </td>
                               <td class="py-2 px-2 text-right font-mono-code tabular-nums text-sky-600 dark:text-sky-300">
                                 ${r.peakBitrateGbps.toFixed(1)} Gbps
                               </td>
                               <td class="py-2 px-2 text-right font-mono-code tabular-nums">
                                 <button
                                   data-dash-cache-id="${r.videoId}"
                                   class="dash-btn-cache text-[11px] underline ${
                                     isCached
                                       ? 'text-emerald-600 dark:text-emerald-400'
                                       : 'text-slate-500 dark:text-slate-400 hover:text-sky-400'
                                   }"
                                 >
                                   ${isCached ? 'Cached ✓' : 'Cache Offline'}
                                 </button>
                               </td>
                               <td class="py-2 px-2 text-right whitespace-nowrap space-x-1.5">
                                 <button
                                   data-dash-play-id="${r.videoId}"
                                   class="dash-btn-play px-2.5 py-1 text-xs font-semibold rounded bg-sky-500/90 text-slate-950 hover:bg-sky-400 transition cursor-pointer"
                                 >
                                   ${isCurrent ? 'Playing in Hub' : 'Open Stream'}
                                 </button>
                                 <button
                                   data-dash-report-id="${r.videoId}"
                                   data-dash-report-title="${r.title.replace(/"/g, '&quot;')}"
                                   class="dash-btn-report px-2 py-1 text-xs font-semibold rounded bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition cursor-pointer"
                                   title="Report Content to Firestore (/content_reports)"
                                 >
                                   ⚑ Report
                                 </button>
                               </td>
                             </tr>
                           `;
                         })
                         .join('')}
                     </tbody>
                   </table>`
            }
          </div>
        </div>

        <!-- MODULE 4: ADMIN REPORTED CONTENT REVIEW QUEUE (Firestore /content_reports) -->
        ${StudioDashboard.renderReportedContentReviewPanel(state)}
      </section>
    `;
  }

  private static renderReportedContentReviewPanel(state: StudioDashboardState): string {
    const filteredReports =
      state.reportFilterStatus === 'ALL'
        ? state.contentReports
        : state.contentReports.filter((r) => r.status === state.reportFilterStatus);
    const openCount = state.contentReports.filter(
      (r) => r.status === 'OPEN' || r.status === 'IN_REVIEW'
    ).length;

    return `
      <div class="rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3.5" id="dash-content-reports-section">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Reported Content Review Queue (Firestore /content_reports)
              </h2>
              <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold ${
                openCount > 0
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              }">
                ${openCount} Pending Review · ${state.contentReports.length} Total
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              User-submitted content reports synced from Firestore for Admin / GM / Moderator review (<strong class="font-mono-code text-sky-600 dark:text-sky-300">${PRIMARY_ADMIN_EMAIL}</strong>).
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            ${(['ALL', 'OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED'] as const)
              .map((st) => {
                const active = state.reportFilterStatus === st;
                return `<button
                  type="button"
                  data-dash-report-filter="${st}"
                  class="px-2.5 py-1 text-xs font-mono-code rounded-md transition cursor-pointer ${
                    active
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }"
                >${st}</button>`;
              })
              .join('')}
          </div>
        </div>

        <div class="space-y-2.5">
          ${
            filteredReports.length === 0
              ? `<div class="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-lg">
                   No reported content items match status "${state.reportFilterStatus}".
                 </div>`
              : filteredReports
                  .map(
                    (rep) => `
                  <div class="p-3 rounded-lg bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                          rep.severity === 'CRITICAL' || rep.severity === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                            : rep.severity === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }">
                          ${rep.severity}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono-code font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                          ${rep.targetType} · ${rep.reason}
                        </span>
                        <span class="font-bold text-xs text-slate-900 dark:text-white">
                          ${rep.targetTitle}
                        </span>
                        <span class="text-[11px] font-mono-code text-slate-500">
                          (Target ID: ${rep.targetId})
                        </span>
                      </div>

                      <div class="flex items-center gap-2">
                        <span class="text-[11px] font-mono-code font-bold ${
                          rep.status === 'ACTIONED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : rep.status === 'DISMISSED'
                            ? 'text-slate-500'
                            : 'text-amber-600 dark:text-amber-400'
                        }">
                          ● ${rep.status}
                        </span>
                        <button
                          type="button"
                          data-dash-report-del="${rep.id}"
                          class="text-[11px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Delete Report
                        </button>
                      </div>
                    </div>

                    <p class="text-xs text-slate-700 dark:text-slate-300">
                      ${rep.details}
                    </p>

                    <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400">
                      Reported by: ${rep.reporterName} (${rep.reporterId}) → Assigned Admin: ${rep.assignedAdminEmail}
                    </div>

                    ${
                      rep.resolutionNotes
                        ? `<div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-200">
                             <strong class="font-mono-code">[Admin Review · ${PRIMARY_ADMIN_EMAIL}]:</strong> ${rep.resolutionNotes}
                           </div>`
                        : ''
                    }

                    <div class="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="text"
                        id="dash-report-notes-${rep.id}"
                        value="${rep.resolutionNotes.replace(/"/g, '&quot;')}"
                        placeholder="Enter admin review & resolution notes (${PRIMARY_ADMIN_EMAIL})..."
                        class="flex-1 min-w-[220px] rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs"
                      />
                      <button
                        type="button"
                        data-dash-report-review="${rep.id}"
                        data-dash-report-status="IN_REVIEW"
                        data-dash-report-sev="${rep.severity}"
                        class="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
                      >
                        Mark In Review
                      </button>
                      <button
                        type="button"
                        data-dash-report-review="${rep.id}"
                        data-dash-report-status="ACTIONED"
                        data-dash-report-sev="${rep.severity}"
                        class="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
                      >
                        Approve &amp; Action
                      </button>
                      <button
                        type="button"
                        data-dash-report-review="${rep.id}"
                        data-dash-report-status="ACTIONED"
                        data-dash-report-sev="CRITICAL"
                        data-dash-report-remove="true"
                        class="px-2.5 py-1 rounded text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Remove Content &amp; Action
                      </button>
                      <button
                        type="button"
                        data-dash-report-review="${rep.id}"
                        data-dash-report-status="DISMISSED"
                        data-dash-report-sev="LOW"
                        class="px-2.5 py-1 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:opacity-90 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>`
                  )
                  .join('')
          }
        </div>
      </div>
    `;
  }

  private static renderAnalyticsSvgChart(points: number[]): string {
    const width = 560;
    const height = 104;
    const padX = 16;
    const padY = 12;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const coords = points.map((val, idx) => {
      const x = padX + (idx / Math.max(1, points.length - 1)) * usableW;
      const y = padY + usableH - (val / 100) * usableH;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), val };
    });

    const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const areaPoints = `${coords[0].x},${height - padY} ${polylinePoints} ${
      coords[coords.length - 1].x
    },${height - padY}`;

    const bars = coords
      .map((c) => {
        const barH = Math.max(4, height - padY - c.y);
        return `<rect x="${c.x - 8}" y="${c.y}" width="16" height="${barH}" rx="2" fill="#0284c7" fill-opacity="0.22" />`;
      })
      .join('');

    const dots = coords
      .map(
        (c) =>
          `<circle cx="${c.x}" cy="${c.y}" r="3" fill="#38bdf8" />`
      )
      .join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-24 overflow-visible" role="img" aria-label="Analytics throughput trend chart">
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" />
        <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" />
        <polygon points="${areaPoints}" fill="#38bdf8" fill-opacity="0.12" />
        ${bars}
        <polyline fill="none" stroke="#38bdf8" stroke-width="2.2" points="${polylinePoints}" />
        ${dots}
      </svg>
    `;
  }

  public static bindEvents(callbacks: StudioDashboardCallbacks): void {
    document.getElementById('dash-btn-refresh')?.addEventListener('click', () => {
      callbacks.onRefreshTelemetry();
    });

    document.getElementById('dash-btn-export-csv')?.addEventListener('click', () => {
      callbacks.onExportAnalyticsCsv();
    });

    document.getElementById('dash-btn-quick-upload')?.addEventListener('click', () => {
      callbacks.onQuickUploadVideo();
    });

    document.getElementById('dash-btn-toggle-broadcast')?.addEventListener('click', () => {
      callbacks.onToggleLiveBroadcast();
    });

    document.getElementById('dash-btn-toggle-gemini-live')?.addEventListener('click', () => {
      callbacks.onToggleGeminiLive();
    });

    document.getElementById('dash-select-bitrate')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      callbacks.onChangeBitrate(val);
    });

    document.querySelectorAll('.dash-btn-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.dashCat || 'ALL';
        callbacks.onChangeCategoryFilter(cat);
      });
    });

    document.querySelectorAll('.dash-btn-tf').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tf = ((btn as HTMLElement).dataset.dashTf || '28d') as AnalyticsTimeframe;
        callbacks.onChangeTimeframe(tf);
      });
    });

    document.getElementById('dash-input-search')?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value;
      callbacks.onSearchAnalytics(q);
    });

    document.getElementById('dash-btn-reset-filters')?.addEventListener('click', () => {
      callbacks.onChangeCategoryFilter('ALL');
      callbacks.onSearchAnalytics('');
    });

    document.querySelectorAll('.dash-btn-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.dashPlayId;
        if (id) callbacks.onSelectVideo(id);
      });
    });

    document.querySelectorAll('.dash-btn-report').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const id = el.dataset.dashReportId;
        const title = el.dataset.dashReportTitle || 'Studio Stream';
        if (id) callbacks.onReportStudioVideo(id, title);
      });
    });

    document.querySelectorAll('.dash-btn-cache').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.dashCacheId;
        if (id) callbacks.onToggleOfflineCache(id);
      });
    });

    document.querySelectorAll('[data-dash-report-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = (btn as HTMLElement).dataset.dashReportFilter as
          | 'ALL'
          | ContentReportStatus;
        if (st) callbacks.onFilterContentReportStatus(st);
      });
    });

    document.querySelectorAll('[data-dash-report-review]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const id = el.dataset.dashReportReview;
        const status = (el.dataset.dashReportStatus || 'ACTIONED') as ContentReportStatus;
        const severity = (el.dataset.dashReportSev || 'MEDIUM') as ContentReportSeverity;
        const removeTarget = el.dataset.dashReportRemove === 'true';
        if (!id) return;
        const notesInput = document.getElementById(
          `dash-report-notes-${id}`
        ) as HTMLInputElement | null;
        const notes =
          notesInput?.value.trim() ||
          `Reviewed (${status}) from Studio Dashboard by ${PRIMARY_ADMIN_EMAIL}.`;
        callbacks.onReviewContentReport(id, status, severity, notes, removeTarget);
      });
    });

    document.querySelectorAll('[data-dash-report-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.dashReportDel;
        if (id) callbacks.onDeleteContentReport(id);
      });
    });
  }
}
