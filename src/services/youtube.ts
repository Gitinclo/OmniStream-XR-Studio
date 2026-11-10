import { getAccessToken } from './firebase';

export type YouTubeRatingState = 'like' | 'dislike' | 'none';

export interface YouTubeLikedVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationIso: string;
  tags: string[];
  myRating: YouTubeRatingState;
}

export interface YouTubeChannelProfile {
  id: string;
  title: string;
  customUrl: string;
  avatarUrl: string;
  likedPlaylistId: string;
  subscriberCount: number;
  videoCount: number;
}

export interface YouTubeLikesResponse {
  items: YouTubeLikedVideo[];
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults: number;
  fromCache: boolean;
}

export interface YouTubeQuotaTelemetry {
  dailyLimit: number;
  unitsUsed: number;
  cacheHits: number;
  lastFetchedAt: string | null;
}

// In-memory quota-saving cache (never persisted to localStorage)
const likedPagesCache = new Map<string, YouTubeLikesResponse>();
let cachedChannelProfile: YouTubeChannelProfile | null = null;

const quotaTelemetry: YouTubeQuotaTelemetry = {
  dailyLimit: 10000,
  unitsUsed: 0,
  cacheHits: 0,
  lastFetchedAt: null,
};

export function getYouTubeQuotaTelemetry(): YouTubeQuotaTelemetry {
  return { ...quotaTelemetry };
}

export function clearYouTubeCache(): void {
  likedPagesCache.clear();
  cachedChannelProfile = null;
}

async function requireYouTubeToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NEEDS_AUTH: Please sign in with Google to access your YouTube account.');
  }
  return token;
}

/**
 * Fetches the authenticated user's YouTube channel profile and system "Liked Videos" playlist ID.
 * Cost: 1 quota unit (cached in memory after first load).
 */
export async function fetchMyYouTubeChannel(forceRefresh = false): Promise<YouTubeChannelProfile | null> {
  if (!forceRefresh && cachedChannelProfile) {
    quotaTelemetry.cacheHits += 1;
    return cachedChannelProfile;
  }

  const token = await requireYouTubeToken();
  const url =
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('NEEDS_AUTH: YouTube permission required. Please sign in with Google.');
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube Channel API error (${res.status}): ${errText}`);
  }

  quotaTelemetry.unitsUsed += 1;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;

  cachedChannelProfile = {
    id: String(ch.id || ''),
    title: String(ch.snippet?.title || 'YouTube Creator'),
    customUrl: String(ch.snippet?.customUrl || '@creator'),
    avatarUrl: String(
      ch.snippet?.thumbnails?.default?.url ||
        ch.snippet?.thumbnails?.medium?.url ||
        ''
    ),
    likedPlaylistId: String(ch.contentDetails?.relatedPlaylists?.likes || 'LL'),
    subscriberCount: Number(ch.statistics?.subscriberCount || 0),
    videoCount: Number(ch.statistics?.videoCount || 0),
  };

  return cachedChannelProfile;
}

/**
 * Fetches the authenticated user's liked videos via GET /youtube/v3/videos?myRating=like.
 * Cost: 1 quota unit per uncached page request.
 */
export async function fetchLikedYouTubeVideos(options?: {
  pageToken?: string;
  maxResults?: number;
  forceRefresh?: boolean;
}): Promise<YouTubeLikesResponse> {
  const pageKey = options?.pageToken || '__FIRST_PAGE__';
  const maxResults = options?.maxResults || 12;

  if (!options?.forceRefresh && likedPagesCache.has(pageKey)) {
    quotaTelemetry.cacheHits += 1;
    const cached = likedPagesCache.get(pageKey)!;
    return { ...cached, fromCache: true };
  }

  const token = await requireYouTubeToken();
  const params = new URLSearchParams({
    myRating: 'like',
    part: 'snippet,statistics,contentDetails',
    maxResults: String(maxResults),
  });
  if (options?.pageToken) {
    params.set('pageToken', options.pageToken);
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('NEEDS_AUTH: YouTube permission required. Please sign in with Google.');
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube Videos API error (${res.status}): ${errText}`);
  }

  quotaTelemetry.unitsUsed += 1;
  quotaTelemetry.lastFetchedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const data = await res.json();
  const items: YouTubeLikedVideo[] = (data.items || []).map((item: Record<string, any>) =>
    mapYouTubeVideoItem(item, 'like')
  );

  const response: YouTubeLikesResponse = {
    items,
    nextPageToken: data.nextPageToken,
    prevPageToken: data.prevPageToken,
    totalResults: Number(data.pageInfo?.totalResults ?? items.length),
    fromCache: false,
  };

  likedPagesCache.set(pageKey, response);
  return response;
}

