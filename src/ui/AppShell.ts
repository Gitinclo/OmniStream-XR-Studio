import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  publishVideoToFirestore,
  subscribeToComments,
  addVideoComment,
  deleteVideoComment,
  syncPlaybackProgress,
  createUserPlaylist,
  fetchUserPlaylists,
  PRIMARY_ADMIN_EMAIL,
  isMasterAdminUser,
  ensureAdminRoleForMasterUser,
  assignStaffRole,
  fetchStaffRoles,
  removeStaffRole,
  createModerationTicket,
  fetchModerationTickets,
  resolveModerationTicket,
  deleteModerationTicket,
  submitContentReport,
  fetchContentReports,
  subscribeToContentReports,
  reviewContentReport,
  deleteContentReport,
  verifyServerEntitlement,
  setAdminUserPremiumEntitlement,
  fetchMySubscriptionState,
  checkoutSubscriptionOnServer,
  cancelSubscriptionOnServer,
  CommentRecord,
  PlaylistRecord,
  AdminRoleRecord,
  ModerationTicketRecord,
  ModerationTicketCategory,
  ContentReportRecord,
  ContentReportReason,
  ContentReportTargetType,
  ContentReportSeverity,
  ContentReportStatus,
} from '../services/firebase';
import {
  BillingCycle,
  SubscriptionInvoiceRecord,
  SubscriptionPlanId,
  UserSubscriptionRecord,
  createDefaultFreeSubscription,
} from '../services/subscriptionEngine';
import { SubscriptionView } from './SubscriptionView';
import {
  fetchDriveFiles,
  fetchCalendarEvents,
  fetchGmailMessages,
  fetchTasksList,
  fetchContactsList,
  fetchChatSpaces,
  createCalendarBroadcastEvent,
  saveManifestToDrive,
  WorkspaceSummaryItem,
} from '../services/workspace';
import {
  fetchProteinWorkbench,
  ScienceWorkbenchData,
} from '../services/science';
import {
  SpatialStudioScript,
  GameHudSnapshot,
  studioSynth,
} from '../scene/SpatialStudio';
import {
  StudioDashboard,
  AnalyticsTimeframe,
} from './StudioDashboard';
import {
  fetchMyYouTubeChannel,
  fetchLikedYouTubeVideos,
  fetchYouTubeVideoById,
  rateYouTubeVideo,
  getYouTubeQuotaTelemetry,
  clearYouTubeCache,
  YouTubeChannelProfile,
  YouTubeLikedVideo,
} from '../services/youtube';
import {
  YouTubeLikesView,
  YouTubeSortMode,
} from './YouTubeLikesView';
import { LumenPlatformManager, showLumenToast } from './LumenPlatformView';
import { AdminConsoleView } from './AdminConsoleView';
import {
  buildCanonicalAadContext,
  encryptAes256GcmWithAad,
  decryptAes256GcmWithAad,
  encryptChunkedStreamAes256Gcm,
  decryptChunkedStreamAes256Gcm,
} from '../services/cryptoAes256';
import {
  hardwareGovernor,
  RefreshRateMode,
  GpuRenderScaleMode,
  ThermalStatusLevel,
} from '../services/hardwareGovernor';
import {
  NicheKey,
  getNichePreset,
  InputBoundsValidator,
  PipelineStage,
  getNextPipelineStage,
  evaluateGuestLifecycleAt,
} from '../services/vibePitchEngine';
import { GuardrailCategoryId } from '../services/complianceAndGuardrails';
import {
  SuiteUiState,
  HardwareTelemetryHud,
  renderHeaderSuiteControls,
  renderFloatingTelemetryHud,
  renderHardwareHudModal,
  renderComplianceHubModal,
  renderUnifiedWorkspaceAndVaultView,
} from './ComplianceAndHardwareModals';

export interface StreamVideoItem {
  id: string;
  title: string;
  author: string;
  resolution: '4K' | '8K' | '32K';
  category: string;
  ageRating: 'ALL' | 'TEEN' | 'MATURE';
  views: string;
  videoUrl: string;
  durationSec: number;
}

const CATALOG_VIDEOS: StreamVideoItem[] = [
  {
    id: 'vid_spatial_8k',
    title: 'Orbital 32K Spatial Cinema: Deep Space Telemetry & Volumetric Lightfields',
    author: 'OmniStream Master Lab',
    resolution: '32K',
    category: 'Spatial XR',
    ageRating: 'ALL',
    views: '1.4M',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    durationSec: 596,
  },
  {
    id: 'vid_alphafold_8k',
    title: 'AlphaFold Molecular Dynamics: Real-Time TP53 & Ribosome Folding in 8K',
    author: 'DeepBio Structural Channel',
    resolution: '8K',
    category: 'Bioscience',
    ageRating: 'ALL',
    views: '840K',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    durationSec: 653,
  },
  {
    id: 'vid_cyber_stream',
    title: 'Global Production Pipeline: Low-Latency Edge Encoding & Distributed CDN Architecture',
    author: 'Cloud Scale Engineering',
    resolution: '32K',
    category: 'Engineering',
    ageRating: 'TEEN',
    views: '620K',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationSec: 15,
  },
];

export type ActiveTab =
  | 'LUMEN_PLATFORM'
  | 'SUBSCRIPTION'
  | 'ADMIN_CONSOLE'
  | 'YOUTUBE_LIKES'
  | 'STUDIO_DASHBOARD'
  | 'GAME_3D'
  | 'STREAM_HUB'
  | 'AI_STUDIO'
  | 'INTELLIGENCE'
  | 'SCIENCE'
  | 'WORKSPACE_SECURITY';

export class AppShell {
  private studio: SpatialStudioScript;
  private root: HTMLElement;
  private activeTab: ActiveTab = 'LUMEN_PLATFORM';
  private dockCollapsed = false;
  private darkMode = true;
  private lumen = new LumenPlatformManager();

  // Auth & User State
  private currentUser: User | null = null;
  private needsAuth = true;

  // Administration / GM / Admin / Moderator Control & Contact State (creatergame31@gmail.com)
  private staffRoles: AdminRoleRecord[] = [
    {
      targetUid: 'master_admin_creatergame31',
      email: PRIMARY_ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      permissions: 'administration,gm,admin,moderator,contact',
      assignedByUid: 'master_admin_creatergame31',
    },
  ];
  private moderationTickets: ModerationTicketRecord[] = [
    {
      id: 'tkt_seed_gm_01',
      ownerId: 'usr_orbital_pilot',
      senderName: 'Orbital Pilot #42 (pilot@omnistream.xr)',
      recipientEmail: PRIMARY_ADMIN_EMAIL,
      category: 'GM',
      subject: 'Packet Runner 32K Tournament Wave Calibration',
      message: `Requesting GM (${PRIMARY_ADMIN_EMAIL}) approval for 64 Gbps orbital relay wave boost during live stream.`,
      status: 'IN_REVIEW',
      adminReply: `Approved by GM (${PRIMARY_ADMIN_EMAIL}). GM Invulnerability & +32 Gbps Boost enabled in Control Deck.`,
    },
    {
      id: 'tkt_seed_mod_02',
      ownerId: 'usr_creator_wave',
      senderName: 'Wave Lab Creator (wavelab@lumen.video)',
      recipientEmail: PRIMARY_ADMIN_EMAIL,
      category: 'MODERATOR',
      subject: 'Featured Placement & Comment Moderation Verification',
      message: `Hello Admin/Moderator (${PRIMARY_ADMIN_EMAIL}), please verify comment moderation filters on "Build a synth from scratch in 20 minutes".`,
      status: 'OPEN',
      adminReply: '',
    },
  ];
  private adminTicketFilter: 'ALL' | ModerationTicketCategory = 'ALL';
  private adminStatusBanner = `Official Administration, Game Master (GM), Admin & Moderator authority active for ${PRIMARY_ADMIN_EMAIL}.`;

  // Reported Content Review Queue State (Firestore /content_reports)
  private contentReports: ContentReportRecord[] = [
    {
      id: 'rep_seed_01',
      targetId: 's1',
      targetType: 'LUMEN_VIDEO',
      targetTitle: 'Speedrun: the whole game in under an hour (Pixel Pete)',
      reporterId: 'usr_viewer_901',
      reporterName: 'Alex Mercer (viewer@omnistream.xr)',
      assignedAdminEmail: PRIMARY_ADMIN_EMAIL,
      reason: 'SPAM_OR_MISLEADING',
      severity: 'MEDIUM',
      details: 'Timestamp at 34:12 appears to use an unverified splice cut; requesting GM & Moderator verification.',
      status: 'OPEN',
      resolutionNotes: '',
    },
    {
      id: 'rep_seed_02',
      targetId: 'vid_cyber_stream',
      targetType: 'STUDIO_STREAM',
      targetTitle: 'Global Production Pipeline: Low-Latency Edge Encoding & Distributed CDN Architecture',
      reporterId: 'usr_sec_auditor',
      reporterName: 'Compliance Auditor (sec@omnistream.xr)',
      assignedAdminEmail: PRIMARY_ADMIN_EMAIL,
      reason: 'AGE_RESTRICTION_VIOLATION',
      severity: 'HIGH',
      details: 'Stream contains enterprise infrastructure topology diagrams that should be restricted to TEEN/MATURE tier.',
      status: 'IN_REVIEW',
      resolutionNotes: `Flagged for age-rating verification by ${PRIMARY_ADMIN_EMAIL}.`,
    },
  ];
  private reportFilterStatus: 'ALL' | ContentReportStatus = 'ALL';
  private unsubscribeContentReports?: () => void;
  private pendingContentReportModal: {
    targetId: string;
    targetType: ContentReportTargetType;
    targetTitle: string;
  } | null = null;

  // Streaming & Studio Dashboard State
  private videos: StreamVideoItem[] = [...CATALOG_VIDEOS];
  private currentVideo: StreamVideoItem = CATALOG_VIDEOS[0];
  private selectedBitrate = '32K Master (Auto ABR)';
  private searchFilter = '';
  private categoryFilter = 'ALL';
  private parentalSafeMode = false;
  private isPremiumAdFree = false;
  private backgroundAudioMode = false;
  private offlineCachedIds = new Set<string>(['vid_spatial_8k', 'vid_alphafold_8k']);
  private comments: CommentRecord[] = [];
  private playlists: PlaylistRecord[] = [];
  private unsubscribeComments?: () => void;

  // Live Broadcast & Analytics State
  private isLiveStreaming = true;
  private liveUptimeSec = 5142;
  private liveViewerCount = 18420;
  private liveIngestGbps = 32.4;
  private liveDroppedFrames = 0;
  private analyticsTimeframe: AnalyticsTimeframe = '28d';
  private analyticsSearch = '';
  private lastSyncedAt = 'just now';
  private liveTimerId?: number;

  // Game HUD State
  private gameHud: GameHudSnapshot = {
    state: 'TITLE',
    score: 0,
    bandwidthGbps: 32.0,
    health: 100,
    wave: 1,
    muted: false,
  };

  // AI Studio & Intelligence State
  private aiStatusMessage = '';
  private generatedImageUrl = '';
  private generatedVideoUrl = '';
  private generatedMusicUrl = '';
  private generatedMusicLyrics = '';
  private generatedTtsUrl = '';
  private transcriptionText = '';
  private uploadedMediaBase64 = '';
  private uploadedMediaMime = 'image/png';

  // Live API WebSocket State
  private liveWs: WebSocket | null = null;
  private liveConnected = false;
  private liveTranscripts: string[] = [];
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private nextStartTime = 0;

  // Chat & Grounding State
  private chatHistory: Array<{ role: 'user' | 'model'; text: string }> = [
    {
      role: 'model',
      text: 'Welcome to OmniStream XR Studio! Ask me to analyze media, optimize 32K encoding, search the web, or scout studio locations.',
    },
  ];
  private groundingOutput = '';
  private groundingLinks: Array<{ title: string; uri: string }> = [];

  // Science Workbench State
  private scienceData: ScienceWorkbenchData | null = null;
  private scienceLoading = false;

