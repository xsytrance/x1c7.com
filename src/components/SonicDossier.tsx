"use client";
// THE SONIC DOSSIER — every collector edition ships with its papers.
// Reads the ultimate analyzer's profile.json from R2 (planets/<slug>/) and
// renders the song's measured identity: the ID plate (BPM/key/dynamics/tone),
// the structure strip with real section intensities, the energy journey,
// drop map, stem loadout, and the analyst's read. Any missing field renders
// as nothing — a partial profile still gets a dossier.

import { useEffect, useState } from "react";

const PLANET_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

interface Profile {
  v?: number;
  id?: string;
  generatedAt?: string;
  measured?: { bpm?: number; duration?: number };
  identity?: {
    genre?: string; subGenres?: string[]; mood?: string; styleSentence?: string;
    language?: string; energy?: string; vocalStyle?: string;
  };
  cover?: { palette?: string[]; artStyle?: string; mood?: string };
  mixFeatures?: {
    keyEstimate?: { key?: string; mode?: string; confidence?: number };
    brightness?: number; dynamicsDb?: number; boundaries?: number[];
  };
  lyrics?: { official?: boolean; language?: string };
  analysis?: {
    summary?: string; overallMood?: string; themes?: string[];
    sections?: { name: string; start?: number; emotion?: string; intensity?: number; colorHint?: string }[];
    keywords?: { word: string; emotion?: string }[];
  };
  show?: {
    energyArc?: { open: number; mid: number; close: number };
    vocalPresence?: { name: string; presence: number }[];
    dropMap?: { cuts?: [number, number][]; risers?: { t: number; end: number }[] };
    performs?: { stems?: string[]; approx?: boolean };
  };
}

// Camelot wheel — the key signature DJs actually mix by.
const CAMELOT: Record<string, string> = {
  "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B", "E major": "12B", "B major": "1B",
  "F# major": "2B", "C# major": "3B", "G# major": "4B", "D# major": "5B", "A# major": "6B", "F major": "7B",
  "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A", "C# minor": "12A", "G# minor": "1A",
  "D# minor": "2A", "A# minor": "3A", "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
};
const FLAT: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
function camelot(key?: string, mode?: string) {
  if (!key || !mode) return null;
  return CAMELOT[`${FLAT[key] ?? key} ${mode.toLowerCase()}`] ?? null;
}
const NICE_KEY: Record<string, string> = { "A#": "B♭", "D#": "E♭", "G#": "A♭", "C#": "D♭", "F#": "F♯" };

// Spectral centroid → how the mix sits on the dark↔brilliant axis.
const toneLabel = (hz?: number) =>
  hz == null ? null : hz < 1600 ? "DARK" : hz < 2600 ? "WARM" : hz < 3800 ? "BRIGHT" : "BRILLIANT";
const dynLabel = (db?: number) =>
  db == null ? null : db >= 14 ? "BREATHING" : db >= 9 ? "PUNCHY" : db >= 5 ? "DENSE" : "WALL OF SOUND";

const STEM_LABEL: Record<string, string> = {
  lead: "LEAD VOX", back: "BACKING VOX", drums: "DRUMS", bass: "BASS", keys: "KEYS",
  perc: "PERCUSSION", synth: "SYNTH", guitar: "GUITAR", strings: "STRINGS",
  woodwinds: "WOODWINDS", brass: "BRASS", other: "TEXTURES",
};

const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-center">
      <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/35">{label}</p>
      <p className="mt-1 font-display text-2xl font-black text-white">{value}</p>
      {sub ? <p className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-white/40">{sub}</p> : null}
    </div>
  );
}

