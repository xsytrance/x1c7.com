// Shared helpers for the /api/studio surface (the Planet Studio phone app).
// Owner-gated routes only — see ownerGate. Slugs become R2 key segments, so
// they are validated everywhere with SLUG_RE before touching storage.
import { PUB } from "@/lib/feed/r2";

export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

/** Gallery keys are the diacritic/punctuation-stripped form (topup.mjs norm). */
export const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

export interface GalleryJson {
  slug: string;
  model?: string;
  art: Record<string, string[]>;
}

export interface GuidedJson {
  slug: string;
  references: { id: string; url: string }[];
  images: { id: string; url: string; prompt?: string; ref?: string }[];
}

/** Accept absolute PUB URLs or site-relative paths; return the site-relative
 *  `/planets/...` form gallery.json stores. Null if outside the slug's prefix. */
export function relativize(url: string, slug: string, sub = ""): string | null {
  let rel = url.startsWith(PUB) ? url.slice(PUB.length) : url;
  if (!rel.startsWith("/")) rel = `/${rel}`;
  rel = rel.split("?")[0];
  return rel.startsWith(`/planets/${slug}/${sub}`) ? rel : null;
}

/** The R2 object key for a site-relative `/planets/...` path. */
export const keyOf = (rel: string) => rel.replace(/^\//, "");

export const absolutize = (rel: string) => (rel.startsWith("http") ? rel : `${PUB}${rel}`);
