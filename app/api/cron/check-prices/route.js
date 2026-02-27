import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeProduct } from "@/lib/firecrawl";
import { sendPriceDropAlert } from "@/lib/email";

// raising vercel function timeout — requires pro plan, free tier caps at 10s
export const maxDuration = 300;

// wrapping a scrape in a timeout so one slow page doesn't stall the whole job
function scrapeWithTimeout(url, timeoutMs = 35000) {
  return Promise.race([
    scrapeProduct(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("scrape timeout after 35s")), timeoutMs)
    ),
  ]);
}

export async function POST(request) {
  const startTime = Date.now();

  try {
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

    // using service role to bypass rls — reads all users' products
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

        // updating latest price and name/image if they changed
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

        // logging price history only when price actually changed
        if (oldPrice !== newPrice) {
          await supabase.from("price_history").insert({
            product_id: product.id,
            price: newPrice,
            currency: productData.currencyCode || product.currency,
          });

          results.priceChanges++;
          console.log(`Price changed for ${product.name}: ${oldPrice} → ${newPrice}`);

          // sending email alert only on a price drop
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
              // email failure shouldn't fail the whole product check
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
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Price check endpoint is active. Send a POST request with Authorization: Bearer <CRON_SECRET> to trigger.",
    hint: "If the job times out, ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY, RESEND_API_KEY, and CRON_SECRET are set in Vercel environment variables.",
  });
}
