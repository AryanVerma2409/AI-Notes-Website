import { createClient } from "@supabase/supabase-js";

// Uses Vite env vars on Vercel if provided, otherwise falls back to your configured project values
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://uwsfujgjkqrpsmkmcrij.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_gKaXmsXRNQC-y_CeJsZnFg_NRX_S4uw";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);