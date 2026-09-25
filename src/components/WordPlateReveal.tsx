"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE WORD OPENS INTO ITS PICTURE.
//
// A keyword already owns a photograph — "dishes", "mirror", "green light".
// Until now the word appeared and, separately, the backdrop changed. Two
// events that happen to coincide. This makes them one event: the word is
// drawn FILLED with its own photograph, and then it grows until the picture
// it is made of becomes the picture behind everything.
//
// The mechanism is background-clip:text — the plate is painted through the
// glyphs, so the letters are a window onto the image rather than coloured
// type. As the word scales up the window widens, and by the time it dissolves
// the real backdrop underneath has finished landing on the same plate. The
// handoff is invisible: the audience sees one continuous move from word to
// world.
//
// Two rules keep it from becoming a tic:
//   - only a word that actually HAS art can do it (no art, no reveal);
//   - the caller gates it on impact, so it stays rare. A song where every
//     keyword bursts open is a song with no moments in it.
// ═══════════════════════════════════════════════════════════════════════════

import { AnimatePresence, motion as m } from "framer-motion";

export interface RevealCfg {
  /** seconds the whole move takes. Default 1.05 */
  dur?: number;
  /** starting size, in vw. Default 17 */
  size?: number;
  /** how far it grows. 1 = no growth. Default 6.4 */
  grow?: number;
  /** a lit rim so the letters read against a busy plate. Default on. */
  rim?: boolean;
  /** how far the rest of the frame darkens while the word is open. Default 0.72 */
  scrim?: number;
}

export function WordPlateReveal({
  fire, word, img, cfg,
}: { fire: number; word: string; img: string; cfg?: RevealCfg }) {
  const dur = cfg?.dur ?? 1.05;
  const size = cfg?.size ?? 17;
  const grow = cfg?.grow ?? 6.4;
  const scrim = cfg?.scrim ?? 0.72;

  return (
    <AnimatePresence>
      {fire > 0 && word && img && (
        <m.div
          key={`reveal-${fire}`}
          className="pointer-events-none fixed inset-0 z-[43] flex items-center justify-center overflow-hidden"
          aria-hidden
          initial={{ opacity: 0 }}
          // Holds full opacity for most of the move and only lets go at the
          // very end — fading it evenly would cross-dissolve with the backdrop
          // and read as a blur, not a reveal.
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: dur, times: [0, 0.14, 0.74, 1], ease: "linear" }}
        >
          {/* THE SCRIM, and the reason the effect is visible at all.
              By the time the word appears, the backdrop is usually already
              showing the same plate — so letters filled with that same image,
              in the same position, are perfect camouflage. Measured on "LIGHT"
              over the green-blinds plate: the reveal fired correctly and could
              not be seen. Darkening everything except the glyphs turns the word
              into a lit window onto the picture, and lifting the scrim as the
              word grows hands the frame over. */}
          <m.div
            className="absolute inset-0"
            style={{ background: "#05040a" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, scrim, scrim * 0.7, 0] }}
            transition={{ duration: dur, times: [0, 0.16, 0.62, 1], ease: "easeInOut" }}
          />
          <m.span
            className="kinetic-word relative select-none whitespace-nowrap text-center font-black uppercase"
            style={{
              fontSize: `${size}vw`,
              letterSpacing: "-0.03em",
              backgroundImage: `url(${img})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              // The plate must not scale WITH the text, or the image inside the
              // letters slides around and the illusion of a fixed window onto a
              // real scene is lost. Attachment:fixed pins it to the viewport,
              // so the letters travel over a still image — which is exactly how
              // a window behaves.
              backgroundAttachment: "fixed",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextStroke: cfg?.rim === false ? undefined : "1px rgba(255,255,255,0.28)",
              filter: "drop-shadow(0 0 18px rgba(0,0,0,0.55))",
            }}
            initial={{ scale: 1 }}
            // Accelerates outward and never settles: the growth is still
            // speeding up when the word lets go, which is what hands the eye
            // to the full-frame plate instead of parking on a big word.
            animate={{ scale: grow }}
            transition={{ duration: dur, ease: [0.4, 0, 0.9, 0.85] }}
          >
            {word}
          </m.span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
