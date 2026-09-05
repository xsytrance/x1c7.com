import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ParticleField } from "@/components/ParticleField";
import { NoiseOverlay } from "@/components/NoiseOverlay";
import { BootSequenceWrapper } from "@/components/BootSequenceWrapper";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { PerformanceGate } from "@/components/PerformanceGate";
import { EasterEggs } from "@/components/EasterEggs";
import { KonamiCode } from "@/components/KonamiCode";
import { UISoundLayer } from "@/components/UISoundLayer";
import { Footer } from "@/components/Footer";
import { MusicPlayerProvider } from "@/components/MusicPlayerContext";
import { LazyMotionProvider } from "@/components/LazyMotionProvider";
import { MusicPlayerBar } from "@/components/MusicPlayerBar";
import { ThemeEngine } from "@/components/NowPlayingTheme";
import { X1c7Chrome } from "@/components/X1c7Chrome";
import { TylerDoor } from "@/components/TylerDoor";

const display = Space_Grotesk({ subsets: ["latin", "latin-ext", "vietnamese"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

// viewport-fit=cover is what makes env(safe-area-inset-*) return real values
// on iPhone — without it every safe-area rule in the codebase evaluates to 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05030b",
};

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
        <MusicPlayerProvider>
          <LazyMotionProvider>
          <ThemeEngine />
          {/* Unmissable, top of every page: the way to Tyler's site. */}
          <TylerDoor />
          <BootSequenceWrapper>
            {children}
            <X1c7Chrome>
              <Footer />
            </X1c7Chrome>
          </BootSequenceWrapper>
          {/* x1c7's own furniture — switched off on tyler.x1c7.com, which is
              Juan's site rather than a page of this one. */}
          <X1c7Chrome>
            <KeyboardShortcuts />
            <KeyboardHelp />
            <PerformanceGate>
              <ParticleField />
            </PerformanceGate>
            <EasterEggs />
            <KonamiCode />
            <NoiseOverlay />
            <UISoundLayer />
            <MusicPlayerBar />
          </X1c7Chrome>
          </LazyMotionProvider>
        </MusicPlayerProvider>
      </body>
    </html>
  );
}
