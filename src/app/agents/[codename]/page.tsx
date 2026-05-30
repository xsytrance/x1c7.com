"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { getAgent, getAllAgents } from "@/data/agents";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { MagneticCard } from "@/components/MagneticCard";
import { notFound } from "next/navigation";

/* ── stat bar ─────────────────────────────────────────── */

function StatBar({ label, value, color, delay = 0 }: {
  label: string; value: number; color: string; delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{label}</span>
        <span className="font-mono text-[10px]" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(to right, ${color}, ${color}88)` }}
          initial={reduceMotion ? { width: `${value}%` } : { width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ── ability card ─────────────────────────────────────── */

function AbilityCard({ ability, color, index }: {
  ability: { name: string; description: string; cooldown: string };
  color: string; index: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
      className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition hover:border-white/20"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-white">{ability.name}</h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
        >
          {ability.cooldown}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-white/55">{ability.description}</p>
    </motion.div>
  );
}

/* ── timeline event ───────────────────────────────────── */

function TimelineEvent({ event, color, index }: {
  event: { date: string; event: string; type: string };
  color: string; index: number;
}) {
  const reduceMotion = useReducedMotion();
  const typeColors: Record<string, string> = {
    activation: "#8dff4a",
    upgrade: "#43f7ff",
    incident: "#ff3b3b",
    milestone: "#ff9b3d",
  };
  const dotColor = typeColors[event.type] || color;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.6 + index * 0.08 }}
      className="flex gap-3"
    >
      <div className="flex flex-col items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}44` }} />
        {index < 3 && <span className="w-px flex-1 bg-white/8" />}
      </div>
      <div className="pb-4">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: dotColor }}>
          {event.date} · {event.type}
        </span>
        <p className="mt-0.5 text-sm text-white/65">{event.event}</p>
      </div>
    </motion.div>
  );
}

/* ── lore card ────────────────────────────────────────── */

function LoreCard({ text, index, color }: { text: string; index: number; color: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
      className="relative rounded-xl border border-white/8 bg-white/[0.03] p-4"
    >
      <span className="absolute -left-1 -top-1 font-mono text-lg font-bold opacity-20" style={{ color }}>#{index + 1}</span>
      <p className="relative text-sm leading-6 text-white/55">{text}</p>
    </motion.div>
  );
}

/* ── main page ────────────────────────────────────────── */

export default function AgentDetailPage() {
  const params = useParams();
  const codename = params.codename as string;
  const agent = getAgent(codename);
  const reduceMotion = useReducedMotion();

  if (!agent) return notFound();

  const allAgents = getAllAgents();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      {/* Hero glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: agent.color }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Nav */}
        <nav className="mb-8 flex items-center justify-between">
          <BackToHub />
          <Link
            href="/agents"
            className="rounded-full border border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 transition hover:border-white/25 hover:text-white"
          >
            All Agents
          </Link>
        </nav>

        {/* Hero section */}
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          {/* Status badge */}
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.45em]" style={{ color: `${agent.color}99` }}>
              x1c7 agent profile
            </span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
              style={{
                background: agent.status === "live" ? "#8dff4a18" : agent.status === "forming" ? "#ff9b3d18" : "#ff3b3b18",
                color: agent.status === "live" ? "#8dff4a" : agent.status === "forming" ? "#ff9b3d" : "#ff3b3b",
                border: `1px solid ${agent.status === "live" ? "#8dff4a30" : agent.status === "forming" ? "#ff9b3d30" : "#ff3b3b30"}`,
              }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${agent.status === "live" ? "animate-pulse bg-venom" : agent.status === "forming" ? "animate-pulse bg-ember" : "bg-red-500"}`} />
              {agent.status}
            </span>
          </div>

          {/* Name + glyph */}
          <div className="flex items-end gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border text-3xl font-black sm:h-20 sm:w-20 sm:text-4xl"
              style={{ borderColor: `${agent.color}33`, background: `${agent.color}15`, color: agent.color }}
            >
              {agent.glyph}
            </span>
            <div>
              <TextScramble
                text={agent.codename}
                as="h1"
                className="font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-7xl"
                style={{ color: agent.color } as React.CSSProperties}
                delay={200}
              />
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-white/40">
                {agent.fullName}
              </p>
            </div>
          </div>

          {/* Tagline */}
          <p className="mt-4 max-w-xl text-lg font-semibold leading-8 text-white/70">
            {agent.tagline}
          </p>

          {/* Description */}
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
            {agent.description}
          </p>
        </motion.section>

        {/* Grid layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* Left column */}
          <div className="space-y-8">
            {/* Stats */}
            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8"
            >
              <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Performance Metrics</p>
              <div className="flex flex-col gap-4">
                {agent.stats.map((s, i) => (
                  <StatBar key={s.label} label={s.label} value={s.value} color={agent.color} delay={i * 0.1} />
                ))}
              </div>
            </motion.section>

            {/* Quote */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="rounded-[2rem] border border-white/10 p-6 sm:p-8"
              style={{ background: `linear-gradient(135deg, ${agent.color}08, transparent)` }}
            >
              <p className="font-display text-xl font-bold italic leading-8 text-white/80" style={{ color: `${agent.color}cc` }}>
                &ldquo;{agent.quote}&rdquo;
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                — {agent.codename}
              </p>
            </motion.div>

            {/* Weakness */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="rounded-[2rem] border border-red-500/10 bg-red-500/[0.03] p-6 sm:p-8"
            >
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.35em] text-red-400/60">Known Weakness</p>
              <p className="text-sm leading-6 text-white/50">{agent.weakness}</p>
            </motion.div>
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {/* Abilities */}
            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Active Abilities</p>
              <div className="flex flex-col gap-3">
                {agent.abilities.map((a, i) => (
                  <AbilityCard key={a.name} ability={a} color={agent.color} index={i} />
                ))}
              </div>
            </motion.section>

            {/* Lore */}
            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Agent Dossier</p>
              <div className="grid gap-3">
                {agent.lore.map((l, i) => (
                  <LoreCard key={i} text={l} index={i} color={agent.color} />
                ))}
              </div>
            </motion.section>

            {/* Timeline */}
            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Operational Timeline</p>
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8">
                {agent.timeline.map((t, i) => (
                  <TimelineEvent key={i} event={t} color={agent.color} index={i} />
                ))}
              </div>
            </motion.section>
          </div>
        </div>

        {/* Agent navigation */}
        <motion.section
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-16 border-t border-white/5 pt-10"
        >
          <p className="mb-5 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-white/30">
            Other Agents
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {allAgents
              .filter((a) => a.codename !== agent.codename)
              .map((a) => (
                <MagneticCard key={a.codename} strength={0.12}>
                  <Link
                    href={`/agents/${a.codename.toLowerCase()}`}
                    className="flex items-center gap-2.5 rounded-full border px-4 py-2 transition"
                    style={{
                      borderColor: `${a.color}25`,
                      color: `${a.color}cc`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${a.color}55`;
                      (e.currentTarget as HTMLElement).style.backgroundColor = `${a.color}10`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${a.color}25`;
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }}
                  >
                    <span className="text-sm">{a.glyph}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider">{a.codename}</span>
                  </Link>
                </MagneticCard>
              ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
