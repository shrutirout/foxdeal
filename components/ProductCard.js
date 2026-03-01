"use client";

import { useState, useEffect } from "react";
import { deleteProduct, getAIVerdict } from "@/app/actions";
import PriceChart from "./PriceChart";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Trash2,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function ProductCard({ product }) {
  const [showChart, setShowChart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiVerdict, setAiVerdict] = useState(null);
  const [loadingVerdict, setLoadingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState(null);

  // load verdict from session storage on mount (persists until tab is closed)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`foxdeal_ai_${product.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAiVerdict(parsed.text);
      }
    } catch {
      // ignore storage errors
    }
  }, [product.id]);

  const handleDelete = async () => {
    if (!confirm("Remove this product from tracking?")) return;
    setDeleting(true);
    await deleteProduct(product.id);
  };

  const handleAskAI = async () => {
    setLoadingVerdict(true);
    setVerdictError(null);

    try {
      const result = await getAIVerdict(product.id);

      if (result.error) {
        setVerdictError(result.error);
        return;
      }

      setAiVerdict(result.verdict);

      // store in session so it persists until tab closes, but not beyond
      try {
        sessionStorage.setItem(
          `foxdeal_ai_${product.id}`,
          JSON.stringify({ text: result.verdict, generatedAt: Date.now() })
        );
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      setVerdictError("Failed to get AI analysis. Try again.");
    } finally {
      setLoadingVerdict(false);
    }
  };

  const clearVerdict = () => {
    setAiVerdict(null);
    setVerdictError(null);
    try {
      sessionStorage.removeItem(`foxdeal_ai_${product.id}`);
    } catch {
      // ignore
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex gap-4">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-md border"
            />
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
              {product.name}
            </h3>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                {product.currency} {product.current_price}
              </span>
              <Badge variant="secondary" className="gap-1 bg-yellow-100 text-orange-700 border-orange-200">
                <TrendingDown className="w-3 h-3" />
                Tracking
              </Badge>
            </div>

            {product.deal_score !== null && product.deal_score !== undefined && (
              <div className="mt-2">
                <Badge
                  className={`text-xs font-semibold ${
                    product.deal_score >= 85
                      ? "bg-green-500 text-white"
                      : product.deal_score >= 70
                      ? "bg-blue-500 text-white"
                      : product.deal_score >= 55
                      ? "bg-yellow-500 text-white"
                      : product.deal_score >= 40
                      ? "bg-orange-500 text-white"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {product.deal_score >= 85
                    ? "🔥"
                    : product.deal_score >= 70
                    ? "✅"
                    : product.deal_score >= 55
                    ? "⚠️"
                    : product.deal_score >= 40
                    ? "👎"
                    : "❌"}{" "}
                  Deal Score: {product.deal_score}/100
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="gap-1"
          >
            {showChart ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Chart
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Price History
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1">
            <Link href={product.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              View Product
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        </div>

        {/* ai recommendations section */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              AI Recommendations
            </p>
            {aiVerdict && (
              <button
                onClick={clearVerdict}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>

          {!aiVerdict && !loadingVerdict && !verdictError && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAskAI}
              className="gap-2 text-purple-700 border-purple-200 hover:bg-purple-50 hover:border-purple-300 w-full"
            >
              <Sparkles className="w-4 h-4" />
              Ask AI: Is this a good deal?
            </Button>
          )}

          {loadingVerdict && (
            <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-purple-50 border border-purple-100">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-purple-700">Analysing deal quality...</p>
            </div>
          )}

          {verdictError && (
            <div className="py-2 px-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xs text-red-600">{verdictError}</p>
              <button
                onClick={handleAskAI}
                className="text-xs text-red-700 font-medium mt-1 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {aiVerdict && (
            <div className="py-3 px-3 rounded-lg bg-purple-50 border border-purple-100">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 leading-relaxed">{aiVerdict}</p>
              </div>
              <button
                onClick={handleAskAI}
                disabled={loadingVerdict}
                className="text-xs text-purple-600 hover:underline mt-2 flex items-center gap-1"
              >
                {loadingVerdict ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Refresh analysis
              </button>
            </div>
          )}
        </div>
      </CardContent>

      {showChart && (
        <CardFooter className="pt-0">
          <PriceChart productId={product.id} />
        </CardFooter>
      )}
    </Card>
  );
}
