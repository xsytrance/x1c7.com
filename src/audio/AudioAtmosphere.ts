// ============================================================
// AudioAtmosphere — adapted from vAIb Sacred Prototype
// Web Audio API ambient atmosphere. 4 layers: drone, texture,
// sparkle, pulse. Pure JavaScript, no external libraries.
// ============================================================

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let layers: Record<string, any> = {};
let isRunning = false;
let sparkleInterval: ReturnType<typeof setInterval> | null = null;
let currentRI = 0.7;

const dbToGain = (db: number) => Math.pow(10, db / 20);
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

function createImpulseResponse(duration = 2.0, decay = 2.0) {
  if (!audioCtx) return null;
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioCtx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const n = i / sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / duration, decay);
    }
  }
  return buffer;
}

function scheduleSparkles() {
  if (sparkleInterval) clearInterval(sparkleInterval);

  const trigger = () => {
    if (!isRunning || !audioCtx || audioCtx.state === "suspended") return;
    const chance = 0.2 + currentRI * 0.8;
    if (Math.random() > chance) return;

    const freq = 3000 + Math.random() * 5000;
    const duration = 0.05 + Math.random() * 0.15;

    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;

    env.gain.setValueAtTime(0, audioCtx.currentTime);
    env.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(env);
    env.connect(layers.sparkleGain);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration + 0.01);

    setTimeout(() => {
      try { osc.disconnect(); env.disconnect(); } catch (e) { /* noop */ }
    }, (duration + 0.05) * 1000);
  };

  const intervalMs = Math.max(200, 1000 - currentRI * 800);
  sparkleInterval = setInterval(trigger, intervalMs);
}

export function startAudioAtmosphere() {
  if (isRunning) return;

  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = dbToGain(-20);

  const masterPanner = audioCtx.createStereoPanner();
  masterPanner.pan.value = 0;

  const convolver = audioCtx.createConvolver();
  const ir = createImpulseResponse(1.5, 2.5);
  if (ir) convolver.buffer = ir;

  const reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.3;

  const dryGain = audioCtx.createGain();
  dryGain.gain.value = 1.0;

  // Layer 1: Drone
  const droneOsc1 = audioCtx.createOscillator();
  const droneOsc2 = audioCtx.createOscillator();
  droneOsc1.type = "sine";
  droneOsc2.type = "sine";
  droneOsc1.frequency.value = 55;
  droneOsc2.frequency.value = 82;

  const droneLFO = audioCtx.createOscillator();
  droneLFO.frequency.value = 0.1;
  const droneLFODepth = audioCtx.createGain();
  droneLFODepth.gain.value = 2;
  droneLFO.connect(droneLFODepth);
  droneLFODepth.connect(droneOsc1.frequency);

  const droneGain = audioCtx.createGain();
  droneGain.gain.value = dbToGain(-25);
  const dronePanner = audioCtx.createStereoPanner();
  dronePanner.pan.value = -0.2;

  droneOsc1.connect(droneGain);
  droneOsc2.connect(droneGain);
  droneGain.connect(dronePanner);
  dronePanner.connect(dryGain);
  dronePanner.connect(reverbGain);

  // Layer 2: Texture
  const noiseBufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, noiseBufferSize, audioCtx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  const textureSource = audioCtx.createBufferSource();
  textureSource.buffer = noiseBuffer;
  textureSource.loop = true;

  const textureFilter = audioCtx.createBiquadFilter();
  textureFilter.type = "lowpass";
  textureFilter.frequency.value = 800;
  textureFilter.Q.value = 0.5;

  const textureLFO = audioCtx.createOscillator();
  textureLFO.frequency.value = 0.05;
  const textureLFODepth = audioCtx.createGain();
  textureLFODepth.gain.value = 0.5;
  textureLFO.connect(textureLFODepth);

  const textureGain = audioCtx.createGain();
  textureGain.gain.value = 0.5;
  textureLFO.connect(textureLFODepth);
  textureLFODepth.connect(textureGain.gain);

  const texturePanner = audioCtx.createStereoPanner();
  texturePanner.pan.value = 0.3;

  textureSource.connect(textureFilter);
  textureFilter.connect(textureGain);
  textureGain.connect(texturePanner);
  texturePanner.connect(dryGain);
  texturePanner.connect(reverbGain);

  // Layer 3: Sparkle
  const sparkleGain = audioCtx.createGain();
  sparkleGain.gain.value = dbToGain(-40);
  const sparklePanner = audioCtx.createStereoPanner();
  sparklePanner.pan.value = 0.6;
  sparkleGain.connect(sparklePanner);
  sparklePanner.connect(dryGain);
  sparklePanner.connect(reverbGain);

  // Layer 4: Pulse
  const pulseOsc = audioCtx.createOscillator();
  pulseOsc.type = "sine";
  pulseOsc.frequency.value = 0.5;

  const pulseGain = audioCtx.createGain();
  pulseGain.gain.value = dbToGain(-35);
  const pulsePanner = audioCtx.createStereoPanner();
  pulsePanner.pan.value = 0;

  const pulseModDepth = audioCtx.createGain();
  pulseModDepth.gain.value = 0.15;
  pulseOsc.connect(pulseModDepth);
  pulseModDepth.connect(droneGain.gain);
  pulseOsc.connect(pulseGain);
  pulseGain.connect(pulsePanner);
  pulsePanner.connect(dryGain);
  pulsePanner.connect(reverbGain);

  // Reverb routing
  reverbGain.connect(convolver);
  convolver.connect(masterGain);
  dryGain.connect(masterGain);
  masterGain.connect(masterPanner);
  masterPanner.connect(audioCtx.destination);

  // Start
  droneOsc1.start();
  droneOsc2.start();
  droneLFO.start();
  textureSource.start();
  textureLFO.start();
  pulseOsc.start();

  layers = { droneGain, sparkleGain, masterGain, dronePanner, texturePanner, sparklePanner, reverbGain };
  isRunning = true;
  scheduleSparkles();

  if (audioCtx.state === "suspended") audioCtx.resume();
}

