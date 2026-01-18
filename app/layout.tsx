import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import TrackingProvider from "@/components/TrackingProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUXE Apparel | Premium Fashion",
  description: "Discover premium fashion at LUXE Apparel. Shop our curated collection of modern, sophisticated clothing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TrackingProvider>
          <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="text-2xl font-bold tracking-tight">
                LUXE
              </Link>
              <div className="flex items-center gap-8">
                <Link href="/" className="text-sm font-medium hover:text-gray-600 transition-colors">
                  Home
                </Link>
                <Link href="/products" className="text-sm font-medium hover:text-gray-600 transition-colors">
                  Products
                </Link>
                <Link href="/checkout" className="text-sm font-medium hover:text-gray-600 transition-colors">
                  Cart (0)
                </Link>
              </div>
            </div>
          </nav>
          <main className="pt-16">
            {children}
          </main>
          <footer className="bg-gray-900 text-white py-12 mt-20">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">LUXE</h3>
                  <p className="text-gray-400">Premium fashion for the modern individual.</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-4">Quick Links</h4>
                  <div className="flex flex-col gap-2 text-gray-400">
                    <Link href="/" className="hover:text-white transition-colors">Home</Link>
                    <Link href="/products" className="hover:text-white transition-colors">Products</Link>
                    <Link href="/checkout" className="hover:text-white transition-colors">Checkout</Link>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-4">Contact</h4>
                  <p className="text-gray-400">hello@luxeapparel.com</p>
                  <p className="text-gray-400">1-800-LUXE</p>
                </div>
              </div>
              <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
                © 2026 LUXE Apparel. All rights reserved.
              </div>
            </div>
          </footer>
        </TrackingProvider>
      </body>
    </html>
  );
}
