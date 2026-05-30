import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ParticleField } from "@/components/ParticleField";
import { NoiseOverlay } from "@/components/NoiseOverlay";
import { CustomCursor } from "@/components/CustomCursor";
import { BootSequenceWrapper } from "@/components/BootSequenceWrapper";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { PerformanceGate } from "@/components/PerformanceGate";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "x1c7", template: "%s | x1c7" },
  description: "Creative command hub for music, AI, projects, agents, and experiments.",
  metadataBase: new URL("https://x1c7.com"),
  openGraph: {
    title: "x1c7",
    description: "Creative command hub for music, AI, projects, agents, and experiments.",
    url: "https://x1c7.com",
    siteName: "x1c7",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "x1c7",
    description: "Creative command hub for music, AI, projects, agents, and experiments.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} overflow-x-hidden`}>
        <BootSequenceWrapper>
          {children}
        </BootSequenceWrapper>
        <KeyboardShortcuts />
        <KeyboardHelp />
        <PerformanceGate>
          <ParticleField />
        </PerformanceGate>
        <NoiseOverlay />
        <CustomCursor />
      </body>
    </html>
  );
}
