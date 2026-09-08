import type { ReactNode } from "react";
import { Fraunces } from "next/font/google";
import "./globals.css";

/** A soft, editorial serif for display moments only (greetings, hero
 *  headings, the wordmark) — paired with the plain system sans everywhere
 *  else. Self-hosted at build time by next/font (no runtime CDN call). */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "AIIMS+",
  description: "India-first, multi-tenant Hospital Operating System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
