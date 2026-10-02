"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import AdminLayout from "@/components/Admin/AdminLayout";
import { DynamicMenuItem } from "@/lib/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Tag,
  Star,
} from "lucide-react";

export default function AdminMenuPage() {
  const [items, setItems] = useState<DynamicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dietFilter, setDietFilter] = useState("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<DynamicMenuItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch("/api/menu/items");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (e) {
      console.error("Fetch menu error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchMenu();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_menu_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
        },
        () => {
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchMenu();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn("Supabase Realtime admin menu notice:", err);
      });

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchMenu]);

  const handleToggleAvailability = async (item: DynamicMenuItem) => {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/menu/items/${item.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUser: "Admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, available: data.available } : it))
        );
      } else {
        alert(data.error || "Failed to toggle availability.");
      }
    } catch {
      alert("Error toggling availability.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/menu/items/${deletingItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((it) => it.id !== deletingItem.id));
        setDeletingItem(null);
      } else {
        alert(data.error || "Failed to delete item.");
      }
    } catch {
      alert("Error deleting menu item.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const categories = Array.from(new Set(items.map((it) => it.categoryName))).sort();

  const filteredItems = items.filter((it) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      it.name.toLowerCase().includes(q) ||
      it.description.toLowerCase().includes(q) ||
      it.categoryName.toLowerCase().includes(q);

    const matchesCategory = categoryFilter === "ALL" || it.categoryName === categoryFilter;
    const matchesDiet = dietFilter === "ALL" || it.dietType === dietFilter;

    return matchesSearch && matchesCategory && matchesDiet;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Menu Management
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Manage products, live pricing, stock availability, and food photography
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMenu}
              className="p-2.5 rounded-xl bg-white border border-[#CA340A]/20 text-[#2C1710] hover:bg-[#FFF9F5] transition-colors cursor-pointer"
              title="Refresh Menu"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>

            <Link
              href="/admin/menu/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>ADD NEW ITEM</span>
            </Link>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-2">
              <Search size={16} className="absolute left-3 top-2.5 text-[#52525b]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food item name or description..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Categories ({items.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Diet Filter */}
            <div>
              <select
                value={dietFilter}
                onChange={(e) => setDietFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Diets</option>
                <option value="veg">Vegetarian (🌱)</option>
                <option value="non-veg">Non-Vegetarian (🍗)</option>
                <option value="egg">Contains Egg (🥚)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Menu Items Table / Grid */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">Item &amp; Image</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Diet &amp; Badge</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-center">Rating</th>
                  <th className="py-3 px-4 text-center">Live Availability</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#52525b]">
                      No menu products found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* Product Thumbnail & Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden shrink-0 border border-zinc-200">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                <UtensilsCrossed size={16} />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-[#2C1710]">{item.name}</h4>
                            <p className="text-[11px] text-[#52525b] line-clamp-1 max-w-xs">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 font-semibold text-[#52525b]">
                        {item.categoryName}
                      </td>

                      {/* Diet & Badge */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.dietType === "veg"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.dietType === "egg"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.dietType.toUpperCase()}
                          </span>

                          {item.badge && item.badge !== "none" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#CA340A]/10 text-[#CA340A]">
                              {item.badge.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-heading font-extrabold text-sm text-[#2C1710]">
                          ₹{item.price}
                        </div>
                        {item.originalPrice && (
                          <div className="text-[10px] text-zinc-400 line-through">
                            ₹{item.originalPrice}
                          </div>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md text-[11px]">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          {item.rating || 4.8}
                        </span>
                      </td>

                      {/* Live Availability Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleAvailability(item)}
                          className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                            item.available
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {togglingId === item.id
                            ? "Updating..."
                            : item.available
                            ? "AVAILABLE"
                            : "SOLD OUT"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/menu/${item.id}/edit`}
                            className="p-1.5 rounded-lg border border-zinc-200 text-[#52525b] hover:bg-[#FFF9F5] hover:text-[#CA340A] transition-colors"
                            title="Edit Item"
                          >
                            <Edit2 size={13} />
                          </Link>

                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-red-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div>
              <h3 className="font-heading font-extrabold text-lg text-[#2C1710]">
                Delete Menu Item?
              </h3>
              <p className="text-xs text-[#52525b] mt-1">
                Are you sure you want to remove <strong>"{deletingItem.name}"</strong> from the active menu? Historical orders will retain their item snapshots.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#52525b] hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
