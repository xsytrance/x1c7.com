// FEED ME YOUR SONG — paste/file classification for the intake panel.
// Pure sniffing, no network; the user always gets a one-tap correction chip.

export type PasteKind = "lyrics" | "style" | "exclusions";

export function classifyPaste(text: string): PasteKind {
  const t = text.trim();
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  const negWords = /(^|\b)(no |not |avoid |exclude|without |minus )/i;
  // Suno exclusions read like a short negative list
  if (t.length < 240 && (negWords.test(t) || /^exclu/i.test(t))) return "exclusions";
  // Suno style text: one shortish line of comma-separated descriptors
  if (lines.length <= 2 && t.length < 220 && (t.includes(",") || lines.length === 1) && !/\[/.test(t)) return "style";
  return "lyrics";
}

/** Style/exclusions text → cleaned descriptor words. */
export const descriptorWords = (text: string): string[] =>
  text.toLowerCase().split(/[,\n;·]+/).map((w) => w.replace(/^(no|not|avoid|exclude|without)\s+/i, "").trim()).filter((w) => w.length > 1);
