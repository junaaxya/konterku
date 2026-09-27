import Link from "next/link"

import { listAccounts } from "@/features/accounts/account-ledger"
import { listCustomers } from "@/features/receivables/receivable-service"
import { listProducts } from "@/features/inventory/inventory-service"
import { CounterTransactionFlow } from "./flow"

export const dynamic = "force-dynamic"

export default async function NewCounterTransactionPage() {
  const [accounts, customers, products] = await Promise.all([
    listAccounts({ activeOnly: true }),
    listCustomers(),
    listProducts(true),
  ])

  return (
    <main className="container">
      <div style={{ marginBottom: "1.25rem" }}>
        <p className="eyebrow">OPERASIONAL · TRANSAKSI BARU</p>
        <h1 className="page-title">Transaksi Konter</h1>
        <p className="page-desc">
          Catat transaksi pulsa, transfer bank, tarik tunai, top up e-wallet, dan produk lainnya.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: "2.5rem 1rem", maxWidth: "32rem", margin: "0 auto" }}>
          <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>⚠️</span>
          <strong style={{ color: "var(--ink)", display: "block" }}>Belum ada akun aktif</strong>
          <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.875rem" }}>
            Silakan buat atau aktifkan akun kas / bank terlebih dahulu untuk memproses transaksi.
          </p>
          <Link href="/accounts" className="btn btn-primary">
            Kelola Akun Kas
          </Link>
        </div>
      ) : (
        <CounterTransactionFlow
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
          }))}
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
          }))}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            stockQuantity: p.stockQuantity,
            sellingPrice: p.sellingPrice.toString(),
            averageCost: p.averageCost.toString(),
          }))}
        />
      )}
    </main>
  )
}
