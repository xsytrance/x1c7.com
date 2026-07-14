"use client";
// LazyMotion bundle shed: every framer-motion usage in the app goes through
// the mini `m` component (see the site-wide motion→m codemod), so only the
// domAnimation feature set ships instead of the full motion runtime. This
// lives in a client component because the feature bundle (functions) can't
// cross the server→client prop boundary from layout.tsx.
// strict={false}: any straggler `motion.*` usage keeps working (it just pulls
// its own features) instead of throwing.
import { LazyMotion, domAnimation } from "framer-motion";

export function LazyMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict={false}>
      {children}
    </LazyMotion>
  );
}
