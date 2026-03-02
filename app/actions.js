"use server";

import { auth } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";
import { scrapeProduct } from "@/lib/firecrawl";
import { calculateDealScore } from "@/lib/dealScore";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// previewing product before saving to db

export async function previewProduct(url) {
  if (!url) return { error: "URL is required" };

  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const productData = await scrapeProduct(url);
    if (!productData.productName || !productData.currentPrice) {
      return { error: "Could not extract product information from this URL" };
    }

    const dealScore = calculateDealScore({
      rating: productData.rating,
      reviewCount: productData.reviewCount,
      sellerRating: productData.sellerRating,
      sellerName: productData.sellerName,
      platformDomain: productData.platformDomain,
    });

    return { success: true, productData, dealScore };
  } catch (error) {
    console.error("Preview product error:", error);
    return { error: error.message || "Failed to fetch product information" };
  }
}

// scrape a url and save the product to the database

export async function addProduct(formData) {
  const url = formData.get("url");
  if (!url) return { error: "URL is required" };

  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const productData = await scrapeProduct(url);
    if (!productData.productName || !productData.currentPrice) {
      return { error: "Could not extract product information from this URL" };
    }

    return await _saveProductToDb(userId, url, productData);
  } catch (error) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

// single url add — used by the progressive adding loop in the client
export async function addProductByUrl(url) {
  if (!url) return { error: "URL is required" };

  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    console.log(`Scraping and adding: ${url}`);
    const productData = await scrapeProduct(url);

    if (!productData.productName || !productData.currentPrice) {
      return { error: "Could not extract product data from this page" };
    }

    return await _saveProductToDb(userId, url, productData);
  } catch (error) {
    console.error("addProductByUrl error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

// saves already-scraped product data
export async function addScrapedProduct(productData, url) {
  if (!productData || !url) return { error: "Product data and URL are required" };

  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    return await _saveProductToDb(userId, url, productData);
  } catch (error) {
    console.error("addScrapedProduct error:", error);
    return { error: error.message || "Failed to save product" };
  }
}

// shared db save — used by addProductByUrl, addScrapedProduct, and addProduct

async function _saveProductToDb(userId, url, productData) {
  const newPrice = parseFloat(productData.currentPrice);
  const currency = productData.currencyCode || "INR";

  const dealScore = calculateDealScore({
    rating: productData.rating,
    reviewCount: productData.reviewCount,
    sellerRating: productData.sellerRating,
    sellerName: productData.sellerName,
    platformDomain: productData.platformDomain,
  });

  const existing = await sql`
    SELECT id, current_price FROM products
    WHERE user_id = ${userId} AND url = ${url}
    LIMIT 1
  `;

  const rows = await sql`
    INSERT INTO products (
      user_id, url, name, current_price, currency, image_url,
      original_price, seller_name, rating, review_count,
      platform_domain, deal_score, updated_at
    ) VALUES (
      ${userId}, ${url}, ${productData.productName}, ${newPrice}, ${currency},
      ${productData.productImageUrl || null},
      ${productData.originalPrice ? parseFloat(productData.originalPrice) : null},
      ${productData.sellerName || null},
      ${productData.rating || null},
      ${productData.reviewCount || 0},
      ${productData.platformDomain || null},
      ${dealScore.score},
      NOW()
    )
    ON CONFLICT (user_id, url) DO UPDATE SET
      name = EXCLUDED.name,
      current_price = EXCLUDED.current_price,
      currency = EXCLUDED.currency,
      image_url = EXCLUDED.image_url,
      original_price = EXCLUDED.original_price,
      seller_name = EXCLUDED.seller_name,
      rating = EXCLUDED.rating,
      review_count = EXCLUDED.review_count,
      platform_domain = EXCLUDED.platform_domain,
      deal_score = EXCLUDED.deal_score,
      updated_at = NOW()
    RETURNING *
  `;

  const product = rows[0];
  if (!product) throw new Error("Failed to save product");

  const isNew = existing.length === 0;
  const priceChanged = !isNew && parseFloat(existing[0].current_price) !== newPrice;

  if (isNew || priceChanged) {
    await sql`
      INSERT INTO price_history (product_id, price, currency)
      VALUES (${product.id}, ${newPrice}, ${currency})
    `;
  }

  revalidatePath("/");
  return {
    success: true,
    product,
    dealScore,
    productName: productData.productName,
    message: isNew ? "Product added!" : "Product updated!",
  };
}

// standard crud — delete, read products and history

export async function deleteProduct(productId) {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    await sql`DELETE FROM products WHERE id = ${productId} AND user_id = ${userId}`;
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProducts() {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const rows = await sql`
      SELECT * FROM products WHERE user_id = ${userId} ORDER BY created_at DESC
    `;
    return rows;
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getPriceHistory(productId) {
  try {
    const rows = await sql`
      SELECT * FROM price_history WHERE product_id = ${productId} ORDER BY checked_at ASC
    `;
    return rows;
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

export async function signOut() {
  revalidatePath("/");
  redirect("/");
}

// product discovery using serper — no firecrawl credits used at this stage

// search by name — returns serper results
export async function searchProductsCSE(productName) {
  if (!productName || productName.trim().length < 3) {
    return { error: "Please enter at least 3 characters" };
  }

  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const { searchProducts } = await import("@/lib/serper");
    const results = await searchProducts(productName.trim());

    if (!results || results.length === 0) {
      return {
        success: true,
        results: [],
        message: "No products found. Try a more specific product name.",
      };
    }

    return { success: true, results };
  } catch (error) {
    console.error("searchProductsCSE error:", error);
    return { error: error.message || "Failed to search for products" };
  }
}

// url compare — scrapes original once, then uses serper to find same product elsewhere
export async function findSimilarProductsCSE(url) {
  if (!url) return { error: "URL is required" };

  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    console.log("Scraping original product:", url);
    const originalProduct = await scrapeProduct(url);

    if (!originalProduct.productName || !originalProduct.currentPrice) {
      return { error: "Could not extract product information from this URL" };
    }

    const dealScore = calculateDealScore({
      rating: originalProduct.rating,
      reviewCount: originalProduct.reviewCount,
      sellerRating: originalProduct.sellerRating,
      sellerName: originalProduct.sellerName,
      platformDomain: originalProduct.platformDomain,
    });

    console.log(`Original: "${originalProduct.productName}" at ${originalProduct.currentPrice}`);

    const { searchProducts } = await import("@/lib/serper");
    let cseResults = [];

    try {
      const rawResults = await searchProducts(originalProduct.productName);
      cseResults = rawResults.filter((r) => !url.includes(r.platform));
    } catch (cseError) {
      console.error("Serper search failed (non-fatal):", cseError.message);
    }

    return {
      success: true,
      original: { ...originalProduct, dealScore, url },
      alternatives: cseResults,
    };
  } catch (error) {
    console.error("findSimilarProductsCSE error:", error);
    return { error: error.message || "Failed to process product" };
  }
}

// ai deal verdict — only runs when user explicitly requests it

export async function getAIVerdict(productId) {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const productRows = await sql`
      SELECT * FROM products WHERE id = ${productId} AND user_id = ${userId} LIMIT 1
    `;
    const product = productRows[0];
    if (!product) return { error: "Product not found" };

    const priceHistory = await sql`
      SELECT * FROM price_history WHERE product_id = ${productId} ORDER BY checked_at ASC
    `;

    const { generateAIVerdict } = await import("@/lib/gemini-ai-verdict");
    const verdict = await generateAIVerdict(product, priceHistory || []);

    return { success: true, verdict };
  } catch (error) {
    console.error("getAIVerdict error:", error);
    return { error: error.message || "Failed to generate AI verdict" };
  }
}
