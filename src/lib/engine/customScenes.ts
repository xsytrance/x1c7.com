// ═══════════════════════════════════════════════════════════════════════════
// THE SHADER SDK — drop a .frag and it becomes a live backdrop scene.
//
// PRISM's extensibility move (its v0.10), against OUR uniform contract —
// which carries what his can't: real stem envelopes, the riser charge, the
// active word's position, the song's key. Write a fragment-shader BODY (the
// header with uniforms + helpers is prepended; end by assigning fragColor).
//
// Directives, anywhere in the file:
//   // @name RIPPLE GRID            scene-list display name
//   // @param warp 0 2 0.6          float param: key, min, max, default →
//                                   a registry slider `cscene.<slug>.warp`
//                                   feeding the uniform uWarp — the control
//                                   is look-captured + panel-rendered free.
//
// Scenes persist per browser (localStorage) and hot-replace by name.
// Compile errors surface with the line-numbered listing (header included).
// ═══════════════════════════════════════════════════════════════════════════

import { P } from "./params";
import { getActiveBackdrop } from "./backdrop";

export interface CustomScene {
  name: string;
  src: string;
  savedAt: string;
}
interface SceneFile { v: number; scenes: CustomScene[] }

const STORE_KEY = "kinetica-scenes";
const FILE_V = 1;

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const uniformFor = (key: string) => "u" + key.charAt(0).toUpperCase() + key.slice(1);

function load(): SceneFile {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
    if (raw) {
      const f = JSON.parse(raw) as SceneFile;
      if (f && f.v === FILE_V && Array.isArray(f.scenes)) return f;
    }
  } catch { /* fresh */ }
  return { v: FILE_V, scenes: [] };
}
function save(f: SceneFile) {
  try { if (typeof window !== "undefined") window.localStorage.setItem(STORE_KEY, JSON.stringify(f)); } catch { /* full */ }
}

/** Parse the directives out of a .frag body. */
export function parseDirectives(src: string, fallbackName: string) {
  const name = (src.match(/\/\/\s*@name\s+(.+)/)?.[1] ?? fallbackName).trim().toUpperCase().slice(0, 24);
  const params: { key: string; min: number; max: number; value: number }[] = [];
  for (const m of src.matchAll(/\/\/\s*@param\s+([a-zA-Z]\w*)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/g)) {
    params.push({ key: m[1], min: +m[2], max: +m[3], value: +m[4] });
  }
  return { name, params };
}

/** Compile + register a scene on the live renderer. Returns the scene name,
 * or throws with the compiler's line-numbered listing. */
function mount(scene: CustomScene): string {
  const r = getActiveBackdrop();
  if (!r) throw new Error("no live backdrop to mount into (play a show first)");
  const { name, params } = parseDirectives(scene.src, scene.name);
  const custom = params.map((p) => {
    const paramId = `cscene.${slug(name)}.${p.key}`;
    if (!P.def(paramId)) {
      P.register({ id: paramId, label: p.key, group: `SCENE ${name}`, min: p.min, max: p.max, value: p.value });
    }
    return { uniform: uniformFor(p.key), paramId };
  });
  // declare the custom uniforms above the body so authors don't have to
  const decls = params.length ? params.map((p) => `uniform float ${uniformFor(p.key)};`).join("\n") + "\n" : "";
  r.addScene(name, decls + scene.src, custom);
  return name;
}

export const customScenes = {
  list(): CustomScene[] { return load().scenes; },

  /** Add (or hot-replace) a scene from .frag source. Throws on compile error
   * — nothing is persisted unless the shader actually compiles. */
  add(fileName: string, src: string): string {
    const fallback = fileName.replace(/\.frag$/i, "").replace(/[-_]/g, " ");
    const scene: CustomScene = { name: parseDirectives(src, fallback).name, src, savedAt: new Date().toISOString().slice(0, 10) };
    const mounted = mount(scene); // throws before persist on bad GLSL
    const f = load();
    f.scenes = [...f.scenes.filter((s) => s.name !== mounted), { ...scene, name: mounted }];
    save(f);
    return mounted;
  },

  remove(name: string) {
    getActiveBackdrop()?.removeScene(name);
    const f = load();
    f.scenes = f.scenes.filter((s) => s.name !== name);
    save(f);
  },

  /** Re-mount every persisted scene onto a fresh renderer (backdrop mount).
   * A scene that no longer compiles is dropped with a console warning —
   * a broken shader from last month must never kill today's show. */
  restore(): string[] {
    const ok: string[] = [];
    for (const s of load().scenes) {
      try { ok.push(mount(s)); } catch (e) {
        console.warn(`[kinetica] custom scene "${s.name}" failed to restore:`, e);
      }
    }
    return ok;
  },
};
