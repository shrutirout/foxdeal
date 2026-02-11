// platform trust scores on a 0-10 scale
const PLATFORM_CATEGORIES = {
  "amazon.in": 9.5,
  "amazon.com": 9.5,
  "flipkart.com": 9.0,
  "snapdeal.com": 7.0,
  "paytmmall.com": 6.0,
  "shopclues.com": 5.5,

  "tatacliq.com": 9.0,
  "myntra.com": 8.5,
  "ajio.com": 8.0,
  "meesho.com": 6.5,
  "bewakoof.com": 6.0,
  "zivame.com": 6.0,

  "nykaa.com": 8.5,
  "pharmeasy.com": 6.5,
  "1mg.com": 6.5,

  "bigbasket.com": 8.0,
  "blinkit.com": 7.5,
  "swiggy.com": 7.5,
  "zepto.com": 7.5,
  "jiomart.com": 7.0,

  "lenskart.com": 8.0,
  "firstcry.com": 8.0,
  "pepperfry.com": 7.0,
  "boat-lifestyle.com": 7.0,

  "ebay.com": 7.0,
  "walmart.com": 9.0,
  "target.com": 8.5,
  "bestbuy.com": 8.5,
};

const DEFAULT_PLATFORM_SCORE = 5.0;

function getPlatformScore(platformDomain) {
  if (!platformDomain) {
    return DEFAULT_PLATFORM_SCORE;
  }

  // normalizing domain
  const normalizedDomain = platformDomain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split("/")[0];

  return PLATFORM_CATEGORIES[normalizedDomain] || DEFAULT_PLATFORM_SCORE;
}

// known trusted sellers per platform
const TRUSTED_SELLERS = {
  amazon: [
    "cloudtail",
    "appario",
    "amazon retail",
    "cocoblu retail",
    "prione retail",
    "amazon global store",
  ],
  flipkart: [
    "flipkart retail",
    "ws retail",
    "omnitech retail",
    "retail net",
    "flipkart assured",
  ],
  indicators: [
    "official store",
    "authorized",
    "verified seller",
    "assured",
    "fulfilled by",
    "fba",
  ],
};

function calculateSellerScore(sellerRating, sellerName, platformDomain) {
  // using seller rating from the platform when available
  if (sellerRating && sellerRating > 0) {
    return (sellerRating / 5.0) * 100;
  }

  // falling back to trust-based scoring
  if (!sellerName) {
    return 50;
  }

  const seller = sellerName.toLowerCase().trim();

  if (
    seller.includes("official store") ||
    seller.includes("authorized") ||
    seller.includes("verified seller") ||
    seller.includes("brand official")
  ) {
    return 100;
  }

  // checking platform-specific trusted sellers
  if (platformDomain) {
    const domain = platformDomain.toLowerCase();

    if (domain.includes("amazon")) {
      for (const trusted of TRUSTED_SELLERS.amazon) {
        if (seller.includes(trusted)) {
          return 100;
        }
      }
    }

    if (domain.includes("flipkart")) {
      for (const trusted of TRUSTED_SELLERS.flipkart) {
        if (seller.includes(trusted)) {
          return 100;
        }
      }
    }
  }

  if (seller.includes("fulfilled by") || seller.includes("fba")) {
    return 80;
  }

  return 30;
}

function calculateRatingScore(rating) {
  if (!rating || rating === 0) {
    return 60;
  }

  return (rating / 5.0) * 100;
}

// scoring tiers based on review count as social proof
function calculateReviewScore(reviewCount) {
  if (!reviewCount || reviewCount === 0) {
    return 0;
  }

  if (reviewCount >= 1000) {
    return 100;
  } else if (reviewCount >= 500) {
    return 85;
  } else if (reviewCount >= 250) {
    return 70;
  } else if (reviewCount >= 100) {
    return 55;
  } else if (reviewCount >= 50) {
    return 40;
  } else if (reviewCount >= 10) {
    return 25;
  } else {
    return 10;
  }
}

