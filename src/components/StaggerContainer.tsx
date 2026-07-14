"use client";

import { m, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.08,
  direction = "up",
}: StaggerContainerProps) {
  const reduceMotion = useReducedMotion();

  const offsets = {
    up: { y: 30 },
    down: { y: -30 },
    left: { x: 30 },
    right: { x: -30 },
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  const itemVariants = {
    hidden: reduceMotion ? {} : { opacity: 0, ...offsets[direction] },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className={className}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <m.div key={i} variants={itemVariants}>
              {child}
            </m.div>
          ))
        : children}
    </m.div>
  );
}
