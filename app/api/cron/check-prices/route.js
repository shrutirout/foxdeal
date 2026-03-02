import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeProduct } from "@/lib/firecrawl";
import { sendPriceDropAlert } from "@/lib/email";

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

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing Supabase environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, user_id, url, name, current_price, currency, image_url");

  if (productsError) {
    console.error("Failed to fetch products:", productsError);
    throw productsError;
  }

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

      const { error: updateError } = await supabase
        .from("products")
        .update({
          current_price: newPrice,
          currency: productData.currencyCode || product.currency,
          name: productData.productName || product.name,
          image_url: productData.productImageUrl || product.image_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (updateError) {
        console.error(`Failed to update product ${product.id}:`, updateError);
        results.failed++;
        continue;
      }

      await supabase.from("price_history").insert({
        product_id: product.id,
        price: newPrice,
        currency: productData.currencyCode || product.currency,
      });

      if (oldPrice !== newPrice) {
        results.priceChanges++;
        console.log(`Price changed for ${product.name}: ${oldPrice} to ${newPrice}`);

        if (newPrice < oldPrice) {
          try {
            const { data: userData, error: userError } =
              await supabase.auth.admin.getUserById(product.user_id);

            if (userError) {
              console.error(`Failed to fetch user ${product.user_id}:`, userError);
            } else if (userData?.user?.email) {
              const emailResult = await sendPriceDropAlert(
                userData.user.email,
                product,
                oldPrice,
                newPrice
              );
              if (emailResult.success) {
                results.alertsSent++;
                console.log(`Alert sent to ${userData.user.email}`);
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
