// ═══════════════════════════════════════════════════════════════════════════
// THE LIVING BACKDROP — generative art breathing behind the words.
//
// A WebGL2 render pipeline in PRISM's shape (scene → feedback trails → post
// grade), pointed at Kinetica's soul: the scenes aren't oscilloscopes, they're
// weather systems — aurora curtains, ember nebulae, ink tides — fed by the
// planet's MEASURED stems (real drums/bass/voice, riser charge) and the song's
// palette, and aware of where the active lyric lives on screen (uWord), so the
// world leans toward the words.
//
// Every knob registers in the param registry, so the whole layer is preset-
// able, morphable, and LFO/stem-follow targetable from day one.
//
// Scene contract (every scene body gets these):
//   vUv          0..1 (GL: y up)          uRes        render resolution
//   uTime        scene clock (flow-scaled) uSeed       0..1 per-song seed
//   uDrums uBass uVoice uChoir uBed        real stem envelopes 0..1
//   uLevel uKick uBeat uBeatPhase          composite + pulses
//   uCharge      riser progress 0..1 (the world tenses before the drop)
//   uEmo         section emotional intensity 0..1
//   uWord        active word position 0..1 (GL y)      uWordPulse  1 → 0
//   uPal0/1/2    the song's palette (rgb 0..1)
//   uIntensity   backdrop.intensity
// Helpers: hash21 hash22 vnoise fbm hsl2rgb
// ═══════════════════════════════════════════════════════════════════════════

import { Program, QUAD_VS, drawQuad, bindRT, createRT, disposeRT, GLSL_NOISE, type RT } from "./gl";
import { P } from "./params";
import { governor } from "./governor";
import { featureBus, type EngineFeatures, type WordGhost } from "./features";
import { stemMixStore } from "@/lib/stemMix";
import { hexHue } from "./melody";
import type { StemName } from "@/lib/stemSense";

