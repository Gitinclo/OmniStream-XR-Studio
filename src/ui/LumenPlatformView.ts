import { publishVideoToFirestore, addVideoComment } from '../services/firebase';

export interface LumenComment {
  u: string;
  x: string;
  t: number;
}

export interface LumenVideoItem {
  id: string;
  title: string;
  ch: string;
  cat: string;
  dur: number;
  views: number;
  desc: string;
  likes: number;
  t: number;
  cm: LumenComment[];
  thumb?: string;
}

export interface LumenPersistedState {
  v: number;
  vids: LumenVideoItem[];
  subs: string[];
  liked: string[];
  disl: string[];
  later: string[];
  hist: string[];
}

export const LUMEN_CATS = [
  'All',
  'Music',
  'Gaming',
  'Learning',
  'Tech',
  'Travel',
  'Cooking',
] as const;

const LUMEN_COLORS = [
  '#3a4bff',
  '#ff5a6a',
  '#12a594',
  '#e08a00',
  '#8a3ffc',
  '#0b7a4b',
  '#c2255c',
];

const LUMEN_SEED: Array<[string, string, string, number, number, string]> = [
  [
    'Build a synth from scratch in 20 minutes',
    'Wave Lab',
    'Music',
    1240,
    412000,
    'A tour of oscillators, filters and envelopes.',
  ],
  [
    'Speedrun: the whole game in under an hour',
    'Pixel Pete',
    'Gaming',
    3410,
    880000,
    'Route breakdown with every skip explained.',
  ],
  [
    'Linear algebra, visualised',
    'Open Classroom',
    'Learning',
    1820,
    1900000,
    'Vectors, matrices and transforms you can see.',
  ],
  [
    'How video streaming scales to millions',
    'Systems Notes',
    'Tech',
    960,
    640000,
    'CDNs, adaptive bitrate and chunked delivery.',
  ],
  [
    '48 hours in Lisbon on a budget',
    'Roam Daily',
    'Travel',
    780,
    210000,
    'Trams, tiles and the best pastel de nata.',
  ],
  [
    'Silky carbonara, no cream',
    'Salt & Pan',
    'Cooking',
    540,
    1300000,
    'Three ingredients and one important trick.',
  ],
  [
    'Ambient focus mix for deep work',
    'Wave Lab',
    'Music',
    3600,
    95000,
    'Soft textures, no vocals.',
  ],
  [
    'Rust vs Go for backend services',
    'Systems Notes',
    'Tech',
    1330,
    390000,
    'Latency, safety and team velocity compared.',
  ],
  [
    'Hidden gems in Kyoto',
    'Roam Daily',
    'Travel',
    1020,
    330000,
    'Quiet temples away from the crowds.',
  ],
  [
    'Indie game devlog: month six',
    'Pixel Pete',
    'Gaming',
    870,
    48000,
    'Shipping the first playable level.',
  ],
  [
    'Sourdough for impatient people',
    'Salt & Pan',
    'Cooking',
    690,
    720000,
    'A same-day loaf with a fast starter.',
  ],
  [
    'Probability puzzles that fool everyone',
    'Open Classroom',
    'Learning',
    1100,
    1500000,
    'Three classic paradoxes explained.',
  ],
];

