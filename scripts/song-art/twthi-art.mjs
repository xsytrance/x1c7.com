#!/usr/bin/env node
// THE WORLD THAT HEARD ITSELF — the art planet, generated locally.
//
// Eleventh voice: THE AUDIBLE DESERT — Dalí-grade surrealist oil. The song is
// a creation myth where sounds become physical bodies, so every plate paints
// the lyric's literal miracle on one continuous desert stage: razor-flat
// horizon, cavernous twilight sky, long impossible shadows, ochre-and-teal
// with molten gold. ABSOLUTELY NO HUMANS (owner order) — the narrator is the
// unseen voice speaking the world into being, which the style makes natural.
//
// Cloud balance is still dead (err_insufficent_credits since DTTG), so this
// runs on the box. SDXL ONLY: the DiT engines (flux2/chroma) wedged ComfyUI
// mid-load on this box on 2026-08-03 — same failure mode as the PRIME freeze,
// still unfixed — so this cut stays on the checkpoints DTTG proved reliable:
// DreamShaperXL Turbo (painterly) + Juggernaut XL (photoreal grade).
// Native portrait 832×1472 per the 2026-08-01 owner law.
//
//   node scripts/song-art/twthi-art.mjs            # generate all candidates
//   node scripts/song-art/twthi-art.mjs --only ear # one scene
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HOST = "http://localhost:8188";
const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "scripts/song-art/twthi-out");
mkdirSync(OUT, { recursive: true });
const W = 832, H = 1472;

const VOICE =
  ", surrealist oil painting in the style of Salvador Dali, vast empty desert plain, razor-flat" +
  " horizon, cavernous twilight sky, deep single-point perspective, long impossible shadows," +
  " muted ochre and deep teal palette with molten gold accents, hyper-detailed classical oil" +
  " rendering, smooth blended brushwork, empty unpeopled world, monumental, dreamlike, no text";

const NEG =
  "person, people, human, man, woman, child, figure, face, portrait, hands, fingers, body, skin," +
  " silhouette, crowd, text, letters, words, numbers, watermark, signature, logo, frame," +
  " border, photograph, photo, 3d render, low quality, blurry, oversaturated, cartoon";

// (name, lyric it illustrates, scene)
const SCENES = [
  ["keep",    "So keep this world with me",
   "a small luminous blue-green planet resting inside a giant cracked glass bell jar half buried in desert sand, warm golden light leaking out through the crack, tiny against the enormous empty plain"],
  // one plate serves BOTH "I said, Light" and "Rain into light" — the two
  // keywords resolve the same URL so their 0.81s double-fire never cuts
  ["light",   "I said, Light / Rain into light",
   "a single vertical tear ripping open in a black night sky, blinding molten-gold light pouring through the rip, and rain rising upward from the dark ground into the tear, each rising drop igniting into a small hanging star of golden light"],
  ["gold",    "And the melody turned gold",
   "a grand piano melting like soft liquid gold over the edge of a stone cliff, the drips hardening into golden musical notes that hang from thin wires against the twilight sky"],
  ["move",    "I said, Move",
   "a procession of colossal stone monoliths leaning forward mid-stride across the desert as if walking, sand cascading off them, each casting a long shadow toward the horizon"],
  ["gravity", "And gravity found the beat",
   "planets hanging low from the sky on visible taut strings like pendulum bobs, the lowest sphere striking a desert floor stretched tight as a drumhead, concentric ripples frozen in the sand"],
  ["live",    "I said, Live",
   "a lone dead tree on a dune erupting into bloom, its branches flowering with small glowing brass trumpet blossoms and drifting luminous seed-orbs of light rising into the dusk"],
  ["home",    "And every sound came home",
   "one open doorway standing alone in the middle of the desert with warm gold light flooding out of it, a long stream of violins, horns and glowing musical notes flying toward the door like migrating birds"],
  ["ear",     "Every sound becomes a body",
   "a colossal human-scale mountain shaped like a smooth marble ear rising out of the desert, waterfalls of liquid golden light pouring down into its folds from the clouds above"],
  ["breathe", "Every echo learns to breathe",
   "an infinite colonnade of stone arches receding to the horizon, the arches gently warped as if inhaling, concentric rings of cloud radiating outward across the sky above them like ripples from a breath"],
  ["silence", "What the noise creates, the silence takes",
   "the scene split diagonally in two: the lower half rich with golden brass instruments and warm colour, the upper half a blank white void, the instruments crumbling into pale sand exactly at the dividing line"],
  ["world",   "So keep this world with me",
   "a huge luminous blue-green planet hanging low over the desert, cradled inside a rising whirlpool of thousands of swirling sheet-music pages lifting off the sand like a tornado of paper"],
  ["brass",   "Voices into brass",
   "a deep canyon whose walls are made of colossal fused golden trumpets, tubas and french horns grown into the rock, pale morning mist drifting through their enormous bells"],
  ["drums",   "Steps into drums",
   "the desert floor stretched into a patchwork of taut circular drumskins, a trail of giant empty footprint craters pressed across them, each crater still rippling, no one anywhere"],
  ["bass",    "Blood into bass",
   "a dark crimson river winding through black dunes into a whale-sized wooden double bass lying half buried like a shipwreck, its strings vibrating, slow heartbeat ripples spreading across the red water"],
  ["rain",    "Rain into light",
   "rain falling upward from a midnight ocean into the sky, each rising drop igniting into a small hanging star of golden light, the sky strung with thousands of glowing suspended notes"],
  ["alive",   "Every echo... alive",
   "a vast panorama of an impossible desert seen from above: an ear-shaped mountain, a canyon of golden trumpets, planets on strings, upward rain and a glowing doorway all tiny in one enormous breathing landscape, everything faintly glowing"],
  ["stopped", "Then I stopped speaking",
   "the same impossible desert draining of all colour into ash grey, its golden instruments deflating and melting into the sand, stars guttering out one by one, a single jagged black crack splitting the sky in half"],
];

