import { createClient } from "@supabase/supabase-js";

// Paste your Supabase Project URL below (base URL without /rest/v1/)
const SUPABASE_URL = "https://uwsfujgjkqrpsmkmcrij.supabase.co";

// Paste your Supabase Public (Anon / Publishable) Key below
const SUPABASE_PUBLIC_KEY = "sb_publishable_gKaXmsXRNQC-y_CeJsZnFg_NRX_S4uw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
