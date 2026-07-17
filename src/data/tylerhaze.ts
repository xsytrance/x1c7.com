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

// Per-track stories + heavy words + cover art, from the 2026-07-17 lyrics
// research: 8 tracks verbatim via Suno's profile API (metadata.prompt), 5
// (Beautiful Damage → House Lights, minus the closer) whisper-transcribed
// from the official YouTube audio — stories for those are grounded in real
// transcripts but the texts have mishearings, so no lyrics are quoted for
// them. Local archive: assets/lyrics/tyler/ (gitignored).
export const TYLER_TRACK_DETAILS: Record<string, { story?: string; words?: string[]; art?: string }> = {
  "Life of the PaRty": {
    story: "The party-king is only real when she's in the room — pulled back from the edge, a rose in the wreckage.",
    words: ["broken", "fire", "spark", "wreckage"],
    art: "https://cdn2.suno.ai/30714ad4-be9d-4df2-8985-69dd8d16bdb8.jpeg",
  },
  "Mall Rats": {
    story: "Walk in wrecked, walk out reborn — one wrong look made iconic while the copycats trail behind.",
    words: ["wrecked", "reborn", "iconic", "warning"],
    art: "https://cdn2.suno.ai/2f9d2af8-ab80-48d5-ada6-fb146f46ad24.jpeg",
  },
  "Neon Teeth": {
    story: "He sees the warning and leans inside it — until the last chorus admits they're the same animal.",
    words: ["poison", "trouble", "ultraviolet", "damned"],
    art: "https://cdn2.suno.ai/5dea956a-dae9-4ae3-bfce-502b4d604aaf.jpeg",
  },
  "The Night Shift": {
    story: "Addiction and stardom as a graveyard shift — they call it a problem, he calls it overtime.",
    words: ["overtime", "habits", "bleeding", "breakdown"],
    art: "https://cdn2.suno.ai/9195cb3b-f86d-46fa-ac1d-ce2e0ffc58ae.jpeg",
  },
  "Pretty When I Lie": {
    story: "She catches every lie and pulls him closer anyway — nobody in this room wants the daylight version.",
    words: ["lie", "damage", "disaster", "wreck"],
    art: "https://cdn2.suno.ai/1ae6afe5-6f27-45a4-b303-1f143288d543.jpeg",
  },
  "6th FLR": {
    story: "One wordless elevator ride and she haunts every blonde in every room — until the doors open again. Sixth floor.",
    words: ["ghost", "possessed", "haze", "froze"],
    art: "https://cdn2.suno.ai/151751a9-c59c-4474-9b23-4e9e90777304.jpeg",
  },
  "#MADETOBREAK": {
    story: "They were betting on the break. He was made to break everything but himself.",
    words: ["break", "pressure", "armor", "barricade"],
    art: "https://cdn2.suno.ai/ebf94b95-fe6f-4917-a886-ef06011299de.jpeg",
  },
  "Beautiful Damage": {
    story: "An elegy for a love that fought like forgiveness was running out of time — two beautiful liars making love out of damage.",
    words: ["damage", "habit", "withdrawal", "chaos"],
  },
  "Never My Fault": {
    story: "The unapologetic anthem: he never promised anything, and everyone knew the snake before the bite.",
    words: ["fault", "snake", "bite", "blame"],
  },
  "Distorted In Her Eyes": {
    story: "She loved a rewrite of him; he's neither her hero nor her villain — maybe somewhere in between.",
    words: ["distorted", "mirror", "strangers", "regret"],
  },
  "Sober In My Thoughts": {
    story: "Sobriety strips the noise and the bill comes due — grief walking beside him is how love lasts.",
    words: ["sober", "grief", "poison", "lost"],
  },
  "House Lights": {
    story: "The crowd screams for Tyler; the house lights come up on the man who has to drive home as both.",
    words: ["encore", "armor", "silence", "crash"],
  },
  "Storms In November": {
    story: "The closer and the thesis: sometimes you lose the love of your life because you loved your damage more.",
    words: ["storm", "thunder", "wreckage", "numb"],
    art: "https://cdn2.suno.ai/9c5c05e1-5db1-4373-98b9-d537bbbf3cc5.jpeg",
  },
};

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
