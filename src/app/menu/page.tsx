"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import Image from "next/image";
import { Search, Sparkles, ShoppingBag, ArrowLeft, ArrowRight, Utensils, X, ChevronRight } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MenuItemCard from "@/components/Menu/MenuItemCard";
import CategoryCardsList from "@/components/Menu/CategoryCardsList";
import FoodIcon from "@/components/FoodIcon";
import { menuData } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { DynamicMenuItem } from "@/lib/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const tableParam = searchParams.get("table");

  const {
    tableNumber,
    setTableNumber,
    openCart,
    totalItems,
    foodPreference,
    setFoodPreference,
    tableReservation,
  } = useCart();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categoryParam ? categoryParam.toLowerCase() : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dynamicItems, setDynamicItems] = useState<DynamicMenuItem[]>([]);

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam.toLowerCase());
    } else {
      setSelectedCategory(null);
    }
  }, [categoryParam]);

  useEffect(() => {
    if (tableParam) {
      setTableNumber(tableParam);
    }
  }, [tableParam, setTableNumber]);

  const handleSelectCategory = (catId: string | null) => {
    setSelectedCategory(catId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (catId) {
      router.push(`/menu?category=${encodeURIComponent(catId)}`, { scroll: false });
    } else {
      router.push("/menu", { scroll: false });
    }
  };

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

  const menuTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchDynamicMenu();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("customer_menu_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
        },
        () => {
          if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
          menuTimerRef.current = setTimeout(() => {
            fetchDynamicMenu();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn("Supabase Realtime menu notice:", err);
      });

    return () => {
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchDynamicMenu]);

  // Construct category structure combining static hero info with dynamic live items
  const categoriesToRender = menuData
    .map((cat) => {
      let rawItems = cat.items;
      if (dynamicItems.length > 0) {
        const liveForCat = dynamicItems.filter(
          (it) => it.categoryId.toLowerCase() === cat.id.toLowerCase()
        );

        if (liveForCat.length > 0) {
          rawItems = liveForCat.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            price: d.price,
            originalPrice: d.originalPrice ?? Math.round(d.price * 1.35),
            image: d.image,
            rating: d.rating,
            reviewsCount: d.reviewsCount,
            badges: [
              ...(d.dietType === "veg" ? (["veg"] as any[]) : []),
              ...(d.dietType === "non-veg" ? (["non-veg"] as any[]) : []),
              ...(d.badge && d.badge !== "none" ? [d.badge] : []),
            ],
            available: d.available,
          }));
        }
      }

      // Filter by food preference (VEG_ONLY vs ALL)
      const filteredByPref =
        foodPreference === "VEG_ONLY"
          ? rawItems.filter((item) =>
              item.badges?.some(
                (b) => typeof b === "string" && b.toLowerCase() === "veg"
              )
            )
          : rawItems;

      return {
        ...cat,
        items: filteredByPref,
      };
    })
    .filter((cat) => cat.items.length > 0);

  const hasActiveCat = selectedCategory
    ? categoriesToRender.some((c) => c.id.toLowerCase() === selectedCategory.toLowerCase())
    : false;
  const currentCategory = hasActiveCat ? selectedCategory : null;

  const activeCategoryObj = currentCategory
    ? categoriesToRender.find((c) => c.id.toLowerCase() === currentCategory.toLowerCase())
    : null;

  // Flattened items for search
  const allFilteredSearchItems = searchQuery.trim()
    ? categoriesToRender.flatMap((cat) =>
        cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description &&
              item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : [];

  return (
    <main className="min-h-screen bg-background pb-28 md:pb-16">

      {/* Sticky Table Reservation Banner (Blue temporary 10-minute hold) */}
      {tableReservation && tableReservation.isReserved && !tableReservation.isExpired && (
        <div className="sticky top-0 z-50 bg-blue-600 text-white text-xs font-semibold py-2 px-4 shadow-md flex items-center justify-between gap-3 border-b border-blue-700">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0"></span>
            <span className="truncate">
              <strong className="font-extrabold uppercase tracking-wide">
                Table {tableReservation.tableNumber} Reserved
              </strong>{" "}
              • Time Remaining:{" "}
              <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-[13px]">
                {Math.floor(tableReservation.remainingSeconds / 60)
                  .toString()
                  .padStart(2, "0")}
                :
                {(tableReservation.remainingSeconds % 60)
                  .toString()
                  .padStart(2, "0")}
              </span>{" "}
              • Please place your order to confirm your table reservation.
            </span>
          </div>
          <button
            onClick={openCart}
            className="bg-white text-blue-700 hover:bg-blue-50 text-[11px] font-extrabold px-3 py-1 rounded-full shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            Confirm &amp; Place Order
          </button>
        </div>
      )}

      {tableReservation && tableReservation.isExpired && (
        <div className="sticky top-0 z-50 bg-amber-600 text-white text-xs font-semibold py-2 px-4 shadow-md flex items-center justify-between gap-3 border-b border-amber-700">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>
            <span className="truncate">
              ⚠️ Reservation for Table {tableReservation.tableNumber} expired. Please select your table again.
            </span>
          </div>
          <button
            onClick={openCart}
            className="bg-white text-amber-800 hover:bg-amber-50 text-[11px] font-extrabold px-3 py-1 rounded-full shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            Select Table
          </button>
        </div>
      )}

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
                className="block w-full pl-10 pr-9 py-2 bg-card border border-border rounded-full text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all placeholder:text-muted-foreground/70 text-xs font-medium shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={openCart}
                className="text-xs font-bold text-[#8C5E51] bg-muted hover:bg-[#EBDAD0] px-3.5 py-1.5 rounded-full border border-border cursor-pointer transition-colors inline-flex items-center gap-1.5"
              >
                <Utensils className="w-3.5 h-3.5 text-[#8C5E51]" />
                <span>{tableNumber}</span>
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
              className="block w-full pl-10 pr-9 py-2.5 bg-card border border-border rounded-full text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all placeholder:text-muted-foreground/70 text-xs sm:text-sm font-medium shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Food Preference Switcher & Status Bar (Compact, Professional Single-Line) */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 mb-1 max-w-6xl xl:max-w-7xl mx-auto">
          <div className="inline-flex items-center bg-[#F4EBE3] p-0.5 rounded-full border border-[#EBDAD0] shadow-2xs">
            <button
              type="button"
              onClick={() => setFoodPreference("VEG_ONLY")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                foodPreference === "VEG_ONLY"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-[#8C5E51] hover:text-[#4A2117]"
              }`}
            >
              <FoodIcon nameOrId="veg" className="w-3.5 h-3.5 shrink-0" />
              <span>Veg Only</span>
            </button>
            <button
              type="button"
              onClick={() => setFoodPreference("ALL")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                foodPreference === "ALL"
                  ? "bg-[#3A1710] text-[#FFF9F5] shadow-xs"
                  : "text-[#8C5E51] hover:text-[#4A2117]"
              }`}
            >
              <FoodIcon nameOrId="non-veg" className="w-4.5 h-3.5 shrink-0" />
              <span>Veg &amp; Non-Veg</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {foodPreference === "VEG_ONLY" ? (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Pure Veg
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-[#8C5E51] bg-[#F4EBE3]/70 border border-[#EBDAD0] px-2 py-0.5 rounded-full whitespace-nowrap">
                Full Menu
              </span>
            )}
          </div>
        </div>

        {/* If inside a category: Clean header with small professional orange All Categories button (Icons removed) */}
        {currentCategory && !searchQuery.trim() && (
          <div className="px-4 sm:px-6 lg:px-8 pt-1.5 pb-1 max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between gap-3 border-t border-border/40 mt-1">
            <button
              type="button"
              onClick={() => handleSelectCategory(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B73F1D] hover:bg-[#9D3618] text-white font-bold text-xs transition-all active:scale-95 shadow-xs cursor-pointer group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>All Categories</span>
            </button>

            {activeCategoryObj && (
              <span className="text-xs font-bold text-[#8C5E51] truncate">
                {activeCategoryObj.name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">

        {/* CASE 1: SEARCH ACTIVE */}
        {searchQuery.trim() ? (
          <div>
            <div className="flex items-center justify-between mb-5 bg-[#FAF3EC] border border-[#ECDCD3] rounded-2xl p-4">
              <div>
                <h2 className="text-base sm:text-lg font-heading font-extrabold text-[#2C1810]">
                  Search Results for &ldquo;{searchQuery}&rdquo;
                </h2>
                <p className="text-xs text-[#8C5E51] mt-0.5">
                  Found {allFilteredSearchItems.length} matching {allFilteredSearchItems.length === 1 ? "dish" : "dishes"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-3 py-1.5 rounded-full bg-white hover:bg-muted text-xs font-bold text-[#8C5E51] border border-[#ECDCD3] transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </div>

            {allFilteredSearchItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                {allFilteredSearchItems.map((item, idx) => (
                  <MenuItemCard
                    key={item.id}
                    index={idx}
                    {...item}
                    originalPrice={item.originalPrice ?? undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border p-8 max-w-xl mx-auto shadow-xs">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-base font-bold text-foreground">No dishes found matching &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1 mb-5">
                  Try searching for fries, smash burgers, sandos, pasta, coffee, or shakes.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-5 py-2.5 bg-[#3A1710] text-[#FFF9F5] rounded-full text-xs font-bold hover:bg-[#4A2117] transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Clear &amp; View Categories
                </button>
              </div>
            )}
          </div>
        ) : !currentCategory ? (

          /* CASE 2: CATEGORY SELECTION SCREEN (Exact Design Match with Reference Image, Seamlessly Merged) */
          <div className="max-w-2xl lg:max-w-3xl mx-auto">
            <CategoryCardsList
              categories={categoriesToRender}
              onSelectCategory={handleSelectCategory}
              title="Menu Categories"
              subtitle="Select a category to view dishes and add to your order"
            />

            {categoriesToRender.length === 0 && (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border p-8 max-w-xl mx-auto shadow-xs">
                <div className="mb-3 flex justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <FoodIcon nameOrId="veg" className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-base font-bold text-foreground">
                  {foodPreference === "VEG_ONLY"
                    ? "No vegetarian items available in any category right now"
                    : "No menu categories available"}
                </p>
                {foodPreference === "VEG_ONLY" && (
                  <button
                    type="button"
                    onClick={() => setFoodPreference("ALL")}
                    className="mt-4 px-5 py-2.5 bg-[#3A1710] text-[#FFF9F5] rounded-full text-xs font-bold hover:bg-[#4A2117] transition-all cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-2"
                  >
                    <FoodIcon nameOrId="non-veg" className="w-4 h-4" />
                    <span>Show Full Menu (Veg &amp; Non-Veg)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (

          /* CASE 3: INSIDE A SPECIFIC CATEGORY (Dishes View with Back to Categories Button) */
          <div>
            {/* Category Hero Banner with Professional Vector Icon */}
            {activeCategoryObj && (
              <div className="relative h-44 sm:h-52 md:h-56 lg:h-60 w-full rounded-3xl overflow-hidden mb-6 shadow-md border border-border/60">
                <Image
                  src={activeCategoryObj.heroImage}
                  alt={activeCategoryObj.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1280px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center mb-2 shadow-md p-2">
                    <FoodIcon nameOrId={activeCategoryObj.id} className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-cream tracking-wide uppercase drop-shadow-md">
                    {activeCategoryObj.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-beige font-medium mt-1 max-w-lg">
                    {activeCategoryObj.description}
                  </p>
                  <span className="mt-2 text-[10px] sm:text-xs font-bold text-cream/90 bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full">
                    {activeCategoryObj.items.length} varieties
                  </span>
                </div>
              </div>
            )}

            {/* Product Grid: 1 col on mobile, 2 on tablet, strictly 3 on laptop/desktop */}
            {activeCategoryObj && activeCategoryObj.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                {activeCategoryObj.items.map((item, idx) => (
                  <MenuItemCard
                    key={item.id}
                    index={idx}
                    {...item}
                    originalPrice={item.originalPrice ?? undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border p-8 max-w-xl mx-auto shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-3">
                  <FoodIcon nameOrId="veg" className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-foreground">No dishes available in this category for Pure Veg mode</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(null)}
                    className="px-4 py-2 rounded-full border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
                  >
                    ← Browse Other Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setFoodPreference("ALL")}
                    className="px-4 py-2 bg-[#3A1710] text-[#FFF9F5] rounded-full text-xs font-bold hover:bg-[#4A2117] transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <FoodIcon nameOrId="non-veg" className="w-3.5 h-3.5" />
                    <span>Show Non-Veg Dishes Too</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Return To Categories Bar */}
            <div className="mt-12 mb-6 p-5 sm:p-6 bg-gradient-to-r from-[#FAF0E6] via-[#FFF8F3] to-[#FAF0E6] border border-[#ECDCD3] rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-xs">
              <div>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#2C1810]">
                  Looking for more delicious dishes?
                </h3>
                <p className="text-xs sm:text-sm text-[#8C5E51] mt-0.5">
                  Explore other categories like shakes, sides, wings, or desserts to add to your order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSelectCategory(null)}
                className="px-5 py-2.5 rounded-full bg-[#B73F1D] text-white hover:bg-[#9D3618] text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-2 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Categories</span>
              </button>
            </div>
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
