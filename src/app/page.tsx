"use client";

import { useState, useEffect } from "react";
import SplashScreen from "@/components/SplashScreen";
import BottomNav from "@/components/BottomNav";
import HeroBanner from "@/components/Home/HeroBanner";
import CategoryCardsList from "@/components/Menu/CategoryCardsList";
import MenuItemCard from "@/components/Menu/MenuItemCard";
import FoodIcon from "@/components/FoodIcon";
import { menuData } from "@/data/menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, MapPin, Clock } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function Home() {
  const router = useRouter();
  const { foodPreference } = useCart();
  const [showSplash, setShowSplash] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem("spiral_cafe_splash");
    if (hasSeenSplash) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem("spiral_cafe_splash", "true");
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Helper to filter according to dietary preference
  const isDietMatch = (item: { badges?: string[] }) =>
    foodPreference === "ALL" ||
    (item.badges &&
      item.badges.some(
        (b) => typeof b === "string" && b.toLowerCase() === "veg",
      ));

  // Filter items if search query is entered
  const allFilteredItems = searchQuery.trim()
    ? menuData.flatMap((cat) =>
        cat.items
          .filter(isDietMatch)
          .filter(
            (item) =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              cat.name.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      )
    : [];

  const categoriesForHome = menuData
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(isDietMatch),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <main className="min-h-screen bg-background pb-28">
      {/* Hero Section with Terracotta theme, logo, search bar, & auto-sliding best sellers */}
      <HeroBanner searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="max-w-md mx-auto sm:max-w-xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl px-4 sm:px-6 lg:px-8 pt-2">
        {/* Search Results if user types in search bar */}
        {searchQuery.trim() ? (
          <section className="py-6">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-4">
              Search Results ({allFilteredItems.length})
            </h2>
            {allFilteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                {allFilteredItems.map((item, idx) => (
                  <MenuItemCard key={item.id} index={idx} {...item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-3xl border border-border p-6 shadow-sm">
                <p className="text-muted-foreground font-medium">
                  No items found matching &quot;{searchQuery}&quot;
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 px-4 py-2 bg-primary text-cream text-xs font-bold rounded-full"
                >
                  Clear Search
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Soft Opening Special Showcase Card inspired by the poster */}
            <div className="mt-4 mb-2 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#B73F1D] to-[#9D3E22] text-cream shadow-lg border border-beige/30 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-cream/10 blur-xl pointer-events-none" />

              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cream/20 text-cream text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} /> Rooftop Lounge
                </span>
                <span className="text-xs text-beige font-semibold">
                  Doors are open
                </span>
              </div>

              <h2 className="font-heading font-extrabold text-xl sm:text-2xl lg:text-3xl text-cream leading-tight">
                Welcome to Spiral Cafe
              </h2>
              <p className="text-xs sm:text-sm text-beige/90 mt-1 max-w-2xl leading-relaxed">
                Enjoy gourmet smash burgers, crispy chicken wings, artisan
                sandos, creamy pastas, specialty coffees, and refreshing coolers
                under the starry sky.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-cream/15 text-xs text-cream/90">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock size={13} className="text-beige" />
                  <span>3:00 PM – 11:00 PM</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin size={13} className="text-beige" />
                  <span>Opp. Govt Hospital, Chengalpattu</span>
                </div>
              </div>
            </div>

            {/* Explore Categories - Vertical Merged Cards (including Special Combos at the end) */}
            <div className="py-5">
              <CategoryCardsList
                categories={categoriesForHome}
                onSelectCategory={(catId) =>
                  router.push(`/menu?category=${encodeURIComponent(catId)}`)
                }
                title="Explore Categories"
                subtitle="Discover our handcrafted cafe favorites"
                showCombosOption={true}
              />
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