export function stopAudioAtmosphere() {
  if (!isRunning) return;
  if (sparkleInterval) { clearInterval(sparkleInterval); sparkleInterval = null; }
  try {
    Object.values(layers).forEach((node: any) => {
      if (node?.stop) try { node.stop(); } catch (e) { /* noop */ }
      if (node?.disconnect) try { node.disconnect(); } catch (e) { /* noop */ }
    });
  } catch (e) { /* ignore */ }
  if (audioCtx) try { audioCtx.close(); } catch (e) { /* noop */ }
  layers = {};
  audioCtx = null;
  masterGain = null;
  isRunning = false;
}

export function updateAudioAtmosphere(ri: number) {
  if (!isRunning || !audioCtx) return;
  currentRI = typeof ri === "number" ? ri : 0.7;
  const t = audioCtx.currentTime;
  const tc = 2.0;

  if (layers.droneGain) layers.droneGain.gain.setTargetAtTime(dbToGain(-25), t, tc);
  if (layers.texturePanner && (layers as any).textureGain) {
    (layers as any).textureGain.gain.setTargetAtTime(dbToGain(lerp(-40, -20, currentRI)), t, tc);
  }
  if (layers.sparkleGain) layers.sparkleGain.gain.setTargetAtTime(dbToGain(lerp(-50, -18, currentRI)), t, tc);
  if (layers.masterGain) layers.masterGain.gain.setTargetAtTime(dbToGain(Math.min(-18, lerp(-25, -20, currentRI))), t, tc);

  const stereoWidth = lerp(0.3, 1.0, currentRI);
  if (layers.dronePanner) layers.dronePanner.pan.setTargetAtTime(-0.4 * stereoWidth, t, tc);
  if (layers.texturePanner) layers.texturePanner.pan.setTargetAtTime(0.2 * stereoWidth, t, tc);
  if (layers.sparklePanner) layers.sparklePanner.pan.setTargetAtTime(0.6 * stereoWidth, t, tc);
  if (layers.reverbGain) layers.reverbGain.gain.setTargetAtTime(lerp(0.1, 0.5, currentRI), t, tc);

  scheduleSparkles();
}

export function isAtmosphereRunning() {
  return isRunning;
}
