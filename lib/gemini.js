import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// platforms gemini will search for cross-platform matching
const SUPPORTED_PLATFORMS = [
  "amazon.in",
  "flipkart.com",
  "myntra.com",
  "ajio.com",
  "snapdeal.com",
  "tatacliq.com",
  "nykaa.com",
  "bigbasket.com",
  "lenskart.com",
  "firstcry.com",
  "pepperfry.com",
  "boat-lifestyle.com",
];

export async function findSimilarProductURLs(productData) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3,
      }
    });

    const prompt = buildGeminiPrompt(productData);

    console.log("Sending request to Gemini AI...");

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    console.log("Gemini raw response:", text);

    // stripping markdown code fences from response
    let data;
    try {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON response:", parseError);
      console.error("Raw text:", text);
      throw new Error("Gemini returned invalid JSON format");
    }

    if (!data.analysis || !data.urls) {
      throw new Error("Gemini response missing required fields (analysis or urls)");
    }

    console.log("Gemini Analysis:", {
      brand: data.analysis.brand,
      category: data.analysis.category,
      platformsFound: Object.keys(data.urls).filter(k => data.urls[k] !== null).length
    });

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

function buildGeminiPrompt(productData) {
  const platformList = SUPPORTED_PLATFORMS.join(", ");

  return `You are a product URL generator for Indian e-commerce platforms. Your job is to generate direct product page URLs where this EXACT product is sold.

PRODUCT DETAILS:
- Name: ${productData.productName}
- Price: ₹${productData.currentPrice}
- Platform: ${productData.platformDomain || 'unknown'}
${productData.rating ? `- Rating: ${productData.rating}/5 (${productData.reviewCount || 0} reviews)` : ''}

TASK: Generate direct product page URLs for the EXACT same product on these platforms:
${platformList}

URL GENERATION RULES:
1. Generate URLs using standard e-commerce URL patterns
2. For popular products (iPhone, Samsung, Nike, etc.), they are likely available on Amazon, Flipkart, Snapdeal, Tata CLiQ
3. Match the EXACT variant (color, size, storage, model number)
4. Category-specific platforms:
   - Myntra/Ajio: Fashion, Accessories, Beauty
   - Nykaa: Cosmetics, Beauty, Personal Care
   - BigBasket: Groceries, Food
   - Lenskart: Eyewear only
   - FirstCry: Baby products only
   - Pepperfry: Furniture, Home Decor
   - Boat: Electronics, Audio accessories
5. Use null only if the platform doesn't sell that category

URL PATTERNS (examples):
- amazon.in: https://www.amazon.in/[product-name]/dp/[ASIN]
- flipkart.com: https://www.flipkart.com/[product-name]/p/[ID]
- snapdeal.com: https://www.snapdeal.com/product/[product-name]/[ID]
- tatacliq.com: https://www.tatacliq.com/[product-name]/p-[ID]

Return in this JSON format (no markdown, no code blocks):
{
  "analysis": {
    "brand": "brand",
    "productName": "clean name",
    "category": "category",
    "variant": "specifications"
  },
  "urls": {
    "amazon.in": "url or null",
    "flipkart.com": "url or null",
    "myntra.com": "url or null",
    "ajio.com": "url or null",
    "snapdeal.com": "url or null",
    "tatacliq.com": "url or null",
    "nykaa.com": "url or null",
    "bigbasket.com": "url or null",
    "lenskart.com": "url or null",
    "firstcry.com": "url or null",
    "pepperfry.com": "url or null",
    "boat-lifestyle.com": "url or null"
  }
}`;
}

export function isValidProductURL(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'https:') return false;

    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    const productPatterns = [
      '/dp/',
      '/p/',
      '/product/',
      '/buy/',
      '/pdt/',
    ];

    const hasProductPattern = productPatterns.some(pattern => pathname.includes(pattern));

    // filtering out search and category pages
    const invalidPatterns = ['/search', '/s?', '/category', '/browse'];
    const hasInvalidPattern = invalidPatterns.some(pattern => pathname.includes(pattern));

    return hasProductPattern && !hasInvalidPattern;

  } catch (error) {
    return false;
  }
}

// filtering gemini urls, excluding original platform and invalid ones
export function filterValidURLs(geminiUrls, originalPlatform) {
  return Object.entries(geminiUrls)
    .filter(([platform, url]) => {
      if (url === null) return false;
      if (platform === originalPlatform) return false;

      if (!isValidProductURL(url)) {
        console.warn(`Invalid URL for ${platform}:`, url);
        return false;
      }

      return true;
    })
    .map(([platform, url]) => ({ platform, url }));
}
