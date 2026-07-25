"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * THE WAY IN — and the fix for shipping a login nobody could find.
 *
 * The first build put a 10px "manage" link in the footer and called it done.
 * The owner's actual ask was "a click-here-to-setup-your-login", so this is
 * that, and it changes shape with the site's state:
 *
 *   nobody has claimed it yet  → a full card, impossible to miss. This state
 *                                ends forever the moment Juan claims, so it
 *                                costs a visitor nothing.
 *   claimed, signed out        → a quiet "Sign in" in the footer.
 *   signed in                  → "Manage the site".
 *
 * The claimed check is a client fetch on purpose: `tyler_admins` is invisible
 * to the public key (no RLS policy at all), and asking on the server would
 * make the whole page dynamic for every stranger just to answer a question
 * that matters to one person.
 */
export function SignInDoor({ variant }: { variant: "invite" | "link" }) {
  const [state, setState] = useState<{ claimed: boolean; username: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/tyler/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && j?.ok && setState({ claimed: !!j.claimed, username: j.username ?? null }))
      .catch(() => {
        /* the page is a poster first — a failed check just hides the door */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  // Each placement renders in exactly one state, so the two never both appear:
  // the invitation only while unclaimed, the footer link only after.
  if (variant === "invite" && state.claimed) return null;
  if (variant === "link" && !state.claimed) return null;

  // ── Unclaimed: the one-time invitation ──────────────────────────────────
  if (!state.claimed) {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-2 pt-20 md:px-8 md:pt-24">
        <div
          className="rounded-2xl border p-6 text-center md:p-8"
          style={{
            borderColor: "color-mix(in srgb, var(--t-primary) 45%, transparent)",
            background: "color-mix(in srgb, var(--t-primary) 10%, transparent)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--t-secondary)" }}>
            for Juan
          </p>
          <h2 className="mt-2 text-3xl leading-none md:text-4xl" style={{ fontFamily: "var(--t-display)" }}>
            This site is yours
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
            Set up your login and you can add songs and photos, change the colors, move things
            around — all from your phone. You&rsquo;ll need the code Rod sent you.
          </p>
          <Link
            href="/tyler/setup"
            className="mt-6 inline-block rounded-full px-7 py-4 text-sm font-bold uppercase tracking-[0.18em] transition-transform active:scale-95"
            style={{ background: "var(--t-primary)", color: "#fff" }}
          >
            Click here to set up your login →
          </Link>
        </div>
      </section>
    );
  }

  // ── Claimed: a quiet door, in the footer ────────────────────────────────
  return (
    <Link
      href={state.username ? "/tyler/admin" : "/tyler/login"}
      className="transition-colors hover:text-white/70"
    >
      {state.username ? "manage the site" : "sign in"}
    </Link>
  );
}
