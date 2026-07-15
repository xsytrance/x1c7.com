"use client";

// THE STUDIO — the instrument, 2026-07 redesign: one guided flow instead of
// workspaces. The Marquee (pick a song, three plain choices, one big button)
// leads to the stage; an easy play surface (Vibes · Backdrops · Finger paint
// · Surprise me) covers the core, and the whole pro cockpit — decks, loop
// recorder, shader loader, the param registry — waits behind one persistent
// "I know what I'm doing" switch. Helper copy everywhere; jargon only in pro.
//
// Contracts kept: /studio?embed=1 (the Planet Studio WebView) renders the
// bare stage exactly as before, and ?pass= ?mode= ?track= ?draft= ?autoplay=
// all still steer the engine.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { KineticStage, canPerform, MODES, type StageMode } from "@/components/KineticStage";
import { KineticParamPanel } from "@/components/KineticParamPanel";
import { KineticTelemetry } from "@/components/KineticTelemetry";
import { P } from "@/lib/engine/params";
import { BottomSheet, type SheetSnap } from "@/components/mobile/BottomSheet";
import { XYPad } from "@/components/mobile/XYPad";
import { VibeDial } from "@/components/mobile/VibeDial";
import { LookStrip } from "@/components/mobile/LookStrip";
import { useStageGestures } from "@/lib/useStageGestures";
import { supabase } from "@/lib/supabase";
import { isPrivateHost } from "@/lib/privateHost";
import type { Track } from "@/data/tracks";
import { Marquee } from "@/components/studio/Marquee";
import { VibeShelf, BackdropShelf, SurpriseButton, HintToast } from "@/components/studio/EasyDock";
import { VibePads, BackdropRail, DeckStrip, LyricsInbox, BeatJewel } from "@/components/studio/pro";
import { COPY, LS, VISUAL_LEVELS, passToLevel } from "@/components/studio/copy";

// the engine's native sizes, for the pro header select
const PASSES = [
  { id: 6, label: "Pass 6 · dynamic+" },
  { id: 5, label: "Pass 5 · cinematic" },
  { id: 4, label: "Pass 4 · living backdrop" },
  { id: 3, label: "Pass 3 · satellite" },
  { id: 2, label: "Pass 2 · satellite" },
  { id: 1, label: "Pass 1 · satellite" },
];

// easy pocket tabs (mobile portrait): the wheel, the pad, the backdrops, depth
type EasyTab = "VIBES" | "PAINT" | "SCENE" | "MORE";
const EASY_TABS: { id: EasyTab; label: string }[] = [
  { id: "VIBES", label: "vibes" },
  { id: "PAINT", label: "paint" },
  { id: "SCENE", label: "backdrop" },
  { id: "MORE", label: "more" },
];
// pro pocket tabs (unchanged from the pocket instrument v2)
type ProTab = "PLAY" | "XY" | "DIAL" | "MORE";
const PRO_TABS: ProTab[] = ["PLAY", "XY", "DIAL", "MORE"];

