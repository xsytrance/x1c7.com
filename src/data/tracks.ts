import type { ThemeOverride } from "@/lib/theme";
import type { LyricsSynced } from "@/lib/lyrics";
import type { Planet } from "@/lib/planet";

export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  art: string;
  genre: string;
  mood?: string;
  color: string;
  audioUrl: string;
  soundcloudUrl?: string;
  sunoUrl?: string; // suno.com/song/<id> — scraped from the public profile
  cover?: string; // real cover-art URL (R2); falls back to gradient `art`
  featured?: boolean;
  theme?: ThemeOverride; // manual per-song site-theme override (from tracks.theme)
  lyrics?: string; // plain or LRC-timestamped lyrics
  lyricsSynced?: LyricsSynced; // per-word timings (lyric engine core)
  planet?: Planet; // LLM song analysis (emotion arc, palette, imagery prompts)
};

// ── Bucket ───────────────────────────────────────────────────────────────
// One bucket, one clean layout after the storage reorg:
//   music/    all songs        covers/   album art        planets/  planet art
const MUSIC_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const COLORS = ["#ff2440", "#43f7ff", "#8dff4a", "#ff9b3d", "#7c3cff", "#f5ff6b", "#00ffa8"];
const GENRES = ["Electronic", "Synthwave", "Ambient", "Techno", "Industrial", "Pop", "House", "Dance"];
const MOODS = ["Euphoric", "Defiant", "Dreamy", "Intense", "Confident", "Energetic", "Nostalgic", "Raw"];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Self-contained SVG gradient cover (no external asset, no 404s).
// Used as a fallback layer under the real cover so any missing image self-heals.
export function gradientArt(color: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>` +
    `<defs>` +
    `<linearGradient id='l' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0%' stop-color='${color}' stop-opacity='0.28'/>` +
    `<stop offset='100%' stop-color='#05030b'/></linearGradient>` +
    `<radialGradient id='g' cx='30%' cy='28%' r='75%'>` +
    `<stop offset='0%' stop-color='${color}' stop-opacity='0.6'/>` +
    `<stop offset='70%' stop-color='${color}' stop-opacity='0'/></radialGradient>` +
    `</defs>` +
    `<rect width='600' height='600' fill='#05030b'/>` +
    `<rect width='600' height='600' fill='url(#l)'/>` +
    `<rect width='600' height='600' fill='url(#g)'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ── Cover art ────────────────────────────────────────────────────────────
// Two folders in the art bucket: album-art/ (no-space names) and
// album-art/Art/ (Title-Case names). Tracks fuzzy-match to a cover by title.
const COVER_KEYS: { folder: string; name: string }[] = [
  // album-art/ (no-space)
  ...[
    "23respuestas", "cairostilldancing", "ceasefireinthestatic", "cocktailsandcode",
    "differentthissummer", "iwontbeyourfire-japanese", "iwontbeyourfire", "levelready",
    "migente", "moveover", "mysoullivesinseoul", "paperthatcutyou", "stillmestillyou",
    "voidintogold-forgedabovegold", "voidintogold", "whistleontheriver",
  ].map((name) => ({ folder: "album-art", name })),
  // album-art/Art/ (Title-Case)
  ...[
    "Asia Got My Heart", "Between The Stations", "Brooms In The Boiler Room", "Cold Sugar",
    "Embers Between Wars", "Even If You're Not My Fire", "FeverBreak", "Going Crazy Hiligaynon",
    "Gold No Dey Rust", "Grind It Slow", "Heaven and Hell", "Honey and Venom", "I Dont Quit Now",
    "I Said No", "Im That Somebody", "In Love With The Party", "Jayodeed Going Crazy Rooklyn Mix",
    "Kick Drum From New York", "Lagos Heard Me First", "Light It Myself", "Light The Fire Myself",
    "Low Lights Tokyo", "Manila After Dark", "Music Is My Drug Original", "Music Is My Drug Rooklyn Mix",
    "One Tap Away Original", "One Tap Away Remix", "Saigon After Dark", "Say It With Your Eyes",
    "The Big Top Has WiFi Now", "Whistle On The River", "ai interlude", "fast enough",
    "first day whole month walk it out", "ora de la presion forged above gold", "ora de la presion",
  ].map((name) => ({ folder: "album-art/Art", name })),
];

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^xsytrance\s*(presents\s+|-\s*)?/i, "")
    .replace(/[^a-z0-9]/g, "");

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Explicit cover pins for titles the fuzzy matcher gets wrong or misses
// (e.g. "N" vs "and", accents, or ambiguous Original/Remix variants).
const COVER_OVERRIDES: Record<string, { folder: string; name: string }> = {
  "Honey N Venom (Rude Wine Riddim)": { folder: "album-art/Art", name: "Honey and Venom" },
  "Oro De La Presión": { folder: "album-art/Art", name: "ora de la presion" },
  "One Tap Away": { folder: "album-art/Art", name: "One Tap Away Original" },
  "Red Flags From The Beginning": { folder: "covers", name: "Red Flags From The Beginning" },
  "Under the Elevated": { folder: "covers", name: "Under The Elevated" },
  "Veneno Y Miel": { folder: "covers", name: "Veneno Y Miel" },
};

// Best-effort match a track title to a cover. Explicit overrides win; then an
// exact normalized match; then the longest common prefix (>= 6), nearest length.
function coverFor(title: string): string | undefined {
  const override = COVER_OVERRIDES[title];
  if (override) {
    return `${MUSIC_BASE}/covers/${encodeURIComponent(override.name)}.png`;
  }
  const t = normalizeName(title);
  let best: { folder: string; name: string } | null = null;
  let bestScore = -1;
  for (const cover of COVER_KEYS) {
    const c = normalizeName(cover.name);
    let score: number;
    if (c === t) score = 1_000_000;
    else {
      const lcp = commonPrefix(t, c);
      score = lcp >= 6 ? lcp * 1000 - Math.abs(t.length - c.length) : -1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cover;
    }
  }
  if (!best || bestScore < 0) return undefined;
  return `${MUSIC_BASE}/covers/${encodeURIComponent(best.name)}.png`;
}

// ── Audio sources ────────────────────────────────────────────────────────
// Organized library under music/ (clean names). The storage reorg folded the
// old legacy bucket-root files in here too, so there's one consistent home.
const MP3_FILES = [
  "1st of the Month (Walk It Out)", "23 Respuestas", "AI Interlude", "Amor De Verdad",
  "Another Year Looks Good on You [Happy Birthday Song]", "Between The Stations",
  "Brooms in the Boiler Room", "Cairo Still Dancing", "Ceasefire in the Static (Data Storm Version)",
  "Cocktails && Code",
  "Drink Drink [Don’t Save Me]", "Fast Enough", "Feverbreak", "Going Crazy (Hiligaynon Fusion Mix)",
  "Heaven & Hell (Honey & Venom Remix)", "Honey N Venom (Rude Wine Riddim)", "I Don't Quit Right Now",
  "I Said No!", "In Love With The Party", "Light It Myself (불은 내가)", "Low Lights Tokyo _ 君がいないNight",
  "Membrane Still Insane", "Mi Gente", "Move Over (Minimal Groove Mix)", "Music Is My Drug (Rooklyn Mix)",
  "Music Is My Drug", "One More Breath [Back To Myself]", "One Tap Away (Riverboat Bad Boys Remix)",
  "One Tap Away", "Oro De La Presión", "Push It On Me", "Red Flags From The Beginning",
  "Say It With Your Eyes", "Still Me_ Still You", "The Big Top Has Wi-Fi", "Under the Elevated",
  "Veneno Y Miel", "Void Into Gold (Forged Above Gold Mix)", "Void Into Gold", "Whistle on the River",
  "Who’s That Snake (Funky Slow-Jam Mix)", "xsytrance presents Jayodeed - Going Crazy (Rooklyn Mix)",
  // Folded in from the legacy bucket root during the storage reorg (now music/).
  "Different This Summer", "I Won’t Be Your Fire (Japanese Mix)", "I Won’t Be Your Fire",
  "I'm That Somebody", "My Soul Lives In Seoul", "Paper That Cut You",
];

function cleanTitle(raw: string): string {
  return raw
    .replace(/\.mp3$/i, "")
    .replace(/^xsytrance\s*(presents\s+|-\s*)?/i, "")
    .replace(/\s*_\s*/g, ": ")
    .trim();
}

type Source = { title: string; audioUrl: string };

const sources: Source[] = MP3_FILES.map((file) => ({
  title: cleanTitle(file),
  audioUrl: `${MUSIC_BASE}/music/${encodeURIComponent(file)}.mp3`,
}));

// De-dupe by normalized title (MP3/ versions win over legacy duplicates).
const seen = new Set<string>();
export const tracks: Track[] = sources
  .filter((s) => {
    const key = normalizeName(s.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .map((s, i) => {
    const color = COLORS[i % COLORS.length];
    return {
      id: slugify(s.title),
      title: s.title,
      artist: "xsytrance",
      duration: "0:00",
      durationSeconds: 0,
      art: gradientArt(color),
      cover: coverFor(s.title),
      genre: GENRES[i % GENRES.length],
      mood: MOODS[i % MOODS.length],
      color,
      audioUrl: s.audioUrl,
      // Match the live DB's featured track so the hero doesn't flash a
      // different cover while Supabase data loads. Update this slug whenever
      // `featured` changes in the tracks table.
      featured: slugify(s.title) === "under-the-elevated",
    };
  });

export const featuredTracks = tracks.filter((t) => t.featured);

export const musicSources = [
  { name: "SoundCloud", description: "The archive. Beats, experiments, and works in progress.", url: "https://soundcloud.com/rod-agenor", color: "#ff9b3d" },
  { name: "Suno", description: "AI-generated transmissions. Songs born from prompts.", url: "https://suno.com/@xsytrance", color: "#ff2440" },
];
