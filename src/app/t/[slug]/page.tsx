import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase, type TrackRow } from "@/lib/supabase";
import TrackShare from "@/components/TrackShare";

// Per-track share pages: /t/<slug>. The collector cover is the link preview.
export const revalidate = 300;

const OG_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/covers/og";

async function getTrack(slug: string): Promise<TrackRow | null> {
  const { data } = await supabase.from("tracks").select("*").eq("id", slug).eq("hidden", false).maybeSingle();
  return (data as TrackRow) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTrack(slug);
  if (!t) return { title: "Not found" };
  const title = `${t.title} — AGENOR`;
  const description = `${t.genre || "Music"}${t.mood ? ` · ${t.mood}` : ""} · a collector edition from the AGENOR catalog. Tap in and hear the drop.`;
  const og = `${OG_BASE}/${slug}.png`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getTrack(slug);
  if (!row) notFound();
  return <TrackShare row={row} />;
}
