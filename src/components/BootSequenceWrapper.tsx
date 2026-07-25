"use client";

import { useState, useCallback } from "react";
import { BootSequence } from "./BootSequence";
import { Vignette } from "./Vignette";
import { useIsTylerSite } from "./X1c7Chrome";

export function BootSequenceWrapper({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);
  // Tyler's site never boots into a terminal — a stranger who tapped a link in
  // Juan's bio wants the song, not x1c7's front door. (Children still render;
  // only the boot + vignette belong to x1c7.)
  const tyler = useIsTylerSite();

  const handleComplete = useCallback(() => {
    setBooted(true);
  }, []);

  if (tyler) return <>{children}</>;

  return (
    <>
      {!booted && <BootSequence onComplete={handleComplete} />}
      {children}
      <Vignette />
    </>
  );
}
