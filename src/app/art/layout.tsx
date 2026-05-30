import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Art",
  description: "Gallery experiments, XsyVerse visuals, characters, and worlds.",
  openGraph: {
    title: "AI Art | x1c7",
    description: "A bright weird museum of AI-generated art and visual experiments.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
