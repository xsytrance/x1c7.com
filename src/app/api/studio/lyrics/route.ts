import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// LYRICS INBOX — the owner's easy way to hand corrected lyrics to the
// alignment pipeline. Tailnet-only like every /api/studio route (the proxy
// 404s it on public hosts). GET lists the audited songs + inbox state;
// POST { id, lyrics } drops the text into scripts/alignment/inbox/<id>.txt
// for realign-inbox.mjs to consume (align → refine → gate → apply).

export const runtime = "nodejs";

const ROOT = process.cwd();
const AUDIT = path.join(ROOT, "scripts", "alignment", "lyrics-audit.json");
const INBOX = path.join(ROOT, "scripts", "alignment", "inbox");

interface AuditEntry { id: string; reason: string; severity: string }

function audit(): { flagged: AuditEntry[]; instrumentals: string[] } {
  try { return JSON.parse(fs.readFileSync(AUDIT, "utf8")); } catch { return { flagged: [], instrumentals: [] }; }
}

export async function GET() {
  const a = audit();
  const flagged = a.flagged.map((f) => ({
    ...f,
    inbox: fs.existsSync(path.join(INBOX, `${f.id}.txt`)),
  }));
  return NextResponse.json({ flagged, instrumentals: a.instrumentals });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { id?: string; lyrics?: string } | null;
  const id = String(body?.id ?? "").replace(/[^a-z0-9-]/g, "");
  const lyrics = String(body?.lyrics ?? "").trim();
  if (!id || lyrics.length < 20) {
    return NextResponse.json({ error: "need { id, lyrics } (lyrics ≥ 20 chars)" }, { status: 400 });
  }
  fs.mkdirSync(INBOX, { recursive: true });
  fs.writeFileSync(path.join(INBOX, `${id}.txt`), lyrics + "\n");
  return NextResponse.json({ ok: true, id, words: lyrics.split(/\s+/).length });
}
