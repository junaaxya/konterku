"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  PencilSimple,
  Truck,
  HandCoins,
  Plus,
  WarningCircle,
  CheckCircle,
  X,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import { updateSupplierAction } from "../actions"

export type SerializedSupplierHistory = {
  readonly id: string
  readonly name: string
  readonly phone: string | null
  readonly notes: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly purchases: readonly {
    readonly id: string
    readonly purchaseNumber: string
    readonly totalAmount: string
    readonly isCredit: boolean
    readonly status: string
    readonly occurredAt: string
    readonly itemCount: number
  }[]
  readonly payables: readonly {
    readonly id: string
    readonly payableNumber: string
    readonly totalAmount: string
    readonly paidAmount: string
    readonly remainingAmount: string
    readonly status: string
    readonly dueDate: string | null
  }[]
}

type Props = {
  readonly supplier: SerializedSupplierHistory
}

export function SupplierDetailView({ supplier }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showEditModal, setShowEditModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"PURCHASES" | "PAYABLES">("PURCHASES")

  const totalPurchasesAmount = supplier.purchases
    .filter((p) => p.status === "COMPLETED")
    .reduce((acc, p) => acc + BigInt(p.totalAmount), 0n)

  const totalOutstandingPayables = supplier.payables
    .filter((p) => p.status === "OPEN" || p.status === "PARTIAL")
    .reduce((acc, p) => acc + BigInt(p.remainingAmount), 0n)

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateSupplierAction(supplier.id, formData)
      if (res.success) {
        setSuccessMsg("Informasi supplier berhasil diperbarui.")
        setShowEditModal(false)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link
            href="/suppliers"
            className="btn btn-secondary"
            style={{ minHeight: "44px", minWidth: "44px", padding: "0.5rem", display: "grid", placeItems: "center" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>DETAIL MITRA</p>
            <h1 className="page-title" style={{ margin: 0 }}>{supplier.name}</h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            onClick={() => {
              setErrorMsg(null)
              setShowEditModal(true)
            }}
          >
            <PencilSimple size={18} />
            <span>Edit Supplier</span>
          </button>
          <Link
            href={`/purchases/new?supplierId=${supplier.id}`}
            className="btn btn-primary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Plus size={18} weight="bold" />
            <span>Buat Pembelian</span>
          </Link>
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
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Total Volume Pembelian</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--ink)" }}>
            {formatRupiah(totalPurchasesAmount)}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Sisa Hutang Berjalan</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: totalOutstandingPayables > 0n ? "var(--rose)" : "var(--emerald)" }}>
            {formatRupiah(totalOutstandingPayables)}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Kontak & Info</span>
          <div style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span>{supplier.phone || "Tidak ada nomor telepon"}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{supplier.notes || "Tidak ada catatan"}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          className={`btn ${activeTab === "PURCHASES" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => setActiveTab("PURCHASES")}
        >
          <Truck size={18} />
          <span>Riwayat Pembelian ({supplier.purchases.length})</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "PAYABLES" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => setActiveTab("PAYABLES")}
        >
          <HandCoins size={18} />
          <span>Riwayat Hutang ({supplier.payables.length})</span>
        </button>
      </div>

      {activeTab === "PURCHASES" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Faktur Pembelian</h2>
          {supplier.purchases.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>Belum ada faktur pembelian untuk supplier ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {supplier.purchases.map((p) => {
                const isCancelled = p.status === "CANCELLED"
                return (
                  <Link
                    key={p.id}
                    href={`/purchases/${p.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "inherit",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      minHeight: "44px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ fontSize: "0.9375rem" }}>{p.purchaseNumber}</strong>
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
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {new Date(p.occurredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} · {p.itemCount} jenis produk
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--ink)", display: "block" }}>
                        {formatRupiah(BigInt(p.totalAmount))}
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--primary-dark)" }}>Lihat Rincian</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "PAYABLES" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Kewajiban Hutang Usaha</h2>
          {supplier.payables.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>Tidak ada catatan hutang untuk supplier ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {supplier.payables.map((py) => {
                const remaining = BigInt(py.remainingAmount)
                const isPaid = py.status === "PAID"
                const isCancelled = py.status === "CANCELLED"

                return (
                  <div
                    key={py.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ fontSize: "0.9375rem" }}>{py.payableNumber}</strong>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            padding: "0.125rem 0.375rem",
                            borderRadius: "4px",
                            background: isPaid ? "var(--emerald-bg)" : isCancelled ? "var(--paper)" : "var(--amber-bg)",
                            color: isPaid ? "var(--emerald)" : isCancelled ? "var(--muted)" : "var(--amber)",
                          }}
                        >
                          {py.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        <span>Total: {formatRupiah(BigInt(py.totalAmount))}</span> · <span>Terbayar: {formatRupiah(BigInt(py.paidAmount))}</span>
                        {py.dueDate && <span> · Jatuh tempo: {new Date(py.dueDate).toLocaleDateString("id-ID")}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Sisa Hutang</span>
                      <strong style={{ fontSize: "1rem", color: remaining > 0n ? "var(--rose)" : "var(--emerald)" }}>
                        {formatRupiah(remaining)}
                      </strong>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showEditModal && (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Edit Data Supplier</h2>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem", minHeight: "44px", minWidth: "44px", display: "grid", placeItems: "center" }}
                onClick={() => setShowEditModal(false)}
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="label" htmlFor="edit-supplier-name">
                  Nama Supplier <span style={{ color: "var(--rose)" }}>*</span>
                </label>
                <input
                  id="edit-supplier-name"
                  name="name"
                  type="text"
                  required
                  defaultValue={supplier.name}
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="edit-supplier-phone">Nomor Telepon / WhatsApp</label>
                <input
                  id="edit-supplier-phone"
                  name="phone"
                  type="tel"
                  defaultValue={supplier.phone || ""}
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="edit-supplier-notes">Catatan</label>
                <textarea
                  id="edit-supplier-notes"
                  name="notes"
                  rows={3}
                  defaultValue={supplier.notes || ""}
                  className="input-field"
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: "44px" }}
                  onClick={() => setShowEditModal(false)}
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
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
