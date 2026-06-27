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

const R2_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

// Art bucket — song covers live at the root with no-space names.
const ART_BASE = "https://pub-e9f979edfc5542a1b6d5c37e32537565.r2.dev";

// Cover files present in the art bucket (no-space naming). New covers can be
// appended here; tracks fuzzy-match to them by normalized title.
const ART_COVERS = [
  "23respuestas",
  "cairostilldancing",
  "ceasefireinthestatic",
  "cocktailsandcode",
  "differentthissummer",
  "iwontbeyourfire-japanese",
  "iwontbeyourfire",
  "levelready",
  "migente",
  "moveover",
  "mysoullivesinseoul",
  "paperthatcutyou",
  "stillmestillyou",
  "voidintogold-forgedabovegold",
  "voidintogold",
  "whistleontheriver",
];

const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Best-effort match a track title to a cover filename. Exact normalized match
// wins; otherwise the longest prefix overlap (>= 6 chars) is used.
function coverFor(title: string): string | undefined {
  const t = normalizeName(title);
  let best: string | null = null;
  let bestScore = 0;
  for (const file of ART_COVERS) {
    const c = normalizeName(file);
    let score = 0;
    if (c === t) score = 1000;
    else if (t.startsWith(c)) score = c.length;
    else if (c.startsWith(t)) score = t.length;
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }
  return best && bestScore >= 6 ? `${ART_BASE}/${best}.png` : undefined;
}

const COLORS = ["#ff2bd6", "#43f7ff", "#8dff4a", "#ff9b3d", "#7c3cff", "#f5ff6b", "#00ffa8", "#ff2bd6", "#43f7ff"];
const GENRES = ["Electronic", "Synthwave", "Ambient", "Techno", "Industrial", "Pop", "House", "Dance", "Electronic"];
const MOODS = ["Euphoric", "Defiant", "Dreamy", "Intense", "Confident", "Energetic", "Nostalgic", "Raw", "Intimate"];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseTitleFromUrl(url: string): string {
  // Extract filename from URL
  const filename = decodeURIComponent(url.split("/").pop() || "");
  // Remove .mp3 and "xsytrance - " prefix
  return filename.replace(/\.mp3$/i, "").replace(/^xsytrance\s*-\s*/i, "").trim();
}

// Self-contained SVG gradient cover (no external asset, no 404s).
// Swap a track's `art` for a real R2 image URL when album art is ready.
function gradientArt(color: string): string {
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

const rawUrls = [
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20Different%20This%20Summer.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I%20Don't%20Quit%20Right%20Now.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I%20Won%E2%80%99t%20Be%20Your%20Fire%20(Japanese%20Mix).mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I%20Won%E2%80%99t%20Be%20Your%20Fire.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20I'm%20That%20Somebody.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20Mi%20Gente.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20My%20Soul%20Lives%20In%20Seoul.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20Paper%20That%20Cut%20You.mp3",
  "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/xsytrance%20-%20Still%20Me_%20Still%20You.mp3",
];

export const tracks: Track[] = rawUrls.map((url, i) => {
  const title = parseTitleFromUrl(url);
  const id = slugify(title);
  const color = COLORS[i % COLORS.length];
  return {
    id,
    title,
    artist: "xsytrance",
    duration: "0:00",
    durationSeconds: 0,
    art: gradientArt(color),
    cover: coverFor(title),
    genre: GENRES[i % GENRES.length],
    mood: MOODS[i % MOODS.length],
    color,
    audioUrl: url,
    featured: i === 0, // First track is featured
  };
});

export const featuredTracks = tracks.filter((t) => t.featured);

export const musicSources = [
  { name: "SoundCloud", description: "The archive. Beats, experiments, and works in progress.", url: "https://soundcloud.com", color: "#ff9b3d" },
  { name: "Suno", description: "AI-generated transmissions. Songs born from prompts.", url: "https://suno.ai", color: "#ff2bd6" },
];
