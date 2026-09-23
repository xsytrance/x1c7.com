#!/usr/bin/env python3
"""
Melody from MIDI — the singer's notes, taken from Suno's own MIDI export.

Drop-in replacement for analyze_melody.py's pitch source. Same CLI shape,
same melody.json schema (v1), so every consumer — src/lib/engine/melody.ts,
KineticStage, melody-batch's QA gate — works unchanged.

WHY: pYIN on a separated vocal stem is unsure of itself. Across the 50 songs
with a melody.json, only 4-41% of words clear the engine's conf >= 0.35 gate
(typically ~1 in 5), so the melody sense is mostly dark in shipped cuts. A
MIDI note has no confidence problem: it either sounds in the word's window or
it doesn't. This needs no librosa, no GPU and no audio decode — it parses.

Suno's MIDI is a PERFORMANCE, not a score: no time signatures, a per-beat
tempo map, nothing quantized. None of that matters here — we only ask which
note is sounding at a given second.

Its key signatures are UNUSABLE and deliberately ignored. The 0x59 meta
event's `sf` byte must be -7..+7 (sharps/flats); Suno writes 15 and 12, which
are outside the range and decode to nothing on any reading we could find
(as a pitch class, 15 -> D# would make hajimemashite D# minor, the WORST of
the twelve K-S fits at r=-0.318). We take the key from the notes instead:
Krumhansl-Schmuckler on the duration-weighted pitch-class histogram, which
on one-tap-away independently reproduced pYIN's audio-derived A# major.

Usage:
  python3 scripts/stem-analysis/melody_from_midi.py \
    --midi "<song> (Vocals).mid" --words aligned.json --out melody.json \
    [--lag 0.0]        # senses.json align.lag; word times are release-clock
    [--offset auto]    # MIDI->release offset; 'auto' searches, or give seconds
    [--min-overlap 0.2]

Output melody.json (v1): { v, key:{root,mode,conf}, words:[{i,t,midi,pc,conf}] }
  conf here = the fraction of the word's window the note actually covers.
"""
import argparse, json, struct, sys

NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Krumhansl-Schmuckler probe tones — same numbers analyze_melody.py uses, so
# a MIDI-derived key is comparable with an audio-derived one.
MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ── MIDI ────────────────────────────────────────────────────────────────────
def _vlq(b, i):
    v = 0
    while True:
        c = b[i]; i += 1; v = (v << 7) | (c & 0x7F)
        if not c & 0x80:
            return v, i


def read_midi(path):
    """→ (notes[(start_s, end_s, pitch)], keysig|None). Tempo map applied."""
    b = open(path, "rb").read()
    if b[:4] != b"MThd":
        raise ValueError(f"not a MIDI file: {path}")
    _fmt, ntrk, div = struct.unpack(">HHH", b[8:14])
    if div & 0x8000:
        raise ValueError("SMPTE time division unsupported")
    i, tempos, keysig, raw = 14, [], None, []
    for _ in range(ntrk):
        if b[i:i + 4] != b"MTrk":
            break
        ln = struct.unpack(">I", b[i + 4:i + 8])[0]
        end, j, t, run = i + 8 + ln, i + 8, 0, None
        open_notes = {}
        while j < end:
            d, j = _vlq(b, j); t += d
            st = b[j]
            if st & 0x80:
                run = st; j += 1
            else:
                st = run
            if st == 0xFF:
                mt = b[j]; j += 1
                l2, j = _vlq(b, j); dat = b[j:j + l2]; j += l2
                if mt == 0x51 and l2 == 3:
                    tempos.append((t, struct.unpack(">I", b"\x00" + dat)[0]))
                elif mt == 0x59 and l2 == 2 and keysig is None:
                    sf = dat[0] - 256 if dat[0] > 127 else dat[0]
                    keysig = (sf, dat[1])
            elif st in (0xF0, 0xF7):
                l2, j = _vlq(b, j); j += l2
            else:
                hi = st & 0xF0
                n = 1 if hi in (0xC0, 0xD0) else 2
                p = b[j:j + n]; j += n
                if hi == 0x90 and p[1] > 0:
                    open_notes.setdefault(p[0], []).append(t)
                elif hi == 0x80 or (hi == 0x90 and p[1] == 0):
                    q = open_notes.get(p[0])
                    if q:
                        raw.append((q.pop(0), t, p[0]))
        for pitch, starts in open_notes.items():      # unterminated → 1 beat
            for s in starts:
                raw.append((s, s + div, pitch))
        i = end

    # tick → seconds through the tempo map
    tempos.sort()
    if not tempos:
        tempos = [(0, 500000)]
    if tempos[0][0] > 0:
        tempos.insert(0, (0, 500000))
    marks, sec = [], 0.0
    for n, (tick, us) in enumerate(tempos):
        if n:
            prev_tick, prev_us = tempos[n - 1]
            sec += (tick - prev_tick) / div * (prev_us / 1e6)
        marks.append((tick, sec, us))

    def t2s(tick):
        lo, hi = 0, len(marks) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if marks[mid][0] <= tick:
                lo = mid
            else:
                hi = mid - 1
        tk, s, us = marks[lo]
        return s + (tick - tk) / div * (us / 1e6)

    notes = sorted((t2s(s), t2s(e), p) for s, e, p in raw if e > s)
    return notes, keysig


