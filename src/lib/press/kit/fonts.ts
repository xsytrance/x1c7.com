// PRESS KIT — fonts embedded as data: URIs for SVG→canvas rasterization
// (an <img>-rendered SVG can't see document fonts). Extracted from
// src/lib/collector/webEngine.ts (Pressing Plant P1), generalized to a
// family list; the default set matches the collector case exactly.

export const HOUSE_FAMILIES: [string, string][] = [
  ["Bebas Neue", "/fonts/BebasNeue-Regular.ttf"],
  ["Barlow Condensed Medium", "/fonts/BarlowCondensed-Medium.ttf"],
  ["Barlow Condensed SemiBold", "/fonts/BarlowCondensed-SemiBold.ttf"],
  ["Barlow Condensed Bold", "/fonts/BarlowCondensed-Bold.ttf"],
];

const cache = new Map<string, string>();

export async function embeddedFontCSS(faces: [string, string][] = HOUSE_FAMILIES): Promise<string> {
  const key = faces.map(([f]) => f).join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const css = await Promise.all(faces.map(async ([family, url]) => {
    const buf = await (await fetch(url)).arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${btoa(bin)}) format("truetype");}`;
  }));
  const joined = css.join("");
  cache.set(key, joined);
  return joined;
}
