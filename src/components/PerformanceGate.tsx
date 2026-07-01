"use client";

import { useEffect, useState } from "react";

export function PerformanceGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Particles run everywhere (ParticleField uses a lighter profile on phones).
    // Only truly low-end devices or an explicit reduced-motion preference skip them.
    const isLowEnd =
      navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isLowEnd || prefersReduced) {
      setShow(false);
      return;
    }

    setShow(true);
  }, []);

  return <>{show && children}</>;
}
