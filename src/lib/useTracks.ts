"use client";

import { useEffect, useState } from "react";
import { supabase, type TrackRow } from "./supabase";
import { tracks as staticTracks, gradientArt, type Track } from "@/data/tracks";

// Map a Supabase row into the app's Track shape (adds the gradient fallback art).
export function trackFromRow(r: TrackRow): Track {
  const color = r.color || "#43f7ff";
  return {
    id: r.id,
    title: r.title,
    artist: r.artist || "xsytrance",
    duration: "0:00",
    durationSeconds: 0,
    art: gradientArt(color),
    cover: r.cover || undefined,
    genre: r.genre || "",
    mood: r.mood || undefined,
    color,
    audioUrl: r.audio_url,
    featured: !!r.featured,
    theme: (r.theme as Track["theme"]) || undefined,
  };
}

/**
 * Tracks come from Supabase (live, admin-editable). The static array is the
 * instant SSR/first-paint value and the fallback if Supabase is unreachable.
 */
export function useTracks() {
  const [tracks, setTracks] = useState<Track[]>(staticTracks);
  const [source, setSource] = useState<"static" | "live">("static");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("tracks")
      .select("*")
      .eq("hidden", false)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data || data.length === 0) return;
        setTracks((data as TrackRow[]).map(trackFromRow));
        setSource("live");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tracks, source };
}
