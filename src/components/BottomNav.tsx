"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, Tag, ImageIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Menu", href: "/menu", icon: UtensilsCrossed },
  { name: "Offers", href: "/offers", icon: Tag },
  { name: "Gallery", href: "/gallery", icon: ImageIcon },
  { name: "Visit Us", href: "/contact", icon: MapPin },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFF8F3]/95 backdrop-blur-xl border-t border-[#EBDAD0] shadow-[0_-4px_20px_rgba(74,33,23,0.06)]">
      <nav className="flex items-center justify-around px-2 py-2.5 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 px-2 rounded-2xl transition-all duration-200",
                isActive 
                  ? "text-[#B73F1D] font-bold" 
                  : "text-[#8C5E51] hover:text-[#4A2117]"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isActive && "bg-[#B73F1D]/10"
              )}>
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.9} />
              </div>
              <span className="text-[10px] font-semibold tracking-tight leading-none">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
