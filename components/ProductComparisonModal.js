"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { Star, Users, Check, Loader2, ExternalLink, Package, Info } from "lucide-react";

export default function ProductComparisonModal({
  isOpen,
  onClose,
  onConfirm,
  original,       // scraped product data (url mode only)
  cseResults,     // array of cse results (search mode or url mode alternatives)
  isUrlMode,      // true = url compare mode, false = name search mode
}) {
  const [selected, setSelected] = useState([]);
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;
  if (!isUrlMode && (!cseResults || cseResults.length === 0)) return null;

  const formatPrice = (price, currency = "INR") => {
    if (!price) return null;
    if (currency === "INR") return `₹${Number(price).toLocaleString("en-IN")}`;
    if (currency === "USD") return `$${Number(price).toLocaleString("en-US")}`;
    return `${currency} ${price}`;
  };

  const toggleCSE = (link) => {
    setSelected((prev) =>
      prev.includes(link) ? prev.filter((l) => l !== link) : [...prev, link]
    );
  };

  const handleConfirm = async () => {
    setConfirming(true);

    const items = [];

    // original is always included in url mode — already scraped, no extra credit needed
    if (isUrlMode && original) {
      items.push({
        url: original.url,
        title: original.productName,
        isOriginal: true,
        originalData: original,
      });
    }

    for (const link of selected) {
      const result = cseResults.find((r) => r.link === link);
      if (result) {
        items.push({
          url: result.link,
          title: result.title,
          isOriginal: false,
        });
      }
    }

    if (items.length === 0) return;

    setConfirming(false);
    onConfirm(items);
  };

  const trackCount = (isUrlMode && original ? 1 : 0) + selected.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isUrlMode
              ? `Found ${1 + (cseResults?.length || 0)} Results Across Platforms`
              : `Found ${cseResults?.length || 0} Results`}
          </DialogTitle>
          <DialogDescription className="flex items-start gap-1.5 text-xs text-gray-500 mt-1">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Prices shown are from Google&apos;s index and may vary slightly. Exact prices and deal scores are confirmed when you start tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {/* original product (url mode) — full scraped data with deal score */}
          {isUrlMode && original && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-orange-600 text-white text-xs">Your Product</Badge>
                <span className="text-xs text-gray-500">Always included when tracking</span>
              </div>
              <div className="border-2 border-orange-300 rounded-xl bg-orange-50/30 p-4">
                <ScrapedProductCard product={original} formatPrice={formatPrice} />
              </div>
            </div>
          )}

          {/* cse results — price/image from google, no deal score yet */}
          {cseResults && cseResults.length > 0 && (
            <div>
              {isUrlMode && (
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Also found on other platforms ({cseResults.length})
                </p>
              )}
              <div className="space-y-2">
                {cseResults.map((result) => (
                  <div
                    key={result.link}
                    onClick={() => toggleCSE(result.link)}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
                      selected.includes(result.link)
                        ? "border-orange-400 bg-orange-50/30"
                        : "border-gray-200 hover:border-orange-200 hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg border overflow-hidden bg-gray-50 flex items-center justify-center">
                        {result.image ? (
                          <Image
                            src={result.image}
                            alt={result.title}
                            width={64}
                            height={64}
                            className="object-contain w-full h-full p-1"
                            unoptimized
                          />
                        ) : (
                          <Package className="w-6 h-6 text-gray-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-orange-700 mb-0.5">
                              {result.platformName}
                            </p>
                            <p className="text-sm font-medium text-gray-800 line-clamp-2">
                              {result.title}
                            </p>
                          </div>
                          <Checkbox
                            checked={selected.includes(result.link)}
                            onCheckedChange={() => toggleCSE(result.link)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-5 w-5 mt-0.5 flex-shrink-0"
                          />
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          {result.price ? (
                            <span className="text-lg font-bold text-orange-600">
                              {formatPrice(result.price)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Price confirmed on tracking
                            </span>
                          )}

                          <a
                            href={result.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            View listing
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* no cse alternatives found in url mode */}
          {isUrlMode && (!cseResults || cseResults.length === 0) && (
            <div className="text-center py-4 text-sm text-gray-500">
              No similar listings found on other platforms right now.
            </div>
          )}

          {/* footer buttons */}
          <div className="flex gap-3 pt-2 border-t sticky bottom-0 bg-white">
            <Button variant="outline" onClick={onClose} disabled={confirming} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || trackCount === 0}
              className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
            >
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Track Selected ({trackCount})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// full product card for the scraped original — includes deal score
function ScrapedProductCard({ product, formatPrice }) {
  const {
    dealScore,
    productName,
    currentPrice,
    currencyCode,
    productImageUrl,
    rating,
    reviewCount,
    url,
  } = product;

  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-20 h-20 rounded-lg border overflow-hidden bg-gray-50 flex items-center justify-center">
        {productImageUrl ? (
          <Image
            src={productImageUrl}
            alt={productName}
            width={80}
            height={80}
            className="object-contain w-full h-full p-1"
            unoptimized
          />
        ) : (
          <Package className="w-8 h-8 text-gray-300" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-semibold text-gray-900 line-clamp-2 text-sm">{productName}</p>

        <span className="text-2xl font-bold text-orange-600">
          {formatPrice(currentPrice, currencyCode || "INR")}
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          {dealScore && (
            <Badge className={`${dealScore.color} text-xs font-semibold text-white`}>
              {dealScore.emoji} {dealScore.score}/100 — {dealScore.label}
            </Badge>
          )}
          {rating && (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {Number(reviewCount).toLocaleString()}
            </span>
          )}
        </div>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            View listing <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
