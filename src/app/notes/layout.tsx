import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Field Notes",
  description: "Thoughts, progress logs, experiments, lessons learned.",
  openGraph: {
    title: "Field Notes | x1c7",
    description: "Dispatches from the lab: thoughts, experiments, mistakes, breakthroughs.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
