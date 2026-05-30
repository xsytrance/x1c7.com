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

export const artImages: ImageAsset[] = [
  {
    id: "art-01",
    src: r2("/art/art-01.jpg"),
    title: "Neon City",
    category: "Worlds",
    description: "A rain-soaked cyberpunk metropolis bathed in neon pink and cyan.",
    accent: "#ff2bd6",
    aspect: "3/4",
  },
  {
    id: "art-02",
    src: r2("/art/art-02.jpg"),
    title: "Digital Portrait",
    category: "Characters",
    description: "An abstract digital portrait with glowing geometric patterns overlaying the face.",
    accent: "#7c3cff",
    aspect: "4/5",
  },
  {
    id: "art-03",
    src: r2("/art/art-03.jpg"),
    title: "Star Island",
    category: "Worlds",
    description: "A surreal floating island drifting through a star-filled cosmos.",
    accent: "#43f7ff",
    aspect: "3/4",
  },
  {
    id: "art-04",
    src: r2("/art/art-04.jpg"),
    title: "Glitch Eye",
    category: "Abstract",
    description: "A close-up of an otherworldly cybernetic eye with digital glitch artifacts.",
    accent: "#ff2bd6",
    aspect: "4/5",
  },
  {
    id: "art-05",
    src: r2("/art/art-05.jpg"),
    title: "Energy Forms",
    category: "Abstract",
    description: "Abstract crystalline shapes trailing neon energy paths.",
    accent: "#ff9b3d",
    aspect: "3/4",
  },
  {
    id: "art-06",
    src: r2("/art/art-06.jpg"),
    title: "Light Doorway",
    category: "Characters",
    description: "A mysterious hooded figure standing in a doorway of light.",
    accent: "#f5ff6b",
    aspect: "4/5",
  },
];

// ── Agent Portraits ──────────────────────────────────────────────────────
// When you have agent art, add entries here:
// export const agentPortraits: ImageAsset[] = [
//   { id: "agent-vg-god", src: r2("/agents/vg-god.jpg"), alt: "VG GOD Portrait", category: "agents", accent: "#ff2bd6" },
//   { id: "agent-ultron", src: r2("/agents/ultron.jpg"), alt: "ULTRON Portrait", category: "agents", accent: "#43f7ff" },
//   ...
// ];

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
  return [...artImages /*, ...agentPortraits, ...projectThumbnails, ...albumArt, ...siteAssets */].find(
    (img) => img.id === id
  );
}

export function getImagesByCategory(category: string): ImageAsset[] {
  return artImages.filter((img) => img.category === category);
}

export function getAllCategories(): string[] {
  return [...new Set(artImages.map((img) => img.category))];
}
