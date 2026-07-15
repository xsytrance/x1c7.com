"use client";

// THE PRO COCKPIT — everything behind "I know what I'm doing". These are the
// dense instruments lifted from the old DIRECT workspace, kept at full power:
// vibe pads, the backdrop rail with the .frag shader loader, the crossfade
// deck strip, the loop recorder, and the owner's words inbox. Naming follows
// the 2026-07 studio vocabulary (Vibes / Backdrops) so both modes speak the
// same language — only the density differs.

import { useCallback, useEffect, useRef, useState } from "react";
import { looksStore, type Look } from "@/lib/engine/looks";
import { ensureAutomation } from "@/lib/engine/automation";
import { customScenes } from "@/lib/engine/customScenes";
import { featureBus } from "@/lib/engine/features";
import { deckInfo } from "@/lib/engine/backdrop";
import { P } from "@/lib/engine/params";
import { themeStore } from "@/lib/themeStore";
import { KineticTelemetry } from "@/components/KineticTelemetry";

export const SCENE_SWATCH: Record<string, string> = {
  AURORA: "linear-gradient(120deg,#0a1e33,#155e75,#0a1e33)",
  EMBERS: "radial-gradient(circle at 60% 50%,#7f1d1d,#2d0a14)",
  INK: "linear-gradient(160deg,#171226,#3b2a63,#171226)",
};

const barSec = () => {
  const bpm = featureBus.F.bpm;
  return bpm > 0 ? (4 * 60) / bpm : 2.4;
};

// ── Vibes as a 4×4 pad grid (fire = morph in over one bar) ──────────────────
export function VibePads() {
  const [looks, setLooks] = useState<Look[]>([]);
  const [fired, setFired] = useState<string | null>(null);
  const refresh = useCallback(() => setLooks(looksStore.list()), []);
  useEffect(refresh, [refresh]);
  const fire = (l: Look) => {
    looksStore.fire(l.id, barSec());
    setFired(l.id);
    window.setTimeout(() => setFired((x) => (x === l.id ? null : x)), 900);
  };
  const save = () => {
    const name = window.prompt("Name this vibe:");
    if (name !== null) { looksStore.capture(name || "untitled"); refresh(); }
  };
  const pads = looks.slice(0, 15);
  return (
    <div>
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">
        Vibes
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {pads.map((l) => {
          const builtin = l.id.startsWith("builtin:");
          const hot = fired === l.id;
          return (
            <button
              key={l.id}
              onClick={() => fire(l)}
              onContextMenu={(e) => { if (!builtin) { e.preventDefault(); looksStore.remove(l.id); refresh(); } }}
              title={`${l.name} — click to fire (morphs over one bar)${builtin ? "" : " · right-click deletes"}`}
              className="flex aspect-square items-end rounded-md border p-1 text-left font-mono text-[7.5px] uppercase leading-tight tracking-wide transition"
              style={{
                borderColor: hot ? "var(--inst-plasma)" : "var(--inst-line)",
                color: hot ? "var(--inst-plasma)" : builtin ? "var(--inst-dim)" : "var(--inst-warn)",
                background: "var(--inst-s2)",
                boxShadow: hot ? "0 0 14px color-mix(in srgb, var(--inst-plasma) 40%, transparent)" : "none",
              }}
            >
              {builtin ? "✦ " : ""}{l.name.slice(0, 12)}
            </button>
          );
        })}
        <button
          onClick={save}
          title="Capture the current look of the stage as a vibe"
          className="grid aspect-square place-items-center rounded-md border border-dashed border-[var(--inst-line)] font-mono text-sm text-[var(--inst-faint)] hover:border-[var(--inst-warn)] hover:text-[var(--inst-warn)]"
        >＋</button>
      </div>
    </div>
  );
}

