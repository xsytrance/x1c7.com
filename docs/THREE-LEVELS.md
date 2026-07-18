# The Three Levels — the house access principle

**Owner's principle (2026-07-18), refined.** Every public-facing tool ships
with three capability tiers. The owner intends to use this pattern across
products ("I'll be using that 3 levels principal a lot").

## The canon

| level | name | means | promise |
|---|---|---|---|
| 1 | **FREE** | no account, no keys, no (or minimal) downloads, no LLM | a real, complete result — never a crippled demo |
| 2 | **KEYED** | bring-your-own cloud key (OpenRouter or equivalent) | the cloud does the heavy lifting; the key never touches our servers (or is house-lent, rate-limited) |
| 3 | **LOCAL** | user's own GPU: local LLM, ComfyUI, whisper, etc. | maximum power, zero cloud exposure, everything private |

Precedent: Kinetica shipped exactly this ladder (its README's "three
levels", numbered 0/1/2). **Rule: refer to levels by NAME (FREE/KEYED/
LOCAL); numbers are per-product decoration** — Kinetica counts from 0,
newer products count from 1, and that's fine as long as names lead.

## Design laws (the refinements)

1. **FREE must be genuinely good.** The beginner tier earns trust; it is
   not an upsell billboard. If the FREE tier of a tool isn't something
   you'd proudly demo, the tool isn't ready.
2. **Escalation is visible, never naggy.** One quiet "more with your own
   key / fully private with local" affordance, where relevant — not modal
   walls.
3. **One codebase.** Levels are runtime capability detection + gates, not
   forks. A "VIP edition" = the same app with the owner gate unlocking
   extra internals, never a separate repo.
4. **Privacy posture rises with level.** FREE sends nothing anywhere;
   KEYED sends only to the user's chosen provider; LOCAL sends nothing
   again. Say this out loud in the UI (Kinetica's privacy copy is the
   model).
5. **Degrade gracefully downward.** If a key dies or a local server is
   absent, the tool falls to the best available level silently (the
   Kinetica house-key probe is the reference implementation).

## Where it applies today

- **Kinetica** — already the reference (FREE offline show · KEYED
  OpenRouter/house key · LOCAL Ollama+ComfyUI).
- **Cover Studio 2 public edition** (docs/COVER-STUDIO-2.md, planned):
  FREE = upload/pick art + palettes + typography + collector case print ·
  KEYED = cloud image-gen candidates · LOCAL = the full lane roster.
- **VIP editions** (owner + jayodeed) are LOCAL-tier instances with the
  owner gate open: lexicon tie-ins, local LLM art direction, batch tools.

## Honest caveats (recorded so we stay honest)

- Three tiers triple the test surface of every feature; a feature ships
  when its FREE story is decided, even if that story is "LOCAL/KEYED only,
  hidden at FREE" — decided, not forgotten.
- Public LOCAL tiers assume users can run servers (Ollama/ComfyUI). Keep
  the docs/LOCAL_SETUP.md pattern: one page, no hand-waving.
