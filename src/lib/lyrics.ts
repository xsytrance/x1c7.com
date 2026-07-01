// Lyrics model + parsing. Plain text renders as static stanzas; LRC-timestamped
// text ([mm:ss.xx]) upgrades to time-synced "cinematic" lyrics. Timing is tracked
// per display line, so partially-synced lyrics stay correctly aligned.

export interface ParsedLine {
  text: string;        // display text, timestamps stripped
  t: number | null;    // start time in seconds, or null if untimed
  header: boolean;     // whole-line [Section]/[Speaker] marker, never karaoke-active
}

export interface ParsedLyrics {
  /** True when at least one line carries a timestamp. */
  synced: boolean;
  lines: ParsedLine[];
}

const LRC_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLyrics(raw: string | null | undefined): ParsedLyrics {
  if (!raw || !raw.trim()) return { synced: false, lines: [] };
  const rawLines = raw.replace(/\r\n?/g, "\n").split("\n");
  let synced = false;

  const lines: ParsedLine[] = rawLines.map((line) => {
    LRC_TAG.lastIndex = 0;
    const m = LRC_TAG.exec(line);
    const text = line.replace(LRC_TAG, "").trim();
    const header = !!text && /^\[.*\]$/.test(text);
    let t: number | null = null;
    if (m && !header) {
      t = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0);
      synced = true;
    }
    return { text, t, header };
  });

  return { synced, lines };
}

/** Index (into lines) of the active timed line for the current time; -1 if none. */
export function activeIndex(lines: ParsedLine[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t != null && lines[i].t! <= time) idx = i;
  }
  return idx;
}

/** Strip the outer brackets from a [Section] marker for display. */
export function headerLabel(text: string): string {
  return text.trim().replace(/^\[|\]$/g, "");
}