export default function SonicDossier({ slug, accent, bpm, duration }: {
  slug: string; accent: string; bpm?: number | null; duration?: number | null;
}) {
  const [p, setP] = useState<Profile | null>(null);
  useEffect(() => {
    let dead = false;
    fetch(`${PLANET_BASE}/planets/${slug}/profile.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead && j) setP(j); })
      .catch(() => {});
    return () => { dead = true; };
  }, [slug]);
  if (!p) return null;

  const ke = p.mixFeatures?.keyEstimate;
  const cam = camelot(ke?.key, ke?.mode);
  const theBpm = p.measured?.bpm ?? bpm ?? null;
  const theDur = p.measured?.duration ?? duration ?? null;
  const sections = (p.analysis?.sections ?? []).filter((s) => typeof s.start === "number");
  const total = theDur ?? (sections.length ? Math.max(...sections.map((s) => s.start ?? 0)) * 1.15 : null);
  const arc = p.show?.energyArc;
  const cuts = p.show?.dropMap?.cuts ?? [];
  const risers = p.show?.dropMap?.risers ?? [];
  const stems = p.show?.performs?.stems ?? [];
  const vox = new Map((p.show?.vocalPresence ?? []).map((v) => [v.name, v.presence]));
  const dossierNo = p.id ? (Array.from(p.id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4096).toString(16).toUpperCase().padStart(3, "0") : "000";

  return (
    <div className="mt-10 overflow-hidden rounded-xl border border-white/12 bg-white/[0.03] text-left">
      {/* certificate header */}
      <div className="flex items-baseline justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="font-display text-lg font-black uppercase tracking-[0.14em] text-white">Sonic Dossier</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
            measured from the master{stems.length ? ` + ${stems.length} isolated stems` : ""}
          </p>
        </div>
        <p className="font-mono text-[11px] tracking-[0.2em]" style={{ color: accent }}>№ {dossierNo}</p>
      </div>

      <div className="space-y-7 px-6 py-6">
        {/* the ID plate */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {theBpm ? <Tile label="Tempo" value={String(Math.round(theBpm))} sub="BPM" /> : null}
          {ke?.key ? <Tile label="Key" value={`${NICE_KEY[ke.key] ?? ke.key}${ke.mode === "minor" ? "m" : ""}`} sub={cam ? `CAMELOT ${cam}` : null} /> : null}
          {theDur ? <Tile label="Runtime" value={fmtT(theDur)} sub={theBpm ? `${Math.round((theDur / 60) * theBpm)} BEATS` : null} /> : null}
          {p.identity?.energy ? <Tile label="Energy" value={p.identity.energy.toUpperCase()} sub={p.analysis?.overallMood?.toUpperCase().slice(0, 14) ?? null} /> : null}
          {p.mixFeatures?.dynamicsDb != null ? <Tile label="Dynamics" value={`${Math.round(p.mixFeatures.dynamicsDb)}dB`} sub={dynLabel(p.mixFeatures.dynamicsDb)} /> : null}
          {p.mixFeatures?.brightness != null ? <Tile label="Tone" value={toneLabel(p.mixFeatures.brightness) ?? "—"} sub={`${Math.round(p.mixFeatures.brightness)} HZ`} /> : null}
        </div>

        {/* structure strip — the song's anatomy on one bar */}
        {sections.length > 1 && total ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">anatomy</p>
            <div className="mt-2 flex h-14 w-full gap-[2px] overflow-hidden rounded-md">
              {sections.map((s, i) => {
                const a = s.start ?? 0;
                const b = sections[i + 1]?.start ?? total;
                const w = Math.max(1.5, ((b - a) / total) * 100);
                const heat = Math.max(0.12, Math.min(1, s.intensity ?? 0.5));
                const voxHere = vox.get(s.name);
                return (
                  <div key={`${s.name}${i}`} className="group relative min-w-0" style={{ width: `${w}%` }}
                    title={`${s.name} · ${fmtT(a)}${s.emotion ? ` · ${s.emotion}` : ""}`}>
                    <div className="absolute bottom-0 w-full rounded-sm transition group-hover:brightness-125"
                      style={{ height: `${18 + heat * 82}%`, background: s.colorHint || accent, opacity: 0.3 + heat * 0.65 }} />
                    {voxHere != null && voxHere > 8 ? (
                      <div className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/80" title="vocals present" />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex w-full gap-[2px]">
              {sections.map((s, i) => {
                const a = s.start ?? 0;
                const b = sections[i + 1]?.start ?? total;
                const w = Math.max(1.5, ((b - a) / total) * 100);
                return (
                  <p key={`l${i}`} className="min-w-0 truncate font-mono text-[8px] uppercase tracking-wider text-white/35" style={{ width: `${w}%` }}>
                    {w > 6 ? s.name : ""}
                  </p>
                );
              })}
            </div>
            <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-white/30">
              BAR HEIGHT = MEASURED ENERGY · DOT = VOCALS ON DECK
              {cuts.length ? ` · ${cuts.length} BEAT-CUTS` : ""}{risers.length ? ` · ${risers.length} RISERS` : ""}
            </p>
          </div>
        ) : null}

        {/* the journey — open/mid/close */}
        {arc ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">the journey</p>
            <div className="mt-2 flex items-end gap-3">
              {([["OPENS", arc.open], ["MIDDLE", arc.mid], ["CLOSES", arc.close]] as const).map(([l, v]) => (
                <div key={l} className="flex-1">
                  <div className="flex h-16 items-end rounded-md bg-black/30 px-1.5 pb-1.5">
                    <div className="w-full rounded-sm" style={{ height: `${10 + (v / 99) * 90}%`, background: accent, opacity: 0.4 + (v / 99) * 0.6 }} />
                  </div>
                  <p className="mt-1 text-center font-mono text-[9px] tracking-[0.24em] text-white/40">{l} {v}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* the analyst's read */}
        {p.analysis?.summary ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">the read</p>
            <p className="mt-2 text-sm leading-7 text-white/65">{p.analysis.summary}</p>
            {p.identity?.styleSentence ? (
              <p className="mt-3 border-l-2 pl-3 text-sm italic leading-6 text-white/50" style={{ borderColor: accent }}>
                “{p.identity.styleSentence}”
              </p>
            ) : null}
            {(p.analysis.themes?.length || p.analysis.keywords?.length) ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(p.analysis.themes ?? []).map((t) => (
                  <span key={t} className="rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">{t}</span>
                ))}
                {(p.analysis.keywords ?? []).slice(0, 6).map((k) => (
                  <span key={k.word} className="rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-black" style={{ background: accent, opacity: 0.85 }} title={k.emotion}>{k.word}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* loadout + voice */}
        {stems.length ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">the loadout{p.show?.performs?.approx ? " (approx)" : ""}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stems.map((s) => (
                <span key={s} className="rounded-sm border border-white/15 bg-black/30 px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-white/60">
                  {STEM_LABEL[s] ?? s.toUpperCase()}
                </span>
              ))}
            </div>
            {p.identity?.vocalStyle ? (
              <p className="mt-2 font-mono text-[11px] tracking-[0.12em] text-white/40">VOICE · {p.identity.vocalStyle.toUpperCase()}</p>
            ) : null}
          </div>
        ) : null}

        {/* cover palette */}
        {p.cover?.palette?.length ? (
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-md border border-white/10">
              {p.cover.palette.slice(0, 5).map((c) => (
                <div key={c} className="h-7 w-10" style={{ background: c }} title={c} />
              ))}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
              case palette{p.cover.artStyle ? ` · ${p.cover.artStyle}` : ""}
            </p>
          </div>
        ) : null}
      </div>

      {/* certificate footer */}
      <div className="border-t border-white/10 px-6 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">
          analyzed by the agenor ultimate engine · stems + mix + lyrics + cover
          {p.generatedAt ? ` · ${p.generatedAt.slice(0, 10)}` : ""}
          {p.lyrics?.official ? " · official lyrics" : ""}
        </p>
      </div>
    </div>
  );
}
