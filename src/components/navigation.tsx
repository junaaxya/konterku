"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChartBar,
  ChartLineUp,
  HandCoins,
  Lightning,
  Package,
  Receipt,
  Truck,
  Wallet,
  WifiHigh,
} from "@phosphor-icons/react"

export type NavItemKey =
  | "dashboard"
  | "transaksi"
  | "riwayat"
  | "inventaris"
  | "pembelian"
  | "hutang-piutang"
  | "laporan"
  | "akun"

export function isNavActive(itemKey: NavItemKey, pathname: string): boolean {
  switch (itemKey) {
    case "dashboard":
      return pathname === "/"

    case "transaksi":
      return (
        pathname === "/transactions/new" ||
        pathname.startsWith("/transactions/new/") ||
        pathname === "/transactions/income" ||
        pathname.startsWith("/transactions/income/") ||
        pathname === "/transactions/expense" ||
        pathname.startsWith("/transactions/expense/")
      )

    case "riwayat":
      if (
        pathname === "/transactions/new" ||
        pathname.startsWith("/transactions/new/") ||
        pathname === "/transactions/income" ||
        pathname.startsWith("/transactions/income/") ||
        pathname === "/transactions/expense" ||
        pathname.startsWith("/transactions/expense/")
      ) {
        return false
      }
      return pathname === "/transactions" || pathname.startsWith("/transactions/")

    case "inventaris":
      return pathname === "/inventory" || pathname.startsWith("/inventory/")

    case "pembelian":
      return (
        pathname === "/purchases" ||
        pathname.startsWith("/purchases/") ||
        pathname === "/suppliers" ||
        pathname.startsWith("/suppliers/")
      )

    case "hutang-piutang":
      return pathname === "/debts-receivables" || pathname.startsWith("/debts-receivables/")

    case "laporan":
      return pathname === "/reports" || pathname.startsWith("/reports/")

    case "akun":
      return pathname === "/accounts" || pathname.startsWith("/accounts/")

    default:
      return false
  }
}

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: ChartLineUp },
  { key: "transaksi", label: "Transaksi", href: "/transactions/new", icon: Lightning },
  { key: "riwayat", label: "Riwayat", href: "/transactions", icon: Receipt },
  { key: "inventaris", label: "Inventaris", href: "/inventory", icon: Package },
  { key: "pembelian", label: "Pembelian", href: "/purchases", icon: Truck },
  { key: "hutang-piutang", label: "Hutang", href: "/debts-receivables", icon: HandCoins },
  { key: "laporan", label: "Laporan", href: "/reports", icon: ChartBar },
  { key: "akun", label: "Akun", href: "/accounts", icon: Wallet },
] as const

export function Navigation() {
  const pathname = usePathname()

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">K</span>
            <div className="brand-text">
              <span className="brand-name">KONTERKU</span>
              <span className="brand-subtitle">Keuangan Konter Lokal</span>
            </div>
          </Link>

          <nav className="desktop-nav" aria-label="Navigasi Desktop">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = isNavActive(item.key, pathname)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`nav-link ${isActive ? "active" : ""}`}
                >
                  <span className="nav-icon">
                    <Icon size={18} weight={isActive ? "bold" : "regular"} />
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="header-actions">
            <span className="badge-online" style={{ background: "var(--paper)", color: "var(--slate-fg)", border: "1px solid var(--line)" }}>
              <WifiHigh size={14} weight="bold" color="var(--slate-fg)" />
              Mode Lokal
            </span>
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Navigasi Mobile">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isNavActive(item.key, pathname)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`bottom-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="bottom-nav-icon">
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

