import Link from "next/link"

import { listAccounts } from "@/features/accounts/account-ledger"
import { ExpenseForm } from "./expense-form"

export const dynamic = "force-dynamic"

export default async function NewExpensePage() {
  const accounts = await listAccounts({ activeOnly: true })

  return (
    <main className="container">
      <div style={{ maxWidth: "32rem", margin: "0 auto" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <p className="eyebrow">TRANSAKSI BARU · PENGELUARAN</p>
          <h1 className="page-title">Tambah Pengeluaran</h1>
          <p className="page-desc">Catat pengeluaran operasional toko atau biaya kas.</p>
        </div>

        <div className="card">
          {accounts.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>
              <strong style={{ color: "var(--ink)", display: "block" }}>Tidak ada akun aktif</strong>
              <p style={{ margin: "0.25rem 0 1rem", fontSize: "0.875rem" }}>Tambahkan atau aktifkan akun kas terlebih dahulu.</p>
              <Link href="/accounts" className="btn btn-primary">
                Kelola Akun Kas
              </Link>
            </div>
          ) : (
            <ExpenseForm
              accounts={accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
              }))}
            />
          )}
        </div>
      </div>
    </main>
  )
}
