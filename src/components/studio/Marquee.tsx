"use client";

// THE MARQUEE — the Studio's front door. One card, three decisions, one big
// button. Every control says what it does in plain words; the only jargon
// allowed is behind the "I know what I'm doing" door at the bottom.

import { useMemo } from "react";
import type { Track } from "@/data/tracks";
import { canPerform, type StageMode } from "@/components/KineticStage";
import { COPY, LYRIC_STYLES, VISUAL_LEVELS, type VisualLevel } from "./copy";

const field = "rounded-xl border border-[var(--inst-line)] bg-[var(--inst-s2)] text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]";

function Chips<T extends string>({ value, options, onPick }: {
  value: T;
  options: { id: T; name: string; blurb: string; sparks?: string }[];
  onPick: (id: T) => void;
}) {
  const active = options.find((o) => o.id === value);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold tracking-wide transition"
              style={on
                ? { borderColor: "var(--inst-plasma)", color: "var(--inst-plasma)", background: "color-mix(in srgb, var(--inst-plasma) 9%, transparent)" }
                : { borderColor: "var(--inst-line)", color: "var(--inst-dim)", background: "var(--inst-s2)" }}
            >
              {o.name}
              {o.sparks && <span className="ml-1.5 text-[10px] opacity-80">{o.sparks}</span>}
            </button>
          );
        })}
      </div>
      {active && <p className="mt-1.5 min-h-[16px] text-[11.5px] leading-4 text-[var(--inst-dim)]">{active.blurb}</p>}
    </div>
  );
}

export function Marquee({
  tracks, selectedId, onSelect, level, onLevel, lyricStyle, onLyricStyle,
  onStart, mood, onPro, children,
}: {
  tracks: Track[];
  selectedId: string;
  onSelect: (id: string) => void;
  level: VisualLevel["id"];
  onLevel: (id: VisualLevel["id"]) => void;
  lyricStyle: StageMode;
  onLyricStyle: (m: StageMode) => void;
  onStart: () => void;
  mood?: string | null;
  onPro: () => void;
  children?: React.ReactNode; // owner-only extras (the words inbox)
}) {
  const ready = useMemo(() => tracks.filter(canPerform), [tracks]);
  const waiting = useMemo(() => tracks.filter((t) => !canPerform(t)), [tracks]);
  const selected = tracks.find((t) => t.id === selectedId);
  const selectedReady = !!selected && canPerform(selected);

  return (
    <div className="w-full">
      <div className="relative z-10 mx-auto mt-6 w-full max-w-lg rounded-3xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_90%,transparent)] p-6 backdrop-blur-md">
        <h1 className="font-display text-lg font-black uppercase tracking-[0.18em] text-white">{COPY.marqueeTitle}</h1>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--inst-dim)]">{COPY.marqueeLede}</p>

        {/* the song */}
        <label className="mt-5 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]">{COPY.songLabel}</span>
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className={`mt-1.5 w-full px-3 py-3 text-sm ${field}`}
          >
            <optgroup label={`✦ Ready to perform (${ready.length})`}>
              {ready.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </optgroup>
            {waiting.length > 0 && (
              <optgroup label="Still learning their words">
                {waiting.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        {mood && selectedReady && (
          <p className="mt-1.5 text-[11.5px] text-[var(--inst-faint)]">🪐 tonight it feels {mood}</p>
        )}

        {selectedReady ? (
          <>
            <div className="mt-5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]">{COPY.visualsLabel}</span>
              <div className="mt-1.5"><Chips value={level} options={VISUAL_LEVELS} onPick={onLevel} /></div>
            </div>
            <div className="mt-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]">{COPY.lyricsLabel}</span>
              <div className="mt-1.5"><Chips value={lyricStyle} options={LYRIC_STYLES} onPick={onLyricStyle} /></div>
            </div>
            <button
              onClick={onStart}
              className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl border text-[14px] font-bold uppercase tracking-[0.2em] transition hover:scale-[1.01] active:scale-[0.99]"
              style={{
                borderColor: "color-mix(in srgb, var(--inst-plasma) 55%, transparent)",
                background: "color-mix(in srgb, var(--inst-plasma) 12%, transparent)",
                color: "var(--inst-plasma)",
                boxShadow: "0 0 26px color-mix(in srgb, var(--inst-plasma) 22%, transparent)",
              }}
            >
              ▶ {COPY.start}
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--inst-faint)]">
              you can change everything while it plays
            </p>
          </>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-[var(--inst-line)] p-4 text-[12.5px] leading-5 text-[var(--inst-dim)]">
            {COPY.songNotReadyBody}
          </p>
        )}
      </div>

      {children}

      <button
        onClick={onPro}
        className="relative z-10 mx-auto mt-5 block text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--inst-faint)] transition hover:text-[var(--inst-warn)]"
      >
        {COPY.proInvite} → <span className="normal-case tracking-normal opacity-70">{COPY.proInviteBlurb}</span>
      </button>
    </div>
  );
}
