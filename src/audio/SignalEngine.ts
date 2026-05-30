// ============================================================
// SignalEngine — adapted from vAIb
// Procedural audio signal layer. Each track maps to unique
// audio parameters: energy, warmth, noise, complexity.
// ============================================================

import { type Track } from "@/data/tracks";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentGraph: any = null;
let isTunedIn = false;

const dbToGain = (db: number) => Math.pow(10, db / 20);
const now = () => audioCtx?.currentTime ?? 0;
const TC = 2.0;
const safeDb = (db: number) => Math.min(-18, db);
const setGain = (gainNode: GainNode | null, db: number, timeConstant = TC) => {
  if (!gainNode || !audioCtx) return;
  gainNode.gain.setTargetAtTime(dbToGain(safeDb(db)), now(), timeConstant);
};

function ensureContext(): boolean {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx.state === "running";
}

function trackToAudioParams(track: Track) {
  // Map track properties to audio parameters
  const energy = track.genre === "Techno" || track.genre === "Industrial" ? 0.8 :
                 track.genre === "Ambient" ? 0.3 : 0.6;
  const warmth = track.mood === "Dreaming" || track.mood === "Nostalgic" ? 0.8 :
                 track.mood === "Chaos" ? 0.2 : 0.5;
  const noise = track.genre === "Industrial" ? 0.7 :
                track.genre === "Ambient" ? 0.4 : 0.5;
  const complexity = track.durationSeconds > 240 ? 0.7 : 0.5;
  const bpm = track.genre === "Techno" ? 130 :
              track.genre === "Electronic" ? 120 :
              track.genre === "Ambient" ? 80 : 100;

  return {
    baseFreq: 55 + energy * 100,
    filterCutoff: 300 + complexity * 2000,
    sparkleRate: 5000 / (complexity * 2 + 0.5),
    pulseRate: bpm / 60,
    pulseDepth: energy * 0.3,
    stereoWidth: energy * 0.8,
    energy, warmth, noise, complexity, bpm,
  };
}

function buildGraph(track: Track) {
  if (!audioCtx) return null;
  const p = trackToAudioParams(track);
  const t = now();
  const nodes: any[] = [];
  const track_ = (n: any) => { nodes.push(n); return n; };

  const sigGain = track_(audioCtx.createGain());
  sigGain.gain.value = 0;
  const panner = track_(audioCtx.createStereoPanner());
  sigGain.connect(panner).connect(masterGain || audioCtx.destination);

  // Drone
  const osc1 = track_(audioCtx.createOscillator());
  const osc2 = track_(audioCtx.createOscillator());
  osc1.type = "sine"; osc2.type = "triangle";
  osc1.frequency.value = p.baseFreq;
  osc2.frequency.value = p.baseFreq * 1.5;

  const driftLFO = track_(audioCtx.createOscillator());
  driftLFO.frequency.value = 0.1;
  const driftDepth = track_(audioCtx.createGain());
  driftDepth.gain.value = 2;
  driftLFO.connect(driftDepth).connect(osc1.frequency);

  const droneGain = track_(audioCtx.createGain());
  droneGain.gain.value = dbToGain(-25 + p.warmth * 5);
  osc1.connect(droneGain); osc2.connect(droneGain);
  droneGain.connect(sigGain);

  // Noise texture
  const bufSize = audioCtx.sampleRate * 2;
  const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;

  const noiseSrc = track_(audioCtx.createBufferSource());
  noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;

  const nFilter = track_(audioCtx.createBiquadFilter());
  nFilter.type = "lowpass";
  nFilter.frequency.value = p.filterCutoff;
  nFilter.Q.value = 0.5;

  const ampLFO = track_(audioCtx.createOscillator());
  ampLFO.frequency.value = 0.05;
  const ampDepth = track_(audioCtx.createGain());
  ampDepth.gain.value = 0.3;
  ampLFO.connect(ampDepth);

  const textureGain = track_(audioCtx.createGain());
  textureGain.gain.value = dbToGain(-35 + p.noise * 8);
  ampDepth.connect(textureGain.gain);
  noiseSrc.connect(nFilter).connect(textureGain).connect(sigGain);

  // Sparkle gain
  const sparkleGain = track_(audioCtx.createGain());
  sparkleGain.gain.value = 1.0;
  sparkleGain.connect(sigGain);

  // Pulse
  const pulseOsc = track_(audioCtx.createOscillator());
  pulseOsc.type = "sine";
  pulseOsc.frequency.value = p.pulseRate;
  const pDepth = track_(audioCtx.createGain());
  pDepth.gain.value = p.pulseDepth;
  pulseOsc.connect(pDepth).connect(droneGain.gain);
  pulseOsc.connect(pulseOsc);

  // Stereo pan LFO
  const panLFO = track_(audioCtx.createOscillator());
  panLFO.frequency.value = 0.1;
  const panDepth = track_(audioCtx.createGain());
  panDepth.gain.value = p.stereoWidth * 0.3;
  panLFO.connect(panDepth).connect(panner.pan);

  osc1.start(t); osc2.start(t); driftLFO.start(t);
  noiseSrc.start(t); ampLFO.start(t);
  pulseOsc.start(t); panLFO.start(t);

  return { track, params: p, nodes, sigGain, droneGain, textureGain, nFilter, sparkleGain, pulseOsc, panner, panDepth, sparkleTimer: null };
}

