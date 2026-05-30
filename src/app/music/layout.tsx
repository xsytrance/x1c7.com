import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Music",
  description: "Suno transmissions, SoundCloud links, PulseBox/Jukebox plans, future visualizers.",
  openGraph: {
    title: "Music | x1c7",
    description: "Suno transmissions, SoundCloud links, PulseBox/Jukebox plans, future visualizers.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
