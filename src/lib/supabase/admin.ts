import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

if (typeof window !== "undefined") {
  throw new Error("Supabase admin client must only be imported in server contexts.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn("Supabase credentials missing for admin client. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are configured.");
}

/**
 * Trusted backend Supabase client initialized with secret service key.
 * Bypasses RLS for secure, atomic backend operations.
 */
export const supabaseAdmin = createClient<Database>(
  supabaseUrl || "",
  supabaseSecretKey || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
