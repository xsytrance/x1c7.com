"use client";

import { useEffect, useState } from "react";
import { Panel } from "./ui";

/**
 * The bridge to the heavy machinery on Prime. Juan is on Rod's tailnet, so
 * these open for him — but only while he's connected. Rather than let a tile
 * fail mysteriously on cellular, each one says plainly where it lives.
 */
const TILES = [
  { href: "/engine", glyph: "◈", title: "Kinetica lab", blurb: "The lyric-video engine — build a show out of a song.", tailnet: false },
  { href: "/studio", glyph: "◎", title: "Planet studio", blurb: "Shape the look of a song's world.", tailnet: false },
  { href: "/press", glyph: "▤", title: "Press kit", blurb: "Generate the one-sheet and the booklet.", tailnet: false },
  { href: "/galaxy", glyph: "✷", title: "The galaxy", blurb: "Every song as a planet.", tailnet: false },
  { href: "/t/madetobreak?reel=1", glyph: "▶", title: "#MADETOBREAK", blurb: "The full show, 64 images, timing verified.", tailnet: false },
  { href: "/studio/feed", glyph: "⧉", title: "Feed the planet", blurb: "Onboard a new song end to end. Needs the tailnet.", tailnet: true },
];

export function LabTab() {
  // The pipelines answer only on a private host; the page can tell which side
  // of that line it's on by looking at where it was served from.
  const [onTailnet, setOnTailnet] = useState<boolean | null>(null);
  useEffect(() => {
    const h = window.location.hostname;
    setOnTailnet(
      /^(localhost|127\.0\.0\.1)$/.test(h) || h === "prime" || h.endsWith(".ts.net") ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h),
    );
  }, []);

  return (
    <>
      <Panel title="The lab" hint="Rod's machine does the heavy lifting — GPU art, stem analysis, full shows.">
        <div className="grid gap-2 md:grid-cols-2">
          {TILES.map((t) => {
            const blocked = t.tailnet && onTailnet === false;
            return (
              <a
                key={t.href}
                href={blocked ? undefined : t.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={blocked}
                className="flex items-start gap-3 rounded-xl border border-white/10 p-3.5 transition-colors"
                style={blocked ? { opacity: 0.45, pointerEvents: "none" } : undefined}
              >
                <span aria-hidden className="text-xl" style={{ color: "var(--t-primary)" }}>{t.glyph}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className="block text-xs leading-relaxed text-white/40">{t.blurb}</span>
                  {blocked && <span className="mt-1 block text-[10px] uppercase tracking-widest text-white/35">turn on Tailscale to open</span>}
                </span>
              </a>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/10 p-3.5 text-xs leading-relaxed text-white/45">
          {onTailnet === null ? (
            "Checking where you are…"
          ) : onTailnet ? (
            <>You&rsquo;re on the tailnet — everything above is open, including the pipelines.</>
          ) : (
            <>
              You&rsquo;re on the public internet, which is fine for everything except the pipelines. Connect
              Tailscale (Rod shared his network with you) and open this page from{" "}
              <span className="font-mono text-white/60">prime</span> to unlock the rest.
            </>
          )}
        </div>
      </Panel>

      <Panel title="Suno stems" hint="Drop the ZIP in Photos → Suno stems. It waits in storage until you're on the tailnet, then Feed the Planet can mix and onboard it.">
        <ol className="space-y-2 text-sm leading-relaxed text-white/55">
          <li><span className="mr-2 text-white/30">1.</span>Download the 8-stem ZIP from Suno.</li>
          <li><span className="mr-2 text-white/30">2.</span>Upload it here under <em>Suno stems</em> — up to 200MB.</li>
          <li><span className="mr-2 text-white/30">3.</span>On the tailnet, open <em>Feed the planet</em> and point it at the upload.</li>
          <li><span className="mr-2 text-white/30">4.</span>It mixes, transcribes, aligns, paints and publishes the show.</li>
        </ol>
      </Panel>
    </>
  );
}
