"use client";

import { motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import { Tag, Sparkles, Flame, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const combos = [
  {
    title: "The Smash & Dip Combo",
    price: 349,
    originalPrice: 450,
    tag: "Most Popular",
    items: ["1 Oklahoma Chicken / Mushroom Smash", "1 Drippy Cheese Fries", "1 Iced Latte or Mango Passion Cooler"],
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop",
  },
  {
    title: "Rooftop Wings & Sando Feast",
    price: 599,
    originalPrice: 780,
    tag: "Best Value for 2",
    items: ["1 Garlic Parmesan Wings (6 pcs)", "1 Southside Chick / French Onion Sando", "1 Loaded AF Fries", "2 Shakes or Coolers"],
    image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?q=80&w=600&auto=format&fit=crop",
  },
  {
    title: "Sando & Cold Brew Delight",
    price: 299,
    originalPrice: 410,
    tag: "Sunset Special",
    items: ["1 Mushroom & Mayhem or Egg & Melt Sando", "1 Americano or Peach Iced Tea"],
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=600&auto=format&fit=crop",
  },
];

export default function OffersPage() {
  return (
    <main className="min-h-screen bg-background pb-28 pt-6">
      <div className="max-w-3xl mx-auto px-4">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 flex flex-col items-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 p-1 flex items-center justify-center mb-3">
            <Image src="/logo.png" alt="Spiral Cafe" width={48} height={48} className="object-contain" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider mb-2">
            <Tag size={12} /> Exclusive Combos
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-foreground mb-2">
            Spiral Specials & Combos
          </h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Save big on our handcrafted cafe combinations and rooftop party platters.
          </p>
        </motion.div>

        {/* Combos Grid */}
        <div className="flex flex-col gap-6">
          {combos.map((combo, idx) => (
            <motion.div
              key={combo.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="bg-card rounded-3xl overflow-hidden border border-border/80 shadow-md flex flex-col sm:flex-row group"
            >
              {/* Image Preview */}
              <div className="relative w-full sm:w-48 h-44 sm:h-auto bg-muted shrink-0 overflow-hidden">
                <Image
                  src={combo.image}
                  alt={combo.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:hidden" />
                <span className="absolute top-3 left-3 bg-primary text-cream text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                  {combo.tag}
                </span>
              </div>

              {/* Details */}
              <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                <div>
                  <h3 className="font-heading font-bold text-lg sm:text-xl text-foreground">
                    {combo.title}
                  </h3>
                  
                  <div className="mt-3 flex flex-col gap-1.5">
                    {combo.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Check size={10} strokeWidth={3} />
                        </div>
                        <span>{it}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans font-extrabold text-2xl text-primary">
                      ₹{combo.price}
                    </span>
                    <span className="font-sans text-xs font-medium text-muted-foreground line-through">
                      ₹{combo.originalPrice}
                    </span>
                  </div>

                  <Link
                    href="/menu"
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-cream text-xs font-bold rounded-full transition-all shadow-sm active:scale-95"
                  >
                    Explore Menu
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      <BottomNav />
    </main>
  );
}
