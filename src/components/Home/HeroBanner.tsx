"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  Flame,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MapPin,
  Clock,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { bestSellingItems } from "@/data/menu";

interface HeroBannerProps {
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
}

export default function HeroBanner({
  onSearchChange,
  searchQuery = "",
}: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const totalSlides = bestSellingItems.length;

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + totalSlides) % totalSlides);
  };

  useEffect(() => {
    if (!isPaused) {
      autoPlayRef.current = setInterval(() => {
        nextSlide();
      }, 4000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [currentIndex, isPaused]);

  const currentItem = bestSellingItems[currentIndex];

  return (
    <section className="relative w-full flex flex-col justify-between overflow-hidden bg-[#9D3E22] pt-4 pb-10 shadow-xl">
      {/* Background Graphic & Terracotta Ambient Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#B73F1D] via-[#A7402E] to-[#4A2117] opacity-95" />
        {/* Subtle decorative circles mimicking rooftop lighting & sun */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#BE7860]/20 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-[#B73F1D]/30 blur-2xl" />
      </div>

      {/* Brand Header: Logo & Cafe Identity */}
      <div className="relative z-20 px-4 sm:px-6 lg:px-12 pt-3 pb-4 md:py-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3.5 sm:gap-4 group">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 rounded-full bg-cream/95 p-1.5 shadow-md border border-beige/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Image
              src="/logo.png"
              alt="Spiral Cafe Logo"
              width={60}
              height={60}
              className="object-contain w-full h-full"
              priority
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl md:text-3xl lg:text-4xl text-cream tracking-tight drop-shadow-sm">
                Spiral Cafe
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs md:text-sm font-medium text-beige flex items-center gap-1.5 mt-0.5">
              <MapPin size={13} className="text-cream shrink-0" />
              <span>Chengalpattu Rooftop Experience</span>
            </p>
          </div>
        </Link>

        {/* Desktop Header Nav Links */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-3 bg-black/15 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-inner">
          <Link
            href="/"
            className="px-4 py-2 rounded-full text-xs md:text-sm font-heading font-bold text-cream/90 hover:text-cream hover:bg-white/15 transition-all"
          >
            Home
          </Link>
          <Link
            href="/menu"
            className="px-5 py-2 rounded-full text-xs md:text-sm font-heading font-extrabold bg-cream text-primary shadow-sm hover:bg-white hover:scale-105 transition-all"
          >
            Explore Menu
          </Link>
          <Link
            href="/offers"
            className="px-4 py-2 rounded-full text-xs md:text-sm font-heading font-bold text-cream/90 hover:text-cream hover:bg-white/15 transition-all"
          >
            Combos
          </Link>
          <Link
            href="/contact"
            className="px-4 py-2 rounded-full text-xs md:text-sm font-heading font-bold text-cream/90 hover:text-cream hover:bg-white/15 transition-all"
          >
            Visit Us
          </Link>
        </nav>

        {/* Soft Opening / Status Pill */}
        <div className="bg-cream/15 backdrop-blur-md border border-cream/25 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-right shrink-0 shadow-xs">
          <span className="text-[11px] sm:text-xs md:text-sm font-bold text-cream tracking-wider uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /> Open Now
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative z-20 px-4 sm:px-6 lg:px-8 pt-2 md:pt-4 max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto w-full">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none text-primary">
            <Search className="h-5 w-5 md:h-6 md:w-6 text-[#B73F1D]" />
          </div>
          <input
            type="text"
            placeholder="Search wings, smash burgers, sandos, pasta, shakes..."
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="block w-full pl-11 md:pl-14 pr-12 md:pr-16 py-3.5 md:py-4 bg-cream text-[#4A2117] placeholder:text-[#8C5E51]/70 rounded-full border border-beige focus:outline-none focus:ring-2 focus:ring-cream shadow-xl text-sm md:text-base font-medium transition-all"
          />
          <Link
            href="/menu"
            className="absolute inset-y-1.5 right-1.5 p-2.5 md:p-3 bg-primary hover:bg-primary-dark text-cream rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md"
            aria-label="Filter menu"
          >
            <SlidersHorizontal className="h-4 w-4 md:h-5 md:w-5" />
          </Link>
        </div>
      </div>

      {/* Best Selling Slider Section */}
      <div
        className="relative z-10 my-auto px-4 sm:px-6 lg:px-8 pt-5 pb-1 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto w-full flex flex-col items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Section Header */}
        <div className="w-full flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-cream/15 text-cream">
              <Flame className="h-4 w-4 fill-cream stroke-none" />
            </div>
            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-cream tracking-wide drop-shadow-sm">
              Chef&apos;s Signature Picks
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-beige bg-black/20 px-2.5 py-1 rounded-full">
            {currentIndex + 1} / {totalSlides}
          </span>
        </div>

        {/* Sliding Card Container */}
        <div className="relative w-full h-[290px] sm:h-[310px] md:h-[330px] overflow-hidden rounded-3xl shadow-2xl border border-cream/20 bg-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, { offset }) => {
                if (offset.x < -50) {
                  nextSlide();
                } else if (offset.x > 50) {
                  prevSlide();
                }
              }}
              className="absolute inset-0 flex flex-col justify-between cursor-grab active:cursor-grabbing bg-card"
            >
              {/* Product Image */}
              <div className="relative w-full h-[170px] sm:h-[190px] bg-muted overflow-hidden">
                <Image
                  src={currentItem.image}
                  alt={currentItem.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover pointer-events-none"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />

                {/* Floating Tag */}
                <div className="absolute top-3 left-3 bg-primary text-cream font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                  <Star size={10} className="fill-cream stroke-none" /> Top Rated
                </div>
              </div>

              {/* Product Details */}
              <div className="p-4 bg-card text-foreground flex flex-col justify-between flex-1 border-t border-border/40">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-bold text-lg text-foreground line-clamp-1">
                      {currentItem.name}
                    </h3>
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded text-xs font-bold text-primary border border-primary/20 shrink-0">
                      <Star size={12} className="fill-primary stroke-none" />
                      <span>{currentItem.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 font-medium">
                    {currentItem.description || `(${currentItem.reviewsCount} reviews)`}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans text-xl font-extrabold text-primary">
                      ₹{currentItem.price}
                    </span>
                    <span className="font-sans text-xs font-medium text-muted-foreground/70 line-through">
                      ₹{currentItem.originalPrice}
                    </span>
                  </div>

                  <Link
                    href="/menu"
                    className="px-4 py-1.5 bg-primary hover:bg-primary-dark active:scale-95 text-cream text-xs font-bold rounded-full transition-all shadow-md"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            aria-label="Previous slide"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-cream backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-colors z-30 shadow-md"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next slide"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-cream backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-colors z-30 shadow-md"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2 mt-4 z-20">
          {bestSellingItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`transition-all duration-300 rounded-full ${
                currentIndex === idx
                  ? "w-7 h-2 bg-cream shadow-md"
                  : "w-2 h-2 bg-cream/40 hover:bg-cream/70"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
