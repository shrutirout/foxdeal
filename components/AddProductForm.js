"use client";

import { useState } from "react";
import { findSimilarProducts, searchProductsByName, addMultipleProducts } from "@/app/actions";
import AuthModal from "./AuthModal";
import ProductComparisonModal from "./ProductComparisonModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, Search } from "lucide-react";
import { toast } from "sonner";

export default function AddProductForm({ user }) {
  const [mode, setMode] = useState("url");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [originalProduct, setOriginalProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // url mode: scrape original + find same product across other platforms via gemini
  const handleUrlCompare = async (e) => {
    e.preventDefault();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!input.trim()) {
      toast.error("Please enter a product URL");
      return;
    }

    setLoading(true);

    try {
      const result = await findSimilarProducts(input.trim());

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setOriginalProduct(result.original);
      setProducts(result.alternatives || []);
      setAnalysis(result.analysis || null);
      setIsSearchMode(false);
      setShowComparisonModal(true);

      if (result.geminiError) {
        toast.warning("Found your product but couldn't search other platforms right now.");
      }
    } catch (error) {
      console.error("URL compare error:", error);
      toast.error(error.message || "Failed to process product");
    } finally {
      setLoading(false);
    }
  };

  // search mode: find product by name across platforms via gemini smart search
  const handleSmartSearch = async (e) => {
    e.preventDefault();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!input.trim() || input.trim().length < 3) {
      toast.error("Please enter at least 3 characters");
      return;
    }

    setLoading(true);

    try {
      const result = await searchProductsByName(input.trim());

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      if (!result.products || result.products.length === 0) {
        toast.error("No products found. Try a different search term.");
        setLoading(false);
        return;
      }

      // mapping scraped results to comparison modal format
      const transformedProducts = result.products.map((p) => ({
        ...p.productData,
        dealScore: p.dealScore,
        url: p.url,
        platform: p.platform,
        platformDomain: p.productData?.platformDomain || p.platform,
      }));

      setOriginalProduct(null);
      setProducts(transformedProducts);
      setAnalysis({ productName: result.searchQuery || input.trim() });
      setIsSearchMode(true);
      setShowComparisonModal(true);
    } catch (error) {
      console.error("Smart search error:", error);
      toast.error(error.message || "Failed to search for products");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProducts = async (selectedURLs) => {
    setConfirming(true);

    try {
      const result = await addMultipleProducts(selectedURLs);

      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.added > 0) {
          toast.success(`${result.added} product(s) tracked successfully!`);
          setInput("");
          setShowComparisonModal(false);
          window.location.reload();
        }

        if (result.failed > 0) {
          toast.warning(`${result.failed} product(s) failed to add`);
        }
      }
    } catch (error) {
      console.error("Confirm products error:", error);
      toast.error(error.message || "Failed to add products");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode("url")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all ${
              mode === "url"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Compare by URL
          </button>
          <button
            onClick={() => setMode("search")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all ${
              mode === "search"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Search className="w-4 h-4" />
            Smart Search (Name)
          </button>
        </div>

        <form
          onSubmit={mode === "url" ? handleUrlCompare : handleSmartSearch}
          className="flex gap-2"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "url"
                ? "Paste product URL (Amazon, Flipkart, etc.)"
                : "Search product (e.g., Nike Quest 6 running shoes black)"
            }
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "url" ? "Searching platforms..." : "Searching..."}
              </>
            ) : (
              <>{mode === "url" ? "Find & Compare" : "Search"}</>
            )}
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-2">
          {mode === "url" ? (
            <>
              <strong>Compare by URL:</strong> Paste a product URL — we scrape it and find the same product across other platforms so you can compare prices and pick what to track
            </>
          ) : (
            <>
              <strong>Smart Search:</strong> AI will find this product across Amazon, Flipkart, Myntra & more, then you choose which to track
            </>
          )}
        </p>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <ProductComparisonModal
        isOpen={showComparisonModal}
        onClose={() => {
          setShowComparisonModal(false);
          setLoading(false);
        }}
        onConfirm={handleConfirmProducts}
        original={isSearchMode ? null : originalProduct}
        alternatives={products}
        analysis={analysis}
        loading={confirming}
        searchMode={isSearchMode}
      />
    </>
  );
}
