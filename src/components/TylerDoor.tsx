"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// THE DOOR TO TYLER — owner's ask, 2026-07-25: "leave room to promote Tyler
// and take people to Tyler's page… add a link at the top of the page
// somewhere; just make sure people can't miss it."
//
// A thin bar across the very top of every x1c7 page, in the ALBUM's crimson —
// deliberately foreign to the house palette, so the eye reads it as a guest
// notice rather than site furniture. Dismissible, because an ad you can't
// close is an ad people learn to hate; the dismissal lasts a week and the
// /music promo block carries the message for anyone who closed it.
// ═══════════════════════════════════════════════════════════════════════════

const CRIMSON = "#d9342b";
const AMBER = "#ffb45c";
const KEY = "x1c7:tyler-door";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function TylerDoor() {
  const path = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(KEY) ?? 0);
      setShow(Date.now() > until);
    } catch {
      setShow(true);
    }
  }, []);

  // Never on Tyler's own site — you're already there.
  if (!show || path?.startsWith("/tyler")) return null;

  return (
    <div
      className="relative z-[60] w-full"
      style={{ background: `linear-gradient(90deg, ${CRIMSON}, #7c8cff)`, paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 md:px-6">
        <Link href="/tyler" className="group flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <span
            className="hidden shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest sm:inline"
            style={{ background: "rgba(0,0,0,0.35)", color: AMBER }}
          >
            out now
          </span>
          <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-white md:text-xs md:tracking-[0.2em]">
            Tyler Haze — The Party Left Without Me
          </span>
          <span className="shrink-0 text-[11px] font-bold text-white/85 transition-transform group-hover:translate-x-1 md:text-xs">
            enter →
          </span>
        </Link>
        <button
          onClick={() => {
            try {
              localStorage.setItem(KEY, String(Date.now() + WEEK));
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
          aria-label="Hide this for a week"
          className="shrink-0 px-1 text-sm leading-none text-white/60 transition-colors hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
