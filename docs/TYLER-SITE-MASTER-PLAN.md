# tyler.x1c7.com — Juan's site · master plan

**2026-07-25.** Tyler Haze outgrows the guest slot. Everything Tyler moves off
`x1c7.com/music` onto **his own site**, handed to **Juan Gomez (jayodeed)** —
the owner's best friend since Ms. Dagnese's second-grade class — so *he* can
promote Tyler without asking anyone for anything. x1c7.com then goes back to
being **AGENOR / xsytrance**, keeping a loud, unmissable door to Tyler's page.

Owner's directive, verbatim scope:
> new page tyler.x1c7.com · move all of Tyler's stuff there · dynamic, a
> different track highlighted every refresh · a login Juan sets up himself ·
> tools to add songs, photos, music, marketing material, move things around,
> change colors, customize the shit out of it · mobile-friendly is the STAR,
> desktop still first-class · then convert x1c7 back to AGENOR/xsytrance with
> an unmissable link to Tyler · let Juan upload Suno stems + reach the Kinetica
> lab, the press kit, everything · and a "Coming Soon: zer0?!?!?" section with
> a *Here Comes A New Challenger* look.

---

## 0. The two decisions that shaped everything (owner, 2026-07-25)

1. **Juan's tools are PUBLIC + password-protected**, not tailnet-only. He edits
   from his phone, anywhere, no VPN — because he is not usually at a laptop.
   The heavy GPU work (Kinetica lab, stem processing, press renders) stays on
   Prime and he reaches it over the tailnet, which he's already a node on.
2. **The setup link is guarded by a one-time claim code.** Not distrust of Juan
   — protection from whoever else finds the URL first. Rod texts him the code;
   Juan picks his own username + password; the code burns; `/setup` closes
   forever.

```
        PUBLIC  (Vercel)                        TAILNET  (Prime)
  ────────────────────────────            ──────────────────────────
  tyler.x1c7.com          the site        kinetica lab   /engine
    /setup   claim once                   stem upload + mix
    /login   username + password          GPU art / reels
    /admin   Juan's whole toolkit         press kit render
      │                                          ▲
      ├── content ─→ Supabase                    │
      └── uploads ─→ R2                    one tap from /admin
                                           (only opens on tailnet)
```

---

## 1. North star

**The page is a poster, not a database.** It opens like a record sleeve: art,
a title you can read across a room, one track pulled to the front — *a
different one every refresh* — and a play button. Everything Juan does in the
admin panel is the poster rearranging itself. If it ever feels like a CMS to a
visitor, it's wrong.

Three audiences, in priority order:
1. **A stranger on a phone** who tapped a link in Juan's IG bio. Under 3
   seconds to sound. Thumb-reachable everything.
2. **Juan on his phone**, adding a song at 1am from bed.
3. **A blog / playlist curator on a laptop**, who needs the press kit and
   verified links without emailing anybody.

---

## 2. What "all of Tyler's stuff" is today

| thing | where it lives now | destination |
|---|---|---|
| Album facts, owner's message, verified links, palette | `src/data/tylerhaze.ts` | seeds the `tyler_site` + `tyler_tracks` rows, then the file retires to an archive comment |
| 13-track detail map (stories, heavy words, Suno art) | `TYLER_TRACK_DETAILS`, same file | `tyler_tracks` rows |
| The takeover hero | `src/app/music/TylerHazeHero.tsx` | rebuilt as the new site's hero; deleted from `/music` |
| `/music` OG share card | `src/app/music/opengraph-image.tsx` | moves to the Tyler site's own OG route; `/music` gets an AGENOR card |
| Site-wide palette swap | `src/app/globals.css` (Tyler edition) | **reverted** to house values, recorded in §7 |
| #MADETOBREAK full show | `/t/madetobreak` + R2 `tyler-haze/` | stays where it is; linked hard from the new site |
| Album art, backdrops, mixed audio | R2 `tyler-haze/**` | unchanged — the new site reads the same bucket |

**Nothing is deleted until the new page renders it.** Move, verify, then cut.

---

## 3. Architecture

