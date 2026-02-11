"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Star, Users, Store, Globe, TrendingDown } from "lucide-react";

export default function ProductPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  productData,
  dealScore,
  loading = false,
}) {
  if (!productData || !dealScore) {
    return null;
  }

  const {
    productName,
    currentPrice,
    originalPrice,
    currencyCode,
    productImageUrl,
    sellerName,
    platform,
    rating,
    reviewCount,
  } = productData;

  const currency = currencyCode || "USD";

  const { score, label, emoji, color, breakdown } = dealScore;

  const formatPrice = (price, curr) => {
    if (curr === "INR") {
      return `₹${price.toLocaleString("en-IN")}`;
    } else if (curr === "USD") {
      return `$${price.toLocaleString("en-US")}`;
    } else {
      return `${curr} ${price}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Product Preview
          </DialogTitle>
          <DialogDescription>
            Review the product details and deal score before adding to your tracking list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-4">
            {productImageUrl && (
              <div className="flex-shrink-0">
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-gray-50">
                  <Image
                    src={productImageUrl}
                    alt={productName}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
              </div>
            )}

            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-lg line-clamp-2">
                {productName}
              </h3>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-orange-600">
                  {formatPrice(currentPrice, currency)}
                </span>
                {originalPrice && originalPrice > currentPrice && (
                  <span className="text-lg text-gray-500 line-through">
                    {formatPrice(originalPrice, currency)}
                  </span>
                )}
              </div>

              {originalPrice && originalPrice > currentPrice && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {Math.round(((originalPrice - currentPrice) / originalPrice) * 100)}% OFF
                </Badge>
              )}
            </div>
          </div>

          <div className={`${color} rounded-xl p-6 shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white/90 text-sm font-medium mb-1">
                  Deal Score
                </div>
                <div className="text-4xl font-bold text-white">
                  {emoji} {score}/100
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {label}
                </div>
                <div className="text-white/80 text-sm mt-1">
                  {score >= 85
                    ? "Excellent choice!"
                    : score >= 70
                    ? "Good option"
                    : score >= 55
                    ? "Average quality"
                    : "Consider alternatives"}
                </div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4 space-y-2">
              <div className="text-white/90 text-xs font-medium mb-3">
                Score Breakdown:
              </div>

              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  <span>Product Rating</span>
                </div>
                <div className="font-medium">
                  {breakdown.rating.earnedPoints}/{breakdown.rating.maxPoints} pts
                  <span className="text-white/70 ml-2">
                    ({rating ? `${rating.toFixed(1)}⭐` : "No rating"})
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Review Count</span>
                </div>
                <div className="font-medium">
                  {breakdown.reviews.earnedPoints}/{breakdown.reviews.maxPoints} pts
                  <span className="text-white/70 ml-2">
                    ({reviewCount || 0} reviews)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  <span>Seller Trust</span>
                </div>
                <div className="font-medium">
                  {breakdown.seller.earnedPoints}/{breakdown.seller.maxPoints} pts
                  <span className="text-white/70 ml-2">
                    ({sellerName || "Unknown seller"})
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>Platform Trust</span>
                </div>
                <div className="font-medium">
                  {breakdown.platform.earnedPoints}/{breakdown.platform.maxPoints} pts
                  <span className="text-white/70 ml-2">
                    ({breakdown.platform.rawScore?.toFixed(1) || breakdown.platform.score}/10)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 font-medium">Seller</div>
              <div className="font-semibold">{sellerName || "Unknown"}</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">Platform</div>
              <div className="font-semibold">{platform || "Unknown"}</div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
            >
              {loading ? "Adding..." : "✅ Add to Tracking"}
            </Button>
          </div>

          {score < 55 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-2">
                <span className="text-yellow-600 font-semibold">⚠️ Caution:</span>
                <span className="text-yellow-800 text-sm">
                  This product has a below-average score. Consider checking reviews
                  carefully or looking for alternatives before purchasing.
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
