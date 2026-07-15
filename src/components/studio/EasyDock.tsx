"use client";

// THE EASY PLAY SURFACE — everything a first-timer touches during a show.
//   VibeShelf      tap a vibe, the picture glides there over one bar
//   BackdropShelf  hold a backdrop, or let the song keep choosing
//   Surprise me    one button of controlled chaos
//   HintToast      rotating one-liners for the first shows, ✕ = never again
// Desktop wears these as a floating dock; the phone wears them as sheet tabs
// (built in the page). No jargon on any label — that's the whole point.

import { useCallback, useEffect, useRef, useState } from "react";
import { looksStore, type Look } from "@/lib/engine/looks";
import { customScenes } from "@/lib/engine/customScenes";
import { featureBus } from "@/lib/engine/features";
import { deckInfo } from "@/lib/engine/backdrop";
import { P } from "@/lib/engine/params";
import { fire as hapticFire, tick } from "@/lib/haptics";
import { COPY, LS, STAGE_HINTS } from "./copy";

const barSec = () => {
  const bpm = featureBus.F.bpm;
  return bpm > 0 ? 240 / bpm : 2.4;
};

const SCENE_SWATCH: Record<string, string> = {
  AURORA: "linear-gradient(120deg,#0a1e33,#155e75,#0a1e33)",
  EMBERS: "radial-gradient(circle at 60% 50%,#7f1d1d,#2d0a14)",
  INK: "linear-gradient(160deg,#171226,#3b2a63,#171226)",
};
const customSwatch = (name: string) =>
  `linear-gradient(135deg, hsl(${(name.length * 47) % 360} 60% 22%), hsl(${(name.length * 47 + 90) % 360} 70% 40%))`;

// friendlier faces for the built-in backdrop names
const SCENE_FACE: Record<string, string> = { AURORA: "Northern lights", EMBERS: "Embers", INK: "Ink & violet" };

// ── VIBES ────────────────────────────────────────────────────────────────────
export function VibeShelf({ hint = true, className = "" }: { hint?: boolean; className?: string }) {
  const [looks, setLooks] = useState<Look[]>([]);
  const [hot, setHot] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const disarm = useRef(0);
  const hold = useRef(0);
  const held = useRef(false);
  const refresh = useCallback(() => setLooks(looksStore.list()), []);
  useEffect(refresh, [refresh]);

  const fire = (l: Look) => {
    if (armed === l.id) { looksStore.remove(l.id); setArmed(null); refresh(); tick(8); return; }
    looksStore.fire(l.id, barSec());
    setHot(l.id);
    tick(8);
    window.setTimeout(() => setHot((x) => (x === l.id ? null : x)), 800);
  };
  const arm = (l: Look) => {
    if (l.id.startsWith("builtin:")) return;
    setArmed(l.id);
    hapticFire(12);
    window.clearTimeout(disarm.current);
    disarm.current = window.setTimeout(() => setArmed(null), 2200);
  };
  const bottle = () => {
    const n = looksStore.list().filter((l) => l.id.startsWith("user:")).length + 1;
    looksStore.capture(`MINE ${n}`);
    refresh();
    hapticFire(14);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1100);
  };

  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]">{COPY.vibesLabel}</span>
      </div>
      <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {looks.map((l) => {
          const builtin = l.id.startsWith("builtin:");
          const isHot = hot === l.id;
          const isArmed = armed === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onPointerDown={() => {
                held.current = false;
                window.clearTimeout(hold.current);
                hold.current = window.setTimeout(() => { held.current = true; arm(l); }, 500);
              }}
              onPointerUp={() => window.clearTimeout(hold.current)}
              onPointerLeave={() => window.clearTimeout(hold.current)}
              onClick={() => { if (!held.current) fire(l); held.current = false; }}
              className="min-h-[44px] flex-none snap-start rounded-xl border px-3.5 text-[12px] font-semibold capitalize tracking-wide transition"
              style={{
                borderColor: isArmed ? "var(--inst-signal)" : isHot ? "var(--inst-plasma)" : "var(--inst-line)",
                color: isArmed ? "var(--inst-signal)" : isHot ? "var(--inst-plasma)" : builtin ? "var(--inst-ink)" : "var(--inst-warn)",
                background: "color-mix(in srgb, var(--inst-s2) 88%, transparent)",
                boxShadow: isHot ? "0 0 14px color-mix(in srgb, var(--inst-plasma) 45%, transparent)" : "none",
              }}
            >
              {isArmed ? "✕ remove?" : l.name.toLowerCase()}
            </button>
          );
        })}
        <button
          type="button"
          onClick={bottle}
          title="Save what you're seeing right now as your own vibe"
          className="min-h-[44px] flex-none snap-start rounded-xl border border-dashed px-3.5 text-[12px] font-semibold tracking-wide"
          style={{
            borderColor: saved ? "var(--inst-ok)" : "var(--inst-line)",
            color: saved ? "var(--inst-ok)" : "var(--inst-faint)",
            background: "color-mix(in srgb, var(--inst-s2) 88%, transparent)",
          }}
        >
          {saved ? "✓ bottled" : "＋ bottle this"}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] leading-4 text-[var(--inst-faint)]">{COPY.vibesHint}</p>}
    </div>
  );
}