  // Workspace & Confirmation Modal State
  private workspaceItems: WorkspaceSummaryItem[] = [];
  private workspaceStatus = '';
  private pendingConfirmation: {
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null = null;

  // E2E Encryption Vault & Integrated Suite State (AES-256-GCM + AAD, 90Hz Hardware HUD, 100 Guardrails, VibePitch Studio)
  private encryptedVaultCipher = '';
  private decryptedVaultPlain = '';
  private suiteState: SuiteUiState = {
    hardwareHudModalOpen: false,
    hardwareHudFloatingCollapsed: false,
    complianceHubModalOpen: false,
    complianceActiveTab: 'DOCS_8',
    selectedComplianceDocFilename: 'README.md',
    guardrailCategoryFilter: 'ALL',
    guardrailSearchQuery: '',
    hardwareTelemetry: hardwareGovernor.getSnapshot(),
    hardwareStatusBanner: '',
    vaultPlaintext: 'Confidential 32K Production Key & HIPAA Patient Consent Log',
    vaultUserId: PRIMARY_ADMIN_EMAIL,
    vaultRecordId: 'vault_rec_32k_master',
    vaultEnvelope: null,
    vaultDecryptedText: '',
    vaultTamperStatus: '',
    vaultChunkStreamResult: null,
    vaultChunkRestoredPreview: '',
    vibeSelectedNiche: NicheKey.HOME_TRADES,
    vibeBusinessName: 'Apex 24/7 HVAC & Plumbing',
    vibeContactName: 'Marcus Vance',
    vibeWebsiteGap: 'No sticky mobile click-to-call button or 60-second emergency quote estimator.',
    vibeSetupFee: 550,
    vibeMonthlyRetainer: 65,
    vibeDepositPercent: 50,
    vibeSimulatedTrialDay: 1,
    vibeLeads: [
      {
        id: 'lead_seed_01',
        niche: NicheKey.HOME_TRADES,
        businessName: 'Apex 24/7 HVAC & Plumbing',
        contactName: 'Marcus Vance',
        websiteGapNote: 'No mobile emergency quote funnel',
        setupFeeOffer: 550,
        monthlyRetainerOffer: 65,
        depositPercent: 50,
        stage: PipelineStage.PITCHED,
      },
      {
        id: 'lead_seed_02',
        niche: NicheKey.SAAS_AI_REMEDIATION,
        businessName: 'NovaCloud AI Analytics',
        contactName: 'Elena Rostova',
        websiteGapNote: 'Needs Firestore RBAC + AES-256-GCM + 90Hz optimization audit',
        setupFeeOffer: 1650,
        monthlyRetainerOffer: 249,
        depositPercent: 50,
        stage: PipelineStage.DEPOSIT_PAID,
      },
    ],
    vibeStatusBanner: '',
  };

  // YouTube Data API v3 Likes Manager State
  private ytChannel: YouTubeChannelProfile | null = null;
  private ytVideos: YouTubeLikedVideo[] = [];
  private ytLoading = false;
  private ytError = '';
  private ytStatus = '';
  private ytSearchQuery = '';
  private ytSortMode: YouTubeSortMode = 'DEFAULT';
  private ytNextPageToken?: string;
  private ytPrevPageToken?: string;
  private ytTotalResults = 0;
  private ytFromCache = false;

  // Subscription & Billing State (Server-Governed Entitlements & Quota)
  private currentSubscription: UserSubscriptionRecord = {
    ...createDefaultFreeSubscription('guest_preview', undefined, false),
    verifiedBy: 'GUEST_PREVIEW_SANDBOX',
  };
  private subscriptionInvoices: SubscriptionInvoiceRecord[] = [];
  private selectedBillingCycle: BillingCycle = 'MONTHLY';
  private paymentMethodLast4 = '4242';
  private remainingDailyQuotaUnits = 250;
  private subscriptionStatusBanner =
    'Plans & Server Entitlement Authority active. Upgrade to Pro 8K ($19/mo) or Studio 32K ($49/mo) to unlock ad-free playback and expanded Gemini Studio quota.';
  private subscriptionSubmitting = false;

  constructor(studio: SpatialStudioScript) {
    this.studio = studio;
    this.root = document.getElementById('root') || document.body;
    this.init();
  }

  public updateGameHud(snapshot: GameHudSnapshot) {
    this.gameHud = snapshot;
    if (this.activeTab === 'GAME_3D' || this.activeTab === 'ADMIN_CONSOLE') {
      this.render();
    }
  }

  private init() {
    initAuth(
      (user) => {
        this.currentUser = user;
        this.needsAuth = false;
        this.attachCommentListener(this.currentVideo.id);
        fetchUserPlaylists()
          .then((list) => {
            this.playlists = list;
            this.render();
          })
          .catch(() => {});
        verifyServerEntitlement()
          .then((entitlement) => {
            this.isPremiumAdFree = entitlement.isPremium;
            this.render();
          })
          .catch(() => {});
        fetchMySubscriptionState()
          .then((subState) => {
            this.currentSubscription = subState.subscription;
            this.subscriptionInvoices = subState.invoices;
            this.isPremiumAdFree = subState.entitlement.isPremium;
            this.remainingDailyQuotaUnits = subState.remainingDailyQuotaUnits;
            this.render();
          })
          .catch(() => {});
        void this.loadYouTubeLikesData();
        void this.syncAdminAndModerationData(user);
        this.render();
      },
      () => {
        if (this.unsubscribeComments) {
          this.unsubscribeComments();
          this.unsubscribeComments = undefined;
        }
        if (this.unsubscribeContentReports) {
          this.unsubscribeContentReports();
          this.unsubscribeContentReports = undefined;
        }
        this.comments = [];
        this.currentUser = null;
        this.isPremiumAdFree = false;
        this.currentSubscription = {
          ...createDefaultFreeSubscription('guest_preview', undefined, false),
          verifiedBy: 'GUEST_PREVIEW_SANDBOX',
        };
        this.remainingDailyQuotaUnits = 250;
        this.needsAuth = true;
        this.render();
      }
    );

    this.loadScienceIdentifier('P04637');

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyH') {
        this.dockCollapsed = !this.dockCollapsed;
        this.render();
      }
      if (this.activeTab === 'LUMEN_PLATFORM') {
        const v = document.getElementById('lumen-vid') as HTMLVideoElement | null;
        if (v) {
          if (e.key === ' ') {
            e.preventDefault();
            if (v.paused) void v.play();
            else v.pause();
          } else if (e.key === 'f' || e.key === 'F') {
            if (v.requestFullscreen) void v.requestFullscreen();
          } else if (e.key === 'j' || e.key === 'J') {
            v.currentTime = Math.max(0, v.currentTime - 10);
          } else if (e.key === 'l' || e.key === 'L') {
            v.currentTime += 10;
          }
        }
      }
      if (
        (e.code === 'Enter' || e.code === 'Space') &&
        this.activeTab === 'GAME_3D' &&
        this.gameHud.state === 'TITLE'
      ) {
        this.studio.startGame();
      }
    });

    document.documentElement.classList.toggle('dark', this.darkMode);

    this.liveTimerId = window.setInterval(() => {
      if (this.isLiveStreaming) {
        this.liveUptimeSec += 1;
        const uptimeEl = document.querySelector('#dash-live-uptime');
        if (uptimeEl) {
          uptimeEl.textContent = StudioDashboard.formatDuration(this.liveUptimeSec);
        }
      }
    }, 1000);

    // Subscribe to 2Hz Hardware Telemetry Governor updates for live HUD refresh
    hardwareGovernor.subscribe((hwState) => {
      this.suiteState.hardwareTelemetry = hwState;
      HardwareTelemetryHud.updateLiveDom(hwState);
    });

    this.render();
  }

  private async syncAdminAndModerationData(user: User) {
    try {
      if (isMasterAdminUser(user)) {
        await ensureAdminRoleForMasterUser(user);
      }
      const [cloudRoles, cloudTickets, cloudReports] = await Promise.all([
        fetchStaffRoles().catch(() => [] as AdminRoleRecord[]),
        fetchModerationTickets().catch(() => [] as ModerationTicketRecord[]),
        fetchContentReports().catch(() => [] as ContentReportRecord[]),
      ]);
      if (cloudRoles.length > 0) {
        const hasMaster = cloudRoles.some(
          (r) => r.email.toLowerCase() === PRIMARY_ADMIN_EMAIL
        );
        this.staffRoles = hasMaster
          ? cloudRoles
          : [this.staffRoles[0], ...cloudRoles];
      }
      if (cloudTickets.length > 0) {
        this.moderationTickets = cloudTickets;
      }
      if (cloudReports.length > 0) {
        this.contentReports = cloudReports;
      }
      if (this.unsubscribeContentReports) {
        this.unsubscribeContentReports();
      }
      this.unsubscribeContentReports = subscribeToContentReports((reports) => {
        if (reports.length > 0) {
          this.contentReports = reports;
          if (
            this.activeTab === 'STUDIO_DASHBOARD' ||
            this.activeTab === 'ADMIN_CONSOLE'
          ) {
            this.render();
          }
        }
      });
      this.render();
    } catch {
      // Keep local seed records if guest or offline
    }
  }

  private async loadYouTubeLikesData(options?: {
    pageToken?: string;
    forceRefresh?: boolean;
  }) {
    this.ytLoading = true;
    this.ytError = '';
    this.render();
    try {
      const [channel, likesPage] = await Promise.all([
        fetchMyYouTubeChannel(Boolean(options?.forceRefresh)),
        fetchLikedYouTubeVideos({
          pageToken: options?.pageToken,
          forceRefresh: options?.forceRefresh,
          maxResults: 12,
        }),
      ]);
      this.ytChannel = channel;
      this.ytVideos = likesPage.items;
      this.ytNextPageToken = likesPage.nextPageToken;
      this.ytPrevPageToken = likesPage.prevPageToken;
      this.ytTotalResults = likesPage.totalResults;
      this.ytFromCache = likesPage.fromCache;
      this.needsAuth = false;
      this.ytStatus = likesPage.fromCache
        ? 'Loaded liked videos from in-memory cache (0 API quota units used).'
        : `Fetched ${likesPage.items.length} liked videos from YouTube Data API v3.`;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('NEEDS_AUTH')) {
        this.needsAuth = true;
        this.ytError = 'Please sign in with Google to grant YouTube permission and view your liked videos.';
      } else {
        this.ytError = msg;
      }
    } finally {
      this.ytLoading = false;
      this.render();
    }
  }

  private attachCommentListener(videoId: string) {
    if (this.unsubscribeComments) {
      this.unsubscribeComments();
      this.unsubscribeComments = undefined;
    }
    if (!this.currentUser) {
      this.comments = [];
      return;
    }
    this.unsubscribeComments = subscribeToComments(videoId, (list) => {
      this.comments = list;
      if (
        this.activeTab === 'STREAM_HUB' ||
        this.activeTab === 'STUDIO_DASHBOARD' ||
        this.activeTab === 'ADMIN_CONSOLE'
      ) {
        this.render();
      }
    });
  }

  private async loadScienceIdentifier(id: string) {
    this.scienceLoading = true;
    this.render();
    try {
      this.scienceData = await fetchProteinWorkbench(id);
      this.studio.setScienceMode(this.activeTab === 'SCIENCE', this.scienceData.accession);
    } catch (err) {
      console.error('Science fetch error:', err);
    } finally {
      this.scienceLoading = false;
      this.render();
    }
  }

  private renderGoogleSignInButton(): string {
    return `
      <button id="btn-google-signin" class="gsi-material-button">
        <div class="gsi-material-button-state"></div>
        <div class="gsi-material-button-content-wrapper">
          <div class="gsi-material-button-icon">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          </div>
          <span class="gsi-material-button-contents">Sign in with Google</span>
        </div>
      </button>
    `;
  }

  public render() {
    const is3DView = this.activeTab === 'GAME_3D' || this.activeTab === 'SCIENCE';
    document.body.classList.toggle('xr-view-active', is3DView);

    const themeBg = this.darkMode
      ? 'bg-[#090d16] text-slate-100 border-slate-800'
      : 'bg-white text-slate-900 border-slate-200';

    const mainContainerBg = is3DView
      ? 'pointer-events-none flex items-center justify-center'
      : this.darkMode
      ? 'pointer-events-auto bg-[#0e1222] flex flex-col'
      : 'pointer-events-auto bg-[#f4f6fb] flex flex-col';

    this.root.innerHTML = `
      <div class="fixed inset-0 pointer-events-none flex flex-col justify-between z-20 select-none">
        <!-- Unified Top Application Header & Mode Switcher -->
        <header class="pointer-events-auto flex flex-col ${themeBg} border-b shadow-sm">
          <!-- Primary Brand & Utility Row -->
          <div class="flex items-center justify-between gap-2 px-3.5 md:px-6 py-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
                <rect x="2" y="4" width="28" height="24" rx="6" fill="#3a4bff"/>
                <polygon points="13,10 22,16 13,22" fill="#f8fafc"/>
              </svg>
              <div class="flex items-center gap-2 truncate">
                <span class="font-bold tracking-tight text-sm md:text-base truncate">OMNISTREAM XR</span>
                <span class="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono-code">32K ULTRA · E2EE</span>
                <button
                  type="button"
                  id="btn-header-admin-contact"
                  title="Official Administration, Game Master (GM), Admin & Moderator Contact: ${PRIMARY_ADMIN_EMAIL}"
                  class="hidden lg:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border border-indigo-500/30 font-mono-code hover:bg-indigo-500/25 cursor-pointer"
                >
                  <span>🛡 Admin / GM / Mod: ${PRIMARY_ADMIN_EMAIL}</span>
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              ${renderHeaderSuiteControls(this.suiteState.hardwareTelemetry)}
              <button id="btn-toggle-theme" class="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:opacity-90 cursor-pointer">
                ${this.darkMode ? '☀ Light' : '☾ Dark'}
              </button>
              <button id="btn-mute-synth" class="hidden md:inline-flex px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:opacity-90 cursor-pointer">
                ${studioSynth.muted ? 'Audio: Muted' : 'Audio: Active'}
              </button>
              ${
                this.currentUser
                  ? `<div class="flex items-center gap-2">
                       <span class="text-xs text-sky-500 dark:text-sky-300 font-mono-code hidden lg:inline">${this.currentUser.displayName || this.currentUser.email}</span>
                       <button id="btn-logout" class="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-500 cursor-pointer">Sign Out</button>
                     </div>`
                  : this.renderGoogleSignInButton()
              }
            </div>
          </div>

          <!-- Horizontal Workspace Navigation Bar (Scrollable on Mobile, Zero Overlap) -->
          <nav aria-label="Workspace navigation" class="flex items-center gap-1.5 px-3.5 md:px-6 py-1.5 overflow-x-auto border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#0c101d]">
            ${this.renderDockTabButton('LUMEN_PLATFORM', 'Lumen Video')}
            ${this.renderDockTabButton('SUBSCRIPTION', '💎 Plans & Billing')}
            ${this.renderDockTabButton('ADMIN_CONSOLE', '🛡 Admin / GM & Contact')}
            ${this.renderDockTabButton('YOUTUBE_LIKES', 'YouTube Likes')}
            ${this.renderDockTabButton('STUDIO_DASHBOARD', 'Studio Dashboard')}
            ${this.renderDockTabButton('STREAM_HUB', '8K/32K Stream Hub')}
            ${this.renderDockTabButton('AI_STUDIO', 'Live & AI Studio')}
            ${this.renderDockTabButton('INTELLIGENCE', 'Gemini 4 Intelligence')}
            ${this.renderDockTabButton('GAME_3D', '3D Rig & Game')}
            ${this.renderDockTabButton('SCIENCE', 'Bioscience 3D')}
            ${this.renderDockTabButton('WORKSPACE_SECURITY', 'Workspace & Vault')}
          </nav>
        </header>

        <!-- Center Content Area -->
        <main class="flex-1 relative overflow-hidden ${mainContainerBg}">
          ${this.renderActiveView()}
        </main>

        <!-- 3D Rig Controls Footer (Shown ONLY on 3D Views so 2D views have 100% clean viewport) -->
        ${
          is3DView
            ? `<footer class="pointer-events-auto flex flex-col items-center pb-3 px-3">
                <button id="btn-toggle-dock" class="mb-1 px-3 py-1 text-xs font-mono-code rounded-t bg-[#0f172a] text-sky-300 border border-b-0 border-slate-700 hover:bg-slate-800">
                  ${this.dockCollapsed ? '▴ Show 3D Rig Controls (H)' : '▾ Hide 3D Rig Controls (H)'}
                </button>
                ${
                  this.dockCollapsed
                    ? ''
                    : `<div class="rounded-xl bg-[#090d16]/95 border border-slate-700 px-4 py-2 shadow-2xl flex flex-wrap items-center justify-center gap-3">
                        <label class="flex items-center gap-2 text-xs text-slate-300 font-mono-code">
                          <span>Explode 3D Rig</span>
                          <input id="slider-explode" type="range" min="0" max="1" step="0.05" value="0" class="w-24 accent-sky-400" />
                        </label>
                        <button id="btn-cycle-finish" class="px-3 py-1 text-xs rounded bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700">
                          Cycle Finish
                        </button>
                        <button id="btn-cycle-camera" class="px-3 py-1 text-xs rounded bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700">
                          Camera Angle
                        </button>
                      </div>`
                }
              </footer>`
            : ''
        }

        ${this.renderConfirmationModal()}
        ${this.renderReportContentModal()}
        ${renderFloatingTelemetryHud(this.suiteState)}
        ${renderHardwareHudModal(this.suiteState)}
        ${renderComplianceHubModal(this.suiteState)}
      </div>
    `;

    this.bindEvents();
  }

  private renderDockTabButton(tab: ActiveTab, label: string): string {
    const active = this.activeTab === tab;
    return `
      <button data-tab="${tab}" class="btn-tab shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap ${
        active
          ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] font-semibold shadow-sm'
          : 'bg-white dark:bg-[#171c33] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#262d4a]'
      }">
        ${label}
      </button>
    `;
  }

  private renderActiveView(): string {
    if (this.activeTab === 'LUMEN_PLATFORM') {
      return this.lumen.render(() => this.render(), Boolean(this.currentUser));
    }
    if (this.activeTab === 'SUBSCRIPTION') {
      return SubscriptionView.render({
        currentUserEmail: this.currentUser?.email || null,
        currentUserUid: this.currentUser?.uid || null,
        isVerifiedMasterAdmin: isMasterAdminUser(this.currentUser),
        subscription: this.currentSubscription,
        invoices: this.subscriptionInvoices,
        selectedBillingCycle: this.selectedBillingCycle,
        paymentMethodLast4: this.paymentMethodLast4,
        remainingDailyQuotaUnits: this.remainingDailyQuotaUnits,
        statusBanner: this.subscriptionStatusBanner,
        isSubmitting: this.subscriptionSubmitting,
      });
    }
    if (this.activeTab === 'ADMIN_CONSOLE') {
      return AdminConsoleView.render({
        currentUserEmail: this.currentUser?.email || null,
        currentUserUid: this.currentUser?.uid || null,
        currentUserName: this.currentUser?.displayName || null,
        isVerifiedMasterAdmin: isMasterAdminUser(this.currentUser),
        gmOverrideActive: this.studio.gmOverrideActive,
        statusBanner: this.adminStatusBanner,
        gameHud: this.gameHud,
        studioVideos: this.videos,
        lumenVideos: this.lumen.vids,
        streamComments: this.comments,
        staffRoles: this.staffRoles,
        tickets: this.moderationTickets,
        filterCategory: this.adminTicketFilter,
        contentReports: this.contentReports,
        reportFilterStatus: this.reportFilterStatus,
      });
    }
    if (this.activeTab === 'YOUTUBE_LIKES') {
      return YouTubeLikesView.render({
        needsAuth: this.needsAuth,
        loading: this.ytLoading,
        errorMessage: this.ytError,
        statusMessage: this.ytStatus,
        channel: this.ytChannel,
        videos: this.ytVideos,
        searchQuery: this.ytSearchQuery,
        sortMode: this.ytSortMode,
        nextPageToken: this.ytNextPageToken,
        prevPageToken: this.ytPrevPageToken,
        totalResults: this.ytTotalResults,
        fromCache: this.ytFromCache,
        quota: getYouTubeQuotaTelemetry(),
        googleSignInButtonHtml: this.renderGoogleSignInButton(),
      });
    }
    if (this.activeTab === 'STUDIO_DASHBOARD') {
      return StudioDashboard.render({
        videos: this.videos,
        currentVideo: this.currentVideo,
        playlists: this.playlists,
        comments: this.comments,
        contentReports: this.contentReports,
        reportFilterStatus: this.reportFilterStatus,
        offlineCachedIds: this.offlineCachedIds,
        selectedBitrate: this.selectedBitrate,
        isLiveStreaming: this.isLiveStreaming,
        liveUptimeSec: this.liveUptimeSec,
        liveViewerCount: this.liveViewerCount,
        liveIngestGbps: this.liveIngestGbps,
        liveDroppedFrames: this.liveDroppedFrames,
        liveConnected: this.liveConnected,
        isPremiumAdFree: this.isPremiumAdFree,
        parentalSafeMode: this.parentalSafeMode,
        timeframe: this.analyticsTimeframe,
        categoryFilter: this.categoryFilter,
        analyticsSearch: this.analyticsSearch,
        lastSyncedAt: this.lastSyncedAt,
      });
    }
    if (this.activeTab === 'GAME_3D') {
      return this.renderGameShellView();
    }
    if (this.activeTab === 'STREAM_HUB') {
      return this.renderStreamHubView();
    }
    if (this.activeTab === 'AI_STUDIO') {
      return this.renderAiStudioView();
    }
    if (this.activeTab === 'INTELLIGENCE') {
      return this.renderIntelligenceView();
    }
    if (this.activeTab === 'SCIENCE') {
      return this.renderScienceWorkbenchView();
    }
    return this.renderWorkspaceAndSecurityView();
  }

  // 1. Full-Viewport 3D Game Shell & Spatial Rig View (>85% Unobstructed Playfield)
  private renderGameShellView(): string {
    const { state, score, bandwidthGbps, health, wave } = this.gameHud;

    if (state === 'TITLE') {
      return `
        <div class="pointer-events-auto flex flex-col items-center text-center max-w-lg p-6 rounded-2xl bg-[#090d16] border border-slate-800 shadow-2xl">
          <!-- Bespoke Inline SVG Title Lockup -->
          <svg width="260" height="64" viewBox="0 0 260 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-3">
            <rect x="4" y="8" width="252" height="48" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
            <circle cx="34" cy="32" r="14" fill="#0284c7"/>
            <polygon points="30,24 42,32 30,40" fill="#ffffff"/>
            <text x="60" y="30" fill="#f8fafc" font-family="Google Sans, sans-serif" font-weight="700" font-size="16">PACKET RUNNER 32K</text>
            <text x="60" y="46" fill="#38bdf8" font-family="JetBrains Mono, monospace" font-weight="600" font-size="11">SPATIAL CDN ROUTER SIM</text>
          </svg>
          <p class="text-xs text-slate-300 mb-4">
            Pilot the 8-part composite 32K Broadcast Rig across orbital CDN relays. Collect emerald 32K bandwidth packets and evade crimson congestion spikes.
          </p>
          <button id="btn-start-game" class="px-6 py-2.5 rounded-lg bg-sky-400 text-slate-950 font-bold text-sm hover:bg-sky-300 transition">
            START 32K TRANSMISSION (ENTER / SPACE)
          </button>
          <div class="mt-3 text-[11px] text-slate-400 font-mono-code">
            WASD Move · Space Action · Esc Pause
          </div>
        </div>
      `;
    }

    if (state === 'PAUSED' || state === 'VICTORY' || state === 'GAMEOVER') {
      const heading =
        state === 'VICTORY'
          ? '32K GLOBAL SYNC COMPLETE'
          : state === 'GAMEOVER'
          ? 'CDN LINK DROPPED'
          : 'TRANSMISSION PAUSED';
      return `
        <div class="pointer-events-auto flex flex-col items-center text-center max-w-md p-6 rounded-2xl bg-[#090d16] border border-slate-700 shadow-2xl">
          <h2 class="text-lg font-bold text-sky-400 mb-2">${heading}</h2>
          <p class="text-xs font-mono-code text-slate-300 mb-4 tabular-nums">
            Score: ${score} · Peak Throughput: ${bandwidthGbps} Gbps · Wave: ${wave}
          </p>
          <div class="flex gap-3">
            ${
              state === 'PAUSED'
                ? `<button id="btn-resume-game" class="px-4 py-2 rounded bg-sky-400 text-slate-950 font-bold text-xs">Resume (Esc)</button>`
                : ''
            }
            <button id="btn-start-game" class="px-4 py-2 rounded bg-emerald-400 text-slate-950 font-bold text-xs">
              Restart Run
            </button>
          </div>
        </div>
      `;
    }

    // Playing state: minimal top-left perimeter status cluster (<10% viewport footprint)
    return `
      <div class="absolute top-3 left-4 pointer-events-auto flex items-center gap-4 px-3.5 py-2 rounded-xl bg-[#090d16] border border-slate-800 font-mono-code text-xs tabular-nums">
        <div><span class="text-slate-400">SCORE</span> <span class="text-emerald-400 font-bold">${score}</span></div>
        <div><span class="text-slate-400">BITRATE</span> <span class="text-sky-400 font-bold">${bandwidthGbps} Gbps</span></div>
        <div><span class="text-slate-400">INTEGRITY</span> <span class="text-amber-400 font-bold">${health}%</span></div>
        <div><span class="text-slate-400">WAVE</span> <span class="text-purple-400 font-bold">${wave}</span></div>
        <button id="btn-resume-game" class="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700">Pause</button>
      </div>
    `;
  }

  // 2. 8K / 32K Video Streaming Hub, Playlists, Upload, Offline Playback & Firestore Comments
  private renderStreamHubView(): string {
    const filteredVideos = this.videos.filter((v) => {
      if (this.parentalSafeMode && v.ageRating !== 'ALL') return false;
      if (this.categoryFilter !== 'ALL' && v.category !== this.categoryFilter) return false;
      if (
        this.searchFilter &&
        !v.title.toLowerCase().includes(this.searchFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    return `
      <div class="pointer-events-auto w-full h-full flex-1 bg-[#090d16] p-4 md:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left 2 Columns: 8K/32K Adaptive Player + Comments -->
        <div class="lg:col-span-2 flex flex-col gap-3">
          <div class="relative rounded-xl overflow-hidden bg-black border border-slate-800">
            ${
              this.backgroundAudioMode
                ? `<div class="h-56 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
                     <span class="text-xs font-mono-code text-sky-400 mb-1">BACKGROUND AUDIO & OFFLINE PLAYBACK ACTIVE</span>
                     <p class="text-sm font-semibold">${this.currentVideo.title}</p>
                     <audio src="${this.currentVideo.videoUrl}" controls autoplay class="mt-3 w-full max-w-md"></audio>
                   </div>`
                : `<video id="main-video-player" src="${this.currentVideo.videoUrl}" controls class="w-full max-h-64 object-cover bg-black"></video>`
            }
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <div>
              <h2 class="text-sm font-bold text-white">${this.currentVideo.title}</h2>
              <p class="text-xs text-slate-400">${this.currentVideo.author} · ${this.currentVideo.views} views · Age: ${this.currentVideo.ageRating}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <select id="select-bitrate" class="bg-slate-950 text-sky-300 text-xs font-mono-code px-2.5 py-1.5 rounded border border-slate-700">
                <option value="32K Master (Auto ABR)" ${this.selectedBitrate.includes('32K') ? 'selected' : ''}>32K Master (Auto ABR)</option>
                <option value="8K Ultra HD (120fps)" ${this.selectedBitrate.includes('8K') ? 'selected' : ''}>8K Ultra HD (120fps)</option>
                <option value="4K Studio (60fps)" ${this.selectedBitrate.includes('4K') ? 'selected' : ''}>4K Studio (60fps)</option>
                <option value="1080p Low-Latency" ${this.selectedBitrate.includes('1080p') ? 'selected' : ''}>1080p Low-Latency</option>
              </select>
              <button id="btn-toggle-bgaudio" class="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-200 border border-slate-700">
                ${this.backgroundAudioMode ? 'Video Mode' : 'Background Audio'}
              </button>
              <button id="btn-cache-offline" class="px-2.5 py-1 text-xs rounded bg-emerald-900/80 text-emerald-200 border border-emerald-700">
                ${this.offlineCachedIds.has(this.currentVideo.id) ? 'Cached Offline ✓' : 'Save Offline'}
              </button>
              <a href="${this.currentVideo.videoUrl}" download class="px-2.5 py-1 text-xs rounded bg-sky-900 text-sky-200 border border-sky-700">
                Download 32K
              </a>
              <button
                type="button"
                id="btn-report-current-stream"
                class="px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 cursor-pointer"
              >
                ⚑ Report Content
              </button>
            </div>
          </div>

          <!-- Integrated Real-Time Comments Section -->
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex-1 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300">Encrypted Stream Comments (${this.comments.length})</span>
              <span class="text-[11px] font-mono-code text-sky-400">Cross-Device Synced</span>
            </div>
            <div class="flex gap-2">
              <input id="input-comment" type="text" maxlength="500" placeholder="Add a public comment on this 32K stream..." class="flex-1 bg-slate-950 text-xs text-white px-3 py-1.5 rounded border border-slate-700" />
              <button id="btn-post-comment" class="px-3 py-1.5 text-xs font-semibold rounded bg-sky-500 text-slate-950 hover:bg-sky-400">
                Post
              </button>
            </div>
            <div class="max-h-32 overflow-y-auto space-y-1.5 pt-1">
              ${
                this.comments.length === 0
                  ? `<p class="text-xs text-slate-500">No comments yet. Start the conversation!</p>`
                  : this.comments
                      .map(
                        (c) => `
                    <div class="flex items-center justify-between text-xs bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                      <div>
                        <span class="font-semibold text-sky-300">${c.authorName}:</span>
                        <span class="text-slate-200 ml-1">${c.text}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          data-report-comment-id="${c.id}"
                          data-report-comment-text="${c.text.replace(/"/g, '&quot;')}"
                          class="btn-report-comment text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          ⚑ Report
                        </button>
                        ${
                          this.currentUser?.uid === c.ownerId
                            ? `<button data-comment-id="${c.id}" class="btn-del-comment text-[10px] text-rose-400 hover:underline">Delete</button>`
                            : ''
                        }
                      </div>
                    </div>`
                      )
                      .join('')
              }
            </div>
          </div>
        </div>

        <!-- Right Column: Search Filters, Parental Controls, Upload & Playlists -->
        <div class="flex flex-col gap-3">
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-200">Personalized Discovery & Filters</span>
              <span class="text-[11px] px-2 py-0.5 rounded ${
                this.isPremiumAdFree ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
              }">${this.isPremiumAdFree ? 'PREMIUM AD-FREE' : 'STANDARD'}</span>
            </div>
            <input id="input-search-videos" type="text" value="${this.searchFilter}" placeholder="Filter 8K / 32K streams..." class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            <div class="flex flex-wrap gap-1.5">
              <button id="btn-toggle-parental" class="px-2 py-1 text-[11px] rounded border ${
                this.parentalSafeMode
                  ? 'bg-emerald-900 text-emerald-200 border-emerald-600'
                  : 'bg-slate-950 text-slate-400 border-slate-700'
              }">
                Parental Safe Mode: ${this.parentalSafeMode ? 'ON' : 'OFF'}
              </button>
              <button id="btn-toggle-premium" class="px-2 py-1 text-[11px] rounded border border-slate-700 bg-slate-950 text-amber-300 cursor-pointer" title="Premium status is verified by server-side entitlement authority (/api/entitlements/me)">
                ${isMasterAdminUser(this.currentUser) ? 'Admin Entitlement Override' : 'Verify Server Entitlement'}
              </button>
              <button id="btn-open-subscription-hub" class="px-2 py-1 text-[11px] font-semibold rounded border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 cursor-pointer">
                💎 Manage Subscription
              </button>
            </div>
          </div>

          <!-- VideoCatalog List -->
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2 max-h-48 overflow-y-auto">
            <div class="text-xs font-bold text-slate-300">32K Adaptive Stream Catalog</div>
            ${filteredVideos
              .map(
                (v) => `
              <div data-video-id="${v.id}" class="btn-select-video cursor-pointer p-2 rounded-lg border transition ${
                  v.id === this.currentVideo.id
                    ? 'bg-sky-950/80 border-sky-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-white line-clamp-1">${v.title}</span>
                  <span class="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-sky-900 text-sky-200">${v.resolution}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">${v.author} · ${v.category}</div>
              </div>`
              )
              .join('')}
          </div>

          <!-- Upload New 32K Video & Create Playlist -->
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-slate-200">Upload 8K/32K Stream or Playlist</div>
            <input id="input-upload-title" type="text" placeholder="Stream Title (e.g. 32K Live Concert)" class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            <div class="flex gap-2">
              <button id="btn-upload-video" class="flex-1 py-1.5 text-xs font-semibold rounded bg-sky-500 text-slate-950 hover:bg-sky-400">
                Publish 32K Video
              </button>
              <button id="btn-create-playlist" class="px-3 py-1.5 text-xs font-semibold rounded bg-purple-500 text-slate-950 hover:bg-purple-400">
                + Playlist (${this.playlists.length})
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Live & AI Studio (Gemini Live API, Omni Video 16:9/9:16, Nano Banana & Pro Image 1K/2K/4K, Lyria Music, TTS, Transcribe)
  private renderAiStudioView(): string {
    return `
      <div class="pointer-events-auto w-full h-full flex-1 bg-[#090d16] p-4 md:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Column 1: Gemini Live API Real-Time Voice & Audio Transcription -->
        <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-sky-400 uppercase">Gemini 3.8 Live Voice & Mic</span>
            <span class="text-[11px] font-mono-code text-slate-400">gemini-3.8-live</span>
          </div>
          <p class="text-xs text-slate-300">
            Have a real-time bidirectional voice conversation with your AI Broadcast Director or transcribe studio audio via <code class="text-sky-300">gemini-3.5-transcribe</code>.
          </p>
          <div class="flex gap-2">
            <button id="btn-toggle-live" class="flex-1 py-2 text-xs font-bold rounded-lg ${
              this.liveConnected
                ? 'bg-rose-500 text-white'
                : 'bg-emerald-400 text-slate-950'
            }">
              ${this.liveConnected ? 'Stop Live Voice Session' : 'Start Gemini Live Voice'}
            </button>
            <button id="btn-record-transcribe" class="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-sky-300 border border-slate-700">
              Transcribe Mic
            </button>
          </div>
          <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono-code text-slate-300 h-28 overflow-y-auto">
            ${
              this.liveTranscripts.length > 0
                ? this.liveTranscripts.map((t) => `<div>${t}</div>`).join('')
                : this.transcriptionText || 'Live voice & transcription output will appear here...'
            }
          </div>

          <!-- Dual-Speaker TTS (gemini-3.8-flash-tts) -->
          <div class="border-t border-slate-800 pt-2.5 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-amber-300">Voiceover TTS Studio</span>
              <span class="text-[10px] font-mono-code text-slate-400">gemini-3.8-flash-tts</span>
            </div>
            <input id="input-tts-text" type="text" value="Welcome back! <breath> Today we are streaming in 32K resolution." class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            <button id="btn-generate-tts" class="w-full py-1.5 text-xs font-semibold rounded bg-amber-400 text-slate-950 hover:bg-amber-300">
              Synthesize Broadcast Speech (WAV)
            </button>
            ${
              this.generatedTtsUrl
                ? `<audio src="${this.generatedTtsUrl}" controls autoplay class="w-full h-8 mt-1"></audio>`
                : ''
            }
          </div>
        </div>

        <!-- Column 2: Studio Image Generation & Editing (Nano Banana 2.1 & Gemini 3 Pro Image) -->
        <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-purple-400 uppercase">Thumbnail & Concept Image Lab</span>
            <span class="text-[10px] font-mono-code text-slate-400">1K / 2K / 4K</span>
          </div>
          <input id="input-image-prompt" type="text" value="Futuristic 32K holographic cinema hub floating in orbit" class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
          <div class="grid grid-cols-3 gap-1.5">
            <select id="select-image-model" class="bg-slate-950 text-xs text-slate-200 px-2 py-1.5 rounded border border-slate-700">
              <option value="gemini-nano-banana-2.1">gemini-nano-banana-2.1</option>
              <option value="gemini-3-pro-image-preview">gemini-3-pro-image</option>
            </select>
            <select id="select-image-size" class="bg-slate-950 text-xs text-sky-300 px-2 py-1.5 rounded border border-slate-700">
              <option value="1K">Size: 1K</option>
              <option value="2K">Size: 2K</option>
              <option value="4K">Size: 4K</option>
            </select>
            <select id="select-image-aspect" class="bg-slate-950 text-xs text-emerald-300 px-2 py-1.5 rounded border border-slate-700">
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
              <option value="21:9">21:9</option>
            </select>
          </div>
          <label class="text-[11px] text-slate-400 flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded border border-slate-800 cursor-pointer">
            <span>Optional Reference Photo (for Edit / Animate):</span>
            <input id="input-upload-photo" type="file" accept="image/*,video/*" class="text-[10px] w-36" />
          </label>
          <button id="btn-generate-image" class="w-full py-1.5 text-xs font-bold rounded bg-purple-500 text-slate-950 hover:bg-purple-400">
            Generate / Edit Studio Image
          </button>
          <div class="flex-1 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden min-h-36">
            ${
              this.generatedImageUrl
                ? `<img src="${this.generatedImageUrl}" alt="Generated studio artwork" class="max-h-44 object-contain" />`
                : `<span class="text-xs text-slate-500">Generated 1K/2K/4K artwork preview</span>`
            }
          </div>
        </div>

        <!-- Column 3: Omni Flash Video Generation & Lyria Music Soundtrack -->
        <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-400 uppercase">Omni Video & Lyria Music</span>
            <span class="text-[10px] font-mono-code text-slate-400">gemini-omni-1.1-flash</span>
          </div>
          <input id="input-video-prompt" type="text" value="Cinematic drone fly-through of a glowing quantum server array" class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
          <div class="flex gap-2">
            <select id="select-video-aspect" class="bg-slate-950 text-xs text-sky-300 px-2.5 py-1.5 rounded border border-slate-700">
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
            </select>
            <button id="btn-generate-video" class="flex-1 py-1.5 text-xs font-bold rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300">
              Generate / Animate Video
            </button>
          </div>
          ${
            this.generatedVideoUrl
              ? `<video src="${this.generatedVideoUrl}" controls autoplay loop class="w-full max-h-32 rounded border border-slate-700 bg-black"></video>`
              : ''
          }

          <!-- Lyria 3 Music Generator -->
          <div class="border-t border-slate-800 pt-2.5 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-pink-400">Lyria 3 Soundtrack Studio</span>
              <select id="select-lyria-model" class="bg-slate-950 text-[11px] text-pink-300 px-2 py-0.5 rounded border border-slate-700">
                <option value="lyria-3-clip-preview">lyria-3-clip-preview (30s)</option>
                <option value="lyria-3-pro-preview">lyria-3-pro-preview (Full)</option>
              </select>
            </div>
            <input id="input-music-prompt" type="text" value="Atmospheric synthwave soundtrack for an 8K space documentary" class="w-full bg-slate-950 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700" />
            <button id="btn-generate-music" class="w-full py-1.5 text-xs font-bold rounded bg-pink-500 text-slate-950 hover:bg-pink-400">
              Generate Music Track
            </button>
            ${
              this.generatedMusicUrl
                ? `<div class="space-y-1">
                     <audio src="${this.generatedMusicUrl}" controls autoplay class="w-full h-8"></audio>
                     <a href="${this.generatedMusicUrl}" download="omnistream_track.mp3" class="text-[11px] text-sky-400 underline block">Download MP3</a>
                   </div>`
                : ''
            }
          </div>

          ${
            this.aiStatusMessage
              ? `<div class="text-[11px] font-mono-code text-sky-300 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">${this.aiStatusMessage}</div>`
              : ''
          }
        </div>
      </div>
    `;
  }

  // 4. Gemini 4 Argon Intelligence, Multi-Turn Chat, Media Understanding, Search & Maps Grounding
  private renderIntelligenceView(): string {
    return `
      <div class="pointer-events-auto w-full h-full flex-1 bg-[#090d16] p-4 md:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Multi-Turn AI Chatbot with Role & Model Selector + High Thinking -->
        <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-bold text-sky-400 uppercase">Multi-Turn Gemini Studio Chat</span>
            <div class="flex items-center gap-1.5">
              <select id="select-chat-model" class="bg-slate-950 text-xs text-slate-200 px-2 py-1 rounded border border-slate-700">
                <option value="gemini-4-argon">gemini-4-argon (Complex)</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (General)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
              </select>
              <label class="flex items-center gap-1 text-[11px] text-amber-300 font-mono-code">
                <input id="chk-high-thinking" type="checkbox" checked />
                <span>Thinking.HIGH</span>
              </label>
            </div>
          </div>

          <div class="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-y-auto space-y-2 max-h-60">
            ${this.chatHistory
              .map(
                (m) => `
              <div class="text-xs p-2 rounded-lg ${
                m.role === 'user'
                  ? 'bg-sky-950 text-sky-100 ml-6'
                  : 'bg-slate-900 text-slate-200 mr-6 border border-slate-800'
              }">
                <span class="font-bold text-[10px] uppercase block text-slate-400">${m.role}</span>
                <div class="whitespace-pre-wrap">${m.text}</div>
              </div>`
              )
              .join('')}
          </div>

          <div class="flex gap-2">
            <input id="input-chat-msg" type="text" placeholder="Ask Gemini 4 Argon (High Thinking) or analyze uploaded photo/video..." class="flex-1 bg-slate-950 text-xs text-white px-3 py-2 rounded border border-slate-700" />
            <button id="btn-send-chat" class="px-3.5 py-2 text-xs font-bold rounded bg-sky-500 text-slate-950 hover:bg-sky-400">
              Send
            </button>
            <button id="btn-analyze-media" class="px-3 py-2 text-xs font-semibold rounded bg-purple-500 text-slate-950 hover:bg-purple-400">
              Analyze Media
            </button>
          </div>
        </div>

        <!-- Google Search Grounding, Maps Grounding & Low-Latency Flash-Lite -->
        <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-400 uppercase">Search & Maps Grounding + Low-Latency</span>
            <span class="text-[11px] font-mono-code text-slate-400">gemini-3.8-flash</span>
          </div>

          <input id="input-grounding-query" type="text" value="Best IMAX and post-production studios in Los Angeles" class="w-full bg-slate-950 text-xs text-white px-3 py-2 rounded border border-slate-700" />

          <div class="flex flex-wrap gap-2">
            <button id="btn-search-grounding" class="flex-1 py-2 text-xs font-bold rounded bg-sky-500 text-slate-950 hover:bg-sky-400">
              Google Search Grounding
            </button>
            <button id="btn-maps-grounding" class="flex-1 py-2 text-xs font-bold rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300">
              Google Maps Grounding
            </button>
            <button id="btn-fast-lite" class="px-3 py-2 text-xs font-bold rounded bg-amber-400 text-slate-950 hover:bg-amber-300">
              Flash-Lite Instant Tags
            </button>
          </div>

          <div class="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-y-auto text-xs text-slate-200 space-y-2 max-h-60">
            <div class="whitespace-pre-wrap">${this.groundingOutput || 'Run Search Grounding, Maps Grounding, or Flash-Lite for verified real-time results.'}</div>
            ${
              this.groundingLinks.length > 0
                ? `<div class="pt-2 border-t border-slate-800 space-y-1">
                     <div class="text-[11px] font-bold text-sky-400">Verified Grounding Sources & Map Links:</div>
                     ${this.groundingLinks
                       .map(
                         (l) =>
                           `<a href="${l.uri}" target="_blank" rel="noopener noreferrer" class="block text-xs text-sky-300 underline truncate">${l.title || l.uri}</a>`
                       )
                       .join('')}
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  // 5. Bioscience 3D Workbench (Publication-Grade Light Palette #F8FAFC / #FFFFFF per Science Skill)
  private renderScienceWorkbenchView(): string {
    const d = this.scienceData;
    return `
      <div class="pointer-events-auto w-[95vw] max-w-6xl h-[78vh] rounded-2xl bg-[#F8FAFC] text-slate-900 border border-[#E2E8F0] p-4 overflow-y-auto flex flex-col gap-3 shadow-2xl">
        <!-- Top Quick-Try Example Pill Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#E2E8F0]">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-bold text-[#0B57D0] mr-1">BIOSCIENCE WORKBENCH:</span>
            ${[
              { id: 'P04637', label: 'TP53 (P04637)' },
              { id: 'P38398', label: 'BRCA1 (P38398)' },
              { id: 'P00533', label: 'EGFR (P00533)' },
              { id: 'Q8NBP7', label: 'PCSK9 (Q8NBP7)' },
              { id: '4HHB', label: 'Hemoglobin (4HHB PDB)' },
            ]
              .map(
                (chip) => `
              <button data-bio-id="${chip.id}" class="btn-bio-chip px-2.5 py-1 text-xs font-mono-code rounded border ${
                  d?.accession === chip.id
                    ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                    : 'bg-[#F8FAFC] text-slate-700 border-[#E2E8F0] hover:bg-slate-100'
                }">
                ${chip.label}
              </button>`
              )
              .join('')}
          </div>
          <div class="flex items-center gap-2">
            <input id="input-bio-accession" type="text" placeholder="UniProt or PDB ID..." class="bg-white text-xs text-slate-900 px-2.5 py-1 rounded border border-[#E2E8F0] font-mono-code" />
            <button id="btn-bio-fetch" class="px-3 py-1 text-xs font-semibold rounded bg-[#1A73E8] text-white">
              Load Structure
            </button>
          </div>
        </div>

        ${
          this.scienceLoading || !d
            ? `<div class="p-8 text-center text-sm text-slate-600">Loading macromolecular coordinates from AlphaFold DB / UniProt / RCSB PDB...</div>`
            : `<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
                 <!-- Left Card: Metadata, Epistemic Provenance & Canonical pLDDT Scale -->
                 <div class="bg-white p-4 rounded-xl border border-[#E2E8F0] flex flex-col justify-between gap-3">
                   <div class="space-y-2">
                     <div class="flex items-center justify-between">
                       <span class="font-mono-code text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1A73E8] border border-blue-200">
                         [${d.provenance}]
                       </span>
                       <span class="font-mono-code text-xs text-slate-500">${d.accession}</span>
                     </div>
                     <h3 class="text-base font-bold text-slate-900">${d.proteinName}</h3>
                     <p class="text-xs text-slate-600">Gene: <strong class="font-mono-code">${d.gene}</strong> · Organism: <em>${d.organism}</em></p>
                     <p class="text-xs text-slate-600 font-mono-code">Residues / Atoms: ${d.sequenceLength}</p>
                     <div class="p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0] font-mono-code text-[11px] text-slate-700 break-all">
                       ${d.sequencePreview}
                     </div>
                   </div>

                   <!-- Canonical 4-Band AlphaFold pLDDT Confidence Scale -->
                   <div class="space-y-1.5 border-t border-[#E2E8F0] pt-2">
                     <div class="text-xs font-bold text-slate-800">AlphaFold pLDDT Confidence Scale</div>
                     <div class="grid grid-cols-2 gap-1.5 text-[11px] font-mono-code">
                       <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm inline-block" style="background:#0053D6"></span>Very High (&gt;90)</div>
                       <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm inline-block" style="background:#65CBF3"></span>Confident (70-90)</div>
                       <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm inline-block" style="background:#FFDB13"></span>Low (50-70)</div>
                       <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm inline-block" style="background:#FF7D45"></span>Very Low (&lt;50)</div>
                     </div>
                   </div>

                   <div class="flex flex-wrap gap-2 pt-2 border-t border-[#E2E8F0] text-xs">
                     <a href="${d.sourceUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 rounded bg-[#1A73E8] text-white font-medium">Source Record ↗</a>
                     <a href="${d.cifUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 rounded bg-[#0D9488] text-white font-mono-code">mmCIF (.cif) ↗</a>
                     <a href="${d.alphaGenomeUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 rounded bg-slate-800 text-white font-medium">AlphaGenome Atlas ↗</a>
                   </div>
                 </div>

                 <!-- Center Note: Live 3D WebGL Molecular Backbone Active in Viewport -->
                 <div class="bg-[#0F172A] text-white p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                   <div class="flex items-center justify-between">
                     <span class="text-xs font-mono-code text-sky-300">3D MACROMOLECULAR BACKBONE VIEWPORT</span>
                     <span class="text-[11px] font-mono-code text-emerald-300">pLDDT Colored</span>
                   </div>
                   <p class="text-xs text-slate-300 my-auto text-center">
                     The 3D AlphaFold/PDB structural ribbon for <strong>${d.gene} (${d.accession})</strong> is rendered live in the spatial 3D stage. Collapse the dock (<strong>H</strong>) to inspect the full-screen 3D structure.
                   </p>
                   <div class="text-[11px] font-mono-code text-slate-400 flex justify-between">
                     <span>Format: mmCIF v6</span>
                     <span>${d.pdbResolution ? `Resolution: ${d.pdbResolution}` : 'Confidence: pLDDT'}</span>
                   </div>
                 </div>

                 <!-- Right Card: Synchronized Functional Domains & Variants Inspector -->
                 <div class="bg-white p-4 rounded-xl border border-[#E2E8F0] flex flex-col gap-2 overflow-y-auto max-h-72">
                   <div class="text-xs font-bold text-slate-900 uppercase">Synchronized Domain & Variant Inspector</div>
                   ${
                     d.features.length === 0
                       ? `<p class="text-xs text-slate-500">No domain annotations returned.</p>`
                       : d.features
                           .map(
                             (f) => `
                         <div class="p-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#1A73E8] transition">
                           <div class="flex items-center justify-between text-xs font-bold text-[#0B57D0]">
                             <span>${f.type}</span>
                             <span class="font-mono-code text-[11px] text-slate-600">aa ${f.begin}–${f.end}</span>
                           </div>
                           <div class="text-xs text-slate-700 mt-0.5">${f.description}</div>
                         </div>`
                           )
                           .join('')
                   }
                 </div>
               </div>`
        }
      </div>
    `;
  }

  // 6. Google Workspace Hub + Explicit Confirmation Modal + AES-256-GCM + AAD & VibePitch Studio
  private renderWorkspaceAndSecurityView(): string {
    return renderUnifiedWorkspaceAndVaultView({
      needsAuth: this.needsAuth,
      googleSignInButtonHtml: this.renderGoogleSignInButton(),
      workspaceStatus: this.workspaceStatus,
      workspaceItems: this.workspaceItems,
      suite: this.suiteState,
    });
  }

  private renderConfirmationModal(): string {
    if (!this.pendingConfirmation) return '';
    return `
      <div class="fixed inset-0 z-50 pointer-events-auto bg-black/80 flex items-center justify-center p-4">
        <div class="max-w-md w-full rounded-2xl bg-[#090d16] border border-sky-500 p-5 shadow-2xl space-y-3">
          <h3 class="text-sm font-bold text-sky-400 uppercase">${this.pendingConfirmation.title}</h3>
          <p class="text-xs text-slate-200">${this.pendingConfirmation.description}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button id="btn-confirm-cancel" class="px-4 py-1.5 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700">
              Cancel
            </button>
            <button id="btn-confirm-proceed" class="px-4 py-1.5 text-xs font-bold rounded bg-sky-400 text-slate-950 hover:bg-sky-300">
              Confirm Action
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderReportContentModal(): string {
    if (!this.pendingContentReportModal) return '';
    const { targetId, targetType, targetTitle } = this.pendingContentReportModal;
    return `
      <div class="fixed inset-0 z-50 pointer-events-auto bg-black/80 flex items-center justify-center p-4">
        <form id="form-report-content" class="max-w-lg w-full rounded-2xl bg-white dark:bg-[#0f1526] text-slate-900 dark:text-slate-100 border border-rose-500/50 p-5 shadow-2xl space-y-3.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-mono-code font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                ⚑ REPORT CONTENT TO FIRESTORE
              </span>
              <span class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400">/content_reports</span>
            </div>
            <button type="button" id="btn-report-modal-cancel" class="text-xs text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>

          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Flag Content for Admin &amp; Moderator Review</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Creates a verified entry in Firestore (<code class="font-mono-code">/content_reports</code>) routed to <strong class="font-mono-code text-indigo-600 dark:text-sky-300">${PRIMARY_ADMIN_EMAIL}</strong> for dashboard review.
            </p>
          </div>

          <div class="p-2.5 rounded-lg bg-slate-100 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 text-xs font-mono-code space-y-0.5">
            <div><span class="text-slate-500">Target Type:</span> <strong class="text-sky-600 dark:text-sky-300">${targetType}</strong> · <span class="text-slate-500">ID:</span> ${targetId}</div>
            <div class="truncate"><span class="text-slate-500">Target Content:</span> <strong>${targetTitle}</strong></div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label for="report-reason" class="block text-xs font-semibold mb-1">Violation Reason</label>
              <select id="report-reason" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-2.5 py-2 text-xs">
                <option value="SPAM_OR_MISLEADING">Spam or Misleading Metadata</option>
                <option value="HARASSMENT_OR_ABUSE">Harassment or Community Abuse</option>
                <option value="COPYRIGHT_OR_IP">Copyright / IP Infringement</option>
                <option value="AGE_RESTRICTION_VIOLATION">Age Restriction / Parental Control Violation</option>
                <option value="ENCODING_OR_PLAYBACK_ISSUE">32K Encoding or Stream Playback Defect</option>
              </select>
            </div>
            <div>
              <label for="report-severity" class="block text-xs font-semibold mb-1">Priority / Severity</label>
              <select id="report-severity" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-2.5 py-2 text-xs font-mono-code">
                <option value="MEDIUM" selected>MEDIUM (Standard Review)</option>
                <option value="HIGH">HIGH (Priority Triage)</option>
                <option value="CRITICAL">CRITICAL (Immediate Escalation)</option>
                <option value="LOW">LOW (Minor Issue)</option>
              </select>
            </div>
          </div>

          <div>
            <label for="report-details" class="block text-xs font-semibold mb-1">Additional Details for Admin Review</label>
            <textarea
              id="report-details"
              rows="3"
              required
              maxlength="1000"
              placeholder="Provide timestamps or details so admins (${PRIMARY_ADMIN_EMAIL}) can review this report from their dashboard..."
              class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#090d16] px-3 py-2 text-xs"
            >Flagged "${targetTitle}" for admin review in Studio Dashboard.</textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              id="btn-report-modal-close"
              class="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition cursor-pointer"
            >
              ⚑ Submit Report to Firestore
            </button>
          </div>
        </form>
      </div>
    `;
  }

  private async handleReviewContentReport(
    reportId: string,
    status: ContentReportStatus,
    severity: ContentReportSeverity,
    resolutionNotes: string,
    removeTarget?: boolean
  ) {
    const targetReport = this.contentReports.find((r) => r.id === reportId);
    this.contentReports = this.contentReports.map((r) =>
      r.id === reportId ? { ...r, status, severity, resolutionNotes } : r
    );

    if (removeTarget && targetReport) {
      if (targetReport.targetType === 'LUMEN_VIDEO') {
        this.lumen.vids = this.lumen.vids.filter(
          (v) => v.id !== targetReport.targetId
        );
        if (this.lumen.cur?.id === targetReport.targetId) {
          this.lumen.cur = null;
        }
        this.lumen.save();
      } else if (
        targetReport.targetType === 'STUDIO_STREAM' &&
        this.videos.length > 1
      ) {
        this.videos = this.videos.filter((v) => v.id !== targetReport.targetId);
        if (this.currentVideo.id === targetReport.targetId && this.videos[0]) {
          this.currentVideo = this.videos[0];
        }
      } else if (targetReport.targetType === 'COMMENT') {
        this.comments = this.comments.filter(
          (c) => c.id !== targetReport.targetId
        );
      }
    }

    this.adminStatusBanner = `Admin (${PRIMARY_ADMIN_EMAIL}) marked report ${reportId} as ${status}${
      removeTarget ? ' and removed reported content' : ''
    }.`;
    showLumenToast(`Report ${status}`);
    this.render();

    if (this.currentUser) {
      await reviewContentReport(reportId, {
        status,
        severity,
        resolutionNotes,
      }).catch(() => {});
    }
  }

  private bindEvents() {
    document.querySelectorAll('#btn-google-signin').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await googleSignIn();
          if (res) {
            this.currentUser = res.user;
            this.needsAuth = false;
            this.attachCommentListener(this.currentVideo.id);
            await this.loadYouTubeLikesData({ forceRefresh: true });
          }
          this.render();
        } catch (err) {
          console.error(err);
        }
      });
    });

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      if (this.unsubscribeComments) {
        this.unsubscribeComments();
        this.unsubscribeComments = undefined;
      }
      if (this.unsubscribeContentReports) {
        this.unsubscribeContentReports();
        this.unsubscribeContentReports = undefined;
      }
      this.comments = [];
      await logout();
      clearYouTubeCache();
      this.currentUser = null;
      this.needsAuth = true;
      this.ytChannel = null;
      this.ytVideos = [];
      this.render();
    });

    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      this.darkMode = !this.darkMode;
      document.documentElement.classList.toggle('dark', this.darkMode);
      this.render();
    });

    document
      .getElementById('btn-header-admin-contact')
      ?.addEventListener('click', () => {
        this.activeTab = 'ADMIN_CONSOLE';
        this.studio.setScienceMode(false);
        this.render();
      });

    if (this.activeTab === 'LUMEN_PLATFORM') {
      this.lumen.bindEvents(
        () => this.render(),
        Boolean(this.currentUser),
        () => {
          this.activeTab = 'ADMIN_CONSOLE';
          this.studio.setScienceMode(false);
          this.render();
        },
        (payload) => {
          this.pendingContentReportModal = payload;
          this.render();
        }
      );
    } else {
      this.lumen.stopDemoAnimation();
    }

    if (this.activeTab === 'ADMIN_CONSOLE') {
      AdminConsoleView.bindEvents({
        onCopyAdminEmail: () => {
          if (navigator.clipboard) {
            navigator.clipboard
              .writeText(PRIMARY_ADMIN_EMAIL)
              .then(
                () => {
                  this.adminStatusBanner = `Copied official Admin / GM / Moderator contact (${PRIMARY_ADMIN_EMAIL}) to clipboard.`;
                  showLumenToast(`Copied ${PRIMARY_ADMIN_EMAIL}`);
                  this.render();
                },
                () => {
                  this.adminStatusBanner = `Contact Email: ${PRIMARY_ADMIN_EMAIL}`;
                  this.render();
                }
              );
          } else {
            this.adminStatusBanner = `Contact Email: ${PRIMARY_ADMIN_EMAIL}`;
            this.render();
          }
        },
        onGmToggleOverride: () => {
          const active = this.studio.gmToggleOverride();
          this.adminStatusBanner = `GM Invulnerability Shield ${
            active ? 'ENABLED' : 'DISABLED'
          } by Game Master (${PRIMARY_ADMIN_EMAIL}).`;
          showLumenToast(active ? 'GM Shield ON' : 'GM Shield OFF');
          this.render();
        },
        onGmBoostBandwidth: () => {
          this.studio.gmBoostBandwidth(32.0);
          this.adminStatusBanner = `GM (${PRIMARY_ADMIN_EMAIL}) injected +32.0 Gbps orbital bandwidth.`;
          showLumenToast('+32 Gbps GM Boost');
          this.render();
        },
        onGmRestoreIntegrity: () => {
          this.studio.gmRestoreIntegrity();
          this.adminStatusBanner = `GM (${PRIMARY_ADMIN_EMAIL}) restored 100% Broadcast Rig Integrity.`;
          showLumenToast('Rig Integrity 100%');
          this.render();
        },
        onGmAddScore: () => {
          this.studio.gmAddScore(2500);
          this.adminStatusBanner = `GM (${PRIMARY_ADMIN_EMAIL}) granted +2,500 GM Score.`;
          showLumenToast('+2,500 GM Score');
          this.render();
        },
        onGmAdvanceWave: () => {
          this.studio.gmAdvanceWave();
          this.adminStatusBanner = `GM (${PRIMARY_ADMIN_EMAIL}) advanced Orbital Relay to Wave ${this.studio.wave}.`;
          showLumenToast(`Advanced to Wave ${this.studio.wave}`);
          this.render();
        },
        onGmForceVictory: () => {
          this.studio.gmForceVictory();
          this.adminStatusBanner = `GM (${PRIMARY_ADMIN_EMAIL}) triggered Instant 32K Global Sync Victory.`;
          showLumenToast('32K Sync Victory Triggered');
          this.render();
        },
        onGmOpen3DStage: () => {
          this.activeTab = 'GAME_3D';
          this.studio.setScienceMode(false);
          if (this.studio.gameState === 'TITLE') {
            this.studio.startGame();
          }
          this.render();
        },
        onModerateStudioVideoAge: (videoId, ageRating) => {
          this.videos = this.videos.map((v) =>
            v.id === videoId ? { ...v, ageRating } : v
          );
          if (this.currentVideo.id === videoId) {
            this.currentVideo = { ...this.currentVideo, ageRating };
          }
          this.adminStatusBanner = `Admin/Moderator (${PRIMARY_ADMIN_EMAIL}) updated age rating for ${videoId} to ${ageRating}.`;
          showLumenToast(`Age rating set to ${ageRating}`);
          this.render();
        },
        onModerateDeleteStudioVideo: (videoId) => {
          if (this.videos.length <= 1) {
            this.adminStatusBanner = 'Cannot remove the last remaining master stream.';
            this.render();
            return;
          }
          this.videos = this.videos.filter((v) => v.id !== videoId);
          if (this.currentVideo.id === videoId && this.videos[0]) {
            this.currentVideo = this.videos[0];
          }
          this.adminStatusBanner = `Admin/Moderator (${PRIMARY_ADMIN_EMAIL}) removed studio stream ${videoId}.`;
          showLumenToast('Removed Studio Stream');
          this.render();
        },
        onModerateBoostLumenVideo: (videoId) => {
          const target = this.lumen.vids.find((v) => v.id === videoId);
          if (target) {
            target.views += 10000;
            target.likes += 500;
            this.lumen.save();
            this.adminStatusBanner = `Moderator (${PRIMARY_ADMIN_EMAIL}) boosted "${target.title}" (+10,000 views).`;
            showLumenToast('+10K Views Boosted');
            this.render();
          }
        },
        onModerateClearLumenComments: (videoId) => {
          const target = this.lumen.vids.find((v) => v.id === videoId);
          if (target) {
            target.cm = [];
            this.lumen.save();
            this.adminStatusBanner = `Moderator (${PRIMARY_ADMIN_EMAIL}) purged comments on "${target.title}".`;
            showLumenToast('Comments Purged');
            this.render();
          }
        },
        onModerateDeleteLumenVideo: (videoId) => {
          const target = this.lumen.vids.find((v) => v.id === videoId);
          this.lumen.vids = this.lumen.vids.filter((v) => v.id !== videoId);
          if (this.lumen.cur?.id === videoId) {
            this.lumen.cur = null;
          }
          this.lumen.save();
          this.adminStatusBanner = `Moderator (${PRIMARY_ADMIN_EMAIL}) removed Lumen video "${
            target?.title || videoId
          }".`;
          showLumenToast('Video Removed');
          this.render();
        },
        onModerateDeleteStreamComment: async (commentId) => {
          this.comments = this.comments.filter((c) => c.id !== commentId);
          this.adminStatusBanner = `Moderator (${PRIMARY_ADMIN_EMAIL}) deleted stream comment ${commentId}.`;
          this.render();
          if (this.currentUser) {
            await deleteVideoComment(this.currentVideo.id, commentId).catch(
              () => {}
            );
          }
        },
        onSubmitContactTicket: async (payload) => {
          const localTicket: ModerationTicketRecord = {
            id: `tkt_${Date.now()}`,
            ownerId: this.currentUser?.uid || 'guest_user',
            senderName:
              this.currentUser?.displayName ||
              this.currentUser?.email ||
              'Community Member',
            recipientEmail: PRIMARY_ADMIN_EMAIL,
            category: payload.category,
            subject: payload.subject,
            message: payload.message,
            status: 'OPEN',
            adminReply: '',
          };
          this.moderationTickets.unshift(localTicket);
          this.adminStatusBanner = `Dispatched [${payload.category}] ticket "${payload.subject}" to ${PRIMARY_ADMIN_EMAIL}.`;
          showLumenToast(`Sent to ${PRIMARY_ADMIN_EMAIL}`);
          this.render();
          if (this.currentUser) {
            await createModerationTicket(payload).catch(() => {});
          }
        },
        onResolveTicket: async (ticketId, status, adminReply) => {
          this.moderationTickets = this.moderationTickets.map((t) =>
            t.id === ticketId ? { ...t, status, adminReply } : t
          );
          this.adminStatusBanner = `Admin/GM/Moderator (${PRIMARY_ADMIN_EMAIL}) resolved ticket ${ticketId}.`;
          showLumenToast('Ticket Resolved');
          this.render();
          if (this.currentUser && isMasterAdminUser(this.currentUser)) {
            await resolveModerationTicket(ticketId, status, adminReply).catch(
              () => {}
            );
          }
        },
        onDeleteTicket: async (ticketId) => {
          this.moderationTickets = this.moderationTickets.filter(
            (t) => t.id !== ticketId
          );
          this.adminStatusBanner = `Deleted ticket ${ticketId}.`;
          this.render();
          if (this.currentUser) {
            await deleteModerationTicket(ticketId).catch(() => {});
          }
        },
        onFilterTicketCategory: (cat) => {
          this.adminTicketFilter = cat;
          this.render();
        },
        onAssignStaffRole: async (payload) => {
          const newRole: AdminRoleRecord = {
            targetUid: payload.targetUid,
            email: payload.email.toLowerCase(),
            role: payload.role,
            permissions: payload.permissions,
            assignedByUid: this.currentUser?.uid || 'master_admin_creatergame31',
          };
          this.staffRoles = [
            ...this.staffRoles.filter((r) => r.targetUid !== payload.targetUid),
            newRole,
          ];
          this.adminStatusBanner = `Granted ${payload.role} authority to ${payload.email} (Supervised by ${PRIMARY_ADMIN_EMAIL}).`;
          showLumenToast(`Granted ${payload.role}`);
          this.render();
          if (this.currentUser && isMasterAdminUser(this.currentUser)) {
            await assignStaffRole(payload).catch(() => {});
          }
        },
        onRevokeStaffRole: async (uid) => {
          this.staffRoles = this.staffRoles.filter(
            (r) =>
              r.targetUid !== uid ||
              r.email.toLowerCase() === PRIMARY_ADMIN_EMAIL
          );
          this.adminStatusBanner = `Revoked staff role for UID ${uid}.`;
          showLumenToast('Role Revoked');
          this.render();
          if (this.currentUser && isMasterAdminUser(this.currentUser)) {
            await removeStaffRole(uid).catch(() => {});
          }
        },
        onReviewContentReport: (
          reportId,
          status,
          severity,
          resolutionNotes,
          removeTarget
        ) => {
          void this.handleReviewContentReport(
            reportId,
            status,
            severity,
            resolutionNotes,
            removeTarget
          );
        },
        onDeleteContentReport: async (reportId) => {
          this.contentReports = this.contentReports.filter(
            (r) => r.id !== reportId
          );
          this.adminStatusBanner = `Deleted content report ${reportId}.`;
          showLumenToast('Report Deleted');
          this.render();
          if (this.currentUser) {
            await deleteContentReport(reportId).catch(() => {});
          }
        },
        onFilterContentReportStatus: (status) => {
          this.reportFilterStatus = status;
          this.render();
        },
        onOpenReportModal: () => {
          this.pendingContentReportModal = {
            targetId: this.currentVideo.id,
            targetType: 'STUDIO_STREAM',
            targetTitle: this.currentVideo.title,
          };
          this.render();
        },
      });
    }

    if (this.activeTab === 'YOUTUBE_LIKES') {
      YouTubeLikesView.bindEvents(
        {
          needsAuth: this.needsAuth,
          loading: this.ytLoading,
          errorMessage: this.ytError,
          statusMessage: this.ytStatus,
          channel: this.ytChannel,
          videos: this.ytVideos,
          searchQuery: this.ytSearchQuery,
          sortMode: this.ytSortMode,
          nextPageToken: this.ytNextPageToken,
          prevPageToken: this.ytPrevPageToken,
          totalResults: this.ytTotalResults,
          fromCache: this.ytFromCache,
          quota: getYouTubeQuotaTelemetry(),
          googleSignInButtonHtml: this.renderGoogleSignInButton(),
        },
        {
          onFetchLikedVideos: (opts) => {
            void this.loadYouTubeLikesData(opts);
          },
          onSearchChange: (q) => {
            this.ytSearchQuery = q;
            this.render();
            const input = document.getElementById('yt-input-search') as HTMLInputElement | null;
            if (input) {
              input.focus();
              input.setSelectionRange(input.value.length, input.value.length);
            }
          },
          onSortChange: (mode) => {
            this.ytSortMode = mode;
            this.render();
          },
          onRequestRateVideo: (video, targetRating) => {
            const actionLabel =
              targetRating === 'none'
                ? 'Remove Like (Unlike)'
                : targetRating === 'dislike'
                ? 'Dislike Video'
                : 'Like Video';
            this.pendingConfirmation = {
              title: `Confirm YouTube Video Rating: ${actionLabel}`,
              description: `Are you sure you want to set rating="${targetRating}" on "${video.title}" (Video ID: ${video.id}) in your YouTube account?`,
              onConfirm: async () => {
                await rateYouTubeVideo(video.id, targetRating);
                this.ytVideos = this.ytVideos.map((v) =>
                  v.id === video.id ? { ...v, myRating: targetRating } : v
                );
                if (targetRating === 'none' || targetRating === 'dislike') {
                  this.ytTotalResults = Math.max(0, this.ytTotalResults - 1);
                }
                this.ytStatus = `Updated rating to "${targetRating}" for "${video.title}".`;
              },
            };
            this.render();
          },
          onLookupAndLikeById: async (rawIdOrUrl, rating) => {
            try {
              const video = await fetchYouTubeVideoById(rawIdOrUrl);
              if (!video) {
                this.ytError = `No YouTube video found for "${rawIdOrUrl}".`;
                this.render();
                return;
              }
              this.pendingConfirmation = {
                title: `Confirm YouTube Rating (${rating.toUpperCase()})`,
                description: `Are you sure you want to rate "${video.title}" by ${video.channelTitle} (ID: ${video.id}) as "${rating}" on your YouTube account?`,
                onConfirm: async () => {
                  await rateYouTubeVideo(video.id, rating);
                  if (rating === 'like') {
                    const exists = this.ytVideos.some((v) => v.id === video.id);
                    if (!exists) {
                      this.ytVideos = [{ ...video, myRating: 'like' }, ...this.ytVideos];
                      this.ytTotalResults += 1;
                    }
                  } else {
                    this.ytVideos = this.ytVideos.filter((v) => v.id !== video.id);
                  }
                  this.ytStatus = `Successfully rated "${video.title}" as "${rating}".`;
                },
              };
              this.render();
            } catch (err: any) {
              const msg = String(err?.message || err);
              if (msg.includes('NEEDS_AUTH')) {
                this.needsAuth = true;
              }
              this.ytError = msg;
              this.render();
            }
          },
        }
      );
    }

    if (this.activeTab === 'STUDIO_DASHBOARD') {
      StudioDashboard.bindEvents({
        onSelectVideo: (videoId) => {
          const found = this.videos.find((v) => v.id === videoId);
          if (found) {
            this.currentVideo = found;
            this.attachCommentListener(found.id);
            this.activeTab = 'STREAM_HUB';
            this.render();
          }
        },
        onToggleLiveBroadcast: () => {
          this.isLiveStreaming = !this.isLiveStreaming;
          if (this.isLiveStreaming) {
            this.liveIngestGbps = this.selectedBitrate.includes('32K')
              ? 32.4
              : this.selectedBitrate.includes('8K')
              ? 12.8
              : 4.2;
            this.liveViewerCount += 140;
          } else {
            this.liveIngestGbps = 0.0;
          }
          this.lastSyncedAt = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          this.render();
        },
        onToggleGeminiLive: () => {
          if (this.liveConnected) {
            this.stopLiveSession();
          } else {
            this.startLiveSession();
          }
        },
        onChangeBitrate: (bitrate) => {
          this.selectedBitrate = bitrate;
          if (this.isLiveStreaming) {
            this.liveIngestGbps = bitrate.includes('32K')
              ? 32.4
              : bitrate.includes('8K')
              ? 12.8
              : 4.2;
          }
          this.render();
        },
        onChangeTimeframe: (tf) => {
          this.analyticsTimeframe = tf;
          this.render();
        },
        onChangeCategoryFilter: (cat) => {
          this.categoryFilter = cat;
          this.render();
        },
        onSearchAnalytics: (q) => {
          this.analyticsSearch = q;
          this.render();
          const input = document.getElementById('dash-input-search') as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        },
        onQuickUploadVideo: async () => {
          const newVid: StreamVideoItem = {
            id: `vid_${Date.now()}`,
            title: `32K Spatial Studio Master #${this.videos.length + 1}`,
            author: this.currentUser?.displayName || 'OmniStream Master Lab',
            resolution: '32K',
            category: 'Spatial XR',
            ageRating: 'ALL',
            views: '14.2K',
            videoUrl:
              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            durationSec: 420,
          };
          this.videos.unshift(newVid);
          this.currentVideo = newVid;
          this.offlineCachedIds.add(newVid.id);
          this.lastSyncedAt = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          if (this.currentUser) {
            await publishVideoToFirestore({
              title: newVid.title,
              description: 'Published from Centralized Studio Dashboard',
              category: newVid.category,
              resolution: newVid.resolution,
              videoUrl: newVid.videoUrl,
              ageRating: newVid.ageRating,
            }).catch(() => {});
          }
          this.render();
        },
        onToggleOfflineCache: (videoId) => {
          if (this.offlineCachedIds.has(videoId)) {
            this.offlineCachedIds.delete(videoId);
          } else {
            this.offlineCachedIds.add(videoId);
          }
          this.render();
        },
        onExportAnalyticsCsv: () => {
          const rows = StudioDashboard.computeAnalyticsRows(
            this.videos,
            this.analyticsTimeframe,
            this.categoryFilter,
            this.analyticsSearch
          );
          const header = 'Video ID,Title,Category,Resolution,Views,Watch Time (Hours),Retention (%),Peak Bitrate (Gbps)\n';
          const body = rows
            .map(
              (r) =>
                `"${r.videoId}","${r.title.replace(/"/g, '""')}","${r.category}","${r.resolution}",${r.views},${r.watchTimeHours},${r.avgRetentionPct},${r.peakBitrateGbps}`
            )
            .join('\n');
          const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `omnistream-studio-analytics-${this.analyticsTimeframe}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        onRefreshTelemetry: () => {
          this.liveViewerCount += Math.floor(Math.random() * 85) + 15;
          this.lastSyncedAt = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          this.render();
        },
        onReportStudioVideo: (videoId, title) => {
          this.pendingContentReportModal = {
            targetId: videoId,
            targetType: 'STUDIO_STREAM',
            targetTitle: title,
          };
          this.render();
        },
        onReviewContentReport: (
          reportId,
          status,
          severity,
          resolutionNotes,
          removeTarget
        ) => {
          void this.handleReviewContentReport(
            reportId,
            status,
            severity,
            resolutionNotes,
            removeTarget
          );
        },
        onDeleteContentReport: async (reportId) => {
          this.contentReports = this.contentReports.filter(
            (r) => r.id !== reportId
          );
          this.lastSyncedAt = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          showLumenToast('Report Deleted');
          this.render();
          if (this.currentUser) {
            await deleteContentReport(reportId).catch(() => {});
          }
        },
        onFilterContentReportStatus: (status) => {
          this.reportFilterStatus = status;
          this.render();
        },
      });
    }

    if (this.activeTab === 'SUBSCRIPTION') {
      SubscriptionView.bindEvents(
        {
          currentUserEmail: this.currentUser?.email || null,
          currentUserUid: this.currentUser?.uid || null,
          isVerifiedMasterAdmin: isMasterAdminUser(this.currentUser),
          subscription: this.currentSubscription,
          invoices: this.subscriptionInvoices,
          selectedBillingCycle: this.selectedBillingCycle,
          paymentMethodLast4: this.paymentMethodLast4,
          remainingDailyQuotaUnits: this.remainingDailyQuotaUnits,
          statusBanner: this.subscriptionStatusBanner,
          isSubmitting: this.subscriptionSubmitting,
        },
        {
          onSelectBillingCycle: (cycle) => {
            this.selectedBillingCycle = cycle;
            this.render();
          },
          onChangePaymentLast4: (last4) => {
            const digits = last4.replace(/\D/g, '').slice(-4);
            this.paymentMethodLast4 = digits.length === 4 ? digits : '4242';
            this.render();
          },
          onCheckoutPlan: async (planId: SubscriptionPlanId, cycle: BillingCycle) => {
            this.subscriptionSubmitting = true;
            this.render();
            try {
              const res = await checkoutSubscriptionOnServer({
                planId,
                billingCycle: cycle,
                paymentMethodLast4: this.paymentMethodLast4,
              });
              this.currentSubscription = res.subscription;
              if (this.currentUser) {
                this.subscriptionInvoices = res.invoices;
              } else {
                this.subscriptionInvoices = [
                  res.invoice,
                  ...this.subscriptionInvoices,
                ].slice(0, 20);
              }
              this.isPremiumAdFree = res.entitlement.isPremium;
              this.remainingDailyQuotaUnits = res.remainingDailyQuotaUnits;
              this.subscriptionStatusBanner = res.message;
              showLumenToast(res.message);
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : 'Subscription checkout failed.';
              this.subscriptionStatusBanner = msg;
              showLumenToast(msg);
            } finally {
              this.subscriptionSubmitting = false;
              this.render();
            }
          },
          onCancelSubscription: async (immediate: boolean) => {
            this.subscriptionSubmitting = true;
            this.render();
            try {
              const res = await cancelSubscriptionOnServer(immediate);
              this.currentSubscription = res.subscription;
              this.isPremiumAdFree = res.entitlement.isPremium;
              this.remainingDailyQuotaUnits = res.remainingDailyQuotaUnits;
              this.subscriptionStatusBanner = res.message;
              showLumenToast(res.message);
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : 'Failed to cancel subscription.';
              this.subscriptionStatusBanner = msg;
              showLumenToast(msg);
            } finally {
              this.subscriptionSubmitting = false;
              this.render();
            }
          },
          onDownloadInvoiceJson: (invoice: SubscriptionInvoiceRecord) => {
            const blob = new Blob([JSON.stringify(invoice, null, 2)], {
              type: 'application/json;charset=utf-8;',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `omnistream-invoice-${invoice.invoiceId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showLumenToast(`Downloaded receipt ${invoice.invoiceId}`);
          },
        }
      );
    }

    document.getElementById('btn-open-subscription-hub')?.addEventListener('click', () => {
      this.activeTab = 'SUBSCRIPTION';
      this.render();
    });

    document.getElementById('btn-mute-synth')?.addEventListener('click', () => {
      studioSynth.muted = !studioSynth.muted;
      this.render();
    });

    document.getElementById('btn-toggle-dock')?.addEventListener('click', () => {
      this.dockCollapsed = !this.dockCollapsed;
      this.render();
    });

    document.querySelectorAll('.btn-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as ActiveTab;
        this.activeTab = tab;
        this.studio.setScienceMode(tab === 'SCIENCE', this.scienceData?.accession || 'P04637');
        this.render();
      });
    });

    document.getElementById('slider-explode')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.studio.setExplodedView(val);
    });

    document.getElementById('btn-cycle-finish')?.addEventListener('click', () => {
      this.studio.cycleFinishColor();
    });

    document.getElementById('btn-cycle-camera')?.addEventListener('click', () => {
      this.studio.cycleCameraPreset();
    });

    // Game Shell Controls
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.studio.startGame();
    });

    document.getElementById('btn-resume-game')?.addEventListener('click', () => {
      this.studio.togglePauseGame();
    });

    // Stream Hub Controls
    const player = document.getElementById('main-video-player') as HTMLVideoElement | null;
    if (player) {
      player.addEventListener('pause', () => {
        syncPlaybackProgress(this.currentVideo.id, player.currentTime).catch(() => {});
      });
    }

    document.getElementById('select-bitrate')?.addEventListener('change', (e) => {
      this.selectedBitrate = (e.target as HTMLSelectElement).value;
      this.render();
    });

    document.getElementById('btn-toggle-bgaudio')?.addEventListener('click', () => {
      this.backgroundAudioMode = !this.backgroundAudioMode;
      this.render();
    });

    document.getElementById('btn-cache-offline')?.addEventListener('click', () => {
      this.offlineCachedIds.add(this.currentVideo.id);
      this.render();
    });

    document.getElementById('input-search-videos')?.addEventListener('input', (e) => {
      this.searchFilter = (e.target as HTMLInputElement).value;
      this.render();
    });

    document.getElementById('btn-toggle-parental')?.addEventListener('click', () => {
      this.parentalSafeMode = !this.parentalSafeMode;
      this.render();
    });

    document.getElementById('btn-toggle-premium')?.addEventListener('click', async () => {
      if (this.currentUser && isMasterAdminUser(this.currentUser)) {
        try {
          const updated = await setAdminUserPremiumEntitlement(
            this.currentUser.uid,
            !this.isPremiumAdFree
          );
          this.isPremiumAdFree = updated.isPremium;
          showLumenToast(
            `Server Admin Entitlement Updated: ${updated.tier} (${updated.dailyQuotaUnits} quota units/day)`
          );
        } catch (err) {
          showLumenToast(err instanceof Error ? err.message : 'Server entitlement check failed');
        }
      } else {
        const verified = await verifyServerEntitlement();
        this.isPremiumAdFree = verified.isPremium;
        showLumenToast(
          `Server Entitlement Verified: ${verified.tier} (Clients cannot self-grant Premium status)`
        );
      }
      this.render();
    });

    document.querySelectorAll('.btn-select-video').forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.videoId;
        const found = this.videos.find((v) => v.id === id);
        if (found) {
          this.currentVideo = found;
          this.attachCommentListener(found.id);
          this.render();
        }
      });
    });

    document.getElementById('btn-post-comment')?.addEventListener('click', async () => {
      const input = document.getElementById('input-comment') as HTMLInputElement | null;
      const text = input?.value.trim();
      if (!text) return;
      try {
        await addVideoComment(this.currentVideo.id, text);
        if (input) input.value = '';
      } catch (err) {
        console.error(err);
      }
    });

    document.querySelectorAll('.btn-del-comment').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const commentId = (btn as HTMLElement).dataset.commentId;
        if (commentId) {
          await deleteVideoComment(this.currentVideo.id, commentId);
        }
      });
    });

    document.getElementById('btn-report-current-stream')?.addEventListener('click', () => {
      this.pendingContentReportModal = {
        targetId: this.currentVideo.id,
        targetType: 'STUDIO_STREAM',
        targetTitle: this.currentVideo.title,
      };
      this.render();
    });

    document.querySelectorAll('.btn-report-comment').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const cId = el.dataset.reportCommentId || `cmt_${Date.now()}`;
        const cText = el.dataset.reportCommentText || 'Stream Comment';
        this.pendingContentReportModal = {
          targetId: cId,
          targetType: 'COMMENT',
          targetTitle: `Stream Comment: "${cText.slice(0, 80)}"`,
        };
        this.render();
      });
    });

    // Report Content Modal Events
    const closeReportModal = () => {
      this.pendingContentReportModal = null;
      this.render();
    };
    document.getElementById('btn-report-modal-cancel')?.addEventListener('click', closeReportModal);
    document.getElementById('btn-report-modal-close')?.addEventListener('click', closeReportModal);

    document.getElementById('form-report-content')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const target = this.pendingContentReportModal;
      if (!target) return;

      const reason =
        ((document.getElementById('report-reason') as HTMLSelectElement)?.value as ContentReportReason) ||
        'SPAM_OR_MISLEADING';
      const severity =
        ((document.getElementById('report-severity') as HTMLSelectElement)?.value as ContentReportSeverity) ||
        'MEDIUM';
      const details =
        (document.getElementById('report-details') as HTMLTextAreaElement)?.value.trim() ||
        'User flagged content for admin review.';

      const localReport: ContentReportRecord = {
        id: `rep_${Date.now()}`,
        targetId: target.targetId,
        targetType: target.targetType,
        targetTitle: target.targetTitle,
        reporterId: this.currentUser?.uid || 'guest_reporter',
        reporterName:
          this.currentUser?.displayName ||
          this.currentUser?.email ||
          'Community Viewer',
        assignedAdminEmail: PRIMARY_ADMIN_EMAIL,
        reason,
        severity,
        details,
        status: 'OPEN',
        resolutionNotes: '',
      };

      this.contentReports.unshift(localReport);
      this.pendingContentReportModal = null;
      this.adminStatusBanner = `Content report submitted to Firestore (/content_reports) for "${target.targetTitle}" → Assigned to ${PRIMARY_ADMIN_EMAIL}.`;
      showLumenToast('Content report submitted to Admin Dashboard');
      this.render();

      if (this.currentUser) {
        try {
          const firestoreId = await submitContentReport({
            targetId: target.targetId,
            targetType: target.targetType,
            targetTitle: target.targetTitle,
            reason,
            severity,
            details,
          });
          this.contentReports = this.contentReports.map((r) =>
            r.id === localReport.id ? { ...r, id: firestoreId } : r
          );
          this.render();
        } catch (err) {
          console.error('Error saving content report to Firestore:', err);
        }
      }
    });

    document.getElementById('btn-upload-video')?.addEventListener('click', async () => {
      const titleInput = document.getElementById('input-upload-title') as HTMLInputElement | null;
      const title = titleInput?.value.trim() || 'New 32K Master Broadcast';
      const newVid: StreamVideoItem = {
        id: `vid_${Date.now()}`,
        title,
        author: this.currentUser?.displayName || 'Studio Creator',
        resolution: '32K',
        category: 'Spatial XR',
        ageRating: 'ALL',
        views: '1',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        durationSec: 15,
      };
      this.videos.unshift(newVid);
      this.currentVideo = newVid;
      if (this.currentUser) {
        await publishVideoToFirestore({
          title: newVid.title,
          description: 'Uploaded via OmniStream 32K Studio',
          category: newVid.category,
          resolution: newVid.resolution,
          videoUrl: newVid.videoUrl,
          ageRating: newVid.ageRating,
        }).catch(() => {});
      }
      this.render();
    });

    document.getElementById('btn-create-playlist')?.addEventListener('click', async () => {
      if (this.currentUser) {
        await createUserPlaylist(
          `32K Favorites #${this.playlists.length + 1}`,
          this.currentVideo.id
        ).catch(() => {});
        this.playlists = await fetchUserPlaylists().catch(() => []);
      } else {
        this.playlists.push({
          id: `local_${Date.now()}`,
          name: `32K Favorites #${this.playlists.length + 1}`,
          ownerId: 'guest',
          videoIds: this.currentVideo.id,
        });
      }
      this.render();
    });

    // File Upload for Image Editing / Video Animation / Media Analysis
    document.getElementById('input-upload-photo')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.uploadedMediaMime = file.type || 'image/png';
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        this.uploadedMediaBase64 = res.includes(',') ? res.split(',')[1] : res;
        this.aiStatusMessage = `Loaded ${file.name} (${this.uploadedMediaMime})`;
        this.render();
      };
      reader.readAsDataURL(file);
    });

    // AI Studio Actions
    document.getElementById('btn-toggle-live')?.addEventListener('click', () => {
      if (this.liveConnected) {
        this.stopLiveSession();
      } else {
        this.startLiveSession();
      }
    });

    document.getElementById('btn-record-transcribe')?.addEventListener('click', () => {
      this.recordAndTranscribeMic();
    });

    document.getElementById('btn-generate-tts')?.addEventListener('click', async () => {
      const text =
        (document.getElementById('input-tts-text') as HTMLInputElement)?.value ||
        'Welcome to OmniStream 32K.';
      this.aiStatusMessage = 'Synthesizing speech via gemini-3.8-flash-tts...';
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/tts', {
          text,
          secondSpeakerText: 'Indeed, |yeah| spatial streaming has never been faster!',
        });
        if (data.audioDataUrl) {
          this.generatedTtsUrl = data.audioDataUrl;
          this.aiStatusMessage = 'TTS audio generated.';
        } else {
          this.aiStatusMessage = data.error || 'TTS failed.';
        }
      } catch (err) {
        this.aiStatusMessage = String(err);
      }
      this.render();
    });

    document.getElementById('btn-generate-image')?.addEventListener('click', async () => {
      const prompt = (document.getElementById('input-image-prompt') as HTMLInputElement)?.value;
      const model = (document.getElementById('select-image-model') as HTMLSelectElement)?.value;
      const imageSize = (document.getElementById('select-image-size') as HTMLSelectElement)?.value;
      const aspectRatio = (document.getElementById('select-image-aspect') as HTMLSelectElement)?.value;
      this.aiStatusMessage = `Generating ${imageSize} (${aspectRatio}) image with ${model}...`;
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/generate-image', {
          prompt,
          model,
          imageSize,
          aspectRatio,
          base64ImageData: this.uploadedMediaBase64 || undefined,
          mimeType: this.uploadedMediaMime,
        });
        if (data.imageUrl) {
          this.generatedImageUrl = data.imageUrl;
          this.aiStatusMessage = `Generated ${imageSize} image (${aspectRatio}).`;
        } else {
          this.aiStatusMessage = data.error || 'Image generation failed.';
        }
      } catch (err) {
        this.aiStatusMessage = String(err);
      }
      this.render();
    });

    document.getElementById('btn-generate-video')?.addEventListener('click', async () => {
      const prompt = (document.getElementById('input-video-prompt') as HTMLInputElement)?.value;
      const aspectRatio = (document.getElementById('select-video-aspect') as HTMLSelectElement)?.value;
      this.aiStatusMessage = `Generating ${aspectRatio} video via gemini-omni-1.1-flash...`;
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/generate-video', {
          prompt,
          aspectRatio,
          base64ImageBytes: this.uploadedMediaBase64 || undefined,
          mimeType: this.uploadedMediaMime,
        });
        if (data.videoDataUrl) {
          this.generatedVideoUrl = data.videoDataUrl;
          this.aiStatusMessage = `Generated ${aspectRatio} video!`;
        } else {
          this.aiStatusMessage = data.error || 'Video generation failed.';
        }
      } catch (err) {
        this.aiStatusMessage = String(err);
      }
      this.render();
    });

    document.getElementById('btn-generate-music')?.addEventListener('click', async () => {
      const prompt = (document.getElementById('input-music-prompt') as HTMLInputElement)?.value;
      const model = (document.getElementById('select-lyria-model') as HTMLSelectElement)?.value;
      this.aiStatusMessage = `Generating soundtrack via ${model}...`;
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/generate-music', {
          prompt,
          model,
        });
        if (data.audioDataUrl) {
          this.generatedMusicUrl = data.audioDataUrl;
          this.generatedMusicLyrics = data.lyrics || '';
          this.aiStatusMessage = 'Soundtrack ready!';
        } else {
          this.aiStatusMessage = data.error || 'Music generation failed.';
        }
      } catch (err) {
        this.aiStatusMessage = String(err);
      }
      this.render();
    });

    // Intelligence View Events
    document.getElementById('btn-send-chat')?.addEventListener('click', async () => {
      const input = document.getElementById('input-chat-msg') as HTMLInputElement | null;
      const model = (document.getElementById('select-chat-model') as HTMLSelectElement)?.value;
      const highThinking = (document.getElementById('chk-high-thinking') as HTMLInputElement)?.checked;
      const msg = input?.value.trim();
      if (!msg) return;
      const prevHistory = [...this.chatHistory];
      this.chatHistory.push({ role: 'user', text: msg });
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/chat', {
          message: msg,
          history: prevHistory,
          model,
          highThinking,
        });
        this.chatHistory.push({
          role: 'model',
          text: data.text || data.error || 'No response',
        });
      } catch (err) {
        this.chatHistory.push({ role: 'model', text: String(err) });
      }
      this.render();
    });

    document.getElementById('btn-analyze-media')?.addEventListener('click', async () => {
      const input = document.getElementById('input-chat-msg') as HTMLInputElement | null;
      const prompt =
        input?.value.trim() ||
        'Analyze this photo or video for key visual details, encoding fidelity, and scene structure.';
      this.chatHistory.push({ role: 'user', text: `[Analyze Media with Gemini 4 Argon]: ${prompt}` });
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/analyze-media', {
          prompt,
          base64Data: this.uploadedMediaBase64 || undefined,
          mimeType: this.uploadedMediaMime,
          highThinking: true,
        });
        this.chatHistory.push({
          role: 'model',
          text: data.text || data.error || 'Analysis complete.',
        });
      } catch (err) {
        this.chatHistory.push({ role: 'model', text: String(err) });
      }
      this.render();
    });

    document.getElementById('btn-search-grounding')?.addEventListener('click', async () => {
      const query = (document.getElementById('input-grounding-query') as HTMLInputElement)?.value;
      this.groundingOutput = 'Querying Google Search Grounding (gemini-3.8-flash)...';
      this.groundingLinks = [];
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/search-grounding', { query });
        this.groundingOutput = data.text || data.error || '';
        this.groundingLinks = (data.groundingChunks || [])
          .map((c: Record<string, any>) => c.web)
          .filter(Boolean);
      } catch (err) {
        this.groundingOutput = String(err);
      }
      this.render();
    });

    document.getElementById('btn-maps-grounding')?.addEventListener('click', async () => {
      const query = (document.getElementById('input-grounding-query') as HTMLInputElement)?.value;
      this.groundingOutput = 'Querying Google Maps Grounding (gemini-3.8-flash)...';
      this.groundingLinks = [];
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/maps-grounding', { query });
        this.groundingOutput = data.text || data.error || '';
        const links: Array<{ title: string; uri: string }> = [];
        for (const chunk of data.groundingChunks || []) {
          if (chunk.maps?.uri) {
            links.push({ title: chunk.maps.title || 'Google Maps Place', uri: chunk.maps.uri });
          }
          for (const rev of chunk.maps?.placeAnswerSources?.reviewSnippets || []) {
            if (rev.uri) {
              links.push({ title: 'Place Review Snippet', uri: rev.uri });
            }
          }
        }
        this.groundingLinks = links;
      } catch (err) {
        this.groundingOutput = String(err);
      }
      this.render();
    });

    document.getElementById('btn-fast-lite')?.addEventListener('click', async () => {
      const query = (document.getElementById('input-grounding-query') as HTMLInputElement)?.value;
      this.groundingOutput = 'Running low-latency gemini-3.1-flash-lite...';
      this.render();
      try {
        const data = await this.postAuthenticatedGemini('/api/gemini/fast-assist', {
          prompt: `Generate 6 low-latency SEO tags and bitrate recommendations for: ${query}`,
        });
        this.groundingOutput = data.text || data.error || '';
      } catch (err) {
        this.groundingOutput = String(err);
      }
      this.render();
    });

    // Bioscience Workbench Events
    document.querySelectorAll('.btn-bio-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.bioId;
        if (id) this.loadScienceIdentifier(id);
      });
    });

    document.getElementById('btn-bio-fetch')?.addEventListener('click', () => {
      const val = (document.getElementById('input-bio-accession') as HTMLInputElement)?.value;
      if (val) this.loadScienceIdentifier(val);
    });

    // Workspace Read & Mutating Confirmation Events
    document.querySelectorAll('.btn-ws-read').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const type = (btn as HTMLElement).dataset.ws;
        this.workspaceStatus = `Loading ${type} from Google Workspace...`;
        this.render();
        try {
          if (type === 'drive') this.workspaceItems = await fetchDriveFiles();
          else if (type === 'calendar') this.workspaceItems = await fetchCalendarEvents();
          else if (type === 'gmail') this.workspaceItems = await fetchGmailMessages();
          else if (type === 'tasks') this.workspaceItems = await fetchTasksList();
          else if (type === 'contacts') this.workspaceItems = await fetchContactsList();
          else if (type === 'chat') this.workspaceItems = await fetchChatSpaces();
          else {
            this.workspaceItems = [
              {
                service: 'Google Docs / Sheets / Slides / Forms / Meet',
                title: 'Workspace Document & Meeting Connectors Active',
                subtitle: 'Ready to inspect Document IDs, Spreadsheets, Presentations, Forms & Meet Spaces',
              },
              {
                service: 'Google Keep',
                title: 'Enterprise Domain-Wide Delegation Info',
                subtitle: 'Keep API (keep.googleapis.com) is reserved for enterprise domain-wide delegation accounts.',
              },
            ];
          }
          this.workspaceStatus = '';
        } catch (err: any) {
          if (String(err.message).includes('NEEDS_AUTH')) {
            this.needsAuth = true;
            this.workspaceStatus = 'Please click Sign in with Google to grant Workspace access.';
          } else {
            this.workspaceStatus = String(err.message || err);
          }
        }
        this.render();
      });
    });

    document.getElementById('btn-ws-schedule-event')?.addEventListener('click', () => {
      this.pendingConfirmation = {
        title: 'Confirm Google Calendar Event Creation',
        description:
          'Are you sure you want to create a new event "OmniStream 32K Live Premiere" on your primary Google Calendar?',
        onConfirm: async () => {
          const item = await createCalendarBroadcastEvent(
            'OmniStream 32K Live Premiere',
            'Scheduled via OmniStream XR Studio with end-to-end encryption.'
          );
          this.workspaceItems = [item, ...this.workspaceItems];
          this.workspaceStatus = 'Created Live Broadcast Event in Google Calendar!';
        },
      };
      this.render();
    });

    document.getElementById('btn-ws-export-drive')?.addEventListener('click', () => {
      this.pendingConfirmation = {
        title: 'Confirm Google Drive File Upload',
        description:
          'Are you sure you want to create and upload "omnistream-32k-manifest.json" to your Google Drive?',
        onConfirm: async () => {
          const manifest = JSON.stringify(
            {
              platform: 'OmniStream XR Studio',
              video: this.currentVideo,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          );
          const item = await saveManifestToDrive('omnistream-32k-manifest.json', manifest);
          this.workspaceItems = [item, ...this.workspaceItems];
          this.workspaceStatus = 'Saved manifest to Google Drive!';
        },
      };
      this.render();
    });

    document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => {
      this.pendingConfirmation = null;
      this.render();
    });

    document.getElementById('btn-confirm-proceed')?.addEventListener('click', async () => {
      const action = this.pendingConfirmation;
      this.pendingConfirmation = null;
      if (action) {
        try {
          await action.onConfirm();
        } catch (err: any) {
          this.workspaceStatus = String(err.message || err);
        }
      }
      this.render();
    });

    // Top-Bar & Floating 90Hz Hardware HUD & 8-Doc / 100-Guardrail Compliance Hub Modals
    document.getElementById('btn-open-hardware-hud')?.addEventListener('click', () => {
      this.suiteState.hardwareTelemetry = hardwareGovernor.getSnapshot();
      this.suiteState.hardwareHudModalOpen = true;
      this.render();
    });
    document.getElementById('btn-floating-open-hw-modal')?.addEventListener('click', () => {
      this.suiteState.hardwareTelemetry = hardwareGovernor.getSnapshot();
      this.suiteState.hardwareHudModalOpen = true;
      this.render();
    });
    document.getElementById('btn-toggle-floating-hw-hud')?.addEventListener('click', () => {
      this.suiteState.hardwareHudFloatingCollapsed =
        !this.suiteState.hardwareHudFloatingCollapsed;
      this.render();
    });
    document.getElementById('btn-floating-hw-trim')?.addEventListener('click', () => {
      this.suiteState.hardwareTelemetry = hardwareGovernor.performMemoryTrim(80);
      this.suiteState.hardwareStatusBanner = `4GB LPDDR4X RAM Trim executed from HUD: Freed ${this.suiteState.hardwareTelemetry.lastMemoryTrimSavedMb} MB (${this.suiteState.hardwareTelemetry.availableRamMb} MB now available).`;
      showLumenToast(`Freed ${this.suiteState.hardwareTelemetry.lastMemoryTrimSavedMb} MB RAM`);
      this.render();
    });
    document.getElementById('btn-close-hardware-hud')?.addEventListener('click', () => {
      this.suiteState.hardwareHudModalOpen = false;
      this.render();
    });

    document.getElementById('slider-hw-gpu-temp')?.addEventListener('change', (e) => {
      const temp = parseFloat((e.target as HTMLInputElement).value);
      this.suiteState.hardwareTelemetry = hardwareGovernor.setGpuTemperatureCelsius(temp);
      this.studio.applyHardwareRenderScale(this.suiteState.hardwareTelemetry.pixelRatioScale);
      this.suiteState.hardwareStatusBanner = `GPU Die Temperature set to ${this.suiteState.hardwareTelemetry.gpuTempCelsius.toFixed(
        1
      )}°C (${this.suiteState.hardwareTelemetry.thermalLevel}) -> ${
        this.suiteState.hardwareTelemetry.targetFps
      } FPS · ${this.suiteState.hardwareTelemetry.gpuClockMhz} MHz · ${Math.round(
        this.suiteState.hardwareTelemetry.pixelRatioScale * 100
      )}% Scale.`;
      showLumenToast(
        `GPU Temp: ${this.suiteState.hardwareTelemetry.gpuTempCelsius.toFixed(1)}°C (${
          this.suiteState.hardwareTelemetry.thermalLevel
        })`
      );
      this.render();
    });

    document.querySelectorAll('.btn-hw-refresh').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.hwRefresh as RefreshRateMode;
        if (mode) {
          this.suiteState.hardwareTelemetry = hardwareGovernor.setRefreshRateMode(mode);
          this.suiteState.hardwareStatusBanner = `Display Governor updated to ${mode} (${this.suiteState.hardwareTelemetry.targetFps} FPS · ${this.suiteState.hardwareTelemetry.frameBudgetMs}ms frame budget).`;
          showLumenToast(`${this.suiteState.hardwareTelemetry.targetFps}Hz Governor Active`);
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-hw-scale').forEach((btn) => {
      btn.addEventListener('click', () => {
        const scaleMode = (btn as HTMLElement).dataset.hwScale as GpuRenderScaleMode;
        if (scaleMode) {
          this.suiteState.hardwareTelemetry = hardwareGovernor.setGpuRenderScaleMode(scaleMode);
          this.studio.applyHardwareRenderScale(this.suiteState.hardwareTelemetry.pixelRatioScale);
          this.suiteState.hardwareStatusBanner = `Mali-G57 MC2 GPU Render Scale set to ${scaleMode} (${Math.round(
            this.suiteState.hardwareTelemetry.pixelRatioScale * 100
          )}% backbuffer).`;
          showLumenToast(`GPU Scale: ${scaleMode}`);
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-hw-thermal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lvl = (btn as HTMLElement).dataset.hwThermal as ThermalStatusLevel;
        if (lvl) {
          this.suiteState.hardwareTelemetry = hardwareGovernor.setThermalStatusLevel(lvl);
          this.studio.applyHardwareRenderScale(this.suiteState.hardwareTelemetry.pixelRatioScale);
          this.suiteState.hardwareStatusBanner = `Simulated thermal state ${lvl} (${this.suiteState.hardwareTelemetry.gpuTempCelsius.toFixed(
            1
          )}°C · ${this.suiteState.hardwareTelemetry.gpuClockMhz} MHz) -> Target ${
            this.suiteState.hardwareTelemetry.targetFps
          } FPS (${this.suiteState.hardwareTelemetry.frameBudgetMs}ms budget).`;
          this.render();
        }
      });
    });

    document.getElementById('btn-hw-trim-memory')?.addEventListener('click', () => {
      this.suiteState.hardwareTelemetry = hardwareGovernor.performMemoryTrim(80);
      this.suiteState.hardwareStatusBanner = `4GB LPDDR4X RAM Trim executed: Freed ${this.suiteState.hardwareTelemetry.lastMemoryTrimSavedMb} MB of cached thumbnails & buffers (${this.suiteState.hardwareTelemetry.availableRamMb} MB now available).`;
      showLumenToast(`Freed ${this.suiteState.hardwareTelemetry.lastMemoryTrimSavedMb} MB RAM`);
      this.render();
    });

    document.getElementById('btn-hw-ufs-flush')?.addEventListener('click', async () => {
      await hardwareGovernor.enqueueSequentialUfsIo(
        () => new Promise((resolve) => setTimeout(resolve, 25))
      );
      this.suiteState.hardwareTelemetry = hardwareGovernor.getSnapshot();
      this.suiteState.hardwareStatusBanner = `Sequential UFS 2.1 I/O batch write committed (${this.suiteState.hardwareTelemetry.ufsCompletedOps} total sequential operations).`;
      showLumenToast('UFS 2.1 Sequential I/O Committed');
      this.render();
    });

    // Compliance & 100 Guardrails Modal Events
    document.getElementById('btn-open-compliance-hub')?.addEventListener('click', () => {
      this.suiteState.complianceHubModalOpen = true;
      this.render();
    });
    document.getElementById('btn-close-compliance-hub')?.addEventListener('click', () => {
      this.suiteState.complianceHubModalOpen = false;
      this.render();
    });

    document.querySelectorAll('.btn-comp-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.compTab as 'DOCS_8' | 'GUARDRAILS_100';
        if (tab) {
          this.suiteState.complianceActiveTab = tab;
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-select-comp-doc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = (btn as HTMLElement).dataset.docFile;
        if (filename) {
          this.suiteState.selectedComplianceDocFilename = filename;
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-gr-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.grCat as 'ALL' | GuardrailCategoryId;
        if (cat) {
          this.suiteState.guardrailCategoryFilter = cat;
          this.render();
        }
      });
    });

    document.getElementById('input-guardrail-search')?.addEventListener('input', (e) => {
      this.suiteState.guardrailSearchQuery = (e.target as HTMLInputElement).value;
      this.render();
      const input = document.getElementById('input-guardrail-search') as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    // AES-256-GCM + AAD & 64KB Chunked Stream Vault Events
    document.getElementById('btn-encrypt-vault')?.addEventListener('click', async () => {
      const input =
        (document.getElementById('input-e2e-secret') as HTMLInputElement)?.value ||
        this.suiteState.vaultPlaintext;
      const userId =
        (document.getElementById('input-e2e-aad-user') as HTMLInputElement)?.value ||
        PRIMARY_ADMIN_EMAIL;
      const recordId =
        (document.getElementById('input-e2e-aad-record') as HTMLInputElement)?.value ||
        'vault_rec_32k_master';

      this.suiteState.vaultPlaintext = input;
      this.suiteState.vaultUserId = userId;
      this.suiteState.vaultRecordId = recordId;

      const aad = buildCanonicalAadContext(userId, recordId);
      const env = await encryptAes256GcmWithAad(
        input,
        'omnistream-vault-key-2026',
        aad
      );
      this.suiteState.vaultEnvelope = env;
      this.encryptedVaultCipher = env.packedBase64Url;
      this.suiteState.vaultDecryptedText = '';
      this.suiteState.vaultTamperStatus = '';
      showLumenToast('Encrypted with AES-256-GCM + AAD');
      this.render();
    });

    document.getElementById('btn-decrypt-vault')?.addEventListener('click', async () => {
      const userId =
        (document.getElementById('input-e2e-aad-user') as HTMLInputElement)?.value ||
        this.suiteState.vaultUserId;
      const recordId =
        (document.getElementById('input-e2e-aad-record') as HTMLInputElement)?.value ||
        this.suiteState.vaultRecordId;
      this.suiteState.vaultUserId = userId;
      this.suiteState.vaultRecordId = recordId;

      if (!this.suiteState.vaultEnvelope) {
        const aad = buildCanonicalAadContext(userId, recordId);
        this.suiteState.vaultEnvelope = await encryptAes256GcmWithAad(
          this.suiteState.vaultPlaintext,
          'omnistream-vault-key-2026',
          aad
        );
      }

      try {
        const expectedAad = buildCanonicalAadContext(userId, recordId);
        const plain = await decryptAes256GcmWithAad(
          this.suiteState.vaultEnvelope.packedBase64Url,
          'omnistream-vault-key-2026',
          expectedAad
        );
        this.suiteState.vaultDecryptedText = plain;
        this.decryptedVaultPlain = plain;
        this.suiteState.vaultTamperStatus = '';
        showLumenToast('AAD & 128-bit AuthTag Verified');
      } catch (err: any) {
        this.suiteState.vaultDecryptedText = '';
        this.suiteState.vaultTamperStatus = String(err?.message || err);
      }
      this.render();
    });

    document.getElementById('btn-tamper-aad-test')?.addEventListener('click', async () => {
      if (!this.suiteState.vaultEnvelope) {
        const aad = buildCanonicalAadContext(
          this.suiteState.vaultUserId,
          this.suiteState.vaultRecordId
        );
        this.suiteState.vaultEnvelope = await encryptAes256GcmWithAad(
          this.suiteState.vaultPlaintext,
          'omnistream-vault-key-2026',
          aad
        );
      }
      try {
        const forgedAad = buildCanonicalAadContext(
          'unauthorized_actor@external.invalid',
          'transplanted_record_99'
        );
        await decryptAes256GcmWithAad(
          this.suiteState.vaultEnvelope.packedBase64Url,
          'omnistream-vault-key-2026',
          forgedAad
        );
      } catch (err: any) {
        this.suiteState.vaultDecryptedText = '';
        this.suiteState.vaultTamperStatus = `${String(
          err?.message || err
        )} (Forged AAD "user_id:unauthorized_actor@external.invalid|record_id:transplanted_record_99" rejected!)`;
        showLumenToast('Tampered AAD Rejected');
      }
      this.render();
    });

    document.getElementById('btn-chunk-stream-test')?.addEventListener('click', async () => {
      const aad = buildCanonicalAadContext(
        this.suiteState.vaultUserId,
        this.suiteState.vaultRecordId
      );
      const streamSource = `${this.suiteState.vaultPlaintext} :: [32K-STREAM-PACKET] `.repeat(12);
      const streamRes = await encryptChunkedStreamAes256Gcm(
        streamSource,
        'omnistream-vault-key-2026',
        aad,
        256
      );
      const restored = await decryptChunkedStreamAes256Gcm(
        streamRes,
        'omnistream-vault-key-2026',
        aad
      );
      this.suiteState.vaultChunkStreamResult = streamRes;
      this.suiteState.vaultChunkRestoredPreview = `${restored.slice(0, 68)}...`;
      showLumenToast(`Encrypted & Verified ${streamRes.chunkCount} Stream Chunks`);
      this.render();
    });

    // VibePitch Studio 7-Niche Workbench Events
    document.querySelectorAll('.btn-vibe-niche').forEach((btn) => {
      btn.addEventListener('click', () => {
        const niche = (btn as HTMLElement).dataset.vibeNiche as NicheKey;
        if (niche) {
          const preset = getNichePreset(niche);
          this.suiteState.vibeSelectedNiche = niche;
          this.suiteState.vibeSetupFee = preset.recommendedSetupFeeUsd;
          this.suiteState.vibeMonthlyRetainer = preset.recommendedMonthlyRetainerUsd;
          this.suiteState.vibeDepositPercent = preset.defaultScopeGuardrail.depositPercent;
          this.suiteState.vibeStatusBanner = `Loaded ${preset.title} preset ($${preset.recommendedSetupFeeUsd} setup · $${preset.recommendedMonthlyRetainerUsd}/mo retainer).`;
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-vibe-day').forEach((btn) => {
      btn.addEventListener('click', () => {
        const day = parseInt((btn as HTMLElement).dataset.vibeDay || '1', 10);
        this.suiteState.vibeSimulatedTrialDay = day;
        this.render();
      });
    });

    const syncVibeInputsFromDom = () => {
      const rawBiz =
        (document.getElementById('input-vibe-biz') as HTMLInputElement)?.value ||
        this.suiteState.vibeBusinessName;
      const rawContact =
        (document.getElementById('input-vibe-contact') as HTMLInputElement)?.value ||
        this.suiteState.vibeContactName;
      const rawGap =
        (document.getElementById('input-vibe-gap') as HTMLInputElement)?.value ||
        this.suiteState.vibeWebsiteGap;
      const rawSetup = parseFloat(
        (document.getElementById('input-vibe-setup') as HTMLInputElement)?.value ||
          String(this.suiteState.vibeSetupFee)
      );
      const rawRetainer = parseFloat(
        (document.getElementById('input-vibe-retainer') as HTMLInputElement)?.value ||
          String(this.suiteState.vibeMonthlyRetainer)
      );
      const rawDeposit = parseFloat(
        (document.getElementById('input-vibe-deposit') as HTMLInputElement)?.value ||
          String(this.suiteState.vibeDepositPercent)
      );

      const normProspect = InputBoundsValidator.normalizeProspectInput(
        rawBiz,
        rawContact,
        rawGap
      );
      const normFin = InputBoundsValidator.normalizeLeadFinancials(
        rawSetup,
        rawRetainer,
        rawDeposit
      );

      this.suiteState.vibeBusinessName = normProspect.businessName;
      this.suiteState.vibeContactName = normProspect.contactName;
      this.suiteState.vibeWebsiteGap = normProspect.websiteGapNote;
      this.suiteState.vibeSetupFee = normFin.setupFeeOffer;
      this.suiteState.vibeMonthlyRetainer = normFin.monthlyRetainerOffer;
      this.suiteState.vibeDepositPercent = normFin.depositPercent;
    };

    document.getElementById('btn-vibe-apply-inputs')?.addEventListener('click', () => {
      syncVibeInputsFromDom();
      this.suiteState.vibeStatusBanner = `Validated bounds via InputBoundsValidator and regenerated 6 pitch scripts for "${this.suiteState.vibeBusinessName}".`;
      showLumenToast('6 Pitch Scripts Updated');
      this.render();
    });

    document.getElementById('btn-vibe-save-lead')?.addEventListener('click', () => {
      syncVibeInputsFromDom();
      const nowMs = 1_700_000_000_000;
      const installMs =
        nowMs - Math.max(0, this.suiteState.vibeSimulatedTrialDay - 1) * 86_400_000;
      const lifecycle = evaluateGuestLifecycleAt(installMs, nowMs);

      if (lifecycle.requiresAuthGate && this.needsAuth) {
        this.suiteState.vibeStatusBanner =
          '30-Day Guest Window Expired (Day 31+): Please click "Sign in with Google" to migrate local leads and save new pipeline records.';
        showLumenToast('Sign In Required (Day 31+ Gate)');
        this.render();
        return;
      }

      const newLead = {
        id: `lead_${Date.now()}`,
        niche: this.suiteState.vibeSelectedNiche,
        businessName: this.suiteState.vibeBusinessName,
        contactName: this.suiteState.vibeContactName,
        websiteGapNote: this.suiteState.vibeWebsiteGap,
        setupFeeOffer: this.suiteState.vibeSetupFee,
        monthlyRetainerOffer: this.suiteState.vibeMonthlyRetainer,
        depositPercent: this.suiteState.vibeDepositPercent,
        stage: PipelineStage.PROSPECT,
      };
      this.suiteState.vibeLeads.unshift(newLead);
      this.suiteState.vibeStatusBanner = `Saved "${newLead.businessName}" ($${newLead.setupFeeOffer} setup) to Commercial Pipeline.`;
      showLumenToast('Lead Added to Pipeline');
      this.render();
    });

    document.querySelectorAll('.btn-advance-lead').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.advanceLead;
        this.suiteState.vibeLeads = this.suiteState.vibeLeads.map((lead) =>
          lead.id === id
            ? { ...lead, stage: getNextPipelineStage(lead.stage) }
            : lead
        );
        showLumenToast('Pipeline Stage Advanced');
        this.render();
      });
    });
  }

  private async postAuthenticatedGemini(
    endpoint: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, any>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.currentUser) {
      const idToken = await this.currentUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return (await res.json()) as Record<string, any>;
  }

  // Gemini Live API Client (16kHz PCM input, 24kHz gapless scheduled output)
  private async startLiveSession() {
    try {
      if (!this.currentUser) {
        this.aiStatusMessage = 'Authentication required: Please sign in with Google to start a Gemini Live Voice session.';
        showLumenToast('Sign in required for Gemini Live');
        this.render();
        return;
      }
      const idToken = await this.currentUser.getIdToken();
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.liveWs = new WebSocket(
        `${proto}//${location.host}/live?token=${encodeURIComponent(idToken)}`
      );
      this.inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.inputAudioCtx.createMediaStreamSource(stream);
      const processor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(this.inputAudioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!this.liveWs || this.liveWs.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        this.liveWs.send(JSON.stringify({ audio: btoa(binary) }));
      };

      this.liveWs.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.error) {
          this.aiStatusMessage = msg.error;
          this.liveTranscripts.push(`System: ${msg.error}`);
          this.render();
          return;
        }
        if (msg.inputTranscript) {
          this.liveTranscripts.push(`You: ${msg.inputTranscript}`);
          this.render();
        }
        if (msg.outputTranscript) {
          this.liveTranscripts.push(`Gemini Live: ${msg.outputTranscript}`);
          this.render();
        }
        if (msg.audio && this.outputAudioCtx) {
          this.playPcm24kChunk(msg.audio);
        }
        if (msg.interrupted) {
          this.nextStartTime = 0;
        }
      };

      this.liveConnected = true;
      this.liveTranscripts.push('Connected to Gemini 3.8 Live Voice API.');
      this.render();
    } catch (err) {
      this.aiStatusMessage = `Live session error: ${String(err)}`;
      this.render();
    }
  }

  private playPcm24kChunk(base64Pcm: string) {
    if (!this.outputAudioCtx) return;
    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAudioCtx.destination);

    const now = this.outputAudioCtx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now;
    }
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  private stopLiveSession() {
    this.liveWs?.close();
    this.liveWs = null;
    this.inputAudioCtx?.close().catch(() => {});
    this.outputAudioCtx?.close().catch(() => {});
    this.liveConnected = false;
    this.render();
  }

  private async recordAndTranscribeMic() {
    try {
      this.aiStatusMessage = 'Recording 3 seconds of mic audio for gemini-3.5-transcribe...';
      this.render();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result || '').split(',')[1] || '';
          const data = await this.postAuthenticatedGemini('/api/gemini/transcribe', {
            base64Audio: base64,
            mimeType: 'audio/webm',
          });
          this.transcriptionText = data.text || data.error || 'No speech detected.';
          this.aiStatusMessage = 'Transcription complete.';
          this.render();
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 3000);
    } catch (err) {
      this.aiStatusMessage = `Mic error: ${String(err)}`;
      this.render();
    }
  }
}
