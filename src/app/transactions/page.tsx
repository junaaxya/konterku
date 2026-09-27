import Link from "next/link"
import { Printer } from "@phosphor-icons/react/dist/ssr"

import { listTransactions } from "@/features/transactions/transaction-service"
import { formatRupiah } from "@/lib/money"
import { TransactionCategory, TransactionStatus } from "@/generated/prisma/enums"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

type Props = {
  searchParams: Promise<{
    kategori?: string
    status?: string
    cari?: string
  }>
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await searchParams
  const categoryFilter =
    params.kategori && Object.values(TransactionCategory).includes(params.kategori as TransactionCategory)
      ? (params.kategori as TransactionCategory)
      : undefined
  const statusFilter =
    params.status === "COMPLETED" || params.status === "CANCELLED"
      ? (params.status as TransactionStatus)
      : undefined
  const searchFilter = params.cari || undefined

  const transactions = await listTransactions({
    category: categoryFilter,
    status: statusFilter,
    search: searchFilter,
    limit: 50,
  })

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">BUKU BESAR & KAS</p>
          <h1 className="page-title">Riwayat Transaksi</h1>
          <p className="page-desc">Semua riwayat transaksi operasional & umum.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/transactions/new" className="btn btn-primary">
            ⚡ Transaksi Konter
          </Link>
          <Link href="/transactions/income" className="btn btn-secondary">
            + Pemasukan
          </Link>
          <Link href="/transactions/expense" className="btn btn-secondary">
            + Pengeluaran
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <form method="GET" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            name="cari"
            placeholder="Cari deskripsi / nomor transaksi..."
            defaultValue={searchFilter || ""}
            className="form-control"
            style={{ flex: 1, minWidth: "14rem" }}
          />
          <select
            name="kategori"
            defaultValue={categoryFilter || ""}
            className="form-control"
            style={{ width: "auto", minWidth: "10rem" }}
          >
            <option value="">Semua Kategori</option>
            <option value="PULSA">Pulsa</option>
            <option value="DATA_PACKAGE">Paket Data</option>
            <option value="PLN_TOKEN">Token PLN</option>
            <option value="PPOB">PPOB</option>
            <option value="BANK_TRANSFER">Transfer Bank</option>
            <option value="CASH_WITHDRAWAL">Tarik Tunai</option>
            <option value="EWALLET_TOPUP">Top Up E-Wallet</option>
            <option value="PRODUCT_SALE">Penjualan Barang</option>
            <option value="INCOME">Pemasukan</option>
            <option value="EXPENSE">Pengeluaran</option>
            <option value="OTHER">Lainnya</option>
          </select>
          <select
            name="status"
            defaultValue={statusFilter || ""}
            className="form-control"
            style={{ width: "auto", minWidth: "8rem" }}
          >
            <option value="">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
          <button type="submit" className="btn btn-secondary">
            Cari
          </button>
          {(searchFilter || categoryFilter || statusFilter) && (
            <Link href="/transactions" style={{ fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", padding: "0.5rem" }}>
              Reset Filter
            </Link>
          )}
        </form>
      </div>

      {/* Transaction list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {transactions.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--muted)" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>📂</span>
            <strong style={{ display: "block", color: "var(--ink)", fontSize: "1rem" }}>Tidak ada transaksi ditemukan</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>Coba ubah kata kunci atau filter status transaksi.</p>
          </div>
        ) : (
          <div>
            {transactions.map((tx) => {
              const isCancelled = tx.status === "CANCELLED"
              const isIncome = tx.category === "INCOME" || tx.profitAmount > 0n

              return (
                <div
                  key={tx.id}
                  className="tx-item"
                  style={{
                    opacity: isCancelled ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    textDecoration: "none",
                  }}
                >
                  <Link
                    href={`/transactions/${tx.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flex: 1,
                      minWidth: 0,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span className={`tx-badge ${isCancelled ? "cancelled" : isIncome ? "in" : "out"}`}>
                      {isCancelled ? "X" : isIncome ? "IN" : "OUT"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "0.9375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tx.description}
                        </strong>
                        <span style={{ fontWeight: 800, fontSize: "0.9375rem", color: isCancelled ? "var(--muted)" : isIncome ? "var(--primary-dark)" : "var(--ink)" }}>
                          {isIncome ? "+" : "-"}{formatRupiah(tx.grossAmount)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        <span>{tx.category} · {tx.transactionNumber}</span>
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                          <span>{dateFormatter.format(tx.occurredAt)}</span>
                          <span style={{ color: isCancelled ? "var(--danger)" : "var(--primary-dark)", fontWeight: 600 }}>
                            {isCancelled ? "Dibatalkan" : "Selesai"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    href={`/transactions/${tx.id}/receipt`}
                    title={isCancelled ? "Cetak Ulang Struk (Dibatalkan)" : "Cetak Struk"}
                    className="btn btn-secondary no-print"
                    style={{
                      padding: "0.375rem 0.5rem",
                      fontSize: "0.75rem",
                      minHeight: "2rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      flexShrink: 0,
                    }}
                  >
                    <Printer size={14} weight="bold" />
                    <span className="sr-only sm:not-sr-only">{isCancelled ? "Cetak Ulang" : "Cetak"}</span>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
