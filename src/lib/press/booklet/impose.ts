// THE BINDERY'S PRESS — saddle-stitch imposition. Booklet pages render
// through the standard surface exporter, then land 2-up on PDF sheets with
// cut/fold marks, plus a friendly how-to-fold sheet. Print duplex ("flip on
// short edge"), fold the stack in half, staple the spine — a real booklet.
//
// Imposition math (n = pages, multiple of 4), sheet i (0-based):
//   front: [ n-2i , 1+2i ]   back: [ 2+2i , n-1-2i ]
// e.g. 8pp → sheets: F[8,1] B[2,7] · F[6,3] B[4,5].

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ProjectSpec } from "../types";
import { exportSurfacePNG } from "../render/exportPng";
import { type BookletState, livePages } from "./model";
import { pageSurface, bookletNo } from "./pageSurfaces";

const MM = 72 / 25.4;                 // pdf points per mm
const PAGE = 120;                      // booklet page trim, mm
const GAP = 0;                         // pages sit flush at the fold
const MARGIN = 12;                     // sheet margin, mm
const SHEET_W = 2 * PAGE + 2 * MARGIN, SHEET_H = PAGE + 2 * MARGIN;

export type ImposedPair = [number, number];

/** Pure imposition order — exported for tests. Pages are 1-indexed. */
export function imposition(n: number): { front: ImposedPair; back: ImposedPair }[] {
  if (n % 4 !== 0) throw new Error("saddle-stitch needs a multiple of 4");
  const out: { front: ImposedPair; back: ImposedPair }[] = [];
  for (let i = 0; i < n / 4; i++) {
    out.push({ front: [n - 2 * i, 1 + 2 * i], back: [2 + 2 * i, n - 1 - 2 * i] });
  }
  return out;
}

function marks(page: import("pdf-lib").PDFPage) {
  const g = rgb(0.45, 0.45, 0.45);
  const foldX = SHEET_W / 2 * MM;
  // fold line (dashed) down the sheet center
  for (let y = MARGIN * MM * 0.35; y < SHEET_H * MM; y += 10) {
    page.drawLine({ start: { x: foldX, y }, end: { x: foldX, y: y + 4 }, thickness: 0.5, color: g });
  }
  // corner crop marks at the trim box
  const x0 = MARGIN * MM, x1 = (SHEET_W - MARGIN) * MM, y0 = MARGIN * MM, y1 = (SHEET_H - MARGIN) * MM;
  const L = 8;
  for (const [x, y, dx, dy] of [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]] as const) {
    page.drawLine({ start: { x, y: y + dy * 2 }, end: { x, y: y + dy * (2 + L) }, thickness: 0.6, color: g });
    page.drawLine({ start: { x: x + dx * 2, y }, end: { x: x + dx * (2 + L), y }, thickness: 0.6, color: g });
  }
}

export async function imposeBooklet(
  b: BookletState,
  p: ProjectSpec,
  art: HTMLImageElement | null,
  onProgress?: (m: string) => void,
): Promise<Blob> {
  const pages = livePages(b);
  const n = pages.length;

  // 1. render every live page through the standard surface pipeline (220dpi —
  //    booklet interior doesn't need 300 and phones appreciate it)
  const pngs: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    onProgress?.(`printing page ${i + 1}/${n}…`);
    const s = pageSurface(pages[i], i + 1, n);
    s.exportDpi = 220;
    const out = await exportSurfacePNG(s, p, art);
    pngs.push(new Uint8Array(await out.blob.arrayBuffer()));
  }

  // 2. impose 2-up with marks
  onProgress?.("imposing sheets…");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const place = async (sheet: import("pdf-lib").PDFPage, pair: ImposedPair) => {
    for (const [slot, pageNo] of pair.map((v, i) => [i, v] as const)) {
      const img = await doc.embedPng(pngs[pageNo - 1]);
      // pngs carry 3mm bleed — draw so TRIM lands on the layout box, bleed hangs outside
      const bleed = 3;
      const w = (PAGE + 2 * bleed) * MM, h = (PAGE + 2 * bleed) * MM;
      const x = (MARGIN + slot * (PAGE + GAP) - bleed) * MM;
      const y = (MARGIN - bleed) * MM;
      sheet.drawImage(img, { x, y, width: w, height: h });
    }
    marks(sheet);
  };
  const sheets = imposition(n);
  for (let i = 0; i < sheets.length; i++) {
    const front = doc.addPage([SHEET_W * MM, SHEET_H * MM]);
    await place(front, sheets[i].front);
    front.drawText(`sheet ${i + 1} FRONT · pages ${sheets[i].front.join(" | ")}`, { x: MARGIN * MM, y: 4, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
    const back = doc.addPage([SHEET_W * MM, SHEET_H * MM]);
    await place(back, sheets[i].back);
    back.drawText(`sheet ${i + 1} BACK · pages ${sheets[i].back.join(" | ")}`, { x: MARGIN * MM, y: 4, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // 3. the how-to-fold sheet
  const guide = doc.addPage([SHEET_W * MM, SHEET_H * MM]);
  const lines = [
    `HOW TO BIND ${((p.identity.title || "YOUR SONG")).toUpperCase()} — ${bookletNo(p)}`,
    "",
    "1. Print this PDF at 100% scale (no 'fit to page'), duplex,",
    "   'flip on SHORT edge'. Card stock if you're feeling fancy.",
    "2. Cut each sheet along the corner crop marks.",
    "3. Stack the sheets in printed order, fronts up.",
    "4. Fold the whole stack in half along the dashed center line.",
    "5. Two staples on the fold (or one brave one). Done —",
    "   a real booklet, pressed and bound by you.",
    "",
    `${livePages(b).length} pages · saddle-stitch · made at the pressing plant`,
  ];
  lines.forEach((t, i) => guide.drawText(t, { x: MARGIN * MM, y: (SHEET_H - MARGIN - 8) * MM - i * 14, size: i === 0 ? 11 : 9, font, color: rgb(0.15, 0.15, 0.15) }));

  const bytes = await doc.save();
  const buf = new Uint8Array(bytes.length); buf.set(bytes);
  return new Blob([buf.buffer], { type: "application/pdf" });
}
