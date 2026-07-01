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
  cover?: string; // real cover-art URL (R2); falls back to gradient `art`
  featured?: boolean;
};

// ── Buckets ──────────────────────────────────────────────────────────────
const MUSIC_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const ART_BASE = "https://pub-e9f979edfc5542a1b6d5c37e32537565.r2.dev";

// Encode a key path one segment at a time (keeps the slashes).
function encKey(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

const COLORS = ["#ff2bd6", "#43f7ff", "#8dff4a", "#ff9b3d", "#7c3cff", "#f5ff6b", "#00ffa8"];
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
};

// Best-effort match a track title to a cover. Explicit overrides win; then an
// exact normalized match; then the longest common prefix (>= 6), nearest length.
function coverFor(title: string): string | undefined {
  const override = COVER_OVERRIDES[title];
  if (override) {
    return `${ART_BASE}/${encKey(override.folder)}/${encodeURIComponent(override.name)}.png`;
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
  return `${ART_BASE}/${encKey(best.folder)}/${encodeURIComponent(best.name)}.png`;
}

// ── Audio sources ────────────────────────────────────────────────────────
// New, organized library under MP3/ (clean names).
const MP3_FILES = [
  "1st of the Month (Walk It Out)", "AI Interlude", "Amor De Verdad",
  "Another Year Looks Good on You [Happy Birthday Song]", "Between The Stations",
  "Brooms in the Boiler Room", "Cairo Still Dancing", "Ceasefire in the Static (Data Storm Version)",
  "Drink Drink [Don't Save Me]", "Fast Enough", "Feverbreak", "Going Crazy (Hiligaynon Fusion Mix)",
  "Heaven & Hell (Honey & Venom Remix)", "Honey N Venom (Rude Wine Riddim)", "I Don't Quit Right Now",
  "I Said No!", "In Love With The Party", "Light It Myself (불은 내가)", "Low Lights Tokyo _ 君がいないNight",
  "Membrane Still Insane", "Mi Gente", "Move Over (Minimal Groove Mix)", "Music Is My Drug (Rooklyn Mix)",
  "Music Is My Drug", "One More Breath [Back To Myself]", "One Tap Away (Riverboat Bad Boys Remix)",
  "One Tap Away", "Oro De La Presión", "Push It On Me", "Say It With Your Eyes", "Still Me_ Still You",
  "Void Into Gold (Forged Above Gold Mix)", "Void Into Gold", "Whistle on the River",
  "Who's That Snake (Funky Slow-Jam Mix)", "xsytrance presents Jayodeed - Going Crazy (Rooklyn Mix)",
];

// Older songs that only exist at the bucket root (with the legacy prefix and
// curly apostrophes). Kept verbatim — these URLs are already known-good.
const LEGACY_URLS = [
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20Different%20This%20Summer.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I%20Won%E2%80%99t%20Be%20Your%20Fire%20(Japanese%20Mix).mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I%20Won%E2%80%99t%20Be%20Your%20Fire.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I'm%20That%20Somebody.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20My%20Soul%20Lives%20In%20Seoul.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20Paper%20That%20Cut%20You.mp3",
];

function cleanTitle(raw: string): string {
  return raw
    .replace(/\.mp3$/i, "")
    .replace(/^xsytrance\s*(presents\s+|-\s*)?/i, "")
    .replace(/\s*_\s*/g, ": ")
    .trim();
}

type Source = { title: string; audioUrl: string };

const sources: Source[] = [
  ...MP3_FILES.map((file) => ({
    title: cleanTitle(file),
    audioUrl: `${MUSIC_BASE}/MP3/${encodeURIComponent(file)}.mp3`,
  })),
  ...LEGACY_URLS.map((url) => ({
    title: cleanTitle(decodeURIComponent(url.split("/").pop() || "")),
    audioUrl: url,
  })),
];

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
      featured: s.title === "Mi Gente",
    };
  });

export const featuredTracks = tracks.filter((t) => t.featured);

export const musicSources = [
  { name: "SoundCloud", description: "The archive. Beats, experiments, and works in progress.", url: "https://soundcloud.com/xsytrance", color: "#ff9b3d" },
  { name: "Suno", description: "AI-generated transmissions. Songs born from prompts.", url: "https://suno.com/@xsytrance", color: "#ff2bd6" },
];
