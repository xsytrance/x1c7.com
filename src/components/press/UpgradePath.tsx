"use client";

// THE UPGRADE PATH — the doctrine's three engines as one quiet card.
// FREE never needs this; HOUSE lends a taste; BYOK is their key, browser →
// provider direct; LOCAL is their own machines. Posture changes are loud
// and honest (the lamp), degradation is silent.

import { useEffect, useState } from "react";
import { projectStore } from "@/lib/press/state/projectStore";
import { direction, ollamaLive, houseKeyLive, type ArtDirection, type Engine } from "@/lib/press/analysis/aiAnalyze";
import type { ProjectSpec } from "@/lib/press/types";

const HINT = "text-[11px] leading-4 text-zinc-600";
const FIELD = "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-amber-400/60 focus:outline-none";
const KEY_LS = "press:openrouter-key";

export function postureOf(engine: Engine | null): { label: string; tone: string; blurb: string } {
  if (engine === "byok") return { label: "→ YOUR PROVIDER ONLY", tone: "text-amber-400 border-amber-400/40", blurb: "AI requests go from your browser straight to OpenRouter with your key. This site's servers never see them." };
  if (engine === "local") return { label: "⏚ YOUR MACHINE ONLY", tone: "text-emerald-400 border-emerald-500/40", blurb: "AI runs on your own Ollama/ComfyUI at localhost. Nothing leaves your machine, period." };
  if (engine === "house") return { label: "→ HOUSE KEY (TITLE+LYRICS)", tone: "text-amber-400 border-amber-400/40", blurb: "The one lent call: title + lyrics to free models through the house proxy. Everything else stays in the tab." };
  return { label: "⏚ TAB-SILENT", tone: "text-emerald-400 border-emerald-500/40", blurb: "Everything happens in this tab." };
}