const sdxl = ({ ckpt, steps, cfg, sampler, scheduler, loras = [] }) => ({ prompt, seed }) => {
  const g = { "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } } };
  let model = ["1", 0], clip = ["1", 1];
  loras.forEach(([name, strength], i) => {
    g[`L${i}`] = { class_type: "LoraLoader", inputs: { model, clip, lora_name: name, strength_model: strength, strength_clip: strength } };
    model = [`L${i}`, 0]; clip = [`L${i}`, 1];
  });
  Object.assign(g, {
    "2": { class_type: "CLIPTextEncode", inputs: { clip, text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip, text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model, positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "twthi" } },
  });
  return g;
};
const dreamGraph = sdxl({ ckpt: "DreamShaperXL_Turbo_v2_1.safetensors", steps: 7, cfg: 2, sampler: "dpmpp_sde", scheduler: "karras" });
const juggGraph = sdxl({ ckpt: "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors", loras: [["sdxl_lightning_8step_lora.safetensors", 1]], steps: 8, cfg: 1.5, sampler: "euler", scheduler: "sgm_uniform" });

const fnv1a = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

async function submit(graph) {
  const res = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: graph }) });
  if (!res.ok) throw new Error(`submit ${res.status}: ${await res.text()}`);
  return (await res.json()).prompt_id;
}
async function waitFor(id) {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    // ComfyUI's HTTP thread can stall for minutes while a DiT engine loads;
    // a timed-out poll is not a failed job — just poll again.
    let h;
    try { h = await (await fetch(`${HOST}/history/${id}`, { signal: AbortSignal.timeout(20000) })).json(); }
    catch { continue; }
    if (h[id]) {
      const st = h[id].status;
      if (st && st.status_str === "error") throw new Error(`comfy error: ${JSON.stringify(st.messages).slice(0, 400)}`);
      const imgs = Object.values(h[id].outputs).flatMap((o) => o.images || []);
      if (imgs.length) return imgs[0];
    }
  }
}
async function fetchImage(info, dest) {
  const url = `${HOST}/view?filename=${encodeURIComponent(info.filename)}&subfolder=${encodeURIComponent(info.subfolder || "")}&type=${info.type}`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
// engine-grouped so the GPU never thrashes model reloads
for (const [engine, graphFn, seeds] of [["dream", dreamGraph, [11, 12]], ["jugg", juggGraph, [21, 22]]]) {
  for (const [name, lyric, scene] of SCENES) {
    if (only && name !== only) continue;
    const prompt = scene + VOICE;
    for (const s of seeds) {
      const dest = join(OUT, `${name}-${engine}-${s}.png`);
      if (existsSync(dest)) { console.error(`· ${name}-${engine}-${s} exists`); continue; }
      const seed = (fnv1a(`twthi:${name}:${engine}:${s}`) % 2 ** 31) + s;
      const t0 = Date.now();
      const info = await waitFor(await submit(graphFn({ prompt, seed })));
      const bytes = await fetchImage(info, dest);
      console.error(`✓ ${name}-${engine}-${s}  ${(bytes / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(0)}s  [${lyric}]`);
    }
  }
}
console.error("done");
