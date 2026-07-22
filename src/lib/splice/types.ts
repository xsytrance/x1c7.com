// Splice Table — shared types. Mirrors the lego schema emitted by
// scripts/song-analysis/legos.mjs (song-legos.json) and consumed by the
// deterministic compiler. Kept dependency-free so it runs in the browser.

export type SectionKind =
  | "intro" | "verse" | "prechorus" | "chorus" | "postchorus" | "hook"
  | "bridge" | "breakdown" | "drop" | "outro" | "spoken" | "interlude"
  | "adlib" | "refrain" | "other";

export type Gender = "male" | "female" | "both" | "group" | "ai" | null;

export interface SectionVoice {
  gender: Gender;
  group: boolean | null;
  spoken: boolean | null;
  descriptor: string | null;
}

export interface Section {
  i: number;
  id: string;              // "<songId>::<kind>...::<i>"
  kind: SectionKind;
  ordinal: number | null;
  voice: SectionVoice;
  raw: string;
  text: string;
  lines: number;
  startT: number | null;
  endT: number | null;
  bars: number | null;
}

export interface Style {
  styleSentence: string | null;
  genre: string | null;
  subGenres: string[];
  mood: string | null;
  vocalStyle: string | null;
  energy: string | null;
  language: string | null;
  bpm: number | null;
  bpmExact: number | null;
  key: string | null;
  mode: string | null;
  keyConfidence: number | null;
  palette: string[];
}

export interface SignatureWord {
  word: string;
  img: string;
  line: string;
  t: number;
  recipe: string;
}

export interface SongLegos {
  v: number;
  id: string;
  title: string;
  artist: string | null;
  generatedAt: string | null;
  duration: number | null;
  style: Style;
  sections: Section[];
  signature: SignatureWord[];
  provides: SectionKind[];
}

export interface CatalogEntry {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  key: string | null;
  mode: string | null;
  genre: string | null;
  language: string | null;
  provides: SectionKind[];
  sectionCount: number;
  signature: string[];
  palette: string[];
}

export interface Catalog {
  v: number;
  generatedAt: string | null;
  count: number;
  songs: CatalogEntry[];
}

// ---- flow (the compiler's input) ----

export interface FlowItem {
  ref: string;             // section id
  as?: SectionKind;        // relabel the section in the arrangement
}

export interface FlowKnobs {
  weirdness: number;       // 0-100
  styleStrength: number;   // 0-100
  audioInfluence: number;  // 0-100
  voice: "auto" | "male" | "female" | "both" | "undecided";
}

export interface Flow {
  title: string | null;
  style: { from: string; overrides?: Partial<Style> };
  arrangement: FlowItem[];
  knobs?: Partial<FlowKnobs>;
  exclude?: string[];
}

// ---- compiled output ----

export interface Seam {
  match: boolean;
  bpm: { ratio: number | null; verdict: "match" | "stretch" | "hard-stretch" };
  key: {
    semitones: number | null;
    modeFlip: boolean;
    verdict: "match" | "transpose" | "mode-flip" | "transpose+mode" | "clash";
  };
  penalty: number;
  suggestions: string[];
}

export interface SeamWarning extends Seam {
  ref: string;
  from: string;
}

export interface Compiled {
  title: string;
  styleOfMusic: string;
  lyrics: string;
  params: {
    weirdness: number;
    styleStrength: number;
    audioInfluence: number;
    vocalGender: string;
    excludeStyles: string[];
  };
  target: { bpm: number | null; key: string | null; mode: string | null };
  compatibility: number;   // 0-100
  warnings: SeamWarning[];
  provenance: Record<string, string[]>;
}
