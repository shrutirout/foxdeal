import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// platforms to search across for cross-platform price comparison
const SUPPORTED_PLATFORMS = [
  "amazon.in",
  "flipkart.com",
  "myntra.com",
  "ajio.com",
  "tatacliq.com",
  "nykaa.com",
  "lenskart.com",
  "firstcry.com",
  "pepperfry.com",
  "boat-lifestyle.com",
  "croma.com",
  "reliancedigital.in",
];

export async function findSimilarProductURLs(productData) {
  try {
    // using google search grounding so gemini finds real urls, not guessed ones
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
      },
      tools: [{ googleSearch: {} }],
    });

    const prompt = buildStrictSearchPrompt(productData);

    console.log("Searching for product across platforms via Google Search...");

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    console.log("Gemini raw response:", text);

    // stripping markdown fences and citation markers from grounding response
    text = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/\[\d+\]/g, "")
      .trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON response:", parseError);
      console.error("Raw text:", text);
      throw new Error("Gemini returned invalid JSON format");
    }

    if (!data.analysis || !data.urls) {
      throw new Error("Gemini response missing required fields (analysis or urls)");
    }

    const foundCount = Object.values(data.urls).filter((u) => u !== null).length;
    console.log(`Gemini found ${foundCount} product URLs via Google Search`);

    return data;
  } catch (error) {
    console.error("Gemini API error:", error);

    if (error.message?.includes("API key")) {
      throw new Error("Invalid Gemini API key. Please check your .env.local file.");
    } else if (error.message?.includes("quota")) {
      throw new Error("Gemini API quota exceeded. Please try again later.");
    } else {
      throw new Error(`Gemini AI failed: ${error.message || "Unknown error"}`);
    }
  }
}

function buildStrictSearchPrompt(productData) {
  const { productName, currentPrice, platformDomain, rating, reviewCount, currencyCode } = productData;

  return `You are a product search expert. Use Google Search to find where this EXACT product is sold on Indian e-commerce platforms.

PRODUCT TO FIND:
- Full Name: ${productName}
- Current Price: ${currencyCode || "INR"} ${currentPrice}
- Currently listed on: ${platformDomain || "unknown"}
${rating ? `- Rating: ${rating}/5 (${reviewCount || 0} reviews)` : ""}

YOUR TASK:
Use Google Search to find the EXACT same product (same model, same color, same storage/size variant) on these platforms: ${SUPPORTED_PLATFORMS.join(", ")}

STRICT RULES — read these carefully:
1. USE GOOGLE SEARCH. Search for "${productName} site:amazon.in", "${productName} site:flipkart.com" etc. for each platform.
2. Only return URLs you actually found through Google Search. Never guess, construct, or make up URLs.
3. The product page you find must be for the EXACT same product — same model number, same color, same generation, same storage.
4. DO NOT return URLs for a different variant, a different color, or a newer/older generation.
5. DO NOT return search result pages (URLs containing /s?, /search, /s/, /query, ?k=, ?q=).
6. DO NOT return category pages, brand pages, or listing pages — only direct product pages.
7. DO NOT include snapdeal.com in results.
8. If you cannot find the product on a platform with high confidence, set that platform to null.
9. 2 confirmed real product URLs is far better than 8 guessed ones.

VALID URL PATTERNS (for reference):
- amazon.in: must contain /dp/ followed by an ASIN (e.g. https://www.amazon.in/product-name/dp/B0CXXXXX/)
- flipkart.com: must contain /p/ followed by an item ID (e.g. https://www.flipkart.com/product/p/itm...)
- myntra.com: must contain a numeric product ID (e.g. https://www.myntra.com/brand/product/123456/buy)
- tatacliq.com: must contain /p-mp followed by digits (e.g. https://www.tatacliq.com/product/p-mp123)
- croma.com: must contain /p/ (e.g. https://www.croma.com/product/p/12345)

INVALID EXAMPLES — never return these:
- https://www.amazon.in/s?k=iphone+15 (search page)
- https://www.flipkart.com/search?q=product (search page)
- https://www.myntra.com/iphone (category page)
- Any URL with /search, /s?, /category, /browse, ?q=, ?k= in it

Return ONLY valid JSON in this exact format (no markdown, no explanation, no extra text):
{
  "analysis": {
    "brand": "exact brand name",
    "productName": "full product name with variant",
    "category": "product category",
    "variant": "color/storage/size/model variant"
  },
  "urls": {
    "amazon.in": "exact url found via google search, or null",
    "flipkart.com": "exact url found via google search, or null",
    "myntra.com": "exact url found via google search, or null",
    "ajio.com": "exact url found via google search, or null",
    "tatacliq.com": "exact url found via google search, or null",
    "nykaa.com": "exact url found via google search, or null",
    "lenskart.com": "exact url found via google search, or null",
    "firstcry.com": "exact url found via google search, or null",
    "pepperfry.com": "exact url found via google search, or null",
    "boat-lifestyle.com": "exact url found via google search, or null",
    "croma.com": "exact url found via google search, or null",
    "reliancedigital.in": "exact url found via google search, or null"
  }
}`;
}

export function isValidProductURL(url) {
  if (!url || typeof url !== "string") return false;

  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== "https:") return false;

    const pathname = urlObj.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // rejecting search pages, category pages, brand listing pages
    const invalidPatterns = [
      "/search",
      "/s?",
      "/s/",
      "?k=",
      "?q=",
      "/category",
      "/browse",
      "/query",
      "/brand/",
      "/tag/",
    ];
    const hasInvalidPattern = invalidPatterns.some((p) => fullUrl.includes(p));
    if (hasInvalidPattern) return false;

    // requiring known product page patterns
    const productPatterns = ["/dp/", "/p/", "/product/", "/buy/", "/pdt/", "/p-mp"];
    const hasProductPattern = productPatterns.some((p) => pathname.includes(p));

    return hasProductPattern;
  } catch {
    return false;
  }
}

// filtering gemini urls, removing the original platform and any invalid ones
export function filterValidURLs(geminiUrls, originalPlatform) {
  return Object.entries(geminiUrls)
    .filter(([platform, url]) => {
      if (!url || url === null) return false;
      if (platform === originalPlatform) return false;

      if (!isValidProductURL(url)) {
        console.warn(`Rejected URL for ${platform} (failed validation):`, url);
        return false;
      }

      return true;
    })
    .map(([platform, url]) => ({ platform, url }));
}
