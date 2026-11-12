import type { Metadata, Viewport } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { CartProvider } from "@/context/CartContext";
import FloatingCartBar from "@/components/Menu/FloatingCartBar";
import CartOrdersSheet from "@/components/Menu/CartOrdersSheet";
import CustomerPhoneModal from "@/components/Menu/CustomerPhoneModal";
import CustomerSessionProtection from "@/components/Menu/CustomerSessionProtection";
import PWARegistration from "@/components/PWA/PWARegistration";

export const metadata: Metadata = {
  title: "Spiral Cafe - Rooftop Dining & Digital Menu",
  description: "Explore gourmet Smash Burgers, Wings, Sandos, Creamy Pastas, Specialty Coffees, Coolers & Shakes at Spiral Cafe, Chengalpattu.",
  applicationName: "Spiral Cafe POS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Spiral Cafe POS",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#CA340A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#CA340A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Spiral Cafe POS" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-primary/20"
      >
        <PWARegistration />
        <CartProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
          <CustomerPhoneModal />
          <CustomerSessionProtection />
          <FloatingCartBar />
          <CartOrdersSheet />
        </CartProvider>
      </body>
    </html>
  );
}
