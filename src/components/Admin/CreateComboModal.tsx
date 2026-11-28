"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { uploadImageToStorage } from "@/lib/storage";
import { DynamicMenuItem } from "@/lib/db";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Upload,
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";

interface CreateComboModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: DynamicMenuItem[];
  onComboCreated: () => void;
}

interface SelectedComboProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  categoryName?: string;
  dietType?: string;
  image?: string;
}

export default function CreateComboModal({
  isOpen,
  onClose,
  menuItems,
  onComboCreated,
}: CreateComboModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [customOriginalPrice, setCustomOriginalPrice] = useState("");
  const [dietType, setDietType] = useState<"veg" | "non-veg">("non-veg");
  const [badge, setBadge] = useState<"none" | "bestseller" | "chef-choice" | "popular" | "new">("bestseller");
  const [customNote, setCustomNote] = useState("");

  // Product Selection state
  const [selectedProducts, setSelectedProducts] = useState<SelectedComboProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Image Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [manualImageUrl, setManualImageUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Available items (excluding other combos to avoid nesting)
  const availableItems = useMemo(() => {
    return menuItems.filter(
      (it) => it.categoryId !== "combos" && it.available !== false
    );
  }, [menuItems]);

  const filteredSearchItems = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return availableItems.slice(0, 12);
    return availableItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.categoryName.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [availableItems, productSearch]);

  // Calculate sum of individual items
  const regularTotal = useMemo(() => {
    return selectedProducts.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0
    );
  }, [selectedProducts]);

  // Handle adding product
  const handleAddProduct = (item: DynamicMenuItem) => {
    setSelectedProducts((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          categoryName: item.categoryName,
          dietType: item.dietType,
          image: item.image,
        },
      ];
    });
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setSelectedProducts((prev) =>
      prev
        .map((p) => {
          if (p.id === id) {
            const nextQty = p.quantity + delta;
            return nextQty > 0 ? { ...p, quantity: nextQty } : null;
          }
          return p;
        })
        .filter(Boolean) as SelectedComboProduct[]
    );
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id === id));
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIsUploading(true);
    setUploadProgress(20);

    try {
      const uploadRes = await uploadImageToStorage(file, (pct) => {
        setUploadProgress(pct);
      });

      if (uploadRes.success && uploadRes.url) {
        setUploadedUrl(uploadRes.url);
        setUploadProgress(100);
      } else {
        setError(uploadRes.error || "Failed to upload combo image.");
      }
    } catch (err: any) {
      setError(err.message || "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isUploading) {
      setError("Please wait for combo image upload to finish.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a Combo Package name.");
      return;
    }

    const numPrice = Number(price);
    if (!price || isNaN(numPrice) || numPrice <= 0) {
      setError("Please enter a valid combo price.");
      return;
    }

    // Must have more than 1 product!
    const totalDishesCount = selectedProducts.reduce((acc, p) => acc + p.quantity, 0);
    if (selectedProducts.length < 2 && totalDishesCount < 2) {
      setError("Please select more than 1 product to include in this combo package.");
      return;
    }

    const finalImage =
      uploadedUrl && !uploadedUrl.startsWith("blob:")
        ? uploadedUrl
        : manualImageUrl.trim() && !manualImageUrl.startsWith("blob:")
        ? manualImageUrl.trim()
        : "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop";

    // Build clear included products description string
    const itemsDescription = selectedProducts
      .map((p) => `${p.quantity > 1 ? `${p.quantity}x ` : ""}${p.name}`)
      .join(" • ");

    const finalDescription = customNote.trim()
      ? `Includes: ${itemsDescription}. ${customNote.trim()}`
      : `Includes: ${itemsDescription}`;

    const finalOriginalPrice = customOriginalPrice
      ? Number(customOriginalPrice)
      : regularTotal > numPrice
      ? regularTotal
      : Math.round(numPrice * 1.3);

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: finalDescription,
        price: numPrice,
        originalPrice: finalOriginalPrice,
        categoryId: "combos",
        categoryName: "Special Combos",
        dietType,
        badge,
        rating: 4.9,
        reviewsCount: 150,
        image: finalImage,
        available: true,
      };

      const res = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create combo package.");
      }

      onComboCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save combo package.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#FFF9F5] to-amber-50/50 border-b border-[#CA340A]/15 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#CA340A] text-white flex items-center justify-center shadow-xs">
              <Package size={20} />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-lg text-[#2C1710] flex items-center gap-2">
                <span>Create Combo Package</span>
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Menu Bundle
                </span>
              </h2>
              <p className="text-xs text-[#52525b]">
                Bundle 2+ products with special deal pricing and display in Menu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Combo Name & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-[#2C1710]">
                Combo Package Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Smash & Dip Combo, Rooftop Feast..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] focus:outline-none font-medium text-[#2C1710]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2C1710]">
                Combo Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 349"
                min="1"
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] focus:outline-none font-bold text-[#CA340A]"
                required
              />
            </div>
          </div>

          {/* 2. Add Products Included (More than 1) */}
          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-[#2C1710] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-[#CA340A]" />
                  <span>Products Included in Combo (Select More Than 1)</span>
                </h3>
                <p className="text-[11px] text-[#52525b]">
                  Pick 2 or more dishes from your menu to include in this bundle
                </p>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-[#CA340A] text-white">
                {selectedProducts.reduce((sum, p) => sum + p.quantity, 0)} Items Added
              </span>
            </div>

            {/* Product Search & Quick Add */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search dishes to add (e.g. Smash, Fries, Shake, Wings)..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-amber-200 focus:border-[#CA340A] focus:outline-none"
                />
              </div>

              {/* Quick Suggestions Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white/70 rounded-xl border border-amber-100">
                {filteredSearchItems.map((item) => {
                  const isSelected = selectedProducts.some((p) => p.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddProduct(item)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                          : "bg-white hover:bg-amber-50 border border-zinc-200 text-[#2C1710]"
                      }`}
                    >
                      <Plus size={11} className="text-[#CA340A]" />
                      <span>{item.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">₹{item.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Products Table / List */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-amber-200/60">
                <span className="text-[11px] font-bold text-[#2C1710] block">
                  Included Dishes in this Package:
                </span>
                <div className="divide-y divide-amber-100 bg-white rounded-xl border border-amber-200 overflow-hidden">
                  {selectedProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-amber-50/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            prod.dietType === "veg" ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span className="font-bold text-[#2C1710]">{prod.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          (₹{prod.price} ea)
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 bg-amber-50 rounded-lg border border-amber-200 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod.id, -1)}
                            className="w-5 h-5 flex items-center justify-center hover:bg-amber-200/70 rounded text-[#2C1710] cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-5 text-center font-extrabold text-xs">
                            {prod.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod.id, 1)}
                            className="w-5 h-5 flex items-center justify-center hover:bg-amber-200/70 rounded text-[#2C1710] cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="font-bold font-mono text-[#2C1710] w-12 text-right">
                          ₹{prod.price * prod.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(prod.id)}
                          className="text-zinc-400 hover:text-red-500 p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Savings / Pricing Calculation Breakdown */}
                <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#52525b]">Individual items total: </span>
                    <strong className="font-mono text-[#2C1710]">₹{regularTotal}</strong>
                  </div>
                  {price && Number(price) > 0 && regularTotal > Number(price) && (
                    <div className="text-emerald-800 font-extrabold">
                      🎉 Customer Saves ₹{regularTotal - Number(price)} (
                      {Math.round(((regularTotal - Number(price)) / regularTotal) * 100)}% OFF)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Image Selection (Upload or URL) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#2C1710] block">
              Combo Package Image
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Image Preview Box */}
              <div className="relative w-28 h-24 rounded-2xl bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center">
                {imagePreview || manualImageUrl ? (
                  <Image
                    src={imagePreview || manualImageUrl}
                    alt="Combo preview"
                    fill
                    className="object-contain object-center p-1 bg-[#FFF9F5]"
                  />
                ) : (
                  <Package size={28} className="text-zinc-300" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-[10px] font-bold">
                    <span>{uploadProgress}%</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2 w-full">
                <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-[#CA340A]/30 hover:border-[#CA340A] rounded-xl text-xs font-bold text-[#CA340A] bg-[#FFF9F5] hover:bg-amber-50/50 cursor-pointer transition-colors text-center">
                  <Upload size={14} />
                  <span>{isUploading ? "Uploading..." : "Upload Photo from Device"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={manualImageUrl}
                  onChange={(e) => setManualImageUrl(e.target.value)}
                  placeholder="Or paste an image URL (e.g. Unsplash)..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 focus:border-[#CA340A] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Dietary & Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2C1710]">Dietary Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDietType("non-veg")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    dietType === "non-veg"
                      ? "bg-rose-50 border-rose-300 text-rose-800"
                      : "bg-[#FFF9F5] border-zinc-200 text-zinc-600"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Non-Veg (🍗)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDietType("veg")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    dietType === "veg"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-[#FFF9F5] border-zinc-200 text-zinc-600"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Vegetarian (🌱)</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2C1710]">Badge Highlight</label>
              <select
                value={badge}
                onChange={(e) => setBadge(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="bestseller">⭐ Best Seller</option>
                <option value="chef-choice">👨‍🍳 Chef Special</option>
                <option value="popular">🔥 Popular Deal</option>
                <option value="new">✨ New Package</option>
                <option value="none">No Badge</option>
              </select>
            </div>
          </div>

          {/* 5. Custom Note (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#2C1710]">
              Additional Description / Note (Optional)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Perfect for 2 people • Rooftop sunset favorite..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 focus:border-[#CA340A] focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || isUploading}
              className="px-6 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Combo...</span>
                </>
              ) : (
                <>
                  <Package size={15} />
                  <span>CREATE COMBO PACKAGE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
