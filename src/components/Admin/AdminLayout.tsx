"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrderSync } from "@/hooks/useOrderSync";
import AdminConnectivityBar from "@/components/Admin/AdminConnectivityBar";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import {
  LayoutDashboard,
  Grid2X2,
  TrendingUp,
  ShoppingBag,
  Receipt,
  UtensilsCrossed,
  CreditCard,
  Users,
  ChefHat,
  Settings,
  Printer,
  LogOut,
  Menu as MenuIcon,
  X,
  ArrowLeft,
  Radio,
  FileSpreadsheet,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  Bell,
  Search,
  Download,
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<string>("Admin");
  const [adminRole, setAdminRole] = useState<string>("ADMIN");
  const [isConnected, setIsConnected] = useState(true);
  const [liveOrdersCount, setLiveOrdersCount] = useState(0);

  // Authoritative Order Sync & Power-Cut Resilience Engine
  const orderSync = useOrderSync(12000);

  // Progressive Web App (PWA) installation state
  const { canInstall, isInstalled, installApp } = usePWAInstall();

  // Authenticate user session strictly via secure HTTP-only cookies
  useEffect(() => {
    if (pathname === "/admin/login") return;

    fetch("/api/auth/admin/me", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Unauthenticated");
        }
        return res.json();
      })
      .then((data) => {
        if (!data.authenticated) {
          router.replace("/admin/login");
        } else {
          setAdminUser(data.user || "Admin");
          setAdminRole(data.role || "ADMIN");
        }
      })
      .catch(() => {
        router.replace("/admin/login");
      });
  }, [pathname, router]);

  // Connect to Supabase Realtime for live order alerts & connection status
  useEffect(() => {
    if (pathname === "/admin/login") return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_layout_live_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        () => {
          setLiveOrdersCount((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/admin/me", { method: "POST" });
    } catch {}
    window.location.href = "/admin/login";
  };

  // If on login page, render without admin chrome
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navItems: Array<{
    label: string;
    href: string;
    icon: any;
    targetBlank?: boolean;
  }> = [
    { label: "Tables Floor", href: "/admin/tables", icon: Grid2X2 },
    { label: "Billing Lists (Orders)", href: "/admin/orders", icon: ShoppingBag },
    { label: "Sales & Analytics", href: "/admin/analytics", icon: TrendingUp },
    { label: "Dashboard Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Menu Management", href: "/admin/menu", icon: UtensilsCrossed },
    { label: "Inventory", href: "/admin/inventory", icon: FileSpreadsheet },
    { label: "Customers", href: "/admin/customers", icon: Users },
    { label: "Kitchen Printer", href: "/admin/printer", icon: Printer },
    { label: "Settings & Audit", href: "/admin/settings", icon: Settings },
  ];

  const activePageTitle =
    navItems.find(
      (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
    )?.label || "Table Floor Operations";

  return (
    <div
      data-lenis-prevent="true"
      className="min-h-screen bg-[#FFF9F5] text-[#2C1710] flex flex-col antialiased w-full relative"
    >
      {/* BACKDROP FOR SLIDE-OUT MENU (MOBILE & DESKTOP) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* OFF-CANVAS SLIDE-OUT DRAWER MENU (CONTROLLED BY 3-LINE TOGGLE) */}
      <aside
        className={`fixed inset-y-0 left-0 w-80 sm:w-96 bg-[#3A1710] text-[#FFF9F5] flex flex-col z-50 border-r border-[#CA340A]/20 shadow-2xl transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } shrink-0`}
      >
        {/* Brand Header with Close X */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <Link
            href="/admin/tables"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3.5"
          >
            <div className="relative w-11 h-11 rounded-xl bg-[#FFF9F5] p-1.5 flex items-center justify-center shadow-md shrink-0">
              <Image src="/logo.png" alt="Spiral Cafe" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-lg tracking-tight text-[#FFF9F5]">
                SPIRAL CAFE
              </h1>
              <p className="text-xs text-[#E2C7BA] tracking-wide uppercase font-semibold">
                Operations POS
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* Live Status Pill */}
        <div className="px-6 py-3 bg-[#2C1710]/60 border-b border-white/5 flex items-center justify-between text-xs sm:text-sm text-[#E2C7BA]">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className="font-semibold">{isConnected ? "System Live" : "Connecting..."}</span>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#CA340A]/30 text-white font-bold">
            v2.4
          </span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.targetBlank ? "_blank" : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all group cursor-pointer relative z-10 ${
                  isActive
                    ? "bg-[#CA340A] text-white shadow-md shadow-[#CA340A]/30 font-bold"
                    : "text-[#E2C7BA] hover:bg-[#2C1710] hover:text-[#FFF9F5]"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    size={20}
                    className={`${
                      isActive ? "text-white" : "text-[#E2C7BA] group-hover:text-[#CA340A]"
                    } transition-colors shrink-0`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.href === "/admin/orders" && liveOrdersCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-white animate-bounce">
                    +{liveOrdersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Optional Install POS App */}
        {canInstall && !isInstalled && (
          <div className="px-4 pb-3.5">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                installApp();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#CA340A] hover:bg-[#A82806] text-white text-sm font-bold shadow-md shadow-[#CA340A]/30 transition-all cursor-pointer active:scale-95"
            >
              <Download size={16} />
              <span>Install POS Desktop App</span>
            </button>
          </div>
        )}

        {/* Bottom User Bar */}
        <div className="p-5 border-t border-white/10 bg-[#2C1710]/80 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-[#CA340A] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              {adminUser.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-[#FFF9F5] truncate">{adminUser}</p>
              <div className="flex items-center gap-1">
                <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-[#E2C7BA] font-mono">
                  {adminRole}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out of admin console"
            className="p-2.5 rounded-lg text-[#E2C7BA] hover:bg-red-950/80 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA (FULL SCREEN WIDTH) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* TOP UNIFIED ADMIN BAR WITH BACK BUTTON & 3-LINE MENU TOGGLE */}
        <header className="flex bg-white border-b border-[#CA340A]/10 px-4 sm:px-7 py-3 sm:py-3.5 items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* BACK BUTTON */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/admin/tables");
                }
              }}
              className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 text-[#2C1710] hover:bg-[#CA340A] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs group shrink-0 active:scale-95"
              title="Go Back"
              aria-label="Back"
            >
              <ArrowLeft size={18} className="text-[#CA340A] group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
              <span className="font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase">Back</span>
            </button>

            {/* 3-LINE HAMBURGER MENU TOGGLE BUTTON */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-[#2C1710] text-[#FFF9F5] hover:bg-[#CA340A] transition-all flex items-center gap-2 cursor-pointer shadow-xs group shrink-0 active:scale-95"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <MenuIcon size={19} className="group-hover:scale-110 transition-transform text-[#FFF9F5]" />
              <span className="font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase text-[#FFF9F5]">Menu</span>
            </button>

            <div className="flex items-center gap-3 truncate ml-1">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#CA340A] p-1 flex items-center justify-center text-white shrink-0 shadow-xs">
                <Image src="/logo.png" alt="Spiral Cafe" width={22} height={22} className="object-contain" />
              </div>
              <div className="truncate">
                <h2 className="font-heading font-extrabold text-sm sm:text-base text-[#2C1710] flex items-center gap-2 truncate leading-tight">
                  <span>Spiral Cafe</span>
                  <span className="hidden md:inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-[#CA340A]">
                    {activePageTitle}
                  </span>
                </h2>
                <p className="text-[11px] text-[#52525b] truncate font-medium">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {canInstall && !isInstalled && (
              <button
                type="button"
                onClick={() => installApp()}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#CA340A]/30 bg-amber-50 text-[#CA340A] text-xs sm:text-sm font-bold hover:bg-[#CA340A] hover:text-white transition-all shadow-xs cursor-pointer"
                title="Install Spiral Cafe POS as a standalone desktop app"
              >
                <Download size={15} />
                <span>Install POS App</span>
              </button>
            )}

            <Link
              href="/menu"
              target="_blank"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl bg-[#2C1710] text-white text-xs sm:text-sm font-bold hover:bg-[#CA340A] transition-all shadow-xs shrink-0"
            >
              <UtensilsCrossed size={15} />
              <span className="hidden xs:inline">Customer Menu</span>
            </Link>

            <div className="hidden sm:block h-6 w-[1px] bg-zinc-200 mx-0.5" />

            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#2C1710] shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Realtime Live</span>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER (FULL WIDTH) */}
        <main className="flex-1 p-3 sm:p-4 lg:p-5 w-full pb-8">
          <AdminConnectivityBar syncState={orderSync} />
          {children}
        </main>
      </div>
    </div>
  );
}
