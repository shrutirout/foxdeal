// google custom search engine for finding products across indian e-commerce platforms
// returns real product page urls from google's index — no firecrawl credits used for discovery

const CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const CSE_ID = process.env.GOOGLE_CSE_ID;

const PLATFORM_NAMES = {
  "amazon.in": "Amazon India",
  "flipkart.com": "Flipkart",
  "myntra.com": "Myntra",
  "ajio.com": "Ajio",
  "tatacliq.com": "Tata CLiQ",
  "croma.com": "Croma",
  "reliancedigital.in": "Reliance Digital",
  "vijaysales.com": "Vijay Sales",
  "meesho.com": "Meesho",
  "jiomart.com": "JioMart",
  "nykaa.com": "Nykaa",
  "pepperfry.com": "Pepperfry",
  "firstcry.com": "FirstCry",
  "lenskart.com": "Lenskart",
  "boat-lifestyle.com": "boAt",
  "shopclues.com": "ShopClues",
};

function extractPlatform(url) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    for (const [domain, name] of Object.entries(PLATFORM_NAMES)) {
      if (hostname.includes(domain)) {
        return { domain, name };
      }
    }
    const parts = hostname.split(".");
    return {
      domain: hostname,
      name: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
    };
  } catch {
    return { domain: "unknown", name: "Unknown" };
  }
}

function extractPrice(item) {
  const pagemap = item.pagemap || {};

  // schema.org offer
  if (pagemap.offer?.[0]?.price) {
    const price = parseFloat(String(pagemap.offer[0].price).replace(/[^0-9.]/g, ""));
    if (!isNaN(price) && price > 0) return price;
  }

  // metatags: og:price:amount, product:price:amount, etc.
  const metatags = pagemap.metatags?.[0] || {};
  const priceFields = [
    "og:price:amount",
    "product:price:amount",
    "twitter:data1",
    "price",
  ];
  for (const field of priceFields) {
    if (metatags[field]) {
      const price = parseFloat(String(metatags[field]).replace(/[^0-9.]/g, ""));
      if (!isNaN(price) && price > 0) return price;
    }
  }

  return null;
}

function extractImage(item) {
  const pagemap = item.pagemap || {};

  if (pagemap.cse_thumbnail?.[0]?.src) return pagemap.cse_thumbnail[0].src;
  if (pagemap.cse_image?.[0]?.src) return pagemap.cse_image[0].src;

  const metatags = pagemap.metatags?.[0] || {};
  if (metatags["og:image"]) return metatags["og:image"];
  if (metatags["twitter:image"]) return metatags["twitter:image"];

  return null;
}

// main search function — returns product results from google's index
// maxPerPlatform limits how many results per e-commerce site
export async function searchProducts(query, { maxPerPlatform = 2 } = {}) {
  if (!CSE_API_KEY || !CSE_ID) {
    throw new Error(
      "Google CSE not configured. Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to environment variables."
    );
  }

  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${CSE_API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=10`;

  console.log(`CSE search: "${query}"`);

  const res = await fetch(apiUrl);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData.error?.message || `CSE API error: ${res.status}`;
    console.error("CSE API error:", message);
    throw new Error(message);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    console.log("CSE: no results");
    return [];
  }

  console.log(`CSE: ${data.items.length} raw results`);

  // group by platform, keep top maxPerPlatform per site
  const byPlatform = {};

  for (const item of data.items) {
    const { domain, name } = extractPlatform(item.link);

    if (!byPlatform[domain]) byPlatform[domain] = [];
    if (byPlatform[domain].length >= maxPerPlatform) continue;

    byPlatform[domain].push({
      title: item.title,
      link: item.link,
      snippet: item.snippet || "",
      platform: domain,
      platformName: name,
      price: extractPrice(item),
      image: extractImage(item),
    });
  }

  const results = Object.values(byPlatform).flat();
  console.log(
    `CSE: ${results.length} results across ${Object.keys(byPlatform).length} platforms`
  );

  return results;
}
