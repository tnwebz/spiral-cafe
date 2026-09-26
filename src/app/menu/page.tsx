"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { Search, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MenuItemCard from "@/components/Menu/MenuItemCard";
import { menuData } from "@/data/menu";

import { useCart } from "@/context/CartContext";
import { ShoppingBag } from "lucide-react";

function MenuContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const tableParam = searchParams.get("table");
  
  const { tableNumber, setTableNumber, openCart, totalItems } = useCart();

  // Default to 'all' or specific query param if provided
  const [activeCategory, setActiveCategory] = useState(categoryParam || "all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (categoryParam) {
      setActiveCategory(categoryParam.toLowerCase());
    }
  }, [categoryParam]);

  useEffect(() => {
    if (tableParam) {
      setTableNumber(tableParam);
    }
  }, [tableParam, setTableNumber]);

  // Filter menuData based on active category
  const displayedCategories = activeCategory === "all"
    ? menuData
    : menuData.filter((cat) => cat.id.toLowerCase() === activeCategory.toLowerCase());

  return (
    <main className="min-h-screen bg-background pb-28">
      {/* Sticky Header Section with Terracotta theme */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 pt-4 pb-2 shadow-xs">
        {/* Top Cafe Branding & Search */}
        <div className="px-4 mb-3 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full bg-primary/10 p-0.5 border border-primary/20 flex items-center justify-center overflow-hidden">
                <Image src="/logo.png" alt="Spiral Cafe" width={28} height={28} className="object-contain" />
              </div>
              <h1 className="font-heading font-extrabold text-lg sm:text-xl text-foreground">
                Spiral Cafe Menu
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#8C5E51] bg-muted px-2.5 py-1 rounded-full border border-border">
                {tableNumber}
              </span>
              <button
                onClick={openCart}
                className="text-[11px] font-bold text-cream bg-primary hover:bg-primary-dark px-3 py-1 rounded-full shadow-xs cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <ShoppingBag size={12} />
                <span>Basket ({totalItems})</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-primary">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search wings, smash burgers, sandos, pasta, coffee, shakes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-full text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all placeholder:text-muted-foreground/70 text-xs sm:text-sm font-medium shadow-xs"
            />
          </div>
        </div>

        {/* Horizontal Category Selector Pills */}
        <div 
          className="flex overflow-x-auto gap-2 px-4 pb-2 scrollbar-hide snap-x max-w-4xl mx-auto" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => setActiveCategory("all")}
            className={`snap-start shrink-0 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              activeCategory === "all"
                ? "bg-primary text-cream shadow-md scale-105"
                : "bg-card text-foreground hover:bg-muted border border-border"
            }`}
          >
            ✨ All Items
          </button>

          {menuData.map((category) => {
            const isSelected = activeCategory.toLowerCase() === category.id.toLowerCase();
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`snap-start shrink-0 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected 
                    ? "bg-primary text-cream shadow-md scale-105" 
                    : "bg-card text-foreground hover:bg-muted border border-border"
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Items Categories List */}
      <div className="max-w-4xl mx-auto px-4 mt-6 flex flex-col gap-10">
        {displayedCategories.map((category) => {
          const filteredItems = category.items.filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
          );

          if (filteredItems.length === 0) return null;

          return (
            <section key={category.id} id={category.id} className="scroll-mt-36">
              {/* Category Banner */}
              <div className="relative h-44 sm:h-52 w-full rounded-3xl overflow-hidden mb-6 shadow-md border border-border/60">
                <Image
                  src={category.heroImage}
                  alt={category.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="text-3xl mb-1">{category.icon}</div>
                  <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-cream tracking-wide uppercase drop-shadow-md">
                    {category.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-beige font-medium mt-1 max-w-md">
                    {category.description}
                  </p>
                  <span className="mt-2 text-[10px] font-bold text-cream/90 bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full">
                    {filteredItems.length} varieties
                  </span>
                </div>
              </div>

              {/* Grid of items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item, idx) => (
                  <MenuItemCard key={item.id} index={idx} {...item} />
                ))}
              </div>
            </section>
          );
        })}

        {displayedCategories.length === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border p-8">
            <p className="text-base font-semibold text-foreground">No menu items found.</p>
            <p className="text-xs text-muted-foreground mt-1">Try searching for wings, smash burgers, sandos, fries, pasta, coffee, or shakes.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading Spiral Cafe Menu...</div>}>
      <MenuContent />
    </Suspense>
  );
}
