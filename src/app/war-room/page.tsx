"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { StaggerContainer } from "@/components/StaggerContainer";

/* ─── fake mission log data ─── */
const MISSION_LOG = [
  { time: "14:22:01", msg: "Agent Picasso deployed to sector 7" },
  { time: "14:18:33", msg: "Signal boost initiated" },
  { time: "14:15:12", msg: "New portal detected in quadrant 4" },
  { time: "14:09:47", msg: "Agent Orpheus returned from recon" },
  { time: "14:05:21", msg: "Network integrity check passed" },
  { time: "13:58:09", msg: "Emergency beacon acknowledged — sector 2" },
  { time: "13:52:44", msg: "Agent Valkyrie status: standby" },
  { time: "13:45:30", msg: "Supply drop completed — outpost gamma" },
  { time: "13:38:17", msg: "Anomaly scan: negative" },
  { time: "13:31:05", msg: "All-clear signal broadcasted" },
  { time: "13:24:52", msg: "Agent Nomad dispatched to perimeter" },
  { time: "13:18:40", msg: "Server cluster 3 rebooted successfully" },
];

/* ─── agent status data ─── */
const AGENTS = [
  { name: "Picasso", status: "active" },
  { name: "Orpheus", status: "active" },
  { name: "Valkyrie", status: "standby" },
  { name: "Nomad", status: "offline" },
];

/* ─── health bar data ─── */
const HEALTH_BARS = [
  { label: "Signal", value: 92 },
  { label: "Agents", value: 75 },
  { label: "Network", value: 88 },
];

/* ─── card entrance wrapper ─── */
function DashCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={`rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur transition-shadow duration-300 hover:shadow-lg hover:shadow-cyan-500/10 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─── live clock ─── */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (n: number) => n.toString().padStart(2, "0");

  if (!now) {
    return (
      <DashCard>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Operations Clock</p>
        <p className="mt-3 font-mono text-4xl font-bold text-signal">--:--:--</p>
      </DashCard>
    );
  }

  const timeStr = `${fmt(now.getHours())}:${fmt(now.getMinutes())}:${fmt(now.getSeconds())}`;
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <DashCard delay={0.05}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Operations Clock</p>
      <p className="mt-3 font-mono text-4xl font-bold text-signal">{timeStr}</p>
      <p className="mt-2 font-mono text-xs text-white/35">{dateStr}</p>
    </DashCard>
  );
}

/* ─── active ops counter ─── */
function ActiveOps() {
  return (
    <DashCard delay={0.1}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Active Operations</p>
      <p className="mt-3 font-mono text-5xl font-bold text-signal">03</p>
      <div className="mt-3 flex gap-1.5">
        <span className="inline-block h-1.5 w-8 rounded-full bg-signal" />
        <span className="inline-block h-1.5 w-8 rounded-full bg-signal/60" />
        <span className="inline-block h-1.5 w-8 rounded-full bg-signal/30" />
      </div>
    </DashCard>
  );
}

/* ─── agent status ─── */
function AgentStatus() {
  const statusColor: Record<string, string> = {
    active: "bg-venom shadow-[0_0_8px_rgba(141,255,74,0.6)]",
    standby: "bg-ember shadow-[0_0_8px_rgba(255,155,61,0.5)]",
    offline: "bg-plasma/70 shadow-[0_0_8px_rgba(255,43,214,0.4)]",
  };

  return (
    <DashCard delay={0.15}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Agent Status</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        {AGENTS.map((a) => (
          <div key={a.name} className="flex flex-col items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${statusColor[a.status]} animate-pulse`}
              title={a.status}
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
              {a.name}
            </span>
          </div>
        ))}
      </div>
    </DashCard>
  );
}

