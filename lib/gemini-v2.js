// v2: generating search urls instead of guessing product urls, then scraping search results

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// search url builders per platform
const SEARCH_URL_BUILDERS = {
  "amazon.in": (query) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
  "flipkart.com": (query) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
  "myntra.com": (query) => `https://www.myntra.com/${encodeURIComponent(query.replace(/ /g, '-'))}`,
  "snapdeal.com": (query) => `https://www.snapdeal.com/search?keyword=${encodeURIComponent(query)}`,
  "tatacliq.com": (query) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`,
};

// extracting search terms and relevant platforms from product data
export async function analyzeProductForSearch(productData) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.2 }
    });

    const prompt = `Analyze this product and extract search information:

Product: ${productData.productName}
Price: ₹${productData.currentPrice}

Extract:
1. Brand (e.g., "Nike", "Apple", "Samsung")
2. Product type (e.g., "Quest 6 Running Shoes", "iPhone 15", "Galaxy S24")
3. Key variant details (color, size, storage, model number)
4. Product category
5. Which Indian e-commerce platforms sell this category?

Return ONLY this JSON:
{
  "brand": "brand name",
  "productType": "product type",
  "variant": "variant details",
  "category": "category",
  "searchQuery": "brand + product type + variant",
  "platforms": ["platform1.com", "platform2.com"]
}

Platform guidelines:
- Electronics (phones, laptops, TVs): amazon.in, flipkart.com, snapdeal.com, tatacliq.com
- Fashion/Footwear: amazon.in, flipkart.com, myntra.com, snapdeal.com, tatacliq.com
- Beauty/Cosmetics: amazon.in, flipkart.com, myntra.com, nykaa.com
- Others: amazon.in, flipkart.com

searchQuery should be: "{brand} {productType} {variant}" (e.g., "Nike Quest 6 Running Shoes Black Size 6")`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);

    console.log("Gemini analysis:", data);

    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error(`Gemini analysis failed: ${error.message}`);
  }
}

// building search urls for each platform, skipping the one we already have
export function generateSearchURLs(searchQuery, platforms, originalPlatform) {
  const urls = [];

  for (const platform of platforms) {
    if (platform === originalPlatform) continue;

    const urlBuilder = SEARCH_URL_BUILDERS[platform];
    if (!urlBuilder) {
      console.log(`No search URL builder for ${platform}, skipping`);
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
