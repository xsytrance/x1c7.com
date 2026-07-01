"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Tap-to-time lyrics: play the track and stamp each line as it starts. Output is
// LRC ([mm:ss.xx] prefixes) written back into the plain `lyrics` field, which the
// cinematic view auto-detects and plays as synced karaoke.

const LRC_PREFIX = /^\s*\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*/;
const isSyncable = (line: string) => !!line.trim() && !/^\[.*\]$/.test(line.trim());

function toLrc(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `[${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
}

export function LyricsSyncEditor({ title, audioUrl, value, onSave, onClose }: {
  title: string;
  audioUrl: string;
  value: string;
  onSave: (lrc: string) => void;
  onClose: () => void;
}) {
  // Split into display lines, seeding any existing LRC timestamps.
  const initial = useMemo(() => {
    return value.replace(/\r\n?/g, "\n").split("\n").map((raw) => {
      const m = raw.match(LRC_PREFIX);
      const text = raw.replace(LRC_PREFIX, "");
      const time = m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0) : null;
      return { text, time };
    });
  }, [value]);

  const [lines] = useState(initial.map((x) => x.text));
  const [times, setTimes] = useState<(number | null)[]>(initial.map((x) => x.time));
  const syncableIdx = useMemo(() => lines.map((l, i) => (isSyncable(l) ? i : -1)).filter((i) => i >= 0), [lines]);
  const [cursor, setCursor] = useState<number>(syncableIdx[0] ?? -1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const doneCount = syncableIdx.filter((i) => times[i] != null).length;
  const allSynced = syncableIdx.length > 0 && doneCount === syncableIdx.length;

  const nextSyncable = useCallback((from: number) => syncableIdx.find((i) => i > from) ?? from, [syncableIdx]);
  const prevSyncable = useCallback((from: number) => [...syncableIdx].reverse().find((i) => i < from) ?? from, [syncableIdx]);

  const stamp = useCallback(() => {
    const a = audioRef.current;
    if (!a || cursor < 0) return;
    const t = a.currentTime;
    setTimes((prev) => prev.map((v, i) => (i === cursor ? t : v)));
    setCursor((c) => nextSyncable(c));
  }, [cursor, nextSyncable]);

  const back = useCallback(() => {
    setCursor((c) => {
      const target = times[c] == null ? prevSyncable(c) : c; // step back to the last stamped line
      setTimes((prev) => prev.map((v, i) => (i === target ? null : v)));
      return target;
    });
  }, [prevSyncable, times]);

  const reset = useCallback(() => {
    setTimes(lines.map(() => null));
    setCursor(syncableIdx[0] ?? -1);
    const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0; }
  }, [lines, syncableIdx]);

  // Auto-scroll the active row into view.
  useEffect(() => { rowRefs.current[cursor]?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [cursor]);

  // Keyboard: Space = stamp, ← = back, Esc = close, P = play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " ") { e.preventDefault(); stamp(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "Escape") { onClose(); }
      else if (e.key.toLowerCase() === "p") { const a = audioRef.current; if (a) (a.paused ? a.play().catch(() => {}) : a.pause()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stamp, back, onClose]);

  const buildLrc = () => lines.map((line, i) => (isSyncable(line) && times[i] != null ? toLrc(times[i]!) + line : line)).join("\n");

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-void/95 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <h2 className="font-display text-sm font-black uppercase tracking-tight text-white">Sync · {title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
          {doneCount}/{syncableIdx.length} lines{allSynced ? " ✓" : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={reset} className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50 hover:text-white">Reset</button>
          {/* Partial saves are safe — the player only karaoke-highlights timed lines. */}
          <button onClick={() => { onSave(buildLrc()); onClose(); }} disabled={doneCount === 0}
            title={allSynced ? "Apply timestamps to all lines" : "Save progress — you can resume later"}
            className="rounded-lg bg-signal px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-void transition enabled:hover:brightness-110 disabled:opacity-40">
            {allSynced ? "Apply LRC" : "Save progress"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50 hover:text-white">Close · Esc</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="w-full sm:w-96" />
        <button onClick={stamp} disabled={cursor < 0}
          className="rounded-full bg-plasma px-6 py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-void transition enabled:hover:scale-[1.03] disabled:opacity-40">
          ⏱ Set line · Space
        </button>
        <button onClick={back} className="rounded-full border border-white/15 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">← Back</button>
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">Play, then tap Set as each line begins</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-0.5">
          {lines.map((line, i) => {
            const header = !!line.trim() && !isSyncable(line);
            const active = i === cursor;
            if (!line.trim()) return <div key={i} className="h-3" />;
            return (
              <div key={i} ref={(el) => { rowRefs.current[i] = el; }}
                onClick={() => isSyncable(line) && setCursor(i)}
                className={`flex items-center gap-3 rounded-lg px-3 py-1.5 transition ${active ? "bg-plasma/15 ring-1 ring-plasma/40" : "hover:bg-white/5"} ${isSyncable(line) ? "cursor-pointer" : ""}`}>
                <span className={`w-16 shrink-0 font-mono text-[10px] ${times[i] != null ? "text-signal" : "text-white/20"}`}>
                  {header ? "" : times[i] != null ? toLrc(times[i]!).replace(/[[\]]/g, "") : "—"}
                </span>
                <span className={header ? "font-mono text-[10px] uppercase tracking-[0.3em] text-white/30" : `text-sm ${active ? "text-white" : "text-white/70"}`}>
                  {header ? line.trim().replace(/^\[|\]$/g, "") : line}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
