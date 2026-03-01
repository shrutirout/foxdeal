// serper.dev — google search results via api
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

export async function searchProducts(query, { maxPerPlatform = 2 } = {}) {
  if (!SERPER_API_KEY) {
    throw new Error("SERPER_API_KEY is not set. Sign up at serper.dev to get a free key.");
  }

  // site operators narrow results to our supported e-commerce platforms
  const siteFilter = Object.keys(SUPPORTED_PLATFORMS)
    .slice(0, 8) // serper handles up to ~8 site: operators cleanly
    .map((s) => `site:${s}`)
    .join(" OR ");

  const fullQuery = `${query} (${siteFilter})`;

  console.log(`Serper search: "${query}"`);

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: fullQuery,
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

  console.log(`Serper: ${webResults.length} raw results`);

  // group by platform, keep top maxPerPlatform per site
  const byPlatform = {};

  for (const result of webResults) {
    const platform = extractPlatform(result.link);
    if (!platform) continue;

    if (!byPlatform[platform.domain]) byPlatform[platform.domain] = [];
    if (byPlatform[platform.domain].length >= maxPerPlatform) continue;

    byPlatform[platform.domain].push({
      title: result.title,
      link: result.link,
      snippet: result.snippet || "",
      platform: platform.domain,
      platformName: platform.name,
      price: null, // serper doesn't expose structured price data — confirmed when tracked
      image: result.imageUrl || null,
    });
  }

  const results = Object.values(byPlatform).flat();
  console.log(`Serper: ${results.length} results across ${Object.keys(byPlatform).length} platforms`);

  return results;
}
