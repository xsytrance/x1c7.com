# LYRICS AUDIT — status after the owner's big paste (2026-07-14)

> The owner submitted corrected lyrics for all 10 flagged songs; the inbox
> pipeline (align → refine → gate → apply → melody refresh) ran them all.
> **6 applied. 4 remain**, each for a specific, measured reason.
> Machine twin: `scripts/alignment/lyrics-audit.json` (drives the Studio
> Lyrics Inbox). Submit fixes there, then:
> `node scripts/alignment/realign-inbox.mjs`

## ✅ Fixed by your paste (live now)

| song | was | now |
|---|---|---|
| **music-is-my-drug** | 20 words of whisper garbage, 2.1s error | **309 words @ 0.134s** — un-hide candidate 🎉 |
| going-crazy-hiligaynon-fusion-mix | unofficial | **0.009s** (Hiligaynon aligned clean, no MMS fallback needed) |
| whistle-on-the-river | unofficial | **0.018s** |
| heaven-hell-honey-venom-remix | unofficial | **0.047s** |
| one-more-breath-back-to-myself | 36 broken words | 121 words @ 0.158s, now on your official text |
| red-flags-from-the-beginning | suspect text | your text applied; 0.38s is this song's floor (dense delivery) |

All six had melody re-measured and republished (every one passed the
diatonic gate).

## ⏳ Still open — each needs something specific

| song | what it needs |
|---|---|
| **say-it-with-your-body** | **Rediagnosed: probably not a text problem.** Your new text failed the same way the old one did (11–22% of words in vocal silence) — the published lead stem likely mismatches the release mix. Give it a listen; may need a stem re-publish. |
| **light-it-myself** | Your sheet aligned to 246 words but the song sings ~600 — the choruses are probably written once. **Paste the FULL sung text (repeats included)** and resubmit; the gate held the short version, the good live timings are untouched. |
| **another-year… (birthday song)** | Your lyrics are saved and waiting — the song has **no published lead stem**. Publish its Suno stems, then re-run the inbox. |
| **music-is-my-drug-rooklyn-mix** | Same — lyrics saved, **awaiting stems**. |

## Instrumentals (no action)

ai-interlude · feverbreak
