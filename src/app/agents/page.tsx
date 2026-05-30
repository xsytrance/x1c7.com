"use client";

import { useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { StatusChip } from "@/components/StatusChip";
import Link from "next/link";

interface Agent {
  codename: string;
  role: string;
  status: "live" | "forming" | "locked";
  color: string;
  silhouette: React.ReactNode;
}

/* ── unique CSS geometric silhouettes ─────────────────────────────── */

function VgGodSilhouette() {
  return (
    <div className="grid h-20 w-20 place-items-center">
      <div
        className="h-16 w-16"
        style={{
          background: "linear-gradient(135deg, #ff2bd6, #ff6ee3)",
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          boxShadow: "0 0 20px rgba(255, 43, 214, 0.5)",
          filter: "drop-shadow(0 0 8px rgba(255, 43, 214, 0.6))",
        }}
      />
    </div>
  );
}

function UltronSilhouette() {
  return (
    <div className="grid h-20 w-20 place-items-center">
      <div className="relative h-16 w-16">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, #43f7ff, #2bc4cc)",
            clipPath:
              "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
            filter: "drop-shadow(0 0 8px rgba(67, 247, 255, 0.5))",
          }}
        />
        {/* circuit lines */}
        <div
          className="absolute left-1/2 top-1/2 h-[1px] w-6 -translate-x-1/2 -translate-y-1/2"
          style={{ background: "rgba(5, 3, 11, 0.5)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-6 w-[1px] -translate-x-1/2 -translate-y-1/2"
          style={{ background: "rgba(5, 3, 11, 0.5)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "rgba(5, 3, 11, 0.6)" }}
        />
      </div>
    </div>
  );
}

function DazzlerSilhouette() {
  return (
    <div className="grid h-20 w-20 place-items-center">
      <div
        className="h-[72px] w-[72px]"
        style={{
          background: "linear-gradient(180deg, #ff9b3d, #ffc07a)",
          clipPath:
            "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
          filter: "drop-shadow(0 0 10px rgba(255, 155, 61, 0.6))",
        }}
      />
    </div>
  );
}

function PicassoSilhouette() {
  return (
    <div className="grid h-20 w-20 place-items-center">
      <div
        className="h-16 w-16"
        style={{
          background: "linear-gradient(225deg, #8dff4a, #5acc1f)",
          borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
          filter: "drop-shadow(0 0 8px rgba(141, 255, 74, 0.5))",
        }}
      />
    </div>
  );
}

function SpecterSilhouette() {
  return (
    <div className="grid h-20 w-20 place-items-center">
      <div className="relative h-16 w-14 opacity-60">
        {/* ghostly outline */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, #7c3cff, #4a1fa3)",
            borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%",
            clipPath: "ellipse(45% 48% at 50% 45%)",
          }}
        />
        {/* tail */}
        <div
          className="absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 translate-y-3"
          style={{
            background: "linear-gradient(180deg, #7c3cff, transparent)",
            clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}

function OracleSilhouette() {
  return (
    <div className="grid h-20 w-20 place-items-center">
      <div className="relative h-16 w-16">
        {/* outer ring */}
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{
            borderColor: "#f5ff6b",
            opacity: 0.8,
            filter: "drop-shadow(0 0 6px rgba(245, 255, 107, 0.5))",
          }}
        />
        {/* inner ring */}
        <div
          className="absolute inset-3 rounded-full border"
          style={{ borderColor: "#f5ff6b", opacity: 0.5 }}
        />
        {/* pupil */}
        <div
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "#f5ff6b", opacity: 0.9 }}
        />
      </div>
    </div>
  );
}

/* ── agent data ───────────────────────────────────────────────────── */

const agents: Agent[] = [
  {
    codename: "VG GOD",
    role: "Visual Generation",
    status: "live",
    color: "#ff2bd6",
    silhouette: <VgGodSilhouette />,
  },
  {
    codename: "ULTRON",
    role: "Systems Intelligence",
    status: "live",
    color: "#43f7ff",
    silhouette: <UltronSilhouette />,
  },
  {
    codename: "DAZZLER",
    role: "Signal Amplification",
    status: "forming",
    color: "#ff9b3d",
    silhouette: <DazzlerSilhouette />,
  },
  {
    codename: "PICASSO",
    role: "Creative Synthesis",
    status: "live",
    color: "#8dff4a",
    silhouette: <PicassoSilhouette />,
  },
  {
    codename: "SPECTER",
    role: "Stealth Operations",
    status: "locked",
    color: "#7c3cff",
    silhouette: <SpecterSilhouette />,
  },
  {
    codename: "ORACLE",
    role: "Pattern Recognition",
    status: "forming",
    color: "#f5ff6b",
    silhouette: <OracleSilhouette />,
  },
];

/* ── page ─────────────────────────────────────────────────────────── */

export default function AgentsPage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      {/* background layers */}
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* top nav */}
        <BackToHub />

        {/* header */}
        <header className="mb-6 mt-8 sm:mb-8 sm:mt-12">
          <p
            className="font-mono text-xs uppercase tracking-[0.45em]"
            style={{ color: "#00ffa8" }}
          >
            <TextScramble text="x1c7 portal" delay={100} speed={25} />
          </p>
          <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-7xl">
            <TextScramble text="Agent Ecosystem" delay={300} speed={30} />
          </h1>
          <p className="mt-4 max-w-xl text-lg font-semibold leading-8 text-white/75">
            VG God, Ultron, Dazzler, Picasso, and the rest of the crew.
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-white/40">
            06 Agents Registered
          </p>
        </header>

        {/* agent grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, index) => (
            <ScrollReveal
              key={agent.codename}
              delay={reduceMotion ? 0 : index * 0.08}
              direction="up"
              distance={25}
              duration={0.5}
            >
              <AgentCard agent={agent} />
            </ScrollReveal>
          ))}
        </div>

        {/* bottom navigation */}
        <nav className="mt-12 flex flex-wrap items-center justify-center gap-4 pb-8">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-[#00ffa8] hover:text-white"
          >
            Hub
          </Link>
          <Link
            href="/gallery"
            className="rounded-full border border-white/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-[#00ffa8] hover:text-white"
          >
            Gallery
          </Link>
          <Link
            href="/classified"
            className="rounded-full border border-white/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-red-400 hover:text-white"
          >
            Classified
          </Link>
        </nav>
      </div>
    </main>
  );
}

/* ── agent card ───────────────────────────────────────────────────── */

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      className="card-lift relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur"
      style={{
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      {/* accent glow */}
      <div
        className="absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl"
        style={{ background: agent.color, opacity: 0.15 }}
        aria-hidden
      />

      {/* silhouette */}
      <div className="relative mb-5 flex h-24 items-center justify-center rounded-2xl bg-black/20">
        {agent.silhouette}
      </div>

      {/* codename */}
      <h2 className="relative text-2xl font-black uppercase tracking-[-0.04em] text-white">
        {agent.codename}
      </h2>

      {/* role */}
      <p className="relative mt-1 text-sm font-medium uppercase tracking-[0.15em] text-white/50">
        {agent.role}
      </p>

      {/* status */}
      <div className="relative mt-4">
        <StatusChip status={agent.status} />
      </div>

      {/* bottom accent line */}
      <div
        className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
          opacity: 0.4,
        }}
        aria-hidden
      />
    </div>
  );
}
