"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { menuData } from "@/data/menu";

export default function CategorySlider() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground tracking-tight">
            Explore Categories
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover our handcrafted cafe favorites
          </p>
        </div>
        <Link 
          href="/menu?category=fries" 
          className="text-xs sm:text-sm font-bold text-primary hover:text-primary-dark transition-colors px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20"
        >
          View All Menu
        </Link>
      </div>
      
      <div 
        ref={containerRef}
        className="flex overflow-x-auto gap-3.5 pb-2 pt-1 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {menuData.map((category, index) => (
          <Link 
            key={category.id} 
            href={`/menu?category=${category.id}`}
            className="shrink-0 snap-start"
          >
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              className="relative w-36 h-44 sm:w-40 sm:h-48 rounded-2xl overflow-hidden group shadow-[0_4px_16px_rgba(74,33,23,0.08)] border border-border/60 flex flex-col justify-end p-3.5 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(183,63,29,0.18)]"
            >
              <Image
                src={category.heroImage}
                alt={category.name}
                fill
                sizes="200px"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              
              <div className="relative z-10 flex flex-col gap-1">
                <span className="text-2xl filter drop-shadow">{category.icon}</span>
                <span className="text-cream font-heading font-bold text-base tracking-wide">
                  {category.name}
                </span>
                <span className="text-[11px] text-cream/70 font-medium">
                  {category.items.length} items
                </span>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </section>
  );
}
