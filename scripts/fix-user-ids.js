/**
 * FoxDeal: Fix user IDs after Clerk migration
 *
 * Maps old Supabase UUIDs to new Clerk user IDs in the Neon database.
 * Run this after signing up in Clerk and finding your Clerk user ID
 * in the Clerk dashboard (Users section).
 *
 * Usage:
 *   node scripts/fix-user-ids.js --old <supabase-uuid> --new <clerk-user-id>
 *
 * Example:
 *   node scripts/fix-user-ids.js --old a1b2c3d4-... --new user_2abc123...
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const args = process.argv.slice(2);
const oldIdx = args.indexOf("--old");
const newIdx = args.indexOf("--new");

if (oldIdx === -1 || newIdx === -1 || !args[oldIdx + 1] || !args[newIdx + 1]) {
  console.error("Usage: node scripts/fix-user-ids.js --old <supabase-uuid> --new <clerk-user-id>");
  process.exit(1);
}

const oldUserId = args[oldIdx + 1];
const newUserId = args[newIdx + 1];

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const { rowCount } = await sql`
    UPDATE products SET user_id = ${newUserId} WHERE user_id = ${oldUserId}
  `;

  const updated = typeof rowCount === "number" ? rowCount : "unknown";
  console.log(`Updated ${updated} product(s): ${oldUserId} -> ${newUserId}`);

  const remaining = await sql`SELECT COUNT(*) FROM products WHERE user_id = ${oldUserId}`;
  if (parseInt(remaining[0].count) > 0) {
    console.warn("Some rows were not updated. Run again if needed.");
  } else {
    console.log("All products successfully reassigned.");
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
