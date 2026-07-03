"use client";

// THE way into the Galaxy — a big, unmissable slab of night sky. Twinkling
// stars, three little planets bobbing in orbit, and a glowing call to enter.
// Used as the primary CTA on the home hero and the /music page.

import Link from "next/link";

export function GalaxyButton({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/galaxy"
      className={`group relative block w-full overflow-hidden rounded-[2rem] border transition hover:scale-[1.015] ${compact ? "px-6 py-5" : "px-6 py-8 sm:px-12 sm:py-10"}`}
      style={{
        borderColor: "color-mix(in srgb, var(--theme-primary) 45%, transparent)",
        background:
          "radial-gradient(ellipse at 20% 30%, color-mix(in srgb, var(--theme-primary) 16%, transparent), transparent 55%)," +
          "radial-gradient(ellipse at 80% 70%, color-mix(in srgb, var(--theme-secondary) 13%, transparent), transparent 50%)," +
          "linear-gradient(150deg, #0a0616, #030208)",
        boxShadow: "0 0 40px color-mix(in srgb, var(--theme-primary) 22%, transparent), inset 0 0 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* starfield */}
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={i}
          className="galaxy-star"
          style={{
            left: `${(i * 137) % 100}%`,
            top: `${(i * 61) % 100}%`,
            width: i % 7 === 0 ? 2.5 : 1.5,
            height: i % 7 === 0 ? 2.5 : 1.5,
            animationDelay: `${(i * 0.9) % 5}s`,
          }}
        />
      ))}
      {/* little planets in orbit */}
      <span className="galaxy-planet absolute right-[8%] top-[18%] h-5 w-5 rounded-full opacity-80" style={{ background: "radial-gradient(circle at 30% 30%, var(--theme-primary), #1a0f2e)", animationDelay: "0s" }} aria-hidden />
      <span className="galaxy-planet absolute right-[16%] bottom-[20%] h-3 w-3 rounded-full opacity-70" style={{ background: "radial-gradient(circle at 30% 30%, var(--theme-secondary), #0f1a2e)", animationDelay: "1.4s" }} aria-hidden />
      <span className="galaxy-planet absolute right-[26%] top-[42%] h-2 w-2 rounded-full opacity-60" style={{ background: "radial-gradient(circle at 30% 30%, var(--theme-accent), #101010)", animationDelay: "2.8s" }} aria-hidden />

      <span className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <span>
          <span className={`block font-display font-black uppercase tracking-tight text-white glow-text ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}>
            🌌 Enter the Galaxy
          </span>
          <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.35em] text-white/50 sm:text-xs">
            every song is a planet · tap one to land · the full show takes over
          </span>
        </span>
        <span
          className="rounded-full px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.25em] text-void transition group-hover:scale-110"
          style={{ background: "var(--theme-primary)", boxShadow: "0 0 24px var(--theme-primary)" }}
        >
          Launch →
        </span>
      </span>
    </Link>
  );
}
