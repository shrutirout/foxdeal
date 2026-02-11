"use server";

import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { calculateDealScore } from "@/lib/dealScore";
import { findSimilarProductURLs, filterValidURLs } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// previewing product before saving to db
export async function previewProduct(url) {
  if (!url) {
    return { error: "URL is required" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const productData = await scrapeProduct(url);

    if (!productData.productName || !productData.currentPrice) {
      return { error: "Could not extract product information from this URL" };
    }

    const dealScoreResult = calculateDealScore({
      rating: productData.rating,
      reviewCount: productData.reviewCount,
      sellerRating: productData.sellerRating,
      sellerName: productData.sellerName,
      platformDomain: productData.platformDomain,
    });

    return {
      success: true,
      productData,
      dealScore: dealScoreResult,
    };
  } catch (error) {
    console.error("Preview product error:", error);
    return { error: error.message || "Failed to fetch product information" };
  }
}

export async function addProduct(formData) {
  const url = formData.get("url");

  if (!url) {
    return { error: "URL is required" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const productData = await scrapeProduct(url);

    if (!productData.productName || !productData.currentPrice) {
      console.log(productData, "productData");
      return { error: "Could not extract product information from this URL" };
    }

    const newPrice = parseFloat(productData.currentPrice);
    const currency = productData.currencyCode || "USD";

    const dealScoreResult = calculateDealScore({
      rating: productData.rating,
      reviewCount: productData.reviewCount,
      sellerRating: productData.sellerRating,
      sellerName: productData.sellerName,
      platformDomain: productData.platformDomain,
    });

    console.log("Deal Score Calculated:", {
      score: dealScoreResult.score,
      label: dealScoreResult.label,
      breakdown: dealScoreResult.breakdown,
    });

    // checking if product already exists for this user
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, current_price")
      .eq("user_id", user.id)
      .eq("url", url)
      .single();

    const isUpdate = !!existingProduct;

    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        {
          user_id: user.id,
          url,
          name: productData.productName,
          current_price: newPrice,
          currency: currency,
          image_url: productData.productImageUrl,
          original_price: productData.originalPrice
            ? parseFloat(productData.originalPrice)
            : null,
          seller_name: productData.sellerName || null,
          rating: productData.rating || null,
          review_count: productData.reviewCount || 0,
          platform_domain: productData.platformDomain || null,
          deal_score: dealScoreResult.score,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,url",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) throw error;

    // logging price history only if price actually changed
    const shouldAddHistory =
      !isUpdate || existingProduct.current_price !== newPrice;

    if (shouldAddHistory) {
      await supabase.from("price_history").insert({
        product_id: product.id,
        price: newPrice,
        currency: currency,
      });
    }

    revalidatePath("/");
    return {
      success: true,
      product,
      dealScore: dealScoreResult,
      message: isUpdate
        ? "Product updated with latest price!"
        : "Product added successfully!",
    };
  } catch (error) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

export async function deleteProduct(productId) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

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

// finding same product across other platforms using gemini
export async function findSimilarProducts(url) {
  if (!url) {
    return { error: "URL is required" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // scraping original product
    const originalProduct = await scrapeProduct(url);

    if (!originalProduct.productName || !originalProduct.currentPrice) {
      return { error: "Could not extract product information from this URL" };
    }

    const originalScore = calculateDealScore({
      rating: originalProduct.rating,
      reviewCount: originalProduct.reviewCount,
      sellerRating: originalProduct.sellerRating,
      sellerName: originalProduct.sellerName,
      platformDomain: originalProduct.platformDomain,
    });

    console.log("Original product scraped:", {
      name: originalProduct.productName,
      price: originalProduct.currentPrice,
      platform: originalProduct.platformDomain,
      score: originalScore.score
    });

    // asking gemini for alternative platform urls
    let geminiResult;
    try {
      geminiResult = await findSimilarProductURLs(originalProduct);
    } catch (geminiError) {
      console.error("Gemini analysis failed:", geminiError);

      return {
        success: true,
        original: {
          ...originalProduct,
          dealScore: originalScore,
          url,
        },
        alternatives: [],
        analysis: {
          brand: "Unknown",
          productName: originalProduct.productName,
          category: "Unknown",
          variant: ""
        },
        geminiError: geminiError.message,
      };
    }

    console.log("Gemini analysis complete:", {
      brand: geminiResult.analysis.brand,
      category: geminiResult.analysis.category,
      urlsFound: Object.values(geminiResult.urls).filter(u => u !== null).length
    });

    // filtering out invalid urls and the original platform
    const urlsToScrape = filterValidURLs(
      geminiResult.urls,
      originalProduct.platformDomain
    );

    console.log(`Found ${urlsToScrape.length} alternative platforms to scrape`);

    if (urlsToScrape.length === 0) {
      return {
        success: true,
        original: {
          ...originalProduct,
          dealScore: originalScore,
          url,
        },
        alternatives: [],
        analysis: geminiResult.analysis,
      };
    }

    // scraping all alternative urls in parallel
    const scrapePromises = urlsToScrape.map(async ({ platform, url: productUrl }) => {
      try {
        console.log(`Scraping ${platform}...`);

        const productData = await scrapeProduct(productUrl);

        const dealScore = calculateDealScore({
          rating: productData.rating,
          reviewCount: productData.reviewCount,
          sellerRating: productData.sellerRating,
          sellerName: productData.sellerName,
          platformDomain: productData.platformDomain,
        });

        console.log(`${platform} scraped successfully (Score: ${dealScore.score})`);

        return {
          ...productData,
          dealScore,
          url: productUrl,
        };
      } catch (error) {
        console.error(`Failed to scrape ${platform}:`, error.message);
        return null;
      }
    });

    const alternatives = (await Promise.all(scrapePromises)).filter(Boolean);

    console.log(`Successfully scraped ${alternatives.length}/${urlsToScrape.length} alternatives`);

    // sorting by deal score, best first
    alternatives.sort((a, b) => b.dealScore.score - a.dealScore.score);

    console.log("Top 3 alternatives:", alternatives.slice(0, 3).map(p => ({
      platform: p.platformDomain,
      score: p.dealScore.score,
      price: p.currentPrice
    })));

    return {
      success: true,
      original: {
        ...originalProduct,
        dealScore: originalScore,
        url,
      },
      alternatives,
      analysis: geminiResult.analysis,
    };

  } catch (error) {
    console.error("Find similar products error:", error);
    return {
      error: error.message || "Failed to find similar products"
    };
  }
}

// batch adding multiple products from comparison modal
export async function addMultipleProducts(urls) {
  if (!urls || urls.length === 0) {
    return { error: "No URLs provided" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const results = {
      added: 0,
      failed: 0,
      errors: [],
    };

    // processing sequentially to avoid overwhelming apis
    for (const url of urls) {
      try {
        const formData = new FormData();
        formData.append("url", url);

        const result = await addProduct(formData);

        if (result.error) {
          results.failed++;
          results.errors.push({ url, error: result.error });
        } else {
          results.added++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ url, error: error.message });
      }
    }

    return {
      success: true,
      ...results,
      message: `Successfully added ${results.added} product(s). ${results.failed} failed.`
    };

  } catch (error) {
    console.error("Add multiple products error:", error);
    return { error: error.message || "Failed to add products" };
  }
}

// searching products by name across platforms using gemini + firecrawl
export async function searchProductsByName(productName) {
  if (!productName || productName.trim().length < 3) {
    return { error: "Please enter at least 3 characters" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    console.log(`Searching: "${productName}"`);

    const { analyzeProductForSearch, buildSearchURLs, validateSearchURL } = await import("@/lib/gemini-search-working");

    const analysis = await analyzeProductForSearch(productName.trim());

    if (!analysis.success || !analysis.searchQuery) {
      return {
        success: false,
        error: "Failed to analyze product search",
        products: []
      };
    }

    console.log(`Search query: "${analysis.searchQuery}", Category: ${analysis.productAnalysis?.category || 'Unknown'}`);

    const searchURLs = buildSearchURLs(analysis.searchQuery, analysis.platforms || []);

    if (searchURLs.length === 0) {
      return {
        success: true,
        products: [],
        analysis: analysis.productAnalysis,
        message: "No platforms available for this product category"
      };
    }

    const validSearchURLs = searchURLs.filter(validateSearchURL);
    console.log(`${validSearchURLs.length} valid search URLs to scrape`);

    if (validSearchURLs.length === 0) {
      return {
        success: true,
        products: [],
        analysis: analysis.productAnalysis,
        message: "No valid search URLs generated"
      };
    }

    // scraping search result pages in parallel
    const scrapePromises = validSearchURLs.map(async ({ platform, url, searchQuery }) => {
      try {
        console.log(`Scraping ${platform} search results...`);

        const productData = await scrapeProduct(url);

        if (!productData.productName || !productData.currentPrice) {
          console.log(`${platform}: no valid product found`);
          return null;
        }

        const dealScore = calculateDealScore({
          rating: productData.rating,
          reviewCount: productData.reviewCount,
          sellerRating: productData.sellerRating,
          sellerName: productData.sellerName,
          platformDomain: productData.platformDomain,
        });

        console.log(`${platform}: ${productData.productName} - ${productData.currentPrice} (Score: ${dealScore.score})`);

        return {
          platform,
          productData,
          dealScore,
          url: productData.productUrl || url,
          searchQuery,
          fromSearchResults: true
        };

      } catch (error) {
        console.error(`${platform} scrape failed:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(scrapePromises);
    const products = results.filter(Boolean);

    console.log(`Found ${products.length} products`);

    if (products.length === 0) {
      return {
        success: true,
        products: [],
        analysis: analysis.productAnalysis,
        totalFound: 0,
        message: "No products found. Try being more specific with your search."
      };
    }

    products.sort((a, b) => b.dealScore.score - a.dealScore.score);

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.platform} - Score: ${product.dealScore.score}/100`);
    });

    return {
      success: true,
      products,
      analysis: analysis.productAnalysis,
      totalFound: products.length,
      searchQuery: analysis.searchQuery
    };

  } catch (error) {
    console.error("Search products error:", error);
    return {
      error: error.message || "Failed to search for products",
      products: []
    };
  }
}
