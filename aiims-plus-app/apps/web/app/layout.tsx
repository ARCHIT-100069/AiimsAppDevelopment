import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "AIIMS+",
  description: "India-first, multi-tenant Hospital Operating System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
