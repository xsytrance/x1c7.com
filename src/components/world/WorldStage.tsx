"use client";

// ═══════════════════════════════════════════════════════════════════════════
// WORLD STAGE — the corridor as a PLACE, with the lyric living inside it.
//
// The shader corridor draws perspective per pixel; nothing is actually there,
// so a word can only ever be composited over it in a different coordinate
// system. Every 3D bug in this engine came from that split: perspective
// flattened by a wrapper, keyframes in z, words landing off the beat. Here the
// camera, the corridor and the words share one space, so "flying past you" is
// not an effect — it is just the camera moving and a word standing still.
//
// A word is placed at the distance its ONSET sits at: s = t * speed. The
// camera is at s = now * speed. Words therefore arrive, pass and recede
// because time is distance, and nothing has to be animated at all.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { envAt, type StemData } from "@/lib/stemSense";

export interface WorldWord { t: number; w: string }

/** The flight path: the same three non-dividing periods the shader used, so a
 *  route never repeats a turn inside a cut. z runs negative — forward. */
function pathPoint(s: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(
    Math.sin(s * 0.043) * 7 + Math.sin(s * 0.017) * 3.4,
    Math.cos(s * 0.031) * 3.2 + Math.sin(s * 0.0091) * 1.9,
    -s,
  );
}
/** A frame that travels with the path, so rings and words sit square to it. */
function frameAt(s: number) {
  const here = pathPoint(s), ahead = pathPoint(s + 2);
  const fwd = ahead.clone().sub(here).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  return { here, fwd, right, up };
}

const SPEED = 9;            // world units per second of song
const AHEAD = 190, BEHIND = 26;

// ── THE TUNNEL'S CROSS-SECTION ────────────────────────────────────────────
// A torus whose tubularSegments count IS the shape: 4 is a square corridor,
// 6 a hex, 40 a ring. One number, a completely different world — which is the
// cheapest possible answer to "not every video should look the same".
const SHAPES: Record<string, number> = {
  square: 4, triangle: 3, pentagon: 5, hex: 6, octagon: 8, ring: 40,
};
export interface WorldLook {
  shape?: keyof typeof SHAPES | string;
  /** longitudinal rails running the length of the corridor — this is what
   *  turns a stack of rungs into a GRID. 0 for bare rungs. */
  rails?: number;
  /** units between rungs — tight reads fast, wide reads vast */
  gap?: number;
  radius?: number;
  /** degrees each successive rung is rotated: the corridor screws as it runs */
  twist?: number;
  /** false keeps the bare wireframe corridor */
  surface?: boolean;
}
/** Pick a look from the song's own id when the cut does not specify one, so
 *  two songs never open on the same corridor by default. */
function lookFor(seed: string, cfg: WorldLook | undefined): Required<WorldLook> {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const pick = <T,>(a: T[], k: number) => a[Math.abs(h >> k) % a.length];
  return {
    shape: cfg?.shape ?? pick(["square", "hex", "triangle", "octagon", "ring", "pentagon"], 3),
    rails: cfg?.rails ?? pick([0, 4, 6, 8], 11),
    gap: cfg?.gap ?? pick([2.6, 3.4, 4.2, 5.5], 17),
    radius: cfg?.radius ?? pick([3.6, 4.2, 5.0], 23),
    twist: cfg?.twist ?? pick([0, 0, 3, -5, 9], 7),
    surface: cfg?.surface ?? true,
  };
}

