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
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { Check, Loader2, ExternalLink, Package, Info } from "lucide-react";

export default function ProductComparisonModal({
  isOpen,
  onClose,
  onConfirm,
  cseResults, // array of shopping search results (title, link, price, image, platformName)
}) {
  const [selected, setSelected] = useState([]);
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;
  if (!cseResults || cseResults.length === 0) return null;

  const toggleCSE = (link) => {
    setSelected((prev) =>
      prev.includes(link) ? prev.filter((l) => l !== link) : [...prev, link]
    );
  };

  const handleConfirm = async () => {
    setConfirming(true);

    const items = selected.map((link) => {
      const result = cseResults.find((r) => r.link === link);
      return { url: link, title: result?.title || link, isOriginal: false };
    });

    if (items.length === 0) { setConfirming(false); return; }

    setConfirming(false);
    onConfirm(items);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Found {cseResults.length} Results
          </DialogTitle>
          <DialogDescription className="flex items-start gap-1.5 text-xs text-gray-500 mt-1">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Prices shown are from Google Shopping and may vary slightly. Exact prices are confirmed when you start tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                          {result.price}
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

          <div className="flex gap-3 pt-2 border-t sticky bottom-0 bg-white">
            <Button variant="outline" onClick={onClose} disabled={confirming} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || selected.length === 0}
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
                  Track Selected ({selected.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
