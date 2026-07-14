"use client";

import { useState } from "react";
import Link from "next/link";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { portals } from "@/data/portals";

const navLinks = [{ label: "Hub", href: "/" }, ...portals.map((p) => ({ label: p.title, href: `/${p.slug}` }))];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-void/70 backdrop-blur sm:hidden"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
      >
        <m.span
          animate={open ? { rotate: 45, y: 5.5 } : { rotate: 0, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className="block h-[2px] w-5 bg-white/80"
        />
        <m.span
          animate={open ? { opacity: 0 } : { opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className="block h-[2px] w-5 bg-white/80"
        />
        <m.span
          animate={open ? { rotate: -45, y: -5.5 } : { rotate: 0, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className="block h-[2px] w-5 bg-white/80"
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.nav
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[72px] z-40 mx-4 overflow-hidden rounded-2xl border border-white/10 bg-void/95 shadow-2xl backdrop-blur-xl sm:hidden"
          >
            <ul className="grid gap-1 p-3">
              {navLinks.map((link, i) => (
                <m.li
                  key={link.href}
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {link.label}
                  </Link>
                </m.li>
              ))}
            </ul>
          </m.nav>
        )}
      </AnimatePresence>
    </>
  );
}
