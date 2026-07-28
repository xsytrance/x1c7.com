# Amor De Verdad — 45-second directed cut

**Status:** rendered and share-encoded on 2026-07-25.

## Selected window

- **Source:** `00:58.50–01:43.50` — exactly 45 seconds.
- **Why it wins:** it contains the entire emotional thesis: *"yo no quiero amor de cine / quiero el que se queda cuando todo se apaga"*, the water/heat metaphor, the direct demand for *amor de verdad*, and the opening of the boundary-setting verse.

## Direction

**Voice:** a symbolic, no-people 3AM-to-dawn apartment story. Deep indigo night, terracotta/rose-gold practical light, rain on glass, rumpled linen, and warm film grain.

| Lyric beat | Directed scene |
|---|---|
| `cuál es la receta / no hay ninguna, solo ven` | two cups and an unclaimed invitation at the window |
| `amor de cine` | an empty red-seat cinema after the final showing |
| `el que se queda` | an ajar apartment door / the evidence of staying |
| `todo se apaga` | the last bedside lamp fading against dawn curtains |
| `agua ... se va con el calor` | rainwater, condensation, and evaporation |
| `amor de verdad` | unpolished intertwined rings in first light |
| `mil horas que se inventan` | 3AM clock, cold cup, tangled charger |
| `si soy tu gasolina, no me quemes` | lone rain-wet gas pump at night |

## Data and art safeguards

- Repaired the directed window's official lyric timings before render; original `aligned.json` is retained in `pre-refix-backup/`.
- Replaced the active art anchors with eight newly generated and eye-audited scenes; all were published and byte-verified at the R2 edge.
- Disabled the gallery and lexicon-reel pools for this song during the directed cut, preventing unrelated imagery from overriding the directed scenes. Existing remote JSON was backed up locally first.
- All section intensities are capped at `0.71` to avoid synthesized shake banners.
- Dynamic+ acts: `SIN RECETA` → `NO AMOR DE CINE` → `AMOR DE VERDAD`.

## Deliverables

| Deliverable | Specification |
|---|---|
| `amor-de-verdad-45-directed-vertical-share.mp4` | native 1080×1920, 60fps, 45.116667s, 16.2 MiB |
| `amor-de-verdad-45-directed-share.mp4` | native 1920×1080, 60fps, 45.116667s, 17.3 MiB |

Render pixel-clock verification:

- 16:9: median A/V error **9ms**, p95 **28ms**
- 9:16: median A/V error **8ms**, p95 **19ms**

QA frames from the final share files were visually audited at the lyric-specific changes, including cinema, lights-out, water/heat, truth, invented-hours, and gasoline beats.
