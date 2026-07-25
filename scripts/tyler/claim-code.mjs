#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TYLER · CLAIM CODE — mint the one-time setup code for Juan.
//
// Prints the code ONCE, right here, and stores only its SHA-256. Nothing on
// the internet (and nothing in this repo) ever holds the code itself, so the
// only copy is the one you text him. Run it again to replace an unused code;
// if the site is already claimed it refuses and tells you what to do instead.
//
//   node scripts/tyler/claim-code.mjs
//
// .env needs: SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const file of [".env", ".env.local"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set (.env)");
  process.exit(1);
}

const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", KEY, { auth: { persistSession: false } });

const { count } = await db.from("tyler_admins").select("username", { count: "exact", head: true });
if ((count ?? 0) > 0) {
  console.error("The site is already claimed — a new code would do nothing.");
  console.error("To reset Juan's login instead: open /tyler/admin from the tailnet (no password there)");
  console.error("and use Account → change password.");
  process.exit(1);
}

// Ambiguous characters removed on purpose: this gets read off a phone screen
// and typed into another one. No O/0, no I/1/l.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const raw = Array.from(crypto.randomBytes(12))
  .map((b) => ALPHABET[b % ALPHABET.length])
  .join("");
const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;

const { error } = await db.from("tyler_claims").upsert(
  {
    id: "main",
    code_hash: crypto.createHash("sha256").update(code).digest("hex"),
    created_at: new Date().toISOString(),
    used_at: null,
    used_by: null,
  },
  { onConflict: "id" },
);
if (error) throw error;

console.log(`
  ┌──────────────────────────────────────────────┐
      Juan's one-time setup code

              ${code}

      Send it to him with this link:
      https://tyler.x1c7.com/setup
      (or https://x1c7.com/tyler/setup before DNS)

      It works once. Only the hash is stored —
      this is the only time it will ever print.
  └──────────────────────────────────────────────┘
`);
