// Booklet pages ARE surfaces — each page becomes a 120×120 SurfaceDef with a
// kind-specific chrome renderer, so the Bindery rides the same renderer and
// export pipeline as every other surface in the plant.

import type { ProjectSpec, SurfaceDef } from "../types";
import { esc } from "../kit/svgPrimitives";
import { bebasSizeToFit } from "../kit/fitText";
import { paletteOf, GOLD } from "../render/renderSurface";
import { type BookletPage, paginateLyrics, defaultRead, defaultCredits } from "./model";

const PW = 120, PH = 120;

/** Deterministic booklet № — same spirit as the dossier convention. */
export function bookletNo(p: ProjectSpec): string {
  const s = `${p.identity.title}|${p.identity.label}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `Nº ${String((h >>> 0) % 100000).padStart(5, "0")}`;
}

function textBlock(text: string, x: number, y: number, w: number, sizeMm: number, px: (mm: number) => number, color: string, family = "Barlow Condensed Medium"): string {
  const charsPerLine = Math.max(8, Math.floor(w / (sizeMm * 0.42)));
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    let line = raw;
    while (line.length > charsPerLine) {
      const cut = line.lastIndexOf(" ", charsPerLine);
      out.push(line.slice(0, cut > 8 ? cut : charsPerLine));
      line = line.slice(cut > 8 ? cut + 1 : charsPerLine).trimStart();
    }
    out.push(line);
  }
  return out.slice(0, Math.floor((PH - y - 8) / (sizeMm * 1.5))).map((l, i) =>
    `<text x="${px(x)}" y="${px(y + i * sizeMm * 1.5)}" font-family="${family}" font-size="${px(sizeMm)}" fill="${color}" letter-spacing="0.5">${esc(l)}</text>`
  ).join("");
}

function pageChrome(page: BookletPage, pageNo: number, total: number) {
  return (p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string => {
    const { pal } = paletteOf(p, s.id);
    const title = (p.identity.title || "UNTITLED").toUpperCase();
    const label = (p.identity.label || "YOUR LABEL").toUpperCase();
    const folio = pageNo > 1 && pageNo < total
      ? `<text x="${px(PW / 2)}" y="${px(PH - 4)}" font-family="Barlow Condensed Medium" font-size="${px(2.4)}" fill="${pal.ink}" opacity="0.5" text-anchor="middle">${pageNo}</text>`
      : "";
    switch (page.kind) {
      case "cover": {
        const fit = Math.min(px(10), bebasSizeToFit(title, px(PW - 16), 2));
        return `
          <rect x="0" y="${px(PH - 26)}" width="${px(PW)}" height="${px(26)}" fill="#000" opacity="0.55"/>
          <text x="${px(8)}" y="${px(PH - 12)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2">${esc(title)}</text>
          <text x="${px(8)}" y="${px(PH - 5)}" font-family="Barlow Condensed SemiBold" font-size="${px(3)}" fill="${pal.accent}" letter-spacing="3">${esc(label)}</text>
          <text x="${px(PW - 8)}" y="${px(PH - 5)}" font-family="Barlow Condensed Medium" font-size="${px(2.6)}" fill="${pal.ink}" opacity="0.7" text-anchor="end">${esc(bookletNo(p))}</text>`;
      }
      case "lyrics": {
        const parts = paginateLyrics(p.lyrics, Math.max(1, countLyricsPages(p)));
        const body = page.text ?? parts[page.lyricsPart ?? 0] ?? "";
        return `
          <text x="${px(8)}" y="${px(12)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="4">THE LIBRETTO</text>
          <line x1="${px(8)}" y1="${px(15)}" x2="${px(PW - 8)}" y2="${px(15)}" stroke="${GOLD}" stroke-width="${px(0.3)}" opacity="0.7"/>
          ${body ? textBlock(body, 8, 22, PW - 16, 2.9, px, pal.ink) : `<text x="${px(PW / 2)}" y="${px(PH / 2)}" font-family="Barlow Condensed Medium" font-size="${px(3.2)}" fill="${pal.ink}" opacity="0.4" text-anchor="middle">feed me your lyrics and they live here</text>`}
          ${folio}`;
      }
      case "read": {
        const body = page.text ?? defaultRead(p);
        return `${textBlock(body, 8, 14, PW - 16, 3.1, px, pal.ink)}${folio}`;
      }
      case "credits": {
        const body = page.text ?? defaultCredits(p);
        return `
          <text x="${px(8)}" y="${px(12)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="4">CREDITS</text>
          <line x1="${px(8)}" y1="${px(15)}" x2="${px(PW - 8)}" y2="${px(15)}" stroke="${GOLD}" stroke-width="${px(0.3)}" opacity="0.7"/>
          ${textBlock(body, 8, 24, PW - 16, 3, px, pal.ink)}${folio}`;
      }
      case "specs": {
        const rows = [
          p.facts.bpm ? `TEMPO — ${p.facts.bpm} BPM (measured)` : null,
          p.facts.runtime ? `RUNTIME — ${p.facts.runtime}` : null,
          p.identity.genre ? `STYLE — ${p.identity.genre.toUpperCase()}` : null,
          p.identity.lang ? `LANG — ${p.identity.lang}` : null,
          p.identity.geo ? `GEO — ${p.identity.geo}` : null,
          `EDITION — ${bookletNo(p)}`,
          "PRESSED — on your own device",
        ].filter(Boolean).join("\n");
        return `
          <text x="${px(8)}" y="${px(12)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="4">SPECS</text>
          <line x1="${px(8)}" y1="${px(15)}" x2="${px(PW - 8)}" y2="${px(15)}" stroke="${GOLD}" stroke-width="${px(0.3)}" opacity="0.7"/>
          ${textBlock(rows, 8, 24, PW - 16, 3.2, px, pal.ink)}${folio}`;
      }
      case "band": {
        const roster = p.analysis?.roster ?? [];
        const rows = roster.length
          ? roster.map((r) => `${r.role.toUpperCase().padEnd(8, " ")} — ${r.name.replace(/\.(mp3|wav|flac|m4a|ogg|aac)$/i, "")}`).join("\n")
          : "feed me your stems zip and the band takes the stage";
        return `
          <text x="${px(8)}" y="${px(12)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="4">THE BAND</text>
          <line x1="${px(8)}" y1="${px(15)}" x2="${px(PW - 8)}" y2="${px(15)}" stroke="${GOLD}" stroke-width="${px(0.3)}" opacity="0.7"/>
          ${textBlock(rows, 8, 24, PW - 16, 3.1, px, pal.ink)}${folio}`;
      }
      case "map": {
        const secs = p.analysis?.sections ?? [];
        const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
        const rows = secs.length
          ? secs.map((sc, i) => `LEVEL ${i + 1} · ${sc.name.padEnd(6, " ")} ${fmt(sc.start)}${typeof sc.intensity === "number" ? `  ${"▮".repeat(Math.max(1, Math.round(sc.intensity * 8)))}` : ""}`).join("\n")
          : "the map draws itself from your stems";
        return `
          <text x="${px(8)}" y="${px(12)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="4">THE MAP</text>
          <line x1="${px(8)}" y1="${px(15)}" x2="${px(PW - 8)}" y2="${px(15)}" stroke="${GOLD}" stroke-width="${px(0.3)}" opacity="0.7"/>
          ${textBlock(rows, 8, 24, PW - 16, 3.1, px, pal.ink)}${folio}`;
      }
      case "world":
        return `<text x="${px(PW / 2)}" y="${px(PH - 6)}" font-family="Barlow Condensed Medium" font-size="${px(2.6)}" fill="${pal.ink}" opacity="0.6" text-anchor="middle" letter-spacing="2">THE WORLD</text>${folio}`;
      case "back":
        return `
          <text x="${px(PW / 2)}" y="${px(PH / 2 - 4)}" font-family="Bebas Neue" font-size="${px(6)}" fill="url(#goldText-${s.id})" letter-spacing="3" text-anchor="middle">${esc(label)}</text>
          <text x="${px(PW / 2)}" y="${px(PH / 2 + 4)}" font-family="Barlow Condensed Medium" font-size="${px(2.6)}" fill="${pal.ink}" opacity="0.6" text-anchor="middle" letter-spacing="2">${esc(bookletNo(p))} · PRESSED ON-DEVICE</text>`;
      default:
        return folio;
    }
  };
}

export function countLyricsPages(p: ProjectSpec): number {
  const lines = (p.lyrics ?? "").trim().split(/\r?\n/).filter((l) => l.trim()).length;
  return lines > 26 ? 2 : 1;
}

/** A booklet page as a SurfaceDef, ready for renderSurfaceSVG/exportSurfacePNG. */
export function pageSurface(page: BookletPage, pageNo: number, total: number): SurfaceDef {
  const artPages: BookletPage["kind"][] = ["cover", "world"];
  return {
    id: `bk-${pageNo}`,
    name: `Page ${pageNo} — ${page.kind}`,
    size: { w: PW, h: PH },
    bleed: 3,
    safe: 5,
    layers: [
      { kind: "bg" },
      ...(artPages.includes(page.kind) ? [{ kind: "art", slot: "cover" } as const] : []),
      { kind: "chrome", render: pageChrome(page, pageNo, total) },
    ],
  };
}
