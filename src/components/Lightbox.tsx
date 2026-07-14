"use client";

import { useEffect, useCallback, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";

/* offsets (relative to the active piece) whose images get preloaded */
const PRELOAD_RANGE = [-1, 0, 1];

export interface ArtPiece {
  id: string;
  title: string;
  category: string;
  src: string;
  description: string;
  accent: string;
}

interface LightboxProps {
  pieces: ArtPiece[];
  activeIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({
  pieces,
  activeIndex,
  isOpen,
  onClose,
  onNavigate,
}: LightboxProps) {
  const reduceMotion = useReducedMotion();
  const activePiece = pieces[activeIndex];

  /* preload adjacent images */
  const [preloaded, setPreloaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    const toLoad = PRELOAD_RANGE
      .map((o) => {
        const idx = activeIndex + o;
        if (idx >= 0 && idx < pieces.length) return pieces[idx].src;
        return null;
      })
      .filter(Boolean) as string[];

    toLoad.forEach((src) => {
      if (preloaded.has(src)) return;
      const img = new window.Image();
      img.src = src;
      setPreloaded((prev) => new Set(prev).add(src));
    });
  }, [activeIndex, isOpen, pieces, preloaded]);

  /* keyboard navigation */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        onNavigate(activeIndex > 0 ? activeIndex - 1 : pieces.length - 1);
      }
      if (e.key === "ArrowRight") {
        onNavigate(activeIndex < pieces.length - 1 ? activeIndex + 1 : 0);
      }
    },
    [activeIndex, onClose, onNavigate, pieces.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!activePiece) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        >
          {/* Dark overlay — click outside to close */}
          <m.div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close lightbox"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 z-10 font-mono text-xs uppercase tracking-[0.2em] text-white/50">
            {activeIndex + 1} <span className="text-white/25">/</span>{" "}
            {pieces.length}
          </div>

          {/* Prev arrow */}
          <button
            onClick={() =>
              onNavigate(activeIndex > 0 ? activeIndex - 1 : pieces.length - 1)
            }
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white sm:left-4"
            aria-label="Previous image"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Next arrow */}
          <button
            onClick={() =>
              onNavigate(activeIndex < pieces.length - 1 ? activeIndex + 1 : 0)
            }
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white sm:right-4"
            aria-label="Next image"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Content — image + info */}
          <m.div
            className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col items-center px-16 sm:px-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            {/* Image container */}
            <div
              className="relative w-full overflow-hidden rounded-[1.5rem] border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                aspectRatio: "3/4",
                maxHeight: "75vh",
              }}
            >
              <AnimatePresence mode="wait">
                <m.div
                  key={activePiece.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: reduceMotion ? 0 : 0.25 }}
                >
                  <Image
                    src={activePiece.src}
                    alt={activePiece.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 90vw, 70vw"
                    priority
                  />
                </m.div>
              </AnimatePresence>
            </div>

            {/* Info bar */}
            <m.div
              className="mt-5 flex w-full flex-col items-center gap-2 text-center"
              key={`info-${activePiece.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.25 }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: activePiece.accent }}
                />
                <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white/95">
                  {activePiece.title}
                </h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                {activePiece.category}
              </span>
              <p className="max-w-md text-sm leading-6 text-white/55">
                {activePiece.description}
              </p>
            </m.div>

            {/* Thumbnail strip */}
            <div className="mt-5 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
              {pieces.map((piece, idx) => (
                <button
                  key={piece.id}
                  onClick={() => onNavigate(idx)}
                  className={`relative h-12 w-9 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    idx === activeIndex
                      ? "border-white/60"
                      : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  <Image
                    src={piece.src}
                    alt={piece.title}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </button>
              ))}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
