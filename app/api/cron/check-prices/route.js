import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { scrapeProduct } from "@/lib/firecrawl";
import { sendPriceDropAlert } from "@/lib/email";
import { clerkClient } from "@clerk/nextjs/server";

// maxDuration applies on Vercel Pro; free (Hobby) plan caps at 10s
export const maxDuration = 300;

function scrapeWithTimeout(url, timeoutMs = 35000) {
  return Promise.race([
    scrapeProduct(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("scrape timeout after 35s")), timeoutMs)
    ),
  ]);
}

// shared handler — called by both GET (Vercel native cron) and POST (external cron)
async function runPriceCheck(request) {
  const startTime = Date.now();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await sql`
    SELECT id, user_id, url, name, current_price, currency, image_url FROM products
  `;

  if (!products || products.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No products to check",
      results: { total: 0, updated: 0, failed: 0, priceChanges: 0, alertsSent: 0 },
    });
  }

  console.log(`Checking prices for ${products.length} products`);

  const results = {
    total: products.length,
    updated: 0,
    failed: 0,
    priceChanges: 0,
    alertsSent: 0,
  };

  for (const product of products) {
    try {
      console.log(`Checking: ${product.name} (${product.url})`);

      const productData = await scrapeWithTimeout(product.url);

      if (!productData || !productData.currentPrice) {
        console.warn(`No price returned for product ${product.id}`);
        results.failed++;
        continue;
      }

      const newPrice = parseFloat(productData.currentPrice);
      const oldPrice = parseFloat(product.current_price);

      if (isNaN(newPrice) || newPrice <= 0) {
        console.warn(`Invalid price ${newPrice} for product ${product.id}`);
        results.failed++;
        continue;
      }

      await sql`
        UPDATE products SET
          current_price = ${newPrice},
          currency = ${productData.currencyCode || product.currency},
          name = ${productData.productName || product.name},
          image_url = ${productData.productImageUrl || product.image_url},
          updated_at = NOW()
        WHERE id = ${product.id}
      `;

      await sql`
        INSERT INTO price_history (product_id, price, currency)
        VALUES (${product.id}, ${newPrice}, ${productData.currencyCode || product.currency})
      `;

      if (oldPrice !== newPrice) {
        results.priceChanges++;
        console.log(`Price changed for ${product.name}: ${oldPrice} to ${newPrice}`);

        if (newPrice < oldPrice) {
          try {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(product.user_id);
            const email = clerkUser.emailAddresses?.[0]?.emailAddress;

            if (email) {
              const emailResult = await sendPriceDropAlert(email, product, oldPrice, newPrice);
              if (emailResult.success) {
                results.alertsSent++;
                console.log(`Alert sent to ${email}`);
              }
            }
          } catch (emailErr) {
            console.error(`Email alert failed for product ${product.id}:`, emailErr.message);
          }
        }
      }

      results.updated++;
    } catch (error) {
      console.error(`Error processing product ${product.id}:`, error.message);
      results.failed++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Cron completed in ${duration}s:`, results);

  return NextResponse.json({
    success: true,
    message: `Price check completed in ${duration}s`,
    results,
  });
}

// GET - used by Vercel native cron (configured in vercel.json)
export async function GET(request) {
  try {
    return await runPriceCheck(request);
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - used by external cron services (cron-job.org, etc.)
export async function POST(request) {
  try {
    return await runPriceCheck(request);
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
