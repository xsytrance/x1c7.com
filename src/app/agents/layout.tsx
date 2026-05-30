import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Ecosystem",
  description: "VG God, Ultron, Dazzler, Picasso, and the rest of the crew.",
  openGraph: {
    title: "Agent Ecosystem | x1c7",
    description: "Meet the digital crew behind the x1c7 creative command hub.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
