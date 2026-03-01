"use client";

import { useState } from "react";
import {
  searchProductsCSE,
  addProductByUrl,
} from "@/app/actions";
import AuthModal from "./AuthModal";
import ProductComparisonModal from "./ProductComparisonModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, Search, CheckCircle2, XCircle, Circle } from "lucide-react";
import { toast } from "sonner";

export default function AddProductForm({ user }) {
  const [mode, setMode] = useState("search");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [cseResults, setCseResults] = useState([]);

  // progressive adding state
  const [addingItems, setAddingItems] = useState(null);

  // search mode: serper shopping search, no scraping
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!input.trim() || input.trim().length < 3) {
      toast.error("Please enter at least 3 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await searchProductsCSE(input.trim());
      if (result.error) { toast.error(result.error); return; }
      if (!result.results || result.results.length === 0) {
        toast.error("No products found. Try a different search term.");
        return;
      }

      setCseResults(result.results);
      setShowComparisonModal(true);
    } catch (err) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // url mode: scrape + track 1 product directly, no comparison needed
  const handleUrlTrack = async (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!input.trim()) { toast.error("Please enter a product URL"); return; }

    await handleConfirmSelection([{
      url: input.trim(),
      title: input.trim(),
      isOriginal: false,
      originalData: null,
    }]);
  };

  // called when user confirms selection in the comparison modal
  const handleConfirmSelection = async (selectedItems) => {
    if (!selectedItems || selectedItems.length === 0) return;

    setShowComparisonModal(false);

    const items = selectedItems.map((item) => ({
      url: item.url,
      title: item.title || item.url,
      status: "pending",
      error: null,
    }));

    setAddingItems(items);

    for (let i = 0; i < items.length; i++) {
      setAddingItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "adding" } : it))
      );

      try {
        const result = await addProductByUrl(items[i].url);

        setAddingItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: result.error ? "failed" : "done",
                  title: result.productName || it.title,
                  error: result.error || null,
                }
              : it
          )
        );
      } catch (err) {
        setAddingItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "failed", error: err.message } : it
          )
        );
      }
    }

    await new Promise((r) => setTimeout(r, 1800));

    const doneCount = await new Promise((r) => {
      setAddingItems((prev) => {
        const done = prev.filter((it) => it.status === "done").length;
        const failed = prev.filter((it) => it.status === "failed").length;
        if (done > 0) toast.success(`${done} product${done > 1 ? "s" : ""} now being tracked!`);
        if (failed > 0) toast.warning(`${failed} product${failed > 1 ? "s" : ""} couldn't be added`);
        r(done);
        return prev;
      });
    });

    setAddingItems(null);
    setInput("");

    if (doneCount > 0) window.location.reload();
  };

  // progress overlay shown while scraping and adding products
  if (addingItems) {
    const done = addingItems.filter((i) => i.status === "done").length;
    const failed = addingItems.filter((i) => i.status === "failed").length;
    const total = addingItems.length;
    const current = done + failed;

    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-orange-200 shadow-lg p-8">
          <div className="text-center mb-6">
            <p className="text-lg font-semibold text-gray-800">
              Adding {total === 1 ? "Product" : "Products"} to Your Tracker
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {current < total
                ? `Scraping product ${current + 1} of ${total}...`
                : "All done!"}
            </p>

            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{current}/{total} completed</p>
          </div>

          <div className="space-y-3">
            {addingItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  item.status === "done"
                    ? "border-green-200 bg-green-50"
                    : item.status === "failed"
                    ? "border-red-200 bg-red-50"
                    : item.status === "adding"
                    ? "border-orange-200 bg-orange-50"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="flex-shrink-0">
                  {item.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {item.status === "failed" && <XCircle className="w-5 h-5 text-red-500" />}
                  {item.status === "adding" && <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />}
                  {item.status === "pending" && <Circle className="w-5 h-5 text-gray-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  {item.status === "adding" && <p className="text-xs text-orange-600">Scraping product details...</p>}
                  {item.status === "done" && <p className="text-xs text-green-600">Added successfully</p>}
                  {item.status === "failed" && <p className="text-xs text-red-600">{item.error || "Failed to add"}</p>}
                  {item.status === "pending" && <p className="text-xs text-gray-400">Waiting...</p>}
                </div>

                <div className="text-xs font-medium text-gray-400">{idx + 1}/{total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode("search")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all ${
              mode === "search"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Search className="w-4 h-4" />
            Search by Name
          </button>
          <button
            onClick={() => setMode("url")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all ${
              mode === "url"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Search by URL
          </button>
        </div>

        <form
          onSubmit={mode === "search" ? handleSearch : handleUrlTrack}
          className="flex gap-2"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "search"
                ? "Search product (e.g., Samsung Galaxy S24, Nike Quest 6)"
                : "Paste product URL (Amazon, Flipkart, Myntra...)"
            }
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : mode === "search" ? (
              "Search"
            ) : (
              "Track"
            )}
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-2">
          {mode === "search" ? (
            <>
              <strong>Search by Name:</strong> Find this product across Amazon, Flipkart, Myntra and more, then choose what to track
            </>
          ) : (
            <>
              <strong>Search by URL:</strong> Paste a product URL and we scrape and track it directly
            </>
          )}
        </p>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <ProductComparisonModal
        isOpen={showComparisonModal}
        onClose={() => { setShowComparisonModal(false); setLoading(false); }}
        onConfirm={handleConfirmSelection}
        cseResults={cseResults}
      />
    </>
  );
}
