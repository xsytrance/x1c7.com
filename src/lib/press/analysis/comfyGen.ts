// LOCAL lane — cover candidates on the VISITOR'S own ComfyUI at localhost.
// Browser-direct (localhost is mixed-content exempt; ComfyUI needs
// --enable-cors-header, see /press/local). Nothing leaves their machine.
// Graph shape mirrors scripts/art-worker.mjs coverGraph (the house lanes),
// simplified to whatever checkpoint the visitor actually has.

const COVER_NEG = "text, words, letters, typography, watermark, logo, signature, low quality, blurry, deformed";

export async function comfyLive(host = "http://127.0.0.1:8188"): Promise<string[] | null> {
  try {
    const r = await fetch(`${host}/object_info/CheckpointLoaderSimple`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    const names = j?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    return Array.isArray(names) ? names : [];
  } catch { return null; }
}

function graph(ckpt: string, prompt: string, seed: number, turbo: boolean) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: COVER_NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: turbo ? 4 : 22, cfg: turbo ? 1 : 6, sampler_name: turbo ? "euler_ancestral" : "dpmpp_2m", scheduler: turbo ? "normal" : "karras", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "pressingplant" } },
  };
}

export async function comfyGenerate(
  opts: { host?: string; ckpt: string; prompt: string; n?: number; onProgress?: (m: string) => void },
): Promise<Blob[]> {
  const host = opts.host || "http://127.0.0.1:8188";
  const turbo = /turbo|lightning|lcm/i.test(opts.ckpt);
  const out: Blob[] = [];
  const n = Math.max(1, Math.min(4, opts.n ?? 2));
  for (let i = 0; i < n; i++) {
    opts.onProgress?.(`rendering candidate ${i + 1}/${n} on your GPU…`);
    const seed = (Math.floor(Math.random() * 2 ** 31)) >>> 0;
    const q = await fetch(`${host}/prompt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: graph(opts.ckpt, opts.prompt, seed, turbo) }),
    });
    if (!q.ok) throw new Error(`ComfyUI queue ${q.status} — is --enable-cors-header on? (see /press/local)`);
    const { prompt_id } = await q.json();
    let img: { filename: string; subfolder?: string; type: string } | null = null;
    for (let tick = 0; tick < 240; tick++) {
      await new Promise((r) => setTimeout(r, 700));
      const h = await (await fetch(`${host}/history/${prompt_id}`)).json();
      const entry = h[prompt_id];
      if (entry?.status?.status_str === "error") throw new Error("ComfyUI errored on the graph — unusual checkpoint? try another");
      if (entry?.outputs?.["7"]?.images?.[0]) { img = entry.outputs["7"].images[0]; break; }
    }
    if (!img) throw new Error("ComfyUI timed out");
    const res = await fetch(`${host}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
    out.push(await res.blob());
  }
  return out;
}
