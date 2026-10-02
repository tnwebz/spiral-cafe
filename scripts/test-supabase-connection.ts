import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Simple env loader
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

console.log("Checking Supabase connection to:", supabaseUrl ? "URL configured" : "URL missing");
console.log("Secret key present:", !!supabaseSecretKey);

// Provide mock or ws WebSocket if in Node < 22 without native WebSocket
if (typeof globalThis.WebSocket === "undefined") {
  // Simple WebSocket stub for server REST operations when Realtime is not active in script
  (globalThis as any).WebSocket = class StubWebSocket {};
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});


async function test() {
  const { data, error } = await supabase.from("menu_items").select("*").limit(1);
  if (error) {
    console.log("Response on menu_items:", error.message, "(Code:", error.code, ")");
  } else {
    console.log("menu_items table accessible! Rows found:", data?.length);
  }
}

test();
