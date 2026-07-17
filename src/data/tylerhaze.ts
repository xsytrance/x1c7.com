// ═══════════════════════════════════════════════════════════════════════════
// TYLER HAZE — "The Party Left Without Me" · guest-of-honor takeover data.
// Juan Gomez (jayodeed) — the owner's best friend — launched his first album
// 2026-07-17 under his AI persona Tyler Haze. This file is the single place
// the takeover reads from: album facts, the owner's message, verified
// streaming links (NEVER add a link that hasn't been checked), palette.
// Remove the hero import in /music to retire the takeover; this file stays
// as the archive of the moment.
// ═══════════════════════════════════════════════════════════════════════════

export const TYLER = {
  artist: "Tyler Haze",
  by: "jayodeed",
  album: "The Party Left Without Me",
  released: "2026-07-17",
  genre: "Alternative Rock",
  cover: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/tyler-haze/the-party-left-without-me.png",
  featuredTrackId: "madetobreak", // the #MADETOBREAK full show, /t/madetobreak
  ratedTyler: "for substance use, reckless romance, emotional damage, and scenes of prolonged self-destruction",
  message:
    "Juan's been my best friend since second grade. Today he shipped his first album — built from " +
    "nothing in barely any time, every lyric pulled from real life, real weight, real nights. " +
    "Watching him do this is one of the proudest moments I've had as a friend. Go listen. He earned it.",
} as const;

// Per-track stories + heavy words — filled from the lyrics research
// (Suno pages / captions). Empty until verified; cards render without
// blurbs when a track is missing here.
export const TYLER_TRACK_DETAILS: Record<string, { story?: string; words?: string[] }> = {};

// Verified streaming links only (each fetched + confirmed 2026-07-17 —
// release-day propagation is ongoing; Amazon Music & Pandora not indexed yet,
// Deezer has only the #MADETOBREAK advance single, SoundCloud unconfirmed).
// The HyperFollow page aggregates new store buttons automatically.
// { service, url } — order = display order.
export const TYLER_LINKS: { service: string; url: string }[] = [
  { service: "All platforms", url: "https://distrokid.com/hyperfollow/tylerhaze/the-party-left-without-me" },
  { service: "Spotify", url: "https://open.spotify.com/album/7yNj0t8ZbWQ8f3tGxE8UmL" },
  { service: "Apple Music", url: "https://music.apple.com/us/album/the-party-left-without-me/6785350634" },
  { service: "YouTube Music", url: "https://music.youtube.com/playlist?list=OLAK5uy_lVxVxsU5N5dvD4D_4Rok8_9MosmN60bP8" },
  { service: "YouTube", url: "https://www.youtube.com/playlist?list=OLAK5uy_lVxVxsU5N5dvD4D_4Rok8_9MosmN60bP8" },
  { service: "Tidal", url: "https://tidal.com/album/538050514" },
  { service: "Deezer · #MADETOBREAK single", url: "https://www.deezer.com/album/1025578832" },
  { service: "Juan on Suno", url: "https://suno.com/@jc_gomez0311" }, // "Home of Tyler Haze and LevelReady Music" — verified
];

// Full tracklist (verified via iTunes API — ℗ 2026 LevelReady Music).
export const TYLER_TRACKS = [
  "Life of the PaRty", "Mall Rats", "Neon Teeth", "The Night Shift",
  "Pretty When I Lie", "6th FLR", "#MADETOBREAK", "Beautiful Damage",
  "Never My Fault", "Distorted In Her Eyes", "Sober In My Thoughts",
  "House Lights", "Storms In November",
] as const;

// Official Tyler Haze artwork (from Juan, 2026-07-17) — R2 tyler-haze/gallery/.
// All 12 ride the hero gallery strip AND the #MADETOBREAK show's guided layer
// (planets/madetobreak/guided.json).
export const TYLER_GALLERY = Array.from({ length: 12 }, (_, i) =>
  `https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/tyler-haze/gallery/${String(i + 1).padStart(2, "0")}.webp`);

// The Tyler Haze edition palette (from the album art), applied in globals.css.
// Previous site palette (for revert):
//   --theme-primary #ff2440 · --theme-secondary #43f7ff ·
//   --theme-accent #8dff4a · --theme-bg #05030b
export const TYLER_PALETTE = {
  primary: "#d9342b", // red-cup crimson
  secondary: "#ffb45c", // porch-light amber
  accent: "#7c8cff", // dusk indigo glow
  bg: "#080b18", // midnight indigo black
} as const;
