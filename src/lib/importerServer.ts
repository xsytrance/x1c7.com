// Server-side helpers for the private-planet importer (localhost only).
import { existsSync } from "node:fs";
import { join } from "node:path";

/** The python venv holding yt-dlp + Whisper + demucs. */
export function venvPath(): string | null {
  const candidates = [
    process.env.WHISPER_VENV,
    join(process.env.HOME || "", ".x1c7/venv"),
  ].filter(Boolean) as string[];
  return candidates.find((v) => existsSync(join(v, "bin/yt-dlp"))) || null;
}

/** Job workdirs live under scripts/import-youtube/jobs/<slug> (gitignored). */
export function jobsRoot(): string {
  return join(process.cwd(), "scripts/import-youtube/jobs");
}

export function safeSlug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
