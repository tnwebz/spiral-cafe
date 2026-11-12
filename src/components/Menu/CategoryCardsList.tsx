"use client";

import React from "react";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import FoodIcon from "@/components/FoodIcon";

export interface CategoryCardItem {
  id: string;
  name: string;
  icon?: string;
  heroImage: string;
  items: any[];
}

interface CategoryCardsListProps {
  categories: CategoryCardItem[];
  onSelectCategory: (categoryId: string) => void;
  title?: string;
  subtitle?: string;
  showCombosOption?: boolean;
}

export default function CategoryCardsList({
  categories,
  onSelectCategory,
  title = "Explore Categories",
  subtitle = "Select a category to view dishes and add to your order",
  showCombosOption = true,
}: CategoryCardsListProps) {
  const router = useRouter();

  return (
    <div className="w-full">
      {(title || subtitle) && (
        <div className="mb-4 sm:mb-5">
          {title && (
            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-[#2C1810] tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#8C5E51] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Vertical list of merged category cards */}
      <div className="flex flex-col gap-3.5 sm:gap-4">
        {categories.map((category) => {
          const dishCount = category.items?.length || 0;
          const displayImage =
            category.heroImage ||
            (category.items && category.items[0]?.image) ||
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop";

          return (
            <div
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#ECDCD3]/90 shadow-[0_2px_12px_rgba(74,33,23,0.04)] hover:shadow-[0_8px_24px_rgba(74,33,23,0.1)] transition-all duration-300 flex items-stretch group cursor-pointer text-left active:scale-[0.99] h-26 sm:h-30 md:h-34 lg:h-38 xl:h-42"
            >
              {/* Right Merged Image Section - Wide photographic coverage with crisp contrast */}
              <div
                className="absolute inset-y-0 right-0 w-[64%] sm:w-[58%] md:w-[55%] lg:w-[52%] xl:w-[50%] overflow-hidden pointer-events-none [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.5)_12%,black_24%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.5)_12%,black_24%,black_100%)]"
              >
                <Image
                  src={displayImage}
                  alt={category.name}
                  fill
                  sizes="(max-width: 640px) 280px, (max-width: 1024px) 550px, 800px"
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                />
                {/* Ultra-soft edge-only transition blend */}
                <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
              </div>

              {/* Left Column: Icon Square + Title + Dishes Count */}
              <div className="relative z-10 flex items-center gap-3.5 sm:gap-4 lg:gap-5 p-3.5 sm:p-4 lg:p-6 pl-4 sm:pl-5 lg:pl-7 flex-1 min-w-0 pr-14 sm:pr-16 lg:pr-20">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 xl:w-18 xl:h-18 rounded-2xl bg-[#FBF0E6] border border-[#ECDCD3] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform p-2">
                  <FoodIcon nameOrId={category.id} className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10" />
                </div>

                <div className="min-w-0 flex flex-col justify-center">
                  <h3 className="font-heading font-extrabold text-base sm:text-lg lg:text-xl xl:text-2xl text-[#2C1810] tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-xs sm:text-sm lg:text-base font-bold text-[#8C5E51] mt-0.5 lg:mt-1">
                    {dishCount} {dishCount === 1 ? "dish" : "dishes"}
                  </p>
                </div>
              </div>

              {/* Right Floating Circular Arrow Button */}
              <div className="absolute right-3.5 sm:right-5 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-white text-[#2C1810] shadow-[0_3px_12px_rgba(0,0,0,0.18)] flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all">
                <ArrowRight
                  className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.5}
                />
              </div>
            </div>
          );
        })}

        {/* COMBOS OPTION CARD AT THE END */}
        {showCombosOption && (
          <div
            onClick={() => router.push("/offers")}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#ECDCD3]/90 shadow-[0_2px_12px_rgba(74,33,23,0.04)] hover:shadow-[0_8px_24px_rgba(74,33,23,0.1)] transition-all duration-300 flex items-stretch group cursor-pointer text-left active:scale-[0.99] h-26 sm:h-30 md:h-34 lg:h-38 xl:h-42"
          >
            {/* Right Merged Image Section */}
            <div
              className="absolute inset-y-0 right-0 w-[64%] sm:w-[58%] md:w-[55%] lg:w-[52%] xl:w-[50%] overflow-hidden pointer-events-none [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.5)_12%,black_24%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.5)_12%,black_24%,black_100%)]"
            >
              <Image
                src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop"
                alt="Special Combos"
                fill
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 550px, 800px"
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            </div>

            {/* Left Column: Icon Square + Title + Tag */}
            <div className="relative z-10 flex items-center gap-3.5 sm:gap-4 lg:gap-5 p-3.5 sm:p-4 lg:p-6 pl-4 sm:pl-5 lg:pl-7 flex-1 min-w-0 pr-14 sm:pr-16 lg:pr-20">
              <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 xl:w-18 xl:h-18 rounded-2xl bg-[#FDF0E6] border border-[#ECDCD3] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform p-2">
                <FoodIcon nameOrId="combos" className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10" />
              </div>

              <div className="min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-extrabold text-base sm:text-lg lg:text-xl xl:text-2xl text-[#2C1810] tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                    Special Combos
                  </h3>
                  <span className="text-[10px] sm:text-xs font-extrabold text-[#A0472B] bg-[#FDF0E6] px-2.5 py-0.5 rounded-full border border-[#ECDCD3] uppercase tracking-wider">
                    Value Deals
                  </span>
                </div>
                <p className="text-xs sm:text-sm lg:text-base font-bold text-[#8C5E51] mt-0.5 lg:mt-1">
                  Handcrafted meals &bull; Save up to 30%
                </p>
              </div>
            </div>

            {/* Right Floating Circular Arrow Button */}
            <div className="absolute right-3.5 sm:right-5 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-white text-[#2C1810] shadow-[0_3px_12px_rgba(0,0,0,0.18)] flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all">
              <ArrowRight
                className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.5}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


