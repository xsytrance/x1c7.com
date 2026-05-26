# x1c7.com

Creative command hub for music, AI, projects, agents, and experiments.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Vercel-ready static/public frontend

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

## Deploy notes for Vercel

1. Import this GitHub repo into Vercel.
2. Framework preset: **Next.js**.
3. Build command: `npm run build`.
4. Output settings: leave default.
5. Add domain `x1c7.com` in Vercel project settings.
6. In Cloudflare DNS, point the apex/root domain according to Vercel's instructions. Keep Cloudflare as DNS/security layer.

No environment variables are required.

## Routes

- `/` — Living portal map homepage (hero + portal map + signal section + footer)
- `/music` — Music transmission receiver (Suno, SoundCloud, PulseBox, visualizer)
- `/projects` — Project constellation placeholder (Phase 2D planned)
- `/classified` — Interactive terminal easter egg (fake lock, konami code)
- `/art`, `/war-room`, `/level-ready`, `/agents`, `/notes` — Placeholder portals

## Content Model

- `src/data/portals.ts` — Portal definitions (used by PortalMap)
- `src/data/tracks.ts` — Track and music source definitions (used by /music)

## Component Inventory

- `PortalMap.tsx` — Interactive orbiting portal node map (homepage)
- `MobileNav.tsx` — Hamburger menu for mobile
- `BackToHub.tsx` — xsy-branded back navigation
- `StatusChip.tsx` — live/forming/locked badge
- `SignalPanel.tsx` — Glass card with accent glow
- `AudioVisualizer.tsx` — CSS animated equalizer bars
- `TerminalLock.tsx` — Interactive fake terminal (typed text, konami easter egg)

## Security

- Do not commit `.env`, `.env*.local`, `.vercel`, tokens, PATs, or credentials.
- This site exposes no private internal URLs and does not require API keys.
- The /classified page is purely cosmetic — no real auth, no sensitive data.
