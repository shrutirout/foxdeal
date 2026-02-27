"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { Star, Users, Check, Loader2, ExternalLink, Package } from "lucide-react";

export default function ProductComparisonModal({
  isOpen,
  onClose,
  onConfirm,
  original,
  alternatives = [],
  analysis,
  loading = false,
  searchMode = false,
}) {
  // in url mode original is always pre-selected, in search mode nothing is
  const [selectedURLs, setSelectedURLs] = useState(
    original && !searchMode ? [original.url] : []
  );

  if (!searchMode && !original) {
    return null;
  }

  if (searchMode && (!alternatives || alternatives.length === 0)) {
    return null;
  }

  // formatting price with locale-aware currency symbol
  const formatPrice = (price, currencyCode) => {
    if (currencyCode === "INR") {
      return `₹${price.toLocaleString("en-IN")}`;
    } else if (currencyCode === "USD") {
      return `$${price.toLocaleString("en-US")}`;
    } else {
      return `${currencyCode} ${price}`;
    }
  };

  // resolving platform display name from domain or full url
  const getPlatformName = (domainOrUrl) => {
    if (!domainOrUrl) return "Unknown Platform";

    let domain = domainOrUrl;
    if (domainOrUrl.includes('://')) {
      try {
        const url = new URL(domainOrUrl);
        domain = url.hostname.replace('www.', '');
      } catch (e) {}
    }

    const names = {
      "amazon.in": "Amazon India",
      "flipkart.com": "Flipkart",
      "myntra.com": "Myntra",
      "ajio.com": "Ajio",
      "snapdeal.com": "Snapdeal",
      "tatacliq.com": "Tata CLiQ",
      "nykaa.com": "Nykaa",
      "bigbasket.com": "BigBasket",
      "lenskart.com": "Lenskart",
      "firstcry.com": "FirstCry",
      "pepperfry.com": "Pepperfry",
      "boat-lifestyle.com": "boAt",
      "meesho.com": "Meesho",
      "shopclues.com": "ShopClues",
      "paytmmall.com": "Paytm Mall",
      "reliancedigital.in": "Reliance Digital",
      "croma.com": "Croma",
      "vijaysales.com": "Vijay Sales",
      "jiomart.com": "JioMart",
      "shopsy.in": "Shopsy",
    };

    for (const [key, value] of Object.entries(names)) {
      if (domain.includes(key)) {
        return value;
      }
    }

    // falling back to cleaned domain name
    const cleanDomain = domain.replace(/\.com|\.in|\.co\.in/g, '');
    return cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
  };

  // toggling product selection, original cant be deselected in url mode
  const toggleSelection = (url) => {
    if (original && url === original.url) return;

    setSelectedURLs(prev =>
      prev.includes(url)
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedURLs);
  };

  const totalProducts = 1 + alternatives.length;
  const selectedCount = selectedURLs.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {totalProducts > 1 ? `Found ${totalProducts} Products Across Platforms` : "Product Preview"}
          </DialogTitle>
          <DialogDescription>
            {analysis && (
              <span>
                {analysis.brand && `${analysis.brand} `}
                {analysis.productName}
                {analysis.variant && ` - ${analysis.variant}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!searchMode && original && (
            <div className="border-2 border-orange-300 rounded-lg bg-orange-50/30">
              <div className="px-3 py-1.5 bg-orange-100 border-b border-orange-200 flex items-center gap-2">
                <Badge className="bg-orange-600 text-white">Your Selection</Badge>
                <span className="text-sm text-gray-600">
                  {getPlatformName(original.platformDomain || original.platform || original.url)}
                </span>
              </div>

              <ProductCard
                product={original}
                isSelected={true}
                onToggle={() => {}}
                isOriginal={true}
                formatPrice={formatPrice}
              />
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {searchMode ? `Found ${alternatives.length} Products` : `Alternative Options (${alternatives.length})`}
                </h3>
                <span className="text-sm text-gray-500">
                  Sorted by Deal Score
                </span>
              </div>

              {alternatives.map((product, index) => (
                <div
                  key={product.url}
                  className={`border rounded-lg transition-all ${
                    selectedURLs.includes(product.url)
                      ? "border-orange-400 bg-orange-50/20"
                      : "border-gray-200 hover:border-orange-200"
                  }`}
                >
                  <div className="px-3 py-1.5 bg-gray-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {index === 0 && (searchMode || (!searchMode && original && product.dealScore.score > original.dealScore.score)) && (
                        <Badge className="bg-green-600 text-white text-xs">
                          Best Deal
                        </Badge>
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {getPlatformName(product.platformDomain || product.platform || product.url)}
                      </span>
                    </div>

                    <Checkbox
                      checked={selectedURLs.includes(product.url)}
                      onCheckedChange={() => toggleSelection(product.url)}
                      className="h-5 w-5"
                    />
                  </div>

                  <ProductCard
                    product={product}
                    isSelected={selectedURLs.includes(product.url)}
                    onToggle={() => toggleSelection(product.url)}
                    formatPrice={formatPrice}
                  />
                </div>
              ))}
            </div>
          )}

          {alternatives.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p>No similar products found on other platforms</p>
              <p className="text-sm mt-1">You can still track this product</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || selectedCount === 0}
              className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Track Selected ({selectedCount})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductCard({ product, isSelected, onToggle, isOriginal, formatPrice }) {
  const { dealScore, productName, currentPrice, currencyCode, productImageUrl, rating, reviewCount, url } = product;
  const { score, label, emoji, color } = dealScore;

  return (
    <div className="p-4">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="relative w-24 h-24 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
            {productImageUrl ? (
              <Image
                src={productImageUrl}
                alt={productName}
                fill
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <Package className="w-8 h-8 text-gray-300" />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <h4 className="font-semibold text-gray-900 line-clamp-2 text-sm">
            {productName}
          </h4>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-600">
              {formatPrice(currentPrice, currencyCode || "INR")}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${color} text-xs font-semibold`}>
              {emoji} {score}/100 - {label}
            </Badge>

            {rating && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {rating.toFixed(1)}
              </span>
            )}
            {reviewCount > 0 && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {reviewCount.toLocaleString()}
              </span>
            )}
          </div>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              View on Website
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
