// Server-only Supabase client with the SERVICE ROLE key — bypasses RLS for the
// owner-gated writes (password in site_config, the feed_jobs queue). NEVER import
// this into client code; the key is server-side only (Vercel env / local .env).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = "https://kxbrjmbovjiwwcnepsfh.supabase.co";

export function supabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
