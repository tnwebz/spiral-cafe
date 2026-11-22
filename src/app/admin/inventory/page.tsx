"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import Link from "next/link";
import {
  FileSpreadsheet,
  Plus,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Lock,
  Unlock,
  Save,
  Truck,
  Trash2,
  ClipboardCheck,
  ChevronRight,
  Package,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info,
  RotateCcw,
  BarChart3,
  History,
  Edit2,
  Archive,
  DollarSign,
  X,
} from "lucide-react";
import {
  InventoryCategory,
  InventoryIngredient,
  InventoryDay,
  InventoryDayItem,
  InventoryMovement,
  InventoryPurchaseRecord,
  getKolkataDateString,
  calculateUsedQty,
  calculateFifoAllocation,
  StockBatch,
} from "@/types/inventory";

// Dynamic Client-Side FIFO Valuation & Breakdown Helper
function computeClientFifo(
  item: InventoryDayItem,
  opening: number,
  purchased: number,
  wastage: number,
  closing: number | null | undefined,
  baseCost?: number | null
) {
  // 1. Separate opening / carried-forward batches from today's new purchase batches
  const todayPurchIds = new Set((item.purchase_entries || []).map((p) => p.id));
  const openingBatches = (item.available_batches || []).filter(
    (b) => b.batch_type === "OPENING" || !b.purchase_id || !todayPurchIds.has(b.purchase_id)
  );

  const totalOpenBatchQty = openingBatches.reduce(
    (acc, b) => acc + (b.remaining_qty ?? b.original_qty ?? 0),
    0
  );
  const totalOpenBatchVal = openingBatches.reduce(
    (acc, b) =>
      acc + (b.remaining_value ?? ((b.remaining_qty ?? b.original_qty ?? 0) * b.unit_cost)),
    0
  );

  const batchOpeningCost =
    totalOpenBatchQty > 0 ? Number((totalOpenBatchVal / totalOpenBatchQty).toFixed(2)) : null;

  const valueOpeningCost =
    item.opening_qty > 0 && item.opening_stock_value != null && item.opening_stock_value > 0
      ? Number((item.opening_stock_value / item.opening_qty).toFixed(2))
      : null;

  // Opening unit cost priority:
  // 1) Actual carried-forward / opening batches from previous day closing (FIFO truth)
  // 2) Stored opening stock value / opening qty
  // 3) Stored item.unit_cost
  // 4) Fallback to Master Catalog baseline price only if no prior cost/batch exists
  const openingUnitCost =
    batchOpeningCost ??
    valueOpeningCost ??
    item.unit_cost ??
    (baseCost != null && baseCost > 0 ? baseCost : null);

  // 2. Build Batches for FIFO calculation
  const batches: StockBatch[] = [];
  if (opening > 0) {
    if (openingBatches.length > 0 && Math.abs(totalOpenBatchQty - opening) < 0.001) {
      // Opening quantity matches carried-forward batches: preserve exact batch tiers & prices!
      for (const ob of openingBatches) {
        batches.push({
          ...ob,
          remaining_qty: ob.remaining_qty ?? ob.original_qty,
          remaining_value: Number(
            ((ob.remaining_qty ?? ob.original_qty) * ob.unit_cost).toFixed(2)
          ),
        });
      }
    } else if (openingUnitCost !== null) {
      batches.push({
        id: `batch_open_${item.id}`,
        ingredient_id: item.ingredient_id,
        batch_type: "OPENING",
        date: item.created_at?.slice(0, 10) || "2026-01-01",
        created_at: "0000-00-00T00:00:00.000Z",
        original_qty: opening,
        remaining_qty: opening,
        unit: item.unit,
        unit_cost: openingUnitCost,
        remaining_value: Number((opening * openingUnitCost).toFixed(2)),
      });
    }
  }

  // 3. Determine Purchase Batches
  if (item.purchase_entries && item.purchase_entries.length > 0) {
    const sorted = [...item.purchase_entries].sort((a, b) =>
      (a.created_at || a.date).localeCompare(b.created_at || b.date)
    );
    for (const p of sorted) {
      batches.push({
        id: `batch_purch_${p.id}`,
        ingredient_id: item.ingredient_id,
        batch_type: "PURCHASE",
        date: p.date,
        created_at: p.created_at || "1970-01-01T12:00:00.000Z",
        original_qty: p.quantity,
        remaining_qty: p.quantity,
        unit: p.unit || item.unit,
        unit_cost: p.price_per_unit,
        remaining_value: Number((p.quantity * p.price_per_unit).toFixed(2)),
      });
    }
  } else if (purchased > 0) {
    const pCost = item.latest_purchase_price ?? item.unit_cost ?? openingUnitCost ?? 0;
    batches.push({
      id: `batch_purch_syn_${item.id}`,
      ingredient_id: item.ingredient_id,
      batch_type: "PURCHASE",
      date: item.created_at?.slice(0, 10) || "2026-01-01",
      created_at: "1970-01-01T12:00:00.000Z",
      original_qty: purchased,
      remaining_qty: purchased,
      unit: item.unit,
      unit_cost: pCost,
      remaining_value: Number((purchased * pCost).toFixed(2)),
    });
  }

  const latestPurchasePrice =
    item.latest_purchase_price ??
    (item.purchase_entries && item.purchase_entries.length > 0
      ? item.purchase_entries[item.purchase_entries.length - 1].price_per_unit
      : null);

  const isCounted = closing !== null && closing !== undefined;
  const calculatedUsed = calculateUsedQty(opening, purchased, wastage, closing);

  if (isCounted && calculatedUsed !== null) {
    const res = calculateFifoAllocation(batches, wastage, calculatedUsed);
    return {
      openingUnitCost,
      latestPurchasePrice,
      calculatedUsed,
      usedCost: res.usedCost,
      usedBreakdown:
        res.usedBreakdown ||
        (res.usedCost !== null && openingUnitCost ? `${calculatedUsed} × ₹${openingUnitCost}` : undefined),
      closingStockValue: res.closingStockValue,
      closingBreakdown:
        res.closingBreakdown ||
        (closing && latestPurchasePrice ? `${closing} × ₹${latestPurchasePrice}` : undefined),
      wastageCost: wastage > 0 ? res.wastageCost : null,
      wastageBreakdown: res.wastageBreakdown,
      isCounted: true,
    };
  } else {
    let wastageCost: number | null = null;
    let wastageBreakdown: string | undefined = undefined;
    if (wastage > 0) {
      const resWastage = calculateFifoAllocation(batches, wastage, 0);
      wastageCost = resWastage.wastageCost;
      wastageBreakdown = resWastage.wastageBreakdown;
    }
    return {
      openingUnitCost,
      latestPurchasePrice,
      calculatedUsed,
      usedCost: null,
      usedBreakdown: undefined,
      closingStockValue: null,
      closingBreakdown: undefined,
      wastageCost,
      wastageBreakdown,
      isCounted: false,
    };
  }
}

