import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// building search urls per platform, snapdeal excluded
const SEARCH_URL_BUILDERS = {
  "amazon.in": (query) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
  "flipkart.com": (query) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
  "myntra.com": (query) => `https://www.myntra.com/search?q=${encodeURIComponent(query)}`,
  "tatacliq.com": (query) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`,
};

// using gemini to optimize the search query and pick relevant platforms
export async function analyzeProductSearch(productName) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.3 }
    });

    const prompt = `Analyze this product search query and help optimize it:

User Query: "${productName}"

Tasks:
1. Identify the product category
2. Extract brand name if mentioned
3. Extract key specifications (color, size, model, storage, etc.)
4. Determine which Indian e-commerce platforms are likely to sell this product
5. Create an optimized search query

Return ONLY this JSON (no markdown):
{
  "category": "category name (Electronics, Fashion, Beauty, Groceries, etc.)",
  "brand": "brand name or null",
  "specifications": "key specs or null",
  "optimizedQuery": "improved search query",
  "platforms": ["platform1.com", "platform2.com"],
  "confidence": "high/medium/low"
}

Platform selection rules:
- Electronics (phones, laptops, TVs, headphones): amazon.in, flipkart.com, tatacliq.com
- Fashion (clothing, shoes, accessories): amazon.in, flipkart.com, myntra.com, tatacliq.com
- Beauty/Cosmetics: amazon.in, flipkart.com, myntra.com
- Home/Furniture: amazon.in, flipkart.com, tatacliq.com
- Generic/Unknown: amazon.in, flipkart.com

Example:
Input: "iphone 15 black 128gb"
Output: {
  "category": "Electronics - Smartphones",
  "brand": "Apple",
  "specifications": "Black, 128GB",
  "optimizedQuery": "Apple iPhone 15 Black 128GB",
  "platforms": ["amazon.in", "flipkart.com", "tatacliq.com"],
  "confidence": "high"
}`;

    console.log("Analyzing product search:", productName);

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);

    console.log("Gemini search analysis:", data);

    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Gemini search analysis error:", error);

    // falling back to raw query on main platforms
    return {
      success: true,
      category: "Unknown",
      brand: null,
      specifications: null,
      optimizedQuery: productName,
      platforms: ["amazon.in", "flipkart.com"],
      confidence: "low",
      fallback: true
    };
  }
}

// generating search urls for each platform from the optimized query
export function buildSearchURLs(searchQuery, platforms) {
  const urls = [];

  for (const platform of platforms) {
    const urlBuilder = SEARCH_URL_BUILDERS[platform];

    if (!urlBuilder) {
      console.warn(`No search URL builder for ${platform}`);
      continue;
    }

    try {
      const searchURL = urlBuilder(searchQuery);
      urls.push({
        platform,
        url: searchURL,
        type: 'search'
      });
    } catch (error) {
      console.error(`Failed to build search URL for ${platform}:`, error);
    }
  }

  return urls;
}
