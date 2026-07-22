"use client";

// The compatibility meter — the Splice Table's signal read. Green = it'll sing,
// amber = stretch it, red = it'll fight. Derived from real BPM/key analysis.

export function compatTone(n: number): { label: string; text: string; bar: string; ring: string } {
  if (n >= 75) return { label: "sings", text: "text-emerald-400", bar: "bg-emerald-400", ring: "border-emerald-500/40" };
  if (n >= 45) return { label: "stretch", text: "text-amber-400", bar: "bg-amber-400", ring: "border-amber-400/40" };
  return { label: "fights", text: "text-rose-400", bar: "bg-rose-400", ring: "border-rose-500/40" };
}

export function CompatMeter({ value, className = "" }: { value: number; className?: string }) {
  const t = compatTone(value);
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${t.bar} transition-[width] duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className={`font-mono text-xs ${t.text}`}>{value}/100 · {t.label}</span>
    </div>
  );
}
