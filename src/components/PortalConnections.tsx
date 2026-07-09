"use client";

import { useReducedMotion } from "framer-motion";

interface ConnectionLine {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  color: string;
}

const connections: ConnectionLine[] = [
  { x1: "50%", y1: "41%", x2: "50%", y2: "8%", color: "#ff2440" },
  { x1: "50%", y1: "41%", x2: "78%", y2: "23%", color: "#8dff4a" },
  { x1: "50%", y1: "41%", x2: "82%", y2: "56%", color: "#43f7ff" },
  { x1: "50%", y1: "41%", x2: "64%", y2: "78%", color: "#ff9b3d" },
  { x1: "50%", y1: "41%", x2: "36%", y2: "78%", color: "#7c3cff" },
  { x1: "50%", y1: "41%", x2: "18%", y2: "56%", color: "#f5ff6b" },
  { x1: "50%", y1: "41%", x2: "22%", y2: "23%", color: "#00ffa8" },
  { x1: "50%", y1: "41%", x2: "50%", y2: "91%", color: "#ff3b3b" },
];

export function PortalConnections({ activeIndex }: { activeIndex: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] hidden md:block"
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      {connections.map((conn, i) => {
        const isActive = i === activeIndex;
        return (
          <line
            key={i}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke={conn.color}
            strokeWidth={isActive ? 2 : 0.5}
            opacity={isActive ? 0.6 : 0.15}
            strokeDasharray={isActive ? "none" : "4 4"}
            style={
              !reduceMotion && isActive
                ? {
                    filter: `drop-shadow(0 0 6px ${conn.color})`,
                    transition: "all 0.4s ease",
                  }
                : { transition: "all 0.4s ease" }
            }
          />
        );
      })}
    </svg>
  );
}
