# Branding — the xsytrance / AGENOR identity kit

How the artist/label identity is expressed across x1c7.com. Deployed
2026-07-18 (commit `dcb2824`). Three names, one system:

- **x1c7** — the site / hub identity (the owner's creative command hub).
- **xsytrance** — the music artist name. Mark: the neon **✕**.
- **AGENOR** — the label / studio ("XSYVERSE Studios"). Mark: the gold "A"
  emblem. Ethos: *music without borders, vision without limits.*

## The source kit

Owner-authored art lives in `assets/art/xsytrance/` (**gitignored** — archived
to `X10 Pro/x1c7-source-assets/<date>/`, not in the repo). Inventory:

| Source | What it is |
|---|---|
| `xsytrance.png` | Square synthwave hero — DJ silhouette, galaxy, the ✕ mark |
| `xsytrance2/3.png` | Portrait rave shots (club lasers / beach wave), "xsytrance" on the headphones |
| `agenor-logo2.png` | Gold AGENOR emblem (monochrome, premium) — the primary logo/watermark |
| `agenor-logo.png` | Color AGENOR emblem |
| `xsy1.png` | "VG GOD / One World Many Sounds" global hip-hop collage |
| `xsy3.png` | "X1C7 / BUILD THE SYSTEM" personal-identity collage |
| `xsy-suno.png` | Wide green "SUNO / UNLOCK ME" profile banner |

## Asset pipeline

Source PNGs are 2–3 MB each — **never shipped raw**. They're optimized to webp
in `public/brand/` (served at `/brand/*.webp`), 24–343 KB each. To regenerate
after a new drop:

```js
// sharp: resize + webp q82. hero/logos ~1000–1200px, portraits ~900px,
// banner ~1600px, plus agenor-gold-sm (320px) for inline marks.
sharp(src).resize(w).webp({ quality: 82 }).toFile(`public/brand/${out}`)
```

Then re-archive the source PNGs to the X10 drive (they stay gitignored).

## Where each mark lives (the 5 surfaces)

| Surface | Asset | File |
|---|---|---|
| **Favicon** (site-wide) | neon ✕ (authored SVG, elevates x1c7's "x") | `src/app/icon.svg` |
| **`/music` hero band** | `hero.webp` + `agenor-gold-sm.webp` | `src/components/XsytranceBand.tsx` (placed after the HERO section in `music/page.tsx`) |
| **Footer watermark** (site-wide) | `agenor-gold-sm.webp` | `src/components/Footer.tsx` (bottom bar) |
| **Homepage identity** | `identity-x1c7.webp` (xsy3) | `src/components/IdentityBand.tsx` (between HomeShowcase and Signal) |
| **`/music` shows backdrop** | `rave-club.webp` | `music/page.tsx` Kinetica section (ambient, opacity-45 under a dark gradient) |

Unused-but-ready: `rave-beach.webp`, `agenor-color.webp`, `identity-vggod.webp`
(xsy1), `suno-banner.webp` — available for future surfaces.

## Conventions

- Gold for AGENOR chrome is `#e8c766`; the ✕ neon runs magenta→purple→cyan
  (`#ff3df0 → #a855f7 → #43f7ff`), matching `icon.svg`.
- Images use plain `<img loading="lazy">` (repo convention; `<img>` eslint
  warnings are expected and don't fail `next build`).
- Keep x1c7 the hub identity, xsytrance the music, AGENOR the studio — don't
  collapse them into one.
