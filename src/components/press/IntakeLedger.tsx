"use client";

// THE LEDGER — a live receipt of what the song fed the machine and what each
// bite unlocked, plus an honest "still hungry for" footer that advertises
// depth without demanding it.

import type { ProjectSpec } from "@/lib/press/types";

const HINT = "text-[11px] leading-4";

export function IntakeLedger({ project }: { project: ProjectSpec }) {
  const a = project.analysis;
  const has = (s: string) => a?.sources?.includes(s as never);
  const rows: { label: string; unlocked: string }[] = [];
  if (project.art.slots.cover) rows.push({ label: "art", unlocked: "case preview · chrome harmony read" });
  if (has("audio")) rows.push({ label: "audio", unlocked: `true waveform · ~${a?.bpm ?? "?"} BPM · ${project.facts.runtime ?? "?"}` });
  if (has("lyrics")) rows.push({ label: "lyrics", unlocked: "spine-word candidates (idea shelf arrives soon)" });
  if (has("style")) rows.push({ label: "style", unlocked: "genre read → palette recommendation" });
  if (has("exclusions")) rows.push({ label: "exclusions", unlocked: "noted — aesthetics you excluded get shelved" });

  const hungry: string[] = [];
  if (!project.art.slots.cover) hungry.push("art → the case comes alive");
  if (!has("audio")) hungry.push("audio → true waveform, BPM, runtime");
  if (!has("style")) hungry.push("style text → an auto palette");
  if (!has("lyrics")) hungry.push("lyrics → spine words + booklet later");

  if (!rows.length && !hungry.length) return null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">The ledger <span className="normal-case tracking-normal text-zinc-700">— everything stays in this tab</span></p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.label} className={`${HINT} text-zinc-400`}>
            <span className="text-emerald-500">✓ {r.label}</span> → {r.unlocked}
          </li>
        ))}
        {hungry.length > 0 && (
          <li className={`${HINT} pt-1 text-zinc-600`}>○ still hungry for: {hungry.join(" · ")}</li>
        )}
        {hungry.length === 0 && <li className={`${HINT} pt-1 text-zinc-600`}>○ still hungry for: nothing — that&apos;s the full meal.</li>}
      </ul>
    </div>
  );
}
