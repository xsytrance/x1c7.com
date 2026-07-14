# LYRICS AUDIT — status after the owner's big paste (2026-07-14)

> Round 2 (stems landed): the birthday song went first-class end to end —
> stems published, mixer live, the owner's lyrics at **0.038s**, melody
> A# major 0.97. The Rooklyn mix has stems + a live mixer + refined
> timings + melody now, but its pasted text fit WORSE than the whisper
> words (the remix rearranges the original) — back to the list.
> **7 fixed total. 3 remain**, each for a specific, measured reason.
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
| **music-is-my-drug-rooklyn-mix** | Stems live now — but your pasted text fits worse than the whisper words (0.28s vs 0.10s): the remix rearranges the original's lyrics. Re-check against the actual mix and resubmit. |

## Instrumentals (no action)

ai-interlude · feverbreak
