#!/usr/bin/env node
// Re-run the Curator's match-reel across every song that has a profile, and
// publish each reel to R2. Written after the judge was found to have been
// calling a model that isn't installed, which left all 47 reels empty.
//
// Publishes with the S3 API (aws4fetch) rather than match-reel's own
// --publish, which shells out to rclone — not installed on this box.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const PROFILES = "scripts/song-analysis/profiles";
const songs = readdirSync(PROFILES).filter((d) =>
  existsSync(join(PROFILES, d, "profile.json")) && existsSync(join(PROFILES, d, "lexicon-reel.json")));
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const list = only.length ? songs.filter((s) => only.includes(s)) : songs;
console.error(`${list.length} songs to re-reel`);

let ok = 0, empty = 0, failed = 0;
for (const [i, song] of list.entries()) {
  const tag = `[${i + 1}/${list.length}] ${song}`;
  // Resumable: a batch this long WILL be interrupted (the first attempt was
  // killed for memory after one song). Skip anything already re-reeled today.
  try {
    const cur = JSON.parse(readFileSync(join(PROFILES, song, "lexicon-reel.json"), "utf8"));
    if ((cur.counts?.kept ?? 0) > 0 && (cur.generatedAt ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10)) {
      ok++; console.error(`${tag}: already done today (kept ${cur.counts.kept}) — skipped`); continue;
    }
  } catch { /* unreadable: re-run it */ }
  try {
    execFileSync("node", ["scripts/curator/match-reel.mjs", "--song", song, "--keep"], { stdio: ["ignore", "ignore", "ignore"], maxBuffer: 1 << 20 });
    const p = join(PROFILES, song, "lexicon-reel.json");
    const kept = JSON.parse(readFileSync(p, "utf8")).counts?.kept ?? 0;
    if (!kept) { empty++; console.error(`${tag}: kept 0 — judge accepted nothing`); continue; }
    execFileSync("node", ["./_r2putfile.mjs", p, `planets/${song}/lexicon-reel.json`, "application/json"], { stdio: ["ignore", "ignore", "inherit"] });
    ok++;
    console.error(`${tag}: kept ${kept} ✓`);
  } catch (e) {
    failed++;
    console.error(`${tag}: FAILED ${String(e.message).slice(0, 120)}`);
  }
}
console.error(`\ndone — ${ok} published, ${empty} empty, ${failed} failed, of ${list.length}`);
