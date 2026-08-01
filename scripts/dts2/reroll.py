"""Re-rolls for the three BLUEPRINT DAWN scenes that failed the eyes-on audit.

Playbook rule: reject and re-roll, never pick the least-bad.

  away   Kontext painted a blurred gibberish sign across the top eighth of the
         frame (§12: it writes signage even when told not to). Re-asked with
         the destruction reading as pure architecture and sky.
  learn  Came back as a DJ booth with laser fans — a duplicate of `light`, and
         nothing to do with learning. Re-asked as a closed interior, no crowd,
         no beams, screens only.
  too    Invented a photoreal FACE for the protagonist. Every other scene in
         the series keeps him a silhouette or a back view, and the invented
         face is not Rod's — putting a stranger on the line "and I'm different
         too" is worse than showing no face at all. Re-asked as a back view.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from art import GRADE, HERO_ID, OUT, bp, generate  # noqa: F401

REROLL = [
    ("away", "city", 0.58,
     "A grey open-plan cubicle office is coming apart in mid-air at dawn: "
     "partition walls, ceiling panels and swivel chairs lifting off and "
     "tumbling upward into a brightening sky, breaking into flecks of ash and "
     "loose paper, revealing clean open air and a huge sunrise behind where "
     "the back wall used to be. Nobody in frame. Pure architecture, sky and "
     "debris — completely empty of any board, sign, poster, screen or panel "
     "that could carry writing."),

    ("learn", "hero", 0.45,
     HERO_ID + "Interior, night, a small dark room — no crowd, no stage, no "
     "laser beams, no audience. Extreme close profile of him bent toward a "
     "single large monitor, the only light in the frame, its soft glow and "
     "the faint drift of diagrams reflected across his cheek and headphones. "
     "Quiet, private, absolute concentration. A person studying alone."),

    ("too", "hero", 0.05,
     HERO_ID + "He stands in full warm morning daylight seen FROM BEHIND over "
     "his shoulder, hood down off his head, shoulders squared and set, "
     "completely solid and real, looking out at a sunlit sharp-edged city "
     "skyline ahead of him. Do NOT show his face — keep him a back view or a "
     "clean silhouette, exactly like the rest of the series. A portrait of a "
     "man who finished changing, told entirely through his stance."),
]

if __name__ == "__main__":
    for word, *_ in REROLL:
        p = OUT / f"{word}.png"
        if p.exists():
            p.rename(OUT / f"{word}.rejected.png")
    print(f"re-rolling {len(REROLL)} scenes")
    with ThreadPoolExecutor(max_workers=3) as ex:
        for line in ex.map(lambda s: generate(s[0], s[1], s[2], s[3]), REROLL):
            print(line, flush=True)
