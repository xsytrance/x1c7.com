import { type ReactNode } from "react";

interface SignalPanelProps {
  children: ReactNode;
  accentColor?: string;
  className?: string;
}

export function SignalPanel({ children, accentColor, className = "" }: SignalPanelProps) {
  return (
    <section className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8 ${className}`}>
      {accentColor && (
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `${accentColor}33` }} />
      )}
      <div className="relative">{children}</div>
    </section>
  );
}
