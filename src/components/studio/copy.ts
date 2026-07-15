// ═══════════════════════════════════════════════════════════════════════════
// STUDIO VOCABULARY — the one place the Studio's plain-English lives.
//
// The 2026-07 redesign renamed the whole surface for humans:
//   Pass 1–6            →  Visuals: Easy / Cinematic / Fireworks
//   StageMode            →  Lyric styles with real descriptions
//   Looks                →  Vibes
//   Scenes / A–B decks   →  Backdrops (pro keeps the crossfade deck strip)
//   SHOW / DIRECT / SETUP→  gone — one guided flow + an "I know what I'm
//                           doing" switch that opens the pro cockpit.
// Engine ids (pass numbers, StageMode strings, param ids) are UNCHANGED —
// the Android app's /studio?embed=1&pass=&mode= contract still holds.
// ═══════════════════════════════════════════════════════════════════════════

import type { StageMode } from "@/components/KineticStage";

/** Visual richness, in human sizes. `pass` is the engine's number. */
export interface VisualLevel {
  id: "easy" | "cinematic" | "fireworks";
  pass: number;
  name: string;
  blurb: string;
  sparks: string; // the tiny glyph budget that sells the size
}
export const VISUAL_LEVELS: VisualLevel[] = [
  { id: "easy", pass: 3, name: "Easy", blurb: "Light and smooth — kind to older phones and batteries.", sparks: "✧" },
  { id: "cinematic", pass: 5, name: "Cinematic", blurb: "The full show. Start here.", sparks: "✧✧" },
  { id: "fireworks", pass: 6, name: "Fireworks", blurb: "Everything on. Brightest, busiest, hungriest.", sparks: "✧✧✧" },
];
export const passToLevel = (pass: number): VisualLevel =>
  VISUAL_LEVELS.find((v) => v.pass === pass) ??
  (pass <= 3 ? VISUAL_LEVELS[0] : pass >= 6 ? VISUAL_LEVELS[2] : VISUAL_LEVELS[1]);

/** Lyric styles — same engine modes, honest names. */
export const LYRIC_STYLES: { id: StageMode; name: string; blurb: string }[] = [
  { id: "phrase", name: "Sing-along", blurb: "Whole lines on screen, lighting up word by word." },
  { id: "dynamic", name: "Wild", blurb: "Words fly, burn and dance all over the stage." },
  { id: "focus+", name: "Spotlight", blurb: "One word at a time, each with its own exit." },
  { id: "focus", name: "Minimal", blurb: "One clean word at a time. Nothing extra." },
];

/** Rotating one-line hints for the first shows (dismiss forever with ✕). */
export const STAGE_HINTS = [
  "Swipe the picture sideways to switch backdrops · up and down turns the energy",
  "Tap any Vibe and the whole picture glides there on the beat",
  "Two-finger tap hands the backdrop back to the song",
];

export const COPY = {
  marqueeTitle: "Tonight's show",
  marqueeLede: "Pick a song — the studio paints it live, on the beat.",
  songLabel: "The song",
  songReady: "ready to perform",
  songNotReady: "not word-timed yet",
  songNotReadyBody:
    "This one doesn't have word-timed lyrics yet, so it can't perform. Pick a song marked ready — or just press play in the player and enjoy the music.",
  visualsLabel: "Visuals",
  lyricsLabel: "Lyrics",
  start: "Start the show",
  proInvite: "I know what I'm doing",
  proInviteBlurb: "decks, loop recorder, shader loader, every engine parameter",
  easyInvite: "Back to the simple studio",
  vibesLabel: "Vibes",
  vibesHint: "Tap one — the whole picture glides there over a bar. Hold ＋ to bottle the vibe you're seeing.",
  backdropsLabel: "Backdrops",
  backdropAuto: "Let the song choose",
  backdropAutoBlurb: "verses, chorus and drops each bring their own",
  backdropPinHint: "Tap a backdrop to hold it. Tap again to hand it back to the song.",
  paintLabel: "Finger paint",
  paintHint: "Slide anywhere — sideways shifts the color, up adds glow.",
  surprise: "Surprise me",
  hideControls: "Just watch",
  showControls: "Play with it",
  changeSong: "Song",
} as const;

/** localStorage keys (new namespace; the old ws key is retired). */
export const LS = {
  pro: "x1c7-studio-pro",
  lyricStyle: "x1c7-lyric-style", // shared with older builds on purpose
  hintsDone: "x1c7-studio-hints-done",
  visualLevel: "x1c7-studio-visuals",
} as const;
