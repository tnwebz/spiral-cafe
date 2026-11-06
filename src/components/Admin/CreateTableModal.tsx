"use client";

import React, { useState } from "react";
import { Plus, X, Users, MapPin, Hash, CheckCircle2, AlertCircle } from "lucide-react";

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suggestedNumber?: string;
}

export default function CreateTableModal({
  isOpen,
  onClose,
  onSuccess,
  suggestedNumber = "A16",
}: CreateTableModalProps) {
  const [tableNumber, setTableNumber] = useState(suggestedNumber);
  const [capacity, setCapacity] = useState(4);
  const [section, setSection] = useState("Dine-In");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      setError("Please provide a table number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: tableNumber.trim(),
          capacity: Number(capacity) || 4,
          section,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to create table.");
      }
    } catch {
      setError("Network error while creating table.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#3A1710] text-[#FFF9F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#CA340A] flex items-center justify-center text-white shadow-xs">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-[#FFF9F5]">
                Create New Table
              </h3>
              <p className="text-xs text-[#E2C7BA]">Add table to restaurant floor layout</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2 border border-red-200">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wide">
              Table Number / Label
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <Hash size={16} />
              </span>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value.toUpperCase())}
                placeholder="e.g. A16, B7, F5, R1"
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-bold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                required
              />
            </div>
            <p className="text-[11px] text-[#52525b] mt-1">
              Supports alphanumeric labels like A1, A2, B1, F4.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wide">
              Seating Capacity
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <Users size={16} />
              </span>
              <input
                type="number"
                min={1}
                max={30}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                required
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[2, 4, 6, 8].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCapacity(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    capacity === c
                      ? "bg-[#CA340A] text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {c} Seats
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2C1710] mb-1.5 uppercase tracking-wide">
              Floor Section / Zone
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <MapPin size={16} />
              </span>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
              >
                <option value="Dine-In">Dine-In Main Floor</option>
                <option value="Rooftop">Rooftop Lounge</option>
                <option value="Patio">Patio & Garden</option>
                <option value="VIP Section">VIP Section</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Table"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

