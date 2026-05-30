"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

interface Project {
  name: string;
  description: string;
  status: "forming" | "live";
  color: string;
  detail: string;
}

const PROJECTS: Project[] = [
  {
    name: "vAIb out!",
    description: "AI expression experiment",
    status: "forming",
    color: "#ff2bd6",
    detail:
      "An experiment in AI-driven creative expression. Teaching machines to feel the funk and channel it into visual output. Still wiring the neurons.",
  },
  {
    name: "Entangled",
    description: "Connected chaos",
    status: "forming",
    color: "#43f7ff",
    detail:
      "Everything is connected. Entangled is a web of interlinked ideas, data streams, and creative impulses colliding in controlled chaos.",
  },
  {
    name: "Aurex",
    description: "Golden ratio experiments",
    status: "forming",
    color: "#ff9b3d",
    detail:
      "Exploring the divine proportion through generative art, interactive geometry, and the mathematical beauty underlying reality.",
  },
  {
    name: "XsyVerse",
    description: "Universe of characters",
    status: "forming",
    color: "#7c3cff",
    detail:
      "A sprawling universe of characters, each with their own lore, relationships, and stories branching across dimensions.",
  },
  {
    name: "BakeBrain",
    description: "Bake your own intelligence",
    status: "forming",
    color: "#8dff4a",
    detail:
      "Roll your own. BakeBrain lets you knead, shape, and bake custom AI models from scratch — no factory required.",
  },
  {
    name: "x1c7",
    description: "This website",
    status: "live",
    color: "#43f7ff",
    detail:
      "The portal hub you are currently navigating. A Next.js cyber-mystic experience built with Tailwind, Framer Motion, and too much caffeine.",
  },
];

const COMMANDS = [
  "ls -la",
  "ls",
  "cat",
  "clear",
  "help",
  "whoami",
  "date",
  "pwd",
];

const HELP_TEXT = `
Available commands:
  ls       - list project files
  ls -la   - list with details
  cat <n>  - view project details
  clear    - clear the terminal
  help     - show this message
  whoami   - show current user
  date     - show current date
  pwd      - print working directory
`;

/* ------------------------------------------------------------------ */
/*  UTILITIES                                                          */
/* ------------------------------------------------------------------ */

function useTypedText(
  text: string,
  speed = 40,
  delay = 0,
  onComplete?: () => void
) {
  const [display, setDisplay] = useState("");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(text);
      onComplete?.();
      return;
    }
    let i = 0;
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplay(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          onComplete?.();
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, speed, delay, reduceMotion]);

  return display;
}

