"use client";

import { useEffect, useRef } from "react";
import { themeStore } from "@/lib/themeStore";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tier: 0 | 1 | 2; // index into the live [primary, secondary, accent] palette
  alpha: number;
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    // Initialize particles
    const count = Math.min(80, Math.floor((w * h) / 15000));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * (prefersReducedMotion ? 0.1 : 0.4),
      vy: (Math.random() - 0.5) * (prefersReducedMotion ? 0.1 : 0.4),
      radius: Math.random() * 1.5 + 0.5,
      tier: Math.floor(Math.random() * 3) as 0 | 1 | 2,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    window.addEventListener("resize", resize);

    const connectDistance = 120;
    const mouseRadius = 150;

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const { theme, beat } = themeStore.get();
      const palette = [theme.primary, theme.secondary, theme.accent] as const;
      const beatScale = 1 + beat * 0.9; // radius swells on the beat

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const color = palette[p.tier];

        // Mouse interaction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouseRadius) {
          const force = (mouseRadius - dist) / mouseRadius;
          p.vx -= (dx / dist) * force * 0.02;
          p.vy -= (dy / dist) * force * 0.02;
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Damping
        p.vx *= 0.999;
        p.vy *= 0.999;

        // Wrap around edges
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * beatScale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.min(1, p.alpha * (1 + beat * 0.5));
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const cdx = p.x - p2.x;
          const cdy = p.y - p2.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < connectDistance) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = color;
            ctx.globalAlpha = (1 - cdist / connectDistance) * 0.15;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{ opacity: 0.6 }}
      aria-hidden="true"
    />
  );
}
