import type { Metadata } from "next";

const OG = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/covers/og/_music.png";

export const metadata: Metadata = {
  title: "The Collection",
  description: "Every track a collector edition — genre-coded spines, verified metadata, the song's own waveform on the case. Browse the shelf, hear the drop.",
  openGraph: {
    title: "THE COLLECTION | AGENOR",
    description: "Every track a collector edition. Browse the shelf, hear the drop.",
    images: [{ url: OG, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [OG] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
