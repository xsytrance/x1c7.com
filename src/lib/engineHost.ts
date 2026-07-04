// ═══════════════════════════════════════════════════════════════════════════
// ENGINE HOST — the adapter seam (x1c7 side).
//
// The lyric engine (KineticStage, KineticParticles, SurfaceEffects, the effect
// registry, the Lexicon) is SHARED, byte-for-byte, between x1c7 (the workshop)
// and Kinetica (the gift box). This is the ONE file it imports that differs per
// app — everything else is kept identical by scripts/engine/sync-to-kinetica.mjs.
//
// Keep this surface tiny. Three things:
//   1. useMusicPlayer — the app's playback hook (transport + muffle).
//   2. Track          — the app's track shape.
//   3. HAS_SHARED_ART — whether this app ships the cross-song art library.
//
// Kinetica's copy re-exports from its own player/types and sets
// HAS_SHARED_ART = false (it has no shared art bucket).
// ═══════════════════════════════════════════════════════════════════════════

export { useMusicPlayer } from "@/components/MusicPlayerContext";
export type { Track } from "@/data/tracks";

/** x1c7 ships a cross-song shared art library at /planets/_shared. */
export const HAS_SHARED_ART = true;