const SCENE_HEADER = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime, uSeed;
uniform float uDrums, uBass, uVoice, uChoir, uBed;
uniform float uLevel, uKick, uBeat, uBeatPhase;
uniform float uCharge, uEmo, uWordPulse, uIntensity;
uniform float uKeyHue; // tonic hue 0..1 (matches the words' tonic color), -1 unknown
uniform vec2 uWord;
uniform vec3 uPal0, uPal1, uPal2;
${GLSL_NOISE}
// The song's home color: the tonic's hue when the key is known (the same
// hue melody-sense words wear on the tonic), else the fallback palette slot.
vec3 keyColor(vec3 fallback) {
  return uKeyHue < 0.0 ? fallback : hsl2rgb(vec3(uKeyHue, 0.72, 0.62));
}
`;

// ── SCENE 1: AURORA — curtains of light over a dark horizon ─────────────────
// The voice brightens the curtains, the bass hazes the floor, the bed keeps
// the sky flowing, drums salt the stars, and a riser draws every curtain
// toward center — the sky itself holds its breath for the drop.
const AURORA_FS = SCENE_HEADER + `
void main() {
  vec2 p = vUv;
  float t = uTime * 0.05 * (0.6 + uBed * 0.8) + uSeed * 43.7;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x + fbm(vec2(p.y * 1.4 + t * (0.7 + fi * 0.23), fi * 7.3 + t)) * 0.45 - 0.225;
    // curtains lean toward the active word, and gather to center on a riser
    x += (uWord.x - 0.5) * uWordPulse * (0.10 + 0.12 * fi);
    float center = mix(0.25 + 0.25 * fi, 0.5, uCharge * 0.6);
    float d = abs(x - center);
    float band = exp(-d * d * (70.0 - 30.0 * uCharge));
    float aloft = pow(max(p.y, 0.0), 0.6 + fi * 0.2);
    vec3 pc = i == 0 ? keyColor(uPal0) : (i == 1 ? uPal1 : uPal2); // lead curtain sings the tonic
    col += pc * band * (0.22 + uVoice * 0.85 + uBeat * 0.18) * aloft;
  }
  col += uPal1 * exp(-p.y * 3.0) * uBass * 0.30;                 // bass ground-haze
  float sparkle = step(0.9986, hash21(floor(vUv * uRes / 2.0) + floor(uSeed * 100.0)));
  col += vec3(sparkle) * (0.18 + uDrums * 0.45);                 // drum-salted stars
  fragColor = vec4(col * uIntensity, 1.0);
}`;

// ── SCENE 2: EMBERS — a smoke nebula that sparks with the drums ─────────────
// Domain-warped smoke in the song's palette; kicks flare a core glow, the
// drum stem ignites drifting embers, and the riser charges the heart.
const EMBERS_FS = SCENE_HEADER + `
void main() {
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  float t = uTime * (0.04 + uBed * 0.05) + uSeed * 17.3;
  vec2 q = vec2(fbm(p * 2.0 + t), fbm(p * 2.0 - t * 1.3 + 3.7));
  float n = fbm(p * 2.6 + q * 1.8 - t * 0.5);
  vec3 col = mix(uPal0, uPal1, n) * (0.10 + 0.55 * n * n) * (0.45 + uLevel * 0.95);
  vec2 g = floor((p + q * 0.4) * 34.0);
  float h = hash21(g + floor(uTime * 1.5) * 0.13 + uSeed);
  float ember = step(0.985, h) * smoothstep(0.4, 1.0, n);
  col += uPal2 * ember * (0.5 + uDrums * 0.9 + uKick * 1.8);     // drum-lit embers
  vec2 w = (uWord - 0.5) * vec2(asp, 1.0);
  col += uPal2 * exp(-dot(p - w, p - w) * 7.0) * uWordPulse * 0.35; // the word warms its spot
  col += keyColor(uPal2) * exp(-dot(p, p) * 5.0) * (uCharge * 0.7 + uKick * 0.25); // pre-drop heart glows the tonic
  fragColor = vec4(col * uIntensity, 1.0);
}`;

// ── SCENE 3: INK — dark marbled tide, silver sheen on the backing vocals ────
// Ridged-noise veins deepen with the bass; the flow bends toward the active
// word; when the choir swells, the veins catch a metallic light.
const INK_FS = SCENE_HEADER + `
void main() {
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  vec2 w = (uWord - 0.5) * vec2(asp, 1.0);
  float t = uTime * 0.06 + uSeed * 29.1;
  vec2 dir = w - p;
  float dl = length(dir) + 1e-3;
  p += (dir / dl) * 0.10 * uWordPulse * exp(-dl * 2.0);          // tide pulls toward the word
  float r1 = 1.0 - abs(2.0 * fbm(p * 3.0 + vec2(t, -t)) - 1.0);
  float r2 = 1.0 - abs(2.0 * fbm(p * 5.5 - vec2(t * 1.7, t)) - 1.0);
  float vein = pow(r1 * 0.65 + r2 * 0.35, 3.0 + 2.0 * (1.0 - uBass));
  vec3 col = mix(uPal0 * 0.22, uPal1, vein);
  col += keyColor(uPal2) * pow(r2, 8.0) * (0.25 + uChoir * 1.4 + uBeat * 0.2); // choir sheen in the tonic
  col *= 0.5 + uLevel * 0.85 + uEmo * 0.2;
  fragColor = vec4(col * uIntensity, 1.0);
}`;

// ── Feedback trails (PRISM's TRAILS_FS): echoes swim through the field ──────
const TRAILS_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uCur, uPrev;
uniform float uAmount, uZoom, uRotate;
void main() {
  vec2 p = vUv - 0.5;
  float c = cos(uRotate * 0.02), s = sin(uRotate * 0.02);
  p = mat2(c, -s, s, c) * p;
  p *= 1.0 - uZoom * 0.03;
  vec3 prev = texture(uPrev, p + 0.5).rgb * uAmount;
  vec3 cur = texture(uCur, vUv).rgb;
  fragColor = vec4(max(cur, prev), 1.0);
}`;

// ── WORD GHOSTS ── a dying word is stamped once into a dedicated buffer that
// decays and drifts upward every frame: lyrics dissolve into the atmosphere
// instead of just unmounting. The buffer feeds the finishing pass, so ghosts
// inherit bloom, the grade, and the pre-drop dimming like everything else.
const GHOST_DECAY_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uPrev;
uniform float uDecay, uRise;
void main() {
  vec3 c = texture(uPrev, vUv - vec2(0.0, uRise)).rgb * uDecay;
  fragColor = vec4(c, 1.0);
}`;

const STAMP_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
uniform vec2 uOffset, uScale;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0); }
`;

const STAMP_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uText;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  // the fullscreen-triangle overshoot lands outside 0..1 — clamp reads the
  // text canvas's transparent padding, so the overshoot stamps nothing
  float a = texture(uText, clamp(vUv, 0.0, 1.0)).a;
  fragColor = vec4(uColor * a * uAlpha, a * uAlpha);
}`;

// ── Deck crossfade (A/B section decks): two live scenes mixed on the bar ──
const DECKMIX_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uA, uB;
uniform float uMix;
void main() { fragColor = vec4(mix(texture(uA, vUv).rgb, texture(uB, vUv).rgb, uMix), 1.0); }`;

