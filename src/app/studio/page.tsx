"use client";

// THE STUDIO — the instrument. UI overhaul phase 2 (PRISM's Direction A in
// x1c7's skin): three workspaces on one toggle — SHOW (watch, no chrome),
// DIRECT (the full control surface below), SETUP (song/pass/mode, visited
// once) — live telemetry in the top bar, looks as a pad grid, scenes with
// A/B deck chips, the self-building param panel, and a deck strip along the
// bottom. Embed behavior (the Planet Studio WebView) is unchanged.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { KineticStage, canPerform, MODES, type StageMode } from "@/components/KineticStage";
import { KineticParamPanel } from "@/components/KineticParamPanel";
import { KineticTelemetry } from "@/components/KineticTelemetry";
import { looksStore, type Look } from "@/lib/engine/looks";
import { ensureAutomation } from "@/lib/engine/automation";
import { featureBus } from "@/lib/engine/features";
import { deckInfo } from "@/lib/engine/backdrop";
import { P } from "@/lib/engine/params";
import { supabase } from "@/lib/supabase";
import { isPrivateHost } from "@/lib/privateHost";
import type { Track } from "@/data/tracks";

const PASSES = [
  { id: 6, label: "Pass 6 · dynamic+" },
  { id: 5, label: "Pass 5 · cinematic" },
  { id: 4, label: "Pass 4 · living backdrop" },
  { id: 3, label: "Pass 3 · satellite" },
  { id: 2, label: "Pass 2 · satellite" },
  { id: 1, label: "Pass 1 · satellite" },
];

type Workspace = "SHOW" | "DIRECT" | "SETUP";
const SCENE_SWATCH: Record<string, string> = {
  AURORA: "linear-gradient(120deg,#0a1e33,#155e75,#0a1e33)",
  EMBERS: "radial-gradient(circle at 60% 50%,#7f1d1d,#2d0a14)",
  INK: "linear-gradient(160deg,#171226,#3b2a63,#171226)",
};

const barSec = () => {
  const bpm = featureBus.F.bpm;
  return bpm > 0 ? (4 * 60) / bpm : 2.4;
};

// ── Looks as a 4×4 pad grid (fire = morph in over one bar) ──────────────────
function LooksPads() {
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
    const name = window.prompt("Name this look:");
    if (name !== null) { looksStore.capture(name || "untitled"); refresh(); }
  };
  const pads = looks.slice(0, 15);
  return (
    <div>
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">
        Looks
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
          title="Capture the current look"
          className="grid aspect-square place-items-center rounded-md border border-dashed border-[var(--inst-line)] font-mono text-sm text-[var(--inst-faint)] hover:border-[var(--inst-warn)] hover:text-[var(--inst-warn)]"
        >＋</button>
      </div>
    </div>
  );
}

// ── Scenes rail: AUTO decks vs a pinned scene, with live A/B chips ──────────
function ScenesRail() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);
  const pinned = P.getStr("backdrop.scene");
  const info = deckInfo();
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">Scenes</div>
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          onClick={() => P.set("backdrop.scene", "AUTO", "ui")}
          className="flex items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ borderColor: pinned === "AUTO" ? "var(--inst-plasma)" : "var(--inst-line)", color: pinned === "AUTO" ? "var(--inst-plasma)" : "var(--inst-dim)", background: "var(--inst-s2)" }}
        >
          AUTO<span className="ml-auto text-[8px] text-[var(--inst-faint)]">sections drive the decks</span>
        </button>
        {Object.entries(SCENE_SWATCH).map(([name, bg]) => (
          <button
            key={name}
            onClick={() => P.set("backdrop.scene", pinned === name ? "AUTO" : name, "ui")}
            title={pinned === name ? "Pinned — click to release to AUTO" : "Pin this scene (disables the decks)"}
            className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
            style={{ borderColor: pinned === name ? "var(--inst-plasma)" : "var(--inst-line)", background: "var(--inst-s2)" }}
          >
            <span className="h-6 w-10 flex-none rounded" style={{ background: bg }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--inst-ink)]">{name}</span>
            <span className="ml-auto flex gap-1">
              {info?.a === name && <b className="rounded border border-[var(--inst-plasma)] px-1.5 font-mono text-[8px] font-normal text-[var(--inst-plasma)]">A</b>}
              {info?.b === name && <b className="rounded border border-[var(--inst-warn)] px-1.5 font-mono text-[8px] font-normal text-[var(--inst-warn)]">B</b>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Deck strip: what the section decks are doing, live ──────────────────────
function DeckStrip() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  const info = deckInfo();
  const fadeBeats = P.get("backdrop.fadeBeats");
  return (
    <div className="flex items-center gap-4 border-t border-[var(--inst-line)] bg-[var(--inst-s1)] px-4 py-2">
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

      {/* ── AUTOMATION — arm, ride sliders, it loops forever on the grid ── */}
      <AutomationCluster />

      <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--inst-faint)]">the song&apos;s sections drive the fader</span>
    </div>
  );
}

