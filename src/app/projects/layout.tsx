import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "Apps, tools, coding experiments: vAIb out!, Entangled, Aurex, dashboards, toys, and builds crawling out of the basement.",
  openGraph: {
    title: "Projects | x1c7",
    description: "A terminal file browser of creative coding projects.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
