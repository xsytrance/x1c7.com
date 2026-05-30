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
  featured?: boolean;
};

const R2_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

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
  return {
    id,
    title,
    artist: "xsytrance",
    duration: "0:00",
    durationSeconds: 0,
    art: `/album-art/${id}.jpg`,
    genre: GENRES[i % GENRES.length],
    mood: MOODS[i % MOODS.length],
    color: COLORS[i % COLORS.length],
    audioUrl: url,
    featured: i === 0, // First track is featured
  };
});

export const featuredTracks = tracks.filter((t) => t.featured);

export const musicSources = [
  { name: "SoundCloud", description: "The archive. Beats, experiments, and works in progress.", url: "https://soundcloud.com", color: "#ff9b3d" },
  { name: "Suno", description: "AI-generated transmissions. Songs born from prompts.", url: "https://suno.ai", color: "#ff2bd6" },
];
