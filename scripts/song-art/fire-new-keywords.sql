-- Wire the 4 new keyword paintings (knife/cage/moon/wire) into
-- "I Won't Be Your Fire". The 8 webps are already live on R2.
-- IDEMPOTENT: safe to run any number of times (dedupes the keywords array;
-- assets objects merge-overwrite). Paste into the Supabase SQL editor.
update tracks
set planet = jsonb_set(
  jsonb_set(
    jsonb_set(
      planet,
      '{analysis,keywords}',
      coalesce((select jsonb_agg(k) from jsonb_array_elements(planet #> '{analysis,keywords}') k
                where k->>'word' not in ('knife','cage','moon','wire')), '[]'::jsonb)
      || $k$[
        {"word":"knife","emotion":"Defiant","imageryPrompt":"a lone knife on a dark cutting board, cold steel blade, one hard rim of light"},
        {"word":"cage","emotion":"Torn","imageryPrompt":"an empty iron birdcage, door left open, dim rain-streaked room"},
        {"word":"moon","emotion":"Wistful","imageryPrompt":"a pale full moon over a dark distant city, cold blue night"},
        {"word":"wire","emotion":"Desperate","imageryPrompt":"a taut high-tension wire against a bruised twilight sky, one bright spark"}
      ]$k$::jsonb
    ),
    '{assets,keywords}',
    (planet #> '{assets,keywords}') || $ak$ {
      "knife":"/planets/i-won-t-be-your-fire/knife.webp",
      "cage":"/planets/i-won-t-be-your-fire/cage.webp",
      "moon":"/planets/i-won-t-be-your-fire/moon.webp",
      "wire":"/planets/i-won-t-be-your-fire/wire.webp"
    } $ak$::jsonb
  ),
  '{assets,alt}',
  (planet #> '{assets,alt}') || $al$ {
    "/planets/i-won-t-be-your-fire/knife.webp":"/planets/i-won-t-be-your-fire/knife-2.webp",
    "/planets/i-won-t-be-your-fire/cage.webp":"/planets/i-won-t-be-your-fire/cage-2.webp",
    "/planets/i-won-t-be-your-fire/moon.webp":"/planets/i-won-t-be-your-fire/moon-2.webp",
    "/planets/i-won-t-be-your-fire/wire.webp":"/planets/i-won-t-be-your-fire/wire-2.webp"
  } $al$::jsonb
)
where id = 'i-won-t-be-your-fire'
returning
  jsonb_array_length(planet #> '{analysis,keywords}') as keywords,   -- expect 11
  jsonb_array_length(planet #> '{interactions,moments}') as moments, -- expect 7
  (planet #> '{assets,keywords}') ? 'knife' and (planet #> '{assets,keywords}') ? 'wire' as new_kw_art;
