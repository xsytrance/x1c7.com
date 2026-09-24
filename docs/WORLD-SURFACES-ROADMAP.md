# The World, with surfaces — roadmap

Everything in the 3D world is currently `MeshBasicMaterial`: unlit, flat, one
colour. That is why it reads as a wireframe — there are no surfaces, so there
is nothing for light or image to land on. This is the plan to give it both, and
to make the result belong to the song rather than to the engine.

> **The bound.** Four milestones, one working session each, each ending at a
> tag. **Over two sessions on any one and we stop and reassess.** W4 is
> optional and only starts if W1–W3 land.

## What already exists to build on

| | |
|---|---|
| geometry | a path (`pathAt`), a frame that travels it, instanced rungs and rails |
| per-song art | `assets.keywords` (word → plate), the gallery pool, section art — 832×1472 webp on R2, **open CORS**, already fetched by the 2D engine |
| per-song colour | `analysis.palette`, the measured key, section `colorHint` |
| per-song shape | shape / rails / gap / radius / twist, defaulting off the song id |
| music | stems envelopes, kicks, risers, the bar grid, the melody |

So the inputs for "unique per song" are all present. What is missing is a
surface to put them on.

---

## W1 · Surfaces  ·  tag `world-w1-surfaces`

- [ ] a real **tube mesh** along the path (`TubeGeometry` on the curve) with UVs
      running its length — the corridor becomes a surface, not a stack of hoops
- [ ] emissive gradient from `analysis.palette` down the length
- [ ] **keep the grid**: rungs and rails stay, drawn ON the surface, because the
      grid is what the owner liked. Surface underneath, grid on top.
- [ ] `deck.world.surface: false` keeps the current wireframe exactly

**Done when:** the corridor has a shaded surface and the grid still reads over
it, verified through `verify-effects` against the surface-off render.

**Risk:** a lit material changes every value already tuned (opacity, fog,
colour). Expect to re-tune, and keep the wireframe path as the fallback.

---

## W2 · The song's own images, as architecture  ·  tag `world-w2-plates`

The idea worth having. The gallery stops being wallpaper and becomes the
building: **you fly past the song's own paintings, each one placed where its
word is sung.**

- [ ] plates as **panels set into the wall** at intervals along the corridor
- [ ] a keyword's plate sits at `s = t * SPEED` for the word it belongs to, so
      the art is placed in TIME as well as space — you reach the picture exactly
      when the line arrives
- [ ] section art fills the stretches between keywords
- [ ] texture budget: downscale to 512 on load, cap the number resident, drop
      panels behind the camera

**Done when:** a cut shows its own plates as panels you fly past, each arriving
on its word.

**Risk:** texture memory and first-frame stalls in headless capture. Mitigate by
preloading the next N panels and reusing a fixed texture pool.

---

## W3 · Light  ·  tag `world-w3-light`

- [ ] emissive materials + **UnrealBloom** (from `three/examples/jsm` — no new
      dependency; `@react-three/postprocessing` is NOT installed and is not
      needed for one pass)
- [ ] the kick punches the light; a riser charges it; the tonic owns the hue
- [ ] fog tuned so the far end dissolves rather than ending

**Done when:** glow responds to the song, measured against a light-off render.

---

## W4 · A material voice per song  ·  tag `world-w4-voice`  ·  OPTIONAL

Shape already varies per song. Material is the other half of identity:

- polished dark metal · neon glass · paper and ink · wet concrete · gold leaf

- [ ] a small set of surface treatments, each a material preset
- [ ] chosen per song the way shape is (explicit, else from the song id)
- [ ] palette drives the colour inside each treatment

**Done when:** three songs are unmistakably different worlds, not one world in
three colours.

---

## What makes it BEAUTIFUL rather than merely textured

Worth stating, because "add textures" alone will not get there:

1. **Emissive, not lit.** A music video wants glow, not photorealism. Emissive
   materials plus one bloom pass read far better than a lighting rig, and cost
   less.
2. **Contrast is the whole job.** The corridor must stay dark enough that words
   read over it. Every gain in surface detail is a loss in text legibility —
   the same trade that `pitchLight` exists for.
3. **Let the song's art be the only saturated thing.** Dark corridor, glowing
   panels. That is what makes the plates feel placed rather than pasted.
4. **Motion over detail.** At 9 units/second most surface detail is a blur; the
   silhouette, the bend and the light are what the eye actually gets.

## Sequencing note

W2 is the one that makes cuts unique. W1 exists to make W2 possible, and W3 to
make it beautiful. If time runs short, W1 + W2 without bloom is still a
transformed video; W3 + W4 without W2 is a prettier tube that looks the same
for every song.
