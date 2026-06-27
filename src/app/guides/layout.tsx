import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Field Manual",
  description: "How-tos, AI playbooks, and field-tested ways to use the machines — music, art, prompting, agents, and workflow.",
  openGraph: {
    title: "Field Manual | x1c7",
    description: "Practical protocols for getting real work out of AI.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
