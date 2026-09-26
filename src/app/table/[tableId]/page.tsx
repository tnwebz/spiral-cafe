"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TableRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const rawTable = params?.tableId as string;
    if (rawTable) {
      // Store in localStorage for persistence
      try {
        localStorage.setItem("spiral_table_session", rawTable);
      } catch {}
      router.replace(`/menu?table=${encodeURIComponent(rawTable)}`);
    } else {
      router.replace("/menu");
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#FFF8F3] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-12 h-12 border-3 border-[#B73F1D] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-[#4A2117]">Connecting to your table...</p>
    </div>
  );
}