/**
 * Fetches details for a specific YouTube video ID so a user can inspect and rate it.
 * Cost: 1 quota unit.
 */
export async function fetchYouTubeVideoById(
  rawIdOrUrl: string
): Promise<YouTubeLikedVideo | null> {
  const videoId = extractYouTubeVideoId(rawIdOrUrl);
  if (!videoId) {
    throw new Error('Please enter a valid YouTube Video ID or watch URL.');
  }

  const token = await requireYouTubeToken();
  const params = new URLSearchParams({
    id: videoId,
    part: 'snippet,statistics,contentDetails',
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('NEEDS_AUTH: YouTube permission required. Please sign in with Google.');
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube lookup error (${res.status}): ${errText}`);
  }

  quotaTelemetry.unitsUsed += 1;
  const data = await res.json();
  const first = data.items?.[0];
  if (!first) return null;
  return mapYouTubeVideoItem(first, 'like');
}

/**
 * Rates a YouTube video using POST https://www.googleapis.com/youtube/v3/videos/rate
 * Rating states: 'like' | 'dislike' | 'none' (removes the like/dislike).
 * Cost: 50 quota units. Also updates the in-memory cache immediately.
 */
export async function rateYouTubeVideo(
  videoId: string,
  rating: YouTubeRatingState
): Promise<void> {
  const cleanId = extractYouTubeVideoId(videoId);
  if (!cleanId) {
    throw new Error('Invalid YouTube video ID.');
  }

  const token = await requireYouTubeToken();
  const params = new URLSearchParams({
    id: cleanId,
    rating,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos/rate?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('NEEDS_AUTH: YouTube write permission required. Please sign in with Google.');
  }
  if (!res.ok && res.status !== 204) {
    const errText = await res.text();
    throw new Error(`YouTube Rate API error (${res.status}): ${errText}`);
  }

  quotaTelemetry.unitsUsed += 50;
  quotaTelemetry.lastFetchedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Update cached pages in memory so the UI stays in sync without burning extra quota
  for (const [key, page] of likedPagesCache.entries()) {
    const updatedItems = page.items.map((v) =>
      v.id === cleanId ? { ...v, myRating: rating } : v
    );
    likedPagesCache.set(key, { ...page, items: updatedItems });
  }
}

export function extractYouTubeVideoId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      const url = new URL(trimmed);
      if (url.hostname.includes('youtu.be')) {
        return url.pathname.replace('/', '').slice(0, 20);
      }
      const v = url.searchParams.get('v');
      if (v) return v.slice(0, 20);
    }
  } catch {
    // Fallback to raw ID regex
  }
  const match = trimmed.match(/^[a-zA-Z0-9_-]{6,20}$/);
  return match ? match[0] : '';
}

export function formatIsoDuration(iso: string): string {
  if (!iso) return '0:00';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function mapYouTubeVideoItem(
  item: Record<string, any>,
  defaultRating: YouTubeRatingState
): YouTubeLikedVideo {
  const snippet = item.snippet || {};
  const stats = item.statistics || {};
  const contentDetails = item.contentDetails || {};
  const thumbs = snippet.thumbnails || {};
  const thumbUrl =
    thumbs.maxres?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url ||
    'https://picsum.photos/seed/youtube/640/360';

  return {
    id: String(item.id || ''),
    title: String(snippet.title || 'Untitled YouTube Video'),
    description: String(snippet.description || ''),
    channelTitle: String(snippet.channelTitle || 'YouTube Channel'),
    channelId: String(snippet.channelId || ''),
    publishedAt: String(snippet.publishedAt || new Date().toISOString()),
    thumbnailUrl: String(thumbUrl),
    viewCount: Number(stats.viewCount || 0),
    likeCount: Number(stats.likeCount || 0),
    commentCount: Number(stats.commentCount || 0),
    durationIso: String(contentDetails.duration || 'PT0M0S'),
    tags: Array.isArray(snippet.tags) ? snippet.tags.slice(0, 6).map(String) : [],
    myRating: defaultRating,
  };
}
