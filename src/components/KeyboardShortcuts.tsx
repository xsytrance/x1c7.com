"use client";

import { useEffect } from "react";

const PORTAL_ROUTES = ["/", "/music", "/projects", "/classified", "/art", "/war-room", "/level-ready", "/agents", "/notes"];

export function KeyboardShortcuts() {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Number keys 1-9 navigate portals
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= PORTAL_ROUTES.length) {
        const route = PORTAL_ROUTES[num - 1];
        if (window.location.pathname !== route) {
          window.location.href = route;
        }
        return;
      }

      // Escape: close overlays
      if (e.key === "Escape") {
        // Dispatch a custom event that overlays can listen to
        window.dispatchEvent(new CustomEvent("x1c7-close-overlay"));
        return;
      }

      // h or ?: toggle help
      if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("x1c7-toggle-help"));
        return;
      }

      // Arrow keys on homepage: already handled by PortalMap
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return null;
}