// weighted: rating 40%, reviews 30%, seller 20%, platform 10%
export function calculateDealScore(productData) {
  const { rating, reviewCount, sellerRating, sellerName, platformDomain } = productData;

  const ratingScore = calculateRatingScore(rating);
  const reviewScore = calculateReviewScore(reviewCount);
  const sellerScore = calculateSellerScore(sellerRating, sellerName, platformDomain);
  const platformScore = getPlatformScore(platformDomain);

  const platformScoreNormalized = (platformScore / 10) * 100;

  let finalScore =
    ratingScore * 0.4 +
    reviewScore * 0.3 +
    sellerScore * 0.2 +
    platformScoreNormalized * 0.1;

  // clamping to 0-100 range
  finalScore = Math.max(0, Math.min(100, finalScore));
  finalScore = Math.round(finalScore * 10) / 10;

  const scoreLabel = getScoreLabel(finalScore);
  const scoreColor = getScoreColor(finalScore);

  return {
    score: finalScore,
    label: scoreLabel.label,
    emoji: scoreLabel.emoji,
    color: scoreColor,

    breakdown: {
      rating: {
        score: Math.round(ratingScore),
        weight: 40,
        maxPoints: 40,
        earnedPoints: Math.round(ratingScore * 0.4),
      },
      reviews: {
        score: Math.round(reviewScore),
        weight: 30,
        maxPoints: 30,
        earnedPoints: Math.round(reviewScore * 0.3),
      },
      seller: {
        score: Math.round(sellerScore),
        weight: 20,
        maxPoints: 20,
        earnedPoints: Math.round(sellerScore * 0.2),
      },
      platform: {
        score: Math.round(platformScoreNormalized),
        weight: 10,
        maxPoints: 10,
        earnedPoints: Math.round(platformScoreNormalized * 0.1),
        rawScore: platformScore,
      },
    },

    metadata: {
      hasRating: !!rating,
      hasReviews: !!reviewCount && reviewCount > 0,
      hasSellerRating: !!sellerRating,
      hasSeller: !!sellerName,
      platformTrust: platformScore,
    },
  };
}

function getScoreLabel(score) {
  if (score >= 85) {
    return { label: "Excellent Deal", emoji: "🔥" };
  } else if (score >= 70) {
    return { label: "Good Deal", emoji: "✅" };
  } else if (score >= 55) {
    return { label: "Average Deal", emoji: "⚠️" };
  } else if (score >= 40) {
    return { label: "Below Average", emoji: "👎" };
  } else {
    return { label: "Poor Deal", emoji: "❌" };
  }
}

function getScoreColor(score) {
  if (score >= 85) {
    return "bg-green-500 text-white";
  } else if (score >= 70) {
    return "bg-blue-500 text-white";
  } else if (score >= 55) {
    return "bg-yellow-500 text-white";
  } else if (score >= 40) {
    return "bg-orange-500 text-white";
  } else {
    return "bg-red-500 text-white";
  }
}

export function formatScoreBreakdown(scoreResult) {
  const { breakdown } = scoreResult;

  return `
Rating: ${breakdown.rating.score}/100 (${breakdown.rating.earnedPoints}/${breakdown.rating.maxPoints} pts)
Reviews: ${breakdown.reviews.score}/100 (${breakdown.reviews.earnedPoints}/${breakdown.reviews.maxPoints} pts)
Seller: ${breakdown.seller.score}/100 (${breakdown.seller.earnedPoints}/${breakdown.seller.maxPoints} pts)
Platform Trust: ${breakdown.platform.score}/10 (×${breakdown.platform.multiplier})
  `.trim();
}

export function getScoreRecommendation(score) {
  if (score >= 85) {
    return "Highly recommended! This product has excellent ratings, many reviews, and comes from a trusted seller.";
  } else if (score >= 70) {
    return "Good choice! This product has solid ratings and reasonable validation.";
  } else if (score >= 55) {
    return "Proceed with caution. This product is average - check reviews carefully before purchasing.";
  } else if (score >= 40) {
    return "Not recommended. This product has concerning ratings or lacks validation.";
  } else {
    return "Avoid! This product has poor ratings, few reviews, or comes from an untrusted seller.";
  }
}
