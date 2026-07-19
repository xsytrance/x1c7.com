// FREE-tier audio facts — one decode, everything measured on-device.
// vendored-from: /home/xsyprime/kinetica/src/audio/stemAnalysis.ts
//   (estimateBpm autocorrelation recipe; envelope approach) — keep in step,
//   see docs/ENGINE-SYNC.md. No network. Ever.
//
// Also fixes the latent Safari quirk the old /covers/make path had:
// OfflineAudioContext at 8000Hz is rejected on WebKit — we decode at 44100
// and derive everything from the buffer.

export interface AudioFacts {
  duration: number;          // seconds
  runtime: string;           // "3:42"
  peaks: number[];           // 96 max-abs buckets, normalized 0..1
  bpm: number | null;        // autocorrelation estimate (mark as estimate in UI)
}

export const fmtTime = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };

async function decode(buf: ArrayBuffer): Promise<AudioBuffer | null> {
  try {
    return await new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf);
  } catch {
    try {
      // some engines only decode via a live context
      const ctx = new AudioContext();
      const out = await ctx.decodeAudioData(buf);
      void ctx.close();
      return out;
    } catch { return null; }
  }
}

export async function audioFacts(file: File): Promise<AudioFacts | null> {
  const audio = await decode(await file.arrayBuffer());
  if (!audio) return null;
  const data = audio.getChannelData(0);
  const sr = audio.sampleRate;

  // 96-bucket max-abs waveform (the collector shelf recipe)
  const buckets = 96, peaks = new Array(buckets).fill(0);
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    const b = Math.min(buckets - 1, Math.floor((i / data.length) * buckets));
    if (v > peaks[b]) peaks[b] = v;
  }
  const pMax = Math.max(...peaks, 1e-6);

  // 50Hz RMS envelope → onset strength → autocorrelation over 60–200 BPM
  const envHz = 50, win = Math.floor(sr / envHz);
  const env = new Float32Array(Math.floor(data.length / win));
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    const off = i * win;
    for (let j = 0; j < win; j++) { const v = data[off + j]; s += v * v; }
    env[i] = Math.sqrt(s / win);
  }
  const onset = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);
  let bpm: number | null = null;
  if (audio.duration > 15) {
    const minLag = Math.round(envHz * 60 / 200), maxLag = Math.round(envHz * 60 / 60);
    let best = minLag, bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = lag; i < onset.length; i++) s += onset[i] * onset[i - lag];
      if (s > bestScore) { bestScore = s; best = lag; }
    }
    bpm = Math.round((60 * envHz) / best);
    // fold obvious half-time reads up into the common dance range
    if (bpm < 85 && bpm * 2 <= 200) bpm *= 2;
  }

  return {
    duration: audio.duration,
    runtime: fmtTime(audio.duration),
    peaks: peaks.map((v) => +(v / pMax).toFixed(3)),
    bpm,
  };
}