// ── STEM X-RAY ── when the Lens solos an instrument, the backdrop surfaces
// that stem's ANATOMY: drums strike expanding impact rings on the real beat
// grid, bass stands a slow heavy wave, the voice breathes light around the
// active lyric, the choir raises twin halos, the bed drifts chord curtains.
// One shader, five families, driven by the (mixer-honest) stem envelopes —
// so what you soloed is literally the only thing the world is made of.
const XRAY_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform vec2 uRes, uWord;
uniform float uTime, uFamily, uEnv, uAmt, uKick, uBeat, uBeatPhase;
uniform vec3 uPal0, uPal1, uPal2;
${GLSL_NOISE}
void main() {
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  vec3 col = vec3(0.0);
  if (uFamily < 0.5) {
    // DRUMS — impact rings ride the beat phase; kicks flash the core
    float r = length(p);
    float ring = abs(uBeatPhase * 1.1 - r);
    col += uPal2 * exp(-ring * 34.0) * (0.35 + uKick * 1.6) * (0.3 + uEnv);
    float ring2 = abs(fract(uBeatPhase + 0.5) * 1.1 - r);
    col += uPal2 * 0.5 * exp(-ring2 * 44.0) * (0.2 + uEnv * 0.8);
    col += vec3(1.0) * step(0.996, hash21(floor(p * 42.0) + floor(uTime * 9.0))) * uEnv * 0.8;
  } else if (uFamily < 1.5) {
    // BASS — a standing wave with real weight
    float w = sin(p.x * 5.0 + uTime * 1.1) * cos(p.x * 2.2 - uTime * 0.7);
    float d = abs(p.y - w * 0.28 * (0.25 + uEnv));
    col += uPal1 * exp(-d * 11.0) * (0.35 + uEnv * 1.1);
    col += uPal1 * 0.35 * exp(-abs(p.y) * 2.2) * uEnv;
  } else if (uFamily < 2.5) {
    // VOICE — radiance breathing where the lyric lives
    vec2 w2 = (uWord - 0.5) * vec2(asp, 1.0);
    float d2 = dot(p - w2, p - w2);
    col += uPal0 * exp(-d2 * (7.0 - uEnv * 4.0)) * (0.25 + uEnv * 1.3);
    col += uPal0 * 0.3 * exp(-d2 * 1.6) * uEnv;
  } else if (uFamily < 3.5) {
    // CHOIR — twin halos rising in harmony
    for (int i = 0; i < 2; i++) {
      vec2 c = vec2(float(i) * 0.9 - 0.45, sin(uTime * 0.35 + float(i) * 2.7) * 0.15);
      float rr = abs(length(p - c) - (0.22 + uEnv * 0.1));
      col += mix(uPal0, uPal2, float(i)) * exp(-rr * 26.0) * (0.25 + uEnv);
    }
  } else {
    // BED — slow chord curtains
    float b = fbm(p * 1.6 + vec2(uTime * 0.12, -uTime * 0.08));
    col += mix(uPal0, uPal1, 0.5 + 0.5 * sin(uTime * 0.2)) * smoothstep(0.35, 0.9, b) * (0.25 + uEnv * 0.9);
  }
  fragColor = vec4(col * uAmt, 1.0);
}`;

// ── Finishing pass: soft bloom, hue drift, grade, grain, vignette ────────────
// BLOOM — the 16-tap gather, extracted into its own pass so it runs at
// render-scale (¼ the pixels) instead of full canvas res. uRes stays the FULL
// canvas size so the UV spread of the bloom is unchanged; only the number of
// output pixels the loop executes for drops. Visually identical, ~4× cheaper.
const BLOOM_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uBloom;
void main() {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    vec2 o = vec2(cos(a), sin(a)) / uRes;
    acc += max(texture(uTex, vUv + o * 5.0).rgb - 0.35, 0.0);
    acc += max(texture(uTex, vUv + o * 12.0).rgb - 0.35, 0.0) * 0.6;
  }
  fragColor = vec4(acc * (uBloom * 0.13), 1.0);
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform sampler2D uGhost, uXray, uBloomTex;
uniform float uTime, uHueShift, uGrain, uVignette, uSaturation, uBrightness, uDrop, uGhostAmt, uKeyMinor, uBloomOn, uXrayOn;
float hash21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
vec3 hueRotate(vec3 c, float a) {
  const vec3 W = vec3(0.299, 0.587, 0.114);
  float cs = cos(a), sn = sin(a);
  return vec3(dot(c, W)) + (c - vec3(dot(c, W))) * cs + cross(vec3(0.57735), c) * sn;
}
void main() {
  vec3 col = texture(uTex, vUv).rgb;
  col += texture(uGhost, vUv).rgb * uGhostAmt;   // dissolving lyrics join the field
  col += texture(uXray, vUv).rgb * uXrayOn;       // Lens anatomy (skipped when idle)
  col += texture(uBloomTex, vUv).rgb * uBloomOn;  // bloom, precomputed at render-scale
  if (abs(uHueShift) > 0.001) col = hueRotate(col, uHueShift * 6.2831853);
  // ── ANTICIPATION ── the world tenses as the drop approaches (uDrop 0→1
  // over the last bars before a measured riser lands): the vignette closes
  // in, color drains, light dims — then the drop's kick/nova is the release.
  float vig = 1.0 - (uVignette + uDrop * 0.30) * pow(length(vUv - 0.5) * 1.4, 2.2);
  col *= max(vig, 0.0) * uBrightness * (1.0 - uDrop * 0.18);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uSaturation * (1.0 - uDrop * 0.35));
  // ── MODE GRADE ── the field sits in the song's mode: major lifts the
  // light a touch, minor cools the shadows. Subtle by design — a feeling,
  // not a filter. (uKeyMinor: -1 unknown → untouched, 0 major, 1 minor.)
  if (uKeyMinor >= 0.0) {
    col = mix(col * 1.03, col * vec3(0.965, 0.99, 1.035), uKeyMinor);
  }
  col += (hash21(vUv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}`;

