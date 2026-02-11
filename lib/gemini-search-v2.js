// autonomous search approach: gemini finds real product listings using google search grounding

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// using gemini with google search to find actual product page urls
export async function findProductListings(productName) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
      },
      tools: [{
        googleSearch: {}
      }]
    });

    const prompt = `You are a product search expert with access to Google Search. Your job is to find REAL, CURRENT product listings.

USER IS LOOKING FOR: "${productName}"

YOUR TASK:
1. USE GOOGLE SEARCH to find where this product is currently sold in India
2. Search specifically for this product on: Amazon.in, Flipkart, Myntra, Tata CLiQ, etc.
3. Extract the ACTUAL product page URLs from real search results
4. IMPORTANT: Use Google Search to find real, current URLs - don't guess or make up URLs
5. Only include URLs that you found through Google Search
6. Verify the product exists by checking the search results

CRITICAL RULES:
- Return ONLY direct product page URLs (not search URLs)
- Include ONLY platforms where this exact product exists
- Use real URL patterns for each platform
- Be conservative - if unsure, don't include it
- Variable results: Could be 1 URL, could be 8 URLs - quality over quantity
- Exclude: Snapdeal, unknown sites, unreliable sources
- Focus on: Amazon.in, Flipkart, Myntra, Tata CLiQ, Nykaa, BigBasket, Lenskart, etc.

RESPONSE FORMAT (JSON, no markdown):
{
  "productAnalysis": {
    "brand": "identified brand",
    "productType": "what type of product",
    "category": "category",
    "specifications": "key specs if any"
  },
  "listings": [
    {
      "platform": "amazon.in",
      "url": "https://www.amazon.in/exact-product-url",
      "confidence": "high/medium",
      "notes": "why you think this is accurate"
    },
    {
      "platform": "flipkart.com",
      "url": "https://www.flipkart.com/exact-product-url",
      "confidence": "high/medium",
      "notes": "brief explanation"
    }
  ]
}

EXAMPLES OF GOOD VS BAD:

GOOD Example (High confidence):
Input: "iPhone 15 Pro Max 256GB Natural Titanium"
Output: {
  "listings": [
    {
      "platform": "amazon.in",
      "url": "https://www.amazon.in/Apple-iPhone-Pro-Max-256/dp/B0CHX...",
      "confidence": "high",
      "notes": "Apple flagship, widely available on Amazon India"
    },
    {
      "platform": "flipkart.com",
      "url": "https://www.flipkart.com/apple-iphone-15-pro-max-natural-titanium-256-gb/p/...",
      "confidence": "high",
      "notes": "Official Apple product, Flipkart authorized seller"
    }
  ]
}

BAD Example (Don't do this):
- Don't include made-up URLs
- Don't include platforms that don't sell this category
- Don't include search URLs
- Don't include generic/placeholder URLs

If you cannot find ANY confident matches, return empty listings array:
{
  "productAnalysis": {...},
  "listings": []
}

Now find real listings for: "${productName}"`;

    console.log("Gemini: searching for product listings...");
    console.log("Query:", productName);

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", text);

      return {
        success: false,
        error: "Gemini returned invalid response format",
        listings: []
      };
    }

    console.log("Gemini found", data.listings?.length || 0, "listings");

    if (data.listings && data.listings.length > 0) {
      data.listings.forEach((listing, i) => {
        console.log(`  ${i + 1}. ${listing.platform} (${listing.confidence})`);
      });
    }

    return {
      success: true,
      productAnalysis: data.productAnalysis,
      listings: data.listings || [],
      totalFound: data.listings?.length || 0
    };

  } catch (error) {
    console.error("Gemini error:", error);

    return {
      success: false,
      error: error.message,
      listings: [],
      totalFound: 0
    };
  }
}

// checking if a listing url looks like a real product page
export function validateListing(listing) {
  if (!listing.platform || !listing.url) return false;
  if (!listing.url.startsWith('https://')) return false;
  if (!listing.url.includes(listing.platform)) return false;

  const badPatterns = [
    '/search?',
    '/s?k=',
    'snapdeal.com',
    'example.com'
  ];

  for (const pattern of badPatterns) {
    if (listing.url.includes(pattern)) {
      return false;
    }
  }

  return true;
}
