"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Flame, ChefHat, Sparkles, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

export type BadgeType = "veg" | "non-veg" | "bestseller" | "chef-choice" | "new" | "spicy";

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
}: MenuItemCardProps) {
  const calculatedOriginalPrice = originalPrice || Math.round(price * 1.35);
  const itemId = id || name.toLowerCase().replace(/\s+/g, "-");

  const { getItemQuantity, addToCart, increaseQuantity, decreaseQuantity } = useCart();
  const quantity = getItemQuantity(itemId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.25) }}
      className="bg-card rounded-3xl overflow-hidden border border-border/80 shadow-[0_6px_20px_rgba(74,33,23,0.05)] hover:shadow-[0_12px_32px_rgba(183,63,29,0.12)] transition-all duration-300 flex flex-col group h-full"
    >
      {/* Top Half: Image with Badge Overlay */}
      <div className="relative w-full h-44 sm:h-52 bg-muted overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

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
          {badges.includes("spicy") && (
            <span className="flex items-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-md">
              <Flame size={10} /> Spicy
            </span>
          )}
        </div>
      </div>

      {/* Bottom Half: Details */}
      <div className="p-4 flex flex-col justify-between flex-1 gap-2 bg-card">
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

          {/* Description snippet if available */}
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
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

          {/* Ordering Quantity Control */}
          <div>
            {quantity === 0 ? (
              <button
                onClick={() =>
                  addToCart({
                    id: itemId,
                    name,
                    price,
                    image,
                    description,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-cream hover:bg-primary-dark font-heading font-bold text-xs rounded-full shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Add</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-[#FFF8F3] border border-[#B73F1D]/40 rounded-full p-1 shadow-xs">
                <button
                  onClick={() => decreaseQuantity(itemId)}
                  className="w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-cream flex items-center justify-center font-bold transition-all active:scale-90 cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus size={13} strokeWidth={3} />
                </button>
                <span className="font-heading font-bold text-sm text-[#4A2117] min-w-[18px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => increaseQuantity(itemId)}
                  className="w-7 h-7 rounded-full bg-primary text-cream hover:bg-primary-dark flex items-center justify-center font-bold transition-all active:scale-90 cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus size={13} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
