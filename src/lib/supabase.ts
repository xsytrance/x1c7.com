import { createClient } from "@supabase/supabase-js";

// Publishable (anon) credentials — safe to expose in the client. Row-Level
// Security + the `admins` allowlist protect all writes.
const SUPABASE_URL = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Shape of a row in public.tracks
export interface TrackRow {
  id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  mood: string | null;
  color: string | null;
  cover: string | null;
  audio_url: string;
  sort_order: number;
  featured: boolean;
  hidden: boolean;
  theme: Record<string, unknown> | null;
  lyrics: string | null;
  lyrics_synced: unknown | null;
}