export const BACKDROP_SCENES = ["AURORA", "EMBERS", "INK"] as const;
const SCENE_SOURCES = [AURORA_FS, EMBERS_FS, INK_FS];
const BUILTIN_COUNT = SCENE_SOURCES.length;

/** A live scene slot: built-in or a loaded .frag (Shader SDK). */
interface SceneDef {
  name: string;
  prog: Program;
  /** custom @param uniforms: registry id → GLSL uniform name */
  custom?: { uniform: string; paramId: string }[];
}

// ── Registry: the backdrop's whole control surface ──────────────────────────
P.register({ id: "backdrop.enabled", label: "Enabled", group: "BACKDROP", type: "bool", value: true });
P.register({ id: "backdrop.scene", label: "Scene", group: "BACKDROP", type: "select", options: ["AUTO", ...BACKDROP_SCENES], value: "AUTO" });
// A/B section decks: how many beats a section's scene crossfade rides.
P.register({ id: "backdrop.fadeBeats", label: "Deck Fade (Beats)", group: "BACKDROP", min: 2, max: 16, step: 1, value: 8 });
P.register({ id: "backdrop.intensity", label: "Intensity", group: "BACKDROP", min: 0, max: 2, value: 1 });
// Render resolution as a fraction of the canvas — the mobile studio drops
// this to ~0.35 so phones can carry the full engine.
P.register({ id: "backdrop.renderScale", label: "Render Scale", group: "BACKDROP", min: 0.25, max: 1, value: 0.5 });
P.register({ id: "backdrop.flow", label: "Flow", group: "BACKDROP", min: 0, max: 3, value: 1 });
P.register({ id: "backdrop.opacity", label: "Opacity", group: "BACKDROP", min: 0, max: 1, value: 0.6 });
P.register({ id: "backdrop.trails", label: "Trails", group: "BACKDROP", min: 0, max: 0.97, value: 0.5 });
P.register({ id: "backdrop.trailZoom", label: "Trail Zoom", group: "BACKDROP", min: -1, max: 1, value: 0.12 });
P.register({ id: "backdrop.trailRotate", label: "Trail Rotate", group: "BACKDROP", min: -1, max: 1, value: 0 });
P.register({ id: "backdrop.bloom", label: "Bloom", group: "BACKDROP", min: 0, max: 1.5, value: 0.35 });
P.register({ id: "backdrop.hueShift", label: "Hue Drift", group: "BACKDROP", min: -0.5, max: 0.5, value: 0 });
P.register({ id: "backdrop.grain", label: "Grain", group: "BACKDROP", min: 0, max: 0.3, value: 0.05 });
P.register({ id: "backdrop.vignette", label: "Vignette", group: "BACKDROP", min: 0, max: 1, value: 0.42 });
P.register({ id: "backdrop.saturation", label: "Saturation", group: "BACKDROP", min: 0, max: 2, value: 1.05 });
P.register({ id: "backdrop.brightness", label: "Brightness", group: "BACKDROP", min: 0.2, max: 2, value: 1 });
// How hard the world tenses before a measured drop (0 = ignore the future).
P.register({ id: "backdrop.anticipation", label: "Anticipation", group: "BACKDROP", min: 0, max: 1, value: 0.8 });
// Stem X-ray: how strongly a Lens-soloed instrument's anatomy surfaces.
P.register({ id: "backdrop.xray", label: "Stem X-Ray", group: "BACKDROP", min: 0, max: 1.2, value: 0.8 });
// Word ghosts: dying lyrics dissolve into the field (0 = off).
P.register({ id: "backdrop.ghosts", label: "Word Ghosts", group: "BACKDROP", min: 0, max: 1, value: 0.5 });
P.register({ id: "backdrop.ghostFade", label: "Ghost Fade", group: "BACKDROP", min: 0.9, max: 0.995, value: 0.975 });
P.register({ id: "backdrop.ghostRise", label: "Ghost Rise", group: "BACKDROP", min: 0, max: 1, value: 0.35 });

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  if (!isFinite(n)) return [0.5, 0.5, 0.5];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** FNV-1a — the same deterministic-look trick as kinetica's songLook. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── the mounted renderer, for UI (deck strip, studio) ───────────────────────
let active: BackdropRenderer | null = null;
export function setActiveBackdrop(r: BackdropRenderer | null) { active = r; }
export function getActiveBackdrop(): BackdropRenderer | null { return active; }
/** Deck state for the UI: scene names + the live crossfade mix (pure peek —
 * never advances/retires the fade; the render loop owns that). */
