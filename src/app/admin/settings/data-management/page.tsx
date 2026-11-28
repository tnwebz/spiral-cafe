"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import AnalyticsPinGate from "@/components/Admin/AnalyticsPinGate";
import {
  ArrowLeft,
  Database,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Calendar,
  FileText,
  Search,
  Filter,
  Trash2,
  RotateCcw,
  Printer,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Info,
  Clock,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Receipt,
  Eye,
  KeyRound,
  X,
} from "lucide-react";
import {
  StorageOverview,
  ExportPreview,
  EncryptedArchiveFile,
  ArchivePayloadData,
  CleanupPreview,
  RestorePreview,
} from "@/lib/data-management/types";
import { decryptArchiveFile, computeSha256Hex } from "@/lib/data-management/crypto";

type ActiveTab = "overview" | "export" | "viewer" | "backup" | "cleanup";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  // Security Lock Protection
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [checkingUnlock, setCheckingUnlock] = useState<boolean>(false);

  // Tab 2: Export State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState("");
  const [exporting, setExporting] = useState(false);
  const [latestExportedArchive, setLatestExportedArchive] = useState<EncryptedArchiveFile | null>(null);
  const [latestExportFilename, setLatestExportFilename] = useState<string>("");

  // Verification & Purge State
  const [verifyPassphrase, setVerifyPassphrase] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedArchivePayload, setVerifiedArchivePayload] = useState<ArchivePayloadData | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgePassword, setPurgePassword] = useState("");
  const [purging, setPurging] = useState(false);

  // Tab 3: Archive Viewer State
  const [viewerFile, setViewerFile] = useState<EncryptedArchiveFile | null>(null);
  const [viewerPassphrase, setViewerPassphrase] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerPayload, setViewerPayload] = useState<ArchivePayloadData | null>(null);
  const [viewerSearch, setViewerSearch] = useState("");
  const [selectedHistoricalOrder, setSelectedHistoricalOrder] = useState<any | null>(null);
  const [selectedHistoricalInvoice, setSelectedHistoricalInvoice] = useState<any | null>(null);

  // Restore State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePreviewData, setRestorePreviewData] = useState<RestorePreview | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Tab 5: Cleanup State
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupPassword, setCleanupPassword] = useState("");
  const [cleaning, setCleaning] = useState(false);

  // 1. Fetch Storage Overview
  const fetchStorageData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/data-management/storage");
      const json = await res.json();
      if (json.success) {
        setOverview(json.overview);
      } else {
        setToast({ message: json.error || "Failed to load storage statistics.", error: true });
      }
    } catch {
      setToast({ message: "Network error loading database stats.", error: true });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStorageData();
  }, [fetchStorageData]);

  // 2. Fetch Export Preview when dates change
  const handleFetchExportPreview = useCallback(async () => {
    if (!startDate || !endDate) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/data-management/export-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const json = await res.json();
      if (json.success) {
        setExportPreview(json.preview);
      } else {
        setToast({ message: json.error || "Failed to preview export.", error: true });
      }
    } catch {
      setToast({ message: "Network error previewing export.", error: true });
    } finally {
      setPreviewLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (activeTab === "export") {
      handleFetchExportPreview();
    }
  }, [activeTab, handleFetchExportPreview]);

  // 3. Trigger Archive Download
  const handleDownloadArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportPassphrase || exportPassphrase.length < 6) {
      setToast({ message: "Archive passphrase must be at least 6 characters long.", error: true });
      return;
    }
    if (exportPassphrase !== exportPassphraseConfirm) {
      setToast({ message: "Passphrases do not match. Please re-type carefully.", error: true });
      return;
    }

    setExporting(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/data-management/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          passphrase: exportPassphrase,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setToast({ message: json.error || "Failed to generate archive.", error: true });
        return;
      }

      setLatestExportedArchive(json.archive);
      setLatestExportFilename(json.filename);

      // Trigger browser file download
      const blob = new Blob([JSON.stringify(json.archive, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = json.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToast({
        message: `Archive downloaded successfully: ${json.filename}. Please test verification below before purging.`,
      });
    } catch (err: any) {
      setToast({ message: err.message || "Failed to download archive.", error: true });
    } finally {
      setExporting(false);
    }
  };

  // 4. Verify Archive
  const handleVerifyArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestExportedArchive) {
      setToast({ message: "No archive file loaded to verify.", error: true });
      return;
    }
    if (!verifyPassphrase) {
      setToast({ message: "Enter the archive passphrase to verify decryption.", error: true });
      return;
    }

    setVerifying(true);
    setToast(null);

    try {
      // Perform local client-side decryption and verification first
      const payload = await decryptArchiveFile(latestExportedArchive, verifyPassphrase);
      setVerifiedArchivePayload(payload);

      // Notify backend to mark registry as VERIFIED
      await fetch("/api/admin/data-management/verify-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archiveFile: latestExportedArchive,
          passphrase: verifyPassphrase,
        }),
      });

      setToast({
        message: `Verification Passed! Checksum, encryption, and all ${payload.orders.length} records verified.`,
      });
    } catch (err: any) {
      setToast({ message: `Verification Failed: ${err.message}`, error: true });
    } finally {
      setVerifying(false);
    }
  };

  // 5. Purge Verified Archive from Supabase
  const handleExecutePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedArchivePayload) {
      setToast({ message: "Only verified archives can be purged from the database.", error: true });
      return;
    }
    if (!purgePassword) {
      setToast({ message: "Administrator verification password is required.", error: true });
      return;
    }

    setPurging(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/data-management/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archiveId: verifiedArchivePayload.manifest.archiveId,
          adminPassword: purgePassword,
          archivePayload: verifiedArchivePayload,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowPurgeModal(false);
        setPurgePassword("");
        setVerifiedArchivePayload(null);
        setLatestExportedArchive(null);
        setToast({ message: json.message });
        fetchStorageData();
        handleFetchExportPreview();
      } else {
        setToast({ message: json.error || "Purge failed.", error: true });
      }
    } catch {
      setToast({ message: "Network error during purge execution.", error: true });
    } finally {
      setPurging(false);
    }
  };

  // 6. Handle Archive File Drop in Viewer
  const handleFileDrop = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".scarchive") && !file.name.endsWith(".json")) {
      setToast({ message: "Please select a valid .scarchive file.", error: true });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.magic !== "SCARCHIVE") {
          throw new Error("File is not a valid Spiral Cafe archive package.");
        }
        setViewerFile(parsed);
        setViewerPayload(null);
        setToast({ message: `Loaded ${file.name}. Enter archive passphrase to unlock records.` });
      } catch (err: any) {
        setToast({ message: `Invalid archive file: ${err.message}`, error: true });
      }
    };
    reader.readAsText(file);
  };

  // 7. Decrypt Archive in Viewer
  const handleDecryptViewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewerFile || !viewerPassphrase) return;
    setViewerLoading(true);
    setToast(null);

    try {
      const payload = await decryptArchiveFile(viewerFile, viewerPassphrase);
      setViewerPayload(payload);
      setToast({
        message: `Unlocked archive: ${payload.orders.length} orders and ${payload.invoices.length} bills ready to view.`,
      });
    } catch (err: any) {
      setToast({ message: `Decryption failed: ${err.message}`, error: true });
    } finally {
      setViewerLoading(false);
    }
  };

  // 8. Restore Preview & Execution
  const handleOpenRestorePreview = async () => {
    if (!viewerPayload) return;
    try {
      const res = await fetch("/api/admin/data-management/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", archivePayload: viewerPayload }),
      });
      const json = await res.json();
      if (json.success) {
        setRestorePreviewData(json.preview);
        setShowRestoreModal(true);
      } else {
        setToast({ message: json.error || "Failed to preview restore.", error: true });
      }
    } catch {
      setToast({ message: "Network error previewing restoration.", error: true });
    }
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewerPayload || !restorePassword) return;
    setRestoring(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/data-management/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          archivePayload: viewerPayload,
          adminPassword: restorePassword,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowRestoreModal(false);
        setRestorePassword("");
        setToast({ message: json.message });
        fetchStorageData();
      } else {
        setToast({ message: json.error || "Restoration failed.", error: true });
      }
    } catch {
      setToast({ message: "Network error executing restore.", error: true });
    } finally {
      setRestoring(false);
    }
  };

  // 9. Cleanup Preview & Execution
  const handleOpenCleanupPreview = async () => {
    setCleanupLoading(true);
    try {
      const res = await fetch("/api/admin/data-management/cleanup");
      const json = await res.json();
      if (json.success) {
        setCleanupPreview(json.preview);
      } else {
        setToast({ message: json.error || "Failed to preview cleanup.", error: true });
      }
    } catch {
      setToast({ message: "Network error loading cleanup preview.", error: true });
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleExecuteCleanup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanupPassword) return;
    setCleaning(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/data-management/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: cleanupPassword }),
      });

      const json = await res.json();
      if (json.success) {
        setShowCleanupModal(false);
        setCleanupPassword("");
        setToast({ message: json.message });
        fetchStorageData();
        handleOpenCleanupPreview();
      } else {
        setToast({ message: json.error || "Cleanup failed.", error: true });
      }
    } catch {
      setToast({ message: "Network error executing cleanup.", error: true });
    } finally {
      setCleaning(false);
    }
  };

  // Filtered orders in viewer
  const displayedViewerOrders = useMemo(() => {
    if (!viewerPayload?.orders) return [];
    if (!viewerSearch.trim()) return viewerPayload.orders;
    const q = viewerSearch.toLowerCase().trim();
    return viewerPayload.orders.filter((o) => {
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.table_number?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q)
      );
    });
  }, [viewerPayload, viewerSearch]);

  if (checkingUnlock) {
    return (
      <AdminLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[#CA340A] border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!isUnlocked) {
    return (
      <AdminLayout>
        <AnalyticsPinGate
          storageKey="spiral_settings_unlocked"
          backHref="/admin/settings"
          title="Data Management Protected"
          subtitle="Enter the 4-digit security PIN to view and manage database records and archives."
          onUnlock={() => setIsUnlocked(true)}
        />
      </AdminLayout>
    );
  }

  if (loading && !overview) {
    return (
      <AdminLayout>
        <div className="py-24 text-center text-[#52525b]">
          <RefreshCw size={24} className="animate-spin text-[#CA340A] mx-auto mb-3" />
          <p className="font-heading font-bold text-sm">Measuring Supabase database storage...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl pb-16 text-[#2C1710]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#CA340A]/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/settings"
              className="p-2 rounded-xl bg-white border border-zinc-200 hover:bg-[#FFF9F5] text-[#2C1710] transition-colors"
              title="Return to Settings"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-xl sm:text-2xl text-[#2C1710] uppercase tracking-tight">
                  Data Management
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#CA340A]/10 text-[#CA340A] border border-[#CA340A]/20">
                  Manual Archiving
                </span>
              </div>
              <p className="text-xs text-[#52525b] mt-0.5">
                Monitor database storage, export encrypted business archives, and safely preserve lifetime analytics
              </p>
            </div>
          </div>

          <button
            onClick={fetchStorageData}
            disabled={refreshing}
            className="px-3.5 py-2 bg-white border border-zinc-200 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710] rounded-xl flex items-center gap-2 shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-[#CA340A]" : ""} />
            <span>Refresh Storage Data</span>
          </button>
        </div>

        {/* Global Toast Alert */}
        {toast && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-bold shadow-xs ${
              toast.error
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.error ? <AlertTriangle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-500 hover:text-black font-semibold text-xs ml-3 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-200">
          {(
            [
              { id: "overview", label: "Storage Overview", icon: Database },
              { id: "export", label: "Export & Archive", icon: Download },
              { id: "viewer", label: "Open Previous Archive", icon: Upload },
              { id: "backup", label: "Backups & Recovery", icon: HardDrive },
              { id: "cleanup", label: "Review & Cleanup", icon: Trash2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "cleanup") handleOpenCleanupPreview();
                }}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-heading font-extrabold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#2C1710] text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <Icon size={15} className={isActive ? "text-amber-400" : "text-zinc-500"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* =================================================================== */}
        {/* TAB 1: STORAGE OVERVIEW */}
        {/* =================================================================== */}
        {activeTab === "overview" && overview && (
          <div className="space-y-6">
            {/* 4 Main KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card A: Database Storage */}
              <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-500">Database Storage</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Database size={15} />
                  </div>
                </div>
                <div>
                  <div className="font-heading font-black text-2xl text-[#2C1710]">
                    {overview.databaseSizeFormatted}
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    of {overview.quotaSizeFormatted} Free Quota ({overview.percentageUsed}% used)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overview.percentageUsed >= 85
                        ? "bg-red-500"
                        : overview.percentageUsed >= 70
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.max(3, overview.percentageUsed)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-zinc-400 pt-1">
                  <span>Remaining: {overview.remainingFormatted}</span>
                  <span>{overview.isRpcMeasurement ? "Measured via pg_size" : "Table Estimates"}</span>
                </div>
              </div>

              {/* Card B: Orders Stored */}
              <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-500">Orders Stored</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#CA340A] flex items-center justify-center">
                    <ShoppingBag size={15} />
                  </div>
                </div>
                <div>
                  <div className="font-heading font-black text-2xl text-[#2C1710]">
                    {overview.orderMetrics.totalOrdersInDb}
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    {overview.orderMetrics.activeOrders} active • {overview.orderMetrics.completedOrders} completed
                  </span>
                </div>
                <div className="pt-2 text-[11px] font-semibold text-zinc-500 border-t border-zinc-100">
                  {overview.orderMetrics.completedOrders > 0
                    ? `${overview.orderMetrics.completedOrders} completed orders eligible for archive`
                    : "All current orders are active or recent"}
                </div>
              </div>

              {/* Card C: Archive History */}
              <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-500">Archive History</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck size={15} />
                  </div>
                </div>
                <div>
                  <div className="font-heading font-black text-2xl text-[#2C1710]">
                    {overview.archiveMetrics.totalArchivesCount}
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    {overview.archiveMetrics.verifiedArchivesCount} verified • {overview.archiveMetrics.purgedArchivesCount} purged
                  </span>
                </div>
                <div className="pt-2 text-[11px] font-semibold text-zinc-500 border-t border-zinc-100 truncate">
                  {overview.archiveMetrics.lastExportDate
                    ? `Last Export: ${new Date(overview.archiveMetrics.lastExportDate).toLocaleDateString()}`
                    : "No archives generated yet"}
                </div>
              </div>

              {/* Card D: Database Health */}
              <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-500">Database Health</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Sparkles size={15} />
                  </div>
                </div>
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      overview.healthStatus === "Healthy"
                        ? "bg-emerald-100 text-emerald-800"
                        : overview.healthStatus === "Needs Attention"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {overview.healthStatus}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-zinc-500 leading-tight pt-1">
                  {overview.healthExplanation}
                </p>
              </div>
            </div>

            {/* Storage Details Table */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="font-heading font-black text-base text-[#2C1710]">
                    Public Database Tables Breakdown
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    Detailed record counts, storage consumption, and retention classification
                  </p>
                </div>
                <span className="text-xs font-bold text-zinc-400">
                  {overview.tables.length} tables audited
                </span>
              </div>

              <div className="border border-zinc-100 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Table Name</th>
                        <th className="py-3 px-4 text-center">Record Count</th>
                        <th className="py-3 px-4 text-center">Storage Size</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Retention Rule</th>
                        <th className="py-3 px-4 text-right">Archivable?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {overview.tables.map((t) => (
                        <tr key={t.tableName} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-zinc-900 font-mono text-xs">
                            {t.tableName}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-zinc-800">
                            {t.recordCount} <span className="text-[10px] text-zinc-400 font-normal">({t.countType})</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-[#CA340A]">
                            {formatBytes(t.sizeBytes)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-bold">
                              {t.dataCategory}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-zinc-600">
                            {t.retentionRecommendation}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {t.isEligibleForArchiving ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                Eligible
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold">
                                Retain Online
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Information Note */}
              <div className="p-4 rounded-2xl bg-[#FFF9F5] border border-[#CA340A]/20 text-xs text-[#2C1710] flex items-start gap-3">
                <Info size={16} className="text-[#CA340A] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">PostgreSQL Storage Reclamation Guardrail</p>
                  <p className="text-zinc-600 leading-relaxed text-[11px]">
                    When rows are deleted from PostgreSQL, deleted space is retained internally by the engine for future row inserts (free space map). Database pages are returned to the physical disk naturally over time as new orders are placed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: EXPORT & ARCHIVE DATA */}
        {/* =================================================================== */}
        {activeTab === "export" && (
          <div className="space-y-6">
            {/* Step 1: Date Range Selector */}
            <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#CA340A] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-heading font-black text-base text-[#2C1710]">
                  Select Archival Date Range
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5 uppercase tracking-wider">
                    Start Date (IST)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5 uppercase tracking-wider">
                    End Date (IST)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      const last = new Date(now.getFullYear(), now.getMonth(), 0);
                      setStartDate(d.toISOString().slice(0, 10));
                      setEndDate(last.toISOString().slice(0, 10));
                    }}
                    className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d = new Date(now.getFullYear(), 0, 1);
                      const last = new Date(now.getFullYear(), now.getMonth(), 0);
                      setStartDate(d.toISOString().slice(0, 10));
                      setEndDate(last.toISOString().slice(0, 10));
                    }}
                    className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Year to Date
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Preview Eligible Records */}
            <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#CA340A] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h3 className="font-heading font-black text-base text-[#2C1710]">
                    Verified Archival Eligibility Preview
                  </h3>
                </div>
                {previewLoading && <RefreshCw size={14} className="animate-spin text-[#CA340A]" />}
              </div>

              {exportPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Eligible Orders
                      </span>
                      <span className="font-heading font-black text-2xl text-[#2C1710] block mt-0.5">
                        {exportPreview.eligibleOrdersCount}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">Completed &amp; Paid</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Related Line Items
                      </span>
                      <span className="font-heading font-black text-2xl text-[#2C1710] block mt-0.5">
                        {exportPreview.orderItemsCount}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-bold">Dish Details</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Related Invoices
                      </span>
                      <span className="font-heading font-black text-2xl text-[#2C1710] block mt-0.5">
                        {exportPreview.invoicesCount}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-bold">Settled Bills</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Total Value (₹)
                      </span>
                      <span className="font-heading font-black text-2xl text-[#CA340A] block mt-0.5">
                        ₹{exportPreview.financialTotal.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-bold">Est. Size: {exportPreview.estimatedExportSizeFormatted}</span>
                    </div>
                  </div>

                  {/* Safety Guardrail Exclusion Banner */}
                  {(exportPreview.activeOrdersExcludedCount > 0 ||
                    exportPreview.pendingPaymentOrdersExcludedCount > 0) && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>
                          <strong>Safety Guardrail Active:</strong> {exportPreview.activeOrdersExcludedCount} active orders and {exportPreview.pendingPaymentOrdersExcludedCount} unpaid orders in this date range are strictly excluded from archival to protect live operations.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Passphrase Protection & Download */}
            <form onSubmit={handleDownloadArchive} className="bg-white p-6 rounded-3xl border border-black/5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#CA340A] flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-[#2C1710]">
                    Archive Encryption &amp; Download
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Protected with AES-GCM-256 authenticated encryption. Choose a passphrase to unlock this file in the future.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5 uppercase tracking-wider">
                    Archive Passphrase (min 6 characters)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter strong passphrase..."
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5 uppercase tracking-wider">
                    Confirm Archive Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter passphrase..."
                    value={exportPassphraseConfirm}
                    onChange={(e) => setExportPassphraseConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={exporting || !exportPreview || exportPreview.eligibleOrdersCount === 0}
                  className="px-6 py-3 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs sm:text-sm font-heading font-black shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Download size={16} />
                  <span>{exporting ? "Generating & Encrypting..." : "Download Secure .scarchive File"}</span>
                </button>
              </div>
            </form>

            {/* Step 4 & 5: Verification & Optional Purge */}
            {latestExportedArchive && (
              <div className="bg-gradient-to-br from-[#FFFDFB] to-[#F5FDF7] p-6 rounded-3xl border-2 border-emerald-300 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <h3 className="font-heading font-black text-base text-[#2C1710]">
                      Archive Generated: {latestExportFilename}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    Export Ready
                  </span>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  Before removing any data from live Supabase, verify that your archive opens properly and that you have saved independent copies.
                </p>

                <form onSubmit={handleVerifyArchive} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="password"
                    placeholder="Enter passphrase to verify integrity..."
                    value={verifyPassphrase}
                    onChange={(e) => setVerifyPassphrase(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    <span>{verifying ? "Verifying Checksum..." : "Verify Archive Integrity"}</span>
                  </button>
                </form>

                {/* Purge Action Button (Only visible after verified) */}
                {verifiedArchivePayload && (
                  <div className="pt-4 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 block">
                        ✓ Archive Verified (SHA-256 Checksum: {verifiedArchivePayload.manifest.checksumSha256.slice(0, 16)}...)
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {verifiedArchivePayload.orders.length} orders safely backed up outside Supabase.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPurgeModal(true)}
                      className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Trash2 size={14} />
                      <span>Remove Verified Records From Live Database</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: OPEN PREVIOUS ARCHIVE (DRAG-AND-DROP VIEWER) */}
        {/* =================================================================== */}
        {activeTab === "viewer" && (
          <div className="space-y-6">
            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileDrop(e.dataTransfer.files);
              }}
              className="bg-white border-2 border-dashed border-[#CA340A]/30 hover:border-[#CA340A] rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center mx-auto mb-3">
                <Upload size={22} />
              </div>
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Drag and drop your .scarchive file here
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Open historical archives directly in your browser. Records are viewed locally and are NOT uploaded or imported to Supabase.
              </p>

              <label className="inline-block mt-4 px-5 py-2.5 bg-[#2C1710] hover:bg-[#432319] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs">
                <span>Choose File</span>
                <input
                  type="file"
                  accept=".scarchive,.json"
                  className="hidden"
                  onChange={(e) => handleFileDrop(e.target.files)}
                />
              </label>
            </div>

            {/* Passphrase Unlock Form if file loaded */}
            {viewerFile && !viewerPayload && (
              <form onSubmit={handleDecryptViewer} className="bg-white p-6 rounded-3xl border border-black/5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                  <Lock size={16} className="text-[#CA340A]" />
                  <h3 className="font-heading font-black text-base text-[#2C1710]">
                    Unlock Encrypted Archive: {viewerFile.manifestPreview.archiveId}
                  </h3>
                </div>

                <p className="text-xs text-zinc-500">
                  Date Range: <strong>{viewerFile.manifestPreview.startDate}</strong> to{" "}
                  <strong>{viewerFile.manifestPreview.endDate}</strong> • {viewerFile.manifestPreview.counts.orders} orders
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="password"
                    placeholder="Enter archive passphrase..."
                    autoFocus
                    value={viewerPassphrase}
                    onChange={(e) => setViewerPassphrase(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                  />
                  <button
                    type="submit"
                    disabled={viewerLoading || !viewerPassphrase}
                    className="px-6 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={14} />
                    <span>{viewerLoading ? "Decrypting..." : "Decrypt & Open"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Historical Records Viewer */}
            {viewerPayload && (
              <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-2xs space-y-5">
                {/* Manifest Overview Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      ✓ Decrypted in Memory
                    </span>
                    <h3 className="font-heading font-black text-lg text-[#2C1710] mt-1">
                      Historical Records ({viewerPayload.manifest.startDate} to {viewerPayload.manifest.endDate})
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Total Orders: <strong>{viewerPayload.orders.length}</strong> • Settled Value:{" "}
                      <strong>₹{viewerPayload.manifest.financials.settledRevenue.toLocaleString()}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleOpenRestorePreview}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-heading font-black shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>Restore Archived Records</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewerPayload(null);
                        setViewerFile(null);
                        setViewerPassphrase("");
                      }}
                      className="px-3.5 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Close Viewer
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by Order #, Table, Customer Phone..."
                    value={viewerSearch}
                    onChange={(e) => setViewerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:border-[#CA340A]"
                  />
                </div>

                {/* Orders List Table */}
                <div className="border border-zinc-100 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-[10px] uppercase font-bold text-zinc-400 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Order Number</th>
                        <th className="py-2.5 px-3">Date (IST)</th>
                        <th className="py-2.5 px-3">Table</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {displayedViewerOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                            No matching historical orders found.
                          </td>
                        </tr>
                      ) : (
                        displayedViewerOrders.map((o) => (
                          <tr key={o.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-zinc-900 font-mono">
                              #{o.order_number || o.id}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-600">
                              {new Date(o.created_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-bold text-[10px]">
                                {o.table_number}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800">
                                {o.payment_method}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-zinc-900">
                              ₹{o.grand_total}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedHistoricalOrder(o);
                                  const inv = viewerPayload.invoices.find((i) => i.order_id === o.id);
                                  setSelectedHistoricalInvoice(inv || null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold cursor-pointer"
                              >
                                View Bill
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: BACKUPS & DISASTER RECOVERY */}
        {/* =================================================================== */}
        {activeTab === "backup" && (
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-black/5 shadow-2xs space-y-6">
            <div>
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Manual Database Backup &amp; Disaster Recovery
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Standard disaster recovery procedures for the Spiral Cafe Supabase PostgreSQL database
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#2C1710] uppercase tracking-wider">
                Recommended Manual Backup Checklist
              </h4>
              <div className="space-y-2 text-xs text-zinc-700">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>1. Supabase Native Backup / PITR:</strong> Supabase automated backups run on the cloud project. Free tier projects retain standard platform snapshots.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>2. PostgreSQL pg_dump Export (Windows / CLI):</strong> Use pg_dump with your database connection string to create a raw, full-schema SQL dump:
                    <div className="mt-1 p-2 bg-[#2C1710] text-amber-300 rounded-lg font-mono text-[11px] overflow-x-auto">
                      pg_dump -h db.funsnqahpzsucbtxbvpo.supabase.co -U postgres -d postgres -F c -f spiral_cafe_backup.dump
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>3. Portable Setup Package:</strong> Our repository contains the complete standalone schema DDL and seeds in <code className="bg-zinc-200 px-1 py-0.5 rounded text-[11px]">supabase/setup-package/</code> for instant reproduction inside a fresh project.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: REVIEW & CLEANUP */}
        {/* =================================================================== */}
        {activeTab === "cleanup" && (
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-black/5 shadow-2xs space-y-6">
            <div>
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Review &amp; Clean Disposable Data
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Review disposable temporary records proven safe to remove without affecting orders, invoices, or customer profiles
              </p>
            </div>

            {cleanupLoading ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <RefreshCw size={18} className="animate-spin text-[#CA340A] mx-auto mb-2" />
                Auditing disposable records...
              </div>
            ) : cleanupPreview ? (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-[#FFF9F5] border border-[#CA340A]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#CA340A] uppercase tracking-wider">
                      Expired Empty Guest Sessions
                    </span>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Found <strong>{cleanupPreview.expiredEmptySessionsCount}</strong> temporary QR sessions older than 48 hours that have <strong>zero orders</strong> linked to them.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={cleanupPreview.expiredEmptySessionsCount === 0}
                    onClick={() => setShowCleanupModal(true)}
                    className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Clean {cleanupPreview.expiredEmptySessionsCount} Empty Sessions</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: PURGE CONFIRMATION WITH RE-AUTHENTICATION */}
        {/* =================================================================== */}
        {showPurgeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[#FFFDFB] rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-red-200 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-red-700 border-b border-red-100 pb-3">
                <AlertTriangle size={20} />
                <h3 className="font-heading font-black text-base">
                  Confirm Permanent Removal From Supabase
                </h3>
              </div>

              <div className="p-3.5 bg-red-50 text-red-800 rounded-xl text-xs space-y-1.5">
                <p className="font-bold">Important Safeguard Requirements:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>You must have downloaded and verified your .scarchive file.</li>
                  <li>Permanent daily &amp; product summaries will be committed to Supabase before row deletion.</li>
                  <li>Historical sales totals and lifetime analytics will NOT be lost.</li>
                </ul>
              </div>

              <form onSubmit={handleExecutePurge} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                    Administrator Reauthentication Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter admin password to confirm..."
                    autoFocus
                    value={purgePassword}
                    onChange={(e) => setPurgePassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPurgeModal(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={purging || !purgePassword}
                    className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{purging ? "Removing Records..." : "Confirm & Remove From DB"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: RESTORE CONFIRMATION WITH RE-AUTHENTICATION */}
        {/* =================================================================== */}
        {showRestoreModal && restorePreviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[#FFFDFB] rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-amber-200 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-amber-800 border-b border-amber-100 pb-3">
                <RotateCcw size={20} />
                <h3 className="font-heading font-black text-base">
                  Confirm Live Database Restoration
                </h3>
              </div>

              <div className="text-xs text-zinc-600 space-y-2">
                <p>
                  Archive contains <strong>{restorePreviewData.ordersCount}</strong> orders.
                </p>
                {restorePreviewData.warnings.map((w, idx) => (
                  <p key={idx} className="text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg">
                    {w}
                  </p>
                ))}
                <p className="text-[11px] text-zinc-500">
                  Restoration uses safe idempotent upserts (existing records will not be duplicated).
                </p>
              </div>

              <form onSubmit={handleExecuteRestore} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                    Administrator Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter admin password..."
                    autoFocus
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={restoring || !restorePassword}
                    className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    <span>{restoring ? "Restoring..." : "Confirm Live Restore"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: CLEANUP EMPTY SESSIONS CONFIRMATION */}
        {/* =================================================================== */}
        {showCleanupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[#FFFDFB] rounded-3xl p-6 sm:p-7 max-w-md w-full border border-red-200 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-red-700 border-b border-red-100 pb-3">
                <Trash2 size={18} />
                <h3 className="font-heading font-black text-base">
                  Clean Expired Empty Sessions
                </h3>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                This will delete only guest sessions older than 48 hours that have 0 orders. No orders, customers, or bills will be affected.
              </p>

              <form onSubmit={handleExecuteCleanup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter admin password..."
                    autoFocus
                    value={cleanupPassword}
                    onChange={(e) => setCleanupPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCleanupModal(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={cleaning || !cleanupPassword}
                    className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{cleaning ? "Cleaning..." : "Confirm Cleanup"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: HISTORICAL BILL / RECEIPT VIEWER */}
        {/* =================================================================== */}
        {selectedHistoricalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[#FFFDFB] rounded-3xl p-6 sm:p-7 max-w-md w-full border border-[#EBDAD0] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#F0E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[#CA340A]" />
                  <h3 className="font-heading font-black text-base text-[#2C1710]">
                    Historical Bill #{selectedHistoricalOrder.order_number}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedHistoricalOrder(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Bill Details */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-zinc-500">
                  <span>Table / Destination:</span>
                  <span className="font-bold text-zinc-800">{selectedHistoricalOrder.table_number}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Order Date:</span>
                  <span className="font-semibold text-zinc-800">
                    {new Date(selectedHistoricalOrder.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Payment Method:</span>
                  <span className="font-bold text-emerald-700">{selectedHistoricalOrder.payment_method}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Payment Status:</span>
                  <span className="font-bold text-emerald-700">{selectedHistoricalOrder.payment_status}</span>
                </div>

                {/* Items */}
                <div className="border-t border-b border-zinc-100 py-2 space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Order Items:
                  </span>
                  {(
                    viewerPayload?.orderItems.filter(
                      (it) => it.order_id === selectedHistoricalOrder.id
                    ) || []
                  ).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span>
                        {it.name} <strong className="text-zinc-400">x{it.quantity}</strong>
                      </span>
                      <span className="font-bold text-zinc-800">₹{it.line_total || it.price * it.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-1 pt-1 text-xs">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal:</span>
                    <span>₹{selectedHistoricalOrder.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Tax (GST):</span>
                    <span>₹{selectedHistoricalOrder.tax}</span>
                  </div>
                  <div className="flex justify-between font-heading font-black text-sm text-[#CA340A] pt-1 border-t border-zinc-100">
                    <span>Grand Total:</span>
                    <span>₹{selectedHistoricalOrder.grand_total}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHistoricalOrder(null)}
                  className="px-4 py-2 bg-[#2C1710] hover:bg-[#432319] text-white rounded-xl text-xs font-bold cursor-pointer"
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
