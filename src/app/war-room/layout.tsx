import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "War Room",
  description: "Command center for projects, agents, launches, and teamwork.",
  openGraph: {
    title: "War Room | x1c7",
    description: "Tactical dashboard with live operations, agent status, and mission control.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
