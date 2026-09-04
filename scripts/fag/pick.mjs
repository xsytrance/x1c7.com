#!/usr/bin/env node
// FORGED ABOVE GOLD — the eyes-on picks, one per plate.
//
// Every candidate was audited at ~440px in a contact sheet (playbook §18: SDXL
// sneaks figures and props into empty rooms, and they are visible at 500px and
// invisible at 250px). Notes below are why each won.
//
// Writes plates/<key>.png from the chosen variant, then emits picks.json for
// scripts/clip/publish-scenes.mjs. Run people.py AFTER this — it composites the
// two artists into four of these plates in place.
import { copyFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "scripts/fag/plates";

const PICKS = {
  flame:      "flame-0",      // the hearth burning; v1 was a wider stove, less focused
  untouched:  "untouched-0",  // coke/scale macro with real structure
  unchanged:  "unchanged-0",  // tongs resting on coal — reads as work, not a prop
  fuerte:     "kizuna",       // HER, real photo graded cold — "Más fuerte que ayer"
  burn:       "burn-1",       // re-rolled: the first pass had no hot metal at all
  somebodys:  "somebodys-0",  // workshop interior, forge lit at the back
  stand:      "tyler",        // HIM, real photo graded warm — "I can stand in the quiet"
  quiet:      "quiet-0",      // the tool wall; the best plate in the set
  puedo:      "puedo-0",      // gloved hands on tongs, violet
  carry:      "carry-1",      // hot billet in a carrier on a chain; v0 had no context
  // "I can carry my own light" — the `prove` render is the image this LINE wanted:
  // a bar hanging vertically, glowing, the only light in frame. Reassigned rather
  // than re-rolled, because both `light` renders came back with no glow at all.
  light:      "prove-0",
  salvar:     "salvar-0",     // small forge still lit, no hands — "nobody saved me"
  fire:       "fire-1",       // re-rolled WIDE: the hearth burnt down at the end of a long dark room.
  //   `fire` is the only keyword that fires TWICE (228.90 "let the old fire go" and
  //   244.66 "the fire didn't make me gold"), so its shot size counts double in the
  //   histogram — making it an establishing wide is what pulled WIDE from 27% to 41%.
  nothing:    "nothing-1",    // red-lit empty ground; v0 read too much like a bar
  prove:      "prove-1",      // bar with a glowing tip, cooling
  made:       "made-1",       // the whole anvil rather than a macro edge — more legible, and one fewer MACRO
  forever:    "forever-0",    // the whole room; v1 leaned daylight
  were:       "were-0",       // power hammer over hot steel; strongest plate in the set
  quench:     "quench-0",     // the eruption; the loudest image in the outro
  worth:      "worth-0",      // the tank standing quiet afterwards
  endcard:    "endcard",      // the single artwork, already composited
};

const out = {};
let missing = 0;
for (const [key, variant] of Object.entries(PICKS)) {
  const src = join(DIR, `${variant}.png`);
  if (!existsSync(src)) { console.error(`✗ ${key}: ${src} missing`); missing++; continue; }
  const dst = join(DIR, `${key}.png`);
  if (src !== dst) copyFileSync(src, dst);
  out[key] = dst;
}
if (missing) { console.error(`${missing} plate(s) missing`); process.exit(1); }
writeFileSync("scripts/fag/picks.json", JSON.stringify(out, null, 2));
console.log(`✓ ${Object.keys(out).length} picks written to scripts/fag/picks.json`);
