"use client";

import { useEffect, useState } from "react";

export function PerformanceGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check for low-end device indicators
    const isLowEnd =
      navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4;
    const isMobile = window.innerWidth < 768;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Skip particles on low-end mobile
    if ((isLowEnd && isMobile) || prefersReduced) {
      setShow(false);
      return;
    }

    setShow(true);
  }, []);

  return <>{show && children}</>;
}
