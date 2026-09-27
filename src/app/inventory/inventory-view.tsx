"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Package,
  Plus,
  MagnifyingGlass,
  X,
  WarningCircle,
  ArrowRight,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import { createProductAction } from "./actions"

export type SerializedProduct = {
  readonly id: string
  readonly sku: string | null
  readonly name: string
  readonly unit: string
  readonly stockQuantity: number
  readonly inventoryValue: string
  readonly averageCost: string
  readonly sellingPrice: string
  readonly isActive: boolean
  readonly updatedAt: string
}

type Props = {
  readonly products: readonly SerializedProduct[]
}

export function InventoryView({ products }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OUT_OF_STOCK" | "INACTIVE">("ALL")
  const [formError, setFormError] = useState<string | null>(null)

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false

    if (statusFilter === "ACTIVE") return p.isActive && p.stockQuantity > 0
    if (statusFilter === "OUT_OF_STOCK") return p.isActive && p.stockQuantity === 0
    if (statusFilter === "INACTIVE") return !p.isActive
    return true
  })

  const totalStockUnits = products.reduce((acc, p) => acc + p.stockQuantity, 0)
  const totalValuation = products.reduce((acc, p) => acc + BigInt(p.inventoryValue), 0n)

  const handleSubmitNewProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createProductAction(formData)
      if (res.success) {
        setShowAddModal(false)
        router.push(`/inventory/${res.data.id}`)
      } else {
        setFormError(res.error)
      }
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="eyebrow">MANAJEMEN STOK · BARANG DAGANGAN</p>
          <h1 className="page-title">Inventaris Produk</h1>
          <p className="page-desc">Kelola katalog produk fisik, kuantitas stok, dan valuasi aset riil konter.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => {
            setFormError(null)
            setShowAddModal(true)
          }}
        >
          <Plus size={18} weight="bold" />
          <span>Tambah Produk</span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Total Produk</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--ink)" }}>{products.length} SKU</p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Kuantitas Fisik</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--ink)" }}>{totalStockUnits} Unit</p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Valuasi Stok Riil</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--primary-dark)" }}>
            {formatRupiah(totalValuation)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <MagnifyingGlass
              size={18}
              style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
            />
            <input
              type="text"
              placeholder="Cari nama produk atau SKU..."
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2.25rem", minHeight: "44px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn ${statusFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
              style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
              onClick={() => setStatusFilter("ALL")}
            >
              Semua ({products.length})
            </button>
            <button
              type="button"
              className={`btn ${statusFilter === "ACTIVE" ? "btn-primary" : "btn-secondary"}`}
              style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
              onClick={() => setStatusFilter("ACTIVE")}
            >
              Ada Stok
            </button>
            <button
              type="button"
              className={`btn ${statusFilter === "OUT_OF_STOCK" ? "btn-primary" : "btn-secondary"}`}
              style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
              onClick={() => setStatusFilter("OUT_OF_STOCK")}
            >
              Habis
            </button>
            <button
              type="button"
              className={`btn ${statusFilter === "INACTIVE" ? "btn-primary" : "btn-secondary"}`}
              style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
              onClick={() => setStatusFilter("INACTIVE")}
            >
              Nonaktif
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
            <Package size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
            <strong style={{ display: "block", color: "var(--ink)", marginBottom: "0.25rem" }}>
              {searchQuery || statusFilter !== "ALL" ? "Tidak ada produk yang cocok" : "Belum ada produk terdaftar"}
            </strong>
            <p style={{ fontSize: "0.875rem", margin: 0 }}>
              {searchQuery || statusFilter !== "ALL"
                ? "Coba ubah kata kunci pencarian atau filter status."
                : "Klik tombol 'Tambah Produk' untuk mulai mencatat stok barang dagangan."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filteredProducts.map((p) => {
              const val = BigInt(p.inventoryValue)
              const avg = BigInt(p.averageCost)
              const price = BigInt(p.sellingPrice)

              return (
                <Link
                  key={p.id}
                  href={`/inventory/${p.id}`}
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
                    transition: "border-color 0.15s, background-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>{p.name}</strong>
                      {p.sku && (
                        <span style={{ fontSize: "0.6875rem", background: "var(--paper)", color: "var(--muted)", padding: "0.125rem 0.375rem", borderRadius: "4px", border: "1px solid var(--line)" }}>
                          SKU: {p.sku}
                        </span>
                      )}
                      {!p.isActive ? (
                        <span style={{ fontSize: "0.6875rem", background: "var(--rose-bg)", color: "var(--rose)", padding: "0.125rem 0.375rem", borderRadius: "4px", fontWeight: 600 }}>
                          Nonaktif
                        </span>
                      ) : p.stockQuantity === 0 ? (
                        <span style={{ fontSize: "0.6875rem", background: "var(--amber-bg)", color: "var(--amber)", padding: "0.125rem 0.375rem", borderRadius: "4px", fontWeight: 600 }}>
                          Habis
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.6875rem", background: "var(--emerald-bg)", color: "var(--emerald)", padding: "0.125rem 0.375rem", borderRadius: "4px", fontWeight: 600 }}>
                          Aktif
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8125rem", color: "var(--muted)" }}>
                      <span>Jual: <strong style={{ color: "var(--ink)" }}>{formatRupiah(price)}</strong></span>
                      <span>Modal rata-rata: <strong style={{ color: "var(--ink)" }}>{formatRupiah(avg)}</strong></span>
                      <span>Valuasi: <strong style={{ color: "var(--primary-dark)" }}>{formatRupiah(val)}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Stok</span>
                      <strong style={{ fontSize: "1.125rem", color: p.stockQuantity > 0 ? "var(--ink)" : "var(--rose)" }}>
                        {p.stockQuantity} {p.unit}
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

      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: "32rem", padding: "1.5rem", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Tambah Produk Baru</h2>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem", minHeight: "44px", minWidth: "44px", display: "grid", placeItems: "center" }}
                onClick={() => setShowAddModal(false)}
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ background: "var(--rose-bg)", color: "var(--rose)", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", display: "flex", gap: "0.5rem" }}>
                <WarningCircle size={18} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNewProduct} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="label" htmlFor="product-name">
                  Nama Produk <span style={{ color: "var(--rose)" }}>*</span>
                </label>
                <input
                  id="product-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Contoh: Kabel Data Type-C 1M"
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label className="label" htmlFor="product-sku">Kode / SKU</label>
                  <input
                    id="product-sku"
                    name="sku"
                    type="text"
                    placeholder="Contoh: KBL-001"
                    className="input-field"
                    style={{ minHeight: "44px" }}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="product-unit">Satuan</label>
                  <input
                    id="product-unit"
                    name="unit"
                    type="text"
                    defaultValue="pcs"
                    placeholder="pcs, box, rim"
                    className="input-field"
                    style={{ minHeight: "44px" }}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="product-price">
                  Harga Jual (Rp) <span style={{ color: "var(--rose)" }}>*</span>
                </label>
                <input
                  id="product-price"
                  name="sellingPrice"
                  type="number"
                  required
                  min="0"
                  step="1"
                  placeholder="Contoh: 25000"
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                  Saldo Awal Stok (Opsional)
                </span>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="label" htmlFor="product-stock">Jumlah Stok Awal</label>
                    <input
                      id="product-stock"
                      name="initialStock"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue="0"
                      className="input-field"
                      style={{ minHeight: "44px" }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="product-cost">Biaya Modal / Unit (Rp)</label>
                    <input
                      id="product-cost"
                      name="initialCost"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue="0"
                      className="input-field"
                      style={{ minHeight: "44px" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: "44px" }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isPending}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minHeight: "44px" }}
                  disabled={isPending}
                >
                  {isPending ? "Menyimpan..." : "Simpan Produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