// ── Backdrop rail: AUTO decks vs a pinned backdrop, live A/B chips, plus the
// Shader SDK loader: drop a .frag, it becomes a backdrop. ────────────────────
export function BackdropRail() {
  const [, force] = useState(0);
  const [fragError, setFragError] = useState<string | null>(null);
  const fragRef = { current: null as HTMLInputElement | null };
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);
  const pinned = P.getStr("backdrop.scene");
  const info = deckInfo();
  const customs = customScenes.list();
  const loadFrag = async (file: File | undefined) => {
    if (!file) return;
    setFragError(null);
    try {
      const name = customScenes.add(file.name, await file.text());
      P.set("backdrop.scene", name, "ui"); // pin the fresh backdrop so it's on stage
    } catch (e) {
      // the compiler's line-numbered listing, trimmed to the point
      setFragError(String(e instanceof Error ? e.message : e).split("\n").slice(0, 4).join("\n"));
    }
  };
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">Backdrops</div>
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          onClick={() => P.set("backdrop.scene", "AUTO", "ui")}
          className="flex items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ borderColor: pinned === "AUTO" ? "var(--inst-plasma)" : "var(--inst-line)", color: pinned === "AUTO" ? "var(--inst-plasma)" : "var(--inst-dim)", background: "var(--inst-s2)" }}
        >
          AUTO<span className="ml-auto text-[8px] text-[var(--inst-faint)]">sections drive the decks</span>
        </button>
        {[...Object.entries(SCENE_SWATCH), ...customs.map((c) => [c.name, `linear-gradient(135deg, hsl(${(c.name.length * 47) % 360} 60% 22%), hsl(${(c.name.length * 47 + 90) % 360} 70% 40%))`] as [string, string])].map(([name, bg]) => {
          const custom = !(name in SCENE_SWATCH);
          return (
            <button
              key={name}
              onClick={() => P.set("backdrop.scene", pinned === name ? "AUTO" : name, "ui")}
              onContextMenu={(e) => { if (custom) { e.preventDefault(); customScenes.remove(name); } }}
              title={`${pinned === name ? "Pinned — click to release to AUTO" : "Pin this backdrop (disables the decks)"}${custom ? " · right-click removes · re-load a .frag with the same @name to hot-replace" : ""}`}
              className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
              style={{ borderColor: pinned === name ? "var(--inst-plasma)" : "var(--inst-line)", background: "var(--inst-s2)" }}
            >
              <span className="h-6 w-10 flex-none rounded" style={{ background: bg }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--inst-ink)]">{custom ? "⌁ " : ""}{name}</span>
              <span className="ml-auto flex gap-1">
                {info?.a === name && <b className="rounded border border-[var(--inst-plasma)] px-1.5 font-mono text-[8px] font-normal text-[var(--inst-plasma)]">A</b>}
                {info?.b === name && <b className="rounded border border-[var(--inst-warn)] px-1.5 font-mono text-[8px] font-normal text-[var(--inst-warn)]">B</b>}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => fragRef.current?.click()}
          title="Shader SDK — load a .frag fragment shader as a live backdrop (full stem/word/key uniform contract; // @name and // @param directives)"
          className="flex min-h-[28px] items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--inst-line)] font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--inst-faint)] hover:border-[var(--inst-plasma)] hover:text-[var(--inst-plasma)]"
        >＋ .frag</button>
        <input ref={(el) => { fragRef.current = el; }} type="file" accept=".frag,.glsl,text/plain" className="hidden"
          onChange={(e) => { loadFrag(e.target.files?.[0]); e.target.value = ""; }} />
        {fragError && (
          <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--inst-signal)] bg-black/40 p-2 font-mono text-[8.5px] leading-snug text-[var(--inst-signal)]">{fragError}</pre>
        )}
      </div>
    </div>
  );
}

