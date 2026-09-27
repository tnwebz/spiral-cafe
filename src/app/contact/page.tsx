"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import { MapPin, Phone, Mail, Clock, ExternalLink } from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";

const contactDetails = [
  { 
    icon: MapPin, 
    title: "Location Address", 
    value: "Spiral cafe, Government Hospital opposite Road, CSI Mahimai Illam, Alagesan Nagar, Varadharaja Nagar, Chengalpattu, Tamil Nadu 603001" 
  },
  { 
    icon: Clock, 
    title: "Operating Hours", 
    value: "Everyday: 6:00 PM – 11:00 PM (Rooftop Dining & Takeaway)" 
  },
  { 
    icon: Phone, 
    title: "Call / Reservations", 
    value: "+91 98765 43210" 
  },
  { 
    icon: Mail, 
    title: "Email Support", 
    value: "contact@spiralcafe.in" 
  },
];

import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background pb-28 md:pb-16 pt-4">
      {/* Top Desktop Navigation Header */}
      <div className="hidden md:flex items-center justify-between px-6 lg:px-8 py-3 max-w-6xl xl:max-w-7xl mx-auto border-b border-border/60 mb-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-full bg-primary/10 p-1 border border-primary/20 flex items-center justify-center overflow-hidden shadow-xs group-hover:scale-105 transition-transform">
            <Image src="/logo.png" alt="Spiral Cafe" width={34} height={34} className="object-contain" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-xl text-foreground leading-none group-hover:text-primary transition-colors">
              Spiral Cafe
            </h1>
            <span className="text-[11px] text-[#8C5E51] font-semibold">Location &amp; Contact</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold text-[#8C5E51] hover:text-[#4A2117] hover:bg-muted/60 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/menu"
            className="px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold text-[#8C5E51] hover:text-[#4A2117] hover:bg-muted/60 transition-colors"
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
            className="px-4 py-1.5 rounded-xl text-xs font-heading font-bold bg-primary text-cream shadow-xs"
          >
            Visit Us
          </Link>
        </nav>
      </div>

      <div className="max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 p-1 flex items-center justify-center mb-3">
            <Image src="/logo.png" alt="Spiral Cafe" width={56} height={56} className="object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-foreground mb-2">
            Visit Spiral Cafe
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md">
            Join us on our rooftop opposite the Government Hospital in Chengalpattu. We can&apos;t wait to serve you!
          </p>
        </motion.div>

        {/* Location Banner Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="w-full bg-card rounded-3xl overflow-hidden mb-8 border border-border shadow-sm p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
            <div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Rooftop Destination
              </span>
              <h2 className="font-heading font-bold text-lg sm:text-xl text-foreground mt-2">
                Spiral Cafe – Chengalpattu
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                CSI Mahimai Illam, Alagesan Nagar
              </p>
            </div>

            <a
              href="https://maps.google.com/?q=Government+Hospital+Chengalpattu+Tamil+Nadu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-cream hover:bg-primary-dark font-bold text-xs rounded-full transition-all shadow-sm"
            >
              <span>Get Directions</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {contactDetails.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <detail.icon size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground text-xs sm:text-sm">
                    {detail.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {detail.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Social / Connect Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-gradient-to-br from-[#B73F1D] to-[#9D3E22] p-6 sm:p-8 rounded-3xl text-center text-cream flex flex-col items-center justify-center shadow-lg border border-beige/30"
        >
          <h3 className="text-xl sm:text-2xl font-heading font-bold text-cream mb-2">
            Connect With Spiral Cafe
          </h3>
          <p className="text-xs sm:text-sm text-beige max-w-sm mb-6">
            Tag us in your rooftop stories and reels on Instagram or reach us on WhatsApp for fast inquiries!
          </p>

          <div className="flex gap-4">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-cream text-[#B73F1D] hover:bg-beige transition-all rounded-full flex items-center justify-center shadow-md active:scale-95"
              aria-label="Instagram"
            >
              <FaInstagram size={22} />
            </a>
            <a
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-cream text-emerald-600 hover:bg-beige transition-all rounded-full flex items-center justify-center shadow-md active:scale-95"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={22} />
            </a>
          </div>
        </motion.div>
      </div>
      
      <BottomNav />
    </main>
  );
}
