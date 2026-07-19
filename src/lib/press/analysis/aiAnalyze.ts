// THE ONLY ESCALATION DOOR — the single module in the plant allowed to fetch
// with song content (fetch-guard allow-list). KEYED posture: house-key taste
// via the x1c7.com proxy (owner's OpenRouter key, free models, fair-use
// limited — pattern vendored-from /home/xsyprime/kinetica/src/ai/houseKey.ts).
// Only the TITLE + LYRICS (+ style words) ever transit. Never stems, never
// audio, never art. Degrades silently: probe dead → FREE recs carry on.

export const HOUSE_PROXY = "https://x1c7.com/api/kinetica/ai";

export interface ArtDirection {
  mood: string;
  concepts: { name: string; prompt: string }[];   // ≤3 pitched cover concepts
  spineWords: string[];                            // ≤3 single-word candidates
}

export async function houseKeyLive(signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(HOUSE_PROXY, { signal: signal ?? AbortSignal.timeout(6000) });
    if (!r.ok) return false;
    return !!(await r.json()).enabled;
  } catch { return false; }
}

export async function artDirectorTaste(o: { title: string; lyrics?: string | null; styleWords?: string[] }): Promise<ArtDirection> {
  const system = "You are a record-label art director. Reply ONLY with JSON: " +
    '{"mood": string, "concepts": [{"name": string, "prompt": string}] (max 3, prompt = one text-to-image sentence, no artist names), "spineWords": [string] (max 3 single words)}';
  const user = `Song: "${o.title || "Untitled"}"${o.styleWords?.length ? `\nStyle: ${o.styleWords.join(", ")}` : ""}${o.lyrics ? `\nLyrics:\n${o.lyrics.slice(0, 2400)}` : ""}`;
  const r = await fetch(HOUSE_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { content?: string; error?: string };
  if (!r.ok || !j.content) throw new Error(j.error || `house key unavailable (${r.status})`);
  const parsed = JSON.parse(j.content) as Partial<ArtDirection>;
  return {
    mood: String(parsed.mood ?? ""),
    concepts: (parsed.concepts ?? []).slice(0, 3).map((c) => ({ name: String(c.name ?? ""), prompt: String(c.prompt ?? "") })),
    spineWords: (parsed.spineWords ?? []).slice(0, 3).map(String),
  };
}