// ── THE SURFACE ────────────────────────────────────────────────────────────
// Rungs and rails are lines; lines are why it reads as a wireframe. This is an
// actual skin for the corridor: one TubeGeometry along the whole flight path,
// built once, drawn from the INSIDE (BackSide), wearing a gradient mixed from
// the song's own palette. It is what W2's panels and W3's light will land on.
function Surface({ palette, spanS, radius }: { palette: string[]; spanS: number; radius: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let s = -BEHIND; s <= spanS + AHEAD; s += 4) pts.push(pathPoint(s, new THREE.Vector3()));
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, Math.max(24, pts.length), radius * 1.02, 16, false);
  }, [spanS, radius]);

  const tex = useMemo(() => {
    // a long strip of the song's colours, darkened — the corridor must stay
    // dark enough for words to read over it (see the roadmap's contrast note)
    const c = document.createElement("canvas");
    c.width = 4; c.height = 512;
    const g = c.getContext("2d")!;
    const cols = (palette.length ? palette : ["#E8A33D"]).slice(0, 5);
    const grad = g.createLinearGradient(0, 0, 0, 512);
    cols.forEach((col, i) => grad.addColorStop(i / Math.max(1, cols.length - 1), col));
    g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
    // FAR darker than looks right in isolation. At 0.72 the corridor filled
    // the frame with pale gold and the lyric had nothing to read against —
    // every gain in surface is a loss in text legibility, and the text wins.
    g.fillStyle = "rgba(0,0,0,0.90)"; g.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(2, spanS / 90), 1);
    return t;
  }, [palette, spanS]);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map: tex, side: THREE.BackSide, transparent: true, opacity: 0.7, fog: true,
  }), [tex]);
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

function Tunnel({ color, getS, look }: { color: string; getS: () => number; look: Required<WorldLook> }) {
  const seg = SHAPES[look.shape] ?? 40;
  const nRung = Math.ceil((AHEAD + BEHIND) / look.gap);
  const railStep = 2.2;
  const nRail = look.rails * Math.ceil((AHEAD + BEHIND) / railStep);
  const rungs = useRef<THREE.InstancedMesh>(null);
  const rails = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const rungGeo = useMemo(() => new THREE.TorusGeometry(look.radius, 0.05, 3, seg), [look.radius, seg]);
  const railGeo = useMemo(() => new THREE.BoxGeometry(0.05, 0.05, railStep * 0.94), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.6 }), [color]);

  useFrame(() => {
    const s0 = getS();
    const R = rungs.current;
    if (R) {
      const first = Math.floor((s0 - BEHIND) / look.gap);
      for (let i = 0; i < nRung; i++) {
        const s = (first + i) * look.gap;
        const f = frameAt(s);
        dummy.position.copy(f.here);
        dummy.quaternion.setFromRotationMatrix(m4.lookAt(new THREE.Vector3(), f.fwd, f.up));
        dummy.rotateZ((s / look.gap) * look.twist * Math.PI / 180);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        R.setMatrixAt(i, dummy.matrix);
      }
      R.instanceMatrix.needsUpdate = true;
    }
    const L = rails.current;
    if (L && look.rails > 0) {
      const first = Math.floor((s0 - BEHIND) / railStep);
      let n = 0;
      for (let i = 0; i < Math.ceil((AHEAD + BEHIND) / railStep); i++) {
        const s = (first + i) * railStep;
        const f = frameAt(s);
        const roll = (s / look.gap) * look.twist * Math.PI / 180;
        for (let r = 0; r < look.rails; r++) {
          const a = (r / look.rails) * Math.PI * 2 + roll;
          dummy.position.copy(f.here)
            .addScaledVector(f.right, Math.cos(a) * look.radius)
            .addScaledVector(f.up, Math.sin(a) * look.radius);
          dummy.quaternion.setFromRotationMatrix(m4.lookAt(new THREE.Vector3(), f.fwd, f.up));
          dummy.updateMatrix();
          L.setMatrixAt(n++, dummy.matrix);
        }
      }
      L.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh ref={rungs} args={[rungGeo, mat, nRung]} frustumCulled={false} />
      {look.rails > 0 && <instancedMesh ref={rails} args={[railGeo, mat, nRail]} frustumCulled={false} />}
    </>
  );
}

function Words({ words, getS, color, stems, lag }: {
  words: WorldWord[]; getS: () => number; color: string; stems: StemData | null; lag: number;
}) {
  const group = useRef<THREE.Group>(null);
  const SLOTS = 14;
  const slots = useRef<{ i: number }[]>(Array.from({ length: SLOTS }, () => ({ i: -1 })));
  const refs = useRef<(THREE.Object3D | null)[]>([]);
  useFrame(() => {
    const s0 = getS();
    // the words whose distance places them inside the visible run
    const vis: number[] = [];
    for (let i = 0; i < words.length && vis.length < SLOTS; i++) {
      const s = words[i].t * SPEED;
      if (s > s0 - BEHIND && s < s0 + AHEAD) vis.push(i);
    }
    for (let k = 0; k < SLOTS; k++) {
      const o = refs.current[k]; if (!o) continue;
      const wi = vis[k];
      if (wi === undefined) { o.visible = false; slots.current[k].i = -1; continue; }
      slots.current[k].i = wi;
      o.visible = true;
      const s = words[wi].t * SPEED;
      const f = frameAt(s);
      // scatter around the tunnel wall, stable per word
      const a = wi * 2.399963;                                  // golden angle
      // out near the tunnel WALL (radius 4.2), not hugging the camera's own
      // path — at radius ~1 a word passes straight through the lens and eats
      // the whole frame on its way by.
      const rad = 2.4 + ((wi * 37) % 19) / 19 * 1.5;
      o.position.copy(f.here)
        .addScaledVector(f.right, Math.cos(a) * rad)
        .addScaledVector(f.up, Math.sin(a) * rad * 0.7);
      // face the camera's travel, then TWIST — tumble as it comes at you,
      // strongest just before it passes
      const d = s - s0;
      const twist = Math.max(0, 1 - Math.abs(d) / 40);
      o.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), f.fwd, f.up));
      o.rotateZ(Math.sin(wi * 1.7 + d * 0.05) * 0.5 * twist);
      o.rotateX(Math.cos(wi * 2.3 + d * 0.04) * 0.35 * twist);
      const loud = stems ? envAt(stems, "lead", words[wi].t + lag + 0.18) : 0.5;
      o.scale.setScalar(0.85 + loud * 0.5);
    }
  });
  return (
    <group ref={group}>
      {Array.from({ length: SLOTS }, (_, k) => (
        <Text
          key={k}
          ref={(el) => { refs.current[k] = el as unknown as THREE.Object3D; }}
          fontSize={0.92}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#000"
        >
          {words[slots.current[k].i]?.w ?? ""}
        </Text>
      ))}
    </group>
  );
}

