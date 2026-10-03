"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  Receipt,
  UtensilsCrossed,
  CreditCard,
  Users,
  ChefHat,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
  Radio,
  FileSpreadsheet,
  ShieldCheck,
  Bell,
  Search,
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

  // Authenticate user session
  useEffect(() => {
    if (pathname === "/admin/login") return;

    fetch("/api/auth/admin/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace("/admin/login");
        } else {
          setAdminUser(data.user || "Admin");
          setAdminRole(data.role || "ADMIN");
        }
      })
      .catch(() => {
        // In case of network blip, do not aggressively kick user
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
    router.replace("/admin/login");
  };

  // If on login page, render without admin chrome
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Sales & Analytics", href: "/admin/analytics", icon: TrendingUp },
    { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
    { label: "Menu Management", href: "/admin/menu", icon: UtensilsCrossed },
    { label: "Customers", href: "/admin/customers", icon: Users },
    { label: "Kitchen KDS", href: "/kitchen", icon: ChefHat, targetBlank: true },
    { label: "Settings & Audit", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div
      data-lenis-prevent="true"
      className="min-h-screen bg-[#FFF9F5] text-[#2C1710] flex flex-col md:flex-row antialiased w-full relative"
    >
      {/* MOBILE HEADER */}
      <header className="md:hidden bg-[#3A1710] text-[#FFF9F5] px-4 py-3 flex items-center justify-between border-b border-[#CA340A]/20 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full bg-[#FFF9F5] p-1 flex items-center justify-center">
            <Image src="/logo.png" alt="Spiral Cafe" width={24} height={24} className="object-contain" />
          </div>
          <div>
            <span className="font-heading font-extrabold text-sm tracking-tight text-[#FFF9F5]">SPIRAL CAFE</span>
            <span className="block text-[10px] text-[#E2C7BA] font-medium">Admin Console</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-black/20 text-[#E2C7BA]">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`} />
            <span>{isConnected ? "LIVE" : "OFFLINE"}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-[#2C1710] text-[#FFF9F5] hover:bg-[#CA340A] transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </header>

      {/* BACKDROP FOR MOBILE */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* DESKTOP / TABLET SIDEBAR */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#3A1710] text-[#FFF9F5] flex flex-col z-40 border-r border-[#CA340A]/15 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } shadow-xl md:shadow-none shrink-0`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-[#FFF9F5] p-1.5 flex items-center justify-center shadow-md">
              <Image src="/logo.png" alt="Spiral Cafe" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-base tracking-tight text-[#FFF9F5]">
                SPIRAL CAFE
              </h1>
              <p className="text-[11px] text-[#E2C7BA] tracking-wide uppercase font-semibold">
                Operations POS
              </p>
            </div>
          </Link>
        </div>

        {/* Live Status Pill */}
        <div className="px-5 py-2.5 bg-[#2C1710]/60 border-b border-white/5 flex items-center justify-between text-xs text-[#E2C7BA]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className="font-semibold">{isConnected ? "System Live" : "Connecting..."}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#CA340A]/30 text-white font-bold">
            v2.4
          </span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all group cursor-pointer relative z-10 ${
                  isActive
                    ? "bg-[#CA340A] text-white shadow-md shadow-[#CA340A]/30 font-bold"
                    : "text-[#E2C7BA] hover:bg-[#2C1710] hover:text-[#FFF9F5]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={`${
                      isActive ? "text-white" : "text-[#E2C7BA] group-hover:text-[#CA340A]"
                    } transition-colors`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.href === "/admin/orders" && liveOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white animate-bounce">
                    +{liveOrdersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom User Bar */}
        <div className="p-4 border-t border-white/10 bg-[#2C1710]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#CA340A] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
              {adminUser.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-[#FFF9F5] truncate">{adminUser}</p>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#E2C7BA] font-mono">
                  {adminRole}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out of admin console"
            className="p-2 rounded-lg text-[#E2C7BA] hover:bg-red-950/80 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* TOP DESKTOP BAR */}
        <header className="hidden md:flex bg-white border-b border-[#CA340A]/10 px-8 py-3.5 items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-heading font-extrabold text-lg text-[#2C1710]">
                Spiral Cafe Management
              </h2>
              <p className="text-xs text-[#52525b]">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/kitchen"
              target="_blank"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#CA340A]/30 bg-[#FFF9F5] text-[#CA340A] text-xs font-bold hover:bg-[#CA340A] hover:text-white transition-all shadow-xs"
            >
              <ChefHat size={15} />
              <span>Launch KDS Screen</span>
            </Link>

            <Link
              href="/menu"
              target="_blank"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2C1710] text-white text-xs font-bold hover:bg-[#3A1710] transition-all shadow-xs"
            >
              <UtensilsCrossed size={14} />
              <span>Customer Menu</span>
            </Link>

            <div className="h-6 w-[1px] bg-zinc-200 mx-1" />

            <div className="flex items-center gap-2 text-xs font-semibold text-[#2C1710]">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Connected</span>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
