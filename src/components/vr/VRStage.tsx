"use client";

// XRStage Phase 0 — the lyric show as a PLACE. The same planet data the 2D
// engine performs (word timings, sections, keyword art, stems senses) drawn
// as a world around the listener: words arrive through space on the R2
// sphere, the paintings orbit as a floating gallery, kicks punch the light,
// the 808 breathes the whole scene. Runs flat with orbit controls; the
// Enter VR button (Quest browser) makes it immersive.

import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Stars, Sparkles, OrbitControls } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { activeWordIndex } from "@/lib/lyrics";
import { activeSection, type PlanetSection } from "@/lib/planet";
import { loadStems, envAt, OnsetTracker, type StemData } from "@/lib/stemSense";
import { clean } from "@/components/KineticStage";
import type { Track } from "@/data/tracks";

// R2 low-discrepancy sequence → points on the sphere around the listener.
const PLASTIC = 1.32471795724474602596;
const R2X = 1 / PLASTIC, R2Y = 1 / (PLASTIC * PLASTIC);
function spherePos(i: number, r = 5): [number, number, number] {
  const az = (((0.5 + i * R2X) % 1) * 1.7 - 0.85) * Math.PI;      // ±153° — mostly ahead
  const el = (((0.5 + i * R2Y) % 1) * 0.9 - 0.35);                 // slightly below to high
  return [r * Math.sin(az) * Math.cos(el), 1.6 + r * Math.sin(el), -r * Math.cos(az) * Math.cos(el)];
}

type Residue = { key: number; word: string; pos: [number, number, number]; bornAt: number };

