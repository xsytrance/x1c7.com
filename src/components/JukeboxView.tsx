"use client";

// THE JUKEBOX — /music's third face. Every track gets a selection code
// (A1, B7, …) on a lit board; punch a code on the keypad (or tap a card)
// and it drops onto the reel. The record spins under the cover while it
// plays, the marquee scrolls, and UP NEXT shows what the machine will play
// when the needle lifts. Selections feed the real player queue via
// playTrack(current, newQueue) — the isSame guard means appending never
// restarts the song. Credits are a gag: the house always pays.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/data/tracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { tick, fire as hapticFire } from "@/lib/haptics";

/* eslint-disable @next/next/no-img-element */

const LETTERS = "ABCDEFGHJK"; // no I — it reads as 1 on a jukebox board
// nine slots per letter, 1-based: A1..A9, B1..B9 — like the real boards
const codeFor = (i: number) => `${LETTERS[Math.floor(i / 9) % LETTERS.length]}${(i % 9) + 1}`;
const showLen = (d?: string) => (d && d !== "0:00" ? d : null);

export function JukeboxView({ tracks }: { tracks: Track[] }) {
  const { currentTrack, isPlaying, queue, currentIndex, playTrack } = useMusicPlayer();
  const [punched, setPunched] = useState<string>(""); // keypad buffer: "A" then "A7"
  const [flash, setFlash] = useState<string | null>(null); // "A7 · ON THE REEL"
  const [credits, setCredits] = useState(3);
  const flashTimer = useRef(0);

  const coded = useMemo(() => tracks.map((t, i) => ({ track: t, code: codeFor(i) })), [tracks]);
  const byCode = useMemo(() => new Map(coded.map((c) => [c.code, c.track])), [coded]);

  const say = useCallback((text: string) => {
    setFlash(text);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
  }, []);

  // ── the mechanism: first pick plays, later picks stack the reel ───────────
  const select = useCallback((track: Track, code: string) => {
    hapticFire(12);
    setPunched("");
    setCredits((c) => {
      if (c <= 1) { say(`${code} · ON THE REEL — credits refilled, on the house 🍒`); return 3; }
      say(`${code} · ON THE REEL`);
      return c - 1;
    });
    if (!currentTrack || !isPlaying) {
      playTrack(track, [track]);
      return;
    }
    // Append without interrupting: re-hand the player its current song with
    // the grown queue — the isSame guard keeps the needle where it is.
    const pending = queue.slice(currentIndex + 1);
    if (currentTrack.id !== track.id && !pending.some((t) => t.id === track.id)) {
      playTrack(currentTrack, [...queue.slice(0, currentIndex + 1), ...pending, track]);
    }
  }, [currentTrack, isPlaying, queue, currentIndex, playTrack, say]);

  const punch = useCallback((key: string) => {
    tick(6);
    if (LETTERS.includes(key)) { setPunched(key); return; }
    if (!/[0-9]/.test(key)) return;
    if (!punched) return; // digits need a letter first
    const code = punched + key;
    const track = byCode.get(code);
    if (track) select(track, code);
    else { say(`${code} — nothing in that slot`); setPunched(""); }
  }, [punched, byCode, select, say]);

  // Desktop: the physical keyboard IS the keypad. Capture phase + preventDefault
  // so the site's portal hotkeys (digits 1-9 navigate pages) stay asleep while
  // the jukebox is on the floor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const k = e.key.toUpperCase();
      if (LETTERS.includes(k) || /^[0-9]$/.test(k)) {
        e.preventDefault();
        e.stopPropagation();
        punch(k);
      }
      if (e.key === "Escape") setPunched("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [punch]);

  const upNext = queue.slice(currentIndex + 1, currentIndex + 6);
  const nowCode = coded.find((c) => c.track.id === currentTrack?.id)?.code;

  return (
    <div className="mx-auto max-w-5xl" data-jukebox>
      <style>{`
        @keyframes jb-spin { to { transform: rotate(360deg); } }
        @keyframes jb-marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        @keyframes jb-glow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
      `}</style>

      {/* ── the crown: neon arch + marquee ── */}
      <div className="relative overflow-hidden rounded-t-[2.5rem] border border-b-0 border-white/12 px-6 pb-4 pt-5"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--theme-primary) 14%, transparent), transparent 80%)" }}>
        <div className="absolute inset-x-8 top-0 h-[3px] rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, var(--theme-primary), #43f7ff, var(--theme-primary), transparent)", animation: "jb-glow 2.4s ease-in-out infinite" }} />
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.5em] text-white/45">agenor coin-op</p>
        <div className="relative mt-1 h-7 overflow-hidden">
          <p className="absolute whitespace-nowrap font-display text-lg font-black uppercase tracking-[0.3em] text-white/85"
            style={{ animation: "jb-marquee 14s linear infinite" }}>
            {flash ?? (currentTrack ? `now spinning · ${nowCode ? nowCode + " · " : ""}${currentTrack.title} · ${currentTrack.artist}` : "punch a code · any code · the house pays")}
          </p>
        </div>
      </div>

      {/* ── the window: record + up next ── */}
      <div className="grid gap-0 border-x border-white/12 bg-white/[0.03] sm:grid-cols-[220px_1fr]">
        <div className="grid place-items-center border-b border-white/10 p-6 sm:border-b-0 sm:border-r">
          <div className="relative h-40 w-40">
            <div className="absolute inset-0 rounded-full border border-white/15"
              style={{
                background: "repeating-radial-gradient(circle at 50% 50%, #0a0a0f 0px, #16161d 2px, #0a0a0f 4px)",
                animation: isPlaying ? "jb-spin 1.8s linear infinite" : "none",
                boxShadow: isPlaying ? "0 0 34px color-mix(in srgb, var(--theme-primary) 35%, transparent)" : "none",
              }}>
              {currentTrack?.cover
                ? <img src={currentTrack.cover} alt="" className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover" />
                : <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: currentTrack?.color ?? "#222" }} />}
              <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-2 ring-white/25" />
            </div>
            {/* tonearm */}
            <div className="absolute -right-2 top-1 h-20 w-1 origin-top rounded-full bg-white/25 transition-transform duration-700"
              style={{ transform: isPlaying ? "rotate(24deg)" : "rotate(0deg)" }}>
              <span className="absolute bottom-0 left-1/2 h-4 w-2 -translate-x-1/2 rounded-sm bg-white/40" />
            </div>
          </div>
        </div>
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Up next on the reel</p>
          {upNext.length === 0 ? (
            <p className="mt-3 text-[13px] leading-6 text-white/45">
              the reel is empty — punch a code below (letter, then number) or just tap a card.
              Stack as many as you like; the machine plays them in order.
            </p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {upNext.map((t, i) => {
                const c = coded.find((x) => x.track.id === t.id)?.code;
                return (
                  <li key={`${t.id}-${i}`} className="flex items-center gap-3 font-mono text-[12px] text-white/70">
                    <span className="w-7 rounded border border-white/15 px-1 text-center text-[10px] text-[color:var(--theme-primary)]">{c ?? "—"}</span>
                    <span className="truncate">{t.title}</span>
                    {showLen(t.duration) && <span className="ml-auto text-[10px] text-white/30">{showLen(t.duration)}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* ── the board: every song, coded ── */}
      <div className="max-h-[46vh] overflow-y-auto border-x border-white/12 bg-black/30 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {coded.map(({ track: t, code }) => {
            const isNow = t.id === currentTrack?.id;
            const queued = upNext.some((q) => q.id === t.id);
            return (
              <button key={t.id} onClick={() => select(t, code)}
                className="flex min-h-[56px] items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition hover:border-white/40"
                style={{
                  borderColor: isNow ? "var(--theme-primary)" : queued ? "color-mix(in srgb, var(--theme-primary) 45%, transparent)" : "rgba(255,255,255,0.12)",
                  background: isNow ? "color-mix(in srgb, var(--theme-primary) 10%, transparent)" : "rgba(255,255,255,0.02)",
                }}>
                <span className="grid h-8 w-9 flex-none place-items-center rounded border border-white/15 font-mono text-[11px] font-bold tracking-wider"
                  style={{ color: isNow || queued ? "var(--theme-primary)" : "rgba(255,255,255,0.6)" }}>{code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-white/85">{t.title}</span>
                  <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-white/35">{t.genre}{showLen(t.duration) ? ` · ${showLen(t.duration)}` : ""}{isNow ? " · spinning" : queued ? " · queued" : ""}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── the keypad + coin slot ── */}
      <div className="rounded-b-[2.5rem] border border-t-0 border-white/12 bg-white/[0.04] px-4 pb-5 pt-4">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-1.5">
          {LETTERS.split("").map((l) => (
            <button key={l} onClick={() => punch(l)}
              className="h-11 w-11 rounded-lg border font-mono text-[13px] font-bold transition active:scale-95"
              style={punched === l
                ? { borderColor: "var(--theme-primary)", color: "var(--theme-primary)", background: "color-mix(in srgb, var(--theme-primary) 12%, transparent)" }
                : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.65)" }}>{l}</button>
          ))}
          <span className="mx-1 h-8 w-px bg-white/15" />
          {"1234567890".split("").map((d) => (
            <button key={d} onClick={() => punch(d)} disabled={!punched}
              className="h-11 w-11 rounded-lg border border-white/15 font-mono text-[13px] font-bold text-white/65 transition active:scale-95 disabled:opacity-30">{d}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
          <span>{punched ? `${punched}_ — now the number` : "letter · then number"}</span>
          <button onClick={() => { tick(8); setCredits((c) => c + 1); say("coin accepted — that one's a keepsake, plays are free 🍒"); }}
            className="rounded-full border border-white/15 px-3 py-1.5 transition hover:border-[color:var(--theme-primary)] hover:text-white">
            ◎ insert coin · credits {credits}
          </button>
        </div>
      </div>
    </div>
  );
}
