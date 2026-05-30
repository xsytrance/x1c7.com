"use client";

import { motion } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { type Track } from "@/data/tracks";

interface TrackCardProps {
  track: Track;
  index: number;
  size?: "large" | "medium";
}

export function TrackCard({ track, index, size = "medium" }: TrackCardProps) {
  const { currentTrack, isPlaying, playTrack, tracks } = useMusicPlayer();
  const isCurrent = currentTrack?.id === track.id;
  const hasAudio = !!track.audioUrl;

  const handlePlay = () => {
    playTrack(track, tracks);
  };

  const isLarge = size === "large";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-white/25 ${
        isLarge ? "col-span-full sm:col-span-2" : ""
      } ${isCurrent ? "ring-1" : ""}`}
      style={isCurrent ? { ringColor: `${track.color}44` } : {}}
    >
      {/* Album art area */}
      <div className={`relative overflow-hidden ${isLarge ? "aspect-[2/1]" : "aspect-square"}`}>
        {/* Art background */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${track.art})` }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 30%, ${track.color}22 100%)`,
          }}
        />
        {/* Fallback gradient if no art */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${track.color}33, transparent 70%), linear-gradient(135deg, ${track.color}11, transparent)`,
          }}
        />

        {/* Playing indicator */}
        {isCurrent && isPlaying && (
          <div className="absolute right-4 top-4 flex gap-1">
            {[0, 0.15, 0.3].map((delay, i) => (
              <div
                key={i}
                className="h-4 w-1 rounded-full"
                style={{
                  background: track.color,
                  animation: `visualizerBounce 0.6s ease-in-out infinite alternate`,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            onClick={handlePlay}
            className="grid h-16 w-16 place-items-center rounded-full shadow-2xl transition hover:scale-110"
            style={{ background: track.color }}
            aria-label={isCurrent && isPlaying ? "Pause" : `Play ${track.title}`}
          >
            {isCurrent && isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#05030b">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#05030b">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Genre badge */}
        <div className="absolute bottom-4 left-4">
          <span
            className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ background: `${track.color}22`, color: track.color, border: `1px solid ${track.color}33` }}
          >
            {track.genre}
          </span>
        </div>

        {/* Duration */}
        <div className="absolute bottom-4 right-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{track.duration}</span>
        </div>
      </div>

      {/* Info */}
      <div className={`p-5 ${isLarge ? "sm:p-6" : ""}`}>
        <h3 className={`font-display font-black uppercase tracking-wide text-white ${isLarge ? "text-xl" : "text-base"}`}>
          {track.title}
        </h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-white/40">
          {track.artist} {track.mood ? `· ${track.mood}` : ""}
        </p>

        {/* Mini progress if current */}
        {isCurrent && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: track.color }}
              layoutId="trackProgress"
            />
          </div>
        )}

        {/* Coming soon note */}
        {!hasAudio && !isCurrent && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/25">Audio coming soon</p>
        )}
      </div>
    </motion.div>
  );
}
