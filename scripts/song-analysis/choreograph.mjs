#!/usr/bin/env node
// Interaction choreographer: the local LLM decides how each song's planet
// responds to TOUCH — which effect tapping a word triggers in this song's
// world, and where wipe-layer moments live on the timeline.
//
//   node choreograph.mjs --out interactions.json
//
// Output per track: { tapEffect, moments: [{t, end, type:"wipe", layer, prompt}] }
// tapEffect ∈ burn | shatter | dissolve | bloom  (the engine's tap vocabulary)
// wipe layer ∈ ash | frost | steam | fog | static

import { writeFileSync } from "node:fs";

const OLLAMA = "http://localhost:11434";
const MODEL = "qwen2.5:14b";
const SUPA = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const KEY = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-";

const outIdx = process.argv.indexOf("--out");
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : "interactions.json";

const TAP_EFFECTS = ["burn", "shatter", "dissolve", "bloom"];
const LAYERS = ["ash", "frost", "steam", "fog", "static"];

async function llm(prompt) {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ model: MODEL, prompt, stream: false, format: "json", options: { temperature: 0.4, num_ctx: 8192 } }),
  });
  const data = await res.json();
  return JSON.parse(data.response);
}

const rows = await (await fetch(
  `${SUPA}/rest/v1/tracks?select=id,title,planet&planet=not.is.null`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
)).json();

const results = {};
for (const row of rows) {
  const a = row.planet.analysis;
  const sections = a.sections.map((s) => ({ name: s.name, emotion: s.emotion, start: s.start, intensity: s.intensity }));
  const prompt = `You are choreographing TOUCH INTERACTIONS for an animated lyric-video "planet" of the song "${row.title}".

SONG SUMMARY: ${a.summary}
THEMES: ${(a.themes || []).join(", ")}
VISUAL WORLD: ${row.planet.styleHint || ""}
SECTIONS (with start times in seconds): ${JSON.stringify(sections)}

Choose interactions that fit THIS song's world and meaning (never generic):
1. "tapEffect": what happens when a listener taps a lyric word in this song. Pick ONE from ${JSON.stringify(TAP_EFFECTS)}.
   - burn = word ignites to ash (fire/anger/defiance worlds)
   - shatter = word breaks like glass (breakup/impact/paranoia worlds)
   - dissolve = word mists away (dreamy/sad/ethereal worlds)
   - bloom = word sprouts glowing petals (love/healing/joy worlds)
2. "moments": 1 to 3 wipe-layer moments. During each, a translucent layer covers the screen and the listener wipes it off with their finger. Each moment:
   - "start": MUST equal one of the section start times above (pick quiet/atmospheric or thematically fitting sections, e.g. intros, bridges, breakdowns)
   - "end": start + 12 to 20 seconds
   - "layer": ONE of ${JSON.stringify(LAYERS)} fitting the song's world (ash for fire/smoke, frost for cold/distance, steam for boilers/tropics, fog for rivers/mystery, static for digital noise)
   - "prompt": a SHORT on-screen instruction in the song's voice, max 5 words (e.g. "wipe the ash away")

Reply with JSON exactly: {"tapEffect": "...", "moments": [{"start": <num>, "end": <num>, "layer": "...", "prompt": "..."}]}`;

  try {
    const r = await llm(prompt);
    const tapEffect = TAP_EFFECTS.includes(r.tapEffect) ? r.tapEffect : "dissolve";
    const starts = new Set(sections.map((s) => s.start));
    const moments = (Array.isArray(r.moments) ? r.moments : [])
      .filter((m) => typeof m.start === "number" && LAYERS.includes(m.layer))
      .map((m) => ({
        t: starts.has(m.start) ? m.start : [...starts].reduce((b, s) => Math.abs(s - m.start) < Math.abs(b - m.start) ? s : b, [...starts][0]),
        end: Math.min((typeof m.end === "number" && m.end > m.start ? m.end : m.start + 15), m.start + 22),
        type: "wipe",
        layer: m.layer,
        prompt: String(m.prompt || "wipe the screen").slice(0, 40),
      }))
      .slice(0, 3);
    results[row.id] = { tapEffect, moments };
    console.log(`  ${row.id}: tap=${tapEffect} moments=${moments.map((m) => `${m.layer}@${m.t}`).join(",") || "none"}`);
  } catch (e) {
    console.error(`  ${row.id}: FAILED ${e.message}`);
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`done -> ${OUT}`);
