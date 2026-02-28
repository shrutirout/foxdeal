"use server";

import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { calculateDealScore } from "@/lib/dealScore";
// gemini.js kept for reference but url compare now uses gemini-search-working approach
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

// checking if a scraped product is actually the same product as the original
// key numbers in product names (model gen, storage, year) must all match
function isSameProduct(originalName, scrapedName) {
  if (!originalName || !scrapedName) return false;

  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const origNorm = normalize(originalName);
  const scrapedNorm = normalize(scrapedName);

  // numbers are the most critical differentiator: "iphone 15" vs "iphone 17", "128gb" vs "256gb"
  // every 2+ digit number in the original must appear in the scraped name
  const origNumbers = origNorm.match(/\b\d{2,}\b/g) || [];
  const scrapedNumbers = new Set(scrapedNorm.match(/\b\d{2,}\b/g) || []);

  for (const num of origNumbers) {
    if (!scrapedNumbers.has(num)) {
      console.log(`Product mismatch: number "${num}" in original not found in scraped`);
      return false;
    }
  }

  // general word overlap — brand + product type must be present
  const origWords = origNorm.split(" ").filter((w) => w.length > 2);
  const scrapedWords = new Set(scrapedNorm.split(" ").filter((w) => w.length > 2));

  let matches = 0;
  for (const word of origWords) {
    if (scrapedWords.has(word)) matches++;
  }

  const matchRatio = origWords.length > 0 ? matches / origWords.length : 0;
  return matchRatio >= 0.35;
}

// finding same product across other platforms using search urls + firecrawl productUrl extraction
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
    });

    // using gemini search analysis to build platform search urls (more reliable than url generation)
    const { analyzeProductForSearch, buildSearchURLs, validateSearchURL } =
      await import("@/lib/gemini-search-working");

    let searchAnalysis;
    try {
      searchAnalysis = await analyzeProductForSearch(originalProduct.productName);
    } catch (analysisError) {
      console.error("Search analysis failed:", analysisError);
      return {
        success: true,
        original: { ...originalProduct, dealScore: originalScore, url },
        alternatives: [],
        analysis: { productName: originalProduct.productName },
        geminiError: analysisError.message,
      };
    }

    const searchURLs = buildSearchURLs(
      searchAnalysis.searchQuery || originalProduct.productName,
      searchAnalysis.platforms || ["amazon.in", "flipkart.com"]
    );

    // filtering out the platform the original product is already on
    const platformsToSearch = searchURLs
      .filter(validateSearchURL)
      .filter(({ platform }) => !url.includes(platform));

    console.log(`Searching ${platformsToSearch.length} other platforms for: "${searchAnalysis.searchQuery}"`);

    if (platformsToSearch.length === 0) {
      return {
        success: true,
        original: { ...originalProduct, dealScore: originalScore, url },
        alternatives: [],
        analysis: searchAnalysis.productAnalysis || { productName: originalProduct.productName },
      };
    }

    // scraping search result pages in parallel and extracting actual product urls via firecrawl
    const scrapePromises = platformsToSearch.map(async ({ platform, url: searchUrl }) => {
      try {
        console.log(`Searching ${platform}...`);

        const productData = await scrapeProduct(searchUrl);

        if (!productData.productName || !productData.currentPrice) {
          console.log(`${platform}: no valid product extracted from search results`);
          return null;
        }

        // rejecting results that don't match the original product (wrong variant/generation)
        if (!isSameProduct(originalProduct.productName, productData.productName)) {
          console.log(
            `${platform}: product mismatch — original: "${originalProduct.productName}", found: "${productData.productName}". Skipping.`
          );
          return null;
        }

        // requiring an image — a product card without an image is not useful
        if (!productData.productImageUrl) {
          console.log(`${platform}: no image found, skipping`);
          return null;
        }

        // using the actual product page url extracted by firecrawl, not the search url
        const actualProductUrl = productData.productUrl || searchUrl;

        const dealScore = calculateDealScore({
          rating: productData.rating,
          reviewCount: productData.reviewCount,
          sellerRating: productData.sellerRating,
          sellerName: productData.sellerName,
          platformDomain: productData.platformDomain,
        });

        console.log(`${platform}: found "${productData.productName}" at ${productData.currentPrice} (Score: ${dealScore.score})`);

        return {
          ...productData,
          dealScore,
          url: actualProductUrl,
        };
      } catch (error) {
        console.error(`${platform} search failed:`, error.message);
        return null;
      }
    });

    const alternatives = (await Promise.all(scrapePromises)).filter(Boolean);

    console.log(`Found ${alternatives.length} matching products across other platforms`);

    // sorting by deal score, best first
    alternatives.sort((a, b) => b.dealScore.score - a.dealScore.score);

    return {
      success: true,
      original: {
        ...originalProduct,
        dealScore: originalScore,
        url,
      },
      alternatives,
      analysis: searchAnalysis.productAnalysis || { productName: originalProduct.productName },
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
