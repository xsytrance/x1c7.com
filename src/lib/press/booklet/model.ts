// THE BINDERY — booklet model. Page-kind vocabulary follows the shipped
// src/lib/booklet.ts liner-notes × game-manual language; this is its guided
// public cousin. Saddle-stitch page counts are multiples of 4 by physics.

import type { ProjectSpec } from "../types";

export type BookletPageKind = "cover" | "lyrics" | "read" | "world" | "credits" | "specs" | "back";

export interface BookletPage {
  kind: BookletPageKind;
  skip?: boolean;
  text?: string;               // REPLACE for text pages (read/credits/lyrics override)
  lyricsPart?: number;         // which slice of the paginated lyrics
}

export interface BookletState {
  preset: "slip" | "classic" | "deluxe";
  pages: BookletPage[];
}

export const PRESETS: Record<BookletState["preset"], { label: string; blurb: string; pages: BookletPageKind[] }> = {
  slip: { label: "THE SLIP", blurb: "4 pages — the honest minimum", pages: ["cover", "lyrics", "specs", "back"] },
  classic: {
    label: "THE CLASSIC", blurb: "8 pages — what came inside the CDs you remember",
    pages: ["cover", "read", "lyrics", "lyrics", "world", "credits", "specs", "back"],
  },
  deluxe: {
    label: "THE DELUXE", blurb: "12 pages — the collector flex (needs your stems: next expansion)",
    pages: ["cover", "read", "lyrics", "lyrics", "world", "world", "credits", "credits", "specs", "specs", "world", "back"],
  },
};

export function newBooklet(preset: BookletState["preset"] = "classic"): BookletState {
  const kinds = PRESETS[preset].pages;
  let lyricsN = 0;
  return {
    preset,
    pages: kinds.map((kind) => ({ kind, ...(kind === "lyrics" ? { lyricsPart: lyricsN++ } : {}) })),
  };
}

/** Live pages (SKIP heals pagination); pad with world pages to a multiple of 4. */
export function livePages(b: BookletState): BookletPage[] {
  const alive = b.pages.filter((p) => !p.skip);
  const out = [...alive];
  while (out.length % 4 !== 0) out.push({ kind: "world" });
  return out;
}

/** R5 — stanza-aware lyric pagination: one stanza never splits across pages. */
export function paginateLyrics(lyrics: string | null | undefined, parts: number): string[] {
  if (!lyrics?.trim()) return Array.from({ length: Math.max(1, parts) }, () => "");
  const stanzas = lyrics.trim().split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const n = Math.max(1, parts);
  const out: string[][] = Array.from({ length: n }, () => []);
  const totalLines = stanzas.reduce((a, s) => a + s.split("\n").length, 0);
  const per = Math.ceil(totalLines / n);
  let bucket = 0, count = 0;
  for (const st of stanzas) {
    const lines = st.split("\n").length;
    if (count + lines > per && bucket < n - 1 && count > 0) { bucket++; count = 0; }
    out[bucket].push(st);
    count += lines;
  }
  return out.map((b) => b.join("\n\n"));
}

/** The R5 read: how the lyrics want to paginate. */
export function lyricsRead(lyrics: string | null | undefined): string | null {
  if (!lyrics?.trim()) return null;
  const stanzas = lyrics.trim().split(/\n\s*\n/).filter((s) => s.trim());
  const lines = lyrics.trim().split(/\r?\n/).filter((l) => l.trim()).length;
  const pages = lines > 26 ? 2 : 1;
  return `${lines} lines in ${stanzas.length} stanza${stanzas.length === 1 ? "" : "s"} — that's a clean ${pages === 2 ? "two-page libretto" : "one-page libretto"}.`;
}

/** FREE liner notes: fill-in-the-blanks, honest about not being an LLM. */
export function defaultRead(p: ProjectSpec): string {
  const t = p.identity.title || "this song";
  return `THE READ\n\n${t.toUpperCase()} started as ______.\n\nIt's really about ______.\n\nBest played ______, ${p.facts.bpm ? `at full volume (${p.facts.bpm} BPM knows what it wants)` : "at full volume"}.\n\n— ${(p.identity.label || "the label").toUpperCase()}`;
}

export function defaultCredits(p: ProjectSpec): string {
  const rows = [
    `written & produced — ${p.identity.label || "you"}`,
    p.identity.handle ? `handle — ${p.identity.handle}` : null,
    p.analysis?.styleWords?.length ? `style — ${p.analysis.styleWords.slice(0, 6).join(", ")}` : null,
    `pressed at — the pressing plant, x1c7.com/press`,
    `printed on-device · nothing uploaded`,
  ].filter(Boolean);
  return rows.join("\n");
}
