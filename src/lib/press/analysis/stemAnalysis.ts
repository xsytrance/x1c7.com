// vendored-from: /home/xsyprime/kinetica/src/audio/stemAnalysis.ts (loudness,
// band-split onset picks, autocorrelation BPM, cuts) — keep in step
// (docs/ENGINE-SYNC.md). Adapted for the plant: adds section derivation, the
// band roster, and the R3 side-split. Pure DSP; nothing leaves the device.

import { classifyStem, type LoadedStems, type StemRole } from "./stemZip";

const ENV_HZ = 12.5;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface StemFacts {
  bpm: number;
  duration: number;
  roster: { role: StemRole; name: string }[];
  sections: { name: string; start: number; intensity: number }[];
  sideSplit: number | null;      // seconds — where the tape wants to flip
  peaks: number[];               // 96-bucket mix waveform
}

function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const n = buf.length, out = new Float32Array(n), chs = buf.numberOfChannels;
  for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / chs; }
  return out;
}

function loudness(mono: Float32Array, sr: number, hz = ENV_HZ): number[] {
  const hop = Math.max(1, Math.round(sr / hz));
  const n = Math.floor(mono.length / hop);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const base = i * hop;
    for (let j = 0; j < hop; j++) { const v = mono[base + j]; s += v * v; }
    const db = 20 * Math.log10(Math.sqrt(s / hop) + 1e-9);
    out[i] = Math.round(Math.max(0, Math.min(1, (db + 50) / 50)) * 99);
  }
  return out;
}

function rmsEnv(mono: Float32Array, sr: number, hz: number): { env: Float32Array; hz: number } {
  const hop = Math.max(1, Math.round(sr / hz));
  const n = Math.floor(mono.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const base = i * hop;
    for (let j = 0; j < hop; j++) { const v = mono[base + j]; s += v * v; }
    env[i] = Math.sqrt(s / hop);
  }
  return { env, hz };
}

async function lowband(buf: AudioBuffer): Promise<Float32Array> {
  const oac = new OfflineAudioContext(1, buf.length, buf.sampleRate);
  const src = oac.createBufferSource(); src.buffer = buf;
  const f = oac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 110; f.Q.value = 0.7;
  src.connect(f); f.connect(oac.destination); src.start();
  return (await oac.startRendering()).getChannelData(0);
}

function estimateBpm(env: Float32Array, hz: number): number {
  const minLag = Math.round(hz * 60 / 200), maxLag = Math.round(hz * 60 / 60);
  let best = minLag, bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag];
    if (s > bestScore) { bestScore = s; best = lag; }
  }
  return Math.round((60 * hz) / best);
}

/** Sections from the summed loudness contour: boundaries at strong sustained
 *  level changes, names from relative intensity. */
function deriveSections(total: number[], duration: number): StemFacts["sections"] {
  const smooth: number[] = total.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - 25); j < Math.min(total.length, i + 25); j++) { s += total[j]; n++; }
    return s / Math.max(1, n);
  });
  const boundaries = [0];
  const minGapF = 8 * ENV_HZ;
  for (let i = 1; i < smooth.length - 1; i++) {
    const before = smooth[Math.max(0, i - Math.round(4 * ENV_HZ))];
    const jump = Math.abs(smooth[i] - before);
    if (jump > 14 && i - boundaries[boundaries.length - 1] > minGapF) boundaries.push(i);
  }
  const max = Math.max(1, ...smooth);
  const named = boundaries.slice(0, 9).map((b, idx) => {
    const next = boundaries[idx + 1] ?? smooth.length;
    const seg = smooth.slice(b, next);
    const level = seg.reduce((a, v) => a + v, 0) / Math.max(1, seg.length) / max;
    const name = idx === 0 ? "INTRO"
      : b / ENV_HZ > duration - 20 ? "OUT"
      : level > 0.8 ? "DROP" : level > 0.55 ? "RIDE" : level > 0.3 ? "LIFT" : "BREAK";
    return { name, start: r3(b / ENV_HZ), intensity: +level.toFixed(2) };
  });
  // de-dupe consecutive same names for readability
  return named.filter((s, i) => i === 0 || s.name !== named[i - 1].name || s.name === "DROP");
}

export async function analyzeStemFacts(stems: LoadedStems, onProgress?: (m: string) => void): Promise<StemFacts> {
  const { roles, sampleRate: sr, duration, names } = stems;
  onProgress?.("measuring the band…");

  const envs: Partial<Record<StemRole, number[]>> = {};
  for (const role of Object.keys(roles) as StemRole[]) {
    const b = roles[role]; if (!b) continue;
    envs[role] = loudness(toMono(b), sr);
  }

  let bpm = 120;
  const drums = roles.drums ?? roles.other ?? roles.bass;
  if (drums) {
    onProgress?.("measuring the beat…");
    const low = await lowband(drums);
    const kEnv = rmsEnv(low, sr, 50);
    const onset = new Float32Array(kEnv.env.length);
    for (let i = 1; i < kEnv.env.length; i++) onset[i] = Math.max(0, kEnv.env[i] - kEnv.env[i - 1]);
    bpm = estimateBpm(onset, kEnv.hz);
    if (bpm < 85 && bpm * 2 <= 200) bpm *= 2;
  }

  // summed contour → sections; mix waveform from the sum of role envelopes
  const len = Math.max(...Object.values(envs).map((e) => e!.length), 1);
  const total = new Array<number>(len).fill(0);
  for (const e of Object.values(envs)) for (let i = 0; i < e!.length; i++) total[i] += e![i];
  const sections = deriveSections(total, duration);

  const buckets = 96, peaks = new Array<number>(buckets).fill(0);
  for (let i = 0; i < total.length; i++) {
    const b = Math.min(buckets - 1, Math.floor((i / total.length) * buckets));
    if (total[i] > peaks[b]) peaks[b] = total[i];
  }
  const pMax = Math.max(...peaks, 1e-6);

  // side-split: the section boundary nearest the midpoint (never the very start)
  const mid = duration / 2;
  const candidates = sections.map((s) => s.start).filter((t) => t > duration * 0.25 && t < duration * 0.75);
  const sideSplit = candidates.length ? candidates.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) : null;

  const roster = (Object.keys(roles) as StemRole[]).map((role) => ({
    role,
    name: names.find((n) => classifyStem(n) === role) ?? role,
  }));

  return { bpm, duration: r3(duration), roster, sections, sideSplit, peaks: peaks.map((v) => +(v / pMax).toFixed(3)) };
}

