// The art RECIPE table — the single source of truth for how a plate is made.
//
// Extracted from scripts/lexicon/art.mjs so BOTH pipelines can share it. That
// module runs its night-shift routine at IMPORT TIME — importing it merely to
// read the table actually kicked off a lexicon publish — so the table had to
// live somewhere with no side effects. Nothing but data and pure `dress()`
// functions belongs in this file, ever.
//
// 26 recipes across five engines (sdxl · zimage · flux2 · qwen · chroma).
// scripts/art/styles.mjs augments these with the categories and motion
// profiles the song-cut pipeline needs.

// ── negative prompts ────────────────────────────────────────────────────────
export const NEG_SDXL = "text, watermark, logo, caption, letters, low quality, deformed, oversaturated";
export const NEG_ANIME = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, username, blurry";
export const NEG_CHROMA = "This low quality greyscale unfinished sketch is inaccurate and flawed. The image is very blurred and lacks detail with excessive chromatic aberrations and artifacts.";

// ── checkpoints, speed LoRAs and sampler presets ────────────────────────────
const CKPT_TURBO = "sdxl_turbo_1.0_fp16.safetensors";
const CKPT_JUGG = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const CKPT_DREAM = "DreamShaperXL_Turbo_v2_1.safetensors";
const CKPT_ANIM = "animagine-xl-4.0-opt.safetensors";
const LIGHTNING8 = "sdxl_lightning_8step_lora.safetensors";
const TURBO = { steps: 4, cfg: 1, sampler: "euler_ancestral", scheduler: "normal" };
const LIT8 = { steps: 8, cfg: 1.5, sampler: "euler", scheduler: "sgm_uniform" };
const DS_TURBO = { steps: 7, cfg: 2, sampler: "dpmpp_sde", scheduler: "karras" };

