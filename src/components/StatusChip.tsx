"use client";

type Status = "live" | "forming" | "locked";

const config: Record<Status, { label: string; cls: string; dot: string }> = {
  live: {
    label: "live",
    cls: "text-venom",
    dot: "bg-venom animate-pulse",
  },
  forming: {
    label: "forming",
    cls: "text-signal",
    dot: "bg-signal animate-pulse",
  },
  locked: {
    label: "locked",
    cls: "text-red-400",
    dot: "bg-red-400",
  },
};

export function StatusChip({ status }: { status: Status }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] ${c.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