export function deckInfo(): { a: string; b: string | null; mix: number; startBeat: number } | null {
  if (!active) return null;
  const f = active.fade;
  let mix = 0;
  if (f) {
    const x = (featureBus.F.totalBeats - f.startBeat) / f.beats;
    mix = x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  }
  const names = active.sceneNames();
  return {
    a: names[active.sceneIdx] ?? "AURORA",
    b: f ? names[f.to] ?? null : null,
    mix,
    startBeat: f?.startBeat ?? 0,
  };
}

export class BackdropRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private sceneDefs: SceneDef[];
  private trails: Program;
  private bloom: Program;
  private post: Program;
  private ghostDecay: Program;
  private stamp: Program;
  private xray: Program;
  private deckMix: Program;
  private rts: { a: RT; b: RT; mixRT: RT; ping: RT; pong: RT; ghostPing: RT; ghostPong: RT; xrayRT: RT; bloomRT: RT } | null = null;
  private xrayAmt = 0;
  private xrayFamily = 0; // held through the fade-out so the anatomy doesn't flip
  private seedStr = "";
  // A/B section decks: sceneIdx is deck A; a fade carries deck B in on the
  // bar. Public (readonly by convention) so deckInfo() below can report them
  // to the deck strip UI.
  sceneIdx = 0;
  fade: { to: number; startBeat: number; beats: number } | null = null;
  private time = 0;
  private pal: [number, number, number][] = [[0.3, 0.8, 1], [1, 0.3, 0.6], [1, 0.85, 0.4]];
  private pal0Hue = 190; // theme hue (deg) — the tonic wears it, like the words
  private seed = 0;
  // one shared rasterizer for ghost words: text → alpha texture, per stamp
  private ghostCanvas: HTMLCanvasElement;
  private ghostCtx: CanvasRenderingContext2D | null;
  private ghostTex: WebGLTexture;

  constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    this.gl = gl;
    this.canvas = canvas;
    this.sceneDefs = SCENE_SOURCES.map((src, i) => ({ name: BACKDROP_SCENES[i], prog: new Program(gl, QUAD_VS, src) }));
    this.trails = new Program(gl, QUAD_VS, TRAILS_FS);
    this.bloom = new Program(gl, QUAD_VS, BLOOM_FS);
    this.post = new Program(gl, QUAD_VS, POST_FS);
    this.ghostDecay = new Program(gl, QUAD_VS, GHOST_DECAY_FS);
    this.stamp = new Program(gl, STAMP_VS, STAMP_FS);
    this.xray = new Program(gl, QUAD_VS, XRAY_FS);
    this.deckMix = new Program(gl, QUAD_VS, DECKMIX_FS);
    this.ghostCanvas = document.createElement("canvas");
    this.ghostCanvas.width = 512;
    this.ghostCanvas.height = 192;
    this.ghostCtx = this.ghostCanvas.getContext("2d");
    this.ghostTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.ghostTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Point the renderer at a song: palette hexes + a stable per-song seed. */
  setSong(palette: string[], seedStr: string) {
    const px = palette.filter(Boolean);
    this.pal = [
      hexToRgb(px[0] ?? "#43f7ff"),
      hexToRgb(px[1] ?? px[0] ?? "#ff2440"),
      hexToRgb(px[2] ?? px[px.length - 1] ?? "#ffd166"),
    ];
    this.pal0Hue = hexHue(px[0] ?? "#43f7ff");
    const h = fnv1a(seedStr);
    this.seed = (h % 1000) / 1000;
    this.sceneIdx = h % BUILTIN_COUNT; // AUTO worlds stay stable over the built-ins
    this.seedStr = seedStr;
    this.fade = null;
    this.time = 0;
  }

  // ── A/B SECTION DECKS ── each section emotion owns a scene (same
  // hash(song, emotion) determinism as the chorus-memory look, so a
  // returning chorus brings back its WORLD, not just its grade). A change
  // arms deck B and crossfades in on the next bar line of the real grid,
  // over Deck Fade beats — PRISM's quantized auto-fade, driven by the
  // song's structure instead of a hand on the crossfader.
  setSectionScene(emotion: string | null) {
    if (!emotion || P.getStr("backdrop.scene") !== "AUTO") return;
    const target = fnv1a(`${this.seedStr}::${emotion.toLowerCase()}`) % BUILTIN_COUNT;
    if (this.fade ? target === this.fade.to : target === this.sceneIdx) return;
    const F = featureBus.F;
    if (this.fade) this.sceneIdx = this.fade.to; // redirect mid-fade: land the old target
    this.fade = {
      to: target,
      startBeat: featureBus.nextBoundary(4) ?? F.totalBeats,
      beats: Math.max(2, P.get("backdrop.fadeBeats")),
    };
  }

  /** Current deck mix 0..1 (advances/retires the fade against the grid). */
  private deckMixNow(F: EngineFeatures): number {
    if (!this.fade) return 0;
    const x = (F.totalBeats - this.fade.startBeat) / this.fade.beats;
    if (x >= 1) { this.sceneIdx = this.fade.to; this.fade = null; return 0; }
    if (x <= 0) {
      // a backward scrub left the bar line far in the future — re-arm at the
      // next boundary from where the listener actually is, don't stall
      if (this.fade.startBeat - F.totalBeats > 16) {
        this.fade.startBeat = featureBus.nextBoundary(4) ?? F.totalBeats;
      }
      return 0;
    }
    return x * x * (3 - 2 * x);
  }

  private resize(scale: number) {
    const gl = this.gl;
    const w = Math.max(2, Math.round(this.canvas.width * scale));
    const h = Math.max(2, Math.round(this.canvas.height * scale));
    if (this.rts && this.rts.a.w === w && this.rts.a.h === h) return;
    if (this.rts) for (const rt of Object.values(this.rts)) disposeRT(gl, rt);
    this.rts = {
      a: createRT(gl, w, h),
      b: createRT(gl, w, h),
      mixRT: createRT(gl, w, h),
      ping: createRT(gl, w, h),
      pong: createRT(gl, w, h),
      ghostPing: createRT(gl, w, h),
      ghostPong: createRT(gl, w, h),
      xrayRT: createRT(gl, w, h),
      bloomRT: createRT(gl, w, h),
    };
  }

  // ── SHADER SDK ── load a fragment-shader body as a live scene. Compile
  // errors throw with a line-numbered listing (gl.ts). Re-adding a name
  // hot-replaces it. Custom scenes are selectable (pin / scenes rail); the
  // AUTO deck rotation stays over the built-ins so every song's world is
  // stable no matter how many scenes get loaded.
  addScene(name: string, body: string, custom?: { uniform: string; paramId: string }[]) {
    const prog = new Program(this.gl, QUAD_VS, SCENE_HEADER + body); // throws on compile error
    const existing = this.sceneDefs.findIndex((d) => d.name === name);
    if (existing >= 0) { this.sceneDefs[existing].prog.dispose(); this.sceneDefs[existing] = { name, prog, custom }; }
    else this.sceneDefs.push({ name, prog, custom });
    const opts = P.def("backdrop.scene")?.options;
    if (opts && !opts.includes(name)) opts.push(name);
  }

  removeScene(name: string) {
    const i = this.sceneDefs.findIndex((d) => d.name === name);
    if (i < BUILTIN_COUNT || i < 0) return; // built-ins are permanent
    this.sceneDefs[i].prog.dispose();
    this.sceneDefs.splice(i, 1);
    const opts = P.def("backdrop.scene")?.options;
    if (opts) { const oi = opts.indexOf(name); if (oi >= 0) opts.splice(oi, 1); }
    if (P.getStr("backdrop.scene") === name) P.set("backdrop.scene", "AUTO", "code");
    if (this.sceneIdx >= this.sceneDefs.length) this.sceneIdx = 0;
    if (this.fade && this.fade.to >= this.sceneDefs.length) this.fade = null;
  }

  sceneNames(): string[] { return this.sceneDefs.map((d) => d.name); }

  private renderScene(idx: number, rt: RT, F: EngineFeatures) {
    const def = this.sceneDefs[idx] ?? this.sceneDefs[0];
    const [p0, p1, p2] = this.pal;
    bindRT(this.gl, rt);
    def.prog.use()
      .v2("uRes", rt.w, rt.h)
      .f("uTime", this.time)
      .f("uSeed", this.seed)
      .f("uDrums", F.drums).f("uBass", F.bass).f("uVoice", F.voice).f("uChoir", F.choir).f("uBed", F.bed)
      .f("uLevel", F.level).f("uKick", F.kick).f("uBeat", F.beat).f("uBeatPhase", F.beatPhase)
      .f("uCharge", F.charge).f("uEmo", F.sectionIntensity)
      .f("uWordPulse", F.wordPulse)
      .f("uIntensity", P.get("backdrop.intensity"))
      .f("uKeyHue", F.keyPc >= 0 ? this.pal0Hue / 360 : -1) // tonic = theme hue, like the words
      .v2("uWord", F.wordX, 1 - F.wordY) // DOM y-down → GL y-up
      .v3("uPal0", p0[0], p0[1], p0[2])
      .v3("uPal1", p1[0], p1[1], p1[2])
      .v3("uPal2", p2[0], p2[1], p2[2]);
    // custom @param uniforms (Shader SDK) — each is a registry param, so it's
    // already slider-rendered, look-captured, and modulation-targetable
    if (def.custom) for (const c of def.custom) def.prog.f(c.uniform, P.get(c.paramId));
    drawQuad(this.gl);
  }

  // Rasterize a dying word and stamp it into the ghost buffer (additive).
  // Position/size arrive in viewport px; the buffer decays + rises per frame.
  private stampGhost(g: WordGhost) {
    const gl = this.gl;
    const c = this.ghostCtx;
    if (!c || !this.rts) return;
    const W = this.ghostCanvas.width, H = this.ghostCanvas.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.shadowColor = "rgba(255,255,255,0.9)";
    c.shadowBlur = 14;
    let size = 132;
    const text = g.word.toUpperCase();
    do {
      c.font = `900 ${size}px system-ui, sans-serif`;
      size -= 12;
    } while (c.measureText(text).width > W * 0.86 && size > 24);
    c.fillText(text, W / 2, H / 2);
    gl.bindTexture(gl.TEXTURE_2D, this.ghostTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, this.ghostCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // stamp quad: word height ≈ rendered font size (plus breathing room),
    // width follows the canvas aspect so the glyphs keep their proportions
    const vw = this.canvas.width, vh = this.canvas.height;
    const hPx = Math.min(vh * 0.28, g.fs * 1.5);
    const wPx = Math.min(vw * 0.7, hPx * (W / H));
    // melody sense: the ghost dissolves in its sung note's color; otherwise
    // it borrows from the song's palette (alternating, seeded by the word)
    const color = g.hue != null ? hslToRgb(g.hue, 0.82, 0.66) : this.pal[fnv1a(g.word) % 2 === 0 ? 2 : 1];
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive, premultiplied
    this.stamp.use()
      .v2("uOffset", (g.x / vw) * 2 - 1, -((g.y / vh) * 2 - 1))
      .v2("uScale", wPx / vw, hPx / vh)
      .v3("uColor", color[0], color[1], color[2])
      .f("uAlpha", 0.85)
      .tex("uText", this.ghostTex);
    drawQuad(gl);
    gl.disable(gl.BLEND);
  }

  render(F: EngineFeatures) {
    const gl = this.gl;
    // The governor's multiplier rides OUTSIDE the param registry: the user's
    // renderScale intent stays untouched (and un-capturable by looks) while a
    // struggling device quietly renders smaller. floor = also skip the
    // feedback passes (trails + ghosts), the fill-rate hogs.
    this.resize(P.get("backdrop.renderScale") * governor.scale);
    const floor = governor.floor;
    if (!this.rts) return;
    const { a, b, mixRT, ping, pong, ghostPing, ghostPong } = this.rts;
    // Anticipation: 0 far from a drop, →1 over the last 16 beats before a
    // measured riser resolves. Ground truth from the bus — the field knows
    // the drop is coming and holds its breath (time itself slows a little).
    const drop = (F.beatsToDrop === Infinity ? 0 : Math.max(0, Math.min(1, 1 - F.beatsToDrop / 16))) * P.get("backdrop.anticipation");
    this.time += F.dt * P.get("backdrop.flow") * (1 - drop * 0.35);

    // scene select: AUTO = the song's own seeded pick, deck-crossfaded per
    // section; a pinned scene disables the decks entirely
    const chosen = P.getStr("backdrop.scene");
    const pinned = chosen !== "AUTO";
    const [p0, p1, p2] = this.pal;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // ── decks: A always renders; during a section crossfade B renders too
    // and the mix pass blends them on the bar-locked smoothstep. The mix is
    // advanced BEFORE idx is read — a completed fade lands deck B as the new
    // deck A on this very frame (no one-frame flash of the old scene). ──
    const mix = pinned ? 0 : this.deckMixNow(F);
    const idx = pinned ? Math.max(0, this.sceneDefs.findIndex((d) => d.name === chosen)) : this.sceneIdx;
    this.renderScene(idx, a, F);
    let sceneSrc: RT = a;
    if (mix > 0 && this.fade) {
      this.renderScene(this.fade.to, b, F);
      bindRT(gl, mixRT);
      this.deckMix.use()
        .f("uMix", mix)
        .tex("uA", a.tex)
        .tex("uB", b.tex);
      drawQuad(gl);
      sceneSrc = mixRT;
    }

    if (!floor) {
      bindRT(gl, ping);
      this.trails.use()
        .f("uAmount", P.get("backdrop.trails"))
        .f("uZoom", P.get("backdrop.trailZoom"))
        .f("uRotate", P.get("backdrop.trailRotate"))
        .tex("uCur", sceneSrc.tex)
        .tex("uPrev", pong.tex);
      drawQuad(gl);
    }

    // ── word ghosts: decay + drift the buffer upward, then stamp this
    // frame's dying words into it (still bound) ──
    const ghostAmt = floor ? 0 : P.get("backdrop.ghosts");
    if (!floor) {
      bindRT(gl, ghostPing);
      this.ghostDecay.use()
        .f("uDecay", P.get("backdrop.ghostFade"))
        .f("uRise", P.get("backdrop.ghostRise") * 0.0012)
        .tex("uPrev", ghostPong.tex);
      drawQuad(gl);
    }
    const dying = featureBus.drainGhosts(); // drain even while off — no backlog
    if (ghostAmt > 0.001) for (const g of dying) this.stampGhost(g);

    // ── stem X-ray: the Lens solos an instrument → its anatomy surfaces ──
    // family: 0 drums 1 bass 2 voice 3 choir 4 bed; the dominant (by live
    // envelope) soloed family wins; the amount eases in/out so engaging the
    // Lens feels like focusing an instrument, not flipping a switch.
    const mixState = stemMixStore.snapshot();
    const soloed = mixState.active && mixState.solo?.length ? mixState.solo : null;
    let targetAmt = 0;
    if (soloed) {
      const famOf = (s: StemName) => (s === "drums" || s === "perc") ? 0 : s === "bass" ? 1 : s === "lead" ? 2 : s === "back" ? 3 : 4;
      const envOf = [F.drums, F.bass, F.voice, F.choir, F.bed];
      let best = -1;
      for (const s of soloed) {
        const f = famOf(s);
        if (best < 0 || envOf[f] > envOf[best]) best = f;
      }
      this.xrayFamily = best;
      targetAmt = P.get("backdrop.xray");
    }
    this.xrayAmt += (targetAmt - this.xrayAmt) * Math.min(1, F.dt * 5);
    const { xrayRT, bloomRT } = this.rts;
    // The Lens is idle almost always — skip its whole fullscreen pass then.
    const xrayOn = this.xrayAmt >= 0.004;
    if (xrayOn) {
      bindRT(gl, xrayRT);
      this.xray.use()
        .v2("uRes", xrayRT.w, xrayRT.h)
        .f("uTime", this.time)
        .f("uFamily", this.xrayFamily)
        .f("uEnv", [F.drums, F.bass, F.voice, F.choir, F.bed][this.xrayFamily] ?? 0)
        .f("uAmt", this.xrayAmt)
        .f("uKick", F.kick).f("uBeat", F.beat).f("uBeatPhase", F.beatPhase)
        .v2("uWord", F.wordX, 1 - F.wordY)
        .v3("uPal0", p0[0], p0[1], p0[2])
        .v3("uPal1", p1[0], p1[1], p1[2])
        .v3("uPal2", p2[0], p2[1], p2[2]);
      drawQuad(gl);
    }

    // ── bloom pre-pass: the 16-tap gather runs at render-scale, not full res
    // (its output is a blur — the reduced resolution is imperceptible, but it
    // stops the single most expensive pass from ignoring renderScale) ──
    const bloomAmt = P.get("backdrop.bloom");
    const bloomOn = bloomAmt > 0.001;
    if (bloomOn) {
      bindRT(gl, bloomRT);
      this.bloom.use()
        .v2("uRes", this.canvas.width, this.canvas.height)
        .f("uBloom", bloomAmt)
        .tex("uTex", ping.tex);
      drawQuad(gl);
    }

    bindRT(gl, null);
    this.post.use()
      .v2("uRes", this.canvas.width, this.canvas.height)
      .f("uTime", this.time)
      .f("uHueShift", P.get("backdrop.hueShift"))
      .f("uGrain", P.get("backdrop.grain"))
      .f("uVignette", P.get("backdrop.vignette"))
      .f("uSaturation", P.get("backdrop.saturation"))
      .f("uBrightness", P.get("backdrop.brightness"))
      .f("uDrop", drop)
      .f("uGhostAmt", ghostAmt)
      .f("uKeyMinor", F.keyMode)
      .f("uBloomOn", bloomOn ? 1 : 0)
      .f("uXrayOn", xrayOn ? 1 : 0)
      .tex("uTex", ping.tex)
      .tex("uGhost", ghostPing.tex)
      .tex("uXray", xrayRT.tex)
      .tex("uBloomTex", bloomRT.tex);
    drawQuad(gl);

    [this.rts.ping, this.rts.pong] = [this.rts.pong, this.rts.ping];
    [this.rts.ghostPing, this.rts.ghostPong] = [this.rts.ghostPong, this.rts.ghostPing];
  }

  dispose() {
    const gl = this.gl;
    for (const d of this.sceneDefs) d.prog.dispose();
    this.trails.dispose();
    this.post.dispose();
    this.ghostDecay.dispose();
    this.stamp.dispose();
    this.xray.dispose();
    gl.deleteTexture(this.ghostTex);
    if (this.rts) { for (const rt of Object.values(this.rts)) disposeRT(gl, rt); this.rts = null; }
  }
}
