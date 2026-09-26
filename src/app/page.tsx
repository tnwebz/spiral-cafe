"use client";

import { useState, useEffect } from "react";
import SplashScreen from "@/components/SplashScreen";
import BottomNav from "@/components/BottomNav";
import HeroBanner from "@/components/Home/HeroBanner";
import CategorySlider from "@/components/Menu/CategorySlider";
import MenuItemCard from "@/components/Menu/MenuItemCard";
import { menuData } from "@/data/menu";
import Link from "next/link";
import { ArrowRight, Sparkles, MapPin, Clock } from "lucide-react";

export default function Home() {
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

  // Filter items if search query is entered
  const allFilteredItems = searchQuery.trim()
    ? menuData.flatMap((cat) =>
        cat.items.filter((item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : [];

  return (
    <main className="min-h-screen bg-background pb-28">
      {/* Hero Section with Terracotta theme, logo, search bar, & auto-sliding best sellers */}
      <HeroBanner searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="max-w-md mx-auto sm:max-w-xl md:max-w-3xl lg:max-w-5xl px-4 pt-2">
        {/* Search Results if user types in search bar */}
        {searchQuery.trim() ? (
          <section className="py-6">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-4">
              Search Results ({allFilteredItems.length})
            </h2>
            {allFilteredItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="mt-4 mb-2 p-5 rounded-3xl bg-gradient-to-br from-[#B73F1D] to-[#9D3E22] text-cream shadow-lg border border-beige/30 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-cream/10 blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cream/20 text-cream text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} /> Rooftop Lounge
                </span>
                <span className="text-xs text-beige font-semibold">Doors are open</span>
              </div>

              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-cream leading-tight">
                Welcome to Spiral Cafe
              </h2>
              <p className="text-xs sm:text-sm text-beige/90 mt-1 max-w-lg leading-relaxed">
                Enjoy fresh artisan coffees, crispy loaded fries, gourmet burgers, wood-fired pizzas, and signature drinks under the starry sky.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-cream/15 text-xs text-cream/90">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock size={13} className="text-beige" />
                  <span>6:00 PM – 11:00 PM</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin size={13} className="text-beige" />
                  <span>Opp. Govt Hospital, Chengalpattu</span>
                </div>
              </div>
            </div>

            {/* Explore Categories Horizontal Slider (Fries, Sandwich, Burgers, Pizzas, Drinks) */}
            <CategorySlider />

            {/* Featured Highlights Per Category on Home Page */}
            <div className="flex flex-col gap-8 py-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
                    Menu Highlights
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Handpicked customer favorites from each section
                  </p>
                </div>
                <Link
                  href="/menu"
                  className="text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                >
                  Full Menu &rarr;
                </Link>
              </div>

              {menuData.map((category) => {
                // Select 2 items per category for a rich showcase on home page
                const topItems = category.items.slice(0, 2);

                if (!topItems.length) return null;

                return (
                  <section key={category.id} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{category.icon}</span>
                        <h3 className="text-lg sm:text-xl font-heading font-bold text-foreground">
                          {category.name}
                        </h3>
                        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border/50">
                          {category.items.length} varieties
                        </span>
                      </div>

                      <Link
                        href={`/menu?category=${category.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline group"
                      >
                        <span>View All {category.name}</span>
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>

                    {/* 2-Column Responsive Card Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {topItems.map((item, idx) => (
                        <MenuItemCard key={item.id} index={idx} {...item} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
