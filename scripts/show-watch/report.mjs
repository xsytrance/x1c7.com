// ── SHOW-WATCH REPORT ───────────────────────────────────────────────────────
// Run-level rollup + triage + run comparison.
//
//   node scripts/show-watch/report.mjs <runDir>            → summary.json + triage.md
//   node scripts/show-watch/report.mjs --diff <runA> <runB> → regression check (exit 1 on new S1/S2)

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const log = (...a) => console.error(...a);

function loadRun(runDir) {
  const shows = [];
  for (const d of readdirSync(runDir, { withFileTypes: true })) {
    const p = join(runDir, d.name, "report.json");
    if (d.isDirectory() && existsSync(p)) shows.push(JSON.parse(readFileSync(p, "utf8")));
  }
  return shows.sort((a, b) => a.slug.localeCompare(b.slug));
}

if (process.argv[2] === "--diff") {
  const [a, b] = [process.argv[3], process.argv[4]].map(loadRun);
  const byA = new Map(a.map((s) => [s.slug, s]));
  let newBad = 0;
  log(`diff: ${process.argv[3]} → ${process.argv[4]}`);
  for (const s of b) {
    const prev = byA.get(s.slug);
    const key = (x) => new Set(x.anomalies.filter((n) => n.severity <= 2).map((n) => `${n.type}@${Math.round(n.songT)}`));
    const was = prev ? key(prev) : new Set(), now = key(s);
    const fresh = [...now].filter((k) => !was.has(k));
    const gone = [...was].filter((k) => !now.has(k));
    const dp95 = prev?.stats && s.stats ? s.stats.p95 - prev.stats.p95 : null;
    const regressed = dp95 !== null && prev.stats.p95 > 0 && dp95 / prev.stats.p95 > 0.2;
    if (fresh.length || gone.length || regressed) {
      log(`  ${s.slug}: ${fresh.length ? `NEW [${fresh.join(", ")}] ` : ""}${gone.length ? `fixed [${gone.join(", ")}] ` : ""}${dp95 !== null ? `Δp95 ${dp95 > 0 ? "+" : ""}${dp95.toFixed(1)}ms` : ""}`);
    }
    if (fresh.length || regressed) newBad++;
  }
  log(newBad ? `${newBad} show(s) regressed` : "no regressions");
  process.exit(newBad ? 1 : 0);
}

const runDir = process.argv[2];
if (!runDir || !existsSync(runDir)) { console.error("usage: report.mjs <runDir> | --diff <runA> <runB>"); process.exit(1); }
const shows = loadRun(runDir);
const run = existsSync(join(runDir, "run.json")) ? JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")) : {};

const summary = {
  runId: run.runId ?? basename(runDir),
  config: { mode: run.mode, profile: run.profile, browser: run.browser, parallel: run.parallel },
  shows: shows.map((s) => ({
    slug: s.slug,
    s1: s.anomalies.filter((a) => a.severity === 1).length,
    s2: s.anomalies.filter((a) => a.severity === 2).length,
    s3: s.anomalies.filter((a) => a.severity === 3).length,
    p95: s.stats?.p95 ?? null, jank50: s.stats?.jank50 ?? null, advisory: s.stats?.advisory ?? null,
    frames: s.frames, status: s.status,
  })),
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 1));

const sev = { 1: "S1 — broken", 2: "S2 — visual defect", 3: "S3 — perf budget" };
let md = `# Show-watch triage — ${summary.runId}\n\n`;
md += `${shows.length} shows · mode ${run.mode} · profile ${run.profile} · browser ${run.browser}\n\n`;
const clean = shows.filter((s) => !s.anomalies.length);
for (const level of [1, 2, 3]) {
  const hits = shows.map((s) => ({ s, list: s.anomalies.filter((a) => a.severity === level) })).filter((x) => x.list.length);
  if (!hits.length) continue;
  md += `## ${sev[level]} (${hits.reduce((n, x) => n + x.list.length, 0)} finding(s), ${hits.length} show(s))\n\n`;
  for (const { s, list } of hits) {
    md += `### ${s.slug}\n`;
    for (const a of list) md += `- \`${a.type}\` @ ${a.songT >= 0 ? a.songT.toFixed(1) + "s" : "run"} — ${a.detail}\n`;
    if (s.flags) md += `- close-ups: ${s.flags}\n`;
    md += `- sheet: ${s.sheet}\n`;
    md += `- repro: \`node scripts/show-watch/watch.mjs --only=${s.slug} --mode=full --profile=${s.profile} --video --parallel=1\`\n\n`;
  }
}
md += `## Clean (${clean.length})\n\n${clean.map((s) => s.slug).join(" · ") || "(none)"}\n`;
if (shows.some((s) => s.stats && !s.stats.advisory)) {
  md += `\n## Frame stats (authoritative — full mode)\n\n| show | p50 | p95 | p99 | jank50 | jank100 |\n|---|---|---|---|---|---|\n`;
  for (const s of shows.filter((x) => x.stats && !x.stats.advisory).sort((a, b) => b.stats.p95 - a.stats.p95)) {
    md += `| ${s.slug} | ${s.stats.p50} | ${s.stats.p95} | ${s.stats.p99} | ${s.stats.jank50} | ${s.stats.jank100} |\n`;
  }
}
writeFileSync(join(runDir, "triage.md"), md);
const t1 = summary.shows.reduce((n, s) => n + s.s1, 0), t2 = summary.shows.reduce((n, s) => n + s.s2, 0), t3 = summary.shows.reduce((n, s) => n + s.s3, 0);
log(`triage: S1:${t1} S2:${t2} S3:${t3} · clean ${clean.length}/${shows.length}`);
log(`→ ${join(runDir, "triage.md")}`);