function destroyGraph(g: any) {
  if (!g) return;
  if (g.sparkleTimer) { clearTimeout(g.sparkleTimer); g.sparkleTimer = null; }
  g.nodes.forEach((n: any) => {
    try { if (n?.stop) n.stop(); } catch (e) { /* noop */ }
    try { if (n?.disconnect) n.disconnect(); } catch (e) { /* noop */ }
  });
}

function scheduleSparkles(g: any) {
  if (!g || !audioCtx || !isTunedIn) return;
  if (g.sparkleTimer) clearTimeout(g.sparkleTimer);

  const next = g.params.sparkleRate * (0.5 + Math.random());
  g.sparkleTimer = setTimeout(() => {
    if (!isTunedIn || !audioCtx || audioCtx.state !== "running") return;
    try { if (g.sigGain.gain.value < 0.001) return; } catch (e) { return; }

    const freq = 2000 + Math.random() * 6000;
    const dur = 0.05 + Math.random() * 0.15;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;

    const t = now();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(dbToGain(-30), t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    if (g.sparkleGain) osc.connect(env).connect(g.sparkleGain);
    else osc.connect(env).connect(g.sigGain);
    osc.start(t); osc.stop(t + dur + 0.01);

    setTimeout(() => { try { osc.disconnect(); env.disconnect(); } catch (e) {} }, (dur + 0.05) * 1000);
    scheduleSparkles(g);
  }, next);
}

export const SignalEngine = {
  tuneIn(track: Track) {
    if (!track || !ensureContext()) return false;

    if (!masterGain) {
      masterGain = audioCtx!.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioCtx!.destination);
    }
    if (audioCtx!.state === "suspended") audioCtx!.resume();

    if (currentGraph) { destroyGraph(currentGraph); currentGraph = null; }

    currentGraph = buildGraph(track);
    isTunedIn = true;

    // Start with texture muted — drone only, then fade in
    if (currentGraph.textureGain) currentGraph.textureGain.gain.setValueAtTime(0, audioCtx!.currentTime);
    if (currentGraph.sparkleGain) currentGraph.sparkleGain.gain.setValueAtTime(0, audioCtx!.currentTime);

    setGain(currentGraph.sigGain, -20, 3.0);

    // Fade in texture after 3s
    setTimeout(() => {
      if (currentGraph?.textureGain) {
        currentGraph.textureGain.gain.setTargetAtTime(dbToGain(-35), audioCtx!.currentTime, 5);
      }
    }, 3000);

    // Full sparkle after 6s
    setTimeout(() => {
      if (currentGraph?.sparkleGain) {
        currentGraph.sparkleGain.gain.setTargetAtTime(dbToGain(-30), audioCtx!.currentTime, 5);
      }
    }, 6000);

    scheduleSparkles(currentGraph);
    return true;
  },

  mute() {
    if (!isTunedIn || !currentGraph) return false;
    isTunedIn = false;
    setGain(currentGraph.sigGain, -60, 2.0);
    if (currentGraph.sparkleTimer) { clearTimeout(currentGraph.sparkleTimer); currentGraph.sparkleTimer = null; }
    setTimeout(() => {
      if (currentGraph && !isTunedIn) { destroyGraph(currentGraph); currentGraph = null; }
    }, 2500);
    return true;
  },

  shift(track: Track) {
    if (!track || !audioCtx) return false;
    const old = currentGraph;
    currentGraph = buildGraph(track);
    isTunedIn = true;

    if (old) {
      const t = now();
      if (old.nFilter) old.nFilter.frequency.setTargetAtTime(200, t, TC);
      setGain(old.sigGain, -60, 2.0);
      if (old.sparkleTimer) { clearTimeout(old.sparkleTimer); old.sparkleTimer = null; }
    }

    const p = trackToAudioParams(track);
    if (currentGraph.nFilter) {
      currentGraph.nFilter.frequency.setValueAtTime(200, now());
      currentGraph.nFilter.frequency.setTargetAtTime(p.filterCutoff, now(), 3.0);
    }
    setGain(currentGraph.sigGain, -20, 3.0);
    scheduleSparkles(currentGraph);

    setTimeout(() => { if (old) destroyGraph(old); }, 2500);
    return true;
  },

  isActive() { return isTunedIn; },
};
