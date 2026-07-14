// ═══════════════════════════════════════════════════════════════════════════
// GRAVITY SEEDS — human guardrails for word gravity.
//
// The scorer and the LLM grader can argue about the middle of the scale, but
// they never override a seed: HEAVY seeds floor at 0.75 (always painted),
// LIGHT seeds cap at 0.15 (never painted). Curated by the owner's brief:
// "we need words like love, break, fire, soul, gold, drink, smoke — not
// 'every' or 'the' or silly words like that."
// ═══════════════════════════════════════════════════════════════════════════

export const HEAVY_SEED = new Set((
  // elements + heat
  "fire flame burn ash ember smoke spark blaze heat cold ice frost freeze storm thunder lightning rain snow wind flood wave ocean sea river tide desert dust " +
  // body + blood
  "heart soul blood bone skin breath tears eyes lips hands veins pulse scars wounds sweat " +
  // love + war
  "love hate kiss touch break broken war peace fight battle knife gun bullet wound enemy lover angel devil demon ghost spirit heaven hell sin grace mercy " +
  // riches + vice
  "gold silver diamond money cash crown king queen throne drink whiskey wine liquor poison venom honey sugar drug high smoke pill bottle glass " +
  // dark + light
  "night midnight dark shadow light dawn sunrise sunset moon moonlight star stars sun sky eclipse neon glow candle lantern " +
  // place + motion
  "home road street city skyline train wings fly fall falling rise run running escape chains cage prison door window mirror wall bridge edge cliff gravity " +
  // time + fate
  "forever never always memory memories yesterday tomorrow destiny fate promise secret lie lies truth dream dreams nightmare " +
  // music + voice
  "song voice scream whisper echo silence rhythm beat bass drum melody choir " +
  // seasons + nature
  "summer winter spring autumn garden rose roses thorn petals bloom wither seed roots forest wolf lion snake phoenix butterfly " +
  // force
  "power crash collide shatter explode burst bleed drown suffocate gasoline dynamite hurricane earthquake avalanche"
).split(/\s+/).filter(Boolean));

export const LIGHT_SEED = new Set((
  // quantifiers + fillers the lyrics pass let through
  "every everything something anything nothing someone anyone everyone thing things stuff " +
  "really very just only even still also too again always sometimes maybe perhaps quite " +
  "much many more most some other another both each all any none " +
  "here there where when what which while because though although " +
  "make makes making made take takes taking took give gives giving gave " +
  "come comes coming came goes went gone want wants wanted need needs needed " +
  "say says saying said tell tells telling told talk talks talking " +
  "look looks looking looked see sees seeing seen watch watching " +
  "feel feels feeling felt think thinks thinking thought know knows knowing knew " +
  "keep keeps keeping kept put puts putting let lets letting get gets getting " +
  "yeah yes okay whoa " +
  // spanish fillers
  "pero como esta este esa ese aqui alli donde cuando porque todo toda todos nada algo alguien"
).split(/\s+/).filter(Boolean));
