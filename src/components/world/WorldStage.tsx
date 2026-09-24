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
const RING_GAP = 4;         // one ring every this many units
const AHEAD = 190, BEHIND = 26;

function Rings({ colorA, colorB, getS }: { colorA: string; colorB: string; getS: () => number }) {
  const n = Math.ceil((AHEAD + BEHIND) / RING_GAP);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.TorusGeometry(4.2, 0.045, 3, 40), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(colorA), transparent: true, opacity: 0.55 }), [colorA]);
  useFrame(() => {
    const m = mesh.current; if (!m) return;
    const s0 = getS();
    const first = Math.floor((s0 - BEHIND) / RING_GAP);
    for (let i = 0; i < n; i++) {
      const s = (first + i) * RING_GAP;
      const f = frameAt(s);
      dummy.position.copy(f.here);
      dummy.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), f.fwd, f.up));
      const fade = 1 - Math.min(1, Math.max(0, (s - s0) / AHEAD));
      dummy.scale.setScalar(1 + (1 - fade) * 0.12);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, n]} frustumCulled={false} />;
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

export default function WorldStage({ getTime, words, palette, stems, lag = 0 }: {
  getTime: () => number;
  words: WorldWord[];
  palette: string[];
  stems: StemData | null;
  lag?: number;
}) {
  const a = palette[0] ?? "#E8A33D", b = palette[1] ?? a;
  const getS = () => getTime() * SPEED;
  return (
    <div className="pointer-events-none fixed inset-0 -z-[9]">
      <Canvas camera={{ fov: 74, near: 0.1, far: 400 }} gl={{ antialias: true, alpha: false }}
              onCreated={({ gl }) => gl.setClearColor("#05040a", 1)}>
        <fog attach="fog" args={["#05040a", 30, 190]} />
        <Rig getTime={getTime} />
        <Rings colorA={a} colorB={b} getS={getS} />
        <Words words={words} getS={getS} color={a} stems={stems} lag={lag} />
      </Canvas>
    </div>
  );
}
