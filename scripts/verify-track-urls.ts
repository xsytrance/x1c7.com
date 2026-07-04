// Verify every track's audio + cover URL resolves after the storage reorg.
// Run: npx tsx scripts/verify-track-urls.ts
import { tracks } from "../src/data/tracks";

async function status(url?: string): Promise<number | string> {
  if (!url) return "none";
  try { const r = await fetch(url, { method: "HEAD" }); return r.status; }
  catch (e) { return "ERR:" + (e as Error).message.slice(0, 30); }
}

(async () => {
  let audioBad = 0, coverBad = 0;
  for (const t of tracks) {
    const a = await status(t.audioUrl);
    const c = await status(t.cover);
    const aok = a === 200;
    const cok = c === 200 || t.cover === undefined;
    if (!aok || !cok) {
      if (!aok) audioBad++;
      if (!cok) coverBad++;
      console.log(`✗ ${t.title}`);
      if (!aok) console.log(`    AUDIO ${a}  ${t.audioUrl}`);
      if (!cok) console.log(`    COVER ${c}  ${t.cover}`);
    }
  }
  console.log(`\n${tracks.length} tracks · ${audioBad} audio problems · ${coverBad} cover problems`);
  process.exit(audioBad + coverBad ? 1 : 0);
})();
