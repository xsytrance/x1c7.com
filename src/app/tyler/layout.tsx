import type { Metadata } from "next";
import { Permanent_Marker, Bebas_Neue, Playfair_Display } from "next/font/google";
import { getTylerSite } from "@/lib/tyler/read";
import { TylerNav } from "./TylerNav";

// Juan's four display choices. `preload: false` on purpose: the @font-face
// rules cost nothing until something actually renders in that family, and only
// ONE of these is ever the live choice — preloading all four would spend a
// phone's first second on fonts nobody asked for.
const scrawl = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--tyler-scrawl", preload: false });
const condensed = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--tyler-condensed", preload: false });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--tyler-serif", preload: false });

const FONT_STACK: Record<string, string> = {
  scrawl: "var(--tyler-scrawl), var(--font-display), system-ui, sans-serif",
  condensed: "var(--tyler-condensed), var(--font-display), system-ui, sans-serif",
  serif: "var(--tyler-serif), Georgia, serif",
  mono: "var(--font-mono), ui-monospace, monospace",
};

export async function generateMetadata(): Promise<Metadata> {
  const site = await getTylerSite();
  const title = `${site.artist} — ${site.album}`;
  const description = site.tagline
    ? `${site.tagline} · ${site.album} by ${site.artist} (${site.by_line}).`
    : `${site.album} by ${site.artist} (${site.by_line}).`;
  return {
    title: { default: title, template: `%s | ${site.artist}` },
    description,
    openGraph: { title, description, siteName: site.artist, type: "music.album" },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Juan edits from his phone and expects to see it; a minute is the longest
// anyone should stare at a stale poster.
export const revalidate = 60;

export default async function TylerLayout({ children }: { children: React.ReactNode }) {
  const site = await getTylerSite();
  const { primary, secondary, accent, bg } = site.palette;
  const font = FONT_STACK[site.options.font ?? "scrawl"] ?? FONT_STACK.scrawl;

  return (
    <div
      className={`${scrawl.variable} ${condensed.variable} ${serif.variable} tyler-root min-h-screen`}
      style={
        {
          // Scoped to this subtree — x1c7's own theme variables are untouched,
          // so Juan changing his colors can never repaint Rod's site.
          "--t-primary": primary,
          "--t-secondary": secondary,
          "--t-accent": accent,
          "--t-bg": bg,
          "--t-display": font,
          background: bg,
          color: "#f4f1ea",
        } as React.CSSProperties
      }
    >
      <TylerNav site={site} />
      {children}
    </div>
  );
}
