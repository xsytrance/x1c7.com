// ═══════════════════════════════════════════════════════════════════════════
// SURFACE RENDERER — one function, three consumers. A SurfaceDef (mm dieline)
// plus the ProjectSpec renders to an SVG string at any pxPerMm, so the live
// preview (low dpi), the 3D textures (mid), and the print export (300dpi +
// bleed) can never disagree. `mode` splits the stack for canvas compositing:
//   bg  → everything UNDER the art (palette gradient + texture)
//   fg  → everything OVER the art (chrome, text, waveform, braille, tracklist)
//   all → both + an <image> art layer (inline previews)
// ═══════════════════════════════════════════════════════════════════════════
import { COLLECTOR_PALETTES, classifyCollector, type CollectorPalette } from "@/lib/studio/collectorPalettes";
import { esc, textureDefs, wavePath, brailleSVG } from "../kit/svgPrimitives";
import { ptToPx } from "../units";
import type { ProjectSpec, SurfaceDef, TextPlacement } from "../types";

export interface SurfaceRenderCtx {
  pxPerMm: number;
  mode: "bg" | "fg" | "all";
  bleed?: boolean;            // include bleed margin (exports)
  guides?: boolean;           // draw fold/safe guides (preview only)
  fontCSS?: string;           // embedded fonts (rasterized paths only)
  artUrl?: string | null;     // mode "all" preview art
  artDim?: { w: number; h: number } | null;
}

export function paletteOf(p: ProjectSpec, surfaceId?: string): { key: string; pal: CollectorPalette } {
  const over = surfaceId ? p.surfaces[surfaceId]?.paletteKey : undefined;
  const key = over || p.identity.paletteKey || classifyCollector(p.identity.genre).key;
  return { key, pal: COLLECTOR_PALETTES[key] ?? COLLECTOR_PALETTES.ARCHIVE };
}

export const GOLD = "#d4af37", GOLD_HI = "#f0d878", GOLD_LO = "#8a6d1e";

/** Spine/genre word for PUBLIC chrome: never leak the house ARCHIVE label
 *  ("AGENOR") as a default — no genre, no word. */
export function publicWord(p: ProjectSpec, surfaceId?: string): string {
  if (p.identity.spineWord) return p.identity.spineWord.toUpperCase();
  const { key, pal } = paletteOf(p, surfaceId);
  return key === "ARCHIVE" && !p.identity.paletteKey ? "" : pal.label;
}

/** Art region of a surface (trim box) in mm — templates may override via layer art region later. */
export function artRegionMm(s: SurfaceDef): { x: number; y: number; w: number; h: number } {
  // default: art fills the surface trim; cassette/vinyl chrome draws over it
  return { x: 0, y: 0, w: s.size.w, h: s.size.h };
}

/** Cover-fit placement of an image into a mm region, in px. */
export function coverFit(imgW: number, imgH: number, region: { x: number; y: number; w: number; h: number }, px: (mm: number) => number) {
  const rw = px(region.w), rh = px(region.h);
  const scale = Math.max(rw / imgW, rh / imgH);
  const dw = imgW * scale, dh = imgH * scale;
  return { x: px(region.x) - (dw - rw) / 2, y: px(region.y) - (dh - rh) / 2, w: dw, h: dh, clipX: px(region.x), clipY: px(region.y), clipW: rw, clipH: rh };
}

export function textSVG(id: string, t: TextPlacement & { value?: string }, value: string, px: (mm: number) => number, dpi: number): string {
  if (!value) return "";
  const x = px(t.x), y = px(t.y);
  const size = ptToPx(t.sizePt, dpi);
  const rot = t.rot ? ` transform="rotate(${t.rot} ${x} ${y})"` : "";
  return `<text data-id="${esc(id)}" x="${x}" y="${y}" font-family="${esc(t.family)}" font-size="${size.toFixed(1)}" fill="${t.color || "#efe9da"}" text-anchor="${t.align}"${t.tracking ? ` letter-spacing="${t.tracking}"` : ""}${rot}>${esc(value)}</text>`;
}

