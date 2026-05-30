"use client";

import { useState, useCallback } from "react";
import { BootSequence } from "./BootSequence";
import { Vignette } from "./Vignette";

export function BootSequenceWrapper({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);

  const handleComplete = useCallback(() => {
    setBooted(true);
  }, []);

  return (
    <>
      {!booted && <BootSequence onComplete={handleComplete} />}
      {children}
      <Vignette />
    </>
  );
}