function Rig({ getTime }: { getTime: () => number }) {
  useFrame(({ camera }) => {
    const s = getTime() * SPEED;
    const f = frameAt(s);
    camera.position.copy(f.here);
    const look = pathPoint(s + 14);
    camera.up.copy(f.up);
    camera.lookAt(look);
  });
  return null;
}

export default function WorldStage({ getTime, words, palette, stems, lag = 0, look, seed = "" }: {
  getTime: () => number;
  words: WorldWord[];
  palette: string[];
  stems: StemData | null;
  lag?: number;
  look?: WorldLook;
  /** the song id — decides the default corridor when the cut names none */
  seed?: string;
}) {
  const a = palette[0] ?? "#E8A33D";
  const shape = useMemo(() => lookFor(seed, look), [seed, look]);
  const spanS = useMemo(() => ((words[words.length - 1]?.t ?? 60) + 20) * SPEED, [words]);
  const getS = () => getTime() * SPEED;
  return (
    <div className="pointer-events-none fixed inset-0 -z-[9]">
      <Canvas camera={{ fov: 74, near: 0.1, far: 400 }} gl={{ antialias: true, alpha: false }}
              onCreated={({ gl }) => gl.setClearColor("#05040a", 1)}>
        <fog attach="fog" args={["#05040a", 14, 120]} />
        <Rig getTime={getTime} />
        {look?.surface !== false && (
          <Surface palette={palette} spanS={spanS} radius={shape.radius} />
        )}
        <Tunnel color={a} getS={getS} look={shape} />
        <Words words={words} getS={getS} color={a} stems={stems} lag={lag} />
      </Canvas>
    </div>
  );
}
