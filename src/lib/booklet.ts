// THE BOOKLET — the insert inside every collector case (liner notes × game
// manual). Data ships as planets/<slug>/booklet.json (v:1) from
// scripts/booklet/build-booklet.mjs; the component fetches it client-side so
// new booklets need zero deploys. Deliberately NOT part of planet.ts — this
// stays out of the Kinetica engine-sync surface.

export interface BookletLevel {
  section: string;
  name: string;
  start: number;
  end: number;
  intensity: number;
  emotion?: string | null;
  boss: boolean;
}

export type BookletPage =
  | { type: "cover"; title: string; tagline?: string; genre?: string | null; bookletNo: string }
  | { type: "read"; body: string; styleSentence?: string | null; mood?: string[] }
  | { type: "lyrics"; official: boolean; language?: string | null; text: string }
  | { type: "world"; art: string[]; caption?: string; themes?: string[] }
  | { type: "band"; approx?: boolean; vocalStyle?: string | null; members: { stem: string; name: string; bio?: string | null }[] }
  | { type: "howto"; performs: boolean; dynamicActs: number; wordFx: number; stems: number }
  | { type: "map"; duration?: number | null; levels: BookletLevel[] }
  | { type: "specs"; bpm?: number | null; key?: string | null; mode?: string | null; camelot?: string | null; duration?: number | null; energy?: string | null; dynamicsDb?: number | null; brightness?: number | null; officialLyrics: boolean; generatedAt?: string | null }
  | { type: "back"; line: string; url: string; bookletNo: string };

export interface BookletData {
  v: number;
  id: string;
  generatedAt?: string | null;
  pages: BookletPage[];
}
