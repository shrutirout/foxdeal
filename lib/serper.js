// serper.dev — google shopping results via api
// free tier: 2500 queries on signup, no credit card needed
// sign up at serper.dev

const SERPER_API_KEY = process.env.SERPER_API_KEY;

const SUPPORTED_PLATFORMS = {
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
    for (const [domain, name] of Object.entries(SUPPORTED_PLATFORMS)) {
      if (hostname.includes(domain)) {
        return { domain, name };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// filters out category pages, search pages, store pages — only keeps individual product URLs
function isProductUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace("www.", "");

    // amazon: product pages have /dp/ in path
    if (host.includes("amazon.in")) return pathname.includes("/dp/");

    // flipkart: product pages have /p/ segment
    if (host.includes("flipkart.com")) return /\/p\/[a-z0-9]+/i.test(pathname);

    // myntra: product pages end with a numeric id
    if (host.includes("myntra.com")) return /\/\d+\/buy$/.test(pathname) || /buy/.test(pathname);

    // croma: product pages have -p- in path
    if (host.includes("croma.com")) return pathname.includes("-p-");

    // for other platforms just exclude known non-product patterns
    const nonProductPatterns = [/\/search/, /\/s\?/, /\/stores\//, /\/b\?/, /\/q\//, /\/browse/, /\/category/, /\/c\//];
    return !nonProductPatterns.some((p) => p.test(url));
  } catch {
    return false;
  }
}

export async function searchProducts(query, { maxPerPlatform = 2 } = {}) {
  if (!SERPER_API_KEY) {
    throw new Error("SERPER_API_KEY is not set. Sign up at serper.dev to get a free key.");
  }

  console.log(`Serper web search: "${query}"`);

  // web search returns direct product page URLs (unlike shopping which returns google redirects)
  // use site: operators to restrict results to supported Indian e-commerce platforms
  const siteFilter = Object.keys(SUPPORTED_PLATFORMS)
    .slice(0, 8)
    .map((s) => `site:${s}`)
    .join(" OR ");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: `${query} (${siteFilter})`,
      gl: "in",
      hl: "en",
      num: 20,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Serper search error: ${res.status}`);
  }

  const data = await res.json();
  const webResults = data.organic || [];

  console.log(`Serper: ${webResults.length} web results`);

  // group by platform, keep top maxPerPlatform per site
  const byPlatform = {};

  for (const result of webResults) {
    const platform = extractPlatform(result.link);
    if (!platform) continue;

    // skip category/search/store pages — only individual product pages can be scraped
    if (!isProductUrl(result.link)) continue;

    if (!byPlatform[platform.domain]) byPlatform[platform.domain] = [];
    if (byPlatform[platform.domain].length >= maxPerPlatform) continue;

    byPlatform[platform.domain].push({
      title: result.title,
      link: result.link,
      snippet: result.snippet || "",
      platform: platform.domain,
      platformName: platform.name,
      rating: result.rating || null,
      ratingCount: result.ratingCount || null,
      price: null,  // web search doesn't expose structured price data
      image: null,  // web search doesn't expose images
    });
  }

  const results = Object.values(byPlatform).flat();
  console.log(`Serper: ${results.length} results across ${Object.keys(byPlatform).length} platforms`);

  return results;
}
