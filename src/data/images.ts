// ═══════════════════════════════════════════════════════════════════════════
//  x1c7 Image Assets — sourced from Cloudflare R2
// ═══════════════════════════════════════════════════════════════════════════
//
//  To add images:
//  1. Upload to your R2 bucket under the matching folder structure
//  2. Add the entry below with the full R2 public URL
//  3. Reference by ID in components (don't hardcode URLs elsewhere)
//
//  Recommended bucket structure:
//    /art/           — gallery pieces, character art, world visuals
//    /agents/        — agent portraits, agent-themed artwork
//    /projects/      — project screenshots, thumbnails, demos
//    /music/         — album art, track covers, visualizer stills
//    /site/          — favicon, OG image, branding assets
//    /misc/          — anything else
//
//  ═══════════════════════════════════════════════════════════════════════════

export interface ImageAsset {
  id: string;
  src: string; // Full R2 public URL (or local /path during dev)
  title: string;
  category: string;
  description: string;
  accent: string;
  aspect?: "3/4" | "4/3" | "1/1" | "4/5" | "16/9";
}

// ── Base URL — swap this when your R2 bucket is ready ────────────────────
// Replace with your actual R2 public URL, e.g.:
// const R2_BASE = "https://images.x1c7.com";
const R2_BASE = "https://pub-e9f979edfc5542a1b6d5c37e32537565.r2.dev";

function r2(path: string): string {
  if (R2_BASE) return `${R2_BASE}${path}`;
  return path; // Local fallback
}

// ── Art Gallery ──────────────────────────────────────────────────────────

// Real AI cover art — lives in the art bucket under album-art/Art/ (verified).
// [filename (exact key, no extension), display title]
const COVER_ART: [string, string][] = [
  ["Asia Got My Heart", "Asia Got My Heart"],
  ["Between The Stations", "Between The Stations"],
  ["Brooms In The Boiler Room", "Brooms In The Boiler Room"],
  ["Cold Sugar", "Cold Sugar"],
  ["Embers Between Wars", "Embers Between Wars"],
  ["Even If You're Not My Fire", "Even If You're Not My Fire"],
  ["FeverBreak", "Feverbreak"],
  ["Going Crazy Hiligaynon", "Going Crazy (Hiligaynon)"],
  ["Gold No Dey Rust", "Gold No Dey Rust"],
  ["Grind It Slow", "Grind It Slow"],
  ["Heaven and Hell", "Heaven & Hell"],
  ["Honey and Venom", "Honey & Venom"],
  ["I Dont Quit Now", "I Don't Quit Now"],
  ["I Said No", "I Said No!"],
  ["Im That Somebody", "I'm That Somebody"],
  ["In Love With The Party", "In Love With The Party"],
  ["Jayodeed Going Crazy Rooklyn Mix", "Going Crazy (Rooklyn Mix)"],
  ["Kick Drum From New York", "Kick Drum From New York"],
  ["Lagos Heard Me First", "Lagos Heard Me First"],
  ["Light It Myself", "Light It Myself"],
  ["Light The Fire Myself", "Light The Fire Myself"],
  ["Low Lights Tokyo", "Low Lights Tokyo"],
  ["Manila After Dark", "Manila After Dark"],
  ["Music Is My Drug Original", "Music Is My Drug"],
  ["Music Is My Drug Rooklyn Mix", "Music Is My Drug (Rooklyn Mix)"],
  ["One Tap Away Original", "One Tap Away"],
  ["One Tap Away Remix", "One Tap Away (Remix)"],
  ["Saigon After Dark", "Saigon After Dark"],
  ["Say It With Your Eyes", "Say It With Your Eyes"],
  ["The Big Top Has WiFi Now", "The Big Top Has WiFi Now"],
  ["Whistle On The River", "Whistle On The River"],
  ["ai interlude", "AI Interlude"],
  ["fast enough", "Fast Enough"],
  ["first day whole month walk it out", "First Day, Whole Month"],
  ["ora de la presion forged above gold", "Oro De La Presión (Forged Above Gold)"],
  ["ora de la presion", "Oro De La Presión"],
];

