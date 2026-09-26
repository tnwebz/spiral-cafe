"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";

const galleryImages = [
  { src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop", alt: "Rooftop Starry Ambience", className: "col-span-2 row-span-2" },
  { src: "https://images.unsplash.com/photo-1585109649139-366815a0d713?q=80&w=600&auto=format&fit=crop", alt: "Cheesy Loaded Fries", className: "col-span-1 row-span-1" },
  { src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop", alt: "Smokehouse Burger", className: "col-span-1 row-span-2" },
  { src: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop", alt: "Wood Fired Pizza", className: "col-span-1 row-span-1" },
  { src: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=600&auto=format&fit=crop", alt: "Artisan Panini Sandwiches", className: "col-span-2 row-span-1" },
  { src: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=600&auto=format&fit=crop", alt: "Specialty Biscoff Shake", className: "col-span-3 row-span-2" }
];

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-background pb-28 pt-6">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 flex flex-col items-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 p-1 flex items-center justify-center mb-3">
            <Image src="/logo.png" alt="Spiral Cafe" width={48} height={48} className="object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-foreground mb-2">
            Spiral Cafe Gallery
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md">
            Glimpses of our rooftop sunsets, handcrafted burgers, crispy fries, and evening vibes.
          </p>
        </motion.div>

        {/* Masonry Layout approximation using CSS Grid */}
        <div className="grid grid-cols-3 gap-3.5 auto-rows-[130px] sm:auto-rows-[180px]">
          {galleryImages.map((image, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className={`relative rounded-2xl overflow-hidden group shadow-sm border border-border ${image.className}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                <span className="text-cream font-heading font-semibold text-xs sm:text-sm drop-shadow-md">
                  {image.alt}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
