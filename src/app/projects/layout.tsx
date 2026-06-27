import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "The full arsenal: AI music tools, AI art & prompt platforms, agents, fantasy consoles, save-state engines, systems, and research.",
  openGraph: {
    title: "Projects | x1c7",
    description: "A filterable command deck of every build in the x1c7 arsenal.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
