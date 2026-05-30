"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { MagneticCard } from "@/components/MagneticCard";

const INTERESTS = [
  { id: "music", label: "Music & Audio", color: "#ff2bd6" },
  { id: "ai", label: "AI Experiments", color: "#8dff4a" },
  { id: "automation", label: "Automation", color: "#43f7ff" },
  { id: "collab", label: "Collaboration", color: "#ff9b3d" },
  { id: "other", label: "Something Else", color: "#f5ff6b" },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const reduceMotion = useReducedMotion();

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Build mailto link
    const subject = encodeURIComponent(`x1c7 contact from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nInterests: ${selectedInterests.join(", ")}\n\n${message}`
    );
    window.location.href = `mailto:xsy@x1c7.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div
        className="pointer-events-none absolute right-0 top-0 h-96 w-96 -translate-y-1/4 translate-x-1/4 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: "#43f7ff" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-8">
          <BackToHub />
        </nav>

        {/* Header */}
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-signal/70">
            x1c7 transmission
          </p>
          <TextScramble
            text="Send Signal"
            as="h1"
            className="mt-4 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-6xl"
            delay={200}
          />
          <p className="mt-4 max-w-lg text-sm leading-7 text-white/55">
            Got a project, idea, collaboration, or just want to say hi? Drop a message into the void.
          </p>
        </motion.header>

        {/* Form */}
        {!submitted ? (
          <motion.form
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Name */}
            <div>
              <label htmlFor="name" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm text-white placeholder-white/25 backdrop-blur transition focus:border-signal/40 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-signal/20"
                placeholder="Who's sending this signal?"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm text-white placeholder-white/25 backdrop-blur transition focus:border-signal/40 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-signal/20"
                placeholder="Where should the response land?"
              />
            </div>

            {/* Interests */}
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                What&apos;s this about? (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => {
                  const selected = selectedInterests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition"
                      style={{
                        backgroundColor: selected ? `${interest.color}22` : "transparent",
                        color: selected ? interest.color : "#ffffff66",
                        border: `1px solid ${selected ? `${interest.color}55` : "#ffffff15"}`,
                      }}
                    >
                      {selected ? "● " : "○ "}{interest.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                Message
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm text-white placeholder-white/25 backdrop-blur transition focus:border-signal/40 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-signal/20"
                placeholder="What's on your mind?"
              />
            </div>

            {/* Submit */}
            <MagneticCard strength={0.1} className="inline-block w-full sm:w-auto">
              <button
                type="submit"
                className="w-full rounded-full bg-signal px-8 py-3.5 font-mono text-xs font-black uppercase tracking-[0.2em] text-void transition hover:scale-[1.02] sm:w-auto"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Transmit
                </span>
              </button>
            </MagneticCard>

            {/* Alternative */}
            <p className="pt-2 font-mono text-[10px] uppercase tracking-wider text-white/30">
              Or email directly: <a href="mailto:xsy@x1c7.com" className="text-signal/60 transition hover:text-signal">xsy@x1c7.com</a>
            </p>
          </motion.form>
        ) : (
          /* Success state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-[2rem] border border-signal/20 bg-signal/[0.04] p-8 text-center backdrop-blur sm:p-12"
          >
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-signal/15">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43f7ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">
              Signal Sent
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-white/55">
              Your message is winging its way through the void. xsy will pick it up on the other side.
            </p>
            <button
              onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); setSelectedInterests([]); }}
              className="mt-6 rounded-full border border-white/15 px-6 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-white/50 transition hover:border-signal hover:text-signal"
            >
              Send Another
            </button>
          </motion.div>
        )}

        {/* Social links */}
        <motion.section
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 border-t border-white/5 pt-8"
        >
          <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-white/30">
            Find xsy elsewhere
          </p>
          <div className="flex justify-center gap-3">
            {[
              { name: "GitHub", url: "https://github.com/xsytrance", color: "#8dff4a", icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              )},
              { name: "SoundCloud", url: "https://soundcloud.com/xsytrance", color: "#ff9b3d", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1z" /></svg>
              )},
              { name: "Suno", url: "https://suno.com/@xsytrance", color: "#ff2bd6", icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l4-4 4 4"/><path d="M12 16V8"/></svg>
              )},
            ].map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition"
                style={{ borderColor: `${s.color}25`, color: `${s.color}99` }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${s.color}55`;
                  (e.currentTarget as HTMLElement).style.backgroundColor = `${s.color}10`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${s.color}25`;
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                {s.icon}
                {s.name}
              </a>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
