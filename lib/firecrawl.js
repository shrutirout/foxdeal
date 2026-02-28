import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

// scraping configs per platform
const PLATFORM_CONFIGS = {
  "amazon.in": {
    name: "Amazon India",
    waitTime: 5000,
    priceTerms: ["Price", "MRP", "Deal Price", "Offer Price", "Sale Price"],
    isIndian: true,
  },
  "flipkart.com": {
    name: "Flipkart",
    waitTime: 6000,
    priceTerms: ["Price", "Special Price", "Deal Price"],
    isIndian: true,
  },
  "myntra.com": {
    name: "Myntra",
    waitTime: 5000,
    priceTerms: ["Price", "Discounted Price", "MRP"],
    isIndian: true,
  },
  "ajio.com": {
    name: "Ajio",
    waitTime: 5000,
    priceTerms: ["Price", "Offer Price"],
    isIndian: true,
  },
  "tatacliq.com": {
    name: "Tata CLiQ",
    waitTime: 5000,
    priceTerms: ["Price", "Special Price", "Offer Price"],
    isIndian: true,
  },
  "croma.com": {
    name: "Croma",
    waitTime: 5000,
    priceTerms: ["Price", "Special Price", "MRP"],
    isIndian: true,
  },
  "reliancedigital.in": {
    name: "Reliance Digital",
    waitTime: 5000,
    priceTerms: ["Price", "Offer Price", "Deal Price"],
    isIndian: true,
  },
  "vijaysales.com": {
    name: "Vijay Sales",
    waitTime: 5000,
    priceTerms: ["Price", "Special Price"],
    isIndian: true,
  },
  "snapdeal.com": {
    name: "Snapdeal",
    waitTime: 5000,
    priceTerms: ["Price", "Selling Price"],
    isIndian: true,
  },
  "amazon.com": {
    name: "Amazon US",
    waitTime: 3000,
    priceTerms: ["Price"],
    isIndian: false,
  },
  "ebay.com": {
    name: "eBay",
    waitTime: 3000,
    priceTerms: ["Price"],
    isIndian: false,
  },
  "walmart.com": {
    name: "Walmart",
    waitTime: 3000,
    priceTerms: ["Price", "Sale Price"],
    isIndian: false,
  },
};

function detectPlatform(url) {
  // checking known platforms first
  for (const [domain, config] of Object.entries(PLATFORM_CONFIGS)) {
    if (url.includes(domain)) {
      return { domain, ...config };
    }
  }

  // extracting platform name from url for unknown platforms
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.replace('www.', '');
    let domainName = hostname.split('.')[0];
    const platformName = domainName.charAt(0).toUpperCase() + domainName.slice(1);

    return {
      domain: hostname,
      name: platformName,
      waitTime: 3000,
      priceTerms: ["Price", "MRP", "Sale Price", "Offer Price"],
      isIndian: hostname.includes('.in'),
    };
  } catch (e) {
    return {
      domain: "other",
      name: "E-commerce Site",
      waitTime: 3000,
      priceTerms: ["Price"],
      isIndian: false,
    };
  }
}

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function scrapeProduct(url) {
  const platform = detectPlatform(url);

  console.log(`Starting Firecrawl scrape for ${platform.name}`, {
    url,
    platform: platform.domain,
    isIndian: platform.isIndian,
    waitTime: platform.waitTime,
  });

  const scrapeFn = async () => {
    const result = await firecrawl.scrapeUrl(url, {
      formats: ["extract"],
      waitFor: platform.waitTime,
      timeout: 30000,

      headers: {
        "Accept-Language": platform.isIndian ? "en-IN,en;q=0.9" : "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },

      extract: {
        prompt: platform.isIndian
          ? `Extract product information from this ${platform.name} page:
             - Product name as 'productName'
             - Direct URL/link to the product page as 'productUrl'. If this is a search results page, extract the URL of the FIRST/TOP product listing shown. If this is a product page already, extract its canonical URL or the current page URL.
             - Current selling price as 'currentPrice' (look for: ${platform.priceTerms.join(", ")}). Extract ONLY the numeric value without ₹, Rs, commas, or any symbols.
             - Currency code as 'currencyCode' (use "INR" for Indian Rupees)
             - Main product image URL as 'productImageUrl'
             - Original MRP/list price as 'originalPrice' if available (without symbols)
             - Seller name as 'sellerName' if available
             - Seller rating as 'sellerRating' if available (0-5 scale, seller's overall rating on the platform)
             - Product rating as 'rating' if available (0-5 scale, this specific product's rating)
             - Number of reviews as 'reviewCount' if available

             Important: If multiple prices exist (MRP vs Sale Price), extract the LOWEST/OFFER price as currentPrice and the HIGHEST as originalPrice.`
          : `Extract product information:
             - Product name as 'productName'
             - Direct URL/link to the product page as 'productUrl'. If this is a search results page, extract the URL of the FIRST/TOP product listing. If this is a product page, use the current page URL.
             - Current price as 'currentPrice' (numeric value only, no currency symbols)
             - Currency code as 'currencyCode' (USD, EUR, GBP, etc.)
             - Product image URL as 'productImageUrl'
             - Original/list price as 'originalPrice' if available
             - Seller name as 'sellerName' if available
             - Seller rating as 'sellerRating' if available (0-5 scale, seller's overall rating)
             - Product rating as 'rating' if available (0-5 scale)
             - Review count as 'reviewCount' if available`,

        schema: {
          type: "object",
          properties: {
            productName: { type: "string" },
            productUrl: { type: "string" },
            currentPrice: { type: "number" },
            currencyCode: { type: "string" },
            productImageUrl: { type: "string" },
            originalPrice: { type: "number" },
            sellerName: { type: "string" },
            sellerRating: { type: "number" },
            rating: { type: "number" },
            reviewCount: { type: "number" },
          },
          required: ["productName", "currentPrice"],
        },
      },
    });

    console.log("Firecrawl raw result:", JSON.stringify(result, null, 2));

    const extractedData = result.extract || result.data;

    console.log("Extracted data:", extractedData);

    if (!extractedData || !extractedData.productName) {
      console.error("No valid data extracted. Full result:", result);
      throw new Error(
        `Could not extract product data from ${platform.name}. The page might be protected or have an unusual structure.`
      );
    }

    if (!extractedData.currentPrice || extractedData.currentPrice <= 0) {
      throw new Error("Could not extract a valid price from the product page.");
    }

    // attaching platform metadata to scraped result
    return {
      ...extractedData,
      platform: platform.name,
      platformDomain: platform.domain,
      scrapedAt: new Date().toISOString(),
    };
  };

  try {
    return await retryWithBackoff(scrapeFn, 3, 2000);
  } catch (error) {
    console.error("Firecrawl scrape error:", error);
    console.error("Error details:", error.response?.data || error.message);

    if (error.message.includes("API key")) {
      throw new Error("Firecrawl API key is invalid or missing. Please check your .env.local file.");
    } else if (error.message.includes("quota") || error.message.includes("limit")) {
      throw new Error("Firecrawl API quota exceeded. Please check your Firecrawl dashboard.");
    } else if (error.message.includes("timeout")) {
      throw new Error(
        `Request timed out while scraping ${platform.name}. The website might be slow or blocking automated requests.`
      );
    } else {
      throw new Error(`Failed to scrape from ${platform.name}: ${error.message}`);
    }
  }
}
