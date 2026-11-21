"use client";

import { useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { resolveTableFromParam } from "@/lib/tableResolution";

export default function TableRedirectPage() {
  const params = useParams();
  const router = useRouter();

  const rawTable = params?.tableId as string;
  const resolved = resolveTableFromParam(rawTable);

  useEffect(() => {
    if (!resolved) return;

    try {
      sessionStorage.removeItem("spiral_entered");
      const existing = localStorage.getItem("spiral_table_session");
      if (!existing || existing.trim() === "" || existing.toUpperCase() === resolved.toUpperCase()) {
        localStorage.setItem("spiral_table_session", resolved);
        localStorage.setItem("spiral_table_number", resolved);
      }
    } catch {}

    router.replace(`/menu?table=${encodeURIComponent(resolved)}&qr=true`);
  }, [resolved, router]);

  if (!resolved) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#FFF8F3] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-12 h-12 border-3 border-[#B73F1D] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-[#4A2117]">
        Welcome to Spiral Cafe! Connecting to Table {resolved}...
      </p>
    </div>
  );
}
