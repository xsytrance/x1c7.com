import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classified",
  description: "Access denied-ish. Nothing sensitive. Just a locked portal with secrets.",
  openGraph: {
    title: "Classified | x1c7",
    description: "Some doors stay closed until the signal is ready.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
