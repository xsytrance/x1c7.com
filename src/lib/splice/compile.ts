// Splice Table — deterministic compiler (browser-safe port of
// scripts/song-analysis/compile.mjs). A flow + a lego lookup -> a Suno prompt.
// No LLM, no fs, no randomness. This is the FREE tier: it runs in the tab.

import type {
  Flow, FlowKnobs, Compiled, Seam, SeamWarning, Section, SectionVoice,
  SectionKind, SongLegos, Style,
} from "./types";

export type SongLookup = (songId: string) => SongLegos | undefined;

export const songIdOf = (ref: string): string => ref.split("::")[0];

function resolveSection(ref: string, lookup: SongLookup): { song: SongLegos; section: Section } {
  const song = lookup(songIdOf(ref));
  if (!song) throw new Error(`no legos loaded for "${songIdOf(ref)}"`);
  const section = song.sections.find((s) => s.id === ref);
  if (!section) throw new Error(`section "${ref}" not found in ${song.id}`);
  return { song, section };
}

// ---------- music theory: the conflict resolver -----------------------------

const PC: Record<string, number> = {
  C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5, "F#": 6, GB: 6,
  G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11,
};
function pitchClass(key: string | null): number | null {
  if (!key) return null;
  const k = key.trim().toUpperCase().replace("♯", "#").replace("♭", "B");
  return k in PC ? PC[k] : null;
}
export function semitoneDelta(fromKey: string | null, toKey: string | null): number | null {
  const a = pitchClass(fromKey), b = pitchClass(toKey);
  if (a == null || b == null) return null;
  let d = (b - a) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

interface Home { bpm: number | null; key: string | null; mode: string | null }

export function analyzeSeam(target: Home, source: Home): Seam {
  const ratio = source.bpm && target.bpm ? source.bpm / target.bpm : null;
  let bpmVerdict: Seam["bpm"]["verdict"] = "match";
  let bpmPenalty = 0;
  if (ratio != null) {
    if (ratio < 0.97 || ratio > 1.03) { bpmVerdict = "stretch"; bpmPenalty = 8; }
    if (ratio < 0.85 || ratio > 1.18) { bpmVerdict = "hard-stretch"; bpmPenalty = 22; }
  }
  const semis = semitoneDelta(source.key, target.key);
  const modeFlip = !!(source.mode && target.mode && source.mode !== target.mode);
  let keyVerdict: Seam["key"]["verdict"] = "match";
  let keyPenalty = 0;
  if (semis !== 0 && semis != null) { keyVerdict = "transpose"; keyPenalty = Math.min(18, Math.abs(semis) * 5); }
  if (modeFlip) { keyVerdict = keyVerdict === "match" ? "mode-flip" : "transpose+mode"; keyPenalty += 10; }
  if (semis != null && Math.abs(semis) > 3) { keyVerdict = "clash"; keyPenalty += 8; }

  const suggestions: string[] = [];
  if (bpmVerdict === "stretch")
    suggestions.push(`tempo off (${source.bpm}→${target.bpm} BPM, ${ratio!.toFixed(2)}×) — Suno will re-sing it at target, expect slight phrasing drift`);
  if (bpmVerdict === "hard-stretch")
    suggestions.push(`tempo far off (${source.bpm}→${target.bpm} BPM, ${ratio!.toFixed(2)}×) — don't warp; let Suno re-generate this section at ${target.bpm} BPM or halftime/doubletime it`);
  if (semis && semis !== 0)
    suggestions.push(`transpose ${sign(semis)} semitone${Math.abs(semis) === 1 ? "" : "s"} (${source.key} → ${target.key})`);
  if (modeFlip)
    suggestions.push(`mode flip: source ${source.mode}, target ${target.mode} — flatten/raise the 3rd (& 6th/7th) or let Suno re-harmonize the borrowed melody`);

  return {
    match: bpmVerdict === "match" && keyVerdict === "match",
    bpm: { ratio: ratio == null ? null : Math.round(ratio * 100) / 100, verdict: bpmVerdict },
    key: { semitones: semis, modeFlip, verdict: keyVerdict },
    penalty: bpmPenalty + keyPenalty,
    suggestions,
  };
}

// ---------- Suno rendering --------------------------------------------------

const KIND_TAG: Record<SectionKind, string> = {
  intro: "Intro", verse: "Verse", prechorus: "Pre-Chorus", chorus: "Chorus",
  postchorus: "Post-Chorus", hook: "Hook", bridge: "Bridge", breakdown: "Break",
  drop: "Drop", outro: "Outro", spoken: "Spoken Word", interlude: "Interlude",
  adlib: "Ad-libs", refrain: "Refrain", other: "Refrain",
};

function voiceLabel(sv: SectionVoice, knobVoice: FlowKnobs["voice"]): string {
  const forced = knobVoice && knobVoice !== "auto" ? knobVoice : null;
  let gender: string | null = forced || sv.gender;
  if (gender === "undecided") gender = null;
  const parts: string[] = [];
  if (gender === "both") parts.push("Duet");
  else if (gender === "male") parts.push("Male");
  else if (gender === "female") parts.push("Female");
  else if (gender === "ai") parts.push("AI");
  if (sv.group && gender !== "both") parts.push("Group");
  if (sv.spoken) parts.push("Spoken");
  return parts.join(" ");
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

const asText = (v: unknown): string => (Array.isArray(v) ? v.filter(Boolean).join(", ") : typeof v === "string" ? v : "");

function renderStyle(style: Style, knobs: FlowKnobs, exclude?: string[]): string {
  const bits: string[] = [];
  const genre = asText(style.genre);
  const mood = asText(style.mood);
  const vocalStyle = asText(style.vocalStyle);
  if (genre) bits.push(genre);
  if (style.subGenres?.length) bits.push(style.subGenres.join(", "));
  if (mood) bits.push(mood.toLowerCase());
  const tempoKey: string[] = [];
  if (style.bpm) tempoKey.push(`${style.bpm} BPM`);
  if (style.key) tempoKey.push(`${style.key}${style.mode ? " " + style.mode : ""}`);
  if (tempoKey.length) bits.push(tempoKey.join(", "));
  if (vocalStyle) bits.push(vocalStyle.toLowerCase());
  const v = knobs.voice && knobs.voice !== "auto" ? knobs.voice : null;
  if (v) bits.push(`${v} vocals`);
  let s = bits.join("; ");
  if (exclude?.length) s += `.  Exclude: ${exclude.join(", ")}`;
  return s;
}

// ---------- title (deterministic) -------------------------------------------

interface Resolved { ref: string; as?: SectionKind; song: SongLegos; section: Section; borrowed: boolean; seam: Seam }

function autoTitle(flow: Flow, styleSong: SongLegos, resolved: Resolved[]): string {
  if (flow.title) return flow.title;
  const hook = resolved.find((r) => ["chorus", "hook"].includes((r.as || r.section.kind) as string));
  if (hook) {
    const firstLine = hook.section.text.split("\n").find((l) => l.trim());
    if (firstLine) {
      const words = firstLine.replace(/[^\w\s'&]/g, "").split(/\s+/).filter(Boolean).slice(0, 4);
      if (words.length) return words.map((w) => cap(w)).join(" ");
    }
  }
  const sig = styleSong.signature.map((s) => s.word);
  if (sig.length >= 2) return `${cap(sig[0])} & ${cap(sig[1])}`;
  return styleSong.title;
}

// ---------- compile ---------------------------------------------------------

export function compile(flow: Flow, lookup: SongLookup): Compiled {
  const styleSong = lookup(flow.style.from);
  if (!styleSong) throw new Error(`style song "${flow.style.from}" not loaded`);
  const style: Style = { ...styleSong.style, ...(flow.style.overrides || {}) };
  const knobs: FlowKnobs = {
    weirdness: 20, styleStrength: 65, audioInfluence: 0, voice: "auto",
    ...(flow.knobs || {}),
  };
  const target: Home = { bpm: style.bpm, key: style.key, mode: style.mode };

  const resolved: Resolved[] = flow.arrangement.map((item) => {
    const { song, section } = resolveSection(item.ref, lookup);
    const borrowed = song.id !== styleSong.id;
    const seam = borrowed
      ? analyzeSeam(target, { bpm: song.style.bpm, key: song.style.key, mode: song.style.mode })
      : ({ match: true, bpm: { ratio: 1, verdict: "match" }, key: { semitones: 0, modeFlip: false, verdict: "match" }, penalty: 0, suggestions: [] } as Seam);
    return { ...item, song, section, borrowed, seam };
  });

  const lyricLines: string[] = [];
  for (const r of resolved) {
    const kind = (r.as || r.section.kind) as SectionKind;
    const tagName = KIND_TAG[kind] || cap(kind);
    const vl = voiceLabel(r.section.voice, knobs.voice);
    lyricLines.push(`[${tagName}${vl ? " - " + vl : ""}]`);
    lyricLines.push(r.section.text.trim());
    lyricLines.push("");
  }

  const donors: Record<string, string[]> = {};
  for (const r of resolved) {
    const label = r.song.artist || r.song.id;
    (donors[label] ||= []).push(`${r.as || r.section.kind}${r.section.ordinal ? " " + r.section.ordinal : ""}`);
  }

  const totalPenalty = resolved.reduce((a, r) => a + r.seam.penalty, 0);
  const compatibility = Math.max(0, 100 - totalPenalty);

  const warnings: SeamWarning[] = resolved
    .filter((r) => r.borrowed && r.seam.suggestions.length)
    .map((r) => ({ ref: r.section.id, from: r.song.artist || r.song.id, ...r.seam }));

  return {
    title: autoTitle(flow, styleSong, resolved),
    styleOfMusic: renderStyle(style, knobs, flow.exclude),
    lyrics: lyricLines.join("\n").trim(),
    params: {
      weirdness: knobs.weirdness,
      styleStrength: knobs.styleStrength,
      audioInfluence: knobs.audioInfluence,
      vocalGender: knobs.voice,
      excludeStyles: flow.exclude || [],
    },
    target,
    compatibility,
    warnings,
    provenance: donors,
  };
}
