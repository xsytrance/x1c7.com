// The xsytrance artist signature on /music — the identity behind The Collection.
// Cinematic hero art (public/brand/hero.webp) under the AGENOR studio mark and
// the "music without borders" ethos. Presentational; safe in a client page.

export function XsytranceBand() {
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
            <div>
              <span className="block font-display text-sm font-black tracking-[0.3em] text-[#e8c766]">AGENOR</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.35em] text-white/45">xsyverse studios</span>
            </div>
          </div>

          {/* wordmark */}
          <h2 className="font-display text-4xl font-black tracking-[-0.02em] text-white sm:text-6xl">
            xsy<span className="text-plasma">trance</span>
            <span
              aria-hidden
              className="ml-3 inline-block align-middle text-plasma"
              style={{ filter: "drop-shadow(0 0 10px rgba(255,61,240,0.7))" }}
            >
              ✕
            </span>
          </h2>

          <p className="max-w-xl text-sm leading-7 text-white/70 sm:text-base">
            Music without borders. Vision without limits. Every drop written, worlded, and shipped in-house —
            the covers, the collector cases, the live shows.
          </p>

          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/35">
            NYC → the world · one world, many sounds
          </p>
        </div>
      </div>
    </section>
  );
}
