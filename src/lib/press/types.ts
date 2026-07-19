// ═══════════════════════════════════════════════════════════════════════════
// THE PRESSING PLANT — core types (Cover Studio 3, P1)
//
// The load-bearing abstraction: a format is a TemplateDescriptor =
//   • SURFACES — print dielines in real MILLIMETERS (trim + bleed + safe area
//     + folds + holes) each carrying an ordered layer stack, and
//   • a SHELL — parametric 3D geometry mapping those surfaces onto meshes
//     (arrives with THE BOOTH; null until then / for flat-only templates).
// One render function serves the live preview (low dpi), 3D textures
// (~1024px), and print export (300dpi + bleed) because everything is mm.
// The collector game-case is template #1 via a LEGACY wrapper that delegates
// to src/lib/collector/webEngine.ts untouched (its 2048px space is preserved;
// scripts/press/check-parity.mjs enforces byte-identical output).
// ═══════════════════════════════════════════════════════════════════════════

/** Physical millimeters — the only unit template math is written in. */
export type Mm = number;

export interface RectMm { x: Mm; y: Mm; w: Mm; h: Mm }

export interface TextPlacement {
  x: Mm; y: Mm;
  rot: 0 | 90 | 180 | 270;
  sizePt: number;
  align: "start" | "middle" | "end";
  family: string;               // must be one of the plant's embedded families
  color?: string;
  tracking?: number;            // letter-spacing in px at render dpi
}

export type LayerDef =
  | { kind: "bg" }                                              // palette gradient + texture
  | { kind: "art"; slot: string }                               // which art slot fills it
  | { kind: "chrome"; render: ChromeRenderer }                  // template signature furniture
  | { kind: "text"; id: string; role: "title" | "subtitle" | "label" | "tracklist" | "free"; default: TextPlacement }
  | { kind: "waveform"; region: RectMm }
  | { kind: "braille"; region: RectMm }
  | { kind: "advisory"; region: RectMm }
  | { kind: "tracklist"; region: RectMm };

/** Emits an SVG fragment for a surface. px converts mm→px at the render dpi. */
export type ChromeRenderer = (
  project: ProjectSpec,
  surface: SurfaceDef,
  px: (mm: Mm) => number,
) => string;

export interface SurfaceDef {
  id: string;                   // "jcard", "labelA", "sleeveFront", …
  name: string;                 // UI label
  size: { w: Mm; h: Mm };       // TRIM size (pre-bleed)
  bleed: Mm;
  safe: Mm;                     // safe-area inset from trim
  folds?: { at: Mm; axis: "x" | "y"; label?: string }[];
  holes?: { cx: Mm; cy: Mm; r: Mm }[];
  shape?: "rect" | "circle";    // circle → circular clip + hole punch on export
  layers: LayerDef[];
  exportDpi?: number;           // default 300
}

export interface ShellFace {
  surfaceId: string;
  mesh: string;                 // named mesh within the shell component
  uv: { u0: number; v0: number; u1: number; v1: number };
}

export interface ShellDef {
  kind: "jewel" | "cassette" | "vinyl" | "disc" | "cart" | "slab";
  faces: ShellFace[];
  idle?: "turntable" | "tilt";
}

export interface TemplateDescriptor {
  id: string;
  name: string;
  era?: string;
  blurb: string;
  surfaces: SurfaceDef[];
  shell: ShellDef | null;       // null until THE BOOTH / for flat-only templates
  /** Legacy escape hatch — the collector game-case renders through the
   *  untouched webEngine instead of the surface pipeline. */
  legacy?: boolean;
}

// ── The project (persisted state) ───────────────────────────────────────────

export interface ArtRef { assetId: string; topCrop?: number }

export interface TrackEntry { n: number; name: string; time?: string }

/** Compact, persistable analysis — never the raw envelopes. */
export interface AnalysisSummary {
  bpm?: number | null;
  duration?: number | null;
  peaks?: number[] | null;                    // 96 buckets
  sections?: { name: string; start: number; intensity?: number; emotion?: string }[];
  keywords?: { word: string; emotion?: string }[];
  styleWords?: string[];                      // parsed style text
  exclusions?: string[];                      // parsed exclusions (R7 soft veto)
  sources: ("art" | "audio" | "stems" | "lyrics" | "style" | "exclusions")[];
}

export interface SurfaceOverride {
  hidden?: string[];                                    // layer/text ids switched off
  text?: Record<string, Partial<TextPlacement> & { value?: string }>;
  art?: Partial<ArtRef>;
  paletteKey?: string;                                  // per-surface divergence
}

export interface ProjectSpec {
  v: 1;
  id: string;
  templateId: string;
  identity: {
    title: string;
    genre?: string | null;
    paletteKey?: string | null;     // null = auto-classified
    spineWord?: string | null;
    label: string;
    handle?: string | null;
    monogram?: string | null;
    lang?: string | null;
    geo?: string | null;
    series?: string | null;
    explicit?: boolean;
    unreleased?: boolean;
  };
  facts: {
    bpm?: number | null;
    runtime?: string | null;
    duration?: number | null;
    peaks?: number[] | null;
    tracklist?: TrackEntry[];
  };
  art: { slots: Record<string, ArtRef> };
  surfaces: Record<string, SurfaceOverride>;   // SPARSE — depth = opting in
  analysis?: AnalysisSummary | null;
  lyrics?: string | null;                      // kept locally for recs/booklet
  booklet?: import("./booklet/model").BookletState | null;
  seeds?: { word: string; senseIdx: number; why?: string }[];
  updatedAt: string;
}

// ── Recommendations (deterministic, FREE) ───────────────────────────────────

export interface Recommendation {
  id: string;                    // rule id, e.g. "R1-palette"
  read: string;                  // "This reads as Liquid DnB"
  suggestion: string;            // "the blue grid spine suits it"
  overrideHint?: string;         // "or force LATIN wood"
  apply: (p: ProjectSpec) => ProjectSpec;
  measured?: boolean;            // true = "measured on-device", else "our read"
}
