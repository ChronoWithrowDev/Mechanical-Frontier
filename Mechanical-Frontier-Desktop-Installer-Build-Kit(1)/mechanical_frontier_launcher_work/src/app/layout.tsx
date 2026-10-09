import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mechanical Frontier — Walsenburg Field Guide",
  description: "An interactive three-dimensional adventure in Walsenburg, Colorado. Find the glass tower, ride down to Lizard Town, and explore 100 gadget-filled rooms.",
  applicationName: "Mechanical Frontier",
};

export const viewport: Viewport = {
  themeColor: "#0a1114",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
