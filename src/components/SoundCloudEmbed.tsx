"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OEmbedResponse {
  html: string;
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url?: string;
  description?: string;
}

interface SoundCloudEmbedProps {
  url: string;
  maxHeight?: number;
  className?: string;
  showAttribution?: boolean;
}

/**
 * SoundCloud oEmbed integration component.
 *
 * Fetches embed HTML from SoundCloud's oEmbed endpoint and renders it.
 * Falls back to a direct iframe embed if the oEmbed request fails.
 *
 * oEmbed docs: https://developers.soundcloud.com/docs/oembed
 */
export function SoundCloudEmbed({
  url,
  maxHeight = 450,
  className = "",
  showAttribution = true,
}: SoundCloudEmbedProps) {
  const [oembed, setOembed] = useState<OEmbedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchOembed = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json&maxheight=${maxHeight}`
      );
      if (!res.ok) throw new Error(`oEmbed failed: ${res.status}`);
      const data: OEmbedResponse = await res.json();
      setOembed(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [url, maxHeight]);

  useEffect(() => {
    fetchOembed();
  }, [fetchOembed]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div
        className={`relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur ${className}`}
        style={{ minHeight: maxHeight }}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          {/* SoundCloud brand colour spinner */}
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#ff5500]" />
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">
            Loading SoundCloud embed...
          </p>
        </div>
      </div>
    );
  }

  /* ── Error / fallback state ── */
  if (error || !oembed) {
    return (
      <div
        className={`relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur ${className}`}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-white/30"
          >
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">
            Could not load SoundCloud embed
          </p>
          <button
            onClick={fetchOembed}
            className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:border-plasma hover:text-plasma"
          >
            Retry
          </button>
          {/* Direct iframe fallback */}
          <div className="mt-4 w-full max-w-2xl">
            <iframe
              width="100%"
              height={maxHeight}
              scrolling="no"
              frameBorder="no"
              allow="autoplay"
              src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false`}
              title="SoundCloud fallback embed"
              className="rounded-xl"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Success: render oEmbed HTML ── */
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="oembed"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`group relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-colors duration-300 hover:border-white/20 ${className}`}
      >
        {/* oEmbed HTML (contains the iframe) */}
        <div
          className="soundcloud-oembed relative w-full"
          dangerouslySetInnerHTML={{ __html: oembed.html }}
        />

        {/* Optional attribution footer */}
        {showAttribution && (
          <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
            <a
              href={oembed.author_url || url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-[10px] uppercase tracking-wider text-white/30 transition hover:text-[#ff5500]"
            >
              {oembed.author_name || "SoundCloud"}
            </a>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-white/20">
              Powered by{" "}
              <a
                href="https://soundcloud.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff5500]/70 transition hover:text-[#ff5500]"
              >
                SoundCloud
              </a>
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