const ART_ACCENTS = ["#ff2bd6", "#43f7ff", "#8dff4a", "#ff9b3d", "#7c3cff", "#f5ff6b", "#00ffa8"];

export const artImages: ImageAsset[] = COVER_ART.map(([file, title], i) => ({
  id: `cover-${i}`,
  src: r2(`/album-art/Art/${encodeURIComponent(file)}.png`),
  title,
  category: "Covers",
  description: "AI cover art from the x1c7 transmissions.",
  accent: ART_ACCENTS[i % ART_ACCENTS.length],
  aspect: "1/1",
}));

// ── Agent Portraits ──────────────────────────────────────────────────────

export const agentPortraits: ImageAsset[] = [
  {
    id: "agent-vg-god",
    src: r2("/AI%20Agent%20Profile%20Pictures/VG%20God%20Style%20Images%20by%20ChatGPT/ChatGPT%20Image%20May%206%2C%202026%2C%2001_42_26%20PM.png"),
    title: "VG GOD",
    category: "agents",
    description: "The original creative engine. Dreams in pixels, thinks in dimensions.",
    accent: "#ff2bd6",
    aspect: "1/1",
  },
  {
    id: "agent-vg-god-alt",
    src: r2("/AI%20Agent%20Profile%20Pictures/VG%20God%20Style%20Images%20by%20ChatGPT/ChatGPT%20Image%20May%206%2C%202026%2C%2001_43_47%20PM.png"),
    title: "VG GOD — Variant",
    category: "agents",
    description: "Alternate portrait of the creative daemon.",
    accent: "#ff2bd6",
    aspect: "1/1",
  },
  {
    id: "agent-ultron",
    src: r2("/AI%20Agent%20Profile%20Pictures/xsysupersort-aka-ultron.png"),
    title: "ULTRON",
    category: "agents",
    description: "The systems backbone. Every pattern has a purpose.",
    accent: "#43f7ff",
    aspect: "1/1",
  },
];

// ── Project Thumbnails ───────────────────────────────────────────────────
// When you have project screenshots:
// export const projectThumbnails: ImageAsset[] = [
//   { id: "project-vaib", src: r2("/projects/vaib-out.jpg"), alt: "vAIb out!", category: "projects", accent: "#ff2bd6" },
//   ...
// ];

// ── Music Album Art ──────────────────────────────────────────────────────
// When you have track-specific art:
// export const albumArt: ImageAsset[] = [
//   { id: "album-different-summer", src: r2("/music/different-this-summer.jpg"), alt: "Different This Summer", category: "music", accent: "#ff2bd6" },
//   ...
// ];

// ── Site Assets ──────────────────────────────────────────────────────────
// export const siteAssets: ImageAsset[] = [
//   { id: "og-image", src: r2("/site/og-card.jpg"), alt: "x1c7 OG Card", category: "site" },
//   { id: "avatar", src: r2("/site/xsy-avatar.jpg"), alt: "xsy avatar", category: "site" },
// ];

// ── Helpers ──────────────────────────────────────────────────────────────

export function getImageById(id: string): ImageAsset | undefined {
  return [...artImages, ...agentPortraits].find(
    (img) => img.id === id
  );
}

export function getAgentPortrait(codename: string): ImageAsset | undefined {
  const map: Record<string, string> = {
    "vg god": "agent-vg-god",
    "ultron": "agent-ultron",
  };
  const id = map[codename.toLowerCase()];
  return id ? getImageById(id) : undefined;
}

export function getImagesByCategory(category: string): ImageAsset[] {
  return artImages.filter((img) => img.category === category);
}

export function getAllCategories(): string[] {
  return [...new Set(artImages.map((img) => img.category))];
}
