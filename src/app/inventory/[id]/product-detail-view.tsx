"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  PencilSimple,
  SlidersHorizontal,
  WarningCircle,
  CheckCircle,
  ClockCounterClockwise,
  ToggleLeft,
  ToggleRight,
  Plus,
  Minus,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import {
  updateProductAction,
  toggleProductActiveAction,
  recordAdjustmentAction,
} from "../actions"

export type SerializedMovement = {
  readonly id: string
  readonly type: string
  readonly quantityChange: number
  readonly unitCost: string
  readonly totalCost: string
  readonly occurredAt: string
  readonly notes: string | null
  readonly transactionId: string | null
  readonly supplierPurchaseNumber: string | null
}

export type DetailedProduct = {
  readonly id: string
  readonly sku: string | null
  readonly name: string
  readonly unit: string
  readonly stockQuantity: number
  readonly inventoryValue: string
  readonly averageCost: string
  readonly sellingPrice: string
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly movements: readonly SerializedMovement[]
}

type Props = {
  readonly product: DetailedProduct
}

export function ProductDetailView({ product }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"MOVEMENTS" | "EDIT" | "ADJUST">("MOVEMENTS")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)

  const [adjustDirection, setAdjustDirection] = useState<"INCREASE" | "DECREASE">("INCREASE")

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateProductAction(product.id, formData)
      if (res.success) {
        setSuccessMsg("Informasi produk berhasil diperbarui.")
        router.refresh()
        setActiveTab("MOVEMENTS")
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const handleToggleActive = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setShowStatusConfirm(false)

    startTransition(async () => {
      const res = await toggleProductActiveAction(product.id, !product.isActive)
      if (res.success) {
        setSuccessMsg(
          res.data.isActive
            ? "Produk berhasil diaktifkan kembali."
            : "Produk berhasil dinonaktifkan dari katalog operasional.",
        )
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const handleAdjustStock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    const formData = new FormData(e.currentTarget)
    formData.set("direction", adjustDirection)

    startTransition(async () => {
      const res = await recordAdjustmentAction(product.id, formData)
      if (res.success) {
        setSuccessMsg("Penyesuaian stok berhasil dicatat.")
        router.refresh()
        setActiveTab("MOVEMENTS")
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const stockValuation = BigInt(product.inventoryValue)
  const avgCost = BigInt(product.averageCost)
  const salePrice = BigInt(product.sellingPrice)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link
          href="/inventory"
          className="btn btn-secondary"
          style={{ minHeight: "44px", minWidth: "44px", padding: "0.5rem", display: "grid", placeItems: "center" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>DETAIL PRODUK</p>
          <h1 className="page-title" style={{ margin: 0 }}>{product.name}</h1>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "var(--rose-bg)", color: "var(--rose)", padding: "0.75rem 1rem", borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <WarningCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: "var(--emerald-bg)", color: "var(--emerald)", padding: "0.75rem 1rem", borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <CheckCircle size={20} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Kuantitas Stok</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: product.stockQuantity > 0 ? "var(--ink)" : "var(--rose)" }}>
            {product.stockQuantity} {product.unit}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Valuasi Inventaris</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--primary-dark)" }}>
            {formatRupiah(stockValuation)}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Rata-rata Modal</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--ink)" }}>
            {formatRupiah(avgCost)}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Harga Jual</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--ink)" }}>
            {formatRupiah(salePrice)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", overflowX: "auto" }}>
        <button
          type="button"
          className={`btn ${activeTab === "MOVEMENTS" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
          onClick={() => setActiveTab("MOVEMENTS")}
        >
          <ClockCounterClockwise size={18} />
          <span>Riwayat Mutasi ({product.movements.length})</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "ADJUST" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
          onClick={() => setActiveTab("ADJUST")}
        >
          <SlidersHorizontal size={18} />
          <span>Sesuaikan Stok</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "EDIT" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
          onClick={() => setActiveTab("EDIT")}
        >
          <PencilSimple size={18} />
          <span>Edit Produk</span>
        </button>
      </div>

      {activeTab === "MOVEMENTS" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Riwayat Mutasi Stok</h2>
          {product.movements.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>Belum ada riwayat mutasi untuk produk ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {product.movements.map((m) => {
                const isPositive = m.quantityChange > 0
                const cost = BigInt(m.totalCost)
                const unit = BigInt(m.unitCost)

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.125rem 0.5rem",
                            borderRadius: "4px",
                            background: isPositive ? "var(--emerald-bg)" : "var(--rose-bg)",
                            color: isPositive ? "var(--emerald)" : "var(--rose)",
                          }}
                        >
                          {m.type}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {new Date(m.occurredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.8125rem", color: "var(--ink)" }}>
                        {m.notes || (m.supplierPurchaseNumber ? `Pembelian ${m.supplierPurchaseNumber}` : "Mutasi stok")}
                      </span>
                      {unit > 0n && (
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          @ {formatRupiah(unit)} / unit
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "1.125rem",
                          fontWeight: 700,
                          color: isPositive ? "var(--emerald)" : "var(--rose)",
                          display: "block",
                        }}
                      >
                        {isPositive ? `+${m.quantityChange}` : m.quantityChange} {product.unit}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Nilai: {formatRupiah(cost)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "ADJUST" && (
        <div className="card" style={{ padding: "1.25rem", maxWidth: "36rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem" }}>Penyesuaian Stok Manual (Adjustment)</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Gunakan fitur ini untuk rekonsiliasi opname fisik, barang rusak/hilang, atau koreksi hitungan.
          </p>

          <form onSubmit={handleAdjustStock} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="label">Arah Penyesuaian</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={`btn ${adjustDirection === "INCREASE" ? "btn-primary" : "btn-secondary"}`}
                  style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                  onClick={() => setAdjustDirection("INCREASE")}
                >
                  <Plus size={16} weight="bold" />
                  <span>Tambah Stok (+)</span>
                </button>
                <button
                  type="button"
                  className={`btn ${adjustDirection === "DECREASE" ? "btn-primary" : "btn-secondary"}`}
                  style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                  onClick={() => setAdjustDirection("DECREASE")}
                >
                  <Minus size={16} weight="bold" />
                  <span>Kurangi Stok (-)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="adjust-quantity">
                Jumlah Unit ({product.unit}) <span style={{ color: "var(--rose)" }}>*</span>
              </label>
              <input
                id="adjust-quantity"
                name="quantity"
                type="number"
                required
                min="1"
                step="1"
                placeholder="Contoh: 5"
                className="input-field"
                style={{ minHeight: "44px" }}
              />
            </div>

            {adjustDirection === "INCREASE" && (
              <div>
                <label className="label" htmlFor="adjust-unit-cost">
                  Biaya Modal Per Unit (Opsional)
                </label>
                <input
                  id="adjust-unit-cost"
                  name="unitCost"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={`Kosongkan untuk gunakan modal rata-rata (${product.averageCost})`}
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="adjust-notes">
                Alasan / Catatan Penyesuaian <span style={{ color: "var(--rose)" }}>*</span>
              </label>
              <input
                id="adjust-notes"
                name="notes"
                type="text"
                required
                placeholder="Contoh: Hasil stok opname akhir bulan / Barang rusak"
                className="input-field"
                style={{ minHeight: "44px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: "44px" }}
                onClick={() => setActiveTab("MOVEMENTS")}
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
                {isPending ? "Menyimpan..." : "Simpan Penyesuaian"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "EDIT" && (
        <div className="card" style={{ padding: "1.25rem", maxWidth: "36rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1rem" }}>Edit Informasi Operasional</h2>

          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="label" htmlFor="edit-name">
                Nama Produk <span style={{ color: "var(--rose)" }}>*</span>
              </label>
              <input
                id="edit-name"
                name="name"
                type="text"
                required
                defaultValue={product.name}
                className="input-field"
                style={{ minHeight: "44px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="label" htmlFor="edit-sku">Kode / SKU</label>
                <input
                  id="edit-sku"
                  name="sku"
                  type="text"
                  defaultValue={product.sku || ""}
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-unit">Satuan</label>
                <input
                  id="edit-unit"
                  name="unit"
                  type="text"
                  required
                  defaultValue={product.unit}
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="edit-price">
                Harga Jual (Rp) <span style={{ color: "var(--rose)" }}>*</span>
              </label>
              <input
                id="edit-price"
                name="sellingPrice"
                type="number"
                required
                min="0"
                step="1"
                defaultValue={product.sellingPrice}
                className="input-field"
                style={{ minHeight: "44px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
              <button
                type="button"
                className={`btn ${product.isActive ? "btn-secondary" : "btn-primary"}`}
                style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                onClick={() => setShowStatusConfirm(true)}
                disabled={isPending}
              >
                {product.isActive ? (
                  <>
                    <ToggleLeft size={20} color="var(--rose)" />
                    <span style={{ color: "var(--rose)" }}>Nonaktifkan Produk</span>
                  </>
                ) : (
                  <>
                    <ToggleRight size={20} color="var(--emerald)" />
                    <span>Aktifkan Produk</span>
                  </>
                )}
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: "44px" }}
                  onClick={() => setActiveTab("MOVEMENTS")}
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
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showStatusConfirm && (
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
          <div className="card" style={{ width: "100%", maxWidth: "28rem", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              {product.isActive ? "Nonaktifkan Produk?" : "Aktifkan Kembali Produk?"}
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
              {product.isActive
                ? "Produk yang dinonaktifkan tidak akan muncul pada daftar pilihan penjualan kasir, namun seluruh saldo aset dan riwayat stok tetap aman tercatat."
                : "Produk akan kembali aktif dan dapat dipilih dalam transaksi penjualan."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: "44px" }}
                onClick={() => setShowStatusConfirm(false)}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                type="button"
                className={`btn ${product.isActive ? "btn-secondary" : "btn-primary"}`}
                style={{ minHeight: "44px", color: product.isActive ? "var(--rose)" : undefined }}
                onClick={handleToggleActive}
                disabled={isPending}
              >
                {isPending ? "Memproses..." : product.isActive ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
