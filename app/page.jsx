import { auth } from "@clerk/nextjs/server";
import { getProducts } from "./actions";
import AddProductForm from "@/components/AddProductForm";
import ProductCard from "@/components/ProductCard";
import { TrendingDown, Shield, Bell, Zap, ShoppingBag, DollarSign } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Image from "next/image";

export default async function Home() {
  const { userId } = await auth();
  const user = userId ? { id: userId } : null;
  const products = userId ? await getProducts() : [];

  const FEATURES = [
    {
      icon: Zap,
      title: "Real-Time Tracking",
      description:
        "FoxDeal monitors prices 24/7 across multiple e-commerce platforms instantly",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description:
        "Your data is encrypted and protected with enterprise-grade security measures",
    },
    {
      icon: Bell,
      title: "Instant Notifications",
      description: "Receive email alerts the moment your desired price drops",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-orange-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="FoxDeal Logo"
              width={180}
              height={60}
              className="h-12 w-auto object-contain"
              priority
            />
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                FoxDeal
              </h1>
              <p className="text-xs text-gray-500">Smart Price Tracker</p>
            </div>
          </div>

          <AuthButton user={user} />
        </div>
      </header>

      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 px-5 py-2 rounded-full text-sm font-semibold mb-8 shadow-sm">
              <ShoppingBag className="w-4 h-4" />
              Track, Save, Repeat
            </div>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Never Miss a{" "}
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Great Deal
            </span>
          </h2>
          <p className="text-lg sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Monitor prices across your favorite stores. Get alerted when prices drop.
            Start saving smarter today.
          </p>

          <AddProductForm user={user} />

          {products.length === 0 && (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-20">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-xl transition-all duration-300 hover:scale-105 hover:border-orange-300"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <Icon className="w-8 h-8 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-3 text-lg">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {user && products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-1">
                Your Tracked Products
              </h3>
              <p className="text-sm text-gray-500">
                Monitoring {products.length} {products.length === 1 ? "item" : "items"} for price changes
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-yellow-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold">
              <DollarSign className="w-4 h-4" />
              Active Tracking
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 items-start">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {user && products.length === 0 && (
        <section className="max-w-2xl mx-auto px-4 pb-20 text-center">
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 hover:border-orange-400 transition-colors">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingDown className="w-10 h-10 text-orange-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Start Tracking Your First Product
            </h3>
            <p className="text-gray-600 text-lg">
              Copy any product URL from Amazon, Walmart, or other stores and paste it above to begin saving!
            </p>
          </div>
        </section>
      )}

      <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm">
            © 2025 FoxDeal. Track prices, save money, shop smart.
          </p>
        </div>
      </footer>
    </main>
  );
}
