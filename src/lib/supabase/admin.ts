import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types";

let cachedAdminClient: SupabaseClient<Database> | null = null;
let lastUsedKey: string | null = null;

function getAdminCredentials() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://funsnqahpzsucbtxbvpo.supabase.co";

  // Check privileged server-side service keys ONLY:
  // Never fall back to publishable/anon keys which are subject to RLS and lack admin rights.
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    "";

  return { supabaseUrl, supabaseKey };
}

/**
 * Lazily initialize and return the trusted backend Supabase admin client.
 * Does not initialize during module loading / Cloudflare Worker startup.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client must only be imported in server contexts.");
  }

  const { supabaseUrl, supabaseKey } = getAdminCredentials();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Server database access error: SUPABASE_SECRET_KEY is required for backend operations but is missing. Anonymous or publishable keys cannot perform privileged order processing."
    );
  }

  if (cachedAdminClient && lastUsedKey === supabaseKey) {
    return cachedAdminClient;
  }

  cachedAdminClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  lastUsedKey = supabaseKey;

  return cachedAdminClient;
}

/**
 * Trusted backend Supabase client with lazy initialization.
 * Safe for Cloudflare Workers startup validation because createClient()
 * is only invoked when database operations are actually called.
 */
export const supabaseAdmin: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, receiver) {
      if (prop === "then") {
        return undefined; // Not a Promise
      }
      const client = getSupabaseAdminClient();
      const value = Reflect.get(client, prop, receiver);
      if (typeof value === "function") {
        return value.bind(client);
      }
      return value;
    },
  }
);
