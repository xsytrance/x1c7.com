// THE LISTENING ROOM — one song, fully drawn. Prerendered per song from the
// analyzer index; the heavy bundle is fetched client-side (17 KB gzipped) so
// the HTML stays light.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { ListeningRoom } from "@/components/listen/ListeningRoom";

interface IndexDoc { songs: { id: string; title: string }[] }

function readIndex(): IndexDoc {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "analyzer", "index.json"), "utf8"));
  } catch { return { songs: [] }; }
}

export function generateStaticParams() {
  return readIndex().songs.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const song = readIndex().songs.find((s) => s.id === slug);
  const title = song ? `${song.title} — The Listening Room` : "The Listening Room";
  return { title, description: "Every measured layer of the song on one time axis." };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ListeningRoom slug={slug} />;
}
