#!/usr/bin/env python3
"""
WORD MUSIC — everything the song is doing at the instant a word is sung.

The input to a "rune": a glyph that is simultaneously a word and a notation.
A normal lyric video knows the word and the time. With stems, per-stem MIDI and
a melody it can also know the sung note, its scale degree, the bass under it,
the chord around it, how much of the band is playing, and how far the note sits
from the tonic — which is why the same hook can render differently every time
it repeats, because the harmony beneath it moved.

  python3 scripts/rune/word-music.py --slug hajimemashite [--top 8]

Needs: melody.json (scripts/stem-analysis/out/<slug>), the profile's aligned.json
and senses.json, and the Suno per-stem MIDI in assets/stems/<slug>-midi.
The MIDI clock offset is the drum-locked one (see KINETICA-MOTION §2).
"""
import argparse, glob, json, sys
sys.path.insert(0, "scripts/stem-analysis")
from melody_from_midi import read_midi

NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
DEG = ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"]
# How much the sung note strains AGAINST THE BASS, which is not the same as its
# distance from the key. "suki" is sung on the tonic both times it appears, so
# measured against C minor nothing whatever has changed — and yet the first is
# a b7 over a D bass and restless, the second a 4 over a G and leaning home.
# The interval that MOVES is the one to the bass. Report both.
STRAIN = {0: 0.0, 7: 0.10, 4: 0.20, 5: 0.25, 3: 0.25, 9: 0.30, 8: 0.35,
          2: 0.55, 10: 0.60, 11: 0.75, 1: 0.80, 6: 1.00}
STEMS = ["Bass", "Guitar", "Synth", "Keyboard", "Strings", "Percussion", "Drums", "Backing Vocals"]


def sounding(notes, t):
    return [p for s, e, p in notes if s <= t < e]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--offset", type=float, default=0.06, help="release -> MIDI, from the drums")
    ap.add_argument("--top", type=int, default=8)
    a = ap.parse_args()

    mel = json.load(open(f"scripts/stem-analysis/out/{a.slug}/melody.json"))
    prof = f"scripts/song-analysis/profiles/{a.slug}"
    words = json.load(open(f"{prof}/aligned.json"))["words"]
    sen = json.load(open(f"{prof}/senses.json"))

    mid = {}
    for name in STEMS:
        g = glob.glob(f"assets/stems/{a.slug}-midi/*({name}).mid")
        if g:
            mid[name.lower()] = read_midi(g[0])[0]

    root = NOTES.index(mel["key"]["root"])
    rows = []
    for mw in mel["words"]:
        i = mw["i"]
        if i >= len(words):
            continue
        t = words[i]["t"]
        mt = t - a.offset
        bass = sounding(mid.get("bass", []), mt)
        chord = sorted({p % 12 for k in ("bass", "guitar", "synth", "keyboard") for p in sounding(mid.get(k, []), mt)})
        interval = (mw["pc"] - root) % 12
        cof = (interval * 7) % 12
        signed = cof if cof <= 6 else cof - 12
        fi = min(len(sen["env"]["lead"]) - 1, int(t * sen["envHz"]))
        env = {k: round(v[fi] / 99, 2) for k, v in sen["env"].items()}
        rows.append(dict(
            i=i, word=words[i]["w"], t=round(t, 3),
            note=NOTES[mw["pc"]], midi=mw["midi"], degree=DEG[interval],
            bass=(NOTES[min(bass) % 12] if bass else None),
            over_bass=(DEG[(mw["pc"] - min(bass)) % 12] if bass else None),
            strain=(STRAIN[(mw["pc"] - min(bass)) % 12] if bass else None),
            chord=[NOTES[p] for p in chord],
            tension=round(abs(signed) / 6, 2),
            playing=sum(1 for v in env.values() if v > 0.15), env=env,
        ))
    rows.sort(key=lambda r: -(r["tension"] * 2 + len(r["word"]) * 0.08))
    print(json.dumps(dict(key=f'{mel["key"]["root"]} {mel["key"]["mode"]}', words=rows[:a.top]), indent=1))


if __name__ == "__main__":
    main()