export function renderSurfaceSVG(s: SurfaceDef, p: ProjectSpec, ctx: SurfaceRenderCtx): string {
  const px = (mm: number) => mm * ctx.pxPerMm;
  const dpi = ctx.pxPerMm * 25.4;
  const bleed = ctx.bleed ? s.bleed : 0;
  const W = px(s.size.w + 2 * bleed), H = px(s.size.h + 2 * bleed);
  const off = px(bleed); // trim-box offset inside the bleed canvas
  const { pal } = paletteOf(p, s.id);
  const over = p.surfaces[s.id];
  const hidden = new Set(over?.hidden ?? []);
  const texId = `tex-${s.id}`;
  const gradId = `grad-${s.id}`;

  let bg = "", fg = "", art = "";

  // clip everything to the dieline shape (circle surfaces get the disc treatment)
  const shapeClipId = `shape-${s.id}`;
  const cx = off + px(s.size.w) / 2, cy = off + px(s.size.h) / 2;
  const shapeClip = s.shape === "circle"
    ? `<clipPath id="${shapeClipId}"><circle cx="${cx}" cy="${cy}" r="${px(Math.min(s.size.w, s.size.h) / 2 + bleed)}"/></clipPath>`
    : "";

  for (const layer of s.layers) {
    if (layer.kind === "text" && hidden.has(layer.id)) continue;
    switch (layer.kind) {
      case "bg":
        bg += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${gradId})"/>`;
        bg += `<rect x="0" y="0" width="${W}" height="${H}" filter="url(#${texId})"/>`;
        break;
      case "art": {
        if (ctx.mode !== "all" || !ctx.artUrl || !ctx.artDim) break;
        const region = artRegionMm(s);
        const f = coverFit(ctx.artDim.w, ctx.artDim.h, { ...region, x: region.x + bleed, y: region.y + bleed }, px);
        const clipId = `artclip-${s.id}`;
        art += `<clipPath id="${clipId}"><rect x="${f.clipX - px(bleed)}" y="${f.clipY - px(bleed)}" width="${f.clipW + 2 * px(bleed)}" height="${f.clipH + 2 * px(bleed)}"/></clipPath>` +
          `<image href="${ctx.artUrl}" x="${f.x - px(bleed)}" y="${f.y - px(bleed)}" width="${f.w + 2 * px(bleed)}" height="${f.h + 2 * px(bleed)}" preserveAspectRatio="none" clip-path="url(#${clipId})"/>`;
        break;
      }
      case "chrome":
        // chrome renderers work in trim space; the translate handles bleed
        fg += `<g transform="translate(${off} ${off})">${layer.render(p, s, px)}</g>`;
        break;
      case "text": {
        const o = over?.text?.[layer.id];
        const merged = { ...layer.default, ...o };
        const value = o?.value ?? defaultTextValue(layer.id, layer.role, p);
        // trim-space → bleed canvas: shift by off
        fg += `<g transform="translate(${off} ${off})">${textSVG(layer.id, merged, value, px, dpi)}</g>`;
        break;
      }
      case "waveform": {
        const peaks = p.facts.peaks;
        if (!peaks?.length) break;
        fg += `<g transform="translate(${off} ${off})">${wavePath(peaks, px(layer.region.x), px(layer.region.y + layer.region.h / 2), px(layer.region.w), px(layer.region.h), pal.accent2)}</g>`;
        break;
      }
      case "braille": {
        const word = publicWord(p, s.id).replace(/[^a-z&-]/gi, "");
        if (!word) break;
        fg += `<g transform="translate(${off} ${off})">${brailleSVG(word, px(layer.region.x + layer.region.w / 2), px(layer.region.y), Math.max(1.2, px(0.55)), pal.ink)}</g>`;
        break;
      }
      case "tracklist": {
        const list = p.facts.tracklist?.length ? p.facts.tracklist : [{ n: 1, name: p.identity.title || "UNTITLED", time: p.facts.runtime ?? undefined }];
        const r = layer.region;
        const rowH = Math.min(6, r.h / Math.max(3, list.length));
        fg += `<g transform="translate(${off} ${off})">` + list.slice(0, 12).map((t, i) =>
          `<text x="${px(r.x)}" y="${px(r.y + (i + 1) * rowH)}" font-family="Barlow Condensed Medium" font-size="${px(rowH * 0.62)}" fill="${pal.ink}" letter-spacing="1">${esc(`${String(t.n).padStart(2, "0")}. ${t.name.toUpperCase()}`)}</text>` +
          (t.time ? `<text x="${px(r.x + r.w)}" y="${px(r.y + (i + 1) * rowH)}" font-family="Barlow Condensed Medium" font-size="${px(rowH * 0.62)}" fill="${pal.ink}" opacity="0.7" text-anchor="end">${esc(t.time)}</text>` : "")
        ).join("") + `</g>`;
        break;
      }
      case "advisory": {
        if (!p.identity.explicit) break;
        const r = layer.region;
        fg += `<g transform="translate(${off} ${off})">
          <rect x="${px(r.x)}" y="${px(r.y)}" width="${px(r.w)}" height="${px(r.h)}" fill="#000" opacity="0.92"/>
          <rect x="${px(r.x)}" y="${px(r.y)}" width="${px(r.w)}" height="${px(r.h)}" fill="none" stroke="#fff" stroke-width="${px(0.35)}"/>
          <text x="${px(r.x + r.w / 2)}" y="${px(r.y + r.h * 0.42)}" font-family="Barlow Condensed SemiBold" font-size="${px(r.h * 0.26)}" letter-spacing="2" fill="#fff" text-anchor="middle">PARENTAL</text>
          <rect x="${px(r.x + r.w * 0.06)}" y="${px(r.y + r.h * 0.48)}" width="${px(r.w * 0.88)}" height="${px(r.h * 0.28)}" fill="#fff"/>
          <text x="${px(r.x + r.w / 2)}" y="${px(r.y + r.h * 0.70)}" font-family="Barlow Condensed Bold" font-size="${px(r.h * 0.24)}" letter-spacing="1.5" fill="#000" text-anchor="middle">ADVISORY</text>
        </g>`;
        break;
      }
    }
  }

  // holes: preview shows them punched dark; exports punch to transparent on canvas
  let holes = "";
  for (const h of s.holes ?? []) {
    holes += `<circle cx="${off + px(h.cx)}" cy="${off + px(h.cy)}" r="${px(h.r)}" fill="#050510" data-hole="1"/>`;
  }

  let guides = "";
  if (ctx.guides) {
    for (const f of s.folds ?? []) {
      guides += f.axis === "y"
        ? `<line x1="0" y1="${off + px(f.at)}" x2="${W}" y2="${off + px(f.at)}" stroke="#ffffff" stroke-width="1" stroke-dasharray="6 6" opacity="0.35"/>`
        : `<line x1="${off + px(f.at)}" y1="0" x2="${off + px(f.at)}" y2="${H}" stroke="#ffffff" stroke-width="1" stroke-dasharray="6 6" opacity="0.35"/>`;
    }
    guides += `<rect x="${off + px(s.safe)}" y="${off + px(s.safe)}" width="${px(s.size.w - 2 * s.safe)}" height="${px(s.size.h - 2 * s.safe)}" fill="none" stroke="#43f7ff" stroke-width="1" stroke-dasharray="3 7" opacity="0.25"/>`;
  }

  const body =
    (ctx.mode !== "fg" ? bg : "") +
    (ctx.mode === "all" ? art : "") +
    (ctx.mode !== "bg" ? fg + holes : "") +
    guides;

  return `<svg width="${Math.round(W)}" height="${Math.round(H)}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pal.base[0]}"/><stop offset="1" stop-color="${pal.base[1]}"/>
    </linearGradient>
    <linearGradient id="goldText-${s.id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${GOLD_HI}"/><stop offset="0.45" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_LO}"/>
    </linearGradient>
    ${textureDefs(pal.texture, texId)}
    ${shapeClip}
  </defs>
  ${ctx.fontCSS ? `<style>${ctx.fontCSS}</style>` : ""}
  ${s.shape === "circle" ? `<g clip-path="url(#${shapeClipId})">${body}</g>` : body}
</svg>`;
}

function defaultTextValue(id: string, role: string, p: ProjectSpec): string {
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  switch (id) {
    case "title": case "spineTitle": case "discTitle": return title;
    case "label": return (p.identity.label || "YOUR LABEL").toUpperCase();
    case "handle": return p.identity.handle || "";
    case "sideA": return "A"; case "sideB": return "B";
    case "genre": return publicWord(p);
    case "rpm": return "";
    default: return role === "title" ? title : "";
  }
}