export const RECIPES = [
  // ── SDXL Turbo — the fast baseline, two grades
  { id: "cinema", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_TURBO, ...TURBO },
    dress: (p) => `${p}, cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no people` },
  { id: "noir", engine: "sdxl", moods: ["dark", "sad"], sdxl: { ckpt: CKPT_TURBO, ...TURBO },
    dress: (p) => `${p}, black and white film noir photograph, hard chiaroscuro light, deep shadows, 35mm grain, no text` },
  // ── Z-Image Turbo — the photoreal engine
  { id: "photo", engine: "zimage", moods: ["any"],
    dress: (p) => `Documentary photograph of ${p}. Natural light, shallow depth of field, subtle shadows, unfiltered, real life.` },
  { id: "neon-night", engine: "zimage", moods: ["dark", "bright"],
    dress: (p) => `Night street photograph of ${p}. Neon reflections on wet asphalt, cinematic teal and magenta palette, light rain, moody urban atmosphere.` },
  // ── FLUX.2 klein — the composition engine
  { id: "dream-collage", engine: "flux2", moods: ["any"],
    dress: (p) => `Surreal composition: ${p}. Impossible scale, dreamlike juxtaposition, floating elements, soft volumetric haze, highly detailed.` },
  { id: "poster", engine: "flux2", moods: ["bright"],
    dress: (p) => `Minimalist graphic poster of ${p}. Bold geometric shapes, flat color fields, strong diagonal composition, high contrast, screen-print texture.` },
  // ── Qwen-Image — the typography engine: paints THE WORD into the scene
  { id: "word-portrait", engine: "qwen", moods: ["any"],
    dress: (p, word) => `${p}. Integrated into the scene, the word "${word}" appears as elegant hand-painted lettering that belongs to the world of the image, cinematic light.` },
  { id: "word-neon", engine: "qwen", moods: ["dark", "bright"],
    dress: (p, word) => `${p}. A glowing neon sign reading "${word}" hangs in the scene, its light reflecting on nearby surfaces, night atmosphere, cinematic.` },
  // ── Chroma — the art-school wildcard (slow: used sparingly by weight)
  { id: "dark-surreal", engine: "chroma", moods: ["dark", "sad"],
    dress: (p) => `An unfiltered surrealist painting of ${p}. Dark dreamlike atmosphere, rich canvas texture, deep shadow, muted palette with one burning accent color.` },
  { id: "oil-light", engine: "chroma", moods: ["warm", "bright"],
    dress: (p) => `A luminous oil painting of ${p}. Thick impasto brushwork, dramatic golden light, deep color, gallery quality.` },
  // ── Juggernaut — cinematic photoreal
  { id: "film-still", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_JUGG, loras: [[LIGHTNING8, 1]], ...LIT8 },
    dress: (p) => `${p}, cinematic film still, anamorphic lens, dramatic rim lighting, photorealistic, color graded, no text` },
  // ── OSAKA GOLD — Kizuna Sato's house look, lifted from her own artwork:
  // Dotonbori at night, wet neon, and molten LevelReady gold as the one warm
  // accent against the purple. Photoreal, not illustrated. "Forged above gold."
  { id: "osaka-gold", engine: "sdxl", moods: ["dark", "bright"], sdxl: { ckpt: CKPT_JUGG, loras: [[LIGHTNING8, 1]], ...LIT8 },
    dress: (p) => `${p}, night in Dotonbori Osaka, dense stacked neon signage and paper lanterns bathing the scene, rain-wet asphalt throwing long reflections, deep violet and indigo shadows with molten gold as the only warm accent, gold leaf highlights, cinematic anamorphic photograph, shallow depth of field, film grain, no text, no letters, no signage lettering` },
  { id: "analog", engine: "sdxl", moods: ["warm", "sad"], sdxl: { ckpt: CKPT_JUGG, loras: [[LIGHTNING8, 1], ["analog_redmond_v2.safetensors", 0.9]], ...LIT8 },
    dress: (p) => `${p}, AnalogRedmAF, analog film photograph, faded kodak colors, light leak, grain, nostalgic, no text` },
  // ── DreamShaper Turbo — the illustration stable (carries most style LoRAs)
  { id: "concept-art", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_DREAM, ...DS_TURBO },
    dress: (p) => `${p}, epic fantasy concept art, matte painting, volumetric light, intricate detail, no text` },
  { id: "watercolor", engine: "sdxl", moods: ["sad", "warm"], sdxl: { ckpt: CKPT_DREAM, loras: [["watercolor_sdxl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, delicate watercolor painting, soft color washes, wet paper texture, white margins, no text` },
  { id: "storybook", engine: "sdxl", moods: ["warm"], sdxl: { ckpt: CKPT_DREAM, loras: [["storybook_redmond_v2.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, KidsRedmAF, warm children's storybook illustration, soft edges, gentle palette, no text` },
  { id: "papercut", engine: "sdxl", moods: ["warm", "bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["papercut_sdxl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `papercut of ${p}, layered paper craft, depth between layers, clean silhouettes, soft studio shadow, no text` },
  { id: "3d-toy", engine: "sdxl", moods: ["bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["3d_render_style_xl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, 3d style, cute 3d render, soft studio lighting, smooth materials, pastel palette, no text` },
  { id: "pixel", engine: "sdxl", moods: ["bright", "dark"], sdxl: { ckpt: CKPT_DREAM, loras: [["pixel-art-xl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `pixel, pixel art of ${p}, 16-bit videogame scene, limited palette, crisp dithering, no text` },
  { id: "stickers", engine: "sdxl", moods: ["bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["stickers_redmond.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, StickersRedmond, die-cut sticker, bold outlines, vibrant flat colors, white border, no text` },
  { id: "chalkboard", engine: "sdxl", moods: ["warm", "sad"], sdxl: { ckpt: CKPT_DREAM, loras: [["chalkboard_drawing.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `A colorful ChalkBoardDrawing of ${p}, chalk strokes on dark slate, dusty texture, hand-drawn, no text` },
  { id: "neon-sign", engine: "sdxl", moods: ["dark", "bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["neon_sign_style.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p} as a glowing neon sign, PE_NeonSignStyle, electric glow on dark brick wall, night, no text` },
  { id: "stained-glass", engine: "sdxl", moods: ["warm", "dark"], sdxl: { ckpt: CKPT_DREAM, loras: [["stained_glass_portrait.safetensors", 0.85]], ...DS_TURBO },
    dress: (p) => `Stained Glass Portrait of ${p}, luminous colored glass panels, black lead lines, backlit, cathedral light, no text` },
  { id: "graphic-novel", engine: "sdxl", moods: ["dark"], sdxl: { ckpt: CKPT_DREAM, loras: [["graphic_novel_illustration.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `graphic novel illustration of ${p}, inked shadows, halftone shading, dramatic panel composition, muted colors, no text` },
  // ── Animagine — the anime dialect
  { id: "anime", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_ANIM, loras: [[LIGHTNING8, 1]], ...LIT8, negative: NEG_ANIME },
    dress: (p) => `${p}, masterpiece, high score, anime illustration, scenery, cinematic lighting, detailed background` },
  { id: "manga-line", engine: "sdxl", moods: ["dark", "sad"], sdxl: { ckpt: CKPT_ANIM, loras: [[LIGHTNING8, 1], ["lineani_redmond_v2.safetensors", 0.9]], ...LIT8, negative: NEG_ANIME },
    dress: (p) => `${p}, LineAniAF, clean line art, monochrome manga illustration, ink hatching, high contrast` },
];