function Show({ track }: { track: Track }) {
  const { getCurrentTime } = useMusicPlayer();
  const words = useMemo(() => track.lyricsSynced?.words ?? [], [track]);
  const sections = track.planet?.analysis?.sections;
  const art = track.planet?.assets?.keywords ?? {};
  const sectionArt = track.planet?.assets?.sections ?? {};
  const palette = useMemo(() => {
    const p = track.planet?.analysis?.palette;
    return Array.isArray(p) && p.length >= 2 ? p : [track.color, "#8b7bff", "#43f7ff"];
  }, [track]);

  const [idx, setIdx] = useState(-1);
  const [residue, setResidue] = useState<Residue[]>([]);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [section, setSection] = useState<PlanetSection | null>(null);
  const lastIdx = useRef(-1);
  const lastSec = useRef("");

  // Stem senses — same measured hearing as the 2D engine.
  const stems = useRef<StemData | null>(null);
  const trk = useRef<{ kick: OnsetTracker; beat: OnsetTracker } | null>(null);
  const kick = useRef(0);
  const lastT = useRef(0);
  useEffect(() => {
    stems.current = null; trk.current = null;
    const url = (track.planet?.assets as { stems?: string } | undefined)?.stems;
    if (!url) return;
    let on = true;
    loadStems(url).then((d) => {
      if (!on || !d) return;
      stems.current = d;
      trk.current = { kick: new OnsetTracker(d.kicks), beat: new OnsetTracker(d.beats) };
    });
    return () => { on = false; };
  }, [track]);

  const lightRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);
  const fogRef = useRef<THREE.FogExp2 | null>(null);

  // The fog is created imperatively in the frame loop — clear it off the
  // shared scene on unmount or it survives into the next show.
  const scene = useThree((s) => s.scene);
  useEffect(() => () => { scene.fog = null; fogRef.current = null; }, [scene]);

  useFrame(({ scene }) => {
    const t = getCurrentTime();
    const dt = Math.max(0, Math.min(0.1, t - lastT.current));
    lastT.current = t;
    const i = activeWordIndex(words, t);
    if (i !== lastIdx.current) {
      const prev = lastIdx.current;
      lastIdx.current = i;
      setIdx(i);
      // outgoing word joins the constellation
      if (prev >= 0 && words[prev]) {
        setResidue((old) => [...old.slice(-6), { key: prev, word: clean(words[prev].w), pos: spherePos(prev), bornAt: t }]);
      }
      // keyword painting takes the gallery
      if (i >= 0) {
        const w = clean(words[i].w).toLowerCase();
        if (art[w]) setArtUrl(art[w]);
      }
    }
    if (sections?.length) {
      const s = activeSection(sections, t);
      const key = s ? `${s.name}${s.start}` : "";
      if (key !== lastSec.current) {
        lastSec.current = key;
        setSection(s);
        if (s) {
          const mood = sectionArt[s.emotion.toLowerCase()];
          if (mood) setArtUrl(mood);
          const c = new THREE.Color(s.colorHint || "#221133");
          if (!fogRef.current) { fogRef.current = new THREE.FogExp2(c, 0.045); scene.fog = fogRef.current; }
          else fogRef.current.color.lerp(c.multiplyScalar(0.35), 0.8);
        }
      }
    }
    // stem senses: kicks punch the light, the 808 breathes the stage
    if (stems.current && trk.current) {
      kick.current = Math.max(0, kick.current - dt * 5);
      if (trk.current.kick.consume(t) > 0) kick.current = 1;
      const bass = envAt(stems.current, "bass", t);
      if (lightRef.current) lightRef.current.intensity = 6 + kick.current * 26 + bass * 8;
      if (groupRef.current) {
        const s = 1 + bass * 0.05 + kick.current * 0.03;
        groupRef.current.scale.setScalar(s);
      }
    }
  });

  const shown = idx >= 0 && words[idx] ? clean(words[idx].w) : "";
  const wordPos = idx >= 0 ? spherePos(idx, 4.2) : ([0, 1.6, -4] as [number, number, number]);

  return (
    <group ref={groupRef}>
      {/* the sky */}
      <Stars radius={60} depth={40} count={2400} factor={3.2} saturation={0.4} fade speed={0.6} />
      <Sparkles count={180} scale={[14, 8, 14]} size={3.5} speed={0.35} color={palette[1]} position={[0, 2.5, 0]} />
      <ambientLight intensity={0.5} color={section?.colorHint || palette[0]} />
      <pointLight ref={lightRef} position={[0, 3.2, -1]} intensity={8} color={palette[0]} distance={30} decay={1.6} />

      {/* the gallery — the song's paintings floating around the stage */}
      <Gallery url={artUrl} />

      {/* the LIVE word — arrives at its R2 point in space */}
      {shown && (
        <WordBillboard key={idx} word={shown} pos={wordPos} color={palette[0]} big />
      )}
      {/* the constellation — recent words linger in the dark */}
      {residue.map((r) => (
        <WordBillboard key={`r${r.key}`} word={r.word} pos={r.pos} color={palette[2] ?? "#ffffff"} faded />
      ))}

      {/* the floor — a ring stage under your feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.4, 1.5, 64]} />
        <meshBasicMaterial color={palette[0]} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[24, 48]} />
        <meshStandardMaterial color="#07040f" roughness={0.9} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** A lyric word floating in space, always facing the listener. */
function WordBillboard({ word, pos, color, big = false, faded = false }: {
  word: string; pos: [number, number, number]; color: string; big?: boolean; faded?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef(0);
  useFrame(({ camera, clock }) => {
    const g = ref.current;
    if (!g) return;
    if (!born.current) born.current = clock.elapsedTime;
    g.lookAt(camera.position);
    // scale-in entrance
    const age = clock.elapsedTime - born.current;
    const s = big ? Math.min(1, age * 5) : 1;
    g.scale.setScalar(faded ? 0.55 : s);
  });
  const size = big ? Math.max(0.35, Math.min(1.1, 4.4 / Math.max(3, word.length))) : 0.22;
  return (
    <group ref={ref} position={pos}>
      <Text
        fontSize={size}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={size * 0.04}
        outlineColor="#05030b"
        fillOpacity={faded ? 0.35 : 1}
      >
        {word.toUpperCase()}
      </Text>
    </group>
  );
}

/** The floating gallery: the current painting on a big curved panel ahead,
 * crossfading whenever the song calls a new image. */
function Gallery({ url }: { url: string | null }) {
  const [layers, setLayers] = useState<{ url: string; key: number }[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    if (!url) return;
    setLayers((old) => [...old.slice(-1), { url, key: ++seq.current }]);
  }, [url]);
  return (
    <group position={[0, 2.6, -9]}>
      {layers.map((l, i) => (
        <ArtPanel key={l.key} url={l.url} fadeIn={i === layers.length - 1} />
      ))}
    </group>
  );
}

function ArtPanel({ url, fadeIn }: { url: string; fadeIn: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let on = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(url, (t) => {
      if (!on) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      loaded = t;
      setTex(t);
    });
    // R3F only auto-disposes objects it created — imperatively-loaded textures
    // must be freed by hand or GPU memory grows with every painting.
    return () => { on = false; loaded?.dispose(); };
  }, [url]);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const target = fadeIn ? 0.85 : 0;
    m.opacity += (target - m.opacity) * Math.min(1, dt * 2.2);
  });
  if (!tex) return null;
  return (
    <mesh>
      <planeGeometry args={[11, 7.9]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// One XR store for the session (module scope is safe: this file is client-only).
const xrStore = createXRStore({ hand: true, controller: true });

/** The Enter VR button — exported from this client-only module so the page
 * never evaluates WebXR code on the server. */
export function EnterVR() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    const check = navigator.xr
      ? navigator.xr.isSessionSupported("immersive-vr").catch(() => false)
      : Promise.resolve(false);
    check.then((ok) => { if (on) setSupported(ok); });
    return () => { on = false; };
  }, []);
  return (
    <button
      onClick={() => xrStore.enterVR()}
      disabled={!supported}
      className="rounded-full border-2 px-8 py-4 font-display text-lg font-black uppercase tracking-[0.2em] text-white backdrop-blur transition hover:scale-105 disabled:opacity-50"
      style={{
        borderColor: "var(--theme-primary)",
        background: "color-mix(in srgb, var(--theme-primary) 18%, rgba(0,0,0,0.6))",
        boxShadow: "0 0 30px color-mix(in srgb, var(--theme-primary) 50%, transparent)",
      }}
    >
      {supported === false ? "🥽 VR needs a headset browser" : "🥽 Enter VR"}
    </button>
  );
}

/** A useFrame/loader throw inside the Canvas otherwise takes down the whole
 * route — catch it and show a quiet fallback instead. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex items-center justify-center text-sm uppercase tracking-[0.2em] text-white/50">
          the stage went dark — reload to re-enter
        </div>
      );
    }
    return this.props.children;
  }
}

export function VRStage({ track }: { track: Track }) {
  return (
    <StageBoundary>
    <Canvas
      camera={{ position: [0, 1.6, 0.1], fov: 70 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#05030b"]} />
      <XR store={xrStore}>
        <Show track={track} />
      </XR>
      <OrbitControls target={[0, 1.6, -3]} enablePan={false} maxDistance={10} />
    </Canvas>
    </StageBoundary>
  );
}
