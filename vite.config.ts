import { defineConfig, loadEnv } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import fs from "node:fs";

export default defineConfig(({ mode }) => {
  // Load environment variables from .env / .env.local
  const env = loadEnv(mode, process.cwd(), "");

  // Fallback to wrangler.jsonc vars if not found in .env or process.env
  let fallbackUrl = "";
  let fallbackKey = "";
  try {
    if (fs.existsSync("wrangler.jsonc")) {
      const wranglerText = fs.readFileSync("wrangler.jsonc", "utf-8");
      const urlMatch = wranglerText.match(/"NEXT_PUBLIC_SUPABASE_URL"\s*:\s*"([^"]+)"/);
      const keyMatch = wranglerText.match(/"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"\s*:\s*"([^"]+)"/);
      if (urlMatch) fallbackUrl = urlMatch[1];
      if (keyMatch) fallbackKey = keyMatch[1];
    }
  } catch {
    // Ignore error reading wrangler.jsonc fallback
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    fallbackUrl;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    fallbackKey;

  // Populate process.env so that vinext's getNextPublicEnvDefines() discovers all NEXT_PUBLIC_* variables
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith("NEXT_PUBLIC_") && val && !process.env[key]) {
      process.env[key] = val;
    }
  }
  if (supabaseUrl && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  }
  if (supabaseAnonKey && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = supabaseAnonKey;
  }

  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseAnonKey),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
    ],
  };
});
