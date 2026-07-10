#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC+ CHOREOGRAPHER — writes Phase 6 for every analyzed song.
//
// Reads profiles/<id>/profile.json (the ultimate analyzer's measured truth)
// and asks the LLM to direct the showcase pass:
//   • 1-2 REACTOR takeovers — a Lab mode takes the stage for a section that
//     suits its whole vibe (fireworks on the triumphant chorus 2, terminal on
//     the digital bridge, ouija on the haunted outro…)
//   • 1-2 STEM SPOTLIGHTS — solo the billed instruments where the song
//     isolates them well (instrumental breaks, drum-cut windows, intros)
//   • 6-10 keyword → text-effect picks ("fire"→burn, "diamonds"→shimmer)
//
// Everything is validated + clamped in code: windows snapped inside the song,
// overlaps dropped, unknown modes/effects/stems filtered. Emits
// dynamic-plus.sql (apply AFTER shows.sql so every row has a planet).
//
// NOTE (2026-07-10): playback no longer runs takeovers or spotlights — the
// engine renders acts as VISUAL moments only (backdrop lift + the stemSpot
// label chip). The data shape is unchanged; acts still mark the song's best
// windows, they just stopped grabbing the stage or the mix.
//
//   node scripts/song-analysis/dynamic-plus.mjs [--only slug,slug] [--model m]
// ═══════════════════════════════════════════════════════════════════════════

import http from "node:http";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = join(HERE, "profiles");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";
const args = process.argv.slice(2);
const MODEL = args.includes("--model") ? args[args.indexOf("--model") + 1] : "qwen3.5:latest";
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const log = (...a) => console.error(...a);

// The Reactor bill — mode id → the vibe it suits (feeds the prompt).
const REACTORS = {
  graffiti: "street, hip-hop, rebellious, urban nights",
  fireworks: "celebration, triumph, a huge chorus, festival energy",
  handwriting: "intimate, heartfelt, a letter to someone, confession",
  downpour: "rain, melancholy, heartbreak, cleansing",
  bubbles: "light, playful, dreamy, underwater soft",
  orbit: "cosmic, hypnotic, floating in space, night drive",
  spellcast: "mystical, magic, seduction, ritual",
  aquarium: "calm, floaty, chill, lounging",
  marionette: "control, manipulation, dark playfulness, toxic love",
  tarot: "fate, destiny, mystery, fortune",
  constellation: "night sky, wonder, stargazing, quiet awe",
  splitflap: "travel, airports, departures, transitions, new city",
  terminal: "tech, code, digital life, hacking, the machine",
  sizzle: "heat, spice, cooking, summer swelter, desire",
  kaleidoscope: "psychedelic, spinning, euphoric, trippy",
  ouija: "spooky, haunted, ghosts of the past, séance",
};
const TEXT_EFFECTS = ["burn","shatter","dissolve","bloom","glitch","freeze","melt","carve","slam","wave","neon","pulse","whisper","fizz","type","shimmer","rise","fall","echo","tremor","redact","chromatic","liquid","bleed","handwrite","tvoff"];

