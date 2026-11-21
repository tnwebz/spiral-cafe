"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TakeawayQrRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.removeItem("spiral_entered");
      localStorage.setItem("spiral_table_session", "TAKEAWAY");
      localStorage.setItem("spiral_table_number", "TAKEAWAY");
      localStorage.setItem("spiral_order_mode", "TAKEAWAY");
    } catch {}

    router.replace("/menu?table=TAKEAWAY&mode=takeaway&qr=true");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FFF8F3] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-12 h-12 border-3 border-[#B73F1D] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-[#4A2117]">
        Welcome to Spiral Cafe! Connecting to Takeaway Ordering...
      </p>
    </div>
  );
}
