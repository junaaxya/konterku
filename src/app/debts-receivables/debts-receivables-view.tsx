"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  HandCoins,
  ArrowDownRight,
  ArrowUpRight,
  ArrowCounterClockwise,
  CheckCircle,
  WarningCircle,
  X,
  UserPlus,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import {
  payReceivableAction,
  payPayableAction,
  payRefundLiabilityAction,
  createCustomerAction,
} from "./actions"

export type SerializedReceivable = {
  readonly id: string
  readonly receivableNumber: string
  readonly customerId: string
  readonly customerName: string
  readonly customerPhone: string | null
  readonly transactionId: string
  readonly transactionNumber: string
  readonly totalAmount: string
  readonly paidAmount: string
  readonly remainingAmount: string
  readonly status: string
  readonly dueDate: string | null
  readonly createdAt: string
  readonly payments: readonly {
    readonly id: string
    readonly amount: string
    readonly paymentDate: string
    readonly accountName: string
    readonly notes: string | null
  }[]
}

export type SerializedPayable = {
  readonly id: string
  readonly payableNumber: string
  readonly supplierId: string
  readonly supplierName: string
  readonly supplierPurchaseId: string | null
  readonly purchaseNumber: string | null
  readonly totalAmount: string
  readonly paidAmount: string
  readonly remainingAmount: string
  readonly status: string
  readonly dueDate: string | null
  readonly createdAt: string
  readonly payments: readonly {
    readonly id: string
    readonly amount: string
    readonly paymentDate: string
    readonly accountName: string
    readonly notes: string | null
  }[]
}

export type SerializedRefund = {
  readonly id: string
  readonly liabilityNumber: string
  readonly customerId: string
  readonly customerName: string
  readonly receivableId: string
  readonly totalAmount: string
  readonly refundedAmount: string
  readonly remainingAmount: string
  readonly status: string
  readonly reason: string | null
  readonly createdAt: string
  readonly refundPayments: readonly {
    readonly id: string
    readonly amount: string
    readonly paymentDate: string
    readonly accountName: string
    readonly notes: string | null
  }[]
}

type AccountOption = {
  readonly id: string
  readonly name: string
  readonly type: string
}

type CustomerOption = {
  readonly id: string
  readonly name: string
  readonly phone: string | null
}

type Props = {
  readonly receivables: readonly SerializedReceivable[]
  readonly payables: readonly SerializedPayable[]
  readonly refunds: readonly SerializedRefund[]
  readonly accounts: readonly AccountOption[]
  readonly customers: readonly CustomerOption[]
}

