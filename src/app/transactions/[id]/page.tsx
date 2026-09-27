import Link from "next/link"
import { notFound } from "next/navigation"
import { Printer } from "@phosphor-icons/react/dist/ssr"

import { getTransactionById, TransactionNotFoundError } from "@/features/transactions/transaction-service"
import { formatRupiah } from "@/lib/money"
import { CancelTransactionForm } from "./cancel-form"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "full",
  timeStyle: "medium",
})

type Props = {
  params: Promise<{ id: string }>
}

export default async function TransactionDetailPage({ params }: Props) {
  const { id } = await params
  let transaction

  try {
    transaction = await getTransactionById({ transactionId: id })
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      notFound()
    }
    throw error
  }

  const isCancelled = transaction.status === "CANCELLED"

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">DETAIL TRANSAKSI</p>
          <h1 className="page-title">{transaction.transactionNumber}</h1>
          <p className="page-desc">{transaction.description}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href={`/transactions/${transaction.id}/receipt`} className="btn btn-secondary" style={{ minHeight: "2.25rem", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}>
            <Printer size={15} weight="bold" /> {isCancelled ? "Cetak Ulang" : "Cetak Struk"}
          </Link>
          <span
            className="badge-online"
            style={{
              background: isCancelled ? "var(--danger-light)" : "var(--primary-light)",
              color: isCancelled ? "var(--danger)" : "var(--primary-dark)",
            }}
          >
            {isCancelled ? "✕ DIBATALKAN" : "✓ SELESAI"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column: Summary & Ledger Impact */}
        <div>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0 0 1rem" }}>Informasi Transaksi</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "0.75rem", margin: 0 }}>
              <dt style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Kategori</dt>
              <dd style={{ fontWeight: 700, margin: 0, fontSize: "0.875rem" }}>{transaction.category}</dd>

              <dt style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Nominal Transaksi</dt>
              <dd style={{ fontWeight: 800, margin: 0, fontSize: "1rem" }}>{formatRupiah(transaction.grossAmount)}</dd>

              <dt style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Dampak Profit</dt>
              <dd style={{ fontWeight: 800, margin: 0, color: transaction.profitAmount >= 0n ? "var(--primary-dark)" : "var(--danger)" }}>
                {transaction.profitAmount >= 0n ? "+" : ""}{formatRupiah(transaction.profitAmount)}
              </dd>

              <dt style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Waktu Terjadi</dt>
              <dd style={{ margin: 0, fontSize: "0.875rem" }}>{dateFormatter.format(transaction.occurredAt)}</dd>

              <dt style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Dicatat Sistem</dt>
              <dd style={{ margin: 0, fontSize: "0.875rem" }}>{dateFormatter.format(transaction.createdAt)}</dd>

              {isCancelled && (
                <>
                  <dt style={{ color: "var(--danger)", fontSize: "0.875rem", borderTop: "1px dashed var(--line)", paddingTop: "0.5rem" }}>Dibatalkan Pada</dt>
                  <dd style={{ margin: 0, color: "var(--danger)", fontSize: "0.875rem", borderTop: "1px dashed var(--line)", paddingTop: "0.5rem" }}>
                    {transaction.cancelledAt ? dateFormatter.format(transaction.cancelledAt) : "-"}
                  </dd>

                  <dt style={{ color: "var(--danger)", fontSize: "0.875rem" }}>Alasan Pembatalan</dt>
                  <dd style={{ margin: 0, color: "var(--danger)", fontStyle: "italic", fontSize: "0.875rem" }}>
                    {transaction.cancelReason ?? "-"}
                  </dd>
                </>
              )}
            </dl>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Mutasi Buku Besar</h2>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Pergerakan kas terkait</span>
              </div>
              <span className="eyebrow">{transaction.ledgerEntries.length} entri</span>
            </div>

            <div>
              {transaction.ledgerEntries.map((entry) => (
                <div key={entry.id} className="tx-item">
                  <span className={`tx-badge ${entry.direction === "IN" ? "in" : "out"}`}>
                    {entry.direction === "IN" ? "＋" : "−"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.875rem" }}>{entry.account.name} ({entry.account.type})</strong>
                      <span style={{ fontWeight: 800, fontSize: "0.875rem", color: entry.direction === "IN" ? "var(--primary-dark)" : "var(--ink)" }}>
                        {entry.direction === "IN" ? "+" : "−"}{formatRupiah(entry.amount)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      <span>{entry.description}</span>
                      <span>{dateFormatter.format(entry.occurredAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Actions / Cancellation */}
        <div>
          {!isCancelled ? (
            <CancelTransactionForm
              transactionId={transaction.id}
              transactionNumber={transaction.transactionNumber}
            />
          ) : (
            <div className="card" style={{ background: "var(--paper)", border: "1px dashed var(--line)", textAlign: "center", padding: "1.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🔒</span>
              <strong style={{ display: "block", color: "var(--ink)", marginTop: "0.5rem" }}>Transaksi Sudah Dibatalkan</strong>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                Saldo akun terkait telah disesuaikan kembali melalui mutasi pembalik buku besar.
              </p>
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <Link href="/transactions" className="btn btn-secondary" style={{ width: "100%" }}>
              ← Kembali ke Riwayat
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
