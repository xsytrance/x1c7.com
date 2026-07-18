// The AGENOR artist signature on /music — the identity behind The Collection.
// AGENOR (all caps) is the permanent artist name; xsytrance is where it started
// (since age 12–13) and is still the handle everywhere. Cinematic hero art
// (public/brand/hero.webp) under the gold studio mark. Presentational.

export function AgenorBand() {
  return (
    <section className="relative z-10 mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        {/* hero art */}
        <img
          src="/brand/hero.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="lazy"
        />
        {/* legibility + theme wash */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#05030b] via-[#05030b]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05030b] via-transparent to-transparent" />

        <div className="relative flex min-h-[320px] flex-col justify-end gap-4 p-7 sm:min-h-[380px] sm:p-10 lg:min-h-[440px]">
          {/* studio mark */}
          <div className="flex items-center gap-3">
            <img src="/brand/agenor-gold-sm.webp" alt="AGENOR" className="h-11 w-11 object-contain" loading="lazy" />
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/45">xsyverse studios</span>
          </div>

          {/* artist name — AGENOR leads */}
          <h2 className="font-display text-5xl font-black tracking-[0.02em] text-[#e8c766] sm:text-7xl" style={{ textShadow: "0 0 30px rgba(232,199,102,0.25)" }}>
            AGENOR
          </h2>

          <p className="max-w-xl text-sm leading-7 text-white/70 sm:text-base">
            Music without borders. Vision without limits. Every drop written, worlded, and shipped in-house —
            the covers, the collector cases, the live shows.
          </p>

          {/* xsytrance — where it started, still the handle */}
          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
            <span
              aria-hidden
              className="text-plasma"
              style={{ filter: "drop-shadow(0 0 8px rgba(255,61,240,0.7))" }}
            >
              ✕
            </span>
            <span>
              <span className="text-white/70">xsytrance</span> — where it started · still the handle everywhere
            </span>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/30">
            NYC → the world · one world, many sounds
          </p>
        </div>
      </div>
    </section>
  );
}
