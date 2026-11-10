import {
  YouTubeChannelProfile,
  YouTubeLikedVideo,
  YouTubeQuotaTelemetry,
  YouTubeRatingState,
  formatIsoDuration,
} from '../services/youtube';

export type YouTubeSortMode = 'DEFAULT' | 'VIEWS_DESC' | 'DATE_DESC';

export interface YouTubeLikesViewState {
  needsAuth: boolean;
  loading: boolean;
  errorMessage: string;
  statusMessage: string;
  channel: YouTubeChannelProfile | null;
  videos: YouTubeLikedVideo[];
  searchQuery: string;
  sortMode: YouTubeSortMode;
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults: number;
  fromCache: boolean;
  quota: YouTubeQuotaTelemetry;
  googleSignInButtonHtml: string;
}

export interface YouTubeLikesViewCallbacks {
  onFetchLikedVideos: (options?: { pageToken?: string; forceRefresh?: boolean }) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (mode: YouTubeSortMode) => void;
  onRequestRateVideo: (video: YouTubeLikedVideo, targetRating: YouTubeRatingState) => void;
  onLookupAndLikeById: (rawIdOrUrl: string, rating: YouTubeRatingState) => void;
}

export class YouTubeLikesView {
  public static filterAndSortVideos(
    videos: YouTubeLikedVideo[],
    searchQuery: string,
    sortMode: YouTubeSortMode
  ): YouTubeLikedVideo[] {
    const q = searchQuery.trim().toLowerCase();
    const filtered = videos.filter((v) => {
      if (v.myRating === 'none') return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.channelTitle.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    if (sortMode === 'VIEWS_DESC') {
      return [...filtered].sort((a, b) => b.viewCount - a.viewCount);
    }
    if (sortMode === 'DATE_DESC') {
      return [...filtered].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    }
    return filtered;
  }

  public static formatPublishDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso.slice(0, 10);
    }
  }

