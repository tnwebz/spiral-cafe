"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AdminLayout from "@/components/Admin/AdminLayout";
import { uploadImageToStorage } from "@/lib/storage";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Trash2,
} from "lucide-react";

const CATEGORY_OPTIONS = [
  { id: "side-quest", name: "Side Quest" },
  { id: "the-wing-dept", name: "The Wing Dept" },
  { id: "share-club", name: "Share Club" },
  { id: "burgers", name: "Burgers" },
  { id: "sandos", name: "Sandos" },
  { id: "pasta", name: "Pasta" },
  { id: "milk-coffee", name: "Milk Coffee" },
  { id: "non-milk-coffee", name: "Non Milk Coffee" },
  { id: "coolers", name: "Coolers" },
  { id: "iced-tea", name: "Iced Tea" },
];

export default function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("");
  const [originalPrice, setOriginalPrice] = useState<string>("");
  const [categoryId, setCategoryId] = useState("side-quest");
  const [dietType, setDietType] = useState<"veg" | "non-veg" | "egg" | "other">("non-veg");
  const [badge, setBadge] = useState<"none" | "bestseller" | "chef-choice" | "popular" | "new" | "spicy">("none");
  const [rating, setRating] = useState("4.8");
  const [reviewsCount, setReviewsCount] = useState("120");
  const [available, setAvailable] = useState(true);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [storagePath, setStoragePath] = useState<string>("");
  const [fileSizeInfo, setFileSizeInfo] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/menu/items/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.item) {
          const it = data.item;
          setName(it.name);
          setDescription(it.description || "");
          setPrice(String(it.price));
          setOriginalPrice(it.originalPrice ? String(it.originalPrice) : "");
          setCategoryId(it.categoryId || "side-quest");
          setDietType(it.dietType || "non-veg");
          setBadge(it.badge || "none");
          setRating(String(it.rating || 4.8));
          setReviewsCount(String(it.reviewsCount || 100));
          setAvailable(it.available ?? true);
          setImagePreview(it.image);
          setUploadedUrl(it.image);
          setStoragePath(it.storagePath || it.cloudinaryPublicId || "");
        } else {
          setFormError("Menu item not found.");
        }
      })
      .catch(() => setFormError("Failed to load item."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    setUploadError("");

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const uploadRes = await uploadImageToStorage(file, (pct) => {
        setUploadProgress(pct);
      });

      if (uploadRes.success && uploadRes.url) {
        setUploadedUrl(uploadRes.url);
        setStoragePath(uploadRes.publicId || "");
        if (uploadRes.compressedSize) {
          setFileSizeInfo(`${Math.round(uploadRes.compressedSize / 1024)} KB WebP`);
        }
        setUploadProgress(100);
      } else {
        setUploadError(uploadRes.error || "Failed to upload to Supabase Storage.");
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload error.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Item name is required.");
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setFormError("Please enter a valid price (e.g. 240).");
      return;
    }

    setSaving(true);
    setFormError("");

    const selectedCat = CATEGORY_OPTIONS.find((c) => c.id === categoryId) || {
      id: categoryId,
      name: categoryId,
    };

    try {
      const res = await fetch(`/api/menu/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          price: numPrice,
          originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
          categoryId: selectedCat.id,
          categoryName: selectedCat.name,
          dietType,
          badge,
          rating: parseFloat(rating) || 4.8,
          reviewsCount: parseInt(reviewsCount, 10) || 100,
          image: uploadedUrl || imagePreview,
          storagePath: storagePath || undefined,
          available,
          adminUser: "Admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/admin/menu");
      } else {
        setFormError(data.error || "Failed to update item.");
      }
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-[#52525b]">
          <p className="font-semibold text-sm">Loading product details...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#CA340A]/10 pb-4">
          <Link
            href="/admin/menu"
            className="p-2 rounded-xl bg-white border border-zinc-200 text-[#52525b] hover:text-[#2C1710] hover:bg-[#FFF9F5] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#2C1710]">
              Edit Menu Item
            </h1>
            <p className="text-xs text-[#52525b]">
              Update product specs, price, and food photography
            </p>
          </div>
        </div>

        {formError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-xs font-medium text-[#2C1710] focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-sm font-bold text-[#2C1710] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#52525b] mb-1.5 uppercase tracking-wider">
                    Original Price (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#52525b] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-xs font-semibold text-[#2C1710]"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                    Diet Classification
                  </label>
                  <select
                    value={dietType}
                    onChange={(e) => setDietType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-xs font-semibold text-[#2C1710]"
                  >
                    <option value="veg">Vegetarian (🌱)</option>
                    <option value="non-veg">Non-Vegetarian (🍗)</option>
                    <option value="egg">Contains Egg (🥚)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                    Badge Tag
                  </label>
                  <select
                    value={badge}
                    onChange={(e) => setBadge(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#FFF9F5] border border-[#CA340A]/20 rounded-xl text-xs font-semibold text-[#2C1710]"
                  >
                    <option value="none">None</option>
                    <option value="bestseller">Best Seller</option>
                    <option value="chef-choice">Chef Special</option>
                    <option value="popular">Popular</option>
                    <option value="new">New</option>
                    <option value="spicy">Spicy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#52525b] mb-1.5 uppercase tracking-wider">
                    Rating
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#52525b] mb-1.5 uppercase tracking-wider">
                    Reviews Count
                  </label>
                  <input
                    type="number"
                    value={reviewsCount}
                    onChange={(e) => setReviewsCount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710]"
                  />
                </div>
              </div>
            </div>

            {/* Right: Image & Availability */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs space-y-4">
                <label className="block text-xs font-bold text-[#2C1710] uppercase tracking-wider">
                  Product Image (Supabase Storage)
                </label>

                {imagePreview ? (
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    {fileSizeInfo && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-600/90 text-white rounded-md text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        <CheckCircle2 size={10} /> {fileSizeInfo}
                      </div>
                    )}
                    <label className="absolute bottom-2 right-2 px-3 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                      <span>Change Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-[#CA340A]/30 rounded-2xl bg-[#FFF9F5] cursor-pointer p-4">
                    <Upload size={24} className="text-[#CA340A] mb-2" />
                    <span className="text-xs font-bold">Upload to Supabase Storage</span>
                    <span className="text-[11px] text-[#52525b] text-center mt-1">
                      Auto-compressed to 250-300KB WebP
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}

                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-[#CA340A]">
                      <span>Uploading to Supabase Storage...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        style={{ width: `${uploadProgress}%` }}
                        className="h-full bg-[#CA340A] rounded-full transition-all"
                      />
                    </div>
                  </div>
                )}

                {uploadError && (
                  <p className="text-[11px] text-red-600 font-semibold">{uploadError}</p>
                )}
              </div>

              <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-[#2C1710] uppercase tracking-wider">
                    Available For Sale
                  </h4>
                  <p className="text-[11px] text-[#52525b]">
                    Toggle off to mark product as Sold Out
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#15803D]"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
            <Link
              href="/admin/menu"
              className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#52525b] hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving || isUploading}
              className="px-6 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save size={15} />
              <span>{saving ? "Saving Changes..." : "UPDATE MENU PRODUCT"}</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
