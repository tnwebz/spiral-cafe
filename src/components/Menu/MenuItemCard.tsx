"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Flame, ChefHat, Sparkles, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

export type BadgeType = "veg" | "non-veg" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular";

export interface MenuItemCardProps {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  reviewsCount?: number;
  image: string;
  badges?: BadgeType[];
  description?: string;
  index?: number;
  available?: boolean;
}

export default function MenuItemCard({
  id,
  name,
  price,
  originalPrice,
  rating = 4.8,
  reviewsCount = 340,
  image,
  badges = [],
  description,
  index = 0,
  available = true,
}: MenuItemCardProps) {
  const calculatedOriginalPrice = originalPrice || Math.round(price * 1.35);
  const itemId = id || name.toLowerCase().replace(/\s+/g, "-");
  const displayImage =
    image && image.trim() && !image.startsWith("blob:")
      ? image
      : "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop";

  const {
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    getItemDineInQuantity,
    getItemParcelQuantity,
    isViewOnlyMenu,
  } = useCart();
  const dineInQty = getItemDineInQuantity(itemId);
  const parcelQty = getItemParcelQuantity(itemId);
  const totalQty = dineInQty + parcelQty;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.25) }}
      className="bg-card rounded-3xl overflow-hidden border border-border/80 shadow-[0_6px_20px_rgba(74,33,23,0.05)] hover:shadow-[0_14px_32px_rgba(183,63,29,0.12)] md:hover:-translate-y-1 transition-all duration-300 flex flex-col group h-full justify-between"
    >
      {/* Top Half: Centered Full-Fitted Photo (No Crop / No Cut) */}
      <div className="relative w-full h-48 sm:h-52 md:h-48 lg:h-52 bg-[#FFFBF7] overflow-hidden shrink-0 flex items-center justify-center">
        {/* Ambient atmospheric backdrop */}
        <Image
          src={displayImage}
          alt=""
          fill
          aria-hidden="true"
          className="object-cover blur-xl opacity-25 scale-110 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15 pointer-events-none" />

        {/* Crisp Uncropped Centered Food Photography */}
        <div className="relative w-full h-full p-2.5 flex items-center justify-center z-5">
          <Image
            src={displayImage}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain object-center transition-transform duration-500 group-hover:scale-105 drop-shadow-md"
          />
        </div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          {badges.includes("bestseller") && (
            <span className="flex items-center gap-1 bg-primary text-cream text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
              <Star size={10} className="fill-cream stroke-none" /> Best Seller
            </span>
          )}
          {badges.includes("chef-choice") && (
            <span className="flex items-center gap-1 bg-primary-dark/95 text-cream text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-md border border-white/20">
              <ChefHat size={10} /> Chef Special
            </span>
          )}
          {badges.includes("new") && (
            <span className="flex items-center gap-1 bg-accent text-cream text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
              <Sparkles size={10} /> New
            </span>
          )}
          {badges.includes("popular") && (
            <span className="flex items-center gap-1 bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
              <Flame size={10} /> Popular
            </span>
          )}
          {badges.includes("spicy") && (
            <span className="flex items-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-md">
              <Flame size={10} /> Spicy
            </span>
          )}
        </div>
      </div>

      {/* Bottom Half: Details */}
      <div className="p-4 md:p-4.5 flex flex-col justify-between flex-1 gap-2 bg-card">
        <div>
          {/* Name & Veg/Non-Veg icon */}
          <div className="flex items-start gap-2 mb-1.5">
            {(badges.includes("veg") || badges.includes("non-veg")) && (
              <div
                className={cn(
                  "flex items-center justify-center w-4 h-4 border-2 rounded-xs shrink-0 mt-0.5",
                  badges.includes("veg") ? "border-emerald-600" : "border-rose-600"
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    badges.includes("veg") ? "bg-emerald-600" : "bg-rose-600"
                  )}
                />
              </div>
            )}
            <h3 className="font-heading font-bold text-base sm:text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {name}
            </h3>
          </div>

          {/* Description snippet with consistent minimum height */}
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-1 leading-relaxed">
              {description}
            </p>
          )}

          {/* Rating Line: ★ 4.8 (340 reviews) */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <div className="flex items-center text-primary font-bold gap-1 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/15">
              <Star size={12} className="fill-primary stroke-none" />
              <span>{rating.toFixed(1)}</span>
            </div>
            <span className="text-muted-foreground/90 font-medium">({reviewsCount} reviews)</span>
          </div>
        </div>

        {/* Pricing Line & Add to Cart / Quantity Controller */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50 gap-2">
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="font-sans font-extrabold text-xl sm:text-2xl text-primary">
              ₹{price}
            </span>
            <span className="font-sans text-xs font-medium text-muted-foreground/60 line-through">
              ₹{calculatedOriginalPrice}
            </span>
          </div>

          {/* Ordering Quantity Control / Digital Menu Static Mode */}
          <div>
            {isViewOnlyMenu ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50/90 text-amber-900 border border-amber-200/80 rounded-full font-heading font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
                <span>📖 Digital Menu</span>
              </span>
            ) : !available ? (
              <span className="inline-block px-3 py-1.5 bg-zinc-200 text-zinc-600 font-heading font-extrabold text-[11px] rounded-full uppercase tracking-wider cursor-not-allowed">
                SOLD OUT
              </span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* 1. Dine-In Control (Always visible & accessible) */}
                {dineInQty === 0 ? (
                  <button
                    onClick={() =>
                      addToCart({
                        id: itemId,
                        name,
                        price,
                        image,
                        description,
                        isParcel: false,
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-cream hover:bg-primary-dark font-heading font-bold text-xs rounded-full shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="Eat here (Dine In)"
                  >
                    <Plus size={12} strokeWidth={3} />
                    <span>Add</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-[#FFF8F3] border border-[#B73F1D]/40 rounded-full px-1.5 py-0.5 shadow-2xs text-[11px]">
                    <span className="text-[10px] font-extrabold text-[#8C5E51] uppercase">🍽️</span>
                    <button
                      onClick={() => decreaseQuantity(itemId)}
                      className="w-5 h-5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-cream flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Decrease dine-in"
                    >
                      <Minus size={10} strokeWidth={3} />
                    </button>
                    <span className="font-heading font-bold text-xs text-[#4A2117] min-w-[14px] text-center">
                      {dineInQty}
                    </span>
                    <button
                      onClick={() => increaseQuantity(itemId)}
                      className="w-5 h-5 rounded-full bg-primary text-cream hover:bg-primary-dark flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Increase dine-in"
                    >
                      <Plus size={10} strokeWidth={3} />
                    </button>
                  </div>
                )}

                {/* 2. Take Away / Parcel Control (Always visible & accessible) */}
                {parcelQty === 0 ? (
                  <button
                    onClick={() =>
                      addToCart({
                        id: itemId,
                        name,
                        price,
                        image,
                        description,
                        isParcel: true,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-heading font-bold text-xs rounded-full shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="Pack for Takeaway (Parcel)"
                  >
                    <span>🛍️ Parcel</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-2xs text-[11px]">
                    <span className="text-[10px] font-extrabold text-amber-900 uppercase">🛍️</span>
                    <button
                      onClick={() => decreaseQuantity(`${itemId}__parcel`)}
                      className="w-5 h-5 rounded-full bg-amber-200/70 text-amber-900 hover:bg-amber-800 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Decrease parcel"
                    >
                      <Minus size={10} strokeWidth={3} />
                    </button>
                    <span className="font-heading font-bold text-xs text-amber-950 min-w-[14px] text-center">
                      {parcelQty}
                    </span>
                    <button
                      onClick={() => increaseQuantity(`${itemId}__parcel`)}
                      className="w-5 h-5 rounded-full bg-amber-600 text-white hover:bg-amber-700 flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Increase parcel"
                    >
                      <Plus size={10} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