export function DebtsReceivablesView({
  receivables,
  payables,
  refunds,
  accounts,
  customers,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"RECEIVABLES" | "PAYABLES" | "REFUNDS">("RECEIVABLES")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [activePaymentModal, setActivePaymentModal] = useState<{
    type: "RECEIVABLE" | "PAYABLE" | "REFUND"
    id: string
    title: string
    remainingAmount: string
  } | null>(null)

  const [paymentAmount, setPaymentAmount] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "")
  const [paymentNotes, setPaymentNotes] = useState("")

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)

  const totalOutstandingReceivables = receivables
    .filter((r) => r.status === "OPEN" || r.status === "PARTIAL")
    .reduce((acc, r) => acc + BigInt(r.remainingAmount), 0n)

  const totalOutstandingPayables = payables
    .filter((py) => py.status === "OPEN" || py.status === "PARTIAL")
    .reduce((acc, py) => acc + BigInt(py.remainingAmount), 0n)

  const totalOutstandingRefunds = refunds
    .filter((rf) => rf.status === "OPEN" || rf.status === "PARTIAL")
    .reduce((acc, rf) => acc + BigInt(rf.remainingAmount), 0n)

  const openPaymentModal = (
    type: "RECEIVABLE" | "PAYABLE" | "REFUND",
    id: string,
    title: string,
    remainingAmount: string,
  ) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setPaymentAmount(remainingAmount)
    setSelectedAccountId(accounts[0]?.id || "")
    setPaymentNotes("")
    setActivePaymentModal({ type, id, title, remainingAmount })
  }

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activePaymentModal) return

    setErrorMsg(null)
    setSuccessMsg(null)

    const formData = new FormData()
    formData.set("amount", paymentAmount)
    formData.set("accountId", selectedAccountId)
    if (paymentNotes) formData.set("notes", paymentNotes)

    startTransition(async () => {
      let res
      if (activePaymentModal.type === "RECEIVABLE") {
        formData.set("receivableId", activePaymentModal.id)
        res = await payReceivableAction(formData)
      } else if (activePaymentModal.type === "PAYABLE") {
        formData.set("payableId", activePaymentModal.id)
        res = await payPayableAction(formData)
      } else {
        formData.set("liabilityId", activePaymentModal.id)
        res = await payRefundLiabilityAction(formData)
      }

      if (res.success) {
        setSuccessMsg("Pembayaran berhasil dicatat tanpa membuat transaksi ganda.")
        setActivePaymentModal(null)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  const handleCreateCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createCustomerAction(formData)
      if (res.success) {
        setSuccessMsg(`Pelanggan ${res.data.name} berhasil didaftarkan.`)
        setShowAddCustomerModal(false)
        router.refresh()
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="eyebrow">PIUTANG · HUTANG · KEWAJIBAN REFUND</p>
          <h1 className="page-title">Hutang & Piutang</h1>
          <p className="page-desc">Kelola tagihan piutang tempo pelanggan, hutang supplier, dan kewajiban refund.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => {
            setErrorMsg(null)
            setShowAddCustomerModal(true)
          }}
        >
          <UserPlus size={18} />
          <span>Tambah Pelanggan ({customers.length})</span>
        </button>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--emerald)" }}>
            <ArrowDownRight size={18} weight="bold" />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>Piutang Pelanggan</span>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: totalOutstandingReceivables > 0n ? "var(--primary-dark)" : "var(--ink)" }}>
            {formatRupiah(totalOutstandingReceivables)}
          </p>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Aset riil menunggu pelunasan</span>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--rose)" }}>
            <ArrowUpRight size={18} weight="bold" />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>Hutang Supplier</span>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: totalOutstandingPayables > 0n ? "var(--rose)" : "var(--ink)" }}>
            {formatRupiah(totalOutstandingPayables)}
          </p>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Kewajiban tempo distributor</span>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--amber)" }}>
            <ArrowCounterClockwise size={18} weight="bold" />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>Kewajiban Refund</span>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0", color: totalOutstandingRefunds > 0n ? "var(--amber)" : "var(--ink)" }}>
            {formatRupiah(totalOutstandingRefunds)}
          </p>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Uang pelanggan dari transaksi batal</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", overflowX: "auto" }}>
        <button
          type="button"
          className={`btn ${activeTab === "RECEIVABLES" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
          onClick={() => setActiveTab("RECEIVABLES")}
        >
          <ArrowDownRight size={18} />
          <span>Piutang Pelanggan ({receivables.length})</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "PAYABLES" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
          onClick={() => setActiveTab("PAYABLES")}
        >
          <ArrowUpRight size={18} />
          <span>Hutang Supplier ({payables.length})</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "REFUNDS" ? "btn-primary" : "btn-secondary"}`}
          style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
          onClick={() => setActiveTab("REFUNDS")}
        >
          <ArrowCounterClockwise size={18} />
          <span>Kewajiban Refund ({refunds.length})</span>
        </button>
      </div>

      {activeTab === "RECEIVABLES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {receivables.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
              <HandCoins size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "0.25rem" }}>Tidak ada catatan piutang</strong>
              <p style={{ fontSize: "0.875rem", margin: 0 }}>Piutang akan otomatis tercatat ketika ada transaksi penjualan tempo/kredit.</p>
            </div>
          ) : (
            receivables.map((r) => {
              const remaining = BigInt(r.remainingAmount)
              const isPaid = r.status === "PAID"
              const isCancelled = r.status === "CANCELLED"

              return (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>{r.customerName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>({r.receivableNumber})</span>
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
                        {r.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                      <span>Transaksi #{r.transactionNumber}</span> ·{" "}
                      <span>Total: {formatRupiah(BigInt(r.totalAmount))}</span> ·{" "}
                      <span>Terbayar: {formatRupiah(BigInt(r.paidAmount))}</span>
                      {r.dueDate && <span> · Jatuh tempo: {new Date(r.dueDate).toLocaleDateString("id-ID")}</span>}
                    </div>

                    {r.payments.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        Riwayat: {r.payments.length}x pembayaran terakhir {new Date(r.payments[0]!.paymentDate).toLocaleDateString("id-ID")}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Sisa Piutang</span>
                      <strong style={{ fontSize: "1.125rem", color: remaining > 0n ? "var(--primary-dark)" : "var(--emerald)" }}>
                        {formatRupiah(remaining)}
                      </strong>
                    </div>

                    {remaining > 0n && !isCancelled && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ minHeight: "44px" }}
                        onClick={() => openPaymentModal("RECEIVABLE", r.id, `Pelunasan Piutang: ${r.customerName}`, r.remainingAmount)}
                      >
                        Terima Pembayaran
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "PAYABLES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {payables.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
              <HandCoins size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "0.25rem" }}>Tidak ada catatan hutang</strong>
              <p style={{ fontSize: "0.875rem", margin: 0 }}>Hutang akan otomatis terbentuk saat mencatat faktur pembelian supplier tempo.</p>
            </div>
          ) : (
            payables.map((py) => {
              const remaining = BigInt(py.remainingAmount)
              const isPaid = py.status === "PAID"
              const isCancelled = py.status === "CANCELLED"

              return (
                <div
                  key={py.id}
                  className="card"
                  style={{
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>{py.supplierName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>({py.payableNumber})</span>
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

                    <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                      {py.purchaseNumber && <span>Faktur #{py.purchaseNumber} · </span>}
                      <span>Total: {formatRupiah(BigInt(py.totalAmount))}</span> ·{" "}
                      <span>Terbayar: {formatRupiah(BigInt(py.paidAmount))}</span>
                      {py.dueDate && <span> · Jatuh tempo: {new Date(py.dueDate).toLocaleDateString("id-ID")}</span>}
                    </div>

                    {py.payments.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        Riwayat: {py.payments.length}x cicilan terakhir {new Date(py.payments[0]!.paymentDate).toLocaleDateString("id-ID")}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Sisa Hutang</span>
                      <strong style={{ fontSize: "1.125rem", color: remaining > 0n ? "var(--rose)" : "var(--emerald)" }}>
                        {formatRupiah(remaining)}
                      </strong>
                    </div>

                    {remaining > 0n && !isCancelled && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ minHeight: "44px" }}
                        onClick={() => openPaymentModal("PAYABLE", py.id, `Bayar Hutang Supplier: ${py.supplierName}`, py.remainingAmount)}
                      >
                        Bayar Hutang
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "REFUNDS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {refunds.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
              <ArrowCounterClockwise size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "0.25rem" }}>Tidak ada kewajiban refund</strong>
              <p style={{ fontSize: "0.875rem", margin: 0 }}>Kewajiban refund pelanggan terbentuk jika ada transaksi kredit yang dibatalkan setelah sebagian piutang telah dibayar oleh pelanggan.</p>
            </div>
          ) : (
            refunds.map((rf) => {
              const remaining = BigInt(rf.remainingAmount)
              const isPaid = rf.status === "PAID"

              return (
                <div
                  key={rf.id}
                  className="card"
                  style={{
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>{rf.customerName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>({rf.liabilityNumber})</span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "0.125rem 0.375rem",
                          borderRadius: "4px",
                          background: isPaid ? "var(--emerald-bg)" : "var(--amber-bg)",
                          color: isPaid ? "var(--emerald)" : "var(--amber)",
                        }}
                      >
                        {rf.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                      <span>Kewajiban Refund: {formatRupiah(BigInt(rf.totalAmount))}</span> ·{" "}
                      <span>Telah Direfund: {formatRupiah(BigInt(rf.refundedAmount))}</span>
                      {rf.reason && <span> · Alasan: {rf.reason}</span>}
                    </div>

                    {rf.refundPayments.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        Riwayat: {rf.refundPayments.length}x refund terbayar
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Sisa Kewajiban</span>
                      <strong style={{ fontSize: "1.125rem", color: remaining > 0n ? "var(--amber)" : "var(--emerald)" }}>
                        {formatRupiah(remaining)}
                      </strong>
                    </div>

                    {remaining > 0n && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ minHeight: "44px" }}
                        onClick={() => openPaymentModal("REFUND", rf.id, `Proses Refund: ${rf.customerName}`, rf.remainingAmount)}
                      >
                        Refund Pelanggan
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activePaymentModal && (
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
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>{activePaymentModal.title}</h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem", minHeight: "44px", minWidth: "44px", display: "grid", placeItems: "center" }}
                onClick={() => setActivePaymentModal(null)}
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="label" htmlFor="pay-amount">
                  Nominal Pembayaran (Rp) <span style={{ color: "var(--rose)" }}>*</span>
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  required
                  min="1"
                  max={activePaymentModal.remainingAmount}
                  step="1"
                  className="input-field"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ minHeight: "44px" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", display: "block" }}>
                  Maksimal sisa tagihan: {formatRupiah(BigInt(activePaymentModal.remainingAmount))}
                </span>
              </div>

              <div>
                <label className="label" htmlFor="pay-account">
                  {activePaymentModal.type === "RECEIVABLE"
                    ? "Masuk ke Akun Kas / Bank *"
                    : "Keluar dari Akun Kas / Bank *"}
                </label>
                <select
                  id="pay-account"
                  className="input-field"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{ minHeight: "44px" }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="pay-notes">Catatan Pembayaran (Opsional)</label>
                <input
                  id="pay-notes"
                  type="text"
                  placeholder="Contoh: Cicilan ke-1 / Pelunasan via transfer"
                  className="input-field"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: "44px" }}
                  onClick={() => setActivePaymentModal(null)}
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
                  {isPending ? "Memproses..." : "Simpan Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCustomerModal && (
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
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Tambah Pelanggan Baru</h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem", minHeight: "44px", minWidth: "44px", display: "grid", placeItems: "center" }}
                onClick={() => setShowAddCustomerModal(false)}
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="label" htmlFor="cust-name">
                  Nama Pelanggan <span style={{ color: "var(--rose)" }}>*</span>
                </label>
                <input
                  id="cust-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Contoh: Bpk. Joko"
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="cust-phone">Nomor Telepon / WhatsApp</label>
                <input
                  id="cust-phone"
                  name="phone"
                  type="tel"
                  placeholder="Contoh: 081298765432"
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="cust-notes">Catatan</label>
                <textarea
                  id="cust-notes"
                  name="notes"
                  rows={2}
                  placeholder="Alamat rumah, dll."
                  className="input-field"
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: "44px" }}
                  onClick={() => setShowAddCustomerModal(false)}
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
                  {isPending ? "Menyimpan..." : "Daftarkan Pelanggan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
