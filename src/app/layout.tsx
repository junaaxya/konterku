import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "KONTERKU — Pencatatan Keuangan Konter",
  description: "Ruang kerja dan pencatatan keuangan konter lokal.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
