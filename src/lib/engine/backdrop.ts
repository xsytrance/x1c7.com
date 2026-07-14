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
import { featureBus, type EngineFeatures, type WordGhost } from "./features";

const SCENE_HEADER = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime, uSeed;
uniform float uDrums, uBass, uVoice, uChoir, uBed;
uniform float uLevel, uKick, uBeat, uBeatPhase;
uniform float uCharge, uEmo, uWordPulse, uIntensity;
uniform vec2 uWord;
uniform vec3 uPal0, uPal1, uPal2;
${GLSL_NOISE}
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
    vec3 pc = i == 0 ? uPal0 : (i == 1 ? uPal1 : uPal2);
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
  col += uPal2 * exp(-dot(p, p) * 5.0) * (uCharge * 0.7 + uKick * 0.25); // pre-drop heart
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
  col += uPal2 * pow(r2, 8.0) * (0.25 + uChoir * 1.4 + uBeat * 0.2); // choir sheen
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

// ── Finishing pass: soft bloom, hue drift, grade, grain, vignette ────────────
const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform sampler2D uGhost;
uniform float uTime, uBloom, uHueShift, uGrain, uVignette, uSaturation, uBrightness, uDrop, uGhostAmt;
float hash21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
vec3 hueRotate(vec3 c, float a) {
  const vec3 W = vec3(0.299, 0.587, 0.114);
  float cs = cos(a), sn = sin(a);
  return vec3(dot(c, W)) + (c - vec3(dot(c, W))) * cs + cross(vec3(0.57735), c) * sn;
}
void main() {
  vec3 col = texture(uTex, vUv).rgb;
  col += texture(uGhost, vUv).rgb * uGhostAmt; // dissolving lyrics join the field
  if (uBloom > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      vec2 o = vec2(cos(a), sin(a)) / uRes;
      acc += max(texture(uTex, vUv + o * 5.0).rgb - 0.35, 0.0);
      acc += max(texture(uTex, vUv + o * 12.0).rgb - 0.35, 0.0) * 0.6;
    }
    col += acc * (uBloom * 0.13);
  }
  if (abs(uHueShift) > 0.001) col = hueRotate(col, uHueShift * 6.2831853);
  // ── ANTICIPATION ── the world tenses as the drop approaches (uDrop 0→1
  // over the last bars before a measured riser lands): the vignette closes
  // in, color drains, light dims — then the drop's kick/nova is the release.
  float vig = 1.0 - (uVignette + uDrop * 0.30) * pow(length(vUv - 0.5) * 1.4, 2.2);
  col *= max(vig, 0.0) * uBrightness * (1.0 - uDrop * 0.18);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uSaturation * (1.0 - uDrop * 0.35));
  col += (hash21(vUv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}`;

export const BACKDROP_SCENES = ["AURORA", "EMBERS", "INK"] as const;
const SCENE_SOURCES = [AURORA_FS, EMBERS_FS, INK_FS];

// ── Registry: the backdrop's whole control surface ──────────────────────────
P.register({ id: "backdrop.enabled", label: "Enabled", group: "BACKDROP", type: "bool", value: true });
P.register({ id: "backdrop.scene", label: "Scene", group: "BACKDROP", type: "select", options: ["AUTO", ...BACKDROP_SCENES], value: "AUTO" });
P.register({ id: "backdrop.intensity", label: "Intensity", group: "BACKDROP", min: 0, max: 2, value: 1 });
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
// Word ghosts: dying lyrics dissolve into the field (0 = off).
P.register({ id: "backdrop.ghosts", label: "Word Ghosts", group: "BACKDROP", min: 0, max: 1, value: 0.5 });
P.register({ id: "backdrop.ghostFade", label: "Ghost Fade", group: "BACKDROP", min: 0.9, max: 0.995, value: 0.975 });
P.register({ id: "backdrop.ghostRise", label: "Ghost Rise", group: "BACKDROP", min: 0, max: 1, value: 0.35 });

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

export class BackdropRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private scenes: Program[];
  private trails: Program;
  private post: Program;
  private ghostDecay: Program;
  private stamp: Program;
  private rts: { a: RT; ping: RT; pong: RT; ghostPing: RT; ghostPong: RT } | null = null;
  private time = 0;
  private pal: [number, number, number][] = [[0.3, 0.8, 1], [1, 0.3, 0.6], [1, 0.85, 0.4]];
  private seed = 0;
  private sceneIdx = 0;
  // one shared rasterizer for ghost words: text → alpha texture, per stamp
  private ghostCanvas: HTMLCanvasElement;
  private ghostCtx: CanvasRenderingContext2D | null;
  private ghostTex: WebGLTexture;

  constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    this.gl = gl;
    this.canvas = canvas;
    this.scenes = SCENE_SOURCES.map((src) => new Program(gl, QUAD_VS, src));
    this.trails = new Program(gl, QUAD_VS, TRAILS_FS);
    this.post = new Program(gl, QUAD_VS, POST_FS);
    this.ghostDecay = new Program(gl, QUAD_VS, GHOST_DECAY_FS);
    this.stamp = new Program(gl, STAMP_VS, STAMP_FS);
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
    const h = fnv1a(seedStr);
    this.seed = (h % 1000) / 1000;
    this.sceneIdx = h % SCENE_SOURCES.length;
    this.time = 0;
  }

  private resize(scale: number) {
    const gl = this.gl;
    const w = Math.max(2, Math.round(this.canvas.width * scale));
    const h = Math.max(2, Math.round(this.canvas.height * scale));
    if (this.rts && this.rts.a.w === w && this.rts.a.h === h) return;
    if (this.rts) for (const rt of Object.values(this.rts)) disposeRT(gl, rt);
    this.rts = {
      a: createRT(gl, w, h),
      ping: createRT(gl, w, h),
      pong: createRT(gl, w, h),
      ghostPing: createRT(gl, w, h),
      ghostPong: createRT(gl, w, h),
    };
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
    const color = this.pal[fnv1a(g.word) % 2 === 0 ? 2 : 1];
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

  render(F: EngineFeatures, renderScale = 0.5) {
    const gl = this.gl;
    this.resize(renderScale);
    if (!this.rts) return;
    const { a, ping, pong, ghostPing, ghostPong } = this.rts;
    // Anticipation: 0 far from a drop, →1 over the last 16 beats before a
    // measured riser resolves. Ground truth from the bus — the field knows
    // the drop is coming and holds its breath (time itself slows a little).
    const drop = (F.beatsToDrop === Infinity ? 0 : Math.max(0, Math.min(1, 1 - F.beatsToDrop / 16))) * P.get("backdrop.anticipation");
    this.time += F.dt * P.get("backdrop.flow") * (1 - drop * 0.35);

    // scene select: AUTO = the song's own seeded pick
    const chosen = P.getStr("backdrop.scene");
    const idx = chosen === "AUTO" ? this.sceneIdx : Math.max(0, BACKDROP_SCENES.indexOf(chosen as typeof BACKDROP_SCENES[number]));
    const [p0, p1, p2] = this.pal;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    bindRT(gl, a);
    this.scenes[idx].use()
      .v2("uRes", a.w, a.h)
      .f("uTime", this.time)
      .f("uSeed", this.seed)
      .f("uDrums", F.drums).f("uBass", F.bass).f("uVoice", F.voice).f("uChoir", F.choir).f("uBed", F.bed)
      .f("uLevel", F.level).f("uKick", F.kick).f("uBeat", F.beat).f("uBeatPhase", F.beatPhase)
      .f("uCharge", F.charge).f("uEmo", F.sectionIntensity)
      .f("uWordPulse", F.wordPulse)
      .f("uIntensity", P.get("backdrop.intensity"))
      .v2("uWord", F.wordX, 1 - F.wordY) // DOM y-down → GL y-up
      .v3("uPal0", p0[0], p0[1], p0[2])
      .v3("uPal1", p1[0], p1[1], p1[2])
      .v3("uPal2", p2[0], p2[1], p2[2]);
    drawQuad(gl);

    bindRT(gl, ping);
    this.trails.use()
      .f("uAmount", P.get("backdrop.trails"))
      .f("uZoom", P.get("backdrop.trailZoom"))
      .f("uRotate", P.get("backdrop.trailRotate"))
      .tex("uCur", a.tex)
      .tex("uPrev", pong.tex);
    drawQuad(gl);

    // ── word ghosts: decay + drift the buffer upward, then stamp this
    // frame's dying words into it (still bound) ──
    const ghostAmt = P.get("backdrop.ghosts");
    bindRT(gl, ghostPing);
    this.ghostDecay.use()
      .f("uDecay", P.get("backdrop.ghostFade"))
      .f("uRise", P.get("backdrop.ghostRise") * 0.0012)
      .tex("uPrev", ghostPong.tex);
    drawQuad(gl);
    const dying = featureBus.drainGhosts(); // drain even while off — no backlog
    if (ghostAmt > 0.001) for (const g of dying) this.stampGhost(g);

    bindRT(gl, null);
    this.post.use()
      .v2("uRes", this.canvas.width, this.canvas.height)
      .f("uTime", this.time)
      .f("uBloom", P.get("backdrop.bloom"))
      .f("uHueShift", P.get("backdrop.hueShift"))
      .f("uGrain", P.get("backdrop.grain"))
      .f("uVignette", P.get("backdrop.vignette"))
      .f("uSaturation", P.get("backdrop.saturation"))
      .f("uBrightness", P.get("backdrop.brightness"))
      .f("uDrop", drop)
      .f("uGhostAmt", ghostAmt)
      .tex("uTex", ping.tex)
      .tex("uGhost", ghostPing.tex);
    drawQuad(gl);

    [this.rts.ping, this.rts.pong] = [this.rts.pong, this.rts.ping];
    [this.rts.ghostPing, this.rts.ghostPong] = [this.rts.ghostPong, this.rts.ghostPing];
  }

  dispose() {
    const gl = this.gl;
    for (const s of this.scenes) s.dispose();
    this.trails.dispose();
    this.post.dispose();
    this.ghostDecay.dispose();
    this.stamp.dispose();
    gl.deleteTexture(this.ghostTex);
    if (this.rts) { for (const rt of Object.values(this.rts)) disposeRT(gl, rt); this.rts = null; }
  }
}
