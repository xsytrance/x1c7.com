// Persistence, the honest way: the ProjectSpec JSON in localStorage (small —
// peaks is 96 floats, analysis is capped), art/audio blobs in IndexedDB.
// Nothing ever leaves the device; "close the tab and it's gone" is only
// untrue in the way the user wants (their draft survives a reload).

import type { ProjectSpec } from "../types";

const LS_KEY = "press:project:current";

export function saveProject(p: ProjectSpec) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    // quota — the .press.json export is the escape hatch (P2+); stay silent
  }
}

export function loadProject(): ProjectSpec | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ProjectSpec;
    return p?.v === 1 ? p : null;
  } catch {
    return null;
  }
}

export function clearProject() {
  try { localStorage.removeItem(LS_KEY); } catch { /* fine */ }
}

// ── IndexedDB blob store (art + audio) ───────────────────────────────────────
const DB = "press-assets", STORE = "assets";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAsset(id: string, blob: Blob): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  d.close();
}

export async function getAsset(id: string): Promise<Blob | null> {
  const d = await db();
  const out = await new Promise<Blob | null>((resolve, reject) => {
    const req = d.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  d.close();
  return out;
}

export async function deleteAsset(id: string): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  d.close();
}
