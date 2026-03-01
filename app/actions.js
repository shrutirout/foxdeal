"use server";

import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { calculateDealScore } from "@/lib/dealScore";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// previewing product before saving to db

export async function previewProduct(url) {
  if (!url) return { error: "URL is required" };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const productData = await scrapeProduct(url);
    if (!productData.productName || !productData.currentPrice) {
      return { error: "Could not extract product information from this URL" };
    }

    return await _saveProductToDb(supabase, user.id, url, productData);
  } catch (error) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

// single url add — used by the progressive adding loop in the client
export async function addProductByUrl(url) {
  if (!url) return { error: "URL is required" };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    console.log(`Scraping and adding: ${url}`);
    const productData = await scrapeProduct(url);

    if (!productData.productName || !productData.currentPrice) {
      return { error: "Could not extract product data from this page" };
    }

    return await _saveProductToDb(supabase, user.id, url, productData);
  } catch (error) {
    console.error("addProductByUrl error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

// saves already-scraped product data (used for the original in url-compare mode — avoids re-scraping)
export async function addScrapedProduct(productData, url) {
  if (!productData || !url) return { error: "Product data and URL are required" };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    return await _saveProductToDb(supabase, user.id, url, productData);
  } catch (error) {
    console.error("addScrapedProduct error:", error);
    return { error: error.message || "Failed to save product" };
  }
}

// shared db save — used by addProductByUrl, addScrapedProduct, and addProduct

async function _saveProductToDb(supabase, userId, url, productData) {
  const newPrice = parseFloat(productData.currentPrice);
  const currency = productData.currencyCode || "INR";

  const dealScore = calculateDealScore({
    rating: productData.rating,
    reviewCount: productData.reviewCount,
    sellerRating: productData.sellerRating,
    sellerName: productData.sellerName,
    platformDomain: productData.platformDomain,
  });

  const { data: existing } = await supabase
    .from("products")
    .select("id, current_price")
    .eq("user_id", userId)
    .eq("url", url)
    .single();

  const { data: product, error } = await supabase
    .from("products")
    .upsert(
      {
        user_id: userId,
        url,
        name: productData.productName,
        current_price: newPrice,
        currency,
        image_url: productData.productImageUrl || null,
        original_price: productData.originalPrice ? parseFloat(productData.originalPrice) : null,
        seller_name: productData.sellerName || null,
        rating: productData.rating || null,
        review_count: productData.reviewCount || 0,
        platform_domain: productData.platformDomain || null,
        deal_score: dealScore.score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,url", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) throw error;

  const shouldLogHistory = !existing || existing.current_price !== newPrice;
  if (shouldLogHistory) {
    await supabase.from("price_history").insert({
      product_id: product.id,
      price: newPrice,
      currency,
    });
  }

  revalidatePath("/");
  return {
    success: true,
    product,
    dealScore,
    productName: productData.productName,
    message: existing ? "Product updated!" : "Product added!",
  };
}

// standard crud — delete, read products and history

export async function deleteProduct(productId) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw error;
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProducts() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getPriceHistory(productId) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}

// product discovery using google cse — no firecrawl credits used at this stage

// search by name — returns cse results with price/image from google's index
export async function searchProductsCSE(productName) {
  if (!productName || productName.trim().length < 3) {
    return { error: "Please enter at least 3 characters" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

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

// url compare — scrapes original once, then uses cse to find same product elsewhere
export async function findSimilarProductsCSE(url) {
  if (!url) return { error: "URL is required" };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // 1 firecrawl credit: scrape the original
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

    console.log(`Original: "${originalProduct.productName}" at ₹${originalProduct.currentPrice}`);

    // 0 firecrawl credits: serper search for the same product on other platforms
    const { searchProducts } = await import("@/lib/serper");
    let cseResults = [];

    try {
      const rawResults = await searchProducts(originalProduct.productName);
      // filter out results from the same platform as the original
      cseResults = rawResults.filter((r) => !url.includes(r.platform));
    } catch (cseError) {
      console.error("CSE search failed (non-fatal):", cseError.message);
    }

    return {
      success: true,
      original: {
        ...originalProduct,
        dealScore,
        url,
      },
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("user_id", user.id)
      .single();

    if (!product) return { error: "Product not found" };

    const { data: priceHistory } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });

    const { generateAIVerdict } = await import("@/lib/gemini-ai-verdict");
    const verdict = await generateAIVerdict(product, priceHistory || []);

    return { success: true, verdict };
  } catch (error) {
    console.error("getAIVerdict error:", error);
    return { error: error.message || "Failed to generate AI verdict" };
  }
}