export default function StudioPage() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();
  const [pass, setPass] = useState(5);
  const [mode, setMode] = useState<StageMode>("phrase");
  const [pro, setPro] = useState(false);
  const [showSetup, setShowSetup] = useState(false); // "Song" button re-opens the Marquee over a live stage
  const [hideUI, setHideUI] = useState(false); // "Just watch"
  const [tab, setTab] = useState<EasyTab>("VIBES");
  const [proTab, setProTab] = useState<ProTab>("PLAY");
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [paint, setPaint] = useState(false); // desktop finger-paint overlay
  const [coarse, setCoarse] = useState(false);
  const [mobileLandscape, setMobileLandscape] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [ownerHost, setOwnerHost] = useState(false);
  const [wantDraft, setWantDraft] = useState(false);
  const [wantAutoplay, setWantAutoplay] = useState(false);
  const [draftPlanet, setDraftPlanet] = useState<Track["planet"] | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [autoLaunched, setAutoLaunched] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS.lyricStyle) as StageMode | null;
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
    setPro(localStorage.getItem(LS.pro) === "1");
    const savedLevel = VISUAL_LEVELS.find((v) => v.id === localStorage.getItem(LS.visualLevel));
    if (savedLevel) setPass(savedLevel.pass);
    const q = new URLSearchParams(window.location.search);
    setEmbed(q.get("embed") === "1");
    setWantAutoplay(q.get("autoplay") === "1");
    setWantDraft(q.get("draft") === "1" && isPrivateHost(window.location.hostname));
    setOwnerHost(isPrivateHost(window.location.hostname));
    if (q.get("pro") === "1") setPro(true);
    // Mobile render profile: the studio carries the FULL engine on phones
    // (forceBackdrop below) — pay for it in resolution, not features. The
    // STARTING scale follows viewport size (an S24 Ultra earns more pixels
    // than an iPhone 12); the frame governor owns the rest from there.
    if (window.matchMedia("(pointer: coarse)").matches) {
      const shortSide = Math.min(window.screen.width, window.screen.height);
      P.set("backdrop.renderScale", shortSide >= 480 ? 0.5 : shortSide >= 410 ? 0.42 : 0.35, "code");
      P.set("backdrop.ghostFade", 0.965, "code"); // shorter ghost tails on small GPUs
    }
    const p = Number(q.get("pass"));
    if ([1, 2, 3, 4, 5, 6].includes(p)) setPass(p);
    const m = q.get("mode") as StageMode | null;
    if (m && MODES.some((x) => x.id === m)) setMode(m);
  }, []);
  // pointer/orientation facts, kept live (fold a phone, rotate a tablet…)
  useEffect(() => {
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const mqLand = window.matchMedia("(orientation: landscape) and (pointer: coarse)");
    const sync = () => { setCoarse(mqCoarse.matches); setMobileLandscape(mqLand.matches); };
    sync();
    mqCoarse.addEventListener("change", sync);
    mqLand.addEventListener("change", sync);
    return () => { mqCoarse.removeEventListener("change", sync); mqLand.removeEventListener("change", sync); };
  }, []);

  const pickPro = (on: boolean) => { setPro(on); localStorage.setItem(LS.pro, on ? "1" : "0"); };
  const pickMode = (m: StageMode) => { setMode(m); localStorage.setItem(LS.lyricStyle, m); };
  const pickLevel = (id: (typeof VISUAL_LEVELS)[number]["id"]) => {
    const lvl = VISUAL_LEVELS.find((v) => v.id === id)!;
    setPass(lvl.pass);
    localStorage.setItem(LS.visualLevel, id);
  };

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

  const launch = useCallback((t: Track) => {
    const show = wantDraft && t.id === selectedId && draftPlanet ? { ...t, planet: draftPlanet } : t;
    playTrack(show, tracks);
    setShowSetup(false);
    setHideUI(false);
  }, [wantDraft, selectedId, draftPlanet, playTrack, tracks]);
  useEffect(() => {
    if (!wantAutoplay || autoLaunched || !selected || !canPerform(selected) || !draftReady) return;
    setAutoLaunched(true);
    launch(selected);
  }, [wantAutoplay, selected, draftReady, autoLaunched, launch]);

  const live = canPerform(currentTrack);
  const onStage = live && !showSetup;

  // stage-background gestures (mobile): swipe ←/→ pins prev/next backdrop,
  // two-finger tap releases to AUTO, swipe ↑/↓ nudges intensity.
  const { attach: attachStageGestures, toast: gestureToast } = useStageGestures(coarse && live && !embed);
  const pickTab = <T,>(t: T, cur: T, set: (t: T) => void, fullTabs: T[]) => {
    if (t === cur && snap !== "peek") { setSnap("peek"); return; } // re-tap the live tab = drop
    set(t);
    if (fullTabs.includes(t)) setSnap("full");
    else if (snap === "peek") setSnap("half");
  };

  // ── the Marquee (start screen / song change) ──────────────────────────────
  const marquee = (
    <Marquee
      tracks={tracks}
      selectedId={selectedId}
      onSelect={setSelectedId}
      level={passToLevel(pass).id}
      onLevel={pickLevel}
      lyricStyle={mode}
      onLyricStyle={pickMode}
      onStart={() => selected && launch(selected)}
      mood={selected?.planet?.analysis?.overallMood ?? null}
      onPro={() => pickPro(!pro)}
    >
      {ownerHost && <LyricsInbox />}
    </Marquee>
  );

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--theme-primary) 16%, transparent), transparent 60%)," +
          "linear-gradient(160deg, var(--theme-bg), #05030b)",
      }}
    >
      {/* ── top bar: identity · song · watch/play · pro · exit ── */}
      {!embed && (
        <header className="relative z-20 flex h-12 flex-none items-center gap-2 border-b border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_85%,transparent)] px-3 backdrop-blur-md sm:gap-3 sm:px-4">
          <span className="font-display text-xs font-black uppercase tracking-[0.3em] text-white">Studio</span>
          {live && (
            <button
              onClick={() => setShowSetup((s) => !s)}
              title="Change the song, visuals or lyric style"
              className="flex min-h-[36px] max-w-[38vw] items-center gap-1.5 truncate rounded-lg border px-2.5 font-mono text-[10px] uppercase tracking-wider sm:max-w-[240px]"
              style={showSetup ? { borderColor: "var(--inst-plasma)", color: "var(--inst-plasma)" } : { borderColor: "var(--inst-line)", color: "var(--inst-dim)" }}
            >
              ♪ <span className="truncate normal-case tracking-normal">{currentTrack?.title ?? COPY.changeSong}</span>
            </button>
          )}
          {/* pro keeps the engine's native size + style selects at hand */}
          {pro && !coarse && live && (
            <div className="hidden items-center gap-1.5 lg:flex">
              <select value={pass} onChange={(e) => setPass(Number(e.target.value))}
                className="h-8 rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] px-1.5 font-mono text-[10px] text-[var(--inst-dim)] outline-none focus:border-[var(--inst-plasma)]">
                {PASSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <select value={mode} onChange={(e) => pickMode(e.target.value as StageMode)}
                className="h-8 rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s2)] px-1.5 font-mono text-[10px] text-[var(--inst-dim)] outline-none focus:border-[var(--inst-plasma)]">
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          )}
          {pro
            ? <KineticTelemetry className="ml-auto hidden md:flex" />
            : <span className="ml-auto hidden md:flex"><BeatJewel /></span>}
          <BeatJewel className="ml-auto md:hidden" />
          {onStage && !hideUI && (
            <button
              onClick={() => { setHideUI(true); setSnap("peek"); }}
              title="Hide every control — just the show"
              className="min-h-[36px] whitespace-nowrap rounded-lg border border-[var(--inst-line)] px-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--inst-dim)] hover:text-white"
            >◉<span className="hidden sm:inline"> {COPY.hideControls}</span></button>
          )}
          <button
            onClick={() => pickPro(!pro)}
            title={pro ? "Back to the simple studio" : `${COPY.proInvite} — ${COPY.proInviteBlurb}`}
            className="min-h-[36px] rounded-lg border px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={pro
              ? { borderColor: "var(--inst-warn)", color: "var(--inst-warn)", background: "color-mix(in srgb, var(--inst-warn) 9%, transparent)" }
              : { borderColor: "var(--inst-line)", color: "var(--inst-faint)" }}
          >pro</button>
          <Link href="/music" className="min-h-[36px] rounded-lg border border-[var(--inst-line)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--inst-dim)] hover:text-white">Exit</Link>
        </header>
      )}

      {/* ── body ── */}
      {!live || embed ? (
        <div className="relative z-10 flex flex-1 items-start justify-center overflow-y-auto px-4 pb-28">
          {live && embed ? <KineticStage track={currentTrack!} pass={pass} mode={mode} /> : marquee}
          {currentTrack && !isPlaying && !live && (
            <p className="absolute bottom-24 font-mono text-[10px] uppercase tracking-wider text-white/30">Use the player bar below to play.</p>
          )}
        </div>
      ) : showSetup ? (
        <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">{marquee}</div>
      ) : (
        <>
          <div className="relative z-10 flex min-h-0 flex-1">
            {/* ── PRO rails (desktop) ── */}
            {pro && !hideUI && (
              // pt-20 clears the site's fixed BEAT badge, which floats top-left
              <aside className="z-10 hidden w-[212px] flex-none flex-col gap-5 overflow-y-auto border-r border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] p-3 pt-20 backdrop-blur-md md:flex">
                <VibePads />
                <BackdropRail />
              </aside>
            )}
            {/* landscape phone, pro = mini-desktop: the same rails, thumb-width */}
            {pro && !hideUI && mobileLandscape && (
              <aside
                className="z-10 flex w-[180px] flex-none flex-col gap-5 overflow-y-auto border-r border-[var(--inst-line)] p-3 pt-16 md:hidden"
                style={{ background: "rgba(12,8,22,0.92)", paddingBottom: "calc(var(--player-h) + 12px)" }}
              >
                <VibePads />
                <BackdropRail />
              </aside>
            )}

            <div
              ref={(el) => { attachStageGestures(el); }}
              className="relative min-w-0 flex-1 overflow-hidden"
            >
              <KineticStage track={currentTrack!} pass={pass} mode={mode} forceBackdrop />
              {!hideUI && <HintToast coarse={coarse} />}
              {/* gesture toast — the swipe's answer, worn near the top of the stage */}
              {gestureToast && (
                <div
                  className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--inst-line)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--inst-plasma)] md:hidden"
                  style={{ background: "rgba(12,8,22,0.92)" }}
                  data-gesture-toast
                >{gestureToast}</div>
              )}
              {/* "Just watch" leaves one quiet way back */}
              {hideUI && (
                <button
                  onClick={() => setHideUI(false)}
                  className="absolute bottom-4 right-4 z-20 rounded-full border border-[var(--inst-line)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--inst-dim)] transition hover:text-white"
                  style={{ background: "rgba(12,8,22,0.7)" }}
                >✨ {COPY.showControls}</button>
              )}
            </div>

            {pro && !hideUI && (
              <aside className="z-10 hidden w-[300px] flex-none overflow-y-auto border-l border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] backdrop-blur-md md:block">
                <KineticParamPanel groups={["BACKDROP", "LFO 1", "LFO 2", "LFO 3", "FOLLOW 1", "FOLLOW 2", "FOLLOW 3"]} className="rounded-none border-0 bg-transparent" />
              </aside>
            )}
            {pro && !hideUI && mobileLandscape && (
              <aside
                className="z-10 block w-[260px] flex-none overflow-y-auto border-l border-[var(--inst-line)] md:hidden"
                style={{ background: "rgba(12,8,22,0.92)", paddingBottom: "calc(var(--player-h) + 12px)" }}
              >
                <KineticParamPanel touch groups={["BACKDROP", "LFO 1", "FOLLOW 1"]} className="rounded-none border-0 bg-transparent backdrop-blur-none" />
              </aside>
            )}
          </div>
          {pro && !hideUI && <div className="relative z-10 hidden flex-none pb-[76px] md:block"><DeckStrip /></div>}
          {(hideUI || !pro) && <div className="hidden h-[76px] flex-none md:block" />}

          {/* ── THE EASY DOCK (desktop + landscape phones): one glass shelf ── */}
          {!pro && !hideUI && (!coarse || mobileLandscape) && (
            <div
              className="fixed inset-x-0 z-30 mx-auto w-full max-w-3xl px-4"
              style={{ bottom: "calc(var(--player-h) + 14px)" }}
            >
              {paint && (
                <div className="mb-3 ml-auto w-[300px] rounded-2xl border border-[var(--inst-line)] p-3" style={{ background: "rgba(12,8,22,0.94)" }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]">{COPY.paintLabel}</span>
                    <button onClick={() => setPaint(false)} className="text-[11px] text-[var(--inst-faint)] hover:text-white">✕</button>
                  </div>
                  <p className="mb-2 mt-0.5 text-[10.5px] text-[var(--inst-faint)]">{COPY.paintHint}</p>
                  <XYPad />
                </div>
              )}
              <div className="rounded-2xl border border-[var(--inst-line)] p-4 backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--inst-s1) 88%, transparent)" }}>
                <VibeShelf hint={false} />
                <BackdropShelf hint={false} className="mt-3" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SurpriseButton />
                  <button
                    onClick={() => setPaint((v) => !v)}
                    className="min-h-[44px] rounded-xl border px-4 text-[12px] font-bold uppercase tracking-[0.14em]"
                    style={paint
                      ? { borderColor: "var(--inst-plasma)", color: "var(--inst-plasma)", background: "color-mix(in srgb, var(--inst-plasma) 9%, transparent)" }
                      : { borderColor: "var(--inst-line)", color: "var(--inst-dim)" }}
                  >🖌 {COPY.paintLabel}</button>
                  <span className="ml-auto hidden text-[11px] text-[var(--inst-faint)] sm:block">
                    tap a vibe · hold a backdrop · nothing here can break the song
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── THE POCKET STUDIO (mobile portrait) ── */}
          {!embed && !hideUI && coarse && !mobileLandscape && (
            <div className="md:hidden">
              <div className="fixed inset-x-0 z-30" style={{ bottom: "calc(var(--player-h) + 72px)" }}>
                <LookStrip />
              </div>
              <BottomSheet
                snap={snap}
                onSnap={setSnap}
                peek={
                  <div className="px-3">
                    <div className="flex h-[46px] w-full overflow-hidden rounded-lg border border-[var(--inst-line)]">
                      {pro
                        ? PRO_TABS.map((t) => (
                          <button
                            key={t}
                            onClick={() => pickTab(t, proTab, setProTab, ["MORE"])}
                            className="min-h-full min-w-[52px] flex-1 border-l border-[var(--inst-line)] font-mono text-[9px] uppercase tracking-[0.25em] first:border-l-0"
                            style={proTab === t && snap !== "peek"
                              ? { color: "var(--inst-plasma)", background: "color-mix(in srgb, var(--inst-plasma) 7%, transparent)" }
                              : { color: "var(--inst-dim)" }}
                            data-pocket-tab={t}
                          >{t}</button>
                        ))
                        : EASY_TABS.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => pickTab(t.id, tab, setTab, ["MORE", "SCENE"])}
                            className="min-h-full min-w-[52px] flex-1 border-l border-[var(--inst-line)] text-[11px] font-semibold tracking-wide first:border-l-0"
                            style={tab === t.id && snap !== "peek"
                              ? { color: "var(--inst-plasma)", background: "color-mix(in srgb, var(--inst-plasma) 7%, transparent)" }
                              : { color: "var(--inst-dim)" }}
                            data-pocket-tab={t.id}
                          >{t.label}</button>
                        ))}
                    </div>
                  </div>
                }
              >
                {(s) => (
                  // below peek the body is off-screen — skip the heavy children
                  s === "peek" ? null : pro ? (
                    <div className="pt-3">
                      {proTab === "PLAY" && <DeckStrip bare />}
                      {proTab === "XY" && <XYPad />}
                      {proTab === "DIAL" && <VibeDial className="pt-2" />}
                      {proTab === "MORE" && (
                        <div className="flex flex-col gap-5">
                          <BackdropRail />
                          <KineticParamPanel touch groups={["BACKDROP", "LFO 1", "FOLLOW 1"]} className="rounded-none border-0 bg-transparent p-0 backdrop-blur-none" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-3">
                      {tab === "VIBES" && (
                        <div>
                          <p className="px-1 pb-1 text-center text-[11px] text-[var(--inst-faint)]">
                            spin the wheel — every notch is a different feeling
                          </p>
                          <VibeDial className="pt-1" />
                        </div>
                      )}
                      {tab === "PAINT" && (
                        <div>
                          <p className="px-1 pb-2 text-[11px] text-[var(--inst-faint)]">{COPY.paintHint}</p>
                          <XYPad />
                        </div>
                      )}
                      {tab === "SCENE" && <BackdropShelf />}
                      {tab === "MORE" && (
                        <div className="flex flex-col gap-4 pb-4">
                          <div className="flex gap-2">
                            <SurpriseButton className="flex-1" />
                            <button
                              onClick={() => { setHideUI(true); setSnap("peek"); }}
                              className="min-h-[44px] flex-1 rounded-xl border border-[var(--inst-line)] px-4 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--inst-dim)]"
                            >◉ {COPY.hideControls}</button>
                          </div>
                          <button
                            onClick={() => { setShowSetup(true); setSnap("peek"); }}
                            className="min-h-[44px] rounded-xl border border-[var(--inst-line)] px-4 text-left text-[12px] font-semibold text-[var(--inst-dim)]"
                          >♪ Change the song, visuals or lyric style</button>
                          <VibeShelf />
                          <button
                            onClick={() => { pickPro(true); setSnap("peek"); }}
                            className="text-left font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--inst-faint)]"
                          >
                            {COPY.proInvite} → <span className="normal-case tracking-normal opacity-70">{COPY.proInviteBlurb}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </BottomSheet>
            </div>
          )}
        </>
      )}
    </main>
  );
}
