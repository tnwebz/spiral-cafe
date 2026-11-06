import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./types";

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

function getSupabaseCredentials() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
    "https://funsnqahpzsucbtxbvpo.supabase.co";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    "";

  return { supabaseUrl, supabaseAnonKey };
}

export function getSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase browser environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be defined."
    );
  }

  if (typeof window === "undefined") {
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return clientInstance;
}

export function createClient() {
  return getSupabaseBrowserClient();
}

/**
 * Lazy proxy to avoid initializing during SSR/Worker module evaluation.
 */
export const supabaseClient = new Proxy(
  {} as ReturnType<typeof createBrowserClient<Database>>,
  {
    get(_target, prop, receiver) {
      if (prop === "then") return undefined;
      const client = getSupabaseBrowserClient();
      const value = Reflect.get(client, prop, receiver);
      if (typeof value === "function") {
        return value.bind(client);
      }
      return value;
    },
  }
);