function AutomationCluster() {
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
        title={recording ? "Recording the take — disarm to stop early" : waiting ? "Armed — the take starts on the next bar" : "Arm automation: ride sliders for one loop, it replays forever"}
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
            title={playing ? "Automation looping — click to hold" : "Resume the recorded loop"}
            className="min-h-[24px] rounded-md border px-2 font-mono text-[9px] uppercase tracking-[0.15em]"
            style={playing ? { borderColor: "var(--inst-warn)", color: "var(--inst-warn)" } : { borderColor: "var(--inst-line)", color: "var(--inst-dim)" }}
          >{playing ? `▶ ${auto.laneCount()} lane${auto.laneCount() > 1 ? "s" : ""}` : "▶ play"}</button>
          <button
            onClick={() => auto.clear()}
            title="Clear the recorded automation"
            className="min-h-[24px] rounded-md border border-[var(--inst-line)] px-1.5 font-mono text-[9px] text-[var(--inst-faint)] hover:text-[var(--inst-signal)]"
          >✕</button>
        </>
      )}
    </div>
  );
}

export default function StudioPage() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();
  const [pass, setPass] = useState(5);
  const [mode, setMode] = useState<StageMode>("phrase");
  const [ws, setWs] = useState<Workspace>("DIRECT");
  const [embed, setEmbed] = useState(false);
  const [wantDraft, setWantDraft] = useState(false);
  const [wantAutoplay, setWantAutoplay] = useState(false);
  const [draftPlanet, setDraftPlanet] = useState<Track["planet"] | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [autoLaunched, setAutoLaunched] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("x1c7-lyric-style") as StageMode | null;
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
    const savedWs = localStorage.getItem("x1c7-studio-ws") as Workspace | null;
    if (savedWs === "SHOW" || savedWs === "DIRECT" || savedWs === "SETUP") setWs(savedWs);
    const q = new URLSearchParams(window.location.search);
    setEmbed(q.get("embed") === "1");
    setWantAutoplay(q.get("autoplay") === "1");
    setWantDraft(q.get("draft") === "1" && isPrivateHost(window.location.hostname));
    const p = Number(q.get("pass"));
    if ([1, 2, 3, 4, 5, 6].includes(p)) setPass(p);
    const m = q.get("mode") as StageMode | null;
    if (m && MODES.some((x) => x.id === m)) setMode(m);
  }, []);
  const pickWs = (w: Workspace) => { setWs(w); localStorage.setItem("x1c7-studio-ws", w); };
  const pickMode = (m: StageMode) => { setMode(m); localStorage.setItem("x1c7-lyric-style", m); };

  const timed = useMemo(() => tracks.filter(canPerform), [tracks]);
  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (selectedId) return;
    const linked = new URLSearchParams(window.location.search).get("track");
    if (linked && tracks.some((t) => t.id === linked)) setSelectedId(linked);
    else if (timed.length) setSelectedId(timed[0].id);
  }, [selectedId, timed, tracks]);
  const selected = tracks.find((t) => t.id === selectedId);

  useEffect(() => {
    if (!wantDraft || !selectedId) { setDraftReady(!wantDraft); return; }
    let on = true;
    setDraftReady(false);
    supabase.from("tracks").select("planet_draft").eq("id", selectedId).then(({ data }) => {
      if (!on) return;
      setDraftPlanet(((data?.[0] as { planet_draft?: Track["planet"] } | undefined)?.planet_draft) ?? null);
      setDraftReady(true);
    });
    return () => { on = false; };
  }, [wantDraft, selectedId]);

  const launch = (t: Track) => {
    const show = wantDraft && t.id === selectedId && draftPlanet ? { ...t, planet: draftPlanet } : t;
    playTrack(show, tracks);
  };
  useEffect(() => {
    if (!wantAutoplay || autoLaunched || !selected || !canPerform(selected) || !draftReady) return;
    setAutoLaunched(true);
    launch(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAutoplay, selected, draftReady, autoLaunched]);

  const analysis = currentTrack?.planet?.analysis;
  const live = canPerform(currentTrack);
  const direct = ws === "DIRECT" && live && !embed;

  // ── SETUP body (also the pre-launch view: pick, then perform) ─────────────
  const setupBody = (
    <div className="relative z-10 mx-auto mt-6 w-full max-w-lg rounded-2xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] p-5 backdrop-blur-md">
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">Song</div>
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]">
        <optgroup label="Planets (word-timed)">
          {timed.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </optgroup>
        <optgroup label="No word data yet">
          {tracks.filter((t) => !canPerform(t)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </optgroup>
      </select>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">Pass</div>
          <select value={pass} onChange={(e) => setPass(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]">
            {PASSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]">View</div>
          <select value={mode} onChange={(e) => pickMode(e.target.value as StageMode)}
            className="mt-1.5 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]">
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>
      {selected && canPerform(selected) && (
        <button
          onClick={() => launch(selected)}
          className="mt-5 w-full rounded-full py-3 font-display text-sm font-black uppercase tracking-[0.2em] text-black transition hover:scale-[1.02]"
          style={{ background: "var(--inst-plasma)" }}
        >▶ Launch “{selected.title}”</button>
      )}
      {selected && !canPerform(selected) && (
        <p className="mt-4 font-mono text-[10px] uppercase leading-5 tracking-wider text-[var(--inst-dim)]">
          “{selected.title}” has no word-timed lyrics yet — run it through the aligner first.
        </p>
      )}
      {analysis && (
        <p className="mt-4 font-mono text-[9px] uppercase leading-5 tracking-wider text-[var(--inst-faint)]">
          🪐 {analysis.overallMood} · {analysis.themes.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  );

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--theme-primary) 16%, transparent), transparent 60%)," +
          "linear-gradient(160deg, var(--theme-bg), #05030b)",
      }}
    >
      {/* ── top bar: identity · workspaces · telemetry ── */}
      {!embed && (
        <header className="relative z-20 flex h-12 flex-none items-center gap-4 border-b border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_85%,transparent)] px-4 backdrop-blur-md">
          <span className="font-display text-xs font-black uppercase tracking-[0.3em] text-white">Studio</span>
          <div className="flex overflow-hidden rounded-md border border-[var(--inst-line)]">
            {(["SHOW", "DIRECT", "SETUP"] as Workspace[]).map((w) => (
              <button
                key={w}
                onClick={() => pickWs(w)}
                className="border-l border-[var(--inst-line)] px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] first:border-l-0"
                style={ws === w
                  ? { background: "var(--inst-plasma)", color: "#001016", fontWeight: 700 }
                  : { color: "var(--inst-dim)" }}
              >{w}</button>
            ))}
          </div>
          <KineticTelemetry className="ml-auto" />
          <Link href="/music" className="rounded-lg border border-[var(--inst-line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--inst-dim)] hover:text-white">Exit</Link>
        </header>
      )}

      {/* ── body ── */}
      {!live || embed ? (
        <div className="relative z-10 flex flex-1 items-start justify-center overflow-y-auto px-4 pb-28">
          {live && embed ? <KineticStage track={currentTrack!} pass={pass} mode={mode} /> : setupBody}
          {currentTrack && !isPlaying && !live && (
            <p className="absolute bottom-24 font-mono text-[10px] uppercase tracking-wider text-white/30">Use the player bar below to play.</p>
          )}
        </div>
      ) : ws === "SETUP" ? (
        <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">{setupBody}</div>
      ) : (
        <>
          <div className="relative z-10 flex min-h-0 flex-1">
            {direct && (
              // pt-20 clears the site's fixed BEAT badge, which floats top-left
              <aside className="z-10 flex w-[212px] flex-none flex-col gap-5 overflow-y-auto border-r border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] p-3 pt-20 backdrop-blur-md">
                <LooksPads />
                <ScenesRail />
              </aside>
            )}
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <KineticStage track={currentTrack!} pass={pass} mode={mode} />
            </div>
            {direct && (
              <aside className="z-10 w-[300px] flex-none overflow-y-auto border-l border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] backdrop-blur-md">
                <KineticParamPanel groups={["BACKDROP", "LFO 1", "LFO 2", "LFO 3", "FOLLOW 1", "FOLLOW 2", "FOLLOW 3"]} className="rounded-none border-0 bg-transparent" />
              </aside>
            )}
          </div>
          {direct && <div className="relative z-10 flex-none pb-[76px]"><DeckStrip /></div>}
          {ws === "SHOW" && <div className="h-[76px] flex-none" />}
        </>
      )}
    </main>
  );
}
