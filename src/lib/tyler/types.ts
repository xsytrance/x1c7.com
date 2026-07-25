// ═══════════════════════════════════════════════════════════════════════════
// tyler.x1c7.com — the shapes Juan's site is made of. Mirrors the Supabase
// tables created by the `tyler_site_tables` migration. Everything is optional
// or defaulted on purpose: Juan can empty any field from his phone at 1am and
// the public page must still render something honest.
// ═══════════════════════════════════════════════════════════════════════════

export interface TylerPalette {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
}

/** A section of the page, in the order Juan put it. */
export interface TylerSection {
  id: TylerSectionId;
  visible: boolean;
}

export type TylerSectionId = "hero" | "tracks" | "photos" | "press" | "zero";

export interface TylerLink {
  service: string;
  url: string;
}

export interface TylerOptions {
  grain?: boolean;
  scanlines?: boolean;
  particles?: boolean;
  /** Display font for headings — one of the bundled pairings. */
  font?: "scrawl" | "condensed" | "serif" | "mono";
}

export interface TylerSite {
  id: string;
  artist: string;
  by_line: string;
  album: string;
  released: string | null;
  genre: string | null;
  cover: string | null;
  tagline: string | null;
  message: string | null;
  rated: string | null;
  palette: TylerPalette;
  sections: TylerSection[];
  links: TylerLink[];
  socials: TylerLink[];
  options: TylerOptions;
}

export interface TylerTrack {
  id: string;
  title: string;
  subtitle: string | null;
  story: string | null;
  words: string[];
  art: string | null;
  audio_url: string | null;
  suno_url: string | null;
  links: TylerLink[];
  /** Slug of a full x1c7 show, e.g. "madetobreak" -> /t/madetobreak */
  show_slug: string | null;
  sort_order: number;
  /** Eligible to be the every-refresh highlight. */
  spotlight: boolean;
  hidden: boolean;
}

export type TylerMediaKind = "photo" | "press" | "flyer" | "logo" | "stem" | "other";

export interface TylerMedia {
  id: string;
  kind: TylerMediaKind;
  r2_key: string;
  url: string;
  caption: string | null;
  alt: string | null;
  bytes: number | null;
  content_type: string | null;
  sort_order: number;
  hidden: boolean;
}

// ── Defaults: what the page is when the database says nothing ──────────────

/** The album's own palette — the site's factory setting. */
export const TYLER_DEFAULT_PALETTE: TylerPalette = {
  primary: "#d9342b", // red-cup crimson
  secondary: "#ffb45c", // porch-light amber
  accent: "#7c8cff", // dusk indigo glow
  bg: "#080b18", // midnight indigo black
};

export const TYLER_DEFAULT_SECTIONS: TylerSection[] = [
  { id: "hero", visible: true },
  { id: "tracks", visible: true },
  { id: "photos", visible: true },
  { id: "press", visible: true },
  { id: "zero", visible: true },
];

export const TYLER_SECTION_LABELS: Record<TylerSectionId, string> = {
  hero: "The hero",
  tracks: "Songs",
  photos: "Photos",
  press: "Press & links",
  zero: "Coming soon: zer0",
};

export const TYLER_FALLBACK_SITE: TylerSite = {
  id: "main",
  artist: "Tyler Haze",
  by_line: "jayodeed",
  album: "The Party Left Without Me",
  released: null,
  genre: "Alternative Rock",
  cover: null,
  tagline: null,
  message: null,
  rated: null,
  palette: TYLER_DEFAULT_PALETTE,
  sections: TYLER_DEFAULT_SECTIONS,
  links: [],
  socials: [],
  options: { grain: true, scanlines: true, particles: true, font: "scrawl" },
};

/**
 * Whatever came back from the database, made safe to render. Juan cannot break
 * the public page from the admin panel: a missing palette key falls back to the
 * album's own color, an empty section list falls back to the standard order,
 * and anything non-array that should be an array becomes one.
 */
export function normalizeSite(row: Partial<TylerSite> | null | undefined): TylerSite {
  const r = row ?? {};
  const pal = (r.palette ?? {}) as Partial<TylerPalette>;
  const sections = Array.isArray(r.sections) && r.sections.length ? r.sections : TYLER_DEFAULT_SECTIONS;
  return {
    ...TYLER_FALLBACK_SITE,
    ...r,
    palette: {
      primary: pal.primary || TYLER_DEFAULT_PALETTE.primary,
      secondary: pal.secondary || TYLER_DEFAULT_PALETTE.secondary,
      accent: pal.accent || TYLER_DEFAULT_PALETTE.accent,
      bg: pal.bg || TYLER_DEFAULT_PALETTE.bg,
    },
    // Keep only sections we know how to render, and never lose one Juan hasn't
    // seen yet: any missing id is appended, visible.
    sections: [
      ...sections.filter((s) => s && TYLER_SECTION_LABELS[s.id as TylerSectionId]),
      ...TYLER_DEFAULT_SECTIONS.filter((d) => !sections.some((s) => s?.id === d.id)),
    ],
    links: Array.isArray(r.links) ? r.links : [],
    socials: Array.isArray(r.socials) ? r.socials : [],
    options: { ...TYLER_FALLBACK_SITE.options, ...(r.options ?? {}) },
  };
}
