// THE ESCALATION DOOR — the only module in the plant allowed to fetch with
// song content (fetch-guard allow-list). Three engines, per THREE-LEVELS:
//   house — the owner's lent OpenRouter key via the x1c7.com proxy (free
//           models, fair-use limited; pattern vendored-from kinetica houseKey.ts)
//   byok  — the visitor's own OpenRouter key, browser → openrouter.ai DIRECT
//           (the key lives in their localStorage; our servers never see it)
//   local — the visitor's own Ollama at localhost (nothing leaves the machine)
// Only TITLE + LYRICS (+ style words, section times) ever transit — never
// stems, never audio, never art. Every path degrades silently to FREE.

export const HOUSE_PROXY = "https://x1c7.com/api/kinetica/ai";
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const BYOK_MODEL = "deepseek/deepseek-chat-v3-0324:free";

export type Engine = "house" | "byok" | "local";

export interface DirectionOpts {
  title: string;
  lyrics?: string | null;
  styleWords?: string[];
  sections?: { name: string; start: number }[];
}

export interface ArtDirection {
  mood: string;
  concepts: { name: string; prompt: string }[];   // ≤3 pitched cover concepts
  spineWords: string[];                            // ≤3 single-word candidates
  linerNotes?: string;                             // a draft "READ" page
  levelNames?: string[];                           // names for the MAP sections
}

export async function houseKeyLive(signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(HOUSE_PROXY, { signal: signal ?? AbortSignal.timeout(6000) });
    if (!r.ok) return false;
    return !!(await r.json()).enabled;
  } catch { return false; }
}

export async function ollamaLive(host = "http://localhost:11434"): Promise<string[] | null> {
  try {
    const r = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json() as { models?: { name: string }[] };
    return (j.models ?? []).map((m) => m.name);
  } catch { return null; }
}

function buildMessages(o: DirectionOpts) {
  const system = "You are a record-label art director writing for a physical-media design tool. Reply ONLY with JSON: " +
    '{"mood": string, "concepts": [{"name": string, "prompt": string}] (exactly 3; prompt = one vivid text-to-image sentence, no artist names), ' +
    '"spineWords": [string] (3 single words that would look great printed on a spine), ' +
    '"linerNotes": string (60-100 words of liner notes in a warm label voice, clearly a read not a fact), ' +
    '"levelNames": [string] (one evocative 1-3 word name per section, in order)}';
  const user = `Song: "${o.title || "Untitled"}"` +
    (o.styleWords?.length ? `\nStyle: ${o.styleWords.join(", ")}` : "") +
    (o.sections?.length ? `\nSections (${o.sections.length}): ${o.sections.map((s) => `${s.name}@${Math.round(s.start)}s`).join(", ")}` : "") +
    (o.lyrics ? `\nLyrics:\n${o.lyrics.slice(0, 2400)}` : "");
  return { system, user };
}

function parseDirection(content: string, sections?: DirectionOpts["sections"]): ArtDirection {
  const parsed = JSON.parse(content) as Partial<ArtDirection>;
  return {
    mood: String(parsed.mood ?? ""),
    concepts: (parsed.concepts ?? []).slice(0, 3).map((c) => ({ name: String(c.name ?? ""), prompt: String(c.prompt ?? "") })),
    spineWords: (parsed.spineWords ?? []).slice(0, 3).map(String),
    linerNotes: parsed.linerNotes ? String(parsed.linerNotes) : undefined,
    levelNames: (parsed.levelNames ?? []).slice(0, sections?.length ?? 9).map(String),
  };
}

export async function direction(engine: Engine, o: DirectionOpts, cfg?: { key?: string; host?: string; model?: string }): Promise<ArtDirection> {
  const { system, user } = buildMessages(o);
  if (engine === "house") {
    const r = await fetch(HOUSE_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, temperature: 0.6 }),
    });
    const j = (await r.json().catch(() => ({}))) as { content?: string; error?: string };
    if (!r.ok || !j.content) throw new Error(j.error || `house key unavailable (${r.status})`);
    return parseDirection(j.content, o.sections);
  }
  if (engine === "byok") {
    if (!cfg?.key) throw new Error("no key — paste your OpenRouter key first");
    const r = await fetch(OPENROUTER, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model || BYOK_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, temperature: 0.6 }),
    });
    const j = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    const content = j.choices?.[0]?.message?.content;
    if (!r.ok || !content) throw new Error(j.error?.message || `OpenRouter said ${r.status} — check the key`);
    return parseDirection(content, o.sections);
  }
  // local — Ollama (localhost is mixed-content exempt)
  const host = cfg?.host || "http://localhost:11434";
  const model = cfg?.model || "llama3.1:8b";
  const r = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // think:false — reasoning models (qwen3…) stall under JSON-constrained decode
    body: JSON.stringify({ model, stream: false, format: "json", think: false, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  const j = (await r.json().catch(() => ({}))) as { message?: { content?: string }; error?: string };
  if (!r.ok || !j.message?.content) throw new Error(j.error || `Ollama said ${r.status} — is it running with the model pulled?`);
  return parseDirection(j.message.content, o.sections);
}

/** Back-compat for the P4 card. */
export const artDirectorTaste = (o: DirectionOpts) => direction("house", o);