def key_from_notes(notes):
    """K-S on the duration-weighted pitch-class histogram of the sung notes."""
    hist = [0.0] * 12
    for s, e, p in notes:
        hist[p % 12] += e - s
    tot = sum(hist) or 1.0
    hist = [h / tot for h in hist]

    def corr(a, b):
        n = len(a)
        ma, mb = sum(a) / n, sum(b) / n
        da = [x - ma for x in a]; db = [x - mb for x in b]
        num = sum(x * y for x, y in zip(da, db))
        den = (sum(x * x for x in da) * sum(y * y for y in db)) ** 0.5
        return num / den if den else -2.0

    best = (-2.0, "C", "major")
    for shift in range(12):
        rolled = hist[shift:] + hist[:shift]
        for prof, mode in ((MAJ, "major"), (MIN, "minor")):
            r = corr(rolled, prof)
            if r > best[0]:
                best = (r, NOTES[shift], mode)
    return {"root": best[1], "mode": best[2], "conf": round(best[0], 3)}


def keysig_name(ks):
    if not ks:
        return None
    sf, mi = ks
    maj = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"]
    mino = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"]
    idx = sf + 7
    if not 0 <= idx < 15:
        return None
    return f"{(mino if mi else maj)[idx]} {'minor' if mi else 'major'}"


# ── word windows ────────────────────────────────────────────────────────────
def windows(words, lag):
    """Word i covers [t, next_t) on the STEM clock, capped at 2.5s."""
    out = []
    for i, w in enumerate(words):
        t0 = float(w["t"]) - lag
        t1 = (float(words[i + 1]["t"]) - lag) if i + 1 < len(words) else t0 + 0.6
        t1 = min(t1, t0 + 2.5)
        if t1 - t0 >= 0.05:
            out.append((i, t0, t1))
    return out


