import type { ReactNode } from "react";

export const metadata = {
  title: "AIIMS+",
  description: "India-first, multi-tenant Hospital Operating System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