export function UpgradePath({ project, onEngine, onDirection, onArt }: {
  project: ProjectSpec;
  onEngine: (e: Engine | null) => void;
  onDirection: (d: ArtDirection) => void;
  onArt?: (blob: Blob) => void;
}) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [key, setKey] = useState("");
  const [ollamaModels, setOllamaModels] = useState<string[] | null>(null);
  const [ollamaModel, setOllamaModel] = useState("llama3.1:8b");
  const [ckpts, setCkpts] = useState<string[] | null>(null);
  const [ckpt, setCkpt] = useState("");
  const [genPrompt, setGenPrompt] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candBlobs, setCandBlobs] = useState<Blob[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { try { const k = localStorage.getItem(KEY_LS); if (k) setKey(k); } catch { /* fine */ } }, []);

  async function pick(e: Engine) {
    setEngine(e); onEngine(e); setMsg(null);
    if (e === "house") {
      setBusy("probe"); setMsg("checking the house key…");
      setMsg((await houseKeyLive()) ? "the house key is live — free models, fair-use limited" : "the house key is off right now — BYOK and LOCAL still work; FREE never needed it");
      setBusy(null);
    }
    if (e === "local") {
      setBusy("probe"); setMsg("looking for your machines at localhost…");
      const [models, checkpoints] = await Promise.all([
        ollamaLive(),
        import("@/lib/press/analysis/comfyGen").then((m) => m.comfyLive()),
      ]);
      setOllamaModels(models);
      setCkpts(checkpoints);
      if (checkpoints?.length && !ckpt) setCkpt(checkpoints.find((c) => /turbo|lightning/i.test(c)) ?? checkpoints[0]);
      if (models?.length) setOllamaModel(models.find((m) => /llama3|qwen2\.5|mistral|gemma/i.test(m)) ?? models.find((m) => !/embed/i.test(m)) ?? models[0]);
      setMsg(!models && !checkpoints
        ? "nothing answered at localhost — see the one-page setup at /press/local; everything above works without it"
        : `found: ${models ? `Ollama (${models.length} models)` : "no Ollama"} · ${checkpoints ? `ComfyUI (${checkpoints.length} checkpoints)` : "no ComfyUI"}`);
      setBusy(null);
    }
  }

  async function ask() {
    if (!engine || busy) return;
    setBusy("direction"); setMsg(engine === "local" ? `asking ${ollamaModel} on your machine…` : "asking the art director…");
    try {
      const d = await direction(engine, {
        title: project.identity.title,
        lyrics: project.lyrics,
        styleWords: project.analysis?.styleWords ?? undefined,
        sections: project.analysis?.sections ?? undefined,
      }, { key: key || undefined, model: engine === "local" ? ollamaModel : undefined });
      onDirection(d);
      setMsg(`the director pitched ${d.concepts.length} concepts${d.linerNotes ? " + liner notes" : ""}${d.levelNames?.length ? " + level names" : ""}`);
    } catch (e) {
      setMsg(`${(e as Error).message} — the FREE engine above never sleeps`);
    }
    setBusy(null);
  }

  async function generate() {
    if (busy || !ckpt) return;
    setBusy("gen"); setCandidates([]);
    try {
      const { comfyGenerate } = await import("@/lib/press/analysis/comfyGen");
      const prompt = genPrompt.trim() || `album cover artwork for "${project.identity.title || "an untitled song"}", iconic composition, no text`;
      const blobs = await comfyGenerate({ ckpt, prompt, n: 2, onProgress: (m) => setMsg(m) });
      setCandBlobs(blobs);
      setCandidates(blobs.map((b) => URL.createObjectURL(b)));
      setMsg("tap a candidate to make it the art");
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">⇪ The upgrade path</p>
      <p className={`${HINT} mt-1`}>More with a key, everything with your own machines — FREE stays complete either way.</p>
      <div className="mt-2 flex gap-1.5">
        {([["house", "on the house"], ["byok", "your key"], ["local", "your machines"]] as [Engine, string][]).map(([e, label]) => (
          <button key={e} onClick={() => pick(e)}
            className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${engine === e ? "border-amber-400/60 text-amber-300" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
            {label}
          </button>
        ))}
      </div>

      {engine === "byok" && (
        <div className="mt-2">
          <p className={HINT}>Your OpenRouter key — stored only in this browser, sent only to OpenRouter</p>
          <input type="password" value={key} placeholder="sk-or-…"
            onChange={(e) => { setKey(e.target.value); try { localStorage.setItem(KEY_LS, e.target.value); } catch { /* fine */ } }}
            className={FIELD} />
        </div>
      )}
      {engine === "local" && ollamaModels && (
        <div className="mt-2">
          <p className={HINT}>Ollama model</p>
          <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className={FIELD}>
            {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {engine && (
        <button onClick={ask} disabled={!!busy || (engine === "byok" && !key)}
          className="mt-2 w-full rounded-full border border-amber-400/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-amber-300/90 hover:bg-amber-400/10 disabled:opacity-40">
          {busy === "direction" ? "directing…" : "full art direction — concepts · liner notes · level names"}
        </button>
      )}

      {engine === "local" && ckpts && ckpts.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-2">
          <p className={HINT}>ComfyUI lane — render cover candidates on your GPU</p>
          <select value={ckpt} onChange={(e) => setCkpt(e.target.value)} className={FIELD}>
            {ckpts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="prompt (blank = seeded from your title)" className={FIELD} />
          <button onClick={generate} disabled={!!busy}
            className="mt-2 w-full rounded-full border border-zinc-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-300 hover:border-amber-400/50 disabled:opacity-40">
            {busy === "gen" ? "rendering…" : "generate 2 candidates"}
          </button>
          {candidates.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {candidates.map((u, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <button key={u} onClick={() => { onArt?.(candBlobs[i]); setMsg("✓ candidate is now the art — every surface re-dressed"); }}
                  className="overflow-hidden rounded-lg border border-zinc-800 transition hover:border-emerald-500/60">
                  <img src={u} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {engine === "local" && ckpts && ckpts.length === 0 && (
        <p className={`${HINT} mt-2`}>ComfyUI answered but has no checkpoints — drop a model in and refresh.</p>
      )}
      {msg && <p className={`${HINT} mt-2`}>{msg}</p>}
      {engine && <p className={`${HINT} mt-1`}><a href="/press/local" className="underline decoration-dotted hover:text-zinc-400">the one-page LOCAL setup →</a></p>}
    </div>
  );
}

export function applyDirectionToBooklet(d: ArtDirection) {
  projectStore.apply((p) => {
    if (d.linerNotes && p.booklet) {
      const read = p.booklet.pages.find((pg) => pg.kind === "read");
      if (read) read.text = d.linerNotes;
    }
  });
}