/* ------------------------------------------------------------------ */
/*  STATUS DOT                                                         */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: "forming" | "live" }) {
  const color = status === "live" ? "bg-[#8dff4a]" : "bg-[#43f7ff]";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${status === "live" ? "animate-pulse" : ""}`}
      />
      <span className="text-[10px] uppercase tracking-wider text-white/50">
        {status}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  TERMINAL LINE                                                      */
/* ------------------------------------------------------------------ */

function TerminalLine({
  prompt = true,
  command,
  output,
  children,
  delay = 0,
}: {
  prompt?: boolean;
  command: string;
  output?: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  const typed = useTypedText(command, 30, delay);
  const reduceMotion = useReducedMotion();
  const [showOutput, setShowOutput] = useState(reduceMotion ?? false);

  useEffect(() => {
    if (typed === command) {
      const t = setTimeout(() => setShowOutput(true), 200);
      return () => clearTimeout(t);
    }
  }, [typed, command]);

  return (
    <div className="mb-1">
      {prompt && (
        <div className="font-mono text-xs sm:text-sm">
          <span className="text-[#8dff4a]/70">xsy</span>
          <span className="text-white/30">@</span>
          <span className="text-[#43f7ff]/70">x1c7</span>
          <span className="text-white/30">:~/projects$ </span>
          <span className="text-white/80">{typed}</span>
          {typed === command && (
            <span className="ml-0.5 inline-block h-3.5 w-2 bg-white/60 animate-pulse" />
          )}
        </div>
      )}
      {!prompt && (
        <div className="font-mono text-xs sm:text-sm text-white/60">
          {typed}
        </div>
      )}
      <AnimatePresence>
        {showOutput && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {output && (
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/50 sm:text-sm">
                {output}
              </pre>
            )}
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FILE ENTRY                                                         */
/* ------------------------------------------------------------------ */

function FileEntry({
  project,
  index,
  isExpanded,
  onToggle,
}: {
  project: Project;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="group"
    >
      {/* ls entry */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full text-left transition-colors hover:bg-white/[0.03] rounded px-2 -mx-2 py-1"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs sm:text-sm">
          <span className="hidden text-white/25 sm:inline">
            drwxr-xr-x
          </span>
          <span className="hidden text-white/25 sm:inline">xsy xsy</span>
          <span className="hidden text-white/25 sm:inline">4.0K</span>
          <span
            className="font-semibold tracking-wide"
            style={{ color: project.color }}
          >
            {project.name}
          </span>
          <span className="text-white/30">—</span>
          <span className="text-white/45">{project.description}</span>
          <StatusDot status={project.status} />
        </div>
      </button>

      {/* hover preview: cat command */}
      <AnimatePresence>
        {hovered && !isExpanded && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? false : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 flex items-center gap-2 rounded bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-white/30">
              <span className="text-[#8dff4a]/40">$</span>
              <span>cat</span>
              <span style={{ color: project.color }}>{project.name.toLowerCase().replace(/\s/g, "_")}/README.md</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? false : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-[#7c3cff]/15 bg-black/40 p-3 sm:p-4">
              <div className="mb-2 font-mono text-[10px] text-white/25">
                <span className="text-[#8dff4a]/50">$</span> cat{" "}
                <span style={{ color: project.color }}>
                  {project.name.toLowerCase().replace(/\s/g, "_")}
                </span>
                /README.md
              </div>
              <p className="font-mono text-xs leading-relaxed text-white/65 sm:text-sm">
                {project.detail}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <StatusDot status={project.status} />
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: project.color }}
                >
                  {project.status === "live" ? "● live" : "○ forming"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function ProjectsPage() {
  const reduceMotion = useReducedMotion();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [typedInput, setTypedInput] = useState("");
  const [history, setHistory] = useState<
    { type: "in" | "out"; text: string }[]
  >([]);
  const [showBootSequence, setShowBootSequence] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const bootCompleteRef = useRef(false);

  /* scroll to bottom on new output */
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history, expandedIndex]);

  /* boot sequence timing */
  useEffect(() => {
    if (reduceMotion) {
      setShowBootSequence(false);
      return;
    }
    const t = setTimeout(() => {
      setShowBootSequence(false);
      bootCompleteRef.current = true;
    }, 3000);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  /* fake command handler */
  const handleCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim().toLowerCase();
      setHistory((prev) => [...prev, { type: "in", text: cmd }]);

      if (trimmed === "ls" || trimmed === "ls -la") {
        setHistory((prev) => [
          ...prev,
          { type: "out", text: "projects listed above" },
        ]);
      } else if (trimmed === "clear") {
        setHistory([]);
        setExpandedIndex(null);
      } else if (trimmed === "help") {
        setHistory((prev) => [...prev, { type: "out", text: HELP_TEXT }]);
      } else if (trimmed === "whoami") {
        setHistory((prev) => [
          ...prev,
          { type: "out", text: "xsy — creator, coder, chaos wrangler" },
        ]);
      } else if (trimmed === "date") {
        setHistory((prev) => [
          ...prev,
          { type: "out", text: new Date().toString() },
        ]);
      } else if (trimmed === "pwd") {
        setHistory((prev) => [
          ...prev,
          { type: "out", text: "/home/xsy/projects" },
        ]);
      } else if (trimmed.startsWith("cat ")) {
        const name = trimmed.slice(4).trim();
        const idx = PROJECTS.findIndex(
          (p) =>
            p.name.toLowerCase().replace(/\s/g, "_") === name ||
            p.name.toLowerCase() === name
        );
        if (idx !== -1) {
          setExpandedIndex(idx);
          setHistory((prev) => [
            ...prev,
            { type: "out", text: PROJECTS[idx].detail },
          ]);
        } else {
          setHistory((prev) => [
            ...prev,
            { type: "out", text: `cat: ${name}: No such file or directory` },
          ]);
        }
      } else if (trimmed) {
        setHistory((prev) => [
          ...prev,
          { type: "out", text: `${trimmed}: command not found. Type 'help' for available commands.` },
        ]);
      }
    },
    []
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!typedInput.trim()) return;
      handleCommand(typedInput);
      setTypedInput("");
    },
    [typedInput, handleCommand]
  );

  /* boot typed lines */
  const bootLine1 = useTypedText(
    "connecting to x1c7 projects portal...",
    25,
    0
  );
  const bootLine2 = useTypedText(
    "authentication: ok",
    20,
    600
  );
  const bootLine3 = useTypedText(
    "mounting project directory...",
    25,
    1200
  );
  const bootLine4 = useTypedText(
    "ready.",
    40,
    2200
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Nav */}
        <nav className="mb-6 flex items-center justify-between sm:mb-8">
          <BackToHub />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7c3cff]/70">
            <span>◈</span>
            <span className="hidden sm:inline">x1c7 portal</span>
          </div>
        </nav>

        {/* Header */}
        <ScrollReveal className="mb-6 sm:mb-8">
          <div className="text-center">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.45em] text-[#7c3cff]/80">
              x1c7 portal
            </p>
            <TextScramble
              text="Projects"
              as="h1"
              className="font-display text-4xl font-black uppercase tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl"
              delay={100}
            />
            <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-7 text-white/60 sm:text-base">
              Apps, tools, coding experiments: vAIb out!, Entangled, Aurex,
              dashboards, toys, and builds crawling out of the basement.
            </p>
          </div>
        </ScrollReveal>

        {/* Terminal Window */}
        <ScrollReveal delay={0.2} className="mb-8 flex-1 sm:mb-12">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-6"
          >
            {/* Terminal top bar */}
            <div className="mb-4 flex items-center justify-between border-b border-[#7c3cff]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff2bd6]/70" />
                <span className="h-3 w-3 rounded-full bg-[#ff9b3d]/70" />
                <span className="h-3 w-3 rounded-full bg-[#8dff4a]/70" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                xsy@x1c7:~/projects
              </span>
              <div className="h-3 w-3" />
            </div>

            {/* Terminal body */}
            <div
              ref={terminalRef}
              className="max-h-[70vh] overflow-y-auto rounded-2xl border border-[#7c3cff]/20 bg-black/60 p-4 sm:p-5"
              onClick={() => inputRef.current?.focus()}
            >
              {/* Boot sequence */}
              <AnimatePresence>
                {showBootSequence && (
                  <motion.div
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-4 space-y-1 font-mono text-xs text-white/30"
                  >
                    <div>{bootLine1}</div>
                    {bootLine1 === "connecting to x1c7 projects portal..." && (
                      <div>{bootLine2}</div>
                    )}
                    {bootLine2 === "authentication: ok" && (
                      <div>{bootLine3}</div>
                    )}
                    {bootLine3 === "mounting project directory..." && (
                      <motion.div
                        className="text-[#8dff4a]/60"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        {bootLine4}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ls -la command */}
              {!showBootSequence && (
                <>
                  <TerminalLine command="ls -la" delay={0}>
                    <div className="mt-2 space-y-1">
                      {PROJECTS.map((project, i) => (
                        <FileEntry
                          key={project.name}
                          project={project}
                          index={i}
                          isExpanded={expandedIndex === i}
                          onToggle={() =>
                            setExpandedIndex((prev) =>
                              prev === i ? null : i
                            )
                          }
                        />
                      ))}
                    </div>
                  </TerminalLine>

                  {/* history */}
                  <AnimatePresence>
                    {history.map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2"
                      >
                        {entry.type === "in" && (
                          <div className="font-mono text-xs sm:text-sm">
                            <span className="text-[#8dff4a]/70">xsy</span>
                            <span className="text-white/30">@</span>
                            <span className="text-[#43f7ff]/70">x1c7</span>
                            <span className="text-white/30">
                              :~/projects${" "}
                            </span>
                            <span className="text-white/80">{entry.text}</span>
                          </div>
                        )}
                        {entry.type === "out" && (
                          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/50 sm:text-sm">
                            {entry.text}
                          </pre>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Input prompt */}
                  <form onSubmit={onSubmit} className="mt-4">
                    <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
                      <span className="text-[#8dff4a]/70">xsy</span>
                      <span className="text-white/30">@</span>
                      <span className="text-[#43f7ff]/70">x1c7</span>
                      <span className="text-white/30">:~/projects$ </span>
                      <input
                        ref={inputRef}
                        type="text"
                        value={typedInput}
                        onChange={(e) => setTypedInput(e.target.value)}
                        className="flex-1 bg-transparent font-mono text-xs text-white/80 outline-none caret-[#7c3cff] sm:text-sm"
                        placeholder="type a command..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <span className="inline-block h-3.5 w-2 animate-pulse bg-[#7c3cff]/60" />
                    </div>
                  </form>

                  {/* Quick command buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {COMMANDS.map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => handleCommand(cmd)}
                        className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-white/35 transition hover:border-[#7c3cff]/30 hover:text-white/60"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </ScrollReveal>

        {/* Bottom navigation */}
        <ScrollReveal delay={0.3} className="mb-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-[#05030b] transition hover:scale-105 hover:bg-[#43f7ff]"
            >
              Back to hub
            </Link>
            <Link
              href="/classified"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-[#ff2bd6] hover:text-white"
            >
              Try locked door
            </Link>
          </div>
        </ScrollReveal>

        {/* Footer */}
        <footer className="mt-auto pb-4 text-center font-mono text-[10px] text-white/20">
          <span className="text-[#7c3cff]/40">◈</span> x1c7 portal — projects
          directory
        </footer>
      </div>
    </main>
  );
}
