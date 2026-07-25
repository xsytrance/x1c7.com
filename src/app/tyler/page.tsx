import Link from "next/link";
import { getTylerPage } from "@/lib/tyler/read";
import { ZeroChallenger } from "@/components/ZeroChallenger";
import { TylerHero } from "./TylerHero";
import { Photos, Press, TrackList } from "./Sections";

// Juan edits from his phone and expects to see it. The page is cached for a
// minute, so a stranger gets static HTML from the CDN and Juan never waits
// long to see his own change.
export const revalidate = 60;

export default async function TylerPage() {
  const { site, tracks, media } = await getTylerPage();

  // The order IS Juan's order — whatever he dragged the sections into, plus
  // anything he hid, decided in the admin panel and rendered here verbatim.
  const sections = site.sections.filter((s) => s.visible);

  return (
    <main className="pb-20">
      {sections.map(({ id }) => {
        switch (id) {
          case "hero":
            return <TylerHero key={id} site={site} tracks={tracks} />;
          case "tracks":
            return <TrackList key={id} tracks={tracks} />;
          case "photos":
            return <Photos key={id} media={media} />;
          case "press":
            return <Press key={id} site={site} media={media} />;
          case "zero":
            return <ZeroChallenger key={id} />;
          default:
            return null;
        }
      })}

      {/* The way home — small, honest, and never in the way of the music. */}
      <footer className="mx-auto max-w-6xl px-4 pt-10 text-center md:px-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/25">
          {site.artist} · {site.by_line}
          {site.released ? ` · ${site.released}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-white/30">
          <Link href="/" className="transition-colors hover:text-white/70">
            built at x1c7
          </Link>
          <Link href="/tyler/admin" className="transition-colors hover:text-white/70">
            manage
          </Link>
        </div>
      </footer>
    </main>
  );
}
