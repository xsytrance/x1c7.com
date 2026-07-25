"use client";

import type { ReactNode } from "react";

export type Tab = "songs" | "media" | "look" | "words" | "lab" | "account";

const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: "songs", label: "Songs", glyph: "♫" },
  { id: "media", label: "Photos", glyph: "▣" },
  { id: "look", label: "Look", glyph: "◍" },
  { id: "words", label: "Words", glyph: "¶" },
  { id: "lab", label: "Lab", glyph: "⚙" },
  { id: "account", label: "You", glyph: "◉" },
];

/** Scrolls horizontally on a phone rather than shrinking to unreadable stubs. */
export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          className="shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-colors"
          style={
            tab === t.id
              ? { background: "var(--t-primary)", borderColor: "var(--t-primary)", color: "#fff" }
              : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }
          }
        >
          <span aria-hidden className="mr-1.5">{t.glyph}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">{title}</h2>
      {hint && <p className="mt-1 text-xs leading-relaxed text-white/35">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 border-b border-white/5 py-2.5 last:border-0">{children}</div>;
}

/** 16px text is not a style choice — anything smaller makes iOS zoom on focus. */
export function Field({
  label, value, onChange, hint, multiline, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const cls =
    "w-full rounded-xl border border-white/12 bg-black/40 px-3.5 py-3 text-base outline-none transition-colors focus:border-white/40";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</span>
      {multiline ? (
        <textarea className={`${cls} min-h-[92px] resize-y leading-relaxed`} value={value}
                  onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={cls} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <span className="mt-1 block text-xs text-white/30">{hint}</span>}
    </label>
  );
}

export function Toggle({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3.5 py-3 text-left text-sm transition-colors"
      aria-pressed={on}
    >
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: on ? "var(--t-primary)" : "rgba(255,255,255,0.15)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ left: 2, transform: on ? "translateX(20px)" : "none" }}
        />
      </span>
      {children}
    </button>
  );
}

/** Lives above the thumb, says what happened, and gets out of the way. */
export function SaveBar({ status, error }: { status: string | null; error: string | null }) {
  if (!status && !error) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-50 mx-auto max-w-md px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
    >
      <div
        className="rounded-xl px-4 py-3 text-center text-sm font-semibold shadow-lg"
        style={
          error
            ? { background: "#2a0c12", color: "#ff8fa3", border: "1px solid #ff8fa355" }
            : { background: "var(--t-primary)", color: "#fff" }
        }
      >
        {error ?? status}
      </div>
    </div>
  );
}
