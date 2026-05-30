"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

interface MagneticCardProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticCard({ children, className = "", strength = 0.15 }: MagneticCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    setTransform({ x, y });
  };

  const handleMouseLeave = () => {
    setTransform({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: transform.x, y: transform.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={className}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}
