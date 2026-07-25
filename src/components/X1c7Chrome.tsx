"use client";

import { usePathname } from "next/navigation";
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
  const path = usePathname();
  if (path?.startsWith("/tyler")) return null;
  return <>{children}</>;
}

/** True while rendering anywhere under Tyler's site. */
export function useIsTylerSite(): boolean {
  const path = usePathname();
  return !!path?.startsWith("/tyler");
}
