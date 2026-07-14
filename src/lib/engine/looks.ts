// ═══════════════════════════════════════════════════════════════════════════
// LOOKS — the show's memory. Capture the current control surface as a named
// look, fire it back (morphed over a musical duration), export/import packs.
//
// PRISM v0.19's hard-won lesson is law here from day one: a look stores the
// AESTHETIC (backdrop scene/grade/FX, modulation routings) and must never
// carry the CONTROLLERS that run the show. Firing a look can restyle the
// world; it can never switch the backdrop off, un-solo the Lens, or touch
// the transport. NON_LOOK below is that fence.
//
// Storage is versioned (PRISM's migrate.js pattern): every export carries
// { v }, and MIGRATIONS transforms any older file forward on import — so a
// look pack saved today survives every future schema change.
// ═══════════════════════════════════════════════════════════════════════════

import { P, type ParamValue } from "./params";

export interface Look {
  id: string;
  name: string;
  params: Record<string, ParamValue>;
  savedAt: string;
}
interface LookFile {
  v: number;
  looks: Look[];
}

const STORE_KEY = "kinetica-looks";
const FILE_V = 1;

// Controllers a look may never capture or restore.
const NON_LOOK_IDS = new Set(["backdrop.enabled"]);
// AUTOMATION runs the show (arm/play/length are transport, not aesthetics) —
// PRISM v0.19's exact bug class, fenced here before it can happen.
const NON_LOOK_GROUPS = new Set<string>(["AUTOMATION"]);

export function isLookParam(id: string): boolean {
  const def = P.def(id);
  if (!def) return false;
  if (NON_LOOK_IDS.has(id) || NON_LOOK_GROUPS.has(def.group)) return false;
  return true;
}

/** Snapshot of just the look params — what a saved look stores. */
export function lookSnapshot(): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of P.all()) if (isLookParam(p.id)) out[p.id] = p.value;
  return out;
}

/** Filter any stored params down to look params — so restoring an old file
 * (saved before an exclusion existed) still can't touch the controllers. */
function lookParams(obj: Record<string, ParamValue>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const id of Object.keys(obj || {})) if (isLookParam(id)) out[id] = obj[id];
  return out;
}

// ── versioned migrations: transform any older file forward, step by step ──
const MIGRATIONS: Record<number, (f: LookFile) => LookFile> = {
  // 1 → 2 example (when the day comes): rename params, drop dead ids, bump v.
};
function migrate(file: LookFile): LookFile | null {
  if (!file || typeof file.v !== "number" || !Array.isArray(file.looks)) return null;
  let f = file;
  while (f.v < FILE_V) {
    const step = MIGRATIONS[f.v];
    if (!step) return null;
    f = step(f);
  }
  return f.v === FILE_V ? f : null; // a file from a NEWER build fails honestly
}

function load(): LookFile {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
    if (raw) {
      const f = migrate(JSON.parse(raw) as LookFile);
      if (f) return f;
    }
  } catch { /* fresh */ }
  return { v: FILE_V, looks: [] };
}
function save(f: LookFile) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORE_KEY, JSON.stringify(f));
  } catch { /* storage full/blocked — the session still works */ }
}

// ── Built-in looks: three moods that show what a look can do. They set only
// the params that define them, so the song's own seeded character remains. ──
export const BUILTIN_LOOKS: Look[] = [
  {
    id: "builtin:nocturne", name: "NOCTURNE", savedAt: "2026-07-13",
    params: {
      "backdrop.intensity": 0.7, "backdrop.flow": 0.55, "backdrop.trails": 0.82,
      "backdrop.bloom": 0.2, "backdrop.vignette": 0.62, "backdrop.saturation": 0.85,
      "backdrop.brightness": 0.85, "backdrop.grain": 0.08, "backdrop.ghosts": 0.65,
    },
  },
  {
    id: "builtin:festival", name: "FESTIVAL", savedAt: "2026-07-13",
    params: {
      "backdrop.intensity": 1.45, "backdrop.flow": 1.7, "backdrop.trails": 0.4,
      "backdrop.bloom": 0.9, "backdrop.vignette": 0.25, "backdrop.saturation": 1.25,
      "backdrop.brightness": 1.1, "backdrop.grain": 0.03, "backdrop.ghosts": 0.35,
    },
  },
  {
    id: "builtin:newsprint", name: "NEWSPRINT", savedAt: "2026-07-13",
    params: {
      "backdrop.saturation": 0.15, "backdrop.grain": 0.22, "backdrop.bloom": 0.15,
      "backdrop.trails": 0.3, "backdrop.vignette": 0.5, "backdrop.brightness": 1.05,
      "backdrop.hueShift": 0, "backdrop.ghosts": 0.4,
    },
  },
];

export const looksStore = {
  /** Every look this browser knows: built-ins first, then the user's. */
  list(): Look[] {
    return [...BUILTIN_LOOKS, ...load().looks];
  },

  /** Capture the current control surface (look params only) under a name. */
  capture(name: string): Look {
    const look: Look = {
      id: `user:${Date.now().toString(36)}`,
      name: name.trim() || "UNTITLED",
      params: lookSnapshot(),
      savedAt: new Date().toISOString().slice(0, 10),
    };
    const f = load();
    f.looks.push(look);
    save(f);
    return look;
  },

  /** Fire a look: morph the float params there over morphSec (bools/selects
   * switch at once). Controllers are filtered even from old/foreign files. */
  fire(idOrLook: string | Look, morphSec = 2, now = (typeof performance !== "undefined" ? performance.now() : 0) / 1000): boolean {
    const look = typeof idOrLook === "string" ? this.list().find((l) => l.id === idOrLook) : idOrLook;
    if (!look) return false;
    P.morphTo(lookParams(look.params), morphSec, now);
    return true;
  },

  remove(id: string) {
    const f = load();
    f.looks = f.looks.filter((l) => l.id !== id);
    save(f);
  },

  /** Shareable pack (versioned). */
  exportJson(): string {
    return JSON.stringify({ v: FILE_V, looks: load().looks }, null, 2);
  },
  /** Import a pack: migrated forward, merged by id (imports win). */
  importJson(json: string): number {
    let incoming: LookFile | null = null;
    try { incoming = migrate(JSON.parse(json) as LookFile); } catch { /* invalid */ }
    if (!incoming) return -1;
    const f = load();
    const byId = new Map(f.looks.map((l) => [l.id, l]));
    for (const l of incoming.looks) byId.set(l.id, { ...l, params: lookParams(l.params) });
    f.looks = [...byId.values()];
    save(f);
    return incoming.looks.length;
  },
};
