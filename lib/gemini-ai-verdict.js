// gemini-powered deal analysis for tracked products
// called only when user explicitly requests it — not on every page load

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateAIVerdict(product, priceHistory) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.4 },
  });

  const hasPriceHistory = priceHistory && priceHistory.length >= 2;

  // build price trend summary if we have data
  let priceSummary = "";
  let priceMin = null;
  let priceMax = null;
  let priceChangePercent = null;
  let priceDirection = null;

  if (hasPriceHistory) {
    const prices = priceHistory.map((h) => Number(h.price));
    priceMin = Math.min(...prices);
    priceMax = Math.max(...prices);
    const oldest = prices[0];
    const newest = prices[prices.length - 1];
    priceChangePercent = (((newest - oldest) / oldest) * 100).toFixed(1);
    priceDirection = newest < oldest ? "dropped" : newest > oldest ? "increased" : "stable";

    // last 5 price checkpoints
    const recentHistory = priceHistory
      .slice(-5)
      .map((h) => `${new Date(h.checked_at).toLocaleDateString("en-IN")} ₹${Number(h.price).toLocaleString("en-IN")}`)
      .join(" → ");

    priceSummary = `
PRICE HISTORY:
Recent prices: ${recentHistory}
Range tracked: ₹${priceMin.toLocaleString("en-IN")} – ₹${priceMax.toLocaleString("en-IN")}
Overall change: ${priceChangePercent}% ${priceDirection} since first tracked
Total checkpoints: ${priceHistory.length}`;
  }

  // discount from MRP if available
  let discountNote = "";
  if (product.original_price && product.current_price < product.original_price) {
    const discountPct = (
      ((product.original_price - product.current_price) / product.original_price) *
      100
    ).toFixed(0);
    discountNote = `Listed at ${discountPct}% off MRP (₹${Number(product.original_price).toLocaleString("en-IN")}).`;
  }

  const scoreLabel =
    product.deal_score >= 85
      ? "Excellent"
      : product.deal_score >= 70
      ? "Good"
      : product.deal_score >= 55
      ? "Average"
      : product.deal_score >= 40
      ? "Below Average"
      : "Poor";

  const prompt = `You are a deal analyst for Indian e-commerce. Give a SHORT, CRISP, HONEST verdict on this tracked product.

PRODUCT:
Name: ${product.name}
Platform: ${product.platform_domain || "Unknown"}
Current Price: ₹${Number(product.current_price).toLocaleString("en-IN")}
${discountNote}
Deal Score: ${product.deal_score}/100 (${scoreLabel})
${product.rating ? `Product Rating: ${product.rating}/5` : ""}
${product.review_count ? `Number of Reviews: ${Number(product.review_count).toLocaleString()}` : ""}
${priceSummary}

RULES:
1. Write exactly 2-4 sentences. No bullet points, no headers.
2. ${hasPriceHistory ? `Analyze the price trend. Direction was "${priceDirection}" (${priceChangePercent}%). Comment on whether now is a good time to buy.` : "DO NOT mention price history or trends — there is no data yet. Only comment on the current deal quality based on score, rating, and reviews."}
3. ${discountNote ? "Mention the MRP discount as relevant context." : ""}
4. Be direct — end with a clear recommendation: buy now, wait, or already a solid deal.
5. Only use data provided above. Do not invent prices or ratings.
6. Use ₹ symbol for prices. Keep it conversational, not technical.`;

  console.log(`Generating AI verdict for: ${product.name}`);
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
