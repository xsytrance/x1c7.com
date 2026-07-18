import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// The collector print path, shared by /api/studio/covers (edit + reprint) and
// /api/studio/onboard (first print). Prime-local only: it shells into
// scripts/song-art/collector and reads/writes manifest.json on disk.

const exec = promisify(execFile);
export const COLLECTOR = join(process.cwd(), "scripts", "song-art", "collector");
const MANIFEST = join(COLLECTOR, "manifest.json");

export type ManifestRecord = Record<string, unknown> & { slug: string };

export const readManifest = (): ManifestRecord[] => JSON.parse(readFileSync(MANIFEST, "utf8"));
// 1-space indent — the file's existing format, keeps git diffs honest.
export const writeManifest = (m: ManifestRecord[]) => writeFileSync(MANIFEST, JSON.stringify(m, null, 1) + "\n");

export async function renderAndPublish(slug: string): Promise<string> {
  const out = join(COLLECTOR, "out", `${slug}.png`);
  const before = existsSync(out) ? statSync(out).mtimeMs : 0;
  await exec("node", ["engine.mjs", "--only", slug], { cwd: COLLECTOR, timeout: 60_000 });
  if (!existsSync(out) || statSync(out).mtimeMs <= before) {
    throw new Error("engine produced no cover (missing original art?)");
  }
  // Uploads run in spawned plain node — Next's patched fetch drops
  // Content-Length on binary PUTs and R2 answers 411.
  await exec("node", ["make-web-assets.mjs", "--only", slug], { cwd: COLLECTOR, timeout: 60_000 });
  await exec("node", ["publish-one.mjs", slug], { cwd: COLLECTOR, timeout: 60_000 });
  return new Date().toISOString();
}
