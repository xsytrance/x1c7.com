import Link from "next/link";

export function BackToHub() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-white/45 transition hover:text-signal"
    >
      <span className="portal-ring grid h-6 w-6 place-items-center rounded-lg p-[1px]">
        <span className="grid h-full w-full place-items-center rounded-lg bg-void text-[10px] font-black">x</span>
      </span>
      Back to hub
    </Link>
  );
}
