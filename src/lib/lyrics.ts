// Lyrics model + parsing. Plain text renders as static stanzas; LRC-timestamped
// text ([mm:ss.xx]) upgrades automatically to time-synced "cinematic" lyrics.

export interface LyricLine {
  t: number;    // seconds
  text: string;
}

export interface ParsedLyrics {
  /** Sorted timed lines when the source is LRC; null for plain lyrics. */
  synced: LyricLine[] | null;
  /** Display lines with any timestamps stripped (blank lines = stanza breaks). */
  lines: string[];
}

const LRC_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Parse a raw lyrics string. Recognizes LRC timestamps anywhere at the start of
 * a line (including multiple tags sharing one line); everything else is treated
 * as plain text.
 */
export function parseLyrics(raw: string | null | undefined): ParsedLyrics {
  if (!raw || !raw.trim()) return { synced: null, lines: [] };
  const rawLines = raw.replace(/\r\n?/g, "\n").split("\n");
  const timed: LyricLine[] = [];
  const lines: string[] = [];
  let sawTag = false;

  for (const line of rawLines) {
    LRC_TAG.lastIndex = 0;
    const tags: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = LRC_TAG.exec(line))) {
      const mm = parseInt(m[1], 10);
      const ss = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0;
      tags.push(mm * 60 + ss + frac);
    }
    const text = line.replace(LRC_TAG, "").trim();
    if (tags.length) {
      sawTag = true;
      for (const t of tags) timed.push({ t, text });
    }
    lines.push(text);
  }

  return {
    synced: sawTag ? timed.sort((a, b) => a.t - b.t) : null,
    lines,
  };
}

/** Index of the active line for the current playback time (-1 before the first). */
export function activeLineIndex(synced: LyricLine[], time: number): number {
  let lo = 0, hi = synced.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (synced[mid].t <= time) { idx = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return idx;
}
