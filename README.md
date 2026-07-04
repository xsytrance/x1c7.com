# x1c7.com

Creative command hub for music, AI, projects, agents, and experiments.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Vercel

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Quality checks

```bash
npm run lint
npm run build
```

## Deploy to Vercel

1. Import `xsytrance/x1c7.com` into Vercel
2. Framework preset: **Next.js**
3. Build command: `npm run build`
4. Add domain `x1c7.com` in Vercel settings
5. In Cloudflare DNS, point apex/root to Vercel

No environment variables required.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Portal map homepage with interactive node constellation |
| `/music` | Music transmission deck (Suno, SoundCloud, PulseBox) |
| `/projects` | Terminal file browser with fake commands |
| `/classified` | Interactive fake terminal with konami easter egg |
| `/art` | Gallery wall with generative CSS art frames |
| `/war-room` | Tactical dashboard with live clock and radar |
| `/level-ready` | Gamified service tiers (Setup / Automate / Scale) |
| `/agents` | Agent roster with character cards and silhouettes |
| `/notes` | Field journal with tilted notebook entries |
| `/galaxy` | The catalog as a universe — every song a planet |
| `/lexicon` | The word-database browser — every word a sub-planet of effect "legos" |
| `/vr` | WebXR lyric world (Quest 3) |

## Lyric engine: effects & the Lexicon

The lyric show's atmosphere (weather, veils, surface grime) is built from reusable
**effect "legos"** organized by _physics class_, catalogued in `src/lib/effects/registry.ts`.
Separately, every word from every song is harvested into a shared, growing **Lexicon**
(`src/data/lexicon.json`) — a shelf of vibes, palettes, imagery, and effects that will
eventually let a lyric video be built without an LLM.

Grow the shelf:

```bash
node scripts/lexicon/harvest.mjs     # seed/merge words from analyzed songs
node scripts/lexicon/dream.mjs       # the "dream loop" — fill legos on a priority queue
```

Full write-up: [`docs/EFFECTS-AND-LEXICON.md`](docs/EFFECTS-AND-LEXICON.md).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`–`9` | Jump to portal |
| `↑↓←→` | Navigate portal map |
| `Enter` | Open selected portal |
| `?` | Show keyboard help |
| `Esc` | Close overlay |

Press `?` on any page to see the full shortcut map.

## Shared Atmospheric Layer

Every page includes:
- **ParticleField** — Canvas 2D particle constellation, mouse-reactive
- **NoiseOverlay** — Subtle analog grain texture
- **CustomCursor** — Glowing cyan dot (desktop only)
- **Scanline** — Horizontal scanline overlay
- **Starfield** — Drifting dot background
- **Vignette** — Subtle edge darkening
- **BootSequence** — First-visit terminal boot (skippable)

## Component Inventory

| Component | Purpose |
|-----------|---------|
| `PortalMap` | Interactive orbiting portal node map |
| `MobileNav` | Hamburger menu for mobile |
| `BackToHub` | xsy-branded back navigation |
| `StatusChip` | live/forming/locked badge |
| `SignalPanel` | Glass card with accent glow |
| `AudioVisualizer` | CSS animated equalizer bars |
| `TerminalLock` | Fake terminal with konami easter egg |
| `ParticleField` | Canvas 2D particle constellation |
| `TextScramble` | Glyph decode effect for titles |
| `CustomCursor` | Glowing dot with hover expansion |
| `NoiseOverlay` | Analog grain texture |
| `PortalConnections` | SVG lines linking CORE to portals |
| `ScrollReveal` | Scroll-triggered fade-in |
| `BootSequence` | First-visit boot animation |
| `Vignette` | Edge darkening overlay |
| `KeyboardShortcuts` | Global keyboard shortcut handler |
| `KeyboardHelp` | Shortcut help overlay |
| `PerformanceGate` | Conditional rendering for low-end devices |

## Data Files

- `src/data/portals.ts` — Portal definitions
- `src/data/tracks.ts` — Music tracks and sources

## Security

- No private URLs or API keys committed
- `/classified` is cosmetic — no real auth or sensitive data
- No backend, database, or auth system