def assign(wins, notes, offset, min_overlap):
    """Per window, the note covering most of it. notes are shifted by offset."""
    out, j = [], 0
    for i, t0, t1 in wins:
        t0 -= offset; t1 -= offset
        while j > 0 and notes[j - 1][1] > t0:
            j -= 1
        while j < len(notes) and notes[j][1] <= t0:
            j += 1
        best, k = (0.0, None), j
        while k < len(notes) and notes[k][0] < t1:
            ov = min(t1, notes[k][1]) - max(t0, notes[k][0])
            if ov > best[0]:
                best = (ov, notes[k])
            k += 1
        if best[1] and best[0] / (t1 - t0) >= min_overlap:
            out.append((i, best[1][2], round(min(1.0, best[0] / (t1 - t0)), 3)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--midi", required=True, help="the (Vocals).mid export")
    ap.add_argument("--words", required=True, help="aligned.json ({words:[{t,w}]}) or a raw list")
    ap.add_argument("--out", required=True)
    ap.add_argument("--lag", type=float, default=0.0)
    ap.add_argument("--offset", default="auto", help="'auto' (needs --drums/--senses) or seconds")
    ap.add_argument("--drums", default=None, help="the (Drums).mid export — locks the clock")
    ap.add_argument("--senses", default=None, help="senses.json — measured kicks/beats")
    ap.add_argument("--min-overlap", type=float, default=0.2)
    a = ap.parse_args()

    data = json.load(open(a.words))
    words = data["words"] if isinstance(data, dict) else data
    if not words:
        log("✗ no words"); sys.exit(1)

    notes, ks = read_midi(a.midi)
    if not notes:
        log("✗ no notes in MIDI"); sys.exit(1)
    log(f"▶ {len(notes)} notes, {notes[0][0]:.1f}s–{notes[-1][1]:.1f}s"
        f"  keysig={keysig_name(ks) or '—'}")

    if a.offset == "auto":
        # THE CLOCK COMES FROM THE DRUMS, NEVER THE VOCALS.
        #
        # Vocal MIDI is a melodic CONTOUR, not a syllable track: Suno merges
        # runs and melismas into sustained notes, so this song has 111 vocal
        # notes under 134 words. Matching word onsets to note onsets scores
        # 29% even at the clock offset we know to be right — it cannot tell a
        # good alignment from a bad one, and "most words got a note" is true
        # at EVERY offset because the notes are dense. That is a silent
        # failure waiting to happen.
        #
        # Drums can be checked. senses.json already carries kick and beat
        # times measured off the isolated drum stem, and drum MIDI onsets are
        # sharp, so the peak is unmistakable: hajimemashite lands 82% at
        # +0.06s against a 28% background. Lock the clock there, then read
        # the vocal notes by OVERLAP with each word's window.
        if not a.drums or not a.senses:
            log("\u2717 --offset auto needs --drums and --senses (or pass --offset)")
            sys.exit(2)
        sen = json.load(open(a.senses))
        grid = sorted(sen.get("kicks") or sen.get("beats") or [])
        if len(grid) < 20:
            log("\u2717 senses.json has no usable kick/beat grid"); sys.exit(2)
        dnotes, _ = read_midi(a.drums)
        don = sorted(n[0] for n in dnotes)

        def agree(off, tol=0.06):
            hit, j = 0, 0
            for g in grid:
                x = g - off
                while j < len(don) - 1 and don[j] < x - tol:
                    j += 1
                k = j
                while k < len(don) and don[k] <= x + tol:
                    if abs(don[k] - x) <= tol:
                        hit += 1
                        break
                    k += 1
            return hit / len(grid)

        scores = [(agree(st * 0.01), st * 0.01) for st in range(-300, 301)]
        peak, offset = max(scores)
        vals = sorted(v for v, _ in scores)
        bg = vals[len(vals) // 2]
        log(f"\u25b6 clock from drums: {peak:.0%} of kicks hit a MIDI drum onset "
            f"at {offset:+.2f}s  (background {bg:.0%}, {peak / max(bg, 1e-9):.1f}x)")
        if peak < 0.55 or peak < bg * 2.0:
            log("\u2717 no clear drum peak \u2014 wrong MIDI for this song, or a bad stem analysis")
            sys.exit(2)
        # stems.json/senses.json times are already on the release mp3's clock
        # (analyze_stems.py cross-correlates them there), and so are the word
        # times — so this offset maps release -> MIDI directly and align.lag
        # must NOT be applied again on top of it.
        lag = 0.0
        if a.lag:
            log(f"  (ignoring --lag {a.lag}: the drum offset already carries it)")
    else:
        offset = float(a.offset)
        lag = a.lag

    wins = windows(words, lag)
    hits = assign(wins, notes, offset, a.min_overlap)
    key = key_from_notes(notes)
    out_words = [{"i": i, "t": round(float(words[i]["t"]), 3),
                  "midi": float(p), "pc": int(p) % 12, "conf": c}
                 for i, p, c in hits]

    json.dump({"v": 1, "key": key, "words": out_words}, open(a.out, "w"))
    gate = sum(1 for w in out_words if w["conf"] >= 0.35)
    log(f"✓ {len(out_words)}/{len(words)} words pitched  "
        f"({gate} clear the 0.35 engine gate) → {a.out}")
    log(f"  key {key['root']} {key['mode']} (r={key['conf']})"
        f"   midi keysig says {keysig_name(ks) or '—'}")


if __name__ == "__main__":
    main()