  public static render(state: YouTubeLikesViewState): string {
    const visibleVideos = YouTubeLikesView.filterAndSortVideos(
      state.videos,
      state.searchQuery,
      state.sortMode
    );

    const quotaPct = Math.min(
      100,
      Math.round((state.quota.unitsUsed / state.quota.dailyLimit) * 100)
    );

    return `
      <section
        aria-label="YouTube Likes Manager Dashboard"
        class="pointer-events-auto w-full h-full flex-1 bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 p-4 md:p-6 overflow-y-auto flex flex-col gap-4"
      >
        <!-- Top Header Bar: Breadcrumb + Channel Profile + Quota Guard Telemetry -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              ▶
            </div>
            <div>
              <div class="text-xs font-mono-code text-slate-500 dark:text-slate-400">
                YouTube Data API v3 · OAuth 2.0 · Liked Videos & Rating Manager
              </div>
              <h1 class="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                YouTube Liked Videos & Rating Studio
              </h1>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <!-- Quota Telemetry Readout -->
            <div class="text-xs font-mono-code text-slate-600 dark:text-slate-300 tabular-nums px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800">
              Quota: <strong>${state.quota.unitsUsed.toLocaleString()}</strong> / ${state.quota.dailyLimit.toLocaleString()} units (${quotaPct}%) · Cache Hits: <strong class="text-emerald-600 dark:text-emerald-400">${state.quota.cacheHits}</strong>
            </div>

            <button
              id="yt-btn-sync"
              class="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 whitespace-nowrap shrink-0 transition"
            >
              ${state.loading ? 'Syncing API...' : 'Sync Liked Videos'}
            </button>
          </div>
        </div>

        <!-- Channel Summary + Rate Video by ID/URL Bar -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- Left 6 Cols: Authenticated Channel & System "Liked" Playlist Info -->
          <div class="lg:col-span-6 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3">
            ${
              state.channel
                ? `<div class="flex items-center gap-3">
                     ${
                       state.channel.avatarUrl
                         ? `<img src="${state.channel.avatarUrl}" alt="${state.channel.title}" referrerpolicy="no-referrer" class="w-10 h-10 rounded-full object-cover border border-slate-300 dark:border-slate-700" />`
                         : `<div class="w-10 h-10 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-sm">${state.channel.title.slice(0, 1)}</div>`
                     }
                     <div>
                       <div class="text-sm font-bold text-slate-900 dark:text-white">
                         ${state.channel.title}
                         <span class="text-xs font-mono-code text-slate-500 dark:text-slate-400 font-normal ml-1">${state.channel.customUrl}</span>
                       </div>
                       <div class="text-xs font-mono-code text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                         Liked Playlist ID: <strong class="text-sky-600 dark:text-sky-300">${state.channel.likedPlaylistId}</strong> · ${state.totalResults.toLocaleString()} Liked Videos · ${state.fromCache ? 'Served from In-Memory Cache' : 'Live API Response'}
                       </div>
                     </div>
                   </div>`
                : `<div class="flex items-center justify-between w-full gap-3">
                     <div>
                       <div class="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                         YouTube Account Connection
                       </div>
                       <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                         Sign in with your Google account to load your private YouTube Liked Videos playlist and manage ratings.
                       </div>
                     </div>
                     ${state.needsAuth ? state.googleSignInButtonHtml : ''}
                   </div>`
            }
          </div>

          <!-- Right 6 Cols: Rate Any YouTube Video by ID or URL (POST /videos/rate) -->
          <div class="lg:col-span-6 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-center gap-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-800 dark:text-slate-200">
                Rate Any YouTube Video (POST /youtube/v3/videos/rate)
              </span>
              <span class="font-mono-code text-[11px] text-slate-500 dark:text-slate-400">
                Requires Confirmation
              </span>
            </div>
            <div class="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                id="yt-input-rate-id"
                type="text"
                placeholder="Paste YouTube Video ID or URL (e.g. dQw4w9WgXcQ)..."
                class="flex-1 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
              />
              <button
                id="yt-btn-add-like"
                class="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0 transition"
              >
                + Like Video
              </button>
              <button
                id="yt-btn-add-dislike"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition"
              >
                Dislike
              </button>
            </div>
          </div>
        </div>

        <!-- Status / Error Banner (if any) -->
        ${
          state.errorMessage
            ? `<div class="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-200">
                 <span>${state.errorMessage}</span>
                 ${state.needsAuth ? state.googleSignInButtonHtml : ''}
               </div>`
            : state.statusMessage
            ? `<div class="px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-xs font-mono-code text-sky-700 dark:text-sky-300">
                 ${state.statusMessage}
               </div>`
            : ''
        }

        <!-- Local Filter, Sort & Pagination Bar (Zero API Quota Local Filtering) -->
        <div class="flex flex-wrap items-center justify-between gap-3 py-2 border-y border-slate-200 dark:border-slate-800">
          <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            <input
              id="yt-input-search"
              type="text"
              value="${state.searchQuery}"
              placeholder="Search loaded liked videos by title, channel, or tag (0 quota cost)..."
              class="w-full max-w-md bg-slate-50 dark:bg-[#0f172a] text-xs text-slate-900 dark:text-white px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
            />
            <span class="text-xs font-mono-code text-slate-500 dark:text-slate-400 tabular-nums">
              Showing ${visibleVideos.length} of ${state.videos.filter((v) => v.myRating !== 'none').length} loaded
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <select
              id="yt-select-sort"
              aria-label="Sort liked videos"
              class="bg-slate-50 dark:bg-[#0f172a] text-xs font-mono-code text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
            >
              <option value="DEFAULT" ${state.sortMode === 'DEFAULT' ? 'selected' : ''}>Sort: Liked Order</option>
              <option value="VIEWS_DESC" ${state.sortMode === 'VIEWS_DESC' ? 'selected' : ''}>Sort: Most Viewed</option>
              <option value="DATE_DESC" ${state.sortMode === 'DATE_DESC' ? 'selected' : ''}>Sort: Newest Published</option>
            </select>

            <button
              id="yt-btn-prev-page"
              ${state.prevPageToken ? '' : 'disabled'}
              class="px-2.5 py-1.5 text-xs font-mono-code rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 disabled:opacity-40"
            >
              ← Prev Page
            </button>
            <button
              id="yt-btn-next-page"
              ${state.nextPageToken ? '' : 'disabled'}
              class="px-2.5 py-1.5 text-xs font-mono-code rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 disabled:opacity-40"
            >
              Next Page →
            </button>
          </div>
        </div>

        <!-- Main Responsive Grid of Liked YouTube Videos -->
        ${
          state.loading
            ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 ${[1, 2, 3, 4, 5, 6]
                   .map(
                     () => `
                   <div class="rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-3 space-y-2.5">
                     <div class="w-full aspect-video rounded-lg bg-slate-200 dark:bg-slate-800"></div>
                     <div class="h-4 w-4/5 rounded bg-slate-200 dark:bg-slate-800"></div>
                     <div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800"></div>
                   </div>`
                   )
                   .join('')}
               </div>`
            : visibleVideos.length === 0
            ? `<div class="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800">
                 <h2 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                   ${
                     state.needsAuth
                       ? 'Connect Your Google Account to Load Liked Videos'
                       : state.searchQuery
                       ? `No liked videos match "${state.searchQuery}"`
                       : 'No Liked YouTube Videos Loaded Yet'
                   }
                 </h2>
                 <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-4">
                   ${
                     state.needsAuth
                       ? 'Sign in with Google to grant YouTube permission and fetch GET /youtube/v3/videos?myRating=like.'
                       : 'Click "Sync Liked Videos" above to fetch your liked videos from the YouTube Data API v3, or clear your search filter.'
                   }
                 </p>
                 ${
                   state.needsAuth
                     ? state.googleSignInButtonHtml
                     : `<button id="yt-btn-empty-sync" class="px-4 py-2 text-xs font-bold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition">
                          Fetch My Liked Videos Now
                        </button>`
                 }
               </div>`
            : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 ${visibleVideos
                   .map((v) => {
                     const duration = formatIsoDuration(v.durationIso);
                     const pubDate = YouTubeLikesView.formatPublishDate(v.publishedAt);
                     return `
                       <article class="rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between transition hover:border-slate-400 dark:hover:border-slate-600">
                         <div>
                           <!-- 16:9 Video Thumbnail -->
                           <div class="relative aspect-video bg-black overflow-hidden">
                             <img
                               src="${v.thumbnailUrl}"
                               alt="${v.title.replace(/"/g, '&quot;')}"
                               referrerpolicy="no-referrer"
                               class="w-full h-full object-cover"
                             />
                             <span class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-white font-mono-code text-[11px] tabular-nums">
                               ${duration}
                             </span>
                           </div>

                           <!-- Video Title, Channel & Unboxed Metadata -->
                           <div class="p-3.5 space-y-1.5">
                             <a
                               href="https://www.youtube.com/watch?v=${v.id}"
                               target="_blank"
                               rel="noopener noreferrer"
                               class="text-sm font-bold text-slate-900 dark:text-white hover:text-sky-500 dark:hover:text-sky-400 line-clamp-2 block"
                             >
                               ${v.title}
                             </a>
                             <div class="text-xs text-slate-600 dark:text-slate-300 font-medium">
                               ${v.channelTitle} · Published ${pubDate}
                             </div>
                             <div class="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums">
                               ${v.viewCount.toLocaleString()} views · ${v.likeCount.toLocaleString()} likes · ID: ${v.id}
                             </div>
                           </div>
                         </div>

                         <!-- Card Footer: Rating Controls (Unlike / Dislike / Watch) -->
                         <div class="px-3.5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                           <a
                             href="https://www.youtube.com/watch?v=${v.id}"
                             target="_blank"
                             rel="noopener noreferrer"
                             class="text-xs font-mono-code text-sky-600 dark:text-sky-400 hover:underline"
                           >
                             Watch on YouTube ↗
                           </a>

                           <div class="flex items-center gap-1.5">
                             <button
                               data-yt-dislike-id="${v.id}"
                               class="yt-btn-card-dislike px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                             >
                               Dislike
                             </button>
                             <button
                               data-yt-unlike-id="${v.id}"
                               class="yt-btn-card-unlike px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-500 transition"
                             >
                               Remove Like
                             </button>
                           </div>
                         </div>
                       </article>
                     `;
                   })
                   .join('')}
               </div>`
        }
      </section>
    `;
  }

