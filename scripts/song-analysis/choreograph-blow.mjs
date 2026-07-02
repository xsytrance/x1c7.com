#!/usr/bin/env node
// Breath choreographer: the local LLM places 0-2 BLOW moments per planet —
// spots where blowing into the mic means something in the song's world
// (blow out a candle, scatter ash, clear river fog, send a goodbye kiss).
// Merges into existing planet.interactions.moments without touching wipes.
//
//   node choreograph-blow.mjs --out blow.json

import { writeFileSync } from "node:fs";

const OLLAMA = "http://localhost:11434";
const MODEL = "qwen2.5:14b";
const SUPA = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const KEY = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-";
const outIdx = process.argv.indexOf("--out");
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : "blow.json";

async function llm(prompt) {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ model: MODEL, prompt, stream: false, format: "json", options: { temperature: 0.5, num_ctx: 8192 } }),
  });
  return JSON.parse((await res.json()).response);
}

const rows = await (await fetch(
  `${SUPA}/rest/v1/tracks?select=id,title,planet&planet=not.is.null`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
)).json();

const results = {};
for (const row of rows) {
  const ix = row.planet.interactions || {};
  if ((ix.moments || []).some((m) => m.type === "blow")) { console.log(`  ${row.id}: already has a blow moment, skipping`); continue; }
  const a = row.planet.analysis;
  const sections = a.sections.map((s) => ({ name: s.name, emotion: s.emotion, start: s.start, intensity: s.intensity }));
  const busy = (ix.moments || []).map((m) => [m.t, m.end]);
  const prompt = `You are choreographing a BREATH interaction for the animated lyric-video "planet" of the song "${row.title}". At the chosen moment, the listener BLOWS INTO THE MICROPHONE and a gust sweeps the scene (wind streaks, the scene dims like a blown flame, then returns).

SONG SUMMARY: ${a.summary}
THEMES: ${(a.themes || []).join(", ")}
VISUAL WORLD: ${row.planet.styleHint || ""}
SECTIONS (start times in seconds): ${JSON.stringify(sections)}
ALREADY-BUSY windows (do NOT overlap these): ${JSON.stringify(busy)}

Pick 1 (or at most 2) moments where BLOWING carries the song's meaning — e.g. blowing away fog on a river, scattering ashes or petals, blowing out a flame, blowing a kiss goodbye, dispersing smoke or static. Prefer outros, breakdowns, and quiet bridges. Each moment:
- "start": MUST equal one of the section start times, and its window must not overlap the busy list
- "end": start + 10 to 14 seconds
- "prompt": SHORT instruction in the song's voice, max 5 words, starting with "blow" (e.g. "blow the fog away")

If NO moment truly fits this song, return {"moments": []}.
Reply with JSON exactly: {"moments": [{"start": <num>, "end": <num>, "prompt": "..."}]}`;

  try {
    const r = await llm(prompt);
    const starts = new Set(sections.map((s) => s.start));
    const overlaps = (t, e) => busy.some(([bt, be]) => t < be && e > bt);
    const moments = (Array.isArray(r.moments) ? r.moments : [])
      .filter((m) => typeof m.start === "number" && starts.has(m.start))
      .map((m) => ({ t: m.start, end: Math.min(m.start + 14, typeof m.end === "number" && m.end > m.start ? m.end : m.start + 12), type: "blow", layer: "", prompt: String(m.prompt || "blow").slice(0, 40) }))
      .filter((m) => !overlaps(m.t, m.end))
      .slice(0, 2);
    results[row.id] = moments;
    console.log(`  ${row.id}: ${moments.map((m) => `"${m.prompt}"@${m.t}`).join(", ") || "none"}`);
  } catch (e) {
    console.error(`  ${row.id}: FAILED ${e.message}`);
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`done -> ${OUT}`);
