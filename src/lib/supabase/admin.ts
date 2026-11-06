import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types";

let cachedAdminClient: SupabaseClient<Database> | null = null;
let lastUsedKey: string | null = null;

function getAdminCredentials() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://funsnqahpzsucbtxbvpo.supabase.co";

  // Check all common server-side service key variables in order of precedence:
  // 1. SUPABASE_SECRET_KEY (configured in .env.local)
  // 2. SUPABASE_SERVICE_ROLE_KEY (standard Supabase service role key)
  // 3. SUPABASE_KEY (generic backend key)
  // 4. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY (fallback)
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return { supabaseUrl, supabaseKey };
}

/**
 * Lazily initialize and return the trusted backend Supabase client.
 * Does not initialize during module loading / Cloudflare Worker startup.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client must only be imported in server contexts.");
  }

  const { supabaseUrl, supabaseKey } = getAdminCredentials();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase key is required. Set SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your environment."
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