// ── BACKDROPS ────────────────────────────────────────────────────────────────
export function BackdropShelf({ hint = true, className = "" }: { hint?: boolean; className?: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, []);
  const pinned = P.getStr("backdrop.scene");
  const info = deckInfo();
  const all: [string, string][] = [
    ...Object.entries(SCENE_SWATCH),
    ...customScenes.list().map((c) => [c.name, customSwatch(c.name)] as [string, string]),
  ];
  return (
    <div className={className}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]">{COPY.backdropsLabel}</span>
      <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => P.set("backdrop.scene", "AUTO", "ui")}
          className="min-h-[52px] flex-none snap-start rounded-xl border px-3.5 text-left transition"
          style={{
            borderColor: pinned === "AUTO" ? "var(--inst-plasma)" : "var(--inst-line)",
            background: "color-mix(in srgb, var(--inst-s2) 88%, transparent)",
          }}
        >
          <span className="block text-[12px] font-semibold" style={{ color: pinned === "AUTO" ? "var(--inst-plasma)" : "var(--inst-ink)" }}>
            ♪ {COPY.backdropAuto}
          </span>
          <span className="block text-[10px] text-[var(--inst-faint)]">{COPY.backdropAutoBlurb}</span>
        </button>
        {all.map(([name, bg]) => {
          const on = pinned === name;
          const live = info?.a === name || info?.b === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => P.set("backdrop.scene", on ? "AUTO" : name, "ui")}
              className="relative min-h-[52px] w-[92px] flex-none snap-start overflow-hidden rounded-xl border text-left transition"
              style={{ borderColor: on ? "var(--inst-plasma)" : "var(--inst-line)", background: bg }}
            >
              <span className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1 text-[10px] font-semibold capitalize leading-tight text-white/90">
                {(SCENE_FACE[name] ?? name).toLowerCase()}
              </span>
              {live && pinned === "AUTO" && (
                <span className="absolute right-1.5 top-1.5 inline-block h-2 w-2 rounded-full bg-[var(--inst-ok)]" title="on stage right now" />
              )}
              {on && (
                <span className="absolute right-1.5 top-1.5 rounded bg-black/55 px-1 text-[9px] font-bold uppercase text-[var(--inst-plasma)]">held</span>
              )}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-4 text-[var(--inst-faint)]">{COPY.backdropPinHint}</p>}
    </div>
  );
}

// ── SURPRISE ME ──────────────────────────────────────────────────────────────
export function SurpriseButton({ className = "" }: { className?: string }) {
  const [spun, setSpun] = useState(false);
  const surprise = () => {
    const looks = looksStore.list();
    if (looks.length) looksStore.fire(looks[Math.floor(Math.random() * looks.length)].id, barSec());
    const scenes = [...Object.keys(SCENE_SWATCH), ...customScenes.list().map((c) => c.name)];
    // usually hand the backdrop back to the song; sometimes pin a wildcard
    P.set("backdrop.scene", Math.random() < 0.34 && scenes.length ? scenes[Math.floor(Math.random() * scenes.length)] : "AUTO", "ui");
    hapticFire(16);
    setSpun(true);
    window.setTimeout(() => setSpun(false), 900);
  };
  return (
    <button
      type="button"
      onClick={surprise}
      className={`min-h-[44px] rounded-xl border px-4 text-[12px] font-bold uppercase tracking-[0.14em] transition active:scale-[0.98] ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--inst-warn) 55%, transparent)",
        color: "var(--inst-warn)",
        background: spun
          ? "color-mix(in srgb, var(--inst-warn) 18%, transparent)"
          : "color-mix(in srgb, var(--inst-warn) 7%, transparent)",
      }}
    >
      🎲 {COPY.surprise}
    </button>
  );
}

// ── FIRST-SHOW HINTS ─────────────────────────────────────────────────────────
export function HintToast({ coarse }: { coarse: boolean }) {
  const [done, setDone] = useState(true);
  const [i, setI] = useState(0);
  useEffect(() => {
    setDone(window.localStorage.getItem(LS.hintsDone) === "1");
    const id = window.setInterval(() => setI((n) => (n + 1) % STAGE_HINTS.length), 9000);
    return () => window.clearInterval(id);
  }, []);
  if (done || !coarse) return null; // the swipe hints are touch truths
  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--inst-line)] py-1.5 pl-4 pr-2"
      style={{ background: "rgba(12,8,22,0.92)" }}
      data-hint-toast
    >
      <span className="truncate text-[11px] text-[var(--inst-dim)]">{STAGE_HINTS[i]}</span>
      <button
        type="button"
        aria-label="Got it — stop showing hints"
        onClick={() => { window.localStorage.setItem(LS.hintsDone, "1"); setDone(true); }}
        className="grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] text-[var(--inst-faint)] hover:text-white"
      >✕</button>
    </div>
  );
}
