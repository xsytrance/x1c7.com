"use client";

import { useState } from "react";
import type { TylerLink, TylerPalette, TylerSite } from "@/lib/tyler/types";
import { Field, Panel, Toggle } from "./ui";

type Run = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

const EDITIONS: { name: string; palette: TylerPalette }[] = [
  { name: "The album", palette: { primary: "#d9342b", secondary: "#ffb45c", accent: "#7c8cff", bg: "#080b18" } },
  { name: "Neon teeth", palette: { primary: "#ff2bd6", secondary: "#43f7ff", accent: "#8dff4a", bg: "#05030b" } },
  { name: "Night shift", palette: { primary: "#4da6ff", secondary: "#b8c6ff", accent: "#7c3cff", bg: "#040711" } },
  { name: "House lights", palette: { primary: "#ffd166", secondary: "#ff9b3d", accent: "#ff5c8a", bg: "#120c08" } },
  { name: "Storms", palette: { primary: "#5cf2c8", secondary: "#9ad7ff", accent: "#4da6ff", bg: "#03121a" } },
  { name: "Bone", palette: { primary: "#e8e2d6", secondary: "#c0392b", accent: "#8a8578", bg: "#0d0c0a" } },
];

const FONTS = [
  { id: "scrawl", label: "Scrawl", note: "the album's brush title" },
  { id: "condensed", label: "Condensed", note: "poster caps" },
  { id: "serif", label: "Serif", note: "record-sleeve classic" },
  { id: "mono", label: "Mono", note: "terminal" },
] as const;

export function LookTab({ site, run }: { site: TylerSite; run: Run }) {
  const [pal, setPal] = useState<TylerPalette>(site.palette);
  const [opts, setOpts] = useState(site.options);
  const [links, setLinks] = useState<TylerLink[]>(site.links);
  const [socials, setSocials] = useState<TylerLink[]>(site.socials);

  return (
    <>
      <Panel title="Colors" hint="The whole page follows these four. Changing them can't touch x1c7 itself.">
        {/* A real miniature of the page — the only honest preview is one that
            is made of the same parts. */}
        <div className="overflow-hidden rounded-xl border border-white/10" style={{ background: pal.bg }}>
          <div className="p-4">
            <div className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                 style={{ background: `color-mix(in srgb, ${pal.primary} 20%, transparent)`, color: pal.primary }}>
              out now
            </div>
            <div className="mt-2 text-2xl leading-none text-white" style={{ fontFamily: "var(--t-display)" }}>
              {site.album || "The album"}
            </div>
            <div className="mt-3 rounded-lg border p-2.5"
                 style={{ borderColor: `color-mix(in srgb, ${pal.primary} 30%, transparent)`, background: `color-mix(in srgb, ${pal.primary} 8%, transparent)` }}>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: pal.secondary }}>tonight&rsquo;s track</div>
              <div className="mt-1 text-sm text-white/85">A song of yours</div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <span className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase" style={{ background: pal.primary, color: "#fff" }}>listen</span>
              <span className="rounded-full border px-2.5 py-1 text-[9px] uppercase" style={{ borderColor: pal.secondary, color: pal.secondary }}>everywhere</span>
              <span className="rounded-full px-2.5 py-1 text-[9px] uppercase" style={{ background: `color-mix(in srgb, ${pal.accent} 22%, transparent)`, color: pal.accent }}>tag</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["primary", "secondary", "accent", "bg"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5">
              <input type="color" value={pal[k]} onChange={(e) => setPal({ ...pal, [k]: e.target.value })}
                     className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={k} />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-white/50">{k === "bg" ? "background" : k}</span>
                <span className="block font-mono text-[10px] text-white/30">{pal[k]}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {EDITIONS.map((e) => (
            <button key={e.name} onClick={() => setPal(e.palette)}
                    className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-2 text-xs text-white/60">
              <span className="flex">
                {[e.palette.primary, e.palette.secondary, e.palette.accent].map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full" style={{ background: c, marginLeft: -3 }} />
                ))}
              </span>
              {e.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Type" hint="The headline font. Body text stays readable either way.">
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((f) => (
            <button key={f.id} onClick={() => setOpts({ ...opts, font: f.id })}
                    className="rounded-xl border px-3 py-3 text-left"
                    style={opts.font === f.id
                      ? { borderColor: "var(--t-primary)", color: "#fff" }
                      : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
              <span className="block text-sm font-semibold">{f.label}</span>
              <span className="block text-[10px] text-white/35">{f.note}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Atmosphere">
        <Toggle on={opts.grain !== false} onToggle={() => setOpts({ ...opts, grain: opts.grain === false })}>Film grain</Toggle>
        <Toggle on={opts.scanlines !== false} onToggle={() => setOpts({ ...opts, scanlines: opts.scanlines === false })}>Scanlines</Toggle>
        <Toggle on={opts.particles !== false} onToggle={() => setOpts({ ...opts, particles: opts.particles === false })}>Drifting particles</Toggle>
      </Panel>

      <LinkEditor title="Listen links" hint="These are the buttons in the hero and the press section. Check a link before you add it — a dead link is worse than no link."
                  links={links} onChange={setLinks} />
      <LinkEditor title="Socials" hint="Where people find Juan." links={socials} onChange={setSocials} />

      <button
        onClick={() => run({ action: "site.update", patch: { palette: pal, options: opts, links, socials } })}
        className="w-full rounded-xl py-4 text-sm font-bold uppercase tracking-[0.2em]"
        style={{ background: "var(--t-primary)", color: "#fff" }}
      >
        Save the look
      </button>
    </>
  );
}

function LinkEditor({
  title, hint, links, onChange,
}: {
  title: string;
  hint: string;
  links: TylerLink[];
  onChange: (l: TylerLink[]) => void;
}) {
  const [service, setService] = useState("");
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const add = () => {
    if (!service.trim() || !url.trim()) return;
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      setProblem("That doesn't look like a full link — it should start with https://");
      return;
    }
    setProblem(null);
    onChange([...links, { service: service.trim(), url: url.trim() }]);
    setService("");
    setUrl("");
  };

  return (
    <Panel title={title} hint={hint}>
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-white/5 py-2 last:border-0">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{l.service}</span>
            <span className="block truncate text-[10px] text-white/30">{l.url}</span>
          </span>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="px-2 text-xs uppercase tracking-wider text-white/40">test</a>
          <button onClick={() => onChange(links.filter((_, k) => k !== i))} className="px-2 text-white/30 hover:text-red-400" aria-label="Remove">✕</button>
          <button onClick={() => { if (!i) return; const n = [...links]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}
                  disabled={i === 0} className="px-1 text-white/40 disabled:opacity-20" aria-label="Move up">↑</button>
        </div>
      ))}
      <Field label="Name" value={service} onChange={setService} placeholder="Spotify" />
      <Field label="Link" value={url} onChange={setUrl} placeholder="https://…" type="url" />
      {problem && <p className="text-xs text-red-300">{problem}</p>}
      <button onClick={add} className="w-full rounded-xl border border-dashed border-white/25 py-3 text-sm uppercase tracking-wider text-white/60">
        + Add link
      </button>
    </Panel>
  );
}
