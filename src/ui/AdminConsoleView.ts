import {
  PRIMARY_ADMIN_EMAIL,
  AdminRoleRecord,
  ModerationTicketRecord,
  StaffRoleTier,
  ModerationTicketCategory,
  ModerationTicketStatus,
  CommentRecord,
  ContentReportRecord,
  ContentReportStatus,
  ContentReportSeverity,
} from '../services/firebase';
import { GameHudSnapshot } from '../scene/SpatialStudio';
import { StreamVideoItem } from './AppShell';
import { LumenVideoItem } from './LumenPlatformView';

export interface AdminConsoleProps {
  currentUserEmail: string | null;
  currentUserUid: string | null;
  currentUserName: string | null;
  isVerifiedMasterAdmin: boolean;
  gmOverrideActive: boolean;
  statusBanner: string;
  gameHud: GameHudSnapshot;
  studioVideos: StreamVideoItem[];
  lumenVideos: LumenVideoItem[];
  streamComments: CommentRecord[];
  staffRoles: AdminRoleRecord[];
  tickets: ModerationTicketRecord[];
  filterCategory: 'ALL' | ModerationTicketCategory;
  contentReports: ContentReportRecord[];
  reportFilterStatus: 'ALL' | ContentReportStatus;
}

export interface AdminConsoleCallbacks {
  onCopyAdminEmail: () => void;
  onGmToggleOverride: () => void;
  onGmBoostBandwidth: () => void;
  onGmRestoreIntegrity: () => void;
  onGmAddScore: () => void;
  onGmAdvanceWave: () => void;
  onGmForceVictory: () => void;
  onGmOpen3DStage: () => void;
  onModerateStudioVideoAge: (videoId: string, ageRating: 'ALL' | 'TEEN' | 'MATURE') => void;
  onModerateDeleteStudioVideo: (videoId: string) => void;
  onModerateBoostLumenVideo: (videoId: string) => void;
  onModerateDeleteLumenVideo: (videoId: string) => void;
  onModerateClearLumenComments: (videoId: string) => void;
  onModerateDeleteStreamComment: (commentId: string) => void;
  onSubmitContactTicket: (payload: {
    category: ModerationTicketCategory;
    subject: string;
    message: string;
    targetVideoId?: string;
  }) => void;
  onResolveTicket: (
    ticketId: string,
    status: ModerationTicketStatus,
    adminReply: string
  ) => void;
  onDeleteTicket: (ticketId: string) => void;
  onFilterTicketCategory: (cat: 'ALL' | ModerationTicketCategory) => void;
  onAssignStaffRole: (payload: {
    targetUid: string;
    email: string;
    role: StaffRoleTier;
    permissions: string;
    contactHandle: string;
  }) => void;
  onRevokeStaffRole: (uid: string) => void;
  onReviewContentReport: (
    reportId: string,
    status: ContentReportStatus,
    severity: ContentReportSeverity,
    resolutionNotes: string,
    removeTarget?: boolean
  ) => void;
  onDeleteContentReport: (reportId: string) => void;
  onFilterContentReportStatus: (status: 'ALL' | ContentReportStatus) => void;
  onOpenReportModal: () => void;
}

function escHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class AdminConsoleView {
  public static render(props: AdminConsoleProps): string {
    const filteredTickets =
      props.filterCategory === 'ALL'
        ? props.tickets
        : props.tickets.filter((t) => t.category === props.filterCategory);

    const openTicketsCount = props.tickets.filter((t) => t.status !== 'RESOLVED').length;
    const totalLumenComments = props.lumenVideos.reduce(
      (acc, v) => acc + (v.cm?.length || 0),
      0
    );

    return `
      <section
        aria-label="Administration, Game Master, Admin & Moderator Control Center"
        class="pointer-events-auto w-full h-full flex-1 bg-[#f4f6fb] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-y-auto p-4 md:p-6"
      >
        <div class="max-w-[1400px] mx-auto flex flex-col gap-5 pb-10">
          <!-- 1. Official Administration / GM / Admin / Moderator Authority & Contact Header -->
          <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono-code font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    OFFICIAL ADMINISTRATION · GM · ADMIN · MODERATOR
                  </span>
                  <span class="text-xs font-mono-code text-emerald-600 dark:text-emerald-400">
                    RBAC Rules Active
                  </span>
                </div>
                <h1 class="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Command, Game Master &amp; Moderation Control Center
                </h1>
                <p class="text-xs md:text-sm text-slate-600 dark:text-slate-300">
                  Primary Administration, Game Master (GM), Admin &amp; Moderator Account &amp; Direct Contact:
                  <strong class="font-mono-code text-indigo-600 dark:text-sky-300 underline decoration-indigo-500/40 select-all">${PRIMARY_ADMIN_EMAIL}</strong>
                </p>
              </div>

              <!-- Direct Contact & Authority Actions -->
              <div class="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="mailto:${PRIMARY_ADMIN_EMAIL}?subject=OmniStream%20Admin%20%2F%20GM%20%2F%20Moderator%20Inquiry"
                  class="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] hover:opacity-90 transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>✉ Email Admin / GM (${PRIMARY_ADMIN_EMAIL})</span>
                </a>
                <button
                  type="button"
                  id="admin-btn-copy-email"
                  class="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Copy Contact Email
                </button>
                <a
                  href="#admin-contact-ticket-form"
                  class="px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  Open Contact / Mod Ticket ↓
                </a>
              </div>
            </div>

            <!-- Unboxed KPI & Authority Bar -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/90 text-xs">
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Designated Root Account</div>
                <div class="font-mono-code font-bold text-sm text-slate-900 dark:text-white mt-0.5 select-all">${PRIMARY_ADMIN_EMAIL}</div>
                <div class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Full Admin · GM · Moderator</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Current Session Authority</div>
                <div class="font-mono-code font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  ${
                    props.isVerifiedMasterAdmin
                      ? 'VERIFIED MASTER ADMIN / GM'
                      : props.currentUserEmail
                      ? escHtml(props.currentUserEmail)
                      : 'Interactive GM / Mod Preview'
                  }
                </div>
                <div class="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5">
                  ${
                    props.isVerifiedMasterAdmin
                      ? 'Authenticated as creatergame31@gmail.com'
                      : `Sign in as ${PRIMARY_ADMIN_EMAIL} for Cloud RBAC`
                  }
                </div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Catalog Under Moderation</div>
                <div class="font-mono-code font-bold text-sm text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  ${props.lumenVideos.length + props.studioVideos.length} Videos · ${totalLumenComments + props.streamComments.length} Comments
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Lumen + 32K Studio Streams</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Admin / GM Contact Queue</div>
                <div class="font-mono-code font-bold text-sm text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  ${openTicketsCount} Open · ${props.tickets.length} Total
                </div>
                <div class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Routed to ${PRIMARY_ADMIN_EMAIL}</div>
              </div>
            </div>

            ${
              props.statusBanner
                ? `<div class="mt-3 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs font-mono-code text-indigo-700 dark:text-sky-300 flex items-center justify-between">
                     <span>${escHtml(props.statusBanner)}</span>
                     <span class="text-[10px] uppercase opacity-75">Admin / GM Log</span>
                   </div>`
                : ''
            }
          </div>

          <!-- 2. Game Master (GM) Live Control Deck & Telemetry -->
          <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm space-y-3.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono-code">GAME MASTER (GM) LIVE OVERRIDE DECK</span>
                  <span class="text-[11px] px-2 py-0.5 rounded font-mono-code ${
                    props.gmOverrideActive
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }">
                    ${props.gmOverrideActive ? 'GM SHIELD: ACTIVE' : 'GM SHIELD: STANDBY'}
                  </span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Direct Game Master controls for <strong class="font-mono-code">${PRIMARY_ADMIN_EMAIL}</strong> over Packet Runner 32K &amp; the 8-Part Spatial Broadcast Rig.
                </p>
              </div>

              <button
                type="button"
                id="admin-gm-open-stage"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 transition cursor-pointer"
              >
                Launch 3D Rig &amp; Game View ↗
              </button>
            </div>

            <!-- Live Game Telemetry Strip -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 font-mono-code text-xs tabular-nums">
              <div>
                <span class="text-slate-500 dark:text-slate-400 block text-[10px]">GAME STATE</span>
                <span class="font-bold text-slate-900 dark:text-white">${props.gameHud.state}</span>
              </div>
              <div>
                <span class="text-slate-500 dark:text-slate-400 block text-[10px]">GM SCORE</span>
                <span class="font-bold text-emerald-600 dark:text-emerald-400">${props.gameHud.score}</span>
              </div>
              <div>
                <span class="text-slate-500 dark:text-slate-400 block text-[10px]">THROUGHPUT</span>
                <span class="font-bold text-sky-600 dark:text-sky-400">${props.gameHud.bandwidthGbps} Gbps</span>
              </div>
              <div>
                <span class="text-slate-500 dark:text-slate-400 block text-[10px]">RIG INTEGRITY</span>
                <span class="font-bold text-amber-600 dark:text-amber-400">${props.gameHud.health}%</span>
              </div>
              <div>
                <span class="text-slate-500 dark:text-slate-400 block text-[10px]">ORBITAL WAVE</span>
                <span class="font-bold text-purple-600 dark:text-purple-400">Wave ${props.gameHud.wave}</span>
              </div>
            </div>

            <!-- GM Action Buttons -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <button
                type="button"
                id="admin-gm-toggle-shield"
                class="px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  props.gmOverrideActive
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                }"
              >
                ${props.gmOverrideActive ? '✓ GM Invulnerability ON' : 'Enable GM Invulnerability'}
              </button>
              <button
                type="button"
                id="admin-gm-boost-bw"
                class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-sky-700 dark:text-sky-300 border border-slate-300 dark:border-slate-700 hover:border-sky-500 transition cursor-pointer tabular-nums"
              >
                +32 Gbps Bandwidth
              </button>
              <button
                type="button"
                id="admin-gm-heal"
                class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 transition cursor-pointer tabular-nums"
              >
                Restore 100% Integrity
              </button>
              <button
                type="button"
                id="admin-gm-score"
                class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-slate-300 dark:border-slate-700 hover:border-amber-500 transition cursor-pointer tabular-nums"
              >
                Grant +2,500 Score
              </button>
              <button
                type="button"
                id="admin-gm-wave"
                class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-purple-700 dark:text-purple-300 border border-slate-300 dark:border-slate-700 hover:border-purple-500 transition cursor-pointer tabular-nums"
              >
                Advance Wave (+1)
              </button>
              <button
                type="button"
                id="admin-gm-victory"
                class="px-3 py-2 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer"
              >
                Instant 32K Sync Victory
              </button>
            </div>
          </div>

          <!-- 2B. User-Reported Content Review Dashboard (Firestore /content_reports) -->
          ${AdminConsoleView.renderContentReportsSection(props)}

          <!-- 3. Content & Comment Moderation Center (Admin & Moderator Controls) -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <!-- Left: Lumen Platform Catalog & Comment Moderation -->
            <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Lumen Video &amp; Comment Moderation (${props.lumenVideos.length})
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Moderator controls to boost visibility, clear flagged comments, or remove videos.
                  </p>
                </div>
                <span class="text-[11px] font-mono-code px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                  MOD: ${PRIMARY_ADMIN_EMAIL}
                </span>
              </div>

              <div class="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-slate-100 dark:bg-[#090d16] text-slate-600 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th class="py-2 px-3 font-semibold">Video / Channel</th>
                      <th class="py-2 px-2 font-semibold text-right">Views</th>
                      <th class="py-2 px-2 font-semibold text-right">Comments</th>
                      <th class="py-2 px-3 font-semibold text-right">Moderator Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                    ${props.lumenVideos
                      .map(
                        (v) => `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                        <td class="py-2 px-3">
                          <div class="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">${escHtml(v.title)}</div>
                          <div class="text-[11px] text-slate-500 dark:text-slate-400">${escHtml(v.ch)} · ${escHtml(v.cat)}</div>
                        </td>
                        <td class="py-2 px-2 text-right font-mono-code tabular-nums">${v.views.toLocaleString()}</td>
                        <td class="py-2 px-2 text-right font-mono-code tabular-nums">${v.cm?.length || 0}</td>
                        <td class="py-2 px-3 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            data-mod-lumen-boost="${escHtml(v.id)}"
                            class="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                            title="Boost +10,000 Views"
                          >
                            +10K Views
                          </button>
                          <button
                            type="button"
                            data-mod-lumen-clear-cm="${escHtml(v.id)}"
                            class="px-2 py-1 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                            title="Purge Comments"
                          >
                            Purge Cmts
                          </button>
                          <button
                            type="button"
                            data-mod-lumen-del="${escHtml(v.id)}"
                            class="px-2 py-1 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                            title="Remove Video"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Right: 8K/32K Studio Stream & Live Comment Moderation -->
            <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    8K/32K Studio Stream &amp; Age Rating Governance
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Enforce parental age ratings (ALL / TEEN / MATURE) and moderate live stream comments.
                  </p>
                </div>
                <span class="text-[11px] font-mono-code px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300">
                  ADMIN GOVERNANCE
                </span>
              </div>

              <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-slate-100 dark:bg-[#090d16] text-slate-600 dark:text-slate-400">
                    <tr>
                      <th class="py-2 px-3 font-semibold">32K Stream Title</th>
                      <th class="py-2 px-2 font-semibold">Res</th>
                      <th class="py-2 px-2 font-semibold">Age Rating</th>
                      <th class="py-2 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                    ${props.studioVideos
                      .map(
                        (sv) => `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                        <td class="py-2 px-3">
                          <div class="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">${escHtml(sv.title)}</div>
                          <div class="text-[11px] text-slate-500 dark:text-slate-400">${escHtml(sv.author)} · ${escHtml(sv.views)} views</div>
                        </td>
                        <td class="py-2 px-2 font-mono-code">${sv.resolution}</td>
                        <td class="py-2 px-2">
                          <select
                            data-mod-studio-age="${escHtml(sv.id)}"
                            aria-label="Age rating for ${escHtml(sv.title)}"
                            class="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono-code"
                          >
                            <option value="ALL" ${sv.ageRating === 'ALL' ? 'selected' : ''}>ALL</option>
                            <option value="TEEN" ${sv.ageRating === 'TEEN' ? 'selected' : ''}>TEEN</option>
                            <option value="MATURE" ${sv.ageRating === 'MATURE' ? 'selected' : ''}>MATURE</option>
                          </select>
                        </td>
                        <td class="py-2 px-3 text-right">
                          <button
                            type="button"
                            data-mod-studio-del="${escHtml(sv.id)}"
                            class="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>

              <!-- Active Stream Comments Moderation -->
              <div class="pt-1">
                <div class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Active Stream Encrypted Comments (${props.streamComments.length})
                </div>
                <div class="max-h-32 overflow-y-auto space-y-1.5">
                  ${
                    props.streamComments.length === 0
                      ? `<div class="text-xs text-slate-500 dark:text-slate-400 py-2">No live stream comments queued for moderation.</div>`
                      : props.streamComments
                          .map(
                            (c) => `
                        <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 text-xs">
                          <div class="truncate">
                            <span class="font-semibold text-sky-600 dark:text-sky-400">${escHtml(c.authorName)}:</span>
                            <span class="ml-1 text-slate-800 dark:text-slate-200">${escHtml(c.text)}</span>
                          </div>
                          <button
                            type="button"
                            data-mod-stream-cm-del="${escHtml(c.id)}"
                            class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-600 dark:text-rose-300 hover:bg-rose-500/30 shrink-0 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>`
                          )
                          .join('')
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Direct Contact & Moderation Ticket Desk + Staff Role Registry -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5" id="admin-contact-ticket-form">
            <!-- Left 5 Cols: Contact / Report to Admin, GM & Moderator (creatergame31@gmail.com) -->
            <div class="lg:col-span-5 rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm flex flex-col justify-between gap-4">
              <form id="admin-ticket-form" class="space-y-3">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Contact Admin / GM / Moderator
                  </h2>
                  <span class="text-[11px] font-mono-code text-indigo-600 dark:text-sky-300">${PRIMARY_ADMIN_EMAIL}</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  Submit an Administration request, Game Master (GM) intervention, content moderation report, or direct message to <strong>${PRIMARY_ADMIN_EMAIL}</strong>.
                </p>

                <div>
                  <label for="admin-ticket-cat" class="block text-xs font-semibold mb-1">Channel / Department</label>
                  <select
                    id="admin-ticket-cat"
                    class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-3 py-2 text-xs"
                  >
                    <option value="CONTACT">Direct Contact (${PRIMARY_ADMIN_EMAIL})</option>
                    <option value="ADMIN">Administration &amp; Account Escalation</option>
                    <option value="GM">Game Master (GM) Live Event / Telemetry Request</option>
                    <option value="MODERATOR">Content &amp; Community Moderation Report</option>
                  </select>
                </div>

                <div>
                  <label for="admin-ticket-subject" class="block text-xs font-semibold mb-1">Subject</label>
                  <input
                    id="admin-ticket-subject"
                    type="text"
                    required
                    maxlength="140"
                    placeholder="e.g. Request GM tournament seed or report stream issue"
                    class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label for="admin-ticket-msg" class="block text-xs font-semibold mb-1">Message to ${PRIMARY_ADMIN_EMAIL}</label>
                  <textarea
                    id="admin-ticket-msg"
                    rows="3"
                    required
                    maxlength="1500"
                    placeholder="Describe your administration, GM, or moderation request..."
                    class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-3 py-2 text-xs"
                  ></textarea>
                </div>

                <div class="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    class="flex-1 py-2 px-4 rounded-lg text-xs font-bold bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] hover:opacity-90 transition cursor-pointer"
                  >
                    Dispatch to ${PRIMARY_ADMIN_EMAIL}
                  </button>
                  <a
                    href="mailto:${PRIMARY_ADMIN_EMAIL}"
                    class="py-2 px-3 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 hover:opacity-90"
                  >
                    Direct Email ↗
                  </a>
                </div>
              </form>

              <!-- Staff Role Assignment Form (/admins) -->
              <form id="admin-role-form" class="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Grant Staff / Moderator Role (/admins)
                  </span>
                  <span class="text-[10px] font-mono-code text-emerald-600 dark:text-emerald-400">RBAC Registry</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    id="admin-role-uid"
                    type="text"
                    required
                    placeholder="Target User UID (e.g. usr_mod_02)"
                    class="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-2.5 py-1.5 text-xs font-mono-code"
                  />
                  <input
                    id="admin-role-email"
                    type="email"
                    required
                    placeholder="Staff Email Address"
                    class="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    id="admin-role-tier"
                    class="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-2.5 py-1.5 text-xs font-mono-code"
                  >
                    <option value="MODERATOR">Role: MODERATOR</option>
                    <option value="GM">Role: GAME MASTER (GM)</option>
                    <option value="ADMIN">Role: ADMIN</option>
                    <option value="SUPER_ADMIN">Role: SUPER_ADMIN</option>
                  </select>
                  <button
                    type="submit"
                    class="py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
                  >
                    + Assign Authority Role
                  </button>
                </div>
              </form>
            </div>

            <!-- Right 7 Cols: Live Ticket Inbox & Active Staff Directory -->
            <div class="lg:col-span-7 flex flex-col gap-5">
              <!-- Ticket Queue -->
              <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Admin / GM / Moderator Dispatch Inbox (${filteredTickets.length})
                    </h2>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      Review, reply as <strong>${PRIMARY_ADMIN_EMAIL}</strong>, and resolve user tickets.
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    ${(['ALL', 'CONTACT', 'ADMIN', 'GM', 'MODERATOR'] as const)
                      .map(
                        (cat) => `
                      <button
                        type="button"
                        data-ticket-filter="${cat}"
                        class="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                          props.filterCategory === cat
                            ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222]'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                        }"
                      >
                        ${cat}
                      </button>`
                      )
                      .join('')}
                  </div>
                </div>

                <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  ${
                    filteredTickets.length === 0
                      ? `<div class="text-xs text-slate-500 py-6 text-center">No tickets in this category.</div>`
                      : filteredTickets
                          .map(
                            (t) => `
                        <div class="p-3 rounded-lg bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 space-y-2">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                              <span class="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                                t.category === 'GM'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                  : t.category === 'ADMIN'
                                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                                  : t.category === 'MODERATOR'
                                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                                  : 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                              }">${t.category}</span>
                              <span class="font-bold text-xs text-slate-900 dark:text-white">${escHtml(t.subject)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                              <span class="text-[11px] font-mono-code ${
                                t.status === 'RESOLVED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }">${t.status}</span>
                              <button
                                type="button"
                                data-ticket-del="${escHtml(t.id)}"
                                class="text-[11px] text-rose-500 hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p class="text-xs text-slate-700 dark:text-slate-300">${escHtml(t.message)}</p>
                          <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono-code">
                            From: ${escHtml(t.senderName)} → Assigned: ${escHtml(t.recipientEmail)}
                          </div>
                          ${
                            t.adminReply
                              ? `<div class="p-2 rounded bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-900 dark:text-sky-200">
                                   <strong class="font-mono-code">[Official Response · ${PRIMARY_ADMIN_EMAIL}]:</strong> ${escHtml(t.adminReply)}
                                 </div>`
                              : ''
                          }
                          <div class="flex gap-2 pt-1">
                            <input
                              type="text"
                              id="ticket-reply-${escHtml(t.id)}"
                              value="${escHtml(t.adminReply || '')}"
                              placeholder="Write official Admin / GM / Moderator response as ${PRIMARY_ADMIN_EMAIL}..."
                              class="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
                            />
                            <button
                              type="button"
                              data-ticket-resolve="${escHtml(t.id)}"
                              class="px-3 py-1 rounded text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
                            >
                              Reply &amp; Resolve
                            </button>
                          </div>
                        </div>`
                          )
                          .join('')
                  }
                </div>
              </div>

              <!-- Authorized Staff & Moderator Directory (/admins) -->
              <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2.5">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Authorized Administration, GM &amp; Moderator Roster (${props.staffRoles.length})
                  </h3>
                  <span class="text-[11px] font-mono-code text-slate-500">Primary Contact: ${PRIMARY_ADMIN_EMAIL}</span>
                </div>
                <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-slate-100 dark:bg-[#090d16] text-slate-600 dark:text-slate-400">
                      <tr>
                        <th class="py-2 px-3 font-semibold">Account / Contact Email</th>
                        <th class="py-2 px-2 font-semibold">Role Tier</th>
                        <th class="py-2 px-2 font-semibold">Permissions</th>
                        <th class="py-2 px-3 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                      ${props.staffRoles
                        .map(
                          (sr) => `
                        <tr>
                          <td class="py-2 px-3">
                            <div class="font-mono-code font-bold text-slate-900 dark:text-white">${escHtml(sr.email)}</div>
                            <div class="text-[11px] text-slate-500">UID: ${escHtml(sr.targetUid)} · Contact: ${PRIMARY_ADMIN_EMAIL}</div>
                          </td>
                          <td class="py-2 px-2">
                            <span class="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                              ${escHtml(sr.role)}
                            </span>
                          </td>
                          <td class="py-2 px-2 font-mono-code text-[11px] text-slate-600 dark:text-slate-300">
                            ${escHtml(sr.permissions)}
                          </td>
                          <td class="py-2 px-3 text-right">
                            ${
                              sr.email.toLowerCase() === PRIMARY_ADMIN_EMAIL
                                ? `<span class="text-[11px] font-mono-code text-emerald-600 dark:text-emerald-400 font-bold">ROOT LOCKED</span>`
                                : `<button
                                     type="button"
                                     data-role-revoke="${escHtml(sr.targetUid)}"
                                     class="px-2 py-0.5 rounded text-[11px] bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                                   >
                                     Revoke
                                   </button>`
                            }
                          </td>
                        </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  public static bindEvents(callbacks: AdminConsoleCallbacks): void {
    document
      .getElementById('admin-btn-copy-email')
      ?.addEventListener('click', () => callbacks.onCopyAdminEmail());

    document
      .getElementById('admin-gm-toggle-shield')
      ?.addEventListener('click', () => callbacks.onGmToggleOverride());
    document
      .getElementById('admin-gm-boost-bw')
      ?.addEventListener('click', () => callbacks.onGmBoostBandwidth());
    document
      .getElementById('admin-gm-heal')
      ?.addEventListener('click', () => callbacks.onGmRestoreIntegrity());
    document
      .getElementById('admin-gm-score')
      ?.addEventListener('click', () => callbacks.onGmAddScore());
    document
      .getElementById('admin-gm-wave')
      ?.addEventListener('click', () => callbacks.onGmAdvanceWave());
    document
      .getElementById('admin-gm-victory')
      ?.addEventListener('click', () => callbacks.onGmForceVictory());
    document
      .getElementById('admin-gm-open-stage')
      ?.addEventListener('click', () => callbacks.onGmOpen3DStage());

    // Lumen moderation buttons
    document.querySelectorAll('[data-mod-lumen-boost]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modLumenBoost;
        if (id) callbacks.onModerateBoostLumenVideo(id);
      });
    });

    document.querySelectorAll('[data-mod-lumen-clear-cm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modLumenClearCm;
        if (id) callbacks.onModerateClearLumenComments(id);
      });
    });

    document.querySelectorAll('[data-mod-lumen-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modLumenDel;
        if (id) callbacks.onModerateDeleteLumenVideo(id);
      });
    });

    // Studio stream moderation
    document.querySelectorAll('[data-mod-studio-age]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const id = (sel as HTMLElement).dataset.modStudioAge;
        const val = (e.target as HTMLSelectElement).value as
          | 'ALL'
          | 'TEEN'
          | 'MATURE';
        if (id && val) callbacks.onModerateStudioVideoAge(id, val);
      });
    });

    document.querySelectorAll('[data-mod-studio-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modStudioDel;
        if (id) callbacks.onModerateDeleteStudioVideo(id);
      });
    });

    document.querySelectorAll('[data-mod-stream-cm-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modStreamCmDel;
        if (id) callbacks.onModerateDeleteStreamComment(id);
      });
    });

    // Contact / Moderation Ticket submission
    document
      .getElementById('admin-ticket-form')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        const cat =
          ((
            document.getElementById('admin-ticket-cat') as HTMLSelectElement
          )?.value as ModerationTicketCategory) || 'CONTACT';
        const subject =
          (
            document.getElementById('admin-ticket-subject') as HTMLInputElement
          )?.value.trim() || '';
        const message =
          (
            document.getElementById('admin-ticket-msg') as HTMLTextAreaElement
          )?.value.trim() || '';
        if (!subject || !message) return;
        callbacks.onSubmitContactTicket({ category: cat, subject, message });
      });

    // Ticket category filters
    document.querySelectorAll('[data-ticket-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.ticketFilter as
          | 'ALL'
          | ModerationTicketCategory;
        if (cat) callbacks.onFilterTicketCategory(cat);
      });
    });

    // Ticket resolve & delete
    document.querySelectorAll('[data-ticket-resolve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.ticketResolve;
        if (!id) return;
        const input = document.getElementById(
          `ticket-reply-${id}`
        ) as HTMLInputElement | null;
        const reply =
          input?.value.trim() ||
          `Reviewed and resolved by Admin/GM/Moderator (${PRIMARY_ADMIN_EMAIL}).`;
        callbacks.onResolveTicket(id, 'RESOLVED', reply);
      });
    });

    document.querySelectorAll('[data-ticket-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.ticketDel;
        if (id) callbacks.onDeleteTicket(id);
      });
    });

    // Staff role assignment & revocation
    document
      .getElementById('admin-role-form')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        const uid =
          (
            document.getElementById('admin-role-uid') as HTMLInputElement
          )?.value.trim() || '';
        const email =
          (
            document.getElementById('admin-role-email') as HTMLInputElement
          )?.value.trim() || '';
        const role =
          ((
            document.getElementById('admin-role-tier') as HTMLSelectElement
          )?.value as StaffRoleTier) || 'MODERATOR';
        if (!uid || !email) return;
        callbacks.onAssignStaffRole({
          targetUid: uid,
          email,
          role,
          permissions:
            role === 'SUPER_ADMIN'
              ? 'ALL_ADMIN_GM_MOD_CONTROLS'
              : role === 'GM'
              ? 'GM_TELEMETRY_AND_EVENT_OVERRIDE'
              : role === 'ADMIN'
              ? 'CATALOG_AND_USER_ADMIN'
              : 'COMMENT_AND_STREAM_MODERATION',
          contactHandle: `Staff (${role}) · Escalate to ${PRIMARY_ADMIN_EMAIL}`,
        });
      });

    document.querySelectorAll('[data-role-revoke]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = (btn as HTMLElement).dataset.roleRevoke;
        if (uid) callbacks.onRevokeStaffRole(uid);
      });
    });

    // Content Reports Review Queue events
    document
      .getElementById('admin-btn-open-report-modal')
      ?.addEventListener('click', () => callbacks.onOpenReportModal());

    document.querySelectorAll('[data-admin-report-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = (btn as HTMLElement).dataset.adminReportFilter as
          | 'ALL'
          | ContentReportStatus;
        if (st) callbacks.onFilterContentReportStatus(st);
      });
    });

    document.querySelectorAll('[data-admin-report-review]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const id = el.dataset.adminReportReview;
        const status = (el.dataset.adminReportStatus ||
          'ACTIONED') as ContentReportStatus;
        const severity = (el.dataset.adminReportSev ||
          'MEDIUM') as ContentReportSeverity;
        const removeTarget = el.dataset.adminReportRemove === 'true';
        if (!id) return;
        const input = document.getElementById(
          `admin-report-notes-${id}`
        ) as HTMLInputElement | null;
        const notes =
          input?.value.trim() ||
          `Reviewed (${status}) by Admin/GM/Moderator (${PRIMARY_ADMIN_EMAIL}).`;
        callbacks.onReviewContentReport(
          id,
          status,
          severity,
          notes,
          removeTarget
        );
      });
    });

    document.querySelectorAll('[data-admin-report-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.adminReportDel;
        if (id) callbacks.onDeleteContentReport(id);
      });
    });
  }

  private static renderContentReportsSection(props: AdminConsoleProps): string {
    const filtered =
      props.reportFilterStatus === 'ALL'
        ? props.contentReports
        : props.contentReports.filter((r) => r.status === props.reportFilterStatus);
    const pendingCount = props.contentReports.filter(
      (r) => r.status === 'OPEN' || r.status === 'IN_REVIEW'
    ).length;

    return `
      <div class="rounded-xl bg-white dark:bg-[#0f1526] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm flex flex-col gap-3.5" id="admin-content-reports-panel">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Reported Content Review Queue · Firestore (/content_reports)
              </h2>
              <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold ${
                pendingCount > 0
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              }">
                ${pendingCount} Pending · ${props.contentReports.length} Total Reports
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review user-submitted content reports from Lumen Video &amp; 32K Studio Streams. Assigned to <strong class="font-mono-code text-indigo-600 dark:text-sky-300">${PRIMARY_ADMIN_EMAIL}</strong>.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              id="admin-btn-open-report-modal"
              class="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 cursor-pointer mr-1"
            >
              + New Content Report
            </button>
            ${(['ALL', 'OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED'] as const)
              .map(
                (st) => `
              <button
                type="button"
                data-admin-report-filter="${st}"
                class="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                  props.reportFilterStatus === st
                    ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222]'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }"
              >
                ${st}
              </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          ${
            filtered.length === 0
              ? `<div class="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-lg">
                   No content reports found in "${props.reportFilterStatus}" status.
                 </div>`
              : filtered
                  .map(
                    (rep) => `
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                        rep.severity === 'CRITICAL' || rep.severity === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                          : rep.severity === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }">${escHtml(rep.severity)}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-mono-code font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                        ${escHtml(rep.targetType)} · ${escHtml(rep.reason)}
                      </span>
                      <span class="font-bold text-xs text-slate-900 dark:text-white">${escHtml(rep.targetTitle)}</span>
                      <span class="text-[11px] font-mono-code text-slate-500">[ID: ${escHtml(rep.targetId)}]</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] font-mono-code font-bold ${
                        rep.status === 'ACTIONED'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : rep.status === 'DISMISSED'
                          ? 'text-slate-500'
                          : 'text-amber-600 dark:text-amber-400'
                      }">● ${escHtml(rep.status)}</span>
                      <button
                        type="button"
                        data-admin-report-del="${escHtml(rep.id)}"
                        class="text-[11px] text-rose-500 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p class="text-xs text-slate-700 dark:text-slate-300">${escHtml(rep.details)}</p>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono-code">
                    Reporter: ${escHtml(rep.reporterName)} (${escHtml(rep.reporterId)}) → Assigned Admin: ${escHtml(rep.assignedAdminEmail)}
                  </div>
                  ${
                    rep.resolutionNotes
                      ? `<div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-200">
                           <strong class="font-mono-code">[Official Admin Review · ${PRIMARY_ADMIN_EMAIL}]:</strong> ${escHtml(rep.resolutionNotes)}
                         </div>`
                      : ''
                  }
                  <div class="flex flex-wrap gap-2 pt-1">
                    <input
                      type="text"
                      id="admin-report-notes-${escHtml(rep.id)}"
                      value="${escHtml(rep.resolutionNotes || '')}"
                      placeholder="Write official Admin / Moderator review notes (${PRIMARY_ADMIN_EMAIL})..."
                      class="flex-1 min-w-[200px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
                    />
                    <button
                      type="button"
                      data-admin-report-review="${escHtml(rep.id)}"
                      data-admin-report-status="IN_REVIEW"
                      data-admin-report-sev="${escHtml(rep.severity)}"
                      class="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
                    >
                      In Review
                    </button>
                    <button
                      type="button"
                      data-admin-report-review="${escHtml(rep.id)}"
                      data-admin-report-status="ACTIONED"
                      data-admin-report-sev="${escHtml(rep.severity)}"
                      class="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      Mark Actioned
                    </button>
                    <button
                      type="button"
                      data-admin-report-review="${escHtml(rep.id)}"
                      data-admin-report-status="ACTIONED"
                      data-admin-report-sev="CRITICAL"
                      data-admin-report-remove="true"
                      class="px-2.5 py-1 rounded text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                    >
                      Remove Content &amp; Action
                    </button>
                    <button
                      type="button"
                      data-admin-report-review="${escHtml(rep.id)}"
                      data-admin-report-status="DISMISSED"
                      data-admin-report-sev="LOW"
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
}