function llm(system, user) {
  const body = JSON.stringify({
    model: MODEL, stream: true, format: "json", think: false,
    options: { temperature: 0.6, num_ctx: 8192, num_predict: 1400 },
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return new Promise((resolve, reject) => {
    const req = http.request(`${OLLAMA}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`LLM ${res.statusCode}`)); res.resume(); return; }
      let out = "", buf = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        buf += c; let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (line) try { out += JSON.parse(line).message?.content ?? ""; } catch { /* partial */ }
        }
      });
      res.on("end", () => {
        const a = out.indexOf("{"), b = out.lastIndexOf("}");
        if (a < 0 || b <= a) return reject(new Error(`no JSON: ${out.slice(0, 120)}`));
        try { resolve(JSON.parse(out.slice(a, b + 1))); } catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
}

const dq = (s) => { let tag = "$j$"; while (s.includes(tag)) tag = `$j${tag.length}$`; return `${tag}${s}${tag}`; };

function choreograph(p) {
  const dur = p.measured?.duration ?? 300;
  const sections = (p.analysis?.sections ?? []).map((s) => `${s.name} @${Math.round(s.start ?? 0)}s (intensity ${s.intensity ?? "?"}${s.emotion ? `, ${s.emotion}` : ""})`).join("; ");
  const cuts = (p.show?.dropMap?.cuts ?? []).map(([a, b]) => `${Math.round(a)}-${Math.round(b)}s`).join(", ");
  const stems = p.show?.performs?.stems ?? [];
  const kws = (p.analysis?.keywords ?? []).map((k) => `${k.word}(${k.emotion ?? ""})`).join(", ");
  const system = `You are the show director for a kinetic lyric engine. You choreograph the DYNAMIC+ showcase pass for one song. Respond ONLY with JSON:
{"acts":[{"start":number,"end":number,"reactor":string|null,"stemSpot":{"solo":string[],"label":string}|null,"why":string}],"words":{"<lyric word>":"<effect>"}}
Rules:
- 2 to 4 acts, each 8-25 seconds, never overlapping, all inside 10..${Math.round(dur - 8)}s.
- Each act has EITHER reactor OR stemSpot, never both.
- 1-2 reactor acts: pick the mode whose vibe truly matches that moment. Never cover the song's opening or its FIRST chorus — the main stage is the star; reactors are guest features on LATER sections.
- 1-2 stemSpot acts: solo 1-3 instruments where the song isolates them well — instrumental breaks, drum-cut windows, an intro groove, an outro. label = a short stage billing (max 22 chars, e.g. "DRUMS & BASS ONLY", "THE STRINGS SPEAK").
- words: 6-10 emotionally charged words ACTUALLY IN THE LYRICS mapped to the best-fitting text effect.
Reactor modes (id: vibe): ${Object.entries(REACTORS).map(([k, v]) => `${k}: ${v}`).join(" | ")}
Text effects: ${TEXT_EFFECTS.join(", ")}`;
  const user = `Song: "${p.identity?.title}" — ${p.identity?.genre}, ${p.identity?.mood}. Energy ${p.identity?.energy}. Duration ${Math.round(dur)}s.
Sections: ${sections}
Drum-cut windows (drums fall silent): ${cuts || "none"}
Available stems: ${stems.join(", ") || "none"}
Charged keywords: ${kws}
Summary: ${p.analysis?.summary ?? ""}
Lyrics (excerpt):\n${(p.lyrics?.text ?? "").slice(0, 1200)}`;
  return llm(system, user);
}

function validate(raw, p) {
  const dur = p.measured?.duration ?? 300;
  const stems = new Set(p.show?.performs?.stems ?? []);
  const acts = [];
  for (const a of Array.isArray(raw?.acts) ? raw.acts : []) {
    let start = Math.max(10, +a.start || 0), end = Math.min(dur - 5, +a.end || 0);
    if (!(end > start)) continue;
    if (end - start < 8) end = Math.min(dur - 5, start + 10);
    if (end - start > 25) end = start + 25;
    const reactor = a.reactor && REACTORS[a.reactor] ? a.reactor : null;
    const solo = (a.stemSpot?.solo ?? []).filter((s) => stems.has(s)).slice(0, 3);
    const stemSpot = !reactor && solo.length ? { solo, label: String(a.stemSpot.label ?? solo.join(" + ")).slice(0, 22).toUpperCase() } : null;
    if (!reactor && !stemSpot) continue;
    if (acts.some((x) => start < x.end + 4 && end > x.start - 4)) continue; // overlap (±4s breathing room)
    acts.push({ start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, ...(reactor ? { reactor } : {}), ...(stemSpot ? { stemSpot } : {}), why: String(a.why ?? "").slice(0, 90) });
  }
  acts.sort((a, b) => a.start - b.start);
  const words = {};
  for (const [w, fx] of Object.entries(raw?.words ?? {})) {
    const k = String(w).toLowerCase().trim();
    if (k && TEXT_EFFECTS.includes(fx) && Object.keys(words).length < 10) words[k] = fx;
  }
  return { v: 1, acts: acts.slice(0, 4), words };
}

// Plans cache to profiles/<id>/dynamic-plus.json — the LLM only runs for
// tracks without one (or with --force). The SQL is ALWAYS assembled from all
// cached plans, so --only reruns can never clobber the rest of the catalog.
const FORCE = args.includes("--force");
const ids = readdirSync(PROFILES).filter((d) => existsSync(join(PROFILES, d, "profile.json")));
let fresh = 0, failed = [];
for (const id of ids) {
  if (only && !only.has(id)) continue;
  const cache = join(PROFILES, id, "dynamic-plus.json");
  if (existsSync(cache) && !FORCE) continue;
  const p = JSON.parse(readFileSync(join(PROFILES, id, "profile.json"), "utf8"));
  try {
    const plan = validate(await choreograph(p), p);
    if (!plan.acts.length && !Object.keys(plan.words).length) { failed.push([id, "empty plan"]); continue; }
    writeFileSync(cache, JSON.stringify(plan, null, 1));
    fresh++;
    log(`✔ ${id}: ${plan.acts.map((a) => `${a.reactor ?? a.stemSpot.label}@${a.start}s`).join(", ") || "—"} + ${Object.keys(plan.words).length} words`);
  } catch (e) { failed.push([id, e.message]); log(`✘ ${id}: ${e.message}`); }
}
let sql = `-- generated by dynamic-plus.mjs — Phase 6 choreography (apply AFTER shows.sql)\n`;
let total = 0;
for (const id of ids) {
  const cache = join(PROFILES, id, "dynamic-plus.json");
  if (!existsSync(cache)) continue;
  const plan = JSON.parse(readFileSync(cache, "utf8"));
  sql += `\n-- ${id}: ${plan.acts.map((a) => a.reactor ?? a.stemSpot.label).join(" · ") || "words only"}\n`;
  sql += `UPDATE tracks SET planet = jsonb_set(coalesce(planet,'{}'::jsonb), '{dynamicPlus}', ${dq(JSON.stringify(plan))}::jsonb) WHERE id = '${id}' AND planet IS NOT NULL;\n`;
  total++;
}
writeFileSync(join(HERE, "dynamic-plus.sql"), sql);
log(`\n${fresh} new, ${total} total choreographies → ${join(HERE, "dynamic-plus.sql")}${failed.length ? ` · FAILED ${failed.length}: ${failed.map(([i]) => i).join(", ")}` : ""}`);
