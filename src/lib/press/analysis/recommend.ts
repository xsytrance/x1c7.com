// The Plant's recommendation engine — FREE tier: deterministic, on-device,
// zero-network. Every rule returns "the read → the suggestion → the
// override", and applying one is just a store mutation (fully undoable).
// P1 ships R1/R2/R8/R9; R3 (stems), R4 (Lexsycon), R5 (booklet), R6 (finish),
// R7 (exclusions veto) land in later phases per the plan.

import { COLLECTOR_PALETTES, classifyCollector } from "@/lib/studio/collectorPalettes";
import { templateList } from "../templates/registry";
import type { ProjectSpec, Recommendation } from "../types";

// hex → hue (degrees) for rough harmony math
function hueOf(hex: string): number | null {
  const m = hex.replace("#", "");
  if (m.length < 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return null; // near-grey — no meaningful hue
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** R8 input: dominant hue of the dropped art, computed by the intake (canvas downsample). */
export interface RecInputs { artHue?: number | null }

/** R7 — exclusions are a soft veto with receipts: shelved, never blocked. */
export function isShelved(paletteKey: string, exclusions?: string[] | null): boolean {
  if (!exclusions?.length) return false;
  const pal = COLLECTOR_PALETTES[paletteKey];
  if (!pal) return false;
  const hay = `${pal.label} ${pal.texture} ${paletteKey}`.toLowerCase();
  return exclusions.some((x) => x.length > 2 && hay.includes(x.toLowerCase()));
}

const fmtT = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;

/** SURPRISE ME — derive everything derivable, with receipts. Deterministic
 *  per (project, roll); re-roll shifts the picks. */
export function surpriseMe(p: ProjectSpec, inputs: RecInputs, roll = 0, opts?: { keepFormat?: boolean }): { next: ProjectSpec; receipts: string[] } {
  const receipts: string[] = [];
  const d = structuredClone(p);
  const excl = d.analysis?.exclusions;
  // palette: style read → art hue → keep auto
  const styleKey = d.analysis?.styleWords?.length ? classifyCollector(d.analysis.styleWords.join(" ")).key : null;
  const pool = Object.keys(COLLECTOR_PALETTES).filter((k) => k !== "ARCHIVE" && !isShelved(k, excl));
  let pick: string | null = null;
  if (styleKey && styleKey !== "ARCHIVE" && !isShelved(styleKey, excl)) { pick = styleKey; receipts.push(`palette ${COLLECTOR_PALETTES[styleKey].label} — your style text says so`); }
  else if (inputs.artHue != null) {
    const ranked = pool
      .map((k) => ({ k, h: hueOf(COLLECTOR_PALETTES[k].accent) }))
      .filter((x): x is { k: string; h: number } => x.h != null)
      .sort((a, b) => hueDist(inputs.artHue!, a.h) - hueDist(inputs.artHue!, b.h));
    const c = ranked[roll % Math.max(1, Math.min(3, ranked.length))];
    if (c) { pick = c.k; receipts.push(`palette ${COLLECTOR_PALETTES[c.k].label} — closest chrome to your art's color`); }
  }
  if (pick) d.identity.paletteKey = pick;
  if (excl?.length) receipts.push(`${Object.keys(COLLECTOR_PALETTES).filter((k) => isShelved(k, excl)).length || "no"} palettes shelved by your exclusions`);
  // facts
  if (d.analysis?.bpm && !d.facts.bpm) { d.facts.bpm = d.analysis.bpm; receipts.push(`${d.analysis.bpm} BPM stamped (measured on-device)`); }
  // spine word: loudest non-stop lyric word, else style word
  const words = (d.lyrics ?? "").toLowerCase().match(/[a-z']{4,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w)
    .filter((w) => !["that","this","with","your","just","like","dont","cant","wont","from","when","what","been","they","them"].includes(w));
  const spine = top[roll % Math.max(1, Math.min(3, top.length))];
  if (spine && !d.identity.spineWord) { d.identity.spineWord = spine.toUpperCase(); receipts.push(`spine word ${spine.toUpperCase()} — your heaviest lyric word`); }
  // format nudge (EASY auto-derive keeps the user's chosen format sacred)
  if (!opts?.keepFormat && d.analysis?.duration && d.analysis.duration > 360 && !d.templateId.startsWith("vinyl")) {
    d.templateId = "vinyl-12"; receipts.push(`pressed as vinyl 12" — ${Math.floor(d.analysis.duration / 60)}+ minutes breathes like a single`);
  }
  // side-split note
  if (d.analysis?.sideSplit) receipts.push(`tape flips at ${fmtT(d.analysis.sideSplit)} — the section boundary nearest halfway`);
  if (!receipts.length) receipts.push("feed me something — even a title — and I'll have opinions");
  return { next: d, receipts };
}

export function recommend(p: ProjectSpec, inputs: RecInputs = {}): Recommendation[] {
  const out: Recommendation[] = [];
  const a = p.analysis;

  // ── R1 — style text → genre bucket → palette ──────────────────────────────
  if (a?.styleWords?.length && !p.identity.paletteKey) {
    const styleLine = a.styleWords.join(" ");
    const { key } = classifyCollector(styleLine);
    if (key !== "ARCHIVE") {
      const pal = COLLECTOR_PALETTES[key];
      const current = classifyCollector(p.identity.genre).key;
      if (current !== key) {
        out.push({
          id: "R1-palette",
          read: `Your style text reads as ${pal.label}`,
          suggestion: `the ${pal.texture} ${pal.label} spine suits it`,
          overrideHint: "or pick any of the 19 palettes yourself",
          apply: (d) => ({ ...d, identity: { ...d.identity, genre: d.identity.genre || a.styleWords!.join(", "), paletteKey: key } }),
        });
      }
    }
  }

  // ── R2 — measured audio facts ─────────────────────────────────────────────
  if (a?.bpm && a.bpm !== p.facts.bpm) {
    out.push({
      id: "R2-facts",
      read: `Measured on your device: ~${a.bpm} BPM, ${a.duration ? Math.floor(a.duration / 60) + ":" + String(Math.round(a.duration % 60)).padStart(2, "0") : "?"}`,
      suggestion: "stamp the BPM plate and runtime on the case",
      overrideHint: "BPM is an estimate — correct it if you know better",
      measured: true,
      apply: (d) => ({ ...d, facts: { ...d.facts, bpm: a.bpm ?? d.facts.bpm } }),
    });
  }

  // ── R8 — art hue vs chrome harmony ────────────────────────────────────────
  if (inputs.artHue != null) {
    const activeKey = p.identity.paletteKey || classifyCollector(p.identity.genre).key;
    const accentHue = hueOf(COLLECTOR_PALETTES[activeKey]?.accent || "");
    if (accentHue != null && hueDist(inputs.artHue, accentHue) > 110) {
      // find the palette whose accent sits closest to the art
      let bestKey = activeKey, bestD = 361;
      for (const [k, pal] of Object.entries(COLLECTOR_PALETTES)) {
        const h = hueOf(pal.accent);
        if (h == null) continue;
        const d = hueDist(inputs.artHue, h);
        if (d < bestD) { bestD = d; bestKey = k; }
      }
      if (bestKey !== activeKey) {
        out.push({
          id: "R8-harmony",
          read: `Your art runs ${Math.round(inputs.artHue)}° on the color wheel — the ${COLLECTOR_PALETTES[activeKey].label} accent fights it`,
          suggestion: `try the ${COLLECTOR_PALETTES[bestKey].label} chrome`,
          overrideHint: "your call — a clash can be a look",
          apply: (d) => ({ ...d, identity: { ...d.identity, paletteKey: bestKey } }),
        });
      }
    }
  }

  // ── R3 — stems → side-split ───────────────────────────────────────────────
  if (a?.sideSplit && (p.templateId === "cassette" || p.templateId.startsWith("vinyl"))) {
    const t = a.sideSplit;
    out.push({
      id: "R3-sideflip",
      read: `Your sections want the flip at ${fmtT(t)}`,
      suggestion: "that's the boundary nearest halfway — side A ends there",
      overrideHint: "purely a note on the tray; move it in your head freely",
      measured: true,
      apply: (d) => d,
    });
  }

  // ── R9 — runtime → format nudge (only once other formats exist) ───────────
  if (a?.duration && a.duration > 360 && templateList().length > 1) {
    const vinyl = templateList().find((t) => t.id.startsWith("vinyl"));
    if (vinyl && p.templateId !== vinyl.id) {
      const mins = Math.floor(a.duration / 60);
      out.push({
        id: "R9-format",
        read: `At ${mins}+ minutes this breathes like a single`,
        suggestion: `press it as a ${vinyl.name} — one song per side, room to live`,
        overrideHint: "the current format works too",
        apply: (d) => ({ ...d, templateId: vinyl.id }),
      });
    }
  }

  return out;
}

/** Dominant hue of an image element — R8's input, computed on a 32² canvas. */
export function dominantHue(img: HTMLImageElement): number | null {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const h = hueOf(`#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
    if (h == null) continue;
    const rad = (h * Math.PI) / 180;
    sx += Math.cos(rad); sy += Math.sin(rad); n++;
  }
  if (n < 40) return null; // mostly grey art — nothing to harmonize against
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}
