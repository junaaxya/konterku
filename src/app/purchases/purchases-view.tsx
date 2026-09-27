"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Plus,
  MagnifyingGlass,
  ArrowRight,
  Receipt,
  Users,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"

export type SerializedPurchase = {
  readonly id: string
  readonly purchaseNumber: string
  readonly supplierId: string
  readonly supplierName: string
  readonly totalAmount: string
  readonly isCredit: boolean
  readonly status: string
  readonly occurredAt: string
  readonly payable: {
    readonly id: string
    readonly status: string
    readonly remainingAmount: string
    readonly dueDate: string | null
  } | null
  readonly itemCount: number
}

type Props = {
  readonly purchases: readonly SerializedPurchase[]
}

export function PurchasesView({ purchases }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"ALL" | "CASH" | "CREDIT">("ALL")

  const filtered = purchases.filter((p) => {
    const q = searchQuery.toLowerCase()
    const matchesQuery =
      p.purchaseNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q)

    if (!matchesQuery) return false

    if (filterType === "CASH") return !p.isCredit
    if (filterType === "CREDIT") return p.isCredit
    return true
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="eyebrow">PENGADAAN & STOK MASUK</p>
          <h1 className="page-title">Faktur Pembelian Supplier</h1>
          <p className="page-desc">Catat pembelian barang dari distributor secara tunai maupun tempo (hutang).</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/suppliers"
            className="btn btn-secondary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Users size={18} />
            <span>Kelola Supplier</span>
          </Link>
          <Link
            href="/purchases/new"
            className="btn btn-primary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Plus size={18} weight="bold" />
            <span>Pembelian Baru</span>
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <MagnifyingGlass
            size={18}
            style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
          />
          <input
            type="text"
            placeholder="Cari nomor pembelian atau supplier..."
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "2.25rem", minHeight: "44px" }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            className={`btn ${filterType === "ALL" ? "btn-primary" : "btn-secondary"}`}
            style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
            onClick={() => setFilterType("ALL")}
          >
            Semua ({purchases.length})
          </button>
          <button
            type="button"
            className={`btn ${filterType === "CASH" ? "btn-primary" : "btn-secondary"}`}
            style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
            onClick={() => setFilterType("CASH")}
          >
            Tunai
          </button>
          <button
            type="button"
            className={`btn ${filterType === "CREDIT" ? "btn-primary" : "btn-secondary"}`}
            style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
            onClick={() => setFilterType("CREDIT")}
          >
            Tempo (Hutang)
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
          <Receipt size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
          <strong style={{ display: "block", color: "var(--ink)", marginBottom: "0.25rem" }}>
            {searchQuery ? "Pembelian tidak ditemukan" : "Belum ada catatan pembelian"}
          </strong>
          <p style={{ fontSize: "0.875rem", margin: 0 }}>
            {searchQuery
              ? "Coba gunakan kata kunci pencarian lain."
              : "Klik tombol 'Pembelian Baru' untuk mencatat faktur pembelian barang."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((p) => {
            const isCancelled = p.status === "CANCELLED"
            const total = BigInt(p.totalAmount)

            return (
              <Link
                key={p.id}
                href={`/purchases/${p.id}`}
                className="card"
                style={{
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  textDecoration: "none",
                  color: "inherit",
                  minHeight: "44px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.9375rem", color: "var(--ink)" }}>{p.purchaseNumber}</strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                        background: isCancelled ? "var(--rose-bg)" : "var(--emerald-bg)",
                        color: isCancelled ? "var(--rose)" : "var(--emerald)",
                      }}
                    >
                      {isCancelled ? "BATAL" : "SELESAI"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                        background: "var(--paper)",
                        color: "var(--slate-fg)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      {p.isCredit ? "Tempo (Hutang)" : "Tunai"}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                    <span>Supplier: <strong style={{ color: "var(--ink)" }}>{p.supplierName}</strong></span> ·{" "}
                    <span>{new Date(p.occurredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span> ·{" "}
                    <span>{p.itemCount} jenis produk</span>
                  </div>

                  {p.payable && (
                    <div style={{ fontSize: "0.75rem", color: p.payable.status === "PAID" ? "var(--emerald)" : "var(--rose)" }}>
                      Status Hutang: <strong>{p.payable.status}</strong> (Sisa: {formatRupiah(BigInt(p.payable.remainingAmount))})
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Total Pembelian</span>
                    <strong style={{ fontSize: "1.125rem", color: isCancelled ? "var(--muted)" : "var(--ink)" }}>
                      {formatRupiah(total)}
                    </strong>
                  </div>
                  <ArrowRight size={18} color="var(--muted)" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
