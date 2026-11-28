"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OffersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/menu?category=combos");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center p-6 text-center">
      <div className="animate-pulse space-y-2">
        <div className="w-10 h-10 border-3 border-[#CA340A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-heading font-bold text-[#8C5E51]">Opening Special Combos...</p>
      </div>
    </div>
  );
}
