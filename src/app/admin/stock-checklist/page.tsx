"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StockChecklistRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/inventory");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center text-sm font-bold text-[#2C1710]">
      Redirecting to Inventory Management...
    </div>
  );
}
