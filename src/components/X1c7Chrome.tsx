"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * tyler.x1c7.com is Juan's site, not a page of x1c7 — so x1c7's own furniture
 * (the terminal boot, the footer, the particle field, the music bar, the
 * konami eggs, the custom cursor) stays home. Everything in the root layout's
 * chrome is a client component, so one pathname check switches the whole
 * shell off without touching the layout's static rendering.
 *
 * Wrap chrome, never content: children of this component simply do not exist
 * on Tyler's side of the house.
 */
export function X1c7Chrome({ children }: { children: ReactNode }) {
  if (useIsTylerSite()) return null;
  // The class is the belt to this hook's suspenders — see globals.css. The
  // wrapper is inert: everything inside is fixed-position overlay furniture.
  return <div className="x1c7-chrome">{children}</div>;
}

/**
 * True while rendering anywhere under Tyler's site.
 *
 * TWO checks, because the path alone is a lie on the subdomain: the rewrite in
 * `src/proxy.ts` is INTERNAL, so on tyler.x1c7.com `usePathname()` reports the
 * external "/" and never "/tyler". Testing only at x1c7.com/tyler hid that
 * completely — x1c7's whole chrome shipped on Juan's site, sound layer and
 * all, sitting on top of his nav.
 *
 * The hostname is only knowable after mount, which would leave a frame of
 * x1c7 furniture on his site; `body:has(.tyler-root) .x1c7-chrome` in
 * globals.css covers that first frame with no JS at all.
 */
export function useIsTylerSite(): boolean {
  const path = usePathname();
  const [tylerHost, setTylerHost] = useState(false);
  useEffect(() => setTylerHost(window.location.hostname.startsWith("tyler.")), []);
  return !!path?.startsWith("/tyler") || tylerHost;
}
