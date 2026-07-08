// Interaction choreographer as a library — the same prompt + clamping logic as
// scripts/song-analysis/choreograph.mjs, callable synchronously from a route.
// Ollama on the local box answers in seconds with a warm model.

const TAP_EFFECTS = ["burn", "shatter", "dissolve", "bloom"] as const;
const LAYERS = ["ash", "frost", "steam", "fog", "static"] as const;

interface AnalysisLike {
  summary?: string;
  themes?: string[];
  sections?: { name: string; emotion: string; start: number; intensity: number }[];
}

export interface Choreography {
  tapEffect: (typeof TAP_EFFECTS)[number];
  moments: { t: number; end: number; type: "wipe"; layer: string; prompt: string }[];
}

export async function choreograph(
  title: string,
  analysis: AnalysisLike,
  styleHint: string,
  opts: { host?: string; model?: string } = {},
): Promise<Choreography> {
  const host = (opts.host || process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  // llama3.2-vision is the one installed model the current Ollama build can
  // load (gemma4/qwen3.5 need a newer Ollama — see art-worker README note).
  const model = opts.model || process.env.OLLAMA_MODEL || "llama3.2-vision:latest";
  const sections = (analysis.sections || []).map((s) => ({ name: s.name, emotion: s.emotion, start: s.start, intensity: s.intensity }));

  const prompt = `You are choreographing TOUCH INTERACTIONS for an animated lyric-video "planet" of the song "${title}".

SONG SUMMARY: ${analysis.summary || ""}
THEMES: ${(analysis.themes || []).join(", ")}
VISUAL WORLD: ${styleHint || ""}
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

  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ model, prompt, stream: false, format: "json", options: { temperature: 0.4, num_ctx: 8192, num_predict: 1024 } }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = (await res.json()) as { response: string };
  const r = JSON.parse(data.response) as { tapEffect?: string; moments?: { start?: number; end?: number; layer?: string; prompt?: string }[] };

  const tapEffect = (TAP_EFFECTS as readonly string[]).includes(r.tapEffect || "") ? (r.tapEffect as Choreography["tapEffect"]) : "dissolve";
  const starts = sections.map((s) => s.start);
  const moments = (Array.isArray(r.moments) ? r.moments : [])
    .filter((m) => typeof m.start === "number" && (LAYERS as readonly string[]).includes(m.layer || ""))
    .map((m) => {
      const start = m.start as number;
      const t = starts.includes(start) ? start : starts.reduce((b, s) => (Math.abs(s - start) < Math.abs(b - start) ? s : b), starts[0] ?? 0);
      return {
        t,
        end: Math.min(typeof m.end === "number" && m.end > t ? m.end : t + 15, t + 22),
        type: "wipe" as const,
        layer: m.layer as string,
        prompt: String(m.prompt || "wipe the screen").slice(0, 40),
      };
    })
    .slice(0, 3);

  return { tapEffect, moments };
}
