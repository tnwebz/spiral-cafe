import path from "path";
import fs from "fs";

// Load env
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

async function checkSqlApi() {
  const sqlFile = path.resolve(process.cwd(), "supabase/migrations/001_initial_schema.sql");
  const sql = fs.readFileSync(sqlFile, "utf-8");

  // Try 1: Supabase pg/query endpoint
  const res1 = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
    },
    body: JSON.stringify({ query: "SELECT 1 as test" }),
  });
  console.log("pg/query status:", res1.status, await res1.text().catch(() => ""));

  // Try 2: REST query endpoint
  const res2 = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
    },
  });
  console.log("rpc status:", res2.status, await res2.text().catch(() => ""));
}

checkSqlApi();
