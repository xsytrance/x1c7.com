"use client";

import { useEffect, useState, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
const GLYPHS = "\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BD\u30BF\u30C1\u30C4\u30C6\u30C8\u30CA\u30CB\u30CC\u30CD\u30CE\u30CF\u30D2\u30D5\u30D8\u30DB\u30DE\u30DF\u30E0\u30E1\u30E2\u30E4\u30E6\u30E8\u30E9\u30EA\u30EB\u30EC\u30ED\u30EF\u30F2\u30F30123456789";

interface TextScrambleProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  style?: React.CSSProperties;
}

export function TextScramble({
  text,
  className = "",
  delay = 0,
  speed = 30,
  as: Tag = "span",
  style,
}: TextScrambleProps) {
  const [display, setDisplay] = useState("");
  const [revealed, setRevealed] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Check reduced motion
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(text);
      setRevealed(true);
      return;
    }

    const timeout = setTimeout(() => {
      let frame = 0;
      const totalFrames = text.length * 3;

      const animate = () => {
        frame++;
        const progress = frame / totalFrames;
        const revealedCount = Math.floor(progress * text.length);

        let result = "";
        for (let i = 0; i < text.length; i++) {
          if (text[i] === " ") {
            result += " ";
          } else if (i < revealedCount) {
            result += text[i];
          } else {
            result += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        }
        setDisplay(result);

        if (frame < totalFrames) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setDisplay(text);
          setRevealed(true);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [text, delay, speed]);

  return (
    <Tag
      className={`${className} ${revealed ? "" : "font-mono"}`}
      style={style}
      aria-label={text}
    >
      {display || text.split("").map(() => "\u00A0").join("")}
    </Tag>
  );
}
