import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { CartProvider } from "@/context/CartContext";
import FloatingCartBar from "@/components/Menu/FloatingCartBar";
import CartOrdersSheet from "@/components/Menu/CartOrdersSheet";
import CustomerPhoneModal from "@/components/Menu/CustomerPhoneModal";
import CustomerSessionProtection from "@/components/Menu/CustomerSessionProtection";

export const metadata: Metadata = {
  title: "Spiral Cafe - Rooftop Dining & Digital Menu",
  description: "Explore gourmet Smash Burgers, Wings, Sandos, Creamy Pastas, Specialty Coffees, Coolers & Shakes at Spiral Cafe, Chengalpattu.",
  icons: {
    icon: "/logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
      <body
        className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-primary/20"
      >
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
