# LYRICS AUDIT — the songs that need your words

> Measured 2026-07-14, not guessed. Machine-readable twin:
> `scripts/alignment/lyrics-audit.json` (drives the Studio's Lyrics Inbox).
>
> **How to fix one:** tailnet Studio → SETUP → **Lyrics Inbox** → pick the
> song → paste the real lyrics → Save. Then (or ask Claude):
> `node scripts/alignment/realign-inbox.mjs` — it aligns the new text on
> the GPU, snap-refines it, applies ONLY if measurably better than what's
> live (journaled, reversible), and refreshes the song's melody data.

## Needs real lyrics (text is missing or provably wrong)

| song | what's wrong |
|---|---|
| **music-is-my-drug** | text is whisper garbage — 20 words of "Thank you." repeated. Currently pulled. |
| **say-it-with-your-body** | official text mismatches the audio — 22% of words land in vocal silence even after re-alignment. |

## Verify when you can (suspicious signals)

| song | signal |
|---|---|
| **one-more-breath-back-to-myself** | only 121 tokens for a 253s song — likely missing verses. Re-aligned + live (was 2.4s broken, now 0.16s), but heavy echo-clumping says the text is incomplete. |
| **red-flags-from-the-beginning** | re-alignment couldn't beat 0.38s mean onset error — parts of the text likely differ from what's sung. |

## Unofficial text (whisper-derived, never confirmed — paste the real ones when convenient)

- music-is-my-drug-rooklyn-mix
- heaven-hell-honey-venom-remix
- going-crazy-hiligaynon-fusion-mix *(may also need the MMS fallback aligner — Hiligaynon)*
- whistle-on-the-river
- another-year-looks-good-on-you-happy-birthday-song
- light-it-myself *(performing great — 82% melody coverage — but still unconfirmed)*

## Instrumentals (no action)

ai-interlude · feverbreak
