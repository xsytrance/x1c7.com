// LOCAL setup — one page, no hand-waving (docs/THREE-LEVELS.md law). Static.

export const metadata = { title: "The Pressing Plant — LOCAL setup" };

export default function LocalSetupPage() {
  return (
    <main className="min-h-[100dvh] bg-[#050510] px-5 py-10 text-zinc-300">
      <div className="mx-auto max-w-[720px]">
        <h1 className="font-display text-2xl font-black tracking-[0.18em] text-amber-300">LOCAL — YOUR MACHINES</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          The strongest tier and the most private one: the plant talks to AI running on <em>your</em> computer at
          <code className="mx-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-emerald-400">localhost</code>
          and nothing about your song leaves your machine. Two optional servers, either works alone.
        </p>

        <h2 className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">1 · Ollama — art direction</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
          <li>Install from <span className="text-zinc-200">ollama.com</span> (one installer, every OS).</li>
          <li>Pull a model: <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-emerald-400">ollama pull qwen3:14b</code> (or any chat model — 8B+ recommended).</li>
          <li>That&apos;s it. Ollama serves localhost:11434 by itself; the plant finds it when you pick <b>YOUR MACHINES</b>.</li>
        </ol>

        <h2 className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">2 · ComfyUI — cover generation</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
          <li>Install ComfyUI (github.com/comfyanonymous/ComfyUI) and drop any SDXL checkpoint in <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-emerald-400">models/checkpoints/</code> — a turbo/lightning one renders in seconds.</li>
          <li>Start it with CORS open to this site:<br />
            <code className="mt-1 inline-block rounded bg-zinc-900 px-2 py-1 text-xs text-emerald-400">python main.py --enable-cors-header</code></li>
          <li>The plant probes localhost:8188, lists your checkpoints, and renders candidates on your GPU.</li>
        </ol>

        <p className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm leading-6 text-zinc-400">
          <b className="text-emerald-400">The posture, plainly:</b> at LOCAL, prompts go from your browser to your own
          localhost servers. This site hosts the page you&apos;re reading and nothing else about your session.
          Close the tab; your machines were the only witnesses.
        </p>

        <p className="mt-6 text-sm"><a href="/press" className="font-mono text-[12px] uppercase tracking-[0.2em] text-amber-400/80 hover:text-amber-300">← back to the plant</a></p>
      </div>
    </main>
  );
}
