"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function FloatingCartBar() {
  const pathname = usePathname();
  const { totalItems, grandTotal, openCart } = useCart();

  // Do not show on admin, kitchen, or invoice screen
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/kitchen") ||
    pathname?.startsWith("/invoice")
  ) {
    return null;
  }

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-[68px] sm:bottom-[72px] md:bottom-8 md:right-8 md:left-auto z-45 px-4 md:px-0 pointer-events-none"
        >
          <div className="max-w-md md:max-w-sm mx-auto md:mx-0 pointer-events-auto">
            <button
              onClick={openCart}
              className="w-full bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] p-3.5 md:p-3 md:px-4 rounded-2xl shadow-[0_10px_25px_rgba(183,63,29,0.35)] hover:shadow-[0_14px_30px_rgba(183,63,29,0.45)] border border-[#E2C7BA]/30 flex items-center justify-between active:scale-[0.98] md:hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-cream">
                  <ShoppingBag size={18} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-[#E2C7BA] font-semibold leading-none">
                    Your Basket
                  </div>
                  <div className="text-sm sm:text-base font-heading font-extrabold text-[#FFF8F3] mt-0.5">
                    {totalItems} {totalItems === 1 ? "Item" : "Items"} • ₹{grandTotal}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-[#FFF8F3] text-[#B73F1D] px-3.5 py-1.5 rounded-xl font-heading font-bold text-xs shadow-xs">
                <span>VIEW BASKET</span>
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
