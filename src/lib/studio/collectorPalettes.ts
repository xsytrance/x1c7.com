// Mirror of scripts/song-art/collector/engine.mjs PALETTES + classify() — the
// collector cover system's genre color language. engine.mjs is the source of
// truth (it prints the pixels); keep this file byte-for-byte in sync when the
// palettes change. Served to the Planet Studio app via /api/studio/covers so
// its live preview matches the printed spine.
export interface CollectorPalette {
  base: [string, string];
  accent: string;
  accent2: string;
  ink: string;
  texture: string;
  label: string;
}

export const COLLECTOR_PALETTES: Record<string, CollectorPalette> = {
  RNB:        { base: ["#1b2560", "#0c1233"], accent: "#d4af37", accent2: "#a3253a", ink: "#f3ead2", texture: "leather", label: "R&B" },
  HIPHOP:     { base: ["#161616", "#020202"], accent: "#d4af37", accent2: "#8a8a8a", ink: "#efe6cf", texture: "brushed", label: "HIP-HOP" },
  LATIN:      { base: ["#5f1519", "#1c2242"], accent: "#e2b64a", accent2: "#b0632a", ink: "#f6ecd8", texture: "wood", label: "LATIN" },
  HOUSE:      { base: ["#2b3138", "#101418"], accent: "#46e08c", accent2: "#9fb2c4", ink: "#e8f2ec", texture: "smoke", label: "HOUSE" },
  ELECTRONIC: { base: ["#07231f", "#03100e"], accent: "#39ffa0", accent2: "#3fd4ff", ink: "#dcfef0", texture: "grid", label: "ELECTRONIC" },
  DANCE:      { base: ["#062024", "#030f12"], accent: "#3fd4ff", accent2: "#39ffa0", ink: "#dcf6fe", texture: "grid", label: "DANCE" },
  TECHNO:     { base: ["#1d1d21", "#0a0a0c"], accent: "#ff5a1f", accent2: "#8c8c94", ink: "#f2e9e2", texture: "concrete", label: "TECHNO" },
  ROCK:       { base: ["#57290a", "#2b1206"], accent: "#e8a020", accent2: "#a02010", ink: "#f6e8d2", texture: "distressed", label: "ROCK" },
  AFROBEAT:   { base: ["#3a2410", "#150d05"], accent: "#c98a2d", accent2: "#7d4a1d", ink: "#f2e4c8", texture: "carved", label: "AFROBEAT" },
  POP:        { base: ["#43102f", "#190513"], accent: "#ff4fa3", accent2: "#e8c98a", ink: "#fbe8f2", texture: "satin", label: "POP" },
  SYNTHWAVE:  { base: ["#241042", "#0c0522"], accent: "#b44dff", accent2: "#46e0ff", ink: "#ece0fb", texture: "retro", label: "SYNTHWAVE" },
  LOFI:       { base: ["#2c3835", "#121b19"], accent: "#e6d7b8", accent2: "#6fbfae", ink: "#efe9da", texture: "paper", label: "LO-FI" },
  AMBIENT:    { base: ["#191f38", "#090c1a"], accent: "#c9d4e8", accent2: "#5f74a8", ink: "#e8edf6", texture: "mist", label: "AMBIENT" },
  CINEMATIC:  { base: ["#25272d", "#0d0e11"], accent: "#d8dce4", accent2: "#7d96b8", ink: "#eef0f4", texture: "brushed", label: "CINEMATIC" },
  DNB:        { base: ["#122a4a", "#050f1f"], accent: "#4d8cff", accent2: "#46e0ff", ink: "#dbe8ff", texture: "grid", label: "DRUM & BASS" },
  ARCHIVE:    { base: ["#181818", "#040404"], accent: "#d4af37", accent2: "#6a6a6a", ink: "#efe6cf", texture: "leather", label: "AGENOR" },
  ASIA:       { base: ["#4a0d0d", "#120303"], accent: "#e2b64a", accent2: "#a3253a", ink: "#f6e8d2", texture: "satin", label: "ASIA" },
  DANCEHALL:  { base: ["#5f1519", "#2a1607"], accent: "#e2b64a", accent2: "#b0632a", ink: "#f6ecd8", texture: "wood", label: "DANCEHALL" },
  VIDEOGAME:  { base: ["#2c1052", "#0c0522"], accent: "#b44dff", accent2: "#46e0ff", ink: "#efe9ff", texture: "retro", label: "VIDEO GAME" },
};

// DB genre string → { spine bucket, precise footer style } — engine.mjs classify().
export function classifyCollector(genre: string | null | undefined): { key: string; precise: string | null } {
  const g = (genre || "").toLowerCase();
  if (!g) return { key: "ARCHIVE", precise: null };
  if (g.includes("r&b")) return { key: "RNB", precise: genre! };
  if (g.includes("hip")) return { key: "HIPHOP", precise: genre! };
  if (g.includes("dancehall")) return { key: "DANCEHALL", precise: genre! };
  if (g.includes("reggaeton") || g.includes("latin") || g.includes("dembow")) return { key: "LATIN", precise: genre!.replace(/·/g, "/") };
  if (g.includes("deep house")) return { key: "HOUSE", precise: "Deep House" };
  if (g.includes("house")) return { key: "HOUSE", precise: genre! };
  if (g.includes("drum") || g.includes("dnb") || g.includes("d&b") || g.includes("jungle")) return { key: "DNB", precise: genre! };
  if (g.includes("techno") || g.includes("industrial")) return { key: "TECHNO", precise: genre! };
  if (g.includes("rock") || g.includes("alternative")) return { key: "ROCK", precise: genre! };
  if (g.includes("afro")) return { key: "AFROBEAT", precise: genre! };
  if (g.includes("synthwave")) return { key: "SYNTHWAVE", precise: genre! };
  if (g.includes("lo-fi") || g.includes("lofi")) return { key: "LOFI", precise: genre! };
  if (g.includes("ambient")) return { key: "AMBIENT", precise: genre! };
  if (g.includes("cinematic")) return { key: "CINEMATIC", precise: genre! };
  if (g.includes("pop")) return { key: "POP", precise: genre! };
  if (g.includes("dance")) return { key: "DANCE", precise: genre! };
  if (g.includes("electronic") || g.includes("edm")) return { key: "ELECTRONIC", precise: genre! };
  return { key: "ARCHIVE", precise: genre! };
}