  public static bindEvents(
    state: YouTubeLikesViewState,
    callbacks: YouTubeLikesViewCallbacks
  ): void {
    document.getElementById('yt-btn-sync')?.addEventListener('click', () => {
      callbacks.onFetchLikedVideos({ forceRefresh: true });
    });

    document.getElementById('yt-btn-empty-sync')?.addEventListener('click', () => {
      callbacks.onFetchLikedVideos({ forceRefresh: false });
    });

    document.getElementById('yt-btn-prev-page')?.addEventListener('click', () => {
      if (state.prevPageToken) {
        callbacks.onFetchLikedVideos({ pageToken: state.prevPageToken });
      }
    });

    document.getElementById('yt-btn-next-page')?.addEventListener('click', () => {
      if (state.nextPageToken) {
        callbacks.onFetchLikedVideos({ pageToken: state.nextPageToken });
      }
    });

    document.getElementById('yt-input-search')?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value;
      callbacks.onSearchChange(q);
    });

    document.getElementById('yt-select-sort')?.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as YouTubeSortMode;
      callbacks.onSortChange(mode);
    });

    document.getElementById('yt-btn-add-like')?.addEventListener('click', () => {
      const input = document.getElementById('yt-input-rate-id') as HTMLInputElement | null;
      const val = input?.value.trim() || '';
      if (val) {
        callbacks.onLookupAndLikeById(val, 'like');
      }
    });

    document.getElementById('yt-btn-add-dislike')?.addEventListener('click', () => {
      const input = document.getElementById('yt-input-rate-id') as HTMLInputElement | null;
      const val = input?.value.trim() || '';
      if (val) {
        callbacks.onLookupAndLikeById(val, 'dislike');
      }
    });

    document.querySelectorAll('.yt-btn-card-unlike').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.ytUnlikeId;
        const found = state.videos.find((v) => v.id === id);
        if (found) {
          callbacks.onRequestRateVideo(found, 'none');
        }
      });
    });

    document.querySelectorAll('.yt-btn-card-dislike').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.ytDislikeId;
        const found = state.videos.find((v) => v.id === id);
        if (found) {
          callbacks.onRequestRateVideo(found, 'dislike');
        }
      });
    });
  }
}
