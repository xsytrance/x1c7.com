import Link from "next/link";

export default function Page() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <div className="starfield" aria-hidden />
      <section className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-10">
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal/20 blur-3xl" />
        <p className="relative font-mono text-xs uppercase tracking-[0.45em] text-signal/80">x1c7 portal</p>
        <h1 className="relative mt-5 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-7xl">AI Art</h1>
        <p className="relative mx-auto mt-6 max-w-xl text-lg font-semibold leading-8 text-white/75">Gallery experiments, XsyVerse visuals, characters, and worlds.</p>
        <p className="relative mx-auto mt-4 max-w-xl text-sm leading-7 text-white/55">A bright weird museum is under construction.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-signal">Back to hub</Link>
          <Link href="/classified" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-plasma hover:text-white">Try locked door</Link>
        </div>
      </section>
    </main>
  );
}