export default function AdminInventoryPage() {
  const todayDate = useMemo(() => getKolkataDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [activeTab, setActiveTab] = useState<"register" | "overview" | "movements" | "master">("register");

  // Core Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [day, setDay] = useState<InventoryDay | null>(null);
  const [items, setItems] = useState<InventoryDayItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [ingredients, setIngredients] = useState<InventoryIngredient[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  // Filter States for Daily Register
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Local draft changes for daily register (maps itemId -> partial changes)
  const [draftChanges, setDraftChanges] = useState<
    Record<
      string,
      {
        opening_qty?: number;
        purchased_qty?: number;
        wastage_qty?: number;
        closing_actual_qty?: number | null;
        notes?: string;
      }
    >
  >({});

  // Modals
  const [showAddIngredientModal, setShowAddIngredientModal] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [showLogMovementModal, setShowLogMovementModal] = useState<boolean>(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);

  // Purchase Modals & States
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState<boolean>(false);
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<InventoryDayItem | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    date: todayDate,
    quantity: "1",
    price_per_unit: "",
    supplier: "",
    notes: "",
  });

  const [showPurchaseHistoryModal, setShowPurchaseHistoryModal] = useState<boolean>(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<any | null>(null);
  const [ingredientPurchases, setIngredientPurchases] = useState<InventoryPurchaseRecord[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState<boolean>(false);

  // FIFO Batches Modal (Master Catalog)
  const [showBatchesModal, setShowBatchesModal] = useState<boolean>(false);
  const [selectedIngredientForBatches, setSelectedIngredientForBatches] = useState<InventoryIngredient | null>(null);

  // Purchased Breakdown Modal (Daily Register)
  const [showPurchasedBreakdownModal, setShowPurchasedBreakdownModal] = useState<boolean>(false);
  const [selectedItemForBreakdown, setSelectedItemForBreakdown] = useState<InventoryDayItem | null>(null);

  // Category Edit Modal
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    display_order: 1,
  });

  // Ingredient Edit Modal (Moves categories, updates unit cost, min stock)
  const [showEditIngredientModal, setShowEditIngredientModal] = useState<boolean>(false);
  const [editingIngredient, setEditingIngredient] = useState<InventoryIngredient | null>(null);
  const [editIngForm, setEditIngForm] = useState({
    name: "",
    category_id: "",
    unit: "kg",
    cost_per_unit: "",
    min_stock_level: 0,
    notes: "",
  });

  // New Ingredient Form
  const [newIngForm, setNewIngForm] = useState({
    name: "",
    category_id: "",
    unit: "kg",
    cost_per_unit: "",
    min_stock_level: 0,
    notes: "",
  });

  // New Category Form
  const [newCatForm, setNewCatForm] = useState({
    name: "",
    code: "",
    display_order: 10,
  });

  // New Movement Form
  const [newMovForm, setNewMovForm] = useState({
    ingredient_id: "",
    movement_type: "PURCHASE" as "PURCHASE" | "WASTAGE",
    quantity: 1,
    unit: "kg",
    supplier: "",
    cost: "",
    reason: "",
    notes: "",
  });

  // Load Day Register & Meta
  const fetchDayData = async (targetDate: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/inventory/daily?date=${targetDate}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load inventory data");
      }
      setDay(json.day);
      setItems(json.items || []);
      setCategories(json.categories || []);
      setDraftChanges({});
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to fetch inventory data");
    } finally {
      setLoading(false);
    }
  };

  // Load Ingredients Master
  const fetchIngredientsMaster = async () => {
    try {
      const res = await fetch("/api/admin/inventory/ingredients", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setIngredients(json.ingredients || []);
      }
    } catch {}
  };

  // Load Movements
  const fetchMovements = async () => {
    try {
      const res = await fetch("/api/admin/inventory/movements");
      const json = await res.json();
      if (json.success) {
        setMovements(json.movements || []);
      }
    } catch {}
  };

  // Initial Data Fetch
  useEffect(() => {
    fetchDayData(selectedDate);
    fetchIngredientsMaster();
    fetchMovements();
  }, [selectedDate]);

  // Fix zero input bug & sanitize input changes
  const handleCellChange = (
    itemId: string,
    field: "opening_qty" | "purchased_qty" | "wastage_qty" | "closing_actual_qty" | "notes",
    rawVal: any
  ) => {
    setDraftChanges((prev) => {
      const existing = prev[itemId] || {};
      let val: any;

      if (field === "notes") {
        val = rawVal;
      } else if (rawVal === "" || rawVal === undefined) {
        // Empty string means uncounted for closing, or 0 for purchased/wastage
        val = field === "closing_actual_qty" ? null : 0;
      } else {
        let cleaned = String(rawVal);
        // If user typed e.g. "5" when input had "0", replace leading zero
        if (cleaned.length > 1 && cleaned.startsWith("0") && !cleaned.startsWith("0.")) {
          cleaned = cleaned.replace(/^0+/, "");
        }
        const num = parseFloat(cleaned);
        val = isNaN(num) ? (field === "closing_actual_qty" ? null : 0) : Math.max(0, num);
      }

      return {
        ...prev,
        [itemId]: {
          ...existing,
          [field]: val,
        },
      };
    });
  };

  // Save all pending daily register changes
  const saveRegisterChanges = async () => {
    if (!day || Object.keys(draftChanges).length === 0) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updates = Object.entries(draftChanges).map(([id, patch]) => ({
        id,
        ...patch,
      }));

      const res = await fetch("/api/admin/inventory/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: day.id,
          updates,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save daily register");
      }

      setDay(json.day);
      setItems(json.items);
      setDraftChanges({});
      setSaveSuccessMessage("Daily register saved successfully!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Finalize Day Register
  const finalizeDay = async () => {
    if (!day) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/inventory/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: day.id,
          action: "finalize",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to finalize day");
      }
      setDay(json.day);
      setShowFinalizeModal(false);
      setSaveSuccessMessage("Day finalized and locked! Closing actuals carried forward to next day.");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      fetchDayData(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to finalize day");
    } finally {
      setSaving(false);
    }
  };

  // Reopen Day Register for Corrections (Switches status back to DRAFT)
  const reopenDay = async () => {
    if (!day) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/inventory/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: day.id,
          action: "reopen",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reopen day register");
      }
      setDay(json.day);
      setSaveSuccessMessage("✅ Register reopened for corrections! Status changed back to Draft. You can now edit quantities.");
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      fetchDayData(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reopen day register");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // PURCHASES: RECORD & HISTORY
  // -------------------------------------------------------------
  const openAddPurchaseModal = (item: InventoryDayItem) => {
    setSelectedItemForPurchase(item);
    setPurchaseForm({
      date: selectedDate,
      quantity: "1",
      price_per_unit: item.unit_cost ? String(item.unit_cost) : "",
      supplier: "",
      notes: "",
    });
    setShowAddPurchaseModal(true);
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForPurchase) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      const qty = parseFloat(purchaseForm.quantity);
      const price = parseFloat(purchaseForm.price_per_unit);

      if (isNaN(qty) || qty <= 0) throw new Error("Please enter a valid purchase quantity (> 0)");
      if (isNaN(price) || price <= 0) throw new Error("Please enter a valid purchase price per unit (₹)");

      // 1. Auto-save any pending draft changes so user inputs (closing, wastage, etc.) are NOT wiped!
      if (day && Object.keys(draftChanges).length > 0) {
        const updates = Object.entries(draftChanges).map(([id, patch]) => ({
          id,
          ...patch,
        }));
        const saveRes = await fetch("/api/admin/inventory/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayId: day.id,
            updates,
          }),
        });
        const saveJson = await saveRes.json();
        if (!saveRes.ok || !saveJson.success) {
          throw new Error(saveJson.error || "Failed to save pending changes before recording purchase");
        }
      }

      // 2. Record the purchase batch
      const res = await fetch("/api/admin/inventory/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_id: selectedItemForPurchase.ingredient_id,
          date: purchaseForm.date || selectedDate,
          quantity: qty,
          unit: selectedItemForPurchase.unit,
          price_per_unit: price,
          supplier: purchaseForm.supplier || null,
          notes: purchaseForm.notes || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to record purchase");

      setShowAddPurchaseModal(false);
      setSaveSuccessMessage(`✅ Purchase recorded for ${selectedItemForPurchase.ingredient_name}! Purchased qty & FIFO valuation updated.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      await fetchDayData(selectedDate);
      fetchMovements();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to record purchase");
    } finally {
      setSaving(false);
    }
  };

  const openPurchaseHistory = async (target: { ingredient_id?: string; id?: string; ingredient_name?: string; name?: string; unit?: string; unit_cost?: number; cost_per_unit?: number }) => {
    const ingId = target.ingredient_id || target.id;
    const ingDef = ingredients.find((i) => i.id === ingId);
    const ingName = target.ingredient_name || target.name || ingDef?.name || "Ingredient";
    const baseCost = ingDef?.cost_per_unit ?? target.cost_per_unit ?? target.unit_cost;
    setSelectedItemForHistory({
      ingredient_id: ingId,
      ingredient_name: ingName,
      unit: target.unit || ingDef?.unit || "",
      cost_per_unit: baseCost,
      unit_cost: baseCost,
    });
    setShowPurchaseHistoryModal(true);
    setLoadingPurchases(true);
    try {
      const res = await fetch(`/api/admin/inventory/purchases?ingredientId=${ingId}`);
      const json = await res.json();
      if (json.success) {
        setIngredientPurchases(json.purchases || []);
      }
    } catch (err: any) {
      console.error("Error loading purchase history:", err);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const openViewBatchesModal = (ing: InventoryIngredient) => {
    setSelectedIngredientForBatches(ing);
    setShowBatchesModal(true);
  };

  const openPurchasedBreakdownModal = (item: InventoryDayItem) => {
    setSelectedItemForBreakdown(item);
    setShowPurchasedBreakdownModal(true);
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm("Are you sure you want to delete this purchase entry? This will recompute FIFO batch valuations.")) return;
    try {
      const res = await fetch(`/api/admin/inventory/purchases?id=${purchaseId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete purchase");

      setIngredientPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
      fetchDayData(selectedDate);
      setSaveSuccessMessage("Purchase entry deleted and FIFO valuations recomputed.");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to delete purchase");
    }
  };

  const handleClearPurchases = async (ingredientId?: string) => {
    if (
      !confirm(
        ingredientId
          ? "Are you sure you want to clear all purchase history for this ingredient? This will reset the stock cost to the Master Catalog baseline price."
          : "Are you sure you want to clear all purchase history records across all ingredients?"
      )
    )
      return;
    try {
      const url = ingredientId
        ? `/api/admin/inventory/purchases?ingredientId=${ingredientId}`
        : `/api/admin/inventory/purchases?clearAll=true`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to clear purchase history");

      setIngredientPurchases([]);
      fetchDayData(selectedDate);
      fetchIngredientsMaster();
      setSaveSuccessMessage("Purchase history cleared. Stock cost reset to Master Catalog baseline price.");
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to clear purchases");
    }
  };

  // -------------------------------------------------------------
  // CATEGORY & INGREDIENT MANAGEMENT (MASTER TAB)
  // -------------------------------------------------------------
  const handleOpenEditCategory = (cat: InventoryCategory) => {
    setEditingCategory(cat);
    setEditCategoryForm({
      name: cat.name,
      display_order: cat.display_order,
    });
    setShowEditCategoryModal(true);
  };

  const handleSaveCategoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const res = await fetch("/api/admin/inventory/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCategory.id,
          name: editCategoryForm.name.trim(),
          display_order: Number(editCategoryForm.display_order),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update category");

      setShowEditCategoryModal(false);
      setSaveSuccessMessage("Category updated successfully!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      fetchDayData(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update category");
    }
  };

  const handleArchiveCategory = async (cat: InventoryCategory) => {
    const activeIngs = (ingredients.length > 0 ? ingredients : items).filter(
      (i: any) => (i.category_id === cat.id || i.category === cat.id) && (i.is_active ?? true)
    );

    if (activeIngs.length > 0) {
      alert(
        `Cannot archive category "${cat.name}": ${activeIngs.length} active ingredient(s) are assigned to it. Please edit those ingredients and move them to another category first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to archive category "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/inventory/categories?id=${cat.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to archive category");

      setSaveSuccessMessage(`Category "${cat.name}" archived.`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      fetchDayData(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to archive category");
    }
  };

  const handleOpenEditIngredient = (ing: any) => {
    setEditingIngredient(ing);
    setEditIngForm({
      name: ing.name,
      category_id: ing.category_id,
      unit: ing.unit,
      cost_per_unit: ing.cost_per_unit !== null && ing.cost_per_unit !== undefined ? String(ing.cost_per_unit) : "",
      min_stock_level: ing.min_stock_level || 0,
      notes: ing.notes || "",
    });
    setShowEditIngredientModal(true);
  };

  const handleSaveIngredientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;
    try {
      const parsedCost =
        editIngForm.cost_per_unit !== "" && !isNaN(Number(editIngForm.cost_per_unit))
          ? parseFloat(editIngForm.cost_per_unit)
          : null;

      const res = await fetch("/api/admin/inventory/ingredients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingIngredient.id,
          name: editIngForm.name.trim(),
          category_id: editIngForm.category_id,
          unit: editIngForm.unit.trim(),
          cost_per_unit: parsedCost,
          min_stock_level: Number(editIngForm.min_stock_level) || 0,
          notes: editIngForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update ingredient");

      if (json.ingredient) {
        setIngredients((prev) =>
          prev.map((ing) => (ing.id === json.ingredient.id ? json.ingredient : ing))
        );
        setItems((prev) =>
          prev.map((it) =>
            it.ingredient_id === json.ingredient.id
              ? {
                  ...it,
                  unit: json.ingredient.unit,
                  ingredient_name: json.ingredient.name,
                  category_id: json.ingredient.category_id,
                  unit_cost: json.ingredient.cost_per_unit ?? it.unit_cost,
                }
              : it
          )
        );
      }

      setShowEditIngredientModal(false);
      setSaveSuccessMessage("Ingredient updated successfully!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      await fetchDayData(selectedDate);
      await fetchIngredientsMaster();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update ingredient");
    }
  };

  // Handle Add Ingredient Submit
  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedCost =
        newIngForm.cost_per_unit !== "" && !isNaN(Number(newIngForm.cost_per_unit))
          ? parseFloat(newIngForm.cost_per_unit)
          : null;

      const res = await fetch("/api/admin/inventory/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newIngForm,
          cost_per_unit: parsedCost,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to add ingredient");

      if (json.ingredient) {
        setIngredients((prev) => [...prev, json.ingredient]);
      }

      setShowAddIngredientModal(false);
      setNewIngForm({ name: "", category_id: "", unit: "kg", cost_per_unit: "", min_stock_level: 0, notes: "" });
      setSaveSuccessMessage("✅ Ingredient added successfully!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      await fetchDayData(selectedDate);
      await fetchIngredientsMaster();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add ingredient");
    }
  };

  // Handle Add Category Submit
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCatForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to add category");

      setShowAddCategoryModal(false);
      setNewCatForm({ name: "", code: "", display_order: 10 });
      setSaveSuccessMessage("✅ Category created successfully!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      fetchDayData(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add category");
    }
  };

  // Handle Log Movement Submit
  const handleLogMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newMovForm,
          date: selectedDate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to log movement");

      setShowLogMovementModal(false);
      setNewMovForm({
        ingredient_id: "",
        movement_type: "PURCHASE",
        quantity: 1,
        unit: "kg",
        supplier: "",
        cost: "",
        reason: "",
        notes: "",
      });
      setSaveSuccessMessage("✅ Stock movement recorded successfully!");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      fetchDayData(selectedDate);
      fetchMovements();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to log movement");
    }
  };

  // Filtered Items for Daily Register Table
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCat =
        selectedCategoryFilter === "ALL" || item.category_id === selectedCategoryFilter;
      const matchesSearch =
        searchQuery === "" ||
        item.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.ingredient_number.toString().includes(searchQuery);
      return matchesCat && matchesSearch;
    });
  }, [items, selectedCategoryFilter, searchQuery]);

  // Group filtered items by category
  const groupedItemsByCategory = useMemo(() => {
    const map = new Map<string, { category: InventoryCategory; items: InventoryDayItem[] }>();
    categories.forEach((cat) => {
      map.set(cat.id, { category: cat, items: [] });
    });

    filteredItems.forEach((item) => {
      if (map.has(item.category_id)) {
        map.get(item.category_id)!.items.push(item);
      } else {
        const fallbackCat: InventoryCategory = {
          id: item.category_id,
          code: "?",
          name: item.category_name,
          display_order: 99,
          is_active: true,
        };
        map.set(item.category_id, { category: fallbackCat, items: [item] });
      }
    });

    return Array.from(map.values()).filter((g) => g.items.length > 0);
  }, [categories, filteredItems]);

  // Calculations for stats & valuation
  const totalCounted = useMemo(() => items.filter((i) => i.is_counted).length, [items]);
  const totalIngredientsCount = items.length;
  const isFinalized = day?.status === "FINALIZED";
  const hasUnsavedChanges = Object.keys(draftChanges).length > 0;

  // Valuation computations
  const { totalValuedStock, missingCostCount } = useMemo(() => {
    let sum = 0;
    let missing = 0;
    for (const item of items) {
      const draft = draftChanges[item.id] || {};
      const closing = draft.closing_actual_qty !== undefined ? draft.closing_actual_qty : item.closing_actual_qty;
      if (closing !== null && closing !== undefined) {
        if (draft.closing_actual_qty === undefined && item.closing_stock_value !== null && item.closing_stock_value !== undefined) {
          sum += item.closing_stock_value;
        } else if (item.unit_cost !== null && item.unit_cost !== undefined) {
          sum += closing * item.unit_cost;
        } else {
          missing++;
        }
      }
    }
    return { totalValuedStock: sum, missingCostCount: missing };
  }, [items, draftChanges]);

  return (
    <AdminLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TOP BENTO HEADER: TITLE, DATE, STATS (Matches Mockup 1) */}
        <div className="bg-[#2C1710] text-[#FFF9F5] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#CA340A]/20 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#CA340A]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="p-2.5 rounded-xl bg-[#CA340A]/30 text-[#FFF9F5] border border-[#CA340A]/40">
                  <FileSpreadsheet size={24} />
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Inventory Management
                  </h1>
                  <p className="text-xs sm:text-sm text-[#E2C7BA] font-medium">
                    Manual Daily Register & Physical Stock Counting
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#E2C7BA]/80 font-mono mt-1">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/admin/inventory/analytics"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CA340A] hover:bg-[#b02d08] text-white text-xs font-bold transition shadow-md"
              >
                <BarChart3 size={16} />
                <span>Inventory Analytics & Reports</span>
              </Link>

              <button
                onClick={() => setShowAddIngredientModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF9F5] border border-white/15 text-xs font-bold transition cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Ingredient</span>
              </button>

              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF9F5] border border-white/15 text-xs font-bold transition cursor-pointer"
              >
                <Plus size={16} />
                <span>New Category</span>
              </button>

              <a
                href={`/api/admin/inventory/export?date=${selectedDate}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CA340A] hover:bg-[#b02d08] text-white text-xs font-bold transition shadow-md"
              >
                <Download size={16} />
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          {/* 4 BENTO METRIC STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <span className="text-[11px] uppercase tracking-wider text-[#E2C7BA] font-semibold">
                Ingredients
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#FFF9F5] mt-1">
                {totalIngredientsCount || 69}
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <span className="text-[11px] uppercase tracking-wider text-[#E2C7BA] font-semibold">
                Categories
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#FFF9F5] mt-1">
                {categories.length || 8}
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <span className="text-[11px] uppercase tracking-wider text-[#E2C7BA] font-semibold">
                Counted Today
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">
                {totalCounted}
                <span className="text-base font-normal text-white/50">/{totalIngredientsCount}</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <span className="text-[11px] uppercase tracking-wider text-[#E2C7BA] font-semibold">
                Est. Stock Value (₹)
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#FFF9F5] font-mono mt-1">
                ₹{totalValuedStock.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-[#E2C7BA] mt-0.5">
                {missingCostCount > 0 ? `(${missingCostCount} unpriced items excluded)` : "Based on weighted avg"}
              </div>
            </div>
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {saveSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <span className="text-sm font-semibold">{saveSuccessMessage}</span>
            </div>
            <button
              onClick={() => setSaveSuccessMessage(null)}
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 text-red-900 border border-red-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0" />
              <span className="text-sm font-semibold">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-red-700 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* INCOMPLETE VALUATION WARNING BANNER */}
        {missingCostCount > 0 && activeTab === "register" && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Incomplete Stock Valuation: </span>
              {missingCostCount} counted item(s) do not have purchase prices recorded. Their closing stock value cannot be calculated and is excluded from the total until cost is set.
            </div>
          </div>
        )}

        {/* CONTROLS: TABS & DATE SELECTOR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-3 rounded-2xl border border-[#CA340A]/10 shadow-xs">
          {/* Main Tab Nav */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "register"
                  ? "bg-[#2C1710] text-[#FFF9F5] shadow-sm"
                  : "text-[#52525b] hover:bg-[#2C1710]/5"
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>Daily Register</span>
            </button>

            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "overview"
                  ? "bg-[#2C1710] text-[#FFF9F5] shadow-sm"
                  : "text-[#52525b] hover:bg-[#2C1710]/5"
              }`}
            >
              <Layers size={15} />
              <span>Category Progress</span>
            </button>

            <button
              onClick={() => setActiveTab("movements")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "movements"
                  ? "bg-[#2C1710] text-[#FFF9F5] shadow-sm"
                  : "text-[#52525b] hover:bg-[#2C1710]/5"
              }`}
            >
              <Truck size={15} />
              <span>Purchases & Wastage</span>
            </button>

            <button
              onClick={() => setActiveTab("master")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "master"
                  ? "bg-[#2C1710] text-[#FFF9F5] shadow-sm"
                  : "text-[#52525b] hover:bg-[#2C1710]/5"
              }`}
            >
              <Package size={15} />
              <span>Master Catalog</span>
            </button>

            <Link
              href="/admin/inventory/analytics"
              className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap text-[#CA340A] hover:bg-[#CA340A]/10 border border-[#CA340A]/20"
            >
              <BarChart3 size={15} />
              <span>Analytics & Trends</span>
            </Link>
          </div>

          {/* Date Picker & Refresh */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <div className="flex items-center gap-1.5 bg-[#FFF9F5] px-3 py-1.5 rounded-xl border border-[#CA340A]/15 text-xs text-[#2C1710]">
              <Calendar size={14} className="text-[#CA340A]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-[#2C1710] focus:outline-hidden"
              />
            </div>

            <button
              onClick={() => fetchDayData(selectedDate)}
              className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition cursor-pointer"
              title="Refresh Register"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DAILY INVENTORY REGISTER (Notebook Style with Stock Value Col)     */}
        {/* ========================================================================= */}
        {activeTab === "register" && (
          <div className="space-y-6">
            {/* REGISTER CONTROLS: CATEGORY PILLS & SEARCH */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  onClick={() => setSelectedCategoryFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    selectedCategoryFilter === "ALL"
                      ? "bg-[#CA340A] text-white shadow-xs"
                      : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryFilter(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                      selectedCategoryFilter === c.id
                        ? "bg-[#CA340A] text-white shadow-xs"
                        : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {c.code}. {c.name}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64 shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search ingredient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-[#CA340A]"
                />
              </div>
            </div>

            {/* Notebook Formula Note */}
            <div className="bg-[#FFF9F5] border-l-4 border-[#CA340A] p-4 rounded-r-2xl text-xs text-[#2C1710] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-[#CA340A] shrink-0" />
                <span>
                  <strong>Manual Register:</strong> Enter physical counts into rows.{" "}
                  <code className="bg-white px-2 py-0.5 rounded border border-zinc-200 text-[#CA340A] font-bold">
                    Used = Opening + Purchased − Wastage − Closing Actual
                  </code>
                </span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Next day opening balances automatically carry forward from previous finalized closing actuals.
              </div>
            </div>

            {/* REGISTER TABLES GROUPED BY CATEGORY */}
            {loading ? (
              <div className="py-20 text-center text-zinc-400 font-medium">
                Loading daily inventory register...
              </div>
            ) : groupedItemsByCategory.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-zinc-300 text-zinc-500">
                <p className="text-sm font-semibold">No ingredients match the selected filter.</p>
              </div>
            ) : (
              groupedItemsByCategory.map((group) => {
                // Category subtotal of closing stock value
                let catValuationSum = 0;
                for (const it of group.items) {
                  const draft = draftChanges[it.id] || {};
                  const cl = draft.closing_actual_qty !== undefined ? draft.closing_actual_qty : it.closing_actual_qty;
                  if (cl !== null && cl !== undefined) {
                    if (draft.closing_actual_qty === undefined && it.closing_stock_value !== null && it.closing_stock_value !== undefined) {
                      catValuationSum += it.closing_stock_value;
                    } else if (it.unit_cost) {
                      catValuationSum += cl * it.unit_cost;
                    }
                  }
                }

                return (
                  <div
                    key={group.category.id}
                    className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden"
                  >
                    {/* Category Header */}
                    <div className="px-5 py-3.5 bg-zinc-50/90 border-b border-zinc-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-[#FAF9F5] border border-zinc-200 text-[#2C1710] flex items-center justify-center font-black text-xs">
                          {group.category.code}
                        </span>
                        <div>
                          <h2 className="text-sm font-extrabold text-zinc-950">
                            {group.category.name}
                          </h2>
                          <p className="text-[11px] text-zinc-400">
                            Enter physical counts like the handwritten notebook
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-zinc-700 bg-white px-2.5 py-1 rounded-lg border border-zinc-200">
                          Cat Value: ₹{catValuationSum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">
                          {group.items.length} items
                        </span>
                      </div>
                    </div>

                    {/* Table: Ingredient | Opening | Purchased | Wastage | Closing Actual | Stock Value (₹) | Used | Status */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-600 font-bold tracking-wide uppercase text-[10px]">
                            <th className="py-3 px-4 w-12 text-center">#</th>
                            <th className="py-3 px-4 min-w-[220px]">Ingredient</th>
                            <th className="py-3 px-3 w-24 text-center">Opening</th>
                            <th className="py-3 px-3 w-32 text-center">Purchased</th>
                            <th className="py-3 px-3 w-24 text-center">Wastage</th>
                            <th className="py-3 px-3 w-28 text-center">Closing Actual</th>
                            <th className="py-3 px-3 w-32 text-right">Stock Value (₹)</th>
                            <th className="py-3 px-4 w-24 text-center">Used</th>
                            <th className="py-3 px-4 w-20 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {group.items.map((item) => {
                            const draft = draftChanges[item.id] || {};
                            const opening = draft.opening_qty !== undefined ? draft.opening_qty : item.opening_qty;
                            const purchased =
                              draft.purchased_qty !== undefined ? draft.purchased_qty : item.purchased_qty;
                            const wastage = draft.wastage_qty !== undefined ? draft.wastage_qty : item.wastage_qty;
                            const closing =
                              draft.closing_actual_qty !== undefined
                                ? draft.closing_actual_qty
                                : item.closing_actual_qty;

                            const ingDef = ingredients.find((ing) => ing.id === item.ingredient_id);
                            const clientFifo = computeClientFifo(item, opening, purchased, wastage, closing, ingDef?.cost_per_unit);

                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-zinc-50/60 transition ${
                                  clientFifo.isCounted ? "bg-emerald-50/20" : ""
                                }`}
                              >
                                {/* Item Number */}
                                <td className="py-3 px-4 text-center text-zinc-400 font-mono text-[11px]">
                                  {item.ingredient_number}
                                </td>

                                {/* Ingredient Name & Unit Badge ONLY (Clean column) */}
                                <td className="py-3 px-4">
                                  <div className="font-bold text-zinc-950 text-xs sm:text-sm">
                                    {item.ingredient_name}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono text-[10px]">
                                      {item.unit}
                                    </span>
                                  </div>
                                </td>

                                {/* Opening (Carry-forward balance + Initial Cost Rate in brackets) */}
                                <td className="py-3 px-3 text-center">
                                  {isFinalized ? (
                                    <span className="font-bold text-zinc-900">{opening}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={opening === 0 ? "0" : opening}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        handleCellChange(item.id, "opening_qty", e.target.value)
                                      }
                                      className="w-18 text-center py-1.5 px-2 bg-zinc-50 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                                    />
                                  )}
                                  {clientFifo.openingUnitCost !== null && opening > 0 && (
                                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5 font-medium">
                                      (₹{clientFifo.openingUnitCost}/{item.unit === "pcs" ? "pc" : item.unit || "pc"})
                                    </div>
                                  )}
                                </td>

                                {/* Purchased (No input box! Clean display + '+' button + price in brackets) */}
                                <td className="py-3 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`font-bold text-xs sm:text-sm ${purchased > 0 ? "text-zinc-950 font-mono" : "text-zinc-400"}`}>
                                      {purchased}
                                    </span>
                                    {item.purchase_entries && item.purchase_entries.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => openPurchasedBreakdownModal(item)}
                                        className="px-1.5 py-0.5 rounded bg-orange-100 text-[#CA340A] text-[10px] font-bold hover:bg-orange-200 transition cursor-pointer"
                                        title="View today's purchase batches"
                                      >
                                        {item.purchase_entries.length}
                                      </button>
                                    )}
                                    {!isFinalized && (
                                      <button
                                        type="button"
                                        onClick={() => openAddPurchaseModal(item)}
                                        className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#CA340A] transition border border-orange-200/60 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                                        title="Add purchase / delivery"
                                      >
                                        <Plus size={13} strokeWidth={2.5} />
                                      </button>
                                    )}
                                  </div>
                                  {purchased > 0 && clientFifo.latestPurchasePrice !== null && (
                                    <div className="text-[10px] text-amber-700 font-mono mt-0.5 font-medium">
                                      (₹{clientFifo.latestPurchasePrice} new price)
                                    </div>
                                  )}
                                </td>

                                {/* Wastage Input & Cost Breakdown */}
                                <td className="py-3 px-3 text-center">
                                  {isFinalized ? (
                                    <span className="font-semibold text-zinc-800">{wastage}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={wastage === 0 ? "0" : wastage}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        handleCellChange(item.id, "wastage_qty", e.target.value)
                                      }
                                      className="w-16 text-center py-1.5 px-2 bg-white rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                                    />
                                  )}
                                  {wastage > 0 && (
                                    <div className="text-[10px] text-rose-600 font-mono mt-0.5">
                                      {clientFifo.wastageCost !== null && `₹${clientFifo.wastageCost}`}
                                      {clientFifo.wastageBreakdown && (
                                        <span className="text-zinc-500 block text-[9px]">({clientFifo.wastageBreakdown})</span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Closing Actual (Count) Input */}
                                <td className="py-3 px-3 text-center">
                                  {isFinalized ? (
                                    <span className="font-bold text-zinc-900">
                                      {closing !== null ? closing : "—"}
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      placeholder="Count"
                                      value={closing === null || closing === undefined ? "" : closing}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        handleCellChange(item.id, "closing_actual_qty", e.target.value)
                                      }
                                      className={`w-20 text-center py-1.5 px-2 rounded-lg border text-xs font-bold focus:outline-hidden ${
                                        clientFifo.isCounted
                                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 focus:border-emerald-500"
                                          : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-[#CA340A]"
                                      }`}
                                    />
                                  )}
                                </td>

                                {/* Stock Value (₹) Column (FIFO Allocation with Bracket Breakdown) */}
                                <td className="py-3 px-3 text-right">
                                  {clientFifo.isCounted ? (
                                    clientFifo.closingStockValue !== null ? (
                                      <div>
                                        <span className="font-mono font-bold text-zinc-950 text-xs sm:text-sm">
                                          ₹{clientFifo.closingStockValue.toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                        {clientFifo.closingBreakdown && (
                                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                            ({clientFifo.closingBreakdown})
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-zinc-400 font-mono text-xs">₹0.00</span>
                                    )
                                  ) : (
                                    <span className="text-zinc-300 font-mono">—</span>
                                  )}
                                </td>

                                {/* Used (Calculated Output + Cost & FIFO Bracket Breakdown) */}
                                <td className="py-3 px-4 text-center">
                                  {clientFifo.calculatedUsed !== null ? (
                                    <div>
                                      <span
                                        className={`font-black text-sm ${
                                          clientFifo.calculatedUsed < 0
                                            ? "text-red-600"
                                            : "text-[#CA340A]"
                                        }`}
                                      >
                                        {clientFifo.calculatedUsed}
                                      </span>
                                      {clientFifo.calculatedUsed > 0 && (
                                        <div className="text-[10px] font-mono mt-0.5">
                                          <span className="text-zinc-700 font-semibold">
                                            ₹{(clientFifo.usedCost ?? 0).toFixed(0)}
                                          </span>
                                          {clientFifo.usedBreakdown && (
                                            <div className="text-zinc-400 text-[9px] whitespace-nowrap">
                                              ({clientFifo.usedBreakdown})
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-300 font-bold">—</span>
                                  )}
                                </td>

                                {/* Counted Status */}
                                <td className="py-3 px-4 text-center">
                                  {clientFifo.isCounted ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                      <CheckCircle2 size={13} />
                                      Done
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-medium text-amber-600">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}

            {/* STICKY SAVE & FINALIZE BAR */}
            <div className="sticky bottom-4 z-40 bg-[#2C1710] text-[#FFF9F5] p-4 rounded-2xl shadow-2xl border border-[#CA340A]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-[#CA340A] text-white">
                  <FileSpreadsheet size={18} />
                </span>
                <div>
                  <div className="text-xs font-bold">
                    {hasUnsavedChanges
                      ? `${Object.keys(draftChanges).length} unsaved change(s)`
                      : "All daily entries saved to database"}
                  </div>
                  <div className="text-[11px] text-[#E2C7BA]">
                    {totalCounted} of {totalIngredientsCount} items counted
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {hasUnsavedChanges && (
                  <button
                    onClick={saveRegisterChanges}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#CA340A] hover:bg-[#b02d08] text-white text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={15} />
                    <span>{saving ? "Saving..." : "Save Register Changes"}</span>
                  </button>
                )}

                {!isFinalized && (
                  <button
                    onClick={() => setShowFinalizeModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF9F5] border border-white/20 text-xs font-bold transition cursor-pointer"
                  >
                    <Lock size={15} />
                    <span>Finalize Day Register</span>
                  </button>
                )}

                {isFinalized && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                      <CheckCircle2 size={15} />
                      <span>Finalized by {day?.finalized_by || "Manager"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={reopenDay}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <RotateCcw size={15} className={saving ? "animate-spin" : ""} />
                      <span>{saving ? "Reopening..." : "Reopen for Corrections"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CATEGORY OVERVIEW & PROGRESS                                      */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-xs">
              <h2 className="text-base font-bold text-zinc-900 mb-1">
                Today&apos;s Category Progress
              </h2>
              <p className="text-xs text-zinc-500 mb-6">
                Progress tracking for physical daily counting across all sections
              </p>

              <div className="divide-y divide-zinc-100">
                {categories.map((cat) => {
                  const catItems = items.filter((i) => i.category_id === cat.id);
                  const countedCount = catItems.filter((i) => i.is_counted).length;
                  const total = catItems.length;
                  const isDone = total > 0 && countedCount === total;
                  const pct = total > 0 ? Math.round((countedCount / total) * 100) : 0;

                  return (
                    <div key={cat.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-[#FAF9F5] border border-zinc-200 text-[#2C1710] flex items-center justify-center font-black text-xs">
                          {cat.code}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-zinc-950">{cat.name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {countedCount} of {total} ingredients counted ({pct}%)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="hidden sm:block w-36 bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isDone ? "bg-emerald-500" : "bg-[#CA340A]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                            isDone
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isDone ? "Done" : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PURCHASES & WASTAGE LOG                                           */}
        {/* ========================================================================= */}
        {activeTab === "movements" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Purchases & Wastage Logs</h2>
                <p className="text-xs text-zinc-500">
                  Audited stock entry and waste logging for vendor deliveries and kitchen scrap
                </p>
              </div>

              <button
                onClick={() => setShowLogMovementModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-xs cursor-pointer"
              >
                <Plus size={16} />
                <span>Log Movement</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Ingredient</th>
                      <th className="py-3 px-4 text-center">Quantity</th>
                      <th className="py-3 px-4">Supplier / Reason</th>
                      <th className="py-3 px-4 text-right">Cost (₹)</th>
                      <th className="py-3 px-4">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-zinc-400">
                          No stock movements recorded yet. Click &quot;Log Movement&quot; to add a purchase or wastage.
                        </td>
                      </tr>
                    ) : (
                      movements.map((mov) => {
                        const ing = items.find((i) => i.ingredient_id === mov.ingredient_id);
                        return (
                          <tr key={mov.id} className="hover:bg-zinc-50">
                            <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">{mov.date}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  mov.movement_type === "PURCHASE"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {mov.movement_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-zinc-900">
                              {mov.ingredient_name || ing?.ingredient_name || mov.ingredient_id}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-zinc-800">
                              {mov.quantity} {mov.unit}
                            </td>
                            <td className="py-3 px-4 text-zinc-600">{mov.supplier || mov.reason || "—"}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-zinc-800">
                              {mov.cost ? `₹${mov.cost}` : "—"}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-[11px]">{mov.recorded_by}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MASTER CATALOG (CATEGORIES & INGREDIENTS MANAGEMENT)               */}
        {/* ========================================================================= */}
        {activeTab === "master" && (
          <div className="space-y-8">
            {/* SECTION 1: CATEGORY MANAGEMENT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">Category Management</h2>
                  <p className="text-xs text-zinc-500">
                    Edit category names, adjust display order, create new categories, or archive unused sections.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddCategoryModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C1710] text-[#FFF9F5] text-xs font-bold hover:bg-black transition shadow-xs cursor-pointer"
                >
                  <Plus size={15} />
                  <span>+ New Category</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((cat) => {
                  const activeIngs = (ingredients.length > 0 ? ingredients : items).filter(
                    (i: any) => (i.category_id === cat.id || i.category === cat.id) && (i.is_active ?? true)
                  );

                  return (
                    <div
                      key={cat.id}
                      className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-8 h-8 rounded-xl bg-[#FAF9F5] border border-zinc-200 text-[#2C1710] font-black text-xs flex items-center justify-center">
                            {cat.code}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                            Order #{cat.display_order}
                          </span>
                        </div>
                        <h3 className="font-bold text-zinc-950 text-sm">{cat.name}</h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          {activeIngs.length} active ingredient(s)
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCategory(cat)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveCategory(cat)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Archive size={12} />
                          <span>Archive</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: INGREDIENTS MASTER */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">Ingredients Catalog</h2>
                  <p className="text-xs text-zinc-500">
                    Master list of standard ingredients. Click &quot;Edit&quot; to change category, update baseline purchase prices, or modify thresholds.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddIngredientModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-xs cursor-pointer"
                >
                  <Plus size={16} />
                  <span>+ Add Ingredient</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Ingredient Name</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-center">Counting Unit</th>
                        <th className="py-3 px-4 text-center">Base Price / Unit</th>
                        <th className="py-3 px-4 text-center">Current Stock</th>
                        <th className="py-3 px-4 text-right">FIFO Stock Value</th>
                        <th className="py-3 px-4 text-center">Min Stock Alert</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(ingredients.length > 0 ? ingredients : items.map((i): InventoryIngredient => ({
                        id: i.ingredient_id,
                        item_number: i.ingredient_number,
                        name: i.ingredient_name,
                        category_id: i.category_id,
                        unit: i.unit,
                        cost_per_unit: i.unit_cost !== null && i.unit_cost !== undefined ? i.unit_cost : null,
                        min_stock_level: 0,
                        display_order: i.ingredient_number,
                        is_active: true,
                        notes: i.notes || null,
                        current_stock: i.closing_actual_qty ?? i.opening_qty,
                        stock_value: i.closing_stock_value ?? 0,
                        batches: i.closing_batches || i.available_batches || [],
                      }))).map((ing) => {
                        const cat = categories.find((c) => c.id === ing.category_id);
                        const dayItem = items.find((i) => i.ingredient_id === ing.id);
                        const currentStock = dayItem
                          ? (dayItem.closing_actual_qty !== null && dayItem.closing_actual_qty !== undefined
                              ? dayItem.closing_actual_qty
                              : Math.max(0, (dayItem.opening_qty || 0) + (dayItem.purchased_qty || 0) - (dayItem.wastage_qty || 0)))
                          : (ing.current_stock ?? 0);
                        const stockVal = dayItem
                          ? (dayItem.closing_stock_value !== null && dayItem.closing_stock_value !== undefined
                              ? dayItem.closing_stock_value
                              : (dayItem.unit_cost ? Number((currentStock * dayItem.unit_cost).toFixed(2)) : (ing.cost_per_unit ? Number((currentStock * ing.cost_per_unit).toFixed(2)) : 0)))
                          : (ing.stock_value ?? 0);
                        const batches = dayItem?.closing_batches || dayItem?.available_batches || ing.batches || [];

                        return (
                          <tr key={ing.id} className="hover:bg-zinc-50">
                            <td className="py-3 px-4 text-center font-mono text-zinc-400">
                              {ing.item_number}
                            </td>
                            <td className="py-3 px-4 font-bold text-zinc-900">{ing.name}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[11px] font-medium">
                                {cat ? `${cat.code}. ${cat.name}` : ing.category_id}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-zinc-700">{ing.unit}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-zinc-800">
                              {ing.cost_per_unit !== null && ing.cost_per_unit !== undefined && !isNaN(Number(ing.cost_per_unit))
                                ? `₹${Number(ing.cost_per_unit).toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-zinc-800">
                              {currentStock} {ing.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900">
                              {stockVal > 0
                                ? `₹${Number(stockVal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₹0.00"}
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-zinc-700">
                              {ing.min_stock_level || 0} {ing.unit}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditIngredient(ing)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openViewBatchesModal({ ...ing, current_stock: currentStock, stock_value: stockVal, batches })}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                  title="View active FIFO stock batches"
                                >
                                  Batches ({batches.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPurchaseHistory({ ingredient_id: ing.id, ingredient_name: ing.name, unit: ing.unit })}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition cursor-pointer"
                                  title="View purchase history"
                                >
                                  Price History
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD PURCHASE / DELIVERY                                            */}
        {/* ========================================================================= */}
        {showAddPurchaseModal && selectedItemForPurchase && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-orange-50 text-[#CA340A]">
                    <Truck size={18} />
                  </span>
                  <h3 className="text-lg font-bold text-zinc-900">Record Stock Purchase</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseModal(false)}
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-zinc-500 mb-5">
                Log vendor deliveries and actual invoice costs for{" "}
                <strong className="text-zinc-900">{selectedItemForPurchase.ingredient_name}</strong>.
                Updates today&apos;s Purchased quantity and moving weighted average price.
              </p>

              <form onSubmit={handleRecordPurchase} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Purchase Date</label>
                    <input
                      type="date"
                      required
                      value={purchaseForm.date}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Quantity ({selectedItemForPurchase.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      placeholder="e.g. 5"
                      value={purchaseForm.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Price / {selectedItemForPurchase.unit} (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="e.g. 260"
                      value={purchaseForm.price_per_unit}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, price_per_unit: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Total Cost (₹)</label>
                    <div className="w-full px-3 py-2 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-black font-mono text-[#CA340A]">
                      ₹
                      {(
                        (parseFloat(purchaseForm.quantity) || 0) *
                        (parseFloat(purchaseForm.price_per_unit) || 0)
                      ).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Supplier / Vendor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Local Meat Market, Metro Cash & Carry"
                    value={purchaseForm.supplier}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Notes / Invoice No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Inv #8491, fresh delivery"
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddPurchaseModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? "Saving..." : "Record Purchase"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: PURCHASE HISTORY                                                   */}
        {/* ========================================================================= */}
        {showPurchaseHistoryModal && selectedItemForHistory && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-orange-50 text-[#CA340A]">
                    <History size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">Purchase History</h3>
                    <p className="text-xs text-zinc-500">
                      {selectedItemForHistory.ingredient_name} ({selectedItemForHistory.unit})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPurchaseHistoryModal(false)}
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 my-3 bg-[#FAF9F5] rounded-xl border border-zinc-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Master Catalog Base Price</span>
                  <span className="text-sm font-black font-mono text-[#2C1710]">
                    {selectedItemForHistory.cost_per_unit || selectedItemForHistory.unit_cost
                      ? `₹${Number(selectedItemForHistory.cost_per_unit || selectedItemForHistory.unit_cost).toFixed(2)}/${selectedItemForHistory.unit}`
                      : "Not Set"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ingredientPurchases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearPurchases(selectedItemForHistory.ingredient_id)}
                      className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-xs font-bold transition cursor-pointer"
                      title="Clear all past purchase records for this ingredient"
                    >
                      Clear History
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurchaseHistoryModal(false);
                      openAddPurchaseModal(selectedItemForHistory);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus size={13} />
                    <span>+ Add Purchase</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingPurchases ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    Loading purchases...
                  </div>
                ) : ingredientPurchases.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    No purchase history found for this ingredient. Click &quot;+ Add Purchase&quot; to log invoices.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-center">Price / Unit</th>
                        <th className="py-2.5 px-3 text-right">Total (₹)</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {ingredientPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50 transition">
                          <td className="py-2.5 px-3 font-mono text-zinc-500 text-[11px]">{p.date}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-800">
                            {p.quantity} {p.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-zinc-600">
                            ₹{p.price_per_unit.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                            ₹{p.total_cost.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 text-[11px]">{p.supplier || "—"}</td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePurchase(p.id)}
                              className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Delete purchase"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EDIT CATEGORY                                                      */}
        {/* ========================================================================= */}
        {showEditCategoryModal && editingCategory && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-1">
                Edit Category ({editingCategory.code})
              </h3>
              <p className="text-xs text-zinc-500 mb-5">
                Update category display name or ordering position.
              </p>

              <form onSubmit={handleSaveCategoryEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    value={editCategoryForm.name}
                    onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editCategoryForm.display_order}
                    onChange={(e) =>
                      setEditCategoryForm({ ...editCategoryForm, display_order: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowEditCategoryModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#2C1710] text-[#FFF9F5] text-xs font-bold hover:bg-black transition shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EDIT INGREDIENT (MOVE CATEGORY, BASELINE PRICE)                    */}
        {/* ========================================================================= */}
        {showEditIngredientModal && editingIngredient && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-1">Edit Ingredient</h3>
              <p className="text-xs text-zinc-500 mb-5">
                Move between categories, set baseline unit price, or adjust min stock alert.
              </p>

              <form onSubmit={handleSaveIngredientEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Ingredient Name</label>
                  <input
                    type="text"
                    required
                    value={editIngForm.name}
                    onChange={(e) => setEditIngForm({ ...editIngForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Category</label>
                    <select
                      required
                      value={editIngForm.category_id}
                      onChange={(e) => setEditIngForm({ ...editIngForm, category_id: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}. {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Counting Unit</label>
                    <select
                      value={editIngForm.unit}
                      onChange={(e) => setEditIngForm({ ...editIngForm, unit: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    >
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="pcs">pcs</option>
                      <option value="g">g</option>
                      <option value="pack">pack</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Baseline Price / Unit (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 260"
                      value={editIngForm.cost_per_unit}
                      onChange={(e) => setEditIngForm({ ...editIngForm, cost_per_unit: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Min Stock Alert ({editIngForm.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editIngForm.min_stock_level}
                      onChange={(e) =>
                        setEditIngForm({ ...editIngForm, min_stock_level: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={editIngForm.notes}
                    onChange={(e) => setEditIngForm({ ...editIngForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowEditIngredientModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD INGREDIENT                                                    */}
        {/* ========================================================================= */}
        {showAddIngredientModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-1">Add New Ingredient</h3>
              <p className="text-xs text-zinc-500 mb-5">
                Add a new ingredient to the daily register and master catalog.
              </p>

              <form onSubmit={handleAddIngredient} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Ingredient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sriracha Mayo"
                    value={newIngForm.name}
                    onChange={(e) => setNewIngForm({ ...newIngForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Category</label>
                    <select
                      required
                      value={newIngForm.category_id}
                      onChange={(e) => setNewIngForm({ ...newIngForm, category_id: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}. {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Counting Unit</label>
                    <select
                      value={newIngForm.unit}
                      onChange={(e) => setNewIngForm({ ...newIngForm, unit: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    >
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="pcs">pcs</option>
                      <option value="g">g</option>
                      <option value="pack">pack</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Purchase Cost / Unit (₹ Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 260"
                      value={newIngForm.cost_per_unit}
                      onChange={(e) => setNewIngForm({ ...newIngForm, cost_per_unit: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Min Stock Alert
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newIngForm.min_stock_level}
                      onChange={(e) =>
                        setNewIngForm({ ...newIngForm, min_stock_level: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddIngredientModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-md cursor-pointer"
                  >
                    Save Ingredient
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD CATEGORY                                                      */}
        {/* ========================================================================= */}
        {showAddCategoryModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-1">Create Category</h3>
              <p className="text-xs text-zinc-500 mb-5">Add a new section to organize inventory.</p>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Category Code</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="e.g. I, J"
                    value={newCatForm.code}
                    onChange={(e) => setNewCatForm({ ...newCatForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 uppercase focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Beverages & Syrups"
                    value={newCatForm.name}
                    onChange={(e) => setNewCatForm({ ...newCatForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-md cursor-pointer"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: LOG MOVEMENT (PURCHASE / WASTAGE)                                  */}
        {/* ========================================================================= */}
        {showLogMovementModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-1">Record Stock Movement</h3>
              <p className="text-xs text-zinc-500 mb-5">
                Log a stock delivery or wastage entry. This updates today&apos;s daily register.
              </p>

              <form onSubmit={handleLogMovement} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Type</label>
                    <select
                      value={newMovForm.movement_type}
                      onChange={(e) =>
                        setNewMovForm({ ...newMovForm, movement_type: e.target.value as any })
                      }
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    >
                      <option value="PURCHASE">Purchase / Delivery</option>
                      <option value="WASTAGE">Wastage / Scrap</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Ingredient</label>
                    <select
                      required
                      value={newMovForm.ingredient_id}
                      onChange={(e) => {
                        const ing = items.find((i) => i.ingredient_id === e.target.value);
                        setNewMovForm({
                          ...newMovForm,
                          ingredient_id: e.target.value,
                          unit: ing?.unit || "kg",
                        });
                      }}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    >
                      <option value="">Select Item</option>
                      {items.map((i) => (
                        <option key={i.ingredient_id} value={i.ingredient_id}>
                          {i.ingredient_number}. {i.ingredient_name} ({i.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={newMovForm.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setNewMovForm({ ...newMovForm, quantity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Cost (₹ Optional)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 450"
                      value={newMovForm.cost}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setNewMovForm({ ...newMovForm, cost: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    {newMovForm.movement_type === "PURCHASE" ? "Supplier / Vendor Name" : "Reason for Wastage"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      newMovForm.movement_type === "PURCHASE"
                        ? "e.g. Local Meat Market, Metro"
                        : "e.g. Spilled, Expired, Burnt"
                    }
                    value={
                      newMovForm.movement_type === "PURCHASE" ? newMovForm.supplier : newMovForm.reason
                    }
                    onChange={(e) =>
                      newMovForm.movement_type === "PURCHASE"
                        ? setNewMovForm({ ...newMovForm, supplier: e.target.value })
                        : setNewMovForm({ ...newMovForm, reason: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowLogMovementModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#b02d08] transition shadow-md cursor-pointer"
                  >
                    Record Movement
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: FINALIZE DAY CONFIRMATION                                         */}
        {/* ========================================================================= */}
        {showFinalizeModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <Lock size={24} />
              </div>

              <h3 className="text-lg font-bold text-zinc-900 mb-1">Finalize Daily Register?</h3>
              <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
                Finalizing locks today&apos;s counts. The current Closing Actual balances will automatically
                become tomorrow&apos;s Opening balances.
              </p>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 mb-5 text-xs text-zinc-700 space-y-1">
                <div>
                  <strong>Total Ingredients:</strong> {totalIngredientsCount}
                </div>
                <div>
                  <strong>Counted:</strong> {totalCounted} (
                  {totalIngredientsCount - totalCounted} uncounted)
                </div>
                <div>
                  <strong>Estimated Closing Stock Value:</strong> ₹{totalValuedStock.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={finalizeDay}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#2C1710] text-[#FFF9F5] text-xs font-bold hover:bg-black transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Finalizing..." : "Confirm & Lock Day"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: FIFO STOCK BATCHES (MASTER CATALOG)                                 */}
        {/* ========================================================================= */}
        {showBatchesModal && selectedIngredientForBatches && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    Stock Batches (FIFO) — {selectedIngredientForBatches.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Active inventory batches tracked by strict First-In, First-Out (FIFO) costing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchesModal(false)}
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
                {(!selectedIngredientForBatches.batches || selectedIngredientForBatches.batches.length === 0) ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    No active stock batches found for this ingredient. Add a purchase or count opening stock.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Batch Type</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-center">Original Qty</th>
                        <th className="py-2.5 px-3 text-center">Remaining Qty</th>
                        <th className="py-2.5 px-3 text-center">Unit Cost (₹)</th>
                        <th className="py-2.5 px-3 text-right">Remaining Value (₹)</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {selectedIngredientForBatches.batches.map((b) => (
                        <tr key={b.id} className="hover:bg-zinc-50 transition">
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.batch_type === "OPENING"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-orange-50 text-orange-700 border border-orange-200"
                              }`}
                            >
                              {b.batch_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-600 text-[11px]">{b.date}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-zinc-600">
                            {b.original_qty} {b.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-900">
                            {b.remaining_qty} {b.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-zinc-800">
                            ₹{b.unit_cost.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{b.remaining_value.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                            {b.supplier ? `Supplier: ${b.supplier}` : b.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-100">
                <div className="text-xs text-zinc-600">
                  Total Remaining Stock:{" "}
                  <strong className="text-zinc-900">
                    {selectedIngredientForBatches.current_stock ?? 0} {selectedIngredientForBatches.unit}
                  </strong>{" "}
                  · Total FIFO Value:{" "}
                  <strong className="text-emerald-700">
                    ₹{Number(selectedIngredientForBatches.stock_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchesModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: TODAY'S PURCHASE BATCHES BREAKDOWN (DAILY REGISTER)                 */}
        {/* ========================================================================= */}
        {showPurchasedBreakdownModal && selectedItemForBreakdown && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    Purchases on {selectedDate} — {selectedItemForBreakdown.ingredient_name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Detailed batch breakdown for today&apos;s deliveries.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPurchasedBreakdownModal(false)}
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-zinc-200">
                {(!selectedItemForBreakdown.purchase_entries || selectedItemForBreakdown.purchase_entries.length === 0) ? (
                  <div className="py-8 text-center text-zinc-400 text-xs">
                    No purchase entries recorded for this ingredient on {selectedDate}.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-center">Unit Price (₹)</th>
                        <th className="py-2 px-3 text-right">Total (₹)</th>
                        <th className="py-2 px-3">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {selectedItemForBreakdown.purchase_entries.map((p, pIdx) => (
                        <tr key={p.id || pIdx} className="hover:bg-zinc-50 transition">
                          <td className="py-2 px-3 font-mono text-zinc-400">{pIdx + 1}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-zinc-900">
                            {p.quantity} {p.unit}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-zinc-700">
                            ₹{p.price_per_unit.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{(p.total_cost || p.quantity * p.price_per_unit).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-zinc-500 text-[11px]">{p.supplier || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowPurchasedBreakdownModal(false);
                    openAddPurchaseModal(selectedItemForBreakdown);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-50 text-[#CA340A] text-xs font-bold hover:bg-orange-100 transition border border-orange-200 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>+ Record Another Purchase</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPurchasedBreakdownModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
