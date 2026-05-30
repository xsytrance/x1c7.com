import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Level Ready",
  description: "AI help for people and businesses in real life.",
  openGraph: {
    title: "Level Ready | x1c7",
    description: "Practical automation for people and businesses that need the future to stop being annoying.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