// ── Loop recorder: arm, ride sliders for one loop, it replays forever ───────
export function AutomationCluster() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  const auto = ensureAutomation();
  const armed = P.getBool("auto.record");
  const playing = P.getBool("auto.play");
  const recording = auto.state === "recording";
  const waiting = auto.state === "waiting";
  return (
    <div className="flex items-center gap-2 border-l border-[var(--inst-line)] pl-4">
      <button
        onClick={() => P.set("auto.record", !armed, "code")}
        title={recording ? "Recording the take — disarm to stop early" : waiting ? "Armed — the take starts on the next bar" : "Loop recorder: arm, ride sliders for one loop, it replays forever"}
        className="flex min-h-[24px] items-center gap-1.5 rounded-md border px-2 font-mono text-[9px] uppercase tracking-[0.15em]"
        style={armed
          ? { borderColor: "var(--inst-signal)", color: "var(--inst-signal)", boxShadow: recording ? "0 0 12px color-mix(in srgb, var(--inst-signal) 55%, transparent)" : "none" }
          : { borderColor: "var(--inst-line)", color: "var(--inst-dim)" }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: armed ? "var(--inst-signal)" : "#241b36", opacity: waiting ? 0.5 : 1 }} />
        {recording ? "take…" : waiting ? "on the bar" : "● rec"}
      </button>
      <select
        value={P.getStr("auto.length")}
        onChange={(e) => P.set("auto.length", e.target.value, "code")}
        title="Loop length of the take"
        className="h-6 rounded border border-[var(--inst-line)] bg-[var(--inst-s2)] px-1 font-mono text-[9px] uppercase text-[var(--inst-dim)] outline-none focus:border-[var(--inst-plasma)]"
      >
        {["1 BAR", "2 BARS", "4 BARS", "8 BARS"].map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {auto.hasTracks() && (
        <>
          <button
            onClick={() => P.set("auto.play", !playing, "code")}
            title={playing ? "Loop playing — click to hold" : "Resume the recorded loop"}
            className="min-h-[24px] rounded-md border px-2 font-mono text-[9px] uppercase tracking-[0.15em]"
            style={playing ? { borderColor: "var(--inst-warn)", color: "var(--inst-warn)" } : { borderColor: "var(--inst-line)", color: "var(--inst-dim)" }}
          >{playing ? `▶ ${auto.laneCount()} lane${auto.laneCount() > 1 ? "s" : ""}` : "▶ play"}</button>
          <button
            onClick={() => auto.clear()}
            title="Clear the recorded loop"
            className="min-h-[24px] rounded-md border border-[var(--inst-line)] px-1.5 font-mono text-[9px] text-[var(--inst-faint)] hover:text-[var(--inst-signal)]"
          >✕</button>
        </>
      )}
    </div>
  );
}

