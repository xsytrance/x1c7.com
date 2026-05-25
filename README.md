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

No environment variables are required for version one.

## Routes

- `/` living portal map homepage
- `/music`
- `/level-ready`
- `/war-room`
- `/art`
- `/projects`
- `/notes`
- `/agents`
- `/classified`

## Security

- Do not commit `.env`, `.env*.local`, `.vercel`, tokens, PATs, or credentials.
- This version exposes no private internal URLs and does not require API keys.
