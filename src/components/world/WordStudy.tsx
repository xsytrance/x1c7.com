"use client";

// ═══════════════════════════════════════════════════════════════════════════
// WORD STUDY — the lyric IS the subject. No corridor, no plates, no world to
// look at: a near-black void, one word, and a camera that investigates it.
//
// The tunnel was a place the words happened to be in, and a place competes
// with the thing standing in it. Here every word gets DISCOVERED — it arrives
// edge-on, or out of the dark, or from below — and gets EXPLORED, because the
// camera moves around it while it is held rather than staring at it flat.
//
// The treatment is chosen by the SONG, never at random: how hard the word was
// sung, how far its note sits from the tonic, whether it climbs or falls.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { envAt, OnsetTracker, type StemData } from "@/lib/stemSense";

/** what drei's <Text> actually hands back: a troika text mesh */
type TroikaText = THREE.Object3D & {
  text: string; fontSize: number; fillOpacity: number; outlineWidth: number; sync?: () => void;
};

export interface StudyWord { t: number; w: string; midi?: number; tension?: number }

const TREATMENTS = ["turn", "rise", "push", "swing", "drop", "unfold"] as const;
type Treatment = (typeof TREATMENTS)[number];

/** Which discovery this word gets. Loud words arrive hard, quiet ones unfold;
 *  dissonance swings, a rising line lifts. Falls back to a stable hash so a
 *  song with no melody still varies. */
function treatmentFor(i: number, loud: number, tension: number, climb: number): Treatment {
  if (loud > 1.12) return climb >= 0 ? "push" : "drop";
  if (tension > 0.62) return "swing";
  if (climb > 0.25) return "rise";
  if (loud < 0.92) return "unfold";
  return TREATMENTS[Math.abs(Math.imul(i ^ 0x9e3779b9, 0x85ebca6b)) % 2 === 0 ? 0 : 3];
}

/** Split the lyric into PHRASES on the natural breaths — a gap longer than
 *  `gap` starts a new one. The phrase, not the word, is the unit of staging:
 *  one camera move every few seconds instead of three a second. */
