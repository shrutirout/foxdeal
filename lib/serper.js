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

export async function searchProducts(query, { maxPerPlatform = 2 } = {}) {
  if (!SERPER_API_KEY) {
    throw new Error("SERPER_API_KEY is not set. Sign up at serper.dev to get a free key.");
  }

  console.log(`Serper shopping search: "${query}"`);

  // shopping endpoint returns price + image directly — no need for site: operators
  const res = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
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
  const shoppingResults = data.shopping || [];

  console.log(`Serper: ${shoppingResults.length} shopping results`);

  // group by platform, keep top maxPerPlatform per site
  const byPlatform = {};

  for (const result of shoppingResults) {
    const platform = extractPlatform(result.link);
    if (!platform) continue;

    if (!byPlatform[platform.domain]) byPlatform[platform.domain] = [];
    if (byPlatform[platform.domain].length >= maxPerPlatform) continue;

    byPlatform[platform.domain].push({
      title: result.title,
      link: result.link,
      snippet: "",
      platform: platform.domain,
      platformName: platform.name,
      price: result.price || null,    // already formatted string e.g. "₹1,299"
      image: result.imageUrl || null, // product thumbnail from google shopping
    });
  }

  const results = Object.values(byPlatform).flat();
  console.log(`Serper: ${results.length} results across ${Object.keys(byPlatform).length} platforms`);

  return results;
}
