"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MagneticCard } from "./MagneticCard";

const SOCIALS = [
  {
    name: "GitHub",
    url: "https://github.com/xsytrance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
    color: "#8dff4a",
  },
  {
    name: "SoundCloud",
    url: "https://soundcloud.com/xsytrance",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.21-1.319-.225-1.339c-.01-.057-.043-.094-.063-.094zm1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.105.104.061 0 .105-.045.12-.104l.24-2.474-.255-2.547c-.015-.06-.06-.104-.105-.104zm.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.64c-.015-.075-.06-.135-.166-.135zm.93-.069c-.09 0-.149.075-.165.165l-.18 2.7.195 2.52c.016.09.075.165.165.165.089 0 .165-.075.165-.165l.21-2.52-.225-2.7c0-.09-.075-.165-.165-.165zm.93-.045c-.105 0-.18.09-.18.18l-.165 2.73.18 2.49c.015.105.09.18.18.18.104 0 .179-.09.195-.18l.195-2.49-.21-2.73c0-.105-.09-.18-.195-.18zm.915-.06c-.12 0-.21.105-.225.21l-.165 2.85.18 2.37c.016.119.105.225.225.225.12 0 .225-.105.225-.225l.195-2.37-.195-2.85c0-.12-.105-.21-.24-.21zm.93-.03c-.135 0-.24.12-.255.24l-.15 2.91.165 2.31c.016.135.12.255.255.255.135 0 .255-.12.27-.255l.18-2.31-.195-2.91c-.015-.135-.135-.24-.27-.24zm.945-.015c-.15 0-.27.135-.27.27l-.15 2.925.165 2.295c.015.15.135.27.285.27.149 0 .27-.12.285-.27l.18-2.295-.18-2.925c-.015-.165-.135-.27-.315-.27zm1.005 0c-.165 0-.3.135-.3.3l-.135 2.895.15 2.325c.016.165.15.3.315.3.165 0 .3-.135.3-.3l.165-2.325-.18-2.895c-.015-.18-.15-.3-.315-.3zm.99-.015c-.18 0-.33.15-.345.33l-.135 2.865.15 2.355c.016.18.165.345.345.345.18 0 .33-.165.345-.345l.165-2.355-.18-2.865c-.015-.195-.165-.33-.345-.33zm1.02-.045c-.195 0-.36.165-.36.36l-.12 2.895.135 2.34c.016.195.165.36.36.36.195 0 .36-.165.375-.36l.15-2.34-.165-2.895c-.015-.21-.18-.36-.375-.36zm1.035-.06c-.21 0-.375.18-.39.39l-.12 2.85.135 2.37c.016.21.18.39.39.39.21 0 .39-.18.405-.39l.15-2.37-.165-2.85c-.015-.225-.195-.39-.405-.39zm.99-.075c-.225 0-.405.195-.42.42l-.105 2.82.12 2.4c.016.225.195.42.42.42.225 0 .42-.195.435-.42l.135-2.4-.15-2.82c-.015-.24-.21-.42-.435-.42zm1.005-.09c-.24 0-.435.21-.45.45l-.105 2.775.12 2.43c.015.24.21.45.45.45.24 0 .45-.21.465-.45l.135-2.43-.15-2.775c-.015-.255-.225-.45-.465-.45zm1.02-.12c-.255 0-.465.225-.48.48l-.09 2.73.105 2.49c.016.255.225.48.48.48.255 0 .48-.225.495-.48l.12-2.49-.135-2.73c-.015-.27-.24-.48-.495-.48zm1.005-.15c-.27 0-.48.24-.495.51l-.09 2.67.105 2.52c.016.27.24.51.51.51.27 0 .51-.24.525-.51l.12-2.52-.135-2.67c-.015-.285-.255-.51-.525-.51zm1.02-.18c-.285 0-.525.255-.54.54l-.075 2.61.09 2.535c.016.285.255.54.54.54s.54-.255.555-.54l.105-2.535-.12-2.61c-.015-.3-.27-.54-.555-.54zm1.005-.225c-.3 0-.54.27-.555.57l-.075 2.535.09 2.58c.016.3.27.57.57.57.3 0 .57-.27.585-.57l.105-2.58-.12-2.535c-.015-.315-.285-.57-.585-.57zm.99-.27c-.315 0-.57.3-.585.615l-.06 2.46.075 2.61c.015.315.285.615.6.615.315 0 .6-.3.615-.615l.09-2.61-.105-2.46c-.015-.33-.3-.615-.63-.615zm1.005-.315c-.33 0-.6.315-.615.66l-.06 2.37.075 2.64c.015.33.3.66.63.66.345 0 .645-.33.66-.66l.09-2.64-.105-2.37c-.015-.345-.315-.66-.675-.66zm1.005-.375c-.36 0-.645.345-.66.72l-.045 2.28.06 2.685c.015.36.33.72.69.72.375 0 .705-.36.72-.72l.075-2.685-.09-2.28c-.015-.375-.345-.72-.75-.72zm.99-.45c-.39 0-.705.39-.72.81l-.045 2.175.06 2.73c.015.39.345.78.735.78.405 0 .75-.39.765-.78l.075-2.73-.09-2.175c-.015-.405-.36-.81-.78-.81zm1.02-.555c-.435 0-.765.435-.78.915l-.03 2.055.045 2.76c.016.435.36.87.795.87.45 0 .87-.435.885-.87l.06-2.76-.075-2.055c-.015-.45-.42-.915-.9-.915z" />
      </svg>
    ),
    color: "#ff9b3d",
  },
  {
    name: "Suno",
    url: "https://suno.com/@xsytrance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12l4-4 4 4" />
        <path d="M12 16V8" />
      </svg>
    ),
    color: "#ff2bd6",
  },
];

const PORTAL_LINKS = [
  { slug: "music", label: "Music" },
  { slug: "level-ready", label: "Level Ready" },
  { slug: "war-room", label: "War Room" },
  { slug: "art", label: "AI Art" },
  { slug: "projects", label: "Projects" },
  { slug: "notes", label: "Field Notes" },
  { slug: "agents", label: "Agents" },
  { slug: "classified", label: "Classified" },
];

export function Footer() {
  const reduceMotion = useReducedMotion();

  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr_1fr]">
          {/* Brand */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/" className="group inline-flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-void font-black text-white">
                x
              </span>
              <span>
                <span className="block font-display text-lg font-black tracking-[0.32em] text-white">x1c7</span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.35em] text-white/45">creative hub</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/50">
              Music, machines, agents, experiments. A portal map by xsy for everything loud, strange, useful, and still forming.
            </p>
          </motion.div>

          {/* Portal links */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Portals</p>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              {PORTAL_LINKS.map((portal) => (
                <Link
                  key={portal.slug}
                  href={`/${portal.slug}`}
                  className="group flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/45 transition hover:text-white"
                >
                  <span className="h-1 w-1 rounded-full bg-white/20 transition group-hover:bg-signal" />
                  {portal.label}
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Socials */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Connect</p>
            <div className="mt-4 flex gap-2">
              {SOCIALS.map((social) => (
                <MagneticCard key={social.name} strength={0.2}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:text-white"
                    style={{ transitionProperty: "color, border-color" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = social.color + "55";
                      (e.currentTarget as HTMLElement).style.color = social.color;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                      (e.currentTarget as HTMLElement).style.color = "";
                    }}
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                </MagneticCard>
              ))}
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-white/30">
              xsy@x1c7.com
            </p>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">
            &copy; {new Date().getFullYear()} x1c7. All signal reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-venom" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
              Systems nominal
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