function phrasesOf(words: StudyWord[], gap = 0.55): number[][] {
  const out: number[][] = []; let cur: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (cur.length && words[i].t - words[i - 1].t > gap) { out.push(cur); cur = []; }
    cur.push(i);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Which word in a phrase carries it. The Pillar rules, minus authoring:
 *  the melodic peak, the longest held note, and never a stop word. */
const STOP = new Set(["the","a","an","and","or","but","of","to","in","on","at","it","is","i","you","me","my","we","he","she","they","for","so","as","be","do","if","no","up"]);
function keyOf(words: StudyWord[], ph: number[]): number {
  let best = ph[0], bestScore = -1e9;
  for (let n = 0; n < ph.length; n++) {
    const i = ph[n];
    const w = (words[i].w || "").toLowerCase().replace(/[^a-z0-9']/g, "");
    const held = (n + 1 < ph.length ? words[ph[n + 1]].t : words[i].t + 0.6) - words[i].t;
    const score = (words[i].midi ?? 0) * 1.4 + held * 1.1 + (STOP.has(w) ? -3 : 0) + w.length * 0.05;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/** progress 0..1 across a word's own airtime, eased so it ARRIVES */
const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

function Word({ words, getTime, color, stems, lag }: {
  words: StudyWord[]; getTime: () => number; color: string; stems: StemData | null; lag: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const kick = useRef<OnsetTracker | null>(null);
  const punch = useRef(0);
  if (!kick.current && stems) kick.current = new OnsetTracker(stems.kicks ?? []);

  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    const t = getTime();
    let i = idx.current;
    while (i + 1 < words.length && words[i + 1].t <= t) i++;
    while (i > 0 && words[i].t > t) i--;
    idx.current = i;
    const cur = words[i]; if (!cur) return;
    const next = words[i + 1];
    const air = Math.max(0.18, (next ? next.t : cur.t + 0.7) - cur.t);
    const p = (t - cur.t) / air;                       // 0 at onset, 1 at the next word

    const loud = stems ? 0.82 + envAt(stems, "lead", cur.t + lag + 0.18) * 0.42 : 1;
    const tension = cur.tension ?? 0;
    const climb = cur.midi ?? 0;
    const tr = treatmentFor(i, loud, tension, climb);

    // DISCOVERY — the first 45% of the word's life is its arrival
    const a = ease(p / 0.45);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    if (tr === "turn")   { g.rotation.y = (1 - a) * -Math.PI * 0.52; g.position.x = (1 - a) * -0.6; }
    if (tr === "rise")   { g.position.y = (1 - a) * -2.2; g.rotation.x = (1 - a) * 0.55; }
    if (tr === "push")   { g.position.z = (1 - a) * -9; g.scale.setScalar(0.6 + a * 0.4); }
    if (tr === "swing")  { g.rotation.z = (1 - a) * (i % 2 ? 0.5 : -0.5); g.rotation.y = (1 - a) * 0.7; }
    if (tr === "drop")   { g.position.y = (1 - a) * 2.6; g.rotation.x = (1 - a) * -0.6; }
    if (tr === "unfold") { g.scale.setScalar(0.05 + a * 0.95); g.rotation.y = (1 - a) * 0.9; }

    // held: a slow live drift so it is never a still frame
    const hold = Math.max(0, p - 0.45);
    g.rotation.y += Math.sin(t * 0.9 + i) * 0.07 * hold;
    g.rotation.x += Math.cos(t * 0.7 + i) * 0.04 * hold;

    // the kick punches the word's scale
    punch.current = Math.max(0, punch.current - dt * 5);
    if (kick.current && kick.current.consume(t - lag) > 0) punch.current = 1;
    g.scale.multiplyScalar(1 + punch.current * 0.045 * loud);

    // let go before the next word lands
    const out = Math.max(0, (p - 0.86) / 0.14);
    g.scale.multiplyScalar(1 - out * 0.25);
  });

  const i = idx.current;
  return (
    <group ref={ref}>
      {/* Size by LENGTH. At a fixed 1.5 a short word sat nicely and
          "bloodline" ran off both edges — the frame is 9:16, so width is the
          scarce thing and a long word has to give some back. */}
      {/* Fit the word to the frame's WIDTH, which on 9:16 is the scarce axis.
          Visible width = 2 * d * tan(fov/2) * aspect — at d 6.4, fov 42 and
          aspect 0.5625 that is 2.8 units, while "bloodline" at fontSize 1 is
          about 5. Hence the clipping. Camera pulled back to ~9 and the size
          solved from the glyph advance (~0.58 em) against what actually fits. */}
      <Text
        fontSize={Math.max(0.5, Math.min(1.5, 5.5 / Math.max(3, (words[i]?.w ?? "").length)))}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.014}
        outlineColor="#000"
      >
        {words[i]?.w ?? ""}
      </Text>
    </group>
  );
}

// ── THE PHRASE AS A RECEDING LINE ─────────────────────────────────────────
// One word facing the camera has NO internal perspective — every letter is the
// same distance away, so it is a flat picture however much 3D sits behind it.
// A line of words rotated in depth does: the far end converges, which is the
// whole of why the Star Wars crawl reads as projected.
//
// So the rest of the sentence is not clutter to be hidden — it is the thing
// PROVIDING the depth. The key word sits forward, lit and sharp; the others
// recede behind it, dim but present.
function PhraseLine({ words, getTime, color, cfg }: {
  words: StudyWord[]; getTime: () => number; color: string;
  cfg: { tilt: number; rest: number; keys: number; spread: number };
}) {
  const phrases = useMemo(() => phrasesOf(words), [words]);
  const keys = useMemo(() => phrases.map((ph) => keyOf(words, ph)), [phrases, words]);
  const group = useRef<THREE.Group>(null);
  const SLOTS = 9;
  // Imperative, not React state. Driving this from setState meant the phrase
  // had not re-rendered yet when a still was captured, and five of six frames
  // in the first look sheet came out empty — the same trap the tunnel hit.
  const slots = useRef<(TroikaText | null)[]>(Array(SLOTS).fill(null));

  useFrame(() => {
    const t = getTime();
    const g = group.current; if (!g) return;
    g.rotation.set((-cfg.tilt * 0.35 * Math.PI) / 180, (cfg.tilt * Math.PI) / 180, 0);
    let p = 0;
    while (p + 1 < phrases.length && words[phrases[p + 1][0]].t <= t) p++;
    const ph = phrases[p] ?? [];
    const k = keys[p] ?? ph[0];
    const kn = Math.max(0, ph.indexOf(k));
    for (let n = 0; n < SLOTS; n++) {
      const el = slots.current[n]; if (!el) continue;
      const wi = ph[n];
      if (wi === undefined) { el.visible = false; continue; }
      el.visible = true;
      const isKey = wi === k;
      const sung = words[wi].t <= t;
      const want = words[wi].w;
      if (el.text !== want) { el.text = want; el.fontSize = isKey ? 1.05 : 0.6; el.sync?.(); }
      el.position.set((n - kn) * cfg.spread, 0, isKey ? 0.6 : 0);
      el.fillOpacity = isKey ? 1 : sung ? Math.min(1, cfg.rest * 1.5) : cfg.rest;
      el.outlineWidth = isKey ? 0.012 : 0;
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: SLOTS }, (_, n) => (
        <Text key={n} ref={(el) => { slots.current[n] = el as unknown as TroikaText; }}
              fontSize={0.6} color={color} anchorX="center" anchorY="middle" outlineColor="#000">
          {" "}
        </Text>
      ))}
    </group>
  );
}

/** The camera never sits still: it arcs around the word while it is held, so
 *  the word is EXPLORED rather than presented. A new arc per word. */
function Explore({ words, getTime }: { words: StudyWord[]; getTime: () => number }) {
  const idx = useRef(0);
  useFrame(({ camera }) => {
    const t = getTime();
    let i = idx.current;
    while (i + 1 < words.length && words[i + 1].t <= t) i++;
    while (i > 0 && words[i].t > t) i--;
    idx.current = i;
    const cur = words[i]; if (!cur) return;
    const next = words[i + 1];
    const air = Math.max(0.18, (next ? next.t : cur.t + 0.7) - cur.t);
    const p = Math.min(1, Math.max(0, (t - cur.t) / air));
    const h = Math.abs(Math.imul(i ^ 0x27d4eb2f, 0x165667b1));
    const arc = ((h % 200) / 200 - 0.5) * 1.15;          // which way it swings
    const lift = (((h >> 8) % 100) / 100 - 0.5) * 0.7;
    const ang = arc * (p - 0.5);
    const r = 9.2 - p * 0.6;
    camera.position.set(Math.sin(ang) * r, lift * (0.4 + p * 0.6), Math.cos(ang) * r);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function WordStudy({ getTime, words, palette, stems, lag = 0, look }: {
  getTime: () => number; words: StudyWord[]; palette: string[]; stems: StemData | null; lag?: number;
  look?: { mode?: string; tilt?: number; rest?: number; keys?: number; spread?: number; surface?: boolean };
}) {
  const color = palette[0] ?? "#E8A33D";
  const bg = useMemo(() => new THREE.Color("#050408"), []);
  return (
    <div className="pointer-events-none fixed inset-0 -z-[9]">
      <Canvas camera={{ fov: 42, near: 0.1, far: 80, position: [0, 0, 9.2] }}
              gl={{ antialias: true }}
              onCreated={({ gl, scene }) => { gl.setClearColor(bg, 1); scene.background = bg; }}>
        {look?.mode === "phrase" ? (
          <PhraseLine
            words={words}
            getTime={getTime}
            color={color}
            cfg={{
              tilt: look.tilt ?? 38,
              rest: look.rest ?? 0.22,
              keys: look.keys ?? 1,
              spread: look.spread ?? 3.1,
            }}
          />
        ) : (
          <>
            <Explore words={words} getTime={getTime} />
            <Word words={words} getTime={getTime} color={color} stems={stems} lag={lag} />
          </>
        )}
      </Canvas>
    </div>
  );
}