// ── Deck strip: what the section decks are doing, live ──────────────────────
export function DeckStrip({ bare = false }: { bare?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  const info = deckInfo();
  const fadeBeats = P.get("backdrop.fadeBeats");
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-2 ${bare ? "" : "border-t border-[var(--inst-line)] bg-[var(--inst-s1)]"}`}>
      <div className="relative h-10 w-[72px] flex-none rounded-md border border-[var(--inst-line)]" style={{ background: SCENE_SWATCH[info?.a ?? "AURORA"] }}>
        <b className="absolute left-1.5 top-1 font-mono text-[8px] font-normal tracking-[0.18em] text-[var(--inst-plasma)]">A · {info?.a ?? "—"}</b>
      </div>
      <div className="relative h-1.5 w-52 max-w-[24vw] rounded-full bg-[#221a35]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--inst-warn)]" style={{ width: `${(info?.mix ?? 0) * 100}%`, opacity: 0.85 }} />
      </div>
      <div className="relative h-10 w-[72px] flex-none rounded-md border border-[var(--inst-line)]" style={{ background: info?.b ? SCENE_SWATCH[info.b] : "var(--inst-s2)" }}>
        <b className="absolute left-1.5 top-1 font-mono text-[8px] font-normal tracking-[0.18em] text-[var(--inst-warn)]">B · {info?.b ?? "—"}</b>
      </div>
      <label className="ml-2 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--inst-dim)]">
        Fade
        <input
          type="range" min={2} max={16} step={1} value={fadeBeats}
          onChange={(e) => P.set("backdrop.fadeBeats", +e.target.value, "ui")}
          className="h-1 w-20 accent-[var(--inst-plasma)]"
        />
        <span className="tabular-nums text-[var(--inst-plasma)]">{fadeBeats} BT</span>
      </label>
      <span className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--inst-faint)]">quantize · bar</span>

      <AutomationCluster />

      <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--inst-faint)]">the song&apos;s sections drive the fader</span>
    </div>
  );
}

// ── WORDS INBOX (owner, tailnet only — the API 404s on public hosts) ────────
// The easy way to hand corrected lyrics to the alignment pipeline: pick a
// flagged song, paste the real words, save. realign-inbox.mjs does the rest
// (align → refine → gate → apply → melody refresh).
export function LyricsInbox() {
  const [flagged, setFlagged] = useState<{ id: string; reason: string; severity: string; inbox: boolean }[]>([]);
  const [sel, setSel] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = useCallback(() => {
    fetch("/api/studio/lyrics").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.flagged) { setFlagged(d.flagged); if (!sel && d.flagged.length) setSel(d.flagged[0].id); }
    }).catch(() => {});
  }, [sel]);
  useEffect(refresh, [refresh]);
  if (!flagged.length) return null;
  const cur = flagged.find((f) => f.id === sel);
  const save = async () => {
    setMsg(null);
    const r = await fetch("/api/studio/lyrics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: sel, lyrics: text }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (r?.ok) { setMsg(`✓ saved (${d.words} words) — run: node scripts/alignment/realign-inbox.mjs`); setText(""); refresh(); }
    else setMsg(`✗ ${d?.error ?? "save failed"}`);
  };
  return (
    <div className="relative z-10 mx-auto mt-4 w-full max-w-lg rounded-2xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] p-5 backdrop-blur-md">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: "var(--inst-warn)" }}>Fix the words</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--inst-faint)]">{flagged.length} songs need lyrics · owner only</span>
      </div>
      <select value={sel} onChange={(e) => { setSel(e.target.value); setText(""); setMsg(null); }}
        className="mt-2 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]">
        {flagged.map((f) => <option key={f.id} value={f.id}>{f.inbox ? "📥 " : ""}{f.id} — {f.severity}</option>)}
      </select>
      {cur && <p className="mt-2 font-mono text-[10px] leading-4 text-[var(--inst-dim)]">{cur.reason}{cur.inbox ? " · a submission is already waiting in the inbox" : ""}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="paste the real lyrics here — plain text, one line per sung line ([Section] headers are fine, they're stripped)"
        rows={7}
        className="mt-2 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] p-3 font-mono text-[11px] leading-5 text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]"
      />
      <button onClick={save} disabled={text.trim().length < 20}
        className="mt-2 w-full rounded-lg border py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] transition enabled:hover:scale-[1.01] disabled:opacity-40"
        style={{
          borderColor: "color-mix(in srgb, var(--inst-warn) 50%, transparent)",
          background: "color-mix(in srgb, var(--inst-warn) 8%, transparent)",
          color: "var(--inst-warn)",
        }}>
        ＋ Save to the inbox
      </button>
      {msg && <p className="mt-2 font-mono text-[10px] tracking-wide" style={{ color: msg.startsWith("✓") ? "var(--inst-ok)" : "var(--inst-signal)" }}>{msg}</p>}
    </div>
  );
}

// ── The telemetry jewel (mobile top bar): one dot breathing on --beat + BPM.
// Tap it and the full compact telemetry row takes the spot for 4 seconds. ───
export function BeatJewel({ className = "" }: { className?: string }) {
  const [full, setFull] = useState(false);
  const [bpm, setBpm] = useState("—");
  const timer = useRef(0);
  const dotRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const b = featureBus.F.bpm;
      setBpm(b > 0 ? b.toFixed(0) : "—");
    }, 500);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (full) return;
    let raf = 0;
    const tickBeat = () => {
      dotRef.current?.style.setProperty("--beat", themeStore.get().beat.toFixed(3));
      raf = requestAnimationFrame(tickBeat);
    };
    raf = requestAnimationFrame(tickBeat);
    return () => cancelAnimationFrame(raf);
  }, [full]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (full) {
    return (
      <button
        type="button"
        aria-label="Hide telemetry"
        onClick={() => { window.clearTimeout(timer.current); setFull(false); }}
        className={`flex ${className}`}
      >
        <KineticTelemetry compact />
      </button>
    );
  }
  return (
    <button
      ref={dotRef}
      type="button"
      aria-label="Show telemetry"
      onClick={() => {
        setFull(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFull(false), 4000);
      }}
      className={`flex min-h-[36px] items-center gap-2 ${className}`}
      data-beat-jewel
    >
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--inst-signal)]"
        style={{ transform: "scale(calc(1 + var(--beat) * 0.6))" }}
      />
      <span className="font-mono text-[11px] tabular-nums text-[var(--inst-plasma)]">
        {bpm}<span className="ml-1 text-[8px] uppercase tracking-[0.22em] text-[var(--inst-dim)]">bpm</span>
      </span>
    </button>
  );
}
