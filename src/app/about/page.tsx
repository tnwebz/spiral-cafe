"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import { Award, Flame, Heart, Sparkles, MapPin, Coffee, Utensils } from "lucide-react";

const features = [
  { icon: Flame, title: "Artisan Quality", desc: "Crafted fresh with authentic spices and gourmet ingredients" },
  { icon: Sparkles, title: "Rooftop Vibe", desc: "Open-air starry ambience in the heart of Chengalpattu" },
  { icon: Coffee, title: "Specialty Drinks", desc: "Signature brews, cold drops & indulgent thick shakes" },
  { icon: Heart, title: "Made with Love", desc: "Every plate served with care for you and your friends" },
];

export default function AboutPage() {
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
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 p-1 flex items-center justify-center mb-3">
            <Image src="/logo.png" alt="Spiral Cafe Logo" width={56} height={56} className="object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-foreground mb-2">
            About Spiral Cafe
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm sm:text-base max-w-xl">
            Welcome to <strong className="text-primary">Spiral Cafe</strong>, Chengalpattu&apos;s premier rooftop cafe sanctuary where culinary passion meets unforgettable rooftop vibes.
          </p>
        </motion.div>

        {/* Hero Poster Architecture & Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="relative w-full h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden mb-10 shadow-lg border border-border"
        >
          <Image
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop"
            alt="Spiral Cafe Rooftop Ambience"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-cream">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/90 text-cream text-[10px] font-bold uppercase tracking-wider mb-2">
              <MapPin size={11} /> Chengalpattu Rooftop
            </div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold">
              Where Good Conversations & Great Food Spiral Together
            </h2>
          </div>
        </motion.div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-xs mb-10 text-foreground"
        >
          <h2 className="text-2xl font-heading font-bold text-foreground mb-3 flex items-center gap-2">
            <Utensils size={20} className="text-primary" /> Our Passion
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
            At Spiral Cafe, we set out with a simple yet bold idea: to serve delicious gourmet snacks—from crunchy peri-peri loaded fries and toasted panini sandwiches to double-cheese smashed burgers, wood-fired pizzas, and specialty frappes—all in a cozy, breezy rooftop haven.
          </p>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Whether you are catching up with friends after college, enjoying a sunset snack, or stopping by for dinner under the lights, Spiral Cafe is designed to be your second home.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          {features.map((feat, idx) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="bg-card p-5 rounded-2xl text-center border border-border shadow-xs flex flex-col items-center"
            >
              <div className="w-11 h-11 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                <feat.icon size={20} />
              </div>
              <h3 className="font-heading font-bold text-foreground text-sm sm:text-base mb-1">
                {feat.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-snug">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
      
      <BottomNav />
    </main>
  );
}