### 3.1 One app, two faces
The Tyler site is **not** a second deployment. It's a route group in the same
Next app, selected by hostname in `src/proxy.ts` (Next 16's middleware):

- `tyler.x1c7.com/*` → rewrites to `/tyler/*`
- `x1c7.com/tyler/*` → the same pages, working **before DNS exists**

That second line matters: the whole site is testable and shippable the minute
it's built, and the subdomain is a DNS record Rod adds whenever he gets to it —
never a blocker. The owner gate in `proxy.ts` is untouched; the host rewrite
runs before it and shares the matcher.

### 3.2 Content lives in Supabase, not in the repo
New tables, all owned by the service role, all read publicly:

| table | holds |
|---|---|
| `tyler_site` | one row: the whole look — palette, hero copy, section order, toggles, socials, links |
| `tyler_tracks` | songs: title, art, audio, streaming links, story, heavy words, sort, featured-eligible, hidden |
| `tyler_media` | photos + marketing material: R2 key, kind (photo/press/flyer/stem), caption, alt text, sort |
| `tyler_admins` | Juan's credential row: username, scrypt hash, salt, created_at, last_login |
| `tyler_claims` | the one-time setup code: hash, used_at |

Reads: the public page uses the existing anon client (RLS: `select` allowed,
`insert/update/delete` denied — nobody writes with the anon key, ever).
Writes: **every** write goes through a Next API route that verifies Juan's
session cookie and then uses `supabaseAdmin` (service role, server-only).
There is no path from a browser to a write without a valid session.

### 3.3 Auth (custom, username-based — deliberately not Supabase Auth)
Juan asked for a *username*, and Supabase Auth is email-shaped. So:

- **Hashing**: `node:crypto` `scrypt` (N=16384, r=8, p=1, 32-byte key, 16-byte
  random salt) — no new dependency, correct by default.
- **Session**: an HttpOnly, Secure, SameSite=Lax cookie holding
  `juan.<expiry>.<HMAC-SHA256(SESSION_SECRET)>`. 30-day sliding expiry. No JWT
  library, nothing to keep patched.
- **Claim flow**: `/setup` accepts claim code + username + password (min 10
  chars, confirmed twice). On success: write `tyler_admins`, stamp
  `tyler_claims.used_at`, log him straight in. Every later visit to `/setup`
  redirects to `/login`.
- **Rate limiting**: 5 failed logins per IP per 15 min, in-memory per instance —
  enough friction for a site nobody is targeting, honest about what it is.
- **Account panel**: change username, change password, sign out everywhere.

### 3.4 Uploads
Browser → `POST /api/tyler/upload` (session-checked) → server signs an R2 PUT
with `aws4fetch` (the exact pattern in `src/lib/feed/r2.ts`) → browser PUTs the
file straight to R2 → server records the `tyler_media` row. Images are
downscaled client-side before upload (long edge 2400px) so a 12MP phone photo
doesn't cost Juan his data plan. Audio and stem ZIPs stream straight through.

---

## 4. The public page (mobile is the star)

Built mobile-first at 390px, then earned back up to desktop — not a desktop
page that survives a phone.

```
 MOBILE (the star)                 DESKTOP (no slacking)
 ┌─────────────────┐               ┌──────────────────────────────────┐
 │  ▓▓ album art ▓▓│               │  art  │  TYLER HAZE              │
 │   TYLER HAZE    │               │  ▓▓▓  │  the party left w/o me   │
 │  ▶ TONIGHT'S    │               │  ▓▓▓  │  ▶ TONIGHT'S TRACK ····  │
 │    TRACK        │               ├───────┴──────────────────────────┤
 │  [ LISTEN ]     │               │  tracklist grid   │  press/links │
 ├─────────────────┤               │                   │              │
 │  tracklist      │               │                   │              │
 │  (tap = play)   │               └──────────────────────────────────┘
 │  photos         │
 │  press / links  │               same data, different composition —
 │  ▓ zer0 ▓       │               never a scaled-down phone layout
 └─────────────────┘
```

- **Thumb zone**: play, streaming links and the menu all live in the bottom
  third on mobile. Nothing important above the notch.
- **Sound in 3 seconds**: the featured track's audio preloads `metadata` only;
  one tap plays. No autoplay, ever.
- **The rotating highlight**: on every load the page picks a different track
  from the featured-eligible pool, weighted so the last one shown can't repeat
  (a `sessionStorage` "last seen" nudge). It's a *server*-neutral pick made on
  the client after hydration, so Vercel's CDN cache still serves everyone the
  same HTML — no cache-busting, no cost.
- **Reduced motion + low-end devices** honored via the existing
  `PerformanceGate`.

---

## 5. Juan's toolkit (`/admin`)

Every panel is a phone-first card, reorderable by drag OR by up/down buttons
(drag alone is cruel on a phone).

| panel | what he can do |
|---|---|
| **Songs** | add / edit / delete; title, cover art, audio, Suno link, streaming links, story, heavy words; drag to reorder; toggle "can be tonight's track"; hide without deleting |
| **Photos** | upload from camera roll, caption, alt text, reorder, set one as the hero backdrop |
| **Marketing** | flyers, one-sheets, logos, press shots — same uploader, tagged; each gets a copyable public link for DMs |
| **Look** | 4 palette knobs with live preview on a real miniature of the page, plus 6 preset "editions" (incl. the album's own indigo/crimson/amber); font pairing; grain/scanline/particles on-off |
| **Layout** | reorder or hide whole sections (hero / tracks / photos / press / zer0) |
| **Links** | socials + streaming, each verified with a live check before it saves — **no fabricated links, ever** (the standing rule from the takeover doc) |
| **Lab** | tailnet-only tiles: Kinetica lab (`/engine`), stem upload + mix, press kit (`/press`), the #MADETOBREAK show. Each tile detects whether he's on the tailnet and says so plainly instead of failing |
| **Account** | change username / password, sign out |

**Stems**: Juan drops a Suno stem ZIP; it lands in R2 under
`tyler-haze/stems/<song>/`. When he's on the tailnet, the Lab tile offers "mix
+ onboard" which runs the existing `scripts/onboard-song.mjs` pipeline on Prime
— the same road #MADETOBREAK took. Off-tailnet the ZIP just waits.

---

## 6. Guardrails

- **Never fabricate a link.** Inherited verbatim from the takeover doc. The
  link editor verifies before it saves.
- **Juan cannot break the public page.** Every render path falls back: missing
  art → the gradient art generator already in `src/data/tracks.ts`; empty
  section → section hides itself; bad palette → house values.
- **The service role key never reaches a browser.** Server routes only.
- **Rod keeps a back door**: on the tailnet, `/tyler/admin` opens without a
  password (the existing `isOwnerRequest` gate), so a locked-out Juan is a
  30-second fix, not an incident.
- **Nothing about Juan's traffic is tracked** beyond what Vercel does by
  default. No analytics bolted on without him asking.

---

## 7. Converting x1c7.com back to AGENOR / xsytrance

1. **Palette revert** — `globals.css` back to the house values recorded in the
   file's own comment: `primary #ff2440 · secondary #43f7ff · accent #8dff4a ·
   bg #05030b`. (Tyler edition values move to the Tyler site's default row.)
2. **`/music`** — drop the `TylerHazeHero` import; the owner's collection
   (shelf / deck / jukebox) returns to the top, exactly as it was.
3. **OG card** — `/music` gets an AGENOR card again; Tyler's moves to his site.
4. **The unmissable door** (owner: "make sure people cant miss it"):
   - a **top bar on every page** — thin, always visible, "TYLER HAZE · THE
     PARTY LEFT WITHOUT ME · OUT NOW →", in the album's crimson so it reads as
     deliberately foreign to the AGENOR palette;
   - a **full promo block on `/music`** below the owner's collection — art,
     the proud-of-you message, streaming buttons, "ENTER TYLER'S WORLD →";
   - a **portal node** on the homepage constellation, since that's the site's
     own navigational language.

---

## 8. `Coming Soon: zer0?!?!?`

Chris — **zer0** — the third of Ms. Dagnese's second-graders, next to be
onboarded into the agent empire. Baker, cook, stoner, anime lifer (DBZ), gamer.
Runs a cupcake / donut / pastry business: **Pink's Desire**.

The look is **HERE COMES A NEW CHALLENGER** — the arcade cut-in, played
straight:

- The section **interrupts** the page: everything else desaturates, a black
  band slams in from both sides, and the text arrives letter-by-letter with
  that fighting-game shudder.
- A **chef's-hat silhouette** in a spotlight, filled with nothing — pure black
  against the glow, the classic unrevealed-fighter shape. A pink aura behind it
  (Pink's Desire), a faint scouter-glow arc across where the eye would be (the
  DBZ nod, subtle enough to be a wink not a costume).
- **VS-screen chrome**: a health bar that fills and never quite completes, a
  spinning "?!?!?", "CHALLENGER APPROACHING" in scanline type, an insert-coin
  blink.
- Copy: `COMING SOON — zer0?!?!?` / `PINK'S DESIRE` / `press start to continue`.
- It sits on **both** sites (Tyler's and AGENOR's) — this is a crew
  announcement, not one person's news.
- Respects `prefers-reduced-motion`: the slam becomes a fade, the shudder stops.

---

## 9. Build order (each phase ends shippable)

| # | phase | exit criterion |
|---|---|---|
| **1** | **Skeleton + data** — tables, RLS, seed from `tylerhaze.ts`, host routing | `x1c7.com/tyler` renders the album from Supabase; `/music` still untouched |
| **2** | **The public page** — mobile-first hero, rotating highlight, tracklist, photos, press, OG card | a stranger can hear a song in 3 taps on a phone; desktop composition is its own layout |
| **3** | **Auth** — `/setup` claim, `/login`, session, account panel, owner back door | Juan claims once with the code; a wrong code and a wrong password both fail cleanly |
| **4** | **The toolkit** — songs, photos, marketing, look, layout, links, uploads | Juan adds a song + a photo + changes the colors from a phone, and the public page shows it |
| **5** | **The lab bridge** — stem upload, tailnet tiles, Kinetica / press / show links | on-tailnet tiles open; off-tailnet they explain themselves instead of erroring |
| **6** | **AGENOR restoration** — palette revert, `/music` back, the unmissable door | x1c7.com is xsytrance's again, and Tyler is one obvious tap away from every page |
| **7** | **zer0** — the challenger cut-in on both sites | it makes you sit up, and it degrades gracefully with reduced motion |
| **8** | **Polish pass** — real-device rounds on Juan's actual phone, Lighthouse, press-kit check | nothing to apologize for when the link goes out |

---

## 10. What only Rod can do (the "when can I tell Juan" gate)

Three things I cannot do from here. **Phases 1–8 do not depend on them** — the
site works at `x1c7.com/tyler` the whole time — but the pretty URL and the live
admin panel do:

1. **DNS + Vercel domain** — add `tyler.x1c7.com` in the Vercel project, then a
   CNAME in Cloudflare pointing at Vercel (proxy OFF / DNS-only, same as apex).
   ~2 minutes.
2. **Vercel environment variables** — the public site has never needed any;
   Juan's toolkit needs four: `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `SESSION_SECRET`. All already exist in the local
   `.env`; they need to be pasted into the Vercel dashboard. Without them the
   public page still renders — only writing stops working.
3. **Text Juan the claim code** — printed once at the end of Phase 3, stored
   only as a hash.

**Tell Juan it's ready when Phase 4 is deployed and you've done 1–3.** Phases
5–8 can land while he's already using it; nothing after 4 changes his login or
his content.

---

## 11. Status log

- [x] Plan written (this file), after scouting the live repo
- [ ] Phase 1 — skeleton + data
- [ ] Phase 2 — the public page
- [ ] Phase 3 — auth
- [ ] Phase 4 — the toolkit  ← **the "tell Juan" line**
- [ ] Phase 5 — the lab bridge
- [ ] Phase 6 — AGENOR restoration
- [ ] Phase 7 — zer0
- [ ] Phase 8 — polish on Juan's real phone
