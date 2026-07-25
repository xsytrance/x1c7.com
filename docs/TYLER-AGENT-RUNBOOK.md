# tyler.x1c7.com — agent runbook

**For whoever picks this up next.** Everything needed to finish Juan's site and
hand him the keys. Written 2026-07-25, immediately after the build session that
shipped phases 1–7 (see `TYLER-SITE-MASTER-PLAN.md` for the why; this file is
the how).

Work top to bottom. Each step says how to prove it worked before moving on.

---

## 0. Where you're starting from

- **Repo**: `~/Hermes/x1c7.com` (Next 16 App Router, deploys to Vercel from
  `main` on GitHub `xsytrance/x1c7.com`).
- **HEAD**: `14d720d` — pushed, so Vercel has already built it.
- **Two commits** did all of it: `521503d` (the site) and `14d720d` (plan
  status).
- **Supabase** project `kxbrjmbovjiwwcnepsfh` ("x1c7") already has the five
  `tyler_*` tables, RLS policies, and the seeded content: 13 tracks, 8 verified
  links, 12 gallery images.
- **Nobody has claimed the site yet** — `tyler_admins` and `tyler_claims` are
  both empty on purpose, so Juan's setup is the first one that ever happens.

⚠️ **The working tree was already dirty before this work started** (song-analysis
profiles, `scripts/perf/render-cut.mjs`, `docs/VIDEO-RENDER-PLAYBOOK.md` and
friends — Rod's own in-progress changes). **Do not `git add -A`.** Stage only
files you touched, by name.

---

## 1. Confirm the deploy landed

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://x1c7.com/tyler
curl -s https://x1c7.com/tyler | grep -o "The Party Left Without Me" | head -1
```

Expect `200` and the album title. If it 404s, the Vercel build failed — check
the deployment log in the Vercel dashboard before touching anything else.

Also confirm x1c7 itself came back to AGENOR:

```bash
curl -s https://x1c7.com/music | grep -c "friend of the house"   # 1 = promo block present
curl -s https://x1c7.com/music | grep -c "TylerHazeHero"         # 0 = old takeover gone
```

---

## 2. Vercel environment variables (blocks Juan's tools)

Until these exist, the public page renders fine but **every save fails**. The
public site never needed env vars before; Juan's toolkit needs four.

| Vercel env var | value lives in |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `~/Hermes/x1c7.com/.env` |
| `ACCESS_KEY_ID` | same file (R2) |
| `SECRET_ACCESS_KEY` | same file (R2) |
| `SESSION_SECRET` | same file |

Also copy `ENDPOINT`, `BUCKET` and `PUBLIC_URL` if they aren't already set —
`src/lib/feed/r2.ts` falls back to sane defaults for the last two but not for
`ENDPOINT`, and without it uploads throw "R2 not configured".

**Handling the secrets**: read them with `grep '^NAME=' .env`, paste into the
Vercel dashboard (Project → Settings → Environment Variables → Production +
Preview). **Never echo a value into a chat transcript, a commit, a log file, or
a screenshot.** If you're driving the browser, do not screenshot the page while
a value is visible.

Redeploy after adding them (Vercel does not apply env changes to an existing
build): Deployments → latest → ⋯ → Redeploy.

**Prove it**: from a machine that is *not* on the tailnet,
`curl -s https://tyler.x1c7.com/api/tyler/session` should return
`{"ok":true,"claimed":false,...}`. A 500 means an env var is missing.

---

## 3. Domain: tyler.x1c7.com

1. **Vercel** → project → Settings → Domains → Add `tyler.x1c7.com`. Vercel
   will show the DNS record it wants (a CNAME to `cname.vercel-dns.com`).
2. **Cloudflare** → the `x1c7.com` zone → DNS → add that CNAME.
   **Proxy status must be DNS-only (grey cloud)**, matching how the apex is set
   up. Orange-cloud proxying in front of Vercel breaks the deployment check and
   can double-cache the admin routes.
3. Wait for Vercel to show "Valid Configuration".

The host rewrite is already written (`src/proxy.ts` → `isTylerHost`), so nothing
in the code changes when DNS lands.

**Prove it**:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tyler.x1c7.com
curl -s https://tyler.x1c7.com | grep -o "The Party Left Without Me" | head -1
```

---

## 4. Hand Juan his key

```bash
cd ~/Hermes/x1c7.com
node scripts/tyler/claim-code.mjs
```

It prints a code like `HDW7-RTX6-EC23` **once** and stores only the SHA-256.
Give the code and the link to **Rod**, who sends it to Juan:

> https://tyler.x1c7.com/setup — code above. Pick your own username and
> password; the link stops working after you use it.

Do not post the code anywhere it persists.

If Juan later loses the password: Rod opens `/tyler/admin` **from the tailnet**
(no password needed there — `isOwnerRequest`) → Account → set a new one.
Re-running `claim-code.mjs` after the site is claimed refuses on purpose.

---

## 5. What's still unbuilt

In rough priority order. All of it is additive — nothing here blocks Juan.

### 5.1 Homepage portal node (§7 of the master plan)
The site's own navigational language is the constellation on `/`. Tyler has a
top bar and a `/music` block but no node.
- Data: `src/data/portals.ts` — add an entry pointing at `/tyler`.
- Give it the album crimson `#d9342b` so it reads as a guest, matching
  `src/components/TylerDoor.tsx`.
- Check the keyboard shortcut map still lines up (`1`–`9` jump to portals,
  `src/components/KeyboardShortcuts.tsx`).

### 5.2 OG share cards
- `src/app/music/opengraph-image.tsx` still renders the **Tyler takeover** card
  and imports `@/data/tylerhaze`. It should go back to an AGENOR/Collection
  card.
- Tyler needs his own: add `src/app/tyler/opengraph-image.tsx`, reading from
  `getTylerSite()` so it follows whatever Juan sets — album art left, artist +
  album + tagline right. Mirror the structure of the file you're replacing.
- Verify with the Facebook/X card debuggers, or just fetch the route and check
  it returns a PNG.

### 5.3 In-page audio
`tyler_tracks.audio_url` exists, the admin field exists, the hero's play button
currently links out to streaming instead of playing.
- Upload per-track audio (admin → Photos tab → the uploader takes any file;
  or reuse the existing R2 `tyler-haze/` objects).
- Then add a small player to `src/app/tyler/TylerHero.tsx`: `<audio>` with
  `preload="metadata"`, one tap to play, **never autoplay**.
- The master plan's promise is "a stranger hears a song within 3 taps" — this
  is the piece that makes it one tap.

### 5.4 Press kit link-through
`LabTab` links `/press`, which is the owner's generator. Decide whether Juan
gets a Tyler-scoped press kit (probably: a one-sheet built from `tyler_site` +
`tyler_tracks`) or just uploads PDFs under `kind: "press"` (works today).

### 5.5 Real-device rounds
Nothing has been on Juan's actual phone. Watch specifically for: the fixed nav
over the notch, the photo filmstrip's snap feel, whether the admin tab bar is
reachable one-handed, and iOS Safari's treatment of `env(safe-area-inset-*)`
(the root layout sets `viewportFit: "cover"`, which is what makes those
non-zero — don't remove it).

---

## 6. Working in this repo without tripping

Commands that matter:

```bash
npx tsc --noEmit                       # typecheck
npx eslint <paths> --max-warnings=0    # the repo runs zero-warning
npx next build                         # the real gate
node scripts/tyler/seed.mjs            # dry run; --apply to write
```

Traps this session actually hit — all of them cost real time:

1. **`next start` caches the route manifest at boot.** Add an API route,
   rebuild, and the *running* server still 404s it. Restart the server.
2. **`pkill -f "next start"` kills your own shell** — the pattern matches the
   bash command line running it. Kill by PID from `ss -ltnp` instead.
3. **There are other long-running `next-server` processes on this box** that
   are Rod's, not yours. Never blanket-kill node/next.
4. **localhost counts as the owner.** `isOwnerRequest` treats
   localhost/`prime`/`*.ts.net`/`100.64/10` as the tailnet, so a local curl is
   always authenticated. To test the public path, send a public Host header:
   `curl -H 'Host: tyler.x1c7.com' ...`.
5. **The service role key must never reach a browser.** `supabaseAdmin()` is
   server-only; if you find yourself importing it into a `"use client"` file,
   the design is wrong — add a route to `/api/tyler/content` instead.
6. **Writes are allowlisted per column** (`WRITABLE` in
   `src/app/api/tyler/content/route.ts`). A new admin field needs its column
   added there or the save silently does nothing.
7. **Juan must never be able to break the public page.** `normalizeSite()` in
   `src/lib/tyler/types.ts` is what guarantees that. Extend it when you add a
   field.
8. **Never fabricate a streaming link.** Inherited from the takeover doc and
   still binding: only URLs that have been fetched and confirmed ship.

Where things are:

```
src/app/tyler/            the public site + setup/login/admin pages
src/app/api/tyler/        session (auth), content (writes), upload (R2)
src/lib/tyler/            types + normalizer, public reads, auth
src/components/ZeroChallenger.tsx   the zer0 cut-in (both sites)
src/components/TylerDoor.tsx        the top bar on every x1c7 page
src/components/TylerPromo.tsx       the /music guest block
src/components/X1c7Chrome.tsx       switches x1c7's furniture off on /tyler
src/proxy.ts              host rewrite + the owner gate
scripts/tyler/            seed.mjs, claim-code.mjs
```

---

## 7. Final checklist before telling Juan

- [ ] `https://tyler.x1c7.com` returns 200 and shows the album
- [ ] Refreshing it three times highlights different tracks
- [ ] `https://tyler.x1c7.com/setup` shows the code form
- [ ] `GET /api/tyler/session` returns JSON, not a 500 (env vars are set)
- [ ] From a phone off the tailnet: writes are refused without a login —
      `curl -X POST https://tyler.x1c7.com/api/tyler/content -d '{}'` → 401
- [ ] `https://x1c7.com` shows the AGENOR palette and the Tyler bar on top
- [ ] `https://x1c7.com/music` leads with The Collection, promo block below
- [ ] The claim code has been generated and given to Rod
- [ ] Rod has NOT posted the code anywhere it persists

---

## 8. Rolling back

Everything is two commits. To undo the whole thing:

```bash
git revert --no-commit 14d720d 521503d && git commit -m "Revert the Tyler site"
git push origin main
```

The Supabase tables are additive — nothing was dropped or altered — so a revert
leaves five unused `tyler_*` tables and no damage. To undo the site's *content*
move without reverting code, the archived source of truth is still
`src/data/tylerhaze.ts`; `scripts/tyler/seed.mjs --apply` re-seeds from it and is
idempotent.
