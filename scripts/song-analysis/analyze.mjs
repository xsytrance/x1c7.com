#!/usr/bin/env node
// Song "planet" analysis via a local (or any OpenAI-ish) LLM.
// Feeds lyrics to the model and gets structured emotion/palette/imagery back,
// then attaches per-section start times parsed from the LRC lyrics.
//
// Usage: node analyze.mjs --in tracks.json --out planets.json [--model gemma4:12b] [--host http://localhost:11434]
// Input:  [{ id, title, artist, genre, mood, lyrics(LRC or plain) }]
// Output: [{ id, planet: { analysis, generatedAt:null }, ok, error }]

import { readFileSync, writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]]); return a;
}, []));
const HOST = args.host || "http://localhost:11434";
const MODEL = args.model || "qwen2.5:14b"; // strong JSON, no "thinking" channel

// Coerce "FF0000" / "#f00" / "red-ish" to #RRGGBB where possible.
function hex(v) {
  if (typeof v !== "string") return null;
  let h = v.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}
const LRC = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/;
const isHeader = (s) => /^\[.*\]$/.test(s.trim());
const stripTags = (s) => s.replace(new RegExp(LRC.source, "g"), "").trim();

// Section start times from the LRC: each [Header] starts at the first timed line after it.
function sectionTimes(lyrics) {
  const lines = lyrics.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const text = stripTags(lines[i]);
    if (isHeader(text)) {
      let start = null;
      for (let j = i + 1; j < lines.length; j++) {
        const m = lines[j].match(LRC);
        if (m) { start = +m[1] * 60 + +m[2] + (m[3] ? +`0.${m[3]}` : 0); break; }
      }
      out.push({ name: text.replace(/^\[|\]$/g, ""), start });
    }
  }
  return out;
}

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    overallMood: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    palette: { type: "object", properties: { primary: { type: "string" }, secondary: { type: "string" }, accent: { type: "string" }, bg: { type: "string" } }, required: ["primary", "secondary", "accent", "bg"] },
    sections: { type: "array", items: { type: "object", properties: { name: { type: "string" }, emotion: { type: "string" }, intensity: { type: "number" }, colorHint: { type: "string" } }, required: ["name", "emotion", "intensity", "colorHint"] } },
    keywords: { type: "array", items: { type: "object", properties: { word: { type: "string" }, emotion: { type: "string" }, imageryPrompt: { type: "string" } }, required: ["word", "emotion", "imageryPrompt"] } },
  },
  required: ["summary", "overallMood", "themes", "palette", "sections", "keywords"],
};

async function analyze(t) {
  const secs = sectionTimes(t.lyrics);
  const plain = t.lyrics.split("\n").map(stripTags).join("\n");
  const sectionNames = secs.map((s) => s.name);
  const sys = "You are a music analyst and art director. Analyze the song and respond with ONLY the requested JSON. " +
    "All colors must be #RRGGBB hex. intensity is 0..1 (calm..intense). Use the EXACT section names provided. " +
    "imageryPrompt: a vivid, concrete text-to-image prompt (no artist names) capturing that word's feeling for this song.";
  const user = `Title: ${t.title}\nArtist: ${t.artist}\nGenre: ${t.genre} · Mood: ${t.mood}\n` +
    (t.style ? `Producer's style prompt (authoritative for sound + vibe): ${t.style}\n` : "") +
    `Section names (use these exactly): ${JSON.stringify(sectionNames)}\n\nLYRICS:\n${plain}\n\n` +
    `Return JSON: summary (1-2 sentence interpretation of what the song is about), overallMood, themes (3-6), ` +
    `palette (4 hex colors capturing the vibe), sections (one per section name above, with emotion + intensity + colorHint hex), ` +
    `keywords (6-9 of the most emotionally-charged words, each with emotion + imageryPrompt).`;

  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, format: "json", think: false,
      options: { temperature: 0.6, num_predict: 2200 },
      messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.message?.content || "";
  writeFileSync(args.out + ".raw.json", raw);
  const analysis = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

  // Models sometimes key arrays as objects ({"Chorus":{...}}) — coerce, preserving
  // the key as `name` for sections.
  const toSecs = (v) => Array.isArray(v) ? v
    : (v && typeof v === "object" ? Object.entries(v).map(([name, o]) => (o && typeof o === "object" ? { name, ...o } : { name, emotion: String(o) })) : []);
  const arr = (v) => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
  // keywords may be keyed by the word ({"fire":{emotion,imageryPrompt}}) — keep the key.
  const toKw = (v) => Array.isArray(v) ? v
    : (v && typeof v === "object" ? Object.entries(v).map(([word, o]) => (o && typeof o === "object" ? { word, ...o } : { word, emotion: String(o) })) : []);
  analysis.sections = toSecs(analysis.sections);
  analysis.keywords = toKw(analysis.keywords);
  analysis.themes = arr(analysis.themes);

  // Normalize colors to #RRGGBB.
  if (analysis.palette) for (const k of ["primary", "secondary", "accent", "bg"]) analysis.palette[k] = hex(analysis.palette[k]) || analysis.palette[k];
  for (const s of analysis.sections) s.colorHint = hex(s.colorHint) || s.colorHint;

  // Attach section start times by name (fallback: positional).
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  analysis.sections = (analysis.sections || []).map((s, i) => {
    const match = secs.find((x) => norm(x.name) === norm(s.name)) || secs[i];
    return { ...s, start: match?.start ?? null };
  }).filter((s) => s.start != null).sort((a, b) => a.start - b.start);

  return analysis;
}

const tracks = JSON.parse(readFileSync(args.in, "utf8"));
const out = [];
for (const t of tracks) {
  process.stderr.write(`analyzing ${t.id} …\n`);
  try {
    const analysis = await analyze(t);
    out.push({ id: t.id, planet: { analysis, generatedAt: null }, ok: true, error: null });
    process.stderr.write(`  ok: ${analysis.sections.length} sections, ${analysis.keywords.length} keywords, mood "${analysis.overallMood}"\n`);
  } catch (e) {
    out.push({ id: t.id, planet: null, ok: false, error: String(e) });
    process.stderr.write(`  ERROR: ${e}\n`);
  }
  writeFileSync(args.out, JSON.stringify(out, null, 2));
}
process.stderr.write(`done -> ${args.out}\n`);
