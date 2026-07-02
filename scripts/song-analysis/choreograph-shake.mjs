#!/usr/bin/env node
// Shake choreographer: the local LLM places 0-1 SHAKE moment per planet —
// a high-energy window where shaking the phone pays off big (stage quake +
// full gust + shockwave). Merges alongside existing wipe/blow moments.
import { writeFileSync } from "node:fs";
const OLLAMA = "http://localhost:11434", MODEL = "qwen2.5:14b";
const SUPA = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const KEY = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-";
const OUT = process.argv[process.argv.indexOf("--out") + 1] || "shake.json";

async function llm(prompt) {
  const res = await fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: MODEL, prompt, stream: false, format: "json", options: { temperature: 0.5, num_ctx: 8192 } }) });
  return JSON.parse((await res.json()).response);
}
const rows = await (await fetch(`${SUPA}/rest/v1/tracks?select=id,title,planet&planet=not.is.null`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
const results = {};
for (const row of rows) {
  const ix = row.planet.interactions || {};
  if ((ix.moments || []).some((m) => m.type === "shake")) { console.log(`  ${row.id}: has one, skip`); continue; }
  const a = row.planet.analysis;
  const sections = a.sections.map((s) => ({ name: s.name, emotion: s.emotion, start: s.start, intensity: s.intensity }));
  const busy = (ix.moments || []).map((m) => [m.t, m.end]);
  const prompt = `You are choreographing a SHAKE interaction for the lyric-video planet of "${row.title}". During the window the listener SHAKES THEIR PHONE and the whole stage quakes, wind rips through, and a shockwave fires.

SONG: ${a.summary}
WORLD: ${row.planet.styleHint || ""}
SECTIONS: ${JSON.stringify(sections)}
BUSY (no overlap): ${JSON.stringify(busy)}

Pick AT MOST ONE moment where shaking carries the song's energy — beat drops, biggest choruses, crowd chants (intensity >= 0.6 sections). Rules:
- "start" MUST equal a section start; window must not overlap busy
- "end": start + 8 to 12 seconds
- "prompt": max 5 words, imperative, starts with "shake" (e.g. "shake the block awake")
If nothing fits return {"moments": []}.
Reply JSON exactly: {"moments": [{"start": <num>, "end": <num>, "prompt": "..."}]}`;
  try {
    const r = await llm(prompt);
    const starts = new Set(sections.map((s) => s.start));
    const overlaps = (t, e) => busy.some(([bt, be]) => t < be && e > bt);
    const moments = (Array.isArray(r.moments) ? r.moments : [])
      .filter((m) => typeof m.start === "number" && starts.has(m.start))
      .map((m) => ({ t: m.start, end: Math.min(m.start + 12, m.end > m.start ? m.end : m.start + 10), type: "shake", layer: "", prompt: String(m.prompt || "shake!").slice(0, 40) }))
      .filter((m) => !overlaps(m.t, m.end)).slice(0, 1);
    results[row.id] = moments;
    console.log(`  ${row.id}: ${moments.map((m) => `"${m.prompt}"@${m.t}`).join(",") || "none"}`);
  } catch (e) { console.error(`  ${row.id}: FAILED ${e.message}`); }
}
writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`done -> ${OUT}`);
