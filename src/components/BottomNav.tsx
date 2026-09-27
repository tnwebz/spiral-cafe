"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, Clock, Tag, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { openOrders, placedOrders, totalItems } = useCart();

  // Hide completely on Kitchen Display System
  if (pathname?.startsWith("/kitchen")) {
    return null;
  }

  const activeOrdersCount = placedOrders.filter(
    (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
  ).length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFF8F3]/95 backdrop-blur-xl border-t border-[#EBDAD0] shadow-[0_-4px_20px_rgba(74,33,23,0.06)] md:hidden">
      <nav className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[54px] py-1 px-2 rounded-2xl transition-all duration-200",
            pathname === "/" ? "text-[#B73F1D] font-bold" : "text-[#8C5E51] hover:text-[#4A2117]"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-all", pathname === "/" && "bg-[#B73F1D]/10")}>
            <Home size={19} strokeWidth={pathname === "/" ? 2.5 : 1.9} />
          </div>
          <span className="text-[10px] font-semibold tracking-tight leading-none">Home</span>
        </Link>

        <Link
          href="/menu"
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[54px] py-1 px-2 rounded-2xl transition-all duration-200",
            pathname.startsWith("/menu") ? "text-[#B73F1D] font-bold" : "text-[#8C5E51] hover:text-[#4A2117]"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-all", pathname.startsWith("/menu") && "bg-[#B73F1D]/10")}>
            <UtensilsCrossed size={19} strokeWidth={pathname.startsWith("/menu") ? 2.5 : 1.9} />
          </div>
          <span className="text-[10px] font-semibold tracking-tight leading-none">Menu</span>
        </Link>

        {/* My Orders Button */}
        <button
          onClick={openOrders}
          className="flex flex-col items-center justify-center gap-1 min-w-[54px] py-1 px-2 rounded-2xl transition-all duration-200 text-[#8C5E51] hover:text-[#B73F1D] cursor-pointer relative"
        >
          <div className="p-1.5 rounded-xl transition-all relative">
            <Clock size={19} strokeWidth={1.9} />
            {(activeOrdersCount > 0 || totalItems > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#B73F1D] text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {activeOrdersCount > 0 ? activeOrdersCount : totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-tight leading-none">Orders</span>
        </button>

        <Link
          href="/offers"
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[54px] py-1 px-2 rounded-2xl transition-all duration-200",
            pathname.startsWith("/offers") ? "text-[#B73F1D] font-bold" : "text-[#8C5E51] hover:text-[#4A2117]"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-all", pathname.startsWith("/offers") && "bg-[#B73F1D]/10")}>
            <Tag size={19} strokeWidth={pathname.startsWith("/offers") ? 2.5 : 1.9} />
          </div>
          <span className="text-[10px] font-semibold tracking-tight leading-none">Combos</span>
        </Link>

        <Link
          href="/contact"
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[54px] py-1 px-2 rounded-2xl transition-all duration-200",
            pathname.startsWith("/contact") ? "text-[#B73F1D] font-bold" : "text-[#8C5E51] hover:text-[#4A2117]"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-all", pathname.startsWith("/contact") && "bg-[#B73F1D]/10")}>
            <MapPin size={19} strokeWidth={pathname.startsWith("/contact") ? 2.5 : 1.9} />
          </div>
          <span className="text-[10px] font-semibold tracking-tight leading-none">Visit Us</span>
        </Link>
      </nav>
    </div>
  );
}
