import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "x1c7",
  description: "Creative command hub for music, AI, projects, agents, and experiments.",
  metadataBase: new URL("https://x1c7.com"),
  openGraph: {
    title: "x1c7",
    description: "Creative command hub for music, AI, projects, agents, and experiments.",
    url: "https://x1c7.com",
    siteName: "x1c7",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
