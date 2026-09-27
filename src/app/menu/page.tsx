"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Image from "next/image";
import { Search, Sparkles, ShoppingBag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MenuItemCard from "@/components/Menu/MenuItemCard";
import CustomerPhoneModal from "@/components/Menu/CustomerPhoneModal";
import { menuData } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { DynamicMenuItem } from "@/lib/db";

function MenuContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const tableParam = searchParams.get("table");

  const { tableNumber, setTableNumber, openCart, totalItems } = useCart();

  const [activeCategory, setActiveCategory] = useState(categoryParam || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dynamicItems, setDynamicItems] = useState<DynamicMenuItem[]>([]);

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

  // Fetch dynamic menu items
  const fetchDynamicMenu = useCallback(async () => {
    try {
      const res = await fetch("/api/menu/items");
      const json = await res.json();
      if (json.success && Array.isArray(json.items) && json.items.length > 0) {
        setDynamicItems(json.items);
      }
    } catch (e) {
      console.error("Failed to load live menu items, using fallback:", e);
    }
  }, []);

  useEffect(() => {
    fetchDynamicMenu();
  }, [fetchDynamicMenu]);

  // Construct category structure combining static hero info with dynamic live items
  const categoriesToRender = menuData.map((cat) => {
    if (dynamicItems.length > 0) {
      const liveForCat = dynamicItems.filter(
        (it) => it.categoryId.toLowerCase() === cat.id.toLowerCase()
      );

      if (liveForCat.length > 0) {
        return {
          ...cat,
          items: liveForCat.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            price: d.price,
            originalPrice: d.originalPrice,
            image: d.image,
            rating: d.rating,
            reviewsCount: d.reviewsCount,
            badges: [
              ...(d.dietType === "veg" ? (["veg"] as any[]) : []),
              ...(d.dietType === "non-veg" ? (["non-veg"] as any[]) : []),
              ...(d.badge && d.badge !== "none" ? [d.badge] : []),
            ],
            available: d.available,
          })),
        };
      }
    }
    return cat;
  });

  const displayedCategories =
    activeCategory === "all"
      ? categoriesToRender
      : categoriesToRender.filter(
          (cat) => cat.id.toLowerCase() === activeCategory.toLowerCase()
        );

  return (
    <main className="min-h-screen bg-background pb-28 md:pb-16">
      {/* Customer Phone Capture Modal */}
      <CustomerPhoneModal
        currentTable={tableNumber}
        onPhoneSaved={(phone) => setCustomerPhone(phone)}
      />

      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 pt-4 pb-2.5 shadow-xs">
        <div className="px-4 sm:px-6 lg:px-8 mb-2.5 max-w-6xl xl:max-w-7xl mx-auto">
          {/* Mobile Top Row */}
          <div className="flex md:hidden items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full bg-primary/10 p-0.5 border border-primary/20 flex items-center justify-center overflow-hidden">
                <Image src="/logo.png" alt="Spiral Cafe" width={28} height={28} className="object-contain" />
              </div>
              <h1 className="font-heading font-extrabold text-lg sm:text-xl text-foreground">
                Spiral Cafe Menu
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openCart}
                className="text-[11px] font-bold text-[#8C5E51] bg-muted hover:bg-[#EBDAD0] px-2.5 py-1 rounded-full border border-border cursor-pointer transition-colors"
              >
                {tableNumber}
              </button>
              <button
                onClick={openCart}
                className="text-[11px] font-bold text-cream bg-primary hover:bg-primary-dark px-3 py-1 rounded-full shadow-xs cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <ShoppingBag size={12} />
                <span>Basket ({totalItems})</span>
              </button>
            </div>
          </div>

          {/* Desktop Top Row */}
          <div className="hidden md:flex items-center justify-between gap-5 mb-2.5">
            <Link href="/" className="flex items-center gap-3 shrink-0 group">
              <div className="relative w-10 h-10 rounded-full bg-primary/10 p-1 border border-primary/20 flex items-center justify-center overflow-hidden shadow-xs group-hover:scale-105 transition-transform">
                <Image src="/logo.png" alt="Spiral Cafe" width={34} height={34} className="object-contain" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-xl text-foreground leading-none group-hover:text-primary transition-colors">
                  Spiral Cafe
                </h1>
                <span className="text-[11px] text-[#8C5E51] font-semibold">Gourmet Rooftop Menu</span>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5 lg:gap-2">
              <Link
                href="/"
                className="px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold text-[#8C5E51] hover:text-[#4A2117] hover:bg-muted/60 transition-colors"
              >
                Home
              </Link>
              <Link
                href="/menu"
                className="px-4 py-1.5 rounded-xl text-xs font-heading font-bold bg-primary text-cream shadow-xs"
              >
                Menu
              </Link>
              <Link
                href="/offers"
                className="px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold text-[#8C5E51] hover:text-[#4A2117] hover:bg-muted/60 transition-colors"
              >
                Combos
              </Link>
              <Link
                href="/contact"
                className="px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold text-[#8C5E51] hover:text-[#4A2117] hover:bg-muted/60 transition-colors"
              >
                Visit Us
              </Link>
            </nav>

            <div className="relative flex-1 max-w-xs lg:max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-primary">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-2 bg-card border border-border rounded-full text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all placeholder:text-muted-foreground/70 text-xs font-medium shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={openCart}
                className="text-xs font-bold text-[#8C5E51] bg-muted hover:bg-[#EBDAD0] px-3.5 py-1.5 rounded-full border border-border cursor-pointer transition-colors"
              >
                🍽️ {tableNumber}
              </button>
              <button
                onClick={openCart}
                className="text-xs font-bold text-cream bg-primary hover:bg-primary-dark px-4 py-1.5 rounded-full shadow-sm cursor-pointer flex items-center gap-2 transition-transform active:scale-95 hover:shadow-md"
              >
                <ShoppingBag size={14} />
                <span>My Basket ({totalItems})</span>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="relative md:hidden">
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

        {/* Category Navigation Pills */}
        <div
          className="flex overflow-x-auto md:flex-wrap md:overflow-visible md:justify-center lg:justify-start gap-2 px-4 sm:px-6 lg:px-8 pb-1.5 scrollbar-hide snap-x max-w-6xl xl:max-w-7xl mx-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <button
            onClick={() => setActiveCategory("all")}
            className={`snap-start shrink-0 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              activeCategory === "all"
                ? "bg-primary text-cream shadow-md scale-105"
                : "bg-card text-foreground hover:bg-muted border border-border hover:border-primary/40"
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
                    : "bg-card text-foreground hover:bg-muted border border-border hover:border-primary/40"
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Categories List */}
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex flex-col gap-10">
        {displayedCategories.map((category) => {
          const filteredItems = category.items.filter(
            (item) =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (item.description &&
                item.description.toLowerCase().includes(searchQuery.toLowerCase()))
          );

          if (filteredItems.length === 0) return null;

          return (
            <section key={category.id} id={category.id} className="scroll-mt-36">
              {/* Category Banner */}
              <div className="relative h-44 sm:h-52 md:h-56 lg:h-60 w-full rounded-3xl overflow-hidden mb-6 shadow-md border border-border/60">
                <Image
                  src={category.heroImage}
                  alt={category.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1280px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="text-3xl sm:text-4xl mb-1">{category.icon}</div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-cream tracking-wide uppercase drop-shadow-md">
                    {category.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-beige font-medium mt-1 max-w-lg">
                    {category.description}
                  </p>
                  <span className="mt-2 text-[10px] sm:text-xs font-bold text-cream/90 bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full">
                    {filteredItems.length} varieties
                  </span>
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                {filteredItems.map((item, idx) => (
                  <MenuItemCard key={item.id} index={idx} {...item} />
                ))}
              </div>
            </section>
          );
        })}

        {displayedCategories.length === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border p-8 max-w-xl mx-auto">
            <p className="text-base font-semibold text-foreground">No menu items found.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try searching for wings, smash burgers, sandos, fries, pasta, coffee, or shakes.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
          Loading Spiral Cafe Menu...
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