function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c] || c;
  });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const LUMEN_THUMB_THEMES: Array<{
  bg: string;
  accent: string;
  hue: number;
  badge: string;
  svg: string;
}> = [
  // s0: Build a synth from scratch in 20 minutes (Music - Wave Lab)
  {
    bg: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 55%, #ec4899 100%)',
    accent: '#f472b6',
    hue: 265,
    badge: 'SYNTH LAB',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="260" cy="40" r="65" fill="rgba(244,114,182,0.18)" />
      <path d="M0 110 Q 40 40, 80 110 T 160 110 T 240 110 T 320 110" stroke="#38bdf8" stroke-width="3.5" fill="none" opacity="0.85"/>
      <path d="M0 120 Q 40 65, 80 120 T 160 120 T 240 120 T 320 120" stroke="#f472b6" stroke-width="2.5" fill="none" opacity="0.75"/>
      <g transform="translate(95, 42)">
        <rect x="0" y="0" width="130" height="68" rx="10" fill="rgba(15,23,42,0.75)" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
        <circle cx="30" cy="34" r="14" stroke="#f472b6" stroke-width="2.5" fill="rgba(244,114,182,0.15)"/>
        <line x1="30" y1="34" x2="38" y2="24" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        <circle cx="65" cy="34" r="14" stroke="#38bdf8" stroke-width="2.5" fill="rgba(56,189,248,0.15)"/>
        <line x1="65" y1="34" x2="65" y2="20" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        <circle cx="100" cy="34" r="14" stroke="#a78bfa" stroke-width="2.5" fill="rgba(167,139,250,0.15)"/>
        <line x1="100" y1="34" x2="110" y2="38" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>`,
  },
  // s1: Speedrun: the whole game in under an hour (Gaming - Pixel Pete)
  {
    bg: 'linear-gradient(135deg, #0f172a 0%, #0284c7 52%, #10b981 100%)',
    accent: '#34d399',
    hue: 190,
    badge: 'ANY% WR',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="140" r="70" fill="rgba(16,185,129,0.2)" />
      <rect x="78" y="44" width="164" height="76" rx="14" fill="rgba(15,23,42,0.8)" stroke="rgba(52,211,153,0.5)" stroke-width="2"/>
      <text x="160" y="88" text-anchor="middle" fill="#34d399" font-family="monospace" font-weight="800" font-size="26">56:49.82</text>
      <text x="160" y="108" text-anchor="middle" fill="#bae6fd" font-family="sans-serif" font-weight="600" font-size="10" letter-spacing="2">GOLD SPLIT -1:14.2</text>
    </svg>`,
  },
  // s2: Linear algebra, visualised (Learning - Open Classroom)
  {
    bg: 'linear-gradient(135deg, #172554 0%, #1d4ed8 50%, #06b6d4 100%)',
    accent: '#38bdf8',
    hue: 215,
    badge: 'MATH 3D',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="rgba(255,255,255,0.14)" stroke-width="1">
        <line x1="40" y1="20" x2="280" y2="160" />
        <line x1="40" y1="70" x2="280" y2="110" />
        <line x1="40" y1="140" x2="280" y2="40" />
        <line x1="110" y1="10" x2="110" y2="170" />
        <line x1="210" y1="10" x2="210" y2="170" />
      </g>
      <line x1="160" y1="125" x2="235" y2="55" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="238,52 225,56 233,65" fill="#fbbf24"/>
      <line x1="160" y1="125" x2="95" y2="62" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="92,59 97,71 105,63" fill="#38bdf8"/>
      <circle cx="160" cy="125" r="5" fill="#ffffff"/>
    </svg>`,
  },
  // s3: How video streaming scales to millions (Tech - Systems Notes)
  {
    bg: 'linear-gradient(135deg, #090d16 0%, #334155 50%, #0ea5e9 100%)',
    accent: '#38bdf8',
    hue: 202,
    badge: 'CDN ARCH',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="95" y1="90" x2="160" y2="50" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 3"/>
      <line x1="95" y1="90" x2="160" y2="130" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 3"/>
      <line x1="160" y1="50" x2="230" y2="70" stroke="#34d399" stroke-width="2"/>
      <line x1="160" y1="130" x2="230" y2="110" stroke="#34d399" stroke-width="2"/>
      <rect x="55" y="70" width="44" height="40" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="160" cy="50" r="16" fill="#0f172a" stroke="#a78bfa" stroke-width="2"/>
      <circle cx="160" cy="130" r="16" fill="#0f172a" stroke="#a78bfa" stroke-width="2"/>
      <rect x="225" y="58" width="42" height="64" rx="8" fill="#0f172a" stroke="#34d399" stroke-width="2"/>
    </svg>`,
  },
  // s4: 48 hours in Lisbon on a budget (Travel - Roam Daily)
  {
    bg: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 52%, #facc15 100%)',
    accent: '#fde047',
    hue: 32,
    badge: 'LISBON',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="245" cy="52" r="28" fill="#fef08a" opacity="0.85"/>
      <rect x="95" y="64" width="130" height="64" rx="12" fill="#facc15" stroke="#fff" stroke-width="2.5"/>
      <rect x="108" y="76" width="26" height="22" rx="4" fill="#7c2d12"/>
      <rect x="146" y="76" width="26" height="22" rx="4" fill="#7c2d12"/>
      <rect x="184" y="76" width="26" height="22" rx="4" fill="#7c2d12"/>
      <circle cx="122" cy="132" r="9" fill="#1e293b" stroke="#fff" stroke-width="2"/>
      <circle cx="198" cy="132" r="9" fill="#1e293b" stroke="#fff" stroke-width="2"/>
    </svg>`,
  },
  // s5: Silky carbonara, no cream (Cooking - Salt & Pan)
  {
    bg: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)',
    accent: '#fcd34d',
    hue: 42,
    badge: 'RECIPE',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="96" r="52" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
      <circle cx="160" cy="96" r="36" fill="#fef3c7" opacity="0.9"/>
      <path d="M138 92 Q 160 72, 182 92 T 145 108" stroke="#d97706" stroke-width="4" stroke-linecap="round" fill="none"/>
      <circle cx="160" cy="94" r="11" fill="#f59e0b"/>
    </svg>`,
  },
  // s6: Ambient focus mix for deep work (Music - Wave Lab)
  {
    bg: 'linear-gradient(135deg, #0f172a 0%, #312e81 50%, #0d9488 100%)',
    accent: '#2dd4bf',
    hue: 175,
    badge: '60M MIX',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="90" r="56" stroke="rgba(45,212,191,0.45)" stroke-width="2"/>
      <circle cx="160" cy="90" r="38" stroke="rgba(129,140,248,0.6)" stroke-width="2"/>
      <circle cx="160" cy="90" r="20" fill="rgba(45,212,191,0.35)"/>
    </svg>`,
  },
  // s7: Rust vs Go for backend services (Tech - Systems Notes)
  {
    bg: 'linear-gradient(135deg, #431407 0%, #c2410c 48%, #0284c7 100%)',
    accent: '#38bdf8',
    hue: 18,
    badge: 'BENCHMARK',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="64" y="54" width="76" height="72" rx="12" fill="rgba(15,23,42,0.75)" stroke="#fb923c" stroke-width="2"/>
      <text x="102" y="96" text-anchor="middle" fill="#fdba74" font-family="sans-serif" font-weight="800" font-size="20">RUST</text>
      <rect x="180" y="54" width="76" height="72" rx="12" fill="rgba(15,23,42,0.75)" stroke="#38bdf8" stroke-width="2"/>
      <text x="218" y="96" text-anchor="middle" fill="#7dd3fc" font-family="sans-serif" font-weight="800" font-size="20">GO</text>
      <text x="160" y="95" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="800" font-size="14">VS</text>
    </svg>`,
  },
  // s8: Hidden gems in Kyoto (Travel - Roam Daily)
  {
    bg: 'linear-gradient(135deg, #4c0519 0%, #be123c 52%, #fb7185 100%)',
    accent: '#fda4af',
    hue: 345,
    badge: 'KYOTO',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="86" r="46" fill="#fecdd3" opacity="0.25"/>
      <path d="M95 62 Q 160 48, 225 62" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <line x1="112" y1="82" x2="208" y2="82" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="126" y1="62" x2="122" y2="138" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <line x1="194" y1="62" x2="198" y2="138" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  },
  // s9: Indie game devlog: month six (Gaming - Pixel Pete)
  {
    bg: 'linear-gradient(135deg, #2e1065 0%, #7c3aed 52%, #c084fc 100%)',
    accent: '#e9d5ff',
    hue: 275,
    badge: 'DEVLOG #6',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="96" y="56" width="128" height="68" rx="22" fill="rgba(15,23,42,0.78)" stroke="#e9d5ff" stroke-width="2"/>
      <path d="M126 82 V98 M118 90 H134" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <circle cx="186" cy="84" r="5" fill="#f472b6"/>
      <circle cx="198" cy="94" r="5" fill="#34d399"/>
    </svg>`,
  },
  // s10: Sourdough for impatient people (Cooking - Salt & Pan)
  {
    bg: 'linear-gradient(135deg, #451a03 0%, #92400e 52%, #d97706 100%)',
    accent: '#fde68a',
    hue: 36,
    badge: 'BAKING',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M100 118 C 100 68, 220 68, 220 118 Z" fill="#f59e0b" stroke="#fef3c7" stroke-width="2.5"/>
      <path d="M135 84 Q 145 96, 138 106 M160 80 Q 170 92, 163 104 M185 84 Q 195 96, 188 106" stroke="#fef3c7" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  },
  // s11: Probability puzzles that fool everyone (Learning - Open Classroom)
  {
    bg: 'linear-gradient(135deg, #064e3b 0%, #059669 52%, #34d399 100%)',
    accent: '#a7f3d0',
    hue: 158,
    badge: 'PARADOX',
    svg: `<svg viewBox="0 0 320 180" class="w-full h-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="98" y="54" width="54" height="54" rx="10" fill="rgba(15,23,42,0.8)" stroke="#a7f3d0" stroke-width="2"/>
      <circle cx="115" cy="71" r="4" fill="#fff"/>
      <circle cx="135" cy="91" r="4" fill="#fff"/>
      <rect x="168" y="68" width="54" height="54" rx="10" fill="rgba(15,23,42,0.8)" stroke="#fde047" stroke-width="2"/>
      <circle cx="182" cy="82" r="4" fill="#fde047"/>
      <circle cx="195" cy="95" r="4" fill="#fde047"/>
      <circle cx="208" cy="108" r="4" fill="#fde047"/>
    </svg>`,
  },
];

function getVideoTheme(v: LumenVideoItem) {
  if (v.id.startsWith('s')) {
    const idx = parseInt(v.id.slice(1), 10);
    if (!Number.isNaN(idx) && LUMEN_THUMB_THEMES[idx]) {
      return LUMEN_THUMB_THEMES[idx];
    }
  }
  const idx = hash(`${v.id}-${v.title}-${v.cat}`) % LUMEN_THUMB_THEMES.length;
  return LUMEN_THUMB_THEMES[idx];
}

function fmtN(n: number): string {
  return n >= 1e6
    ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
    ? `${(n / 1e3).toFixed(1)}K`
    : `${n}`;
}

function fmtT(s: number): string {
  const sec = Math.round(s);
  const m = Math.floor(sec / 60);
  return `${m}:${`0${sec % 60}`.slice(-2)}`;
}

function ago(t: number): string {
  const d = (Date.now() - t) / 864e5;
  return d < 1
    ? 'today'
    : d < 30
    ? `${Math.floor(d)} days ago`
    : d < 365
    ? `${Math.floor(d / 30)} months ago`
    : `${Math.floor(d / 365)} years ago`;
}

export function showLumenToast(msg: string): void {
  const t = document.createElement('div');
  t.className =
    'fixed left-1/2 bottom-8 -translate-x-1/2 bg-[#141a2e] dark:bg-[#eef0fa] text-[#f4f6fb] dark:text-[#0e1222] px-4 py-2 rounded-full text-sm font-semibold shadow-xl z-50 pointer-events-none';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  window.setTimeout(() => {
    t.remove();
  }, 1800);
}

export class LumenPlatformManager {
  public vids: LumenVideoItem[] = [];
  public subs: string[] = [];
  public liked: string[] = [];
  public disl: string[] = [];
  public later: string[] = [];
  public hist: string[] = [];

  public cat = 'All';
  public sort: 'Recent' | 'Popular' = 'Recent';
  public view: '' | 'later' | 'liked' = '';
  public q = '';
  public cur: LumenVideoItem | null = null;
  public theater = false;
  public uploadModalOpen = false;
  public sessionURLs: Record<string, string> = {};

  private rafId = 0;

  constructor() {
    this.load();
  }

  public load(): void {
    try {
      const raw = localStorage.getItem('lumen');
      if (raw) {
        const parsed = JSON.parse(raw) as LumenPersistedState;
        if (parsed && parsed.v === 1 && Array.isArray(parsed.vids)) {
          this.vids = parsed.vids;
          this.subs = Array.isArray(parsed.subs) ? parsed.subs : [];
          this.liked = Array.isArray(parsed.liked) ? parsed.liked : [];
          this.disl = Array.isArray(parsed.disl) ? parsed.disl : [];
          this.later = Array.isArray(parsed.later) ? parsed.later : [];
          this.hist = Array.isArray(parsed.hist) ? parsed.hist : [];
          return;
        }
      }
    } catch {
      // Fallback to seed data
    }

    this.vids = LUMEN_SEED.map((r, i) => ({
      id: `s${i}`,
      title: r[0],
      ch: r[1],
      cat: r[2],
      dur: r[3],
      views: r[4],
      desc: r[5],
      likes: Math.round(r[4] / 28),
      t: Date.now() - (i + 1) * 864e5 * 9,
      cm: [],
    }));
    this.subs = [];
    this.liked = [];
    this.disl = [];
    this.later = [];
    this.hist = [];
  }

  public save(): void {
    try {
      const payload: LumenPersistedState = {
        v: 1,
        vids: this.vids.map((v) => ({ ...v })),
        subs: this.subs,
        liked: this.liked,
        disl: this.disl,
        later: this.later,
        hist: this.hist,
      };
      localStorage.setItem('lumen', JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }

  public stopDemoAnimation(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public startDemoAnimation(v: LumenVideoItem): void {
    this.stopDemoAnimation();
    const c = document.getElementById('lumen-cv') as HTMLCanvasElement | null;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;

    const theme = getVideoTheme(v);
    const h = theme.hue;
    const t0 = performance.now();
    let playing = true;
    c.width = 960;
    c.height = 540;
    c.onclick = () => {
      playing = !playing;
    };

    const frameLoop = (n: number) => {
      const t = playing ? (n - t0) / 1000 : 0;
      if (playing) {
        const g = x.createLinearGradient(0, 0, 960, 540);
        g.addColorStop(0, `hsl(${(h + t * 8) % 360},70%,38%)`);
        g.addColorStop(1, `hsl(${(h + 95 + t * 8) % 360},75%,20%)`);
        x.fillStyle = g;
        x.fillRect(0, 0, 960, 540);

        for (let i = 0; i < 9; i++) {
          x.beginPath();
          x.arc(
            480 + Math.cos(t * 0.7 + i) * 300,
            270 + Math.sin(t * 0.9 + i * 1.7) * 160,
            40 + i * 10,
            0,
            6.3
          );
          x.fillStyle = `rgba(255,255,255,${0.05 + i * 0.01})`;
          x.fill();
        }

        x.fillStyle = '#fff';
        x.font = '700 34px "Bricolage Grotesque", sans-serif';
        x.textAlign = 'center';
        x.fillText(v.ch, 480, 260);
        x.font = '600 20px "Bricolage Grotesque", sans-serif';
        x.fillStyle = 'rgba(255,255,255,0.85)';
        x.fillText(v.title, 480, 298);
        x.font = '16px "Bricolage Grotesque", sans-serif';
        x.fillStyle = 'rgba(255,255,255,0.65)';
        x.fillText('Click to pause / resume interactive preview', 480, 336);
      }

      if (document.getElementById('lumen-cv')) {
        this.rafId = requestAnimationFrame(frameLoop);
      }
    };

    this.rafId = requestAnimationFrame(frameLoop);
  }

  public extractVideoFrame(
    file: File,
    cb: (objectUrl: string, duration: number, thumbDataUrl: string) => void
  ): void {
    const u = URL.createObjectURL(file);
    const e = document.createElement('video');
    e.muted = true;
    e.preload = 'metadata';
    e.src = u;
    e.onloadedmetadata = () => {
      e.currentTime = Math.min(1, (e.duration || 0) / 3);
    };
    e.onseeked = () => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 180;
      let th = '';
      try {
        c.getContext('2d')?.drawImage(e, 0, 0, 320, 180);
        th = c.toDataURL('image/jpeg', 0.6);
      } catch {
        // Ignore CORS/frame error
      }
      cb(u, e.duration || 0, th);
    };
    e.onerror = () => {
      cb(u, 0, '');
    };
  }

  private renderThumbnail(v: LumenVideoItem): string {
    const theme = getVideoTheme(v);
    const img = v.thumb
      ? `<img alt="${esc(v.title)}" src="${v.thumb}" class="w-full h-full object-cover block" />`
      : `<div class="absolute inset-0 pointer-events-none">${theme.svg}</div>`;
    return `
      <div class="aspect-video rounded-xl relative overflow-hidden bg-[#171c33] shadow-sm border border-black/5 dark:border-white/10 group-hover:scale-[1.01] transition-transform" style="background:${theme.bg}">
        ${img}
        ${
          v.thumb
            ? ''
            : `<div class="absolute left-2.5 top-2 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                 <span class="px-2 py-0.5 rounded-md bg-black/45 text-white text-[11px] font-semibold tracking-wide">${esc(v.ch)}</span>
                 <span class="px-1.5 py-0.5 rounded bg-white/15 text-white text-[10px] font-mono-code font-bold tracking-wider">${esc(theme.badge)}</span>
               </div>`
        }
        <span class="absolute right-2 bottom-2 bg-black/85 text-white text-xs font-semibold px-1.5 py-0.5 rounded font-mono-code tabular-nums">${fmtT(v.dur)}</span>
      </div>
    `;
  }

  private renderAvatar(ch: string): string {
    const bg = LUMEN_COLORS[hash(ch) % LUMEN_COLORS.length];
    return `<div class="w-[34px] h-[34px] rounded-full shrink-0 grid place-items-center text-white font-extrabold text-sm shadow-sm" style="background:${bg}">${esc(ch[0] || 'L')}</div>`;
  }

  private renderCard(v: LumenVideoItem): string {
    const isLiked = this.liked.includes(v.id);
    return `
      <div class="lumen-card cursor-pointer rounded-xl group focus:outline-2 focus:outline-[#3a4bff] dark:focus:outline-[#7c89ff]" tabindex="0" role="link" data-lumen-id="${esc(v.id)}">
        ${this.renderThumbnail(v)}
        <div class="flex gap-2.5 mt-2.5 items-start">
          ${this.renderAvatar(v.ch)}
          <div class="min-w-0 flex-1">
            <h3 class="m-0 text-[15px] font-semibold leading-snug line-clamp-2 text-[#141a2e] dark:text-[#eef0fa] group-hover:text-[#3a4bff] dark:group-hover:text-[#7c89ff] transition-colors">
              ${esc(v.title)}
            </h3>
            <div class="text-[13px] text-[#5d6580] dark:text-[#9aa2c0] mt-0.5">
              ${esc(v.ch)}<br />
              <span class="tabular-nums">${fmtN(v.views)} views · ${ago(v.t)}${isLiked ? ' · 👍 Liked' : ''}</span>
            </div>
          </div>
          <button
            type="button"
            data-lumen-card-report="${esc(v.id)}"
            title="Report Content"
            aria-label="Report ${esc(v.title)}"
            class="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 shrink-0 cursor-pointer transition"
          >
            ⚑ Report
          </button>
        </div>
      </div>
    `;
  }

  private getFilteredList(): LumenVideoItem[] {
    const q = this.q.toLowerCase().trim();
    let a = this.vids.filter(
      (v) =>
        (this.cat === 'All' || v.cat === this.cat) &&
        (!q || `${v.title}${v.ch}${v.cat}`.toLowerCase().includes(q))
    );
    if (this.view === 'later') {
      a = a.filter((v) => this.later.includes(v.id));
    } else if (this.view === 'liked') {
      a = a.filter((v) => this.liked.includes(v.id));
    }
    a.sort((x, y) => (this.sort === 'Popular' ? y.views - x.views : y.t - x.t));
    return a;
  }

  public render(onChange: () => void, isAuthenticated: boolean): string {
    void onChange;
    void isAuthenticated;

    const activeBody = this.cur ? this.renderWatchView(this.cur) : this.renderHomeView();

    return `
      <section
        aria-label="Lumen Video Platform"
        class="font-lumen pointer-events-auto w-full h-full flex-1 bg-[#f4f6fb] dark:bg-[#0e1222] text-[#141a2e] dark:text-[#eef0fa] overflow-y-auto flex flex-col"
      >
        <!-- Lumen Sticky Search & Action Bar -->
        <header class="sticky top-0 z-10 bg-[#f4f6fb]/95 dark:bg-[#0e1222]/95 border-b border-[#e0e4f0] dark:border-[#262d4a]">
          <div class="max-w-[1360px] mx-auto flex items-center gap-2.5 px-3.5 md:px-6 py-2.5">
            <div
              id="lumen-home-logo"
              tabindex="0"
              role="button"
              aria-label="Lumen Home"
              class="font-extrabold text-xl tracking-tight cursor-pointer flex items-center gap-2 whitespace-nowrap select-none"
            >
              <i class="w-[22px] h-[22px] rounded-full inline-block shrink-0" style="background:conic-gradient(#7c89ff,#ff7a88,#7c89ff)"></i>
              <span>Lumen</span>
            </div>

            <form id="lumen-search-form" class="flex-1 max-w-xl mx-auto min-w-0 flex" role="search">
              <input
                id="lumen-q"
                type="search"
                value="${esc(this.q)}"
                placeholder="Search videos, topics, and channels..."
                aria-label="Search videos and channels"
                class="flex-1 min-w-0 px-3.5 py-2 rounded-full border border-[#e0e4f0] dark:border-[#262d4a] bg-white dark:bg-[#171c33] text-sm text-[#141a2e] dark:text-[#eef0fa] focus:outline-2 focus:outline-[#3a4bff] dark:focus:outline-[#7c89ff]"
              />
            </form>

            <div class="flex items-center gap-2 shrink-0">
              <button
                id="lumen-up-btn"
                type="button"
                class="px-4 py-2 rounded-full font-semibold text-sm bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] hover:opacity-90 transition cursor-pointer whitespace-nowrap"
              >
                + Upload
              </button>

              <button
                id="lumen-open-admin"
                type="button"
                title="Open Administration, Game Master (GM), Admin & Moderator Control & Contact (creatergame31@gmail.com)"
                class="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-500/20 transition cursor-pointer whitespace-nowrap"
              >
                <span>🛡 Admin / GM: creatergame31@gmail.com</span>
              </button>

              <a
                href="/assets/aistudio/Lumen___video_platform_3699f6af.html"
                target="_blank"
                rel="noopener noreferrer"
                title="Open standalone Lumen HTML template"
                class="hidden sm:inline-flex items-center px-3 py-2 rounded-full text-xs font-semibold border border-[#e0e4f0] dark:border-[#262d4a] bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] hover:opacity-90 transition whitespace-nowrap"
              >
                Standalone ↗
              </a>
            </div>
          </div>
        </header>

        <!-- Lumen Main Content Area -->
        <div class="flex-1 w-full max-w-[1360px] mx-auto px-3.5 md:px-6 py-4 pb-8">
          ${activeBody}
        </div>

        ${this.uploadModalOpen ? this.renderUploadModal() : ''}
      </section>
    `;
  }

  private renderHomeView(): string {
    const a = this.getFilteredList();

    return `
      <!-- Category & Filter Chips (Responsive wrapping so no chip is ever clipped) -->
      <div class="flex flex-wrap items-center justify-between gap-y-2.5 gap-x-3 pb-4 mb-1 border-b border-[#e0e4f0] dark:border-[#262d4a]" role="tablist">
        <div class="flex flex-wrap items-center gap-1.5">
          ${LUMEN_CATS.map((c) => {
            const on = c === this.cat && !this.view;
            return `<button
              type="button"
              data-lumen-cat="${c}"
              class="lumen-chip shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
                on
                  ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                  : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a] hover:border-[#3a4bff] dark:hover:border-[#7c89ff]'
              }"
            >${c}</button>`;
          }).join('')}
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-lumen-sort="Recent"
            class="lumen-chip shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
              this.sort === 'Recent'
                ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
            }"
          >
            Recent
          </button>

          <button
            type="button"
            data-lumen-sort="Popular"
            class="lumen-chip shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
              this.sort === 'Popular'
                ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
            }"
          >
            Popular
          </button>

          <button
            type="button"
            data-lumen-view="liked"
            class="lumen-chip shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer tabular-nums ${
              this.view === 'liked'
                ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
            }"
          >
            👍 Liked (${this.liked.length})
          </button>

          <button
            type="button"
            data-lumen-view="later"
            class="lumen-chip shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer tabular-nums ${
              this.view === 'later'
                ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
            }"
          >
            Watch later (${this.later.length})
          </button>
        </div>
      </div>

      ${
        a.length > 0
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-5 pt-3">
               ${a.map((v) => this.renderCard(v)).join('')}
             </div>`
          : `<div class="text-center text-[#5d6580] dark:text-[#9aa2c0] py-16 px-4 rounded-2xl bg-white dark:bg-[#171c33] border border-[#e0e4f0] dark:border-[#262d4a] mt-3">
               <p class="text-base font-semibold text-[#141a2e] dark:text-[#eef0fa] mb-1">No videos match this filter</p>
               <p class="text-sm mb-4">Try selecting "All" categories, clearing your search, or uploading a video.</p>
               <button type="button" id="lumen-reset-empty" class="px-4 py-2 rounded-full text-xs font-semibold bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] cursor-pointer">
                 Show All Videos
               </button>
             </div>`
      }
    `;
  }

  private renderWatchView(v: LumenVideoItem): string {
    const url = this.sessionURLs[v.id];
    const rel = this.vids
      .filter((x) => x.id !== v.id)
      .sort(
        (a, b) =>
          Number(b.cat === v.cat) - Number(a.cat === v.cat) || b.views - a.views
      )
      .slice(0, 8);

    const lk = this.liked.includes(v.id);
    const dl = this.disl.includes(v.id);
    const sb = this.subs.includes(v.ch);
    const wl = this.later.includes(v.id);

    return `
      <div class="grid grid-cols-1 ${this.theater ? '' : 'lg:grid-cols-[minmax(0,1fr)_340px]'} gap-5">
        <!-- Primary Player & Details Column -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <button
              type="button"
              id="lumen-back-home"
              class="px-3 py-1 rounded-full text-xs font-semibold border border-[#e0e4f0] dark:border-[#262d4a] bg-white dark:bg-[#171c33] hover:opacity-90 cursor-pointer"
            >
              ← Back to All Videos
            </button>
            <span class="text-xs text-[#5d6580] dark:text-[#9aa2c0]">Category: ${esc(v.cat)}</span>
          </div>

          <div class="aspect-video bg-black rounded-xl overflow-hidden relative" id="lumen-pl">
            ${
              url
                ? `<video id="lumen-vid" controls playsinline autoplay src="${url}" class="w-full h-full block bg-black"></video>`
                : `<canvas id="lumen-cv" role="img" aria-label="Demo playback for ${esc(v.title)}" class="w-full h-full block bg-black cursor-pointer"></canvas>`
            }
          </div>

          ${
            url
              ? ''
              : `<div class="text-[13px] text-[#5d6580] dark:text-[#9aa2c0] mt-1.5">
                   Demo video: samples animate here. Upload a file to play real video.
                 </div>`
          }

          <h2 class="mt-3 mb-1 text-xl font-bold text-[#141a2e] dark:text-[#eef0fa]">
            ${esc(v.title)}
          </h2>
          <div class="text-[13px] text-[#5d6580] dark:text-[#9aa2c0] tabular-nums">
            ${fmtN(v.views)} views · ${ago(v.t)}
          </div>

          <!-- Interactive Action Bar -->
          <div class="flex flex-wrap items-center gap-2 my-2.5">
            ${this.renderAvatar(v.ch)}
            <b class="text-sm">${esc(v.ch)}</b>
            <button
              type="button"
              data-lumen-a="sub"
              class="px-3.5 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                sb
                  ? 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border border-[#e0e4f0] dark:border-[#262d4a]'
                  : 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222]'
              }"
            >
              ${sb ? 'Subscribed' : 'Subscribe'}
            </button>

            <span class="flex-1"></span>

            <button
              type="button"
              data-lumen-a="like"
              aria-pressed="${lk}"
              class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer tabular-nums ${
                lk
                  ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                  : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
              }"
            >
              👍 ${fmtN(v.likes + (lk ? 1 : 0))}
            </button>

            <button
              type="button"
              data-lumen-a="dis"
              aria-pressed="${dl}"
              class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer ${
                dl
                  ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                  : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
              }"
            >
              👎
            </button>

            <button
              type="button"
              data-lumen-a="later"
              class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer ${
                wl
                  ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                  : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
              }"
            >
              ${wl ? 'Saved' : 'Watch later'}
            </button>

            <button
              type="button"
              data-lumen-a="share"
              class="px-3.5 py-1.5 rounded-full text-sm font-medium border border-[#e0e4f0] dark:border-[#262d4a] bg-white dark:bg-[#171c33] cursor-pointer"
            >
              Share
            </button>

            <button
              type="button"
              data-lumen-a="theater"
              class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer ${
                this.theater
                  ? 'bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] border-[#3a4bff] dark:border-[#7c89ff] font-semibold'
                  : 'bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border-[#e0e4f0] dark:border-[#262d4a]'
              }"
            >
              Theater
            </button>

            <button
              type="button"
              data-lumen-a="report"
              class="px-3.5 py-1.5 rounded-full text-sm font-semibold border border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
            >
              ⚑ Report Content
            </button>

            ${
              url
                ? `<select
                     id="lumen-spd"
                     aria-label="Speed"
                     class="px-3 py-1.5 rounded-full text-sm border border-[#e0e4f0] dark:border-[#262d4a] bg-white dark:bg-[#171c33]"
                   >
                     <option value="0.5">0.5x</option>
                     <option value="1" selected>1x</option>
                     <option value="1.25">1.25x</option>
                     <option value="1.5">1.5x</option>
                     <option value="2">2x</option>
                   </select>`
                : ''
            }
          </div>

          <!-- Description Box -->
          <div class="bg-white dark:bg-[#171c33] border border-[#e0e4f0] dark:border-[#262d4a] rounded-xl p-3 my-2.5 text-sm">
            <div>${esc(v.desc || 'No description.')}</div>
            <div class="text-[13px] text-[#5d6580] dark:text-[#9aa2c0] mt-1.5">
              Shortcuts: space play, f fullscreen, j/l ±10s · Moderator &amp; GM Contact: <a href="mailto:creatergame31@gmail.com" class="underline text-[#3a4bff] dark:text-[#7c89ff]">creatergame31@gmail.com</a>
            </div>
          </div>

          <!-- Comments Section -->
          <h3 class="text-base font-bold mt-4 mb-2 tabular-nums">${v.cm.length} comments</h3>
          <div class="flex gap-2.5 my-3">
            ${this.renderAvatar('You')}
            <div class="flex-1">
              <textarea
                id="lumen-ct"
                rows="2"
                placeholder="Add a comment"
                maxlength="500"
                class="w-full bg-white dark:bg-[#171c33] border border-[#e0e4f0] dark:border-[#262d4a] rounded-xl px-3 py-2 text-sm"
              ></textarea>
              <div class="text-right mt-1.5">
                <button
                  type="button"
                  data-lumen-a="comment"
                  class="px-4 py-1.5 rounded-full text-sm font-semibold bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] cursor-pointer"
                >
                  Comment
                </button>
              </div>
            </div>
          </div>

          <div id="lumen-cms" class="space-y-3">
            ${v.cm
              .map(
                (c, idx) => `
              <div class="flex items-start justify-between gap-2.5">
                <div class="flex gap-2.5">
                  ${this.renderAvatar(c.u)}
                  <div>
                    <b class="text-sm">${esc(c.u)}</b>
                    <span class="text-xs text-[#5d6580] dark:text-[#9aa2c0] ml-1">${ago(c.t)}</span>
                    <div class="text-sm mt-0.5">${esc(c.x)}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-lumen-report-cm="${idx}"
                    class="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    title="Report Comment to Admin"
                  >
                    ⚑ Report
                  </button>
                  <button
                    type="button"
                    data-lumen-del-cm="${idx}"
                    class="text-xs text-rose-500 hover:underline cursor-pointer"
                    title="Moderator Delete Comment"
                  >
                    Remove
                  </button>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <!-- Up Next Related Sidebar -->
        <aside aria-label="Up next">
          <h3 class="mt-0 mb-3 text-base font-bold">Up next</h3>
          <div class="space-y-3">
            ${rel
              .map(
                (r) => `
              <div
                class="lumen-card flex gap-2.5 cursor-pointer rounded-xl group"
                tabindex="0"
                role="link"
                data-lumen-id="${esc(r.id)}"
              >
                <div class="w-[150px] shrink-0">
                  ${this.renderThumbnail(r)}
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="m-0 text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#3a4bff] dark:group-hover:text-[#7c89ff]">
                    ${esc(r.title)}
                  </h4>
                  <div class="text-xs text-[#5d6580] dark:text-[#9aa2c0] mt-1 tabular-nums">
                    ${esc(r.ch)}<br />${fmtN(r.views)} views
                  </div>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </aside>
      </div>
    `;
  }

  private renderUploadModal(): string {
    return `
      <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <form
          id="lumen-uf"
          class="w-full max-w-[440px] rounded-2xl bg-white dark:bg-[#171c33] text-[#141a2e] dark:text-[#eef0fa] border border-[#e0e4f0] dark:border-[#262d4a] p-5 shadow-2xl"
        >
          <h2 class="m-0 mb-1 text-lg font-bold">Upload a video</h2>
          <div class="text-[13px] text-[#5d6580] dark:text-[#9aa2c0] mb-3">
            Plays from your device in this session. Details are saved in this browser.
          </div>

          <label for="lumen-uFile" class="block font-semibold text-xs mt-2.5 mb-1">Video file</label>
          <input
            id="lumen-uFile"
            type="file"
            accept="video/*"
            required
            class="w-full bg-[#f4f6fb] dark:bg-[#0e1222] border border-[#e0e4f0] dark:border-[#262d4a] rounded-lg px-2.5 py-2 text-xs"
          />

          <label for="lumen-uTitle" class="block font-semibold text-xs mt-2.5 mb-1">Title</label>
          <input
            id="lumen-uTitle"
            type="text"
            maxlength="100"
            required
            placeholder="My awesome video"
            class="w-full bg-[#f4f6fb] dark:bg-[#0e1222] border border-[#e0e4f0] dark:border-[#262d4a] rounded-lg px-2.5 py-2 text-sm"
          />

          <label for="lumen-uDesc" class="block font-semibold text-xs mt-2.5 mb-1">Description</label>
          <textarea
            id="lumen-uDesc"
            rows="3"
            placeholder="Tell viewers about your video..."
            class="w-full bg-[#f4f6fb] dark:bg-[#0e1222] border border-[#e0e4f0] dark:border-[#262d4a] rounded-lg px-2.5 py-2 text-sm"
          ></textarea>

          <label for="lumen-uCat" class="block font-semibold text-xs mt-2.5 mb-1">Category</label>
          <select
            id="lumen-uCat"
            class="w-full bg-[#f4f6fb] dark:bg-[#0e1222] border border-[#e0e4f0] dark:border-[#262d4a] rounded-lg px-2.5 py-2 text-sm"
          >
            ${LUMEN_CATS.slice(1)
              .map((c) => `<option value="${c}">${c}</option>`)
              .join('')}
          </select>

          <div class="flex justify-end gap-2 mt-4">
            <button
              type="button"
              id="lumen-uCancel"
              class="px-4 py-2 rounded-full text-sm font-semibold border border-[#e0e4f0] dark:border-[#262d4a] bg-white dark:bg-[#171c33] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded-full text-sm font-semibold bg-[#3a4bff] dark:bg-[#7c89ff] text-white dark:text-[#0e1222] cursor-pointer"
            >
              Publish
            </button>
          </div>
        </form>
      </div>
    `;
  }

  public bindEvents(
    onChange: () => void,
    isAuthenticated: boolean,
    onOpenAdminConsole?: () => void,
    onReportContent?: (payload: {
      targetId: string;
      targetType: 'LUMEN_VIDEO' | 'COMMENT';
      targetTitle: string;
    }) => void
  ): void {
    // Start or stop canvas animation depending on active watch state
    if (this.cur && !this.sessionURLs[this.cur.id]) {
      this.startDemoAnimation(this.cur);
    } else {
      this.stopDemoAnimation();
    }

    const vidEl = document.getElementById('lumen-vid') as HTMLVideoElement | null;
    const spdEl = document.getElementById('lumen-spd') as HTMLSelectElement | null;
    if (vidEl && spdEl) {
      spdEl.onchange = () => {
        vidEl.playbackRate = Number(spdEl.value) || 1;
      };
    }

    document.getElementById('lumen-open-admin')?.addEventListener('click', () => {
      onOpenAdminConsole?.();
    });

    document.getElementById('lumen-home-logo')?.addEventListener('click', () => {
      this.stopDemoAnimation();
      this.cur = null;
      this.cat = 'All';
      this.q = '';
      this.view = '';
      onChange();
    });

    document.getElementById('lumen-back-home')?.addEventListener('click', () => {
      this.stopDemoAnimation();
      this.cur = null;
      onChange();
    });

    document.getElementById('lumen-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('lumen-q') as HTMLInputElement | null;
      this.q = input?.value || '';
      this.view = '';
      this.cur = null;
      onChange();
    });

    document.getElementById('lumen-up-btn')?.addEventListener('click', () => {
      this.uploadModalOpen = true;
      onChange();
    });

    document.getElementById('lumen-uCancel')?.addEventListener('click', () => {
      this.uploadModalOpen = false;
      onChange();
    });

    document.getElementById('lumen-uf')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('lumen-uFile') as HTMLInputElement | null;
      const titleInput = document.getElementById('lumen-uTitle') as HTMLInputElement | null;
      const descInput = document.getElementById('lumen-uDesc') as HTMLTextAreaElement | null;
      const catSelect = document.getElementById('lumen-uCat') as HTMLSelectElement | null;

      const file = fileInput?.files?.[0];
      if (!file) return;

      const title = titleInput?.value.trim() || file.name;
      const desc = descInput?.value.trim() || '';
      const cat = catSelect?.value || 'Tech';

      this.extractVideoFrame(file, (u, dur, thumb) => {
        const id = `u${Date.now()}`;
        this.sessionURLs[id] = u;
        const newItem: LumenVideoItem = {
          id,
          title,
          ch: 'You',
          cat,
          dur,
          views: 1,
          likes: 0,
          t: Date.now(),
          desc,
          cm: [],
          thumb,
        };
        this.vids.unshift(newItem);
        this.uploadModalOpen = false;
        this.cur = newItem;
        if (!this.hist.includes(id)) this.hist.unshift(id);
        this.save();
        showLumenToast('Published');

        if (isAuthenticated) {
          publishVideoToFirestore({
            title: newItem.title,
            description: newItem.desc,
            category: newItem.cat,
            resolution: '32K',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            ageRating: 'ALL',
          }).catch(() => {});
        }

        onChange();
      });
    });

    // Category, Sort & View Filter Chips
    document.querySelectorAll('[data-lumen-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cat = (btn as HTMLElement).dataset.lumenCat || 'All';
        this.view = '';
        onChange();
      });
    });

    document.getElementById('lumen-reset-empty')?.addEventListener('click', () => {
      this.cat = 'All';
      this.q = '';
      this.view = '';
      onChange();
    });

    document.querySelectorAll('[data-lumen-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = (btn as HTMLElement).dataset.lumenSort;
        this.sort = s === 'Popular' ? 'Popular' : 'Recent';
        onChange();
      });
    });

    document.querySelectorAll('[data-lumen-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetView = ((btn as HTMLElement).dataset.lumenView || '') as '' | 'later' | 'liked';
        this.view = this.view === targetView ? '' : targetView;
        onChange();
      });
    });

    // Card Report Content Button (stopPropagation so it doesn't open video)
    document.querySelectorAll('[data-lumen-card-report]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.lumenCardReport;
        const found = this.vids.find((x) => x.id === id);
        if (found && onReportContent) {
          onReportContent({
            targetId: found.id,
            targetType: 'LUMEN_VIDEO',
            targetTitle: `${found.title} (${found.ch})`,
          });
        }
      });
    });

    // Video Card Click & Enter Key
    document.querySelectorAll('.lumen-card').forEach((cardEl) => {
      const openVideo = () => {
        const id = (cardEl as HTMLElement).dataset.lumenId;
        const found = this.vids.find((x) => x.id === id);
        if (found) {
          found.views += 1;
          if (!this.hist.includes(found.id)) this.hist.unshift(found.id);
          this.cur = found;
          this.save();
          onChange();
        }
      };
      cardEl.addEventListener('click', openVideo);
      cardEl.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') openVideo();
      });
    });

    // Inline Comment Report
    document.querySelectorAll('[data-lumen-report-cm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.lumenReportCm);
        if (this.cur && !Number.isNaN(idx) && this.cur.cm[idx] && onReportContent) {
          const c = this.cur.cm[idx];
          onReportContent({
            targetId: `${this.cur.id}_cm_${idx}`,
            targetType: 'COMMENT',
            targetTitle: `Comment by ${c.u}: "${c.x.slice(0, 80)}"`,
          });
        }
      });
    });

    // Inline Moderator Comment Delete
    document.querySelectorAll('[data-lumen-del-cm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.lumenDelCm);
        if (this.cur && !Number.isNaN(idx) && this.cur.cm[idx]) {
          this.cur.cm.splice(idx, 1);
          this.save();
          showLumenToast('Comment removed by Moderator');
          onChange();
        }
      });
    });

    // Watch View Action Buttons
    document.querySelectorAll('[data-lumen-a]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.lumenA;
        const v = this.cur;
        if (!v) return;

        const toggleInArray = (arr: string[], item: string) => {
          const idx = arr.indexOf(item);
          if (idx > -1) arr.splice(idx, 1);
          else arr.push(item);
        };

        if (action === 'like') {
          this.disl = this.disl.filter((x) => x !== v.id);
          toggleInArray(this.liked, v.id);
          showLumenToast(this.liked.includes(v.id) ? 'Added to Liked videos' : 'Removed from Liked videos');
        } else if (action === 'dis') {
          this.liked = this.liked.filter((x) => x !== v.id);
          toggleInArray(this.disl, v.id);
        } else if (action === 'sub') {
          toggleInArray(this.subs, v.ch);
          showLumenToast(this.subs.includes(v.ch) ? `Subscribed to ${v.ch}` : `Unsubscribed from ${v.ch}`);
        } else if (action === 'later') {
          toggleInArray(this.later, v.id);
          showLumenToast(this.later.includes(v.id) ? 'Saved to Watch later' : 'Removed from Watch later');
        } else if (action === 'theater') {
          this.theater = !this.theater;
        } else if (action === 'report') {
          onReportContent?.({
            targetId: v.id,
            targetType: 'LUMEN_VIDEO',
            targetTitle: `${v.title} (${v.ch})`,
          });
          return;
        } else if (action === 'share') {
          const shareUrl = `${location.href.split('#')[0]}#${v.id}`;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(
              () => showLumenToast('Link copied'),
              () => showLumenToast('Copy the address bar link')
            );
          } else {
            showLumenToast('Copy the address bar link');
          }
          return;
        } else if (action === 'comment') {
          const ta = document.getElementById('lumen-ct') as HTMLTextAreaElement | null;
          const text = ta?.value.trim() || '';
          if (!text) return;
          v.cm.unshift({ u: 'You', x: text, t: Date.now() });
          if (isAuthenticated) {
            addVideoComment(v.id, text).catch(() => {});
          }
        }

        this.save();
        onChange();
      });
    });
  }
}
