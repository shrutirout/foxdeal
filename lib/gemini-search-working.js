// pragmatic approach: building search urls instead of guessing product urls

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// platform-specific search url builders (no snapdeal)
const SEARCH_URL_BUILDERS = {
  "amazon.in": (query) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
  "flipkart.com": (query) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
  "myntra.com": (query) => `https://www.myntra.com/${encodeURIComponent(query.replace(/ /g, '-'))}`,
  "tatacliq.com": (query) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`,
  "ajio.com": (query) => `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`,
  "croma.com": (query) => `https://www.croma.com/searchB?q=${encodeURIComponent(query)}`,
  "reliancedigital.in": (query) => `https://www.reliancedigital.in/search?q=${encodeURIComponent(query)}`,
  "vijaysales.com": (query) => `https://www.vijaysales.com/search/${encodeURIComponent(query)}`,
};

// using gemini to extract optimized search terms from product name
export async function analyzeProductForSearch(productName) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3
      }
    });

    const prompt = `You are a product search expert. Analyze this product query and help create the best search terms.

USER QUERY: "${productName}"

YOUR TASK:
1. Extract the brand (if mentioned)
2. Identify the product type/category
3. Extract key specifications (color, size, model, storage, etc.)
4. Determine which Indian e-commerce platforms sell this category
5. Create an OPTIMIZED SEARCH QUERY that will find this product

Return ONLY this JSON (no markdown):
{
  "productAnalysis": {
    "brand": "brand name or null",
    "productType": "type of product",
    "category": "category (Electronics, Fashion, Beauty, Home, etc.)",
    "specifications": "key specs like color, size, model"
  },
  "searchQuery": "optimized search string",
  "platforms": ["platform1.com", "platform2.com"],
  "confidence": "high/medium/low"
}

PLATFORM SELECTION RULES:
- Electronics (phones, laptops, TVs, headphones, cameras, appliances): amazon.in, flipkart.com, tatacliq.com, croma.com, reliancedigital.in, vijaysales.com
- Fashion/Footwear (clothing, shoes, bags, watches): amazon.in, flipkart.com, myntra.com, tatacliq.com, ajio.com
- Beauty/Cosmetics (makeup, skincare, fragrance): amazon.in, flipkart.com, myntra.com
- Home/Furniture (decor, kitchen): amazon.in, flipkart.com, tatacliq.com
- Sports/Fitness: amazon.in, flipkart.com, tatacliq.com
- Books/Media: amazon.in, flipkart.com
- Generic/Unknown: amazon.in, flipkart.com

SEARCH QUERY RULES:
- Include brand + product type + key specs
- Keep it concise (4-8 words)
- Use terms that appear in product titles
- Example: "iPhone 15" → "Apple iPhone 15 Black 128GB"
- Example: "nike shoes" → "Nike Quest 6 Running Shoes"
- Example: "laptop" → "Dell XPS 13 Laptop Intel i7"

CRITICAL:
- NEVER include "snapdeal.com" in platforms
- Include 3-6 platforms where this product category is commonly sold (more platforms = better comparison)
- Be specific with search query to get better matches`;

    console.log("Gemini: Analyzing product search...");
    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // stripping markdown code fences
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", text);

      // falling back to basic search on main platforms
      return {
        success: true,
        productAnalysis: {
          brand: null,
          productType: "Unknown",
          category: "General",
          specifications: null
        },
        searchQuery: productName.trim(),
        platforms: ["amazon.in", "flipkart.com"],
        confidence: "low",
        fallback: true
      };
    }

    console.log("Gemini analysis complete");
    console.log(`  Category: ${data.productAnalysis?.category || 'Unknown'}`);
    console.log(`  Search Query: "${data.searchQuery}"`);
    console.log(`  Platforms: ${data.platforms?.length || 0}`);

    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Gemini analysis error:", error);

    // falling back to original query on main platforms
    return {
      success: true,
      productAnalysis: {
        brand: null,
        productType: "Unknown",
        category: "General",
        specifications: null
      },
      searchQuery: productName.trim(),
      platforms: ["amazon.in", "flipkart.com"],
      confidence: "low",
      fallback: true,
      error: error.message
    };
  }
}

// building search urls for each platform from the optimized query
export function buildSearchURLs(searchQuery, platforms) {
  const urls = [];

  const validPlatforms = platforms.filter(p => p !== 'snapdeal.com');

  for (const platform of validPlatforms) {
    const urlBuilder = SEARCH_URL_BUILDERS[platform];

    if (!urlBuilder) {
      console.warn(`No search URL builder for ${platform}, skipping`);
      continue;
    }

    try {
      const searchURL = urlBuilder(searchQuery);
      urls.push({
        platform,
        url: searchURL,
        type: 'search',
        searchQuery
      });
      console.log(`  ${platform}: ${searchURL}`);
    } catch (error) {
      console.error(`  Failed to build search URL for ${platform}:`, error);
    }
  }

  console.log(`Built ${urls.length} search URLs`);
  return urls;
}

export function validateSearchURL(urlData) {
  if (!urlData.platform || !urlData.url) {
    return false;
  }

  if (!urlData.url.startsWith('https://')) {
    return false;
  }

  // blocking snapdeal
  if (urlData.platform === 'snapdeal.com' || urlData.url.includes('snapdeal.com')) {
    console.warn("Blocked Snapdeal URL");
    return false;
  }

  if (!urlData.url.includes(urlData.platform)) {
    return false;
  }

  return true;
}