/* ─── radar sweep ─── */
function RadarSweep() {
  const dots = useMemo(
    () =>
      Array.from({ length: 3 }, () => ({
        top: `${20 + Math.random() * 55}%`,
        left: `${20 + Math.random() * 55}%`,
        delay: Math.random() * 2,
      })),
    []
  );

  return (
    <DashCard delay={0.2} className="flex flex-col items-center">
      <p className="w-full font-mono text-xs uppercase tracking-[0.2em] text-white/40">Sector Scan</p>
      <div className="relative mx-auto mt-4 h-36 w-36 overflow-hidden rounded-full border border-signal/20 bg-black/40">
        {/* grid lines */}
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/5" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/5" />
        <div className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
        <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />

        {/* rotating sweep */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(67,247,255,0.35) 340deg, rgba(67,247,255,0.6) 360deg)",
            animation: "radarSweep 3s linear infinite",
          }}
        />

        {/* center dot */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal" />

        {/* blinking dots */}
        {dots.map((d, i) => (
          <div
            key={i}
            className="absolute h-2 w-2 rounded-full bg-signal"
            style={{
              top: d.top,
              left: d.left,
              animation: `radarPing 2s ease-in-out infinite`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
    </DashCard>
  );
}

/* ─── mission log ─── */
function MissionLog() {
  return (
    <DashCard delay={0.25} className="sm:col-span-2 lg:col-span-1">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Mission Log</p>
      <div className="mt-4 flex max-h-52 flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin">
        {MISSION_LOG.map((entry, i) => (
          <div key={i} className="flex gap-2.5 text-xs">
            <span className="shrink-0 font-mono text-signal/60">[{entry.time}]</span>
            <span className="font-mono text-white/70">{entry.msg}</span>
          </div>
        ))}
      </div>
    </DashCard>
  );
}

/* ─── system status health bars ─── */
function SystemStatus() {
  return (
    <DashCard delay={0.3}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">System Status</p>
      <div className="mt-4 flex flex-col gap-4">
        {HEALTH_BARS.map((h) => (
          <div key={h.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                {h.label}
              </span>
              <span className="font-mono text-[10px] text-signal/70">{h.value}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-signal to-signal/50"
                initial={{ width: 0 }}
                animate={{ width: `${h.value}%` }}
                transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
              >
                <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-signal to-signal/50" />
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </DashCard>
  );
}

/* ─── quick actions ─── */
function QuickActions() {
  return (
    <DashCard delay={0.35} className="sm:col-span-2 lg:col-span-1">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Quick Actions</p>
      <div className="mt-4 flex flex-col gap-3">
        <button className="group relative overflow-hidden rounded-xl border border-signal/20 bg-signal/5 px-5 py-3 text-left transition hover:border-signal/50 hover:bg-signal/10">
          <span className="relative z-10 font-mono text-xs uppercase tracking-[0.2em] text-signal">
            Dispatch Agent
          </span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-signal/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </button>
        <button className="group relative overflow-hidden rounded-xl border border-venom/20 bg-venom/5 px-5 py-3 text-left transition hover:border-venom/50 hover:bg-venom/10">
          <span className="relative z-10 font-mono text-xs uppercase tracking-[0.2em] text-venom">
            Signal Boost
          </span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-venom/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </button>
        <button className="group relative overflow-hidden rounded-xl border border-plasma/20 bg-plasma/5 px-5 py-3 text-left transition hover:border-plasma/50 hover:bg-plasma/10">
          <span className="relative z-10 font-mono text-xs uppercase tracking-[0.2em] text-plasma">
            Emergency
          </span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-plasma/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </button>
      </div>
    </DashCard>
  );
}

/* ─── page ─── */
export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient background layers */}
      <div className="starfield" aria-hidden />
      <div className="scanline" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* nav */}
        <nav className="mb-8">
          <BackToHub />
        </nav>

        {/* header */}
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-signal/80">x1c7 portal</p>
          <TextScramble
            text="War Room"
            className="mt-3 font-display text-5xl font-black uppercase tracking-[-0.06em] text-white sm:text-6xl"
            as="h1"
          />
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/55 sm:text-base">
            Command center for projects, agents, launches, and teamwork.
          </p>
        </header>

        {/* dashboard grid */}
        <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.06}>
          <LiveClock />
          <ActiveOps />
          <AgentStatus />
          <RadarSweep />
          <MissionLog />
          <SystemStatus />
          <QuickActions />
        </StaggerContainer>

        {/* bottom navigation */}
        <ScrollReveal delay={0.4}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 border-t border-white/5 pt-8">
            <Link
              href="/"
              className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 transition hover:border-signal/40 hover:text-signal"
            >
              Hub
            </Link>
            <Link
              href="/classified"
              className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 transition hover:border-plasma/40 hover:text-plasma"
            >
              Classified
            </Link>
            <span className="font-mono text-[10px] text-white/20">|</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/25">
              Sys v2.4.1 — All sectors nominal
            </span>
          </div>
        </ScrollReveal>
      </div>

      {/* radar-specific keyframes */}
      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes radarPing {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
