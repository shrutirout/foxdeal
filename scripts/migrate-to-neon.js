/**
 * FoxDeal: Supabase -> Neon migration script
 *
 * Run this ONCE to copy all data from Supabase into Neon.
 * Requires both old Supabase vars AND new DATABASE_URL in .env.local
 *
 * Usage: node scripts/migrate-to-neon.js
 */

import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (script runs outside Next.js context)
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const sql = neon(databaseUrl);

async function createSchema() {
  console.log("Creating Neon schema...");

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      name TEXT NOT NULL,
      current_price DECIMAL(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      image_url TEXT,
      original_price DECIMAL(10, 2),
      seller_name TEXT,
      rating DECIMAL(3, 1),
      review_count INTEGER DEFAULT 0,
      platform_domain TEXT,
      deal_score INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, url)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price DECIMAL(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      checked_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at DESC)
  `;

  // updated_at auto-update trigger
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;

  await sql`DROP TRIGGER IF EXISTS update_products_updated_at ON products`;
  await sql`
    CREATE TRIGGER update_products_updated_at
      BEFORE UPDATE ON products
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `;

  console.log("Schema created.");
}

async function migrateProducts() {
  console.log("Fetching products from Supabase...");
  const { data: products, error } = await supabase.from("products").select("*");
  if (error) throw new Error(`Supabase products fetch failed: ${error.message}`);

  if (!products || products.length === 0) {
    console.log("No products to migrate.");
    return [];
  }

  console.log(`Migrating ${products.length} products to Neon...`);

  for (const p of products) {
    await sql`
      INSERT INTO products (
        id, user_id, url, name, current_price, currency, image_url,
        original_price, seller_name, rating, review_count, platform_domain,
        deal_score, created_at, updated_at
      ) VALUES (
        ${p.id}, ${p.user_id}, ${p.url}, ${p.name}, ${p.current_price},
        ${p.currency || "INR"}, ${p.image_url || null},
        ${p.original_price || null}, ${p.seller_name || null},
        ${p.rating || null}, ${p.review_count || 0},
        ${p.platform_domain || null}, ${p.deal_score || null},
        ${p.created_at}, ${p.updated_at}
      )
      ON CONFLICT (user_id, url) DO NOTHING
    `;
  }

  console.log(`Migrated ${products.length} products.`);
  return products;
}

async function migratePriceHistory() {
  console.log("Fetching price_history from Supabase...");
  const { data: history, error } = await supabase.from("price_history").select("*");
  if (error) throw new Error(`Supabase price_history fetch failed: ${error.message}`);

  if (!history || history.length === 0) {
    console.log("No price history to migrate.");
    return;
  }

  console.log(`Migrating ${history.length} price history rows to Neon...`);

  for (const h of history) {
    await sql`
      INSERT INTO price_history (id, product_id, price, currency, checked_at)
      VALUES (${h.id}, ${h.product_id}, ${h.price}, ${h.currency || "INR"}, ${h.checked_at})
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`Migrated ${history.length} price history rows.`);
}

async function printUserIds() {
  const { data: products } = await supabase.from("products").select("user_id").limit(100);
  const uniqueIds = [...new Set((products || []).map((p) => p.user_id))];

  console.log("\n--- Supabase user IDs found in products ---");
  for (const id of uniqueIds) {
    console.log(" ", id);
  }
  console.log("-------------------------------------------");
  console.log("After signing up in Clerk, go to the Clerk dashboard -> Users,");
  console.log("copy your Clerk user ID (format: user_2abc...), then run:");
  console.log("  node scripts/fix-user-ids.js --old <supabase-uuid> --new <clerk-user-id>\n");
}

async function main() {
  try {
    await createSchema();
    await migrateProducts();
    await migratePriceHistory();
    await printUserIds();
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

main();
