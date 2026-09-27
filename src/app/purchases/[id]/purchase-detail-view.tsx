"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  WarningCircle,
  CheckCircle,
  X,
  XCircle,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import { cancelPurchaseAction } from "../actions"

export type SerializedPurchaseDetail = {
  readonly id: string
  readonly purchaseNumber: string
  readonly supplierId: string
  readonly supplierName: string
  readonly supplierPhone: string | null
  readonly totalAmount: string
  readonly isCredit: boolean
  readonly status: string
  readonly occurredAt: string
  readonly createdAt: string
  readonly payable: {
    readonly id: string
    readonly payableNumber: string
    readonly totalAmount: string
    readonly paidAmount: string
    readonly remainingAmount: string
    readonly status: string
    readonly dueDate: string | null
    readonly payments: readonly {
      readonly id: string
      readonly amount: string
      readonly paymentDate: string
      readonly accountName: string
      readonly notes: string | null
    }[]
  } | null
  readonly movements: readonly {
    readonly id: string
    readonly productId: string
    readonly productName: string
    readonly productSku: string | null
    readonly productUnit: string
    readonly quantity: number
    readonly unitCost: string
    readonly totalCost: string
  }[]
}

type Props = {
  readonly purchase: SerializedPurchaseDetail
}

export function PurchaseDetailView({ purchase }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isCancelled = purchase.status === "CANCELLED"
  const total = BigInt(purchase.totalAmount)

  const handleCancel = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setShowCancelModal(false)

    startTransition(async () => {
      const res = await cancelPurchaseAction(purchase.id, cancelReason || undefined)
      if (res.success) {
        setSuccessMsg("Faktur pembelian berhasil dibatalkan dan stok dikembalikan.")
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
            href="/purchases"
            className="btn btn-secondary"
            style={{ minHeight: "44px", minWidth: "44px", padding: "0.5rem", display: "grid", placeItems: "center" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>FAKTUR PEMBELIAN</p>
            <h1 className="page-title" style={{ margin: 0 }}>{purchase.purchaseNumber}</h1>
          </div>
        </div>

        {!isCancelled && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: "44px", color: "var(--rose)", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            onClick={() => {
              setErrorMsg(null)
              setShowCancelModal(true)
            }}
            disabled={isPending}
          >
            <XCircle size={18} />
            <span>Batalkan Pembelian</span>
          </button>
        )}
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
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Status Faktur</span>
          <div style={{ marginTop: "0.25rem" }}>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                background: isCancelled ? "var(--rose-bg)" : "var(--emerald-bg)",
                color: isCancelled ? "var(--rose)" : "var(--emerald)",
                display: "inline-block",
              }}
            >
              {isCancelled ? "DIBATALKAN" : "SELESAI (COMPLETED)"}
            </span>
          </div>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Total Nilai</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: isCancelled ? "var(--muted)" : "var(--ink)" }}>
            {formatRupiah(total)}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Metode Pembayaran</span>
          <p style={{ fontSize: "1rem", fontWeight: 600, margin: "0.25rem 0 0", color: "var(--ink)" }}>
            {purchase.isCredit ? "Tempo (Hutang Usaha)" : "Tunai (Kas Keluar)"}
          </p>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Mitra Supplier</span>
          <p style={{ fontSize: "1rem", fontWeight: 600, margin: "0.25rem 0 0", color: "var(--ink)" }}>
            <Link href={`/suppliers/${purchase.supplierId}`} style={{ color: "var(--primary-dark)", textDecoration: "none" }}>
              {purchase.supplierName}
            </Link>
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Daftar Barang Masuk ({purchase.movements.length} Jenis)</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {purchase.movements.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.9375rem" }}>{m.productName}</strong>
                {m.productSku && (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                    SKU: {m.productSku}
                  </span>
                )}
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  {m.quantity} {m.productUnit} @ {formatRupiah(BigInt(m.unitCost))}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Subtotal</span>
                <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>
                  {formatRupiah(BigInt(m.totalCost))}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {purchase.payable && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Informasi Hutang Usaha</h2>
            <Link
              href="/debts-receivables"
              className="btn btn-secondary"
              style={{ minHeight: "44px", fontSize: "0.8125rem", padding: "0 0.75rem" }}
            >
              Buka Hutang & Piutang
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>No. Hutang</span>
              <strong style={{ display: "block" }}>{purchase.payable.payableNumber}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Total Kewajiban</span>
              <strong style={{ display: "block" }}>{formatRupiah(BigInt(purchase.payable.totalAmount))}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Terbayar</span>
              <strong style={{ display: "block", color: "var(--emerald)" }}>{formatRupiah(BigInt(purchase.payable.paidAmount))}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Sisa Hutang</span>
              <strong style={{ display: "block", color: "var(--rose)" }}>{formatRupiah(BigInt(purchase.payable.remainingAmount))}</strong>
            </div>
          </div>

          {purchase.payable.payments.length > 0 && (
            <div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Riwayat Pembayaran Cicilan
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                {purchase.payable.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      background: "var(--paper)",
                      borderRadius: "4px",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div>
                      <span>{new Date(p.paymentDate).toLocaleDateString("id-ID")}</span> ·{" "}
                      <span>{p.accountName}</span> {p.notes && `(${p.notes})`}
                    </div>
                    <strong style={{ color: "var(--emerald)" }}>{formatRupiah(BigInt(p.amount))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCancelModal && (
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
          <div className="card" style={{ width: "100%", maxWidth: "30rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--rose)" }}>
                Batalkan Faktur Pembelian?
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem", minHeight: "44px", minWidth: "44px", display: "grid", placeItems: "center" }}
                onClick={() => setShowCancelModal(false)}
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1rem" }}>
              Pembatalan akan mengembalikan mutasi stok barang masuk. Untuk pembelian tunai, pengeluaran kas akan dibalikkan melalui entri jurnal kas masuk. Untuk pembelian tempo, hutang akan dibatalkan (syarat: belum ada cicilan yang dibayarkan dan stok belum terjual).
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label className="label" htmlFor="cancel-reason">Alasan Pembatalan (Opsional)</label>
              <input
                id="cancel-reason"
                type="text"
                className="input-field"
                placeholder="Contoh: Faktur salah input / retur supplier"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ minHeight: "44px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: "44px" }}
                onClick={() => setShowCancelModal(false)}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: "44px", background: "var(--rose)", borderColor: "var(--rose)" }}
                onClick={handleCancel}
                disabled={isPending}
              >
                {isPending ? "Membatalkan..." : "Ya, Batalkan Pembelian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
