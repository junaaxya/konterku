import Link from "next/link"
import {
  Vault,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  DeviceMobile,
  Bank,
  Money,
  CreditCard,
  Plus,
  Minus,
  Lightning,
  Coins,
  Receipt,
} from "@phosphor-icons/react/dist/ssr"

import { getFinancialReport, type ReportPeriod } from "@/features/reports/report-service"
import { formatRupiah } from "@/lib/money"
import { DashboardAccountBalances } from "./dashboard-account-balances"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

const periodLabels: Record<ReportPeriod, string> = {
  TODAY: "Hari Ini",
  "7DAYS": "7 Hari Terakhir",
  MONTH: "Bulan Ini",
  CUSTOM: "Kustom",
}

type Props = {
  searchParams: Promise<{
    periode?: string
    dari?: string
    sampai?: string
  }>
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams
  const period: ReportPeriod =
    params.periode === "TODAY" ||
    params.periode === "7DAYS" ||
    params.periode === "MONTH" ||
    params.periode === "CUSTOM"
      ? params.periode
      : "TODAY"

  const startDate = params.dari ? new Date(params.dari) : undefined
  const endDate = params.sampai ? new Date(params.sampai) : undefined

  const report = await getFinancialReport({
    period,
    startDate,
    endDate,
  })

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">DASHBOARD KEUANGAN</p>
          <h1 className="page-title">Ringkasan Konter</h1>
          <p className="page-desc">Pantau saldo kas, mutasi transaksi, dan profit riil toko.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/transactions/new" className="btn btn-primary">
            <Lightning size={16} weight="bold" />
            Transaksi Baru
          </Link>
          <Link href="/reports" className="btn btn-secondary">
            <Receipt size={16} weight="bold" />
            Laporan Lengkap
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["TODAY", "7DAYS", "MONTH"] as const).map((p) => {
              const isActive = period === p
              return (
                <Link
                  key={p}
                  href={`/?periode=${p}`}
                  className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                  style={{ minHeight: "2.75rem", padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                >
                  {periodLabels[p]}
                </Link>
              )
            })}
          </div>

          <form method="GET" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="periode" value="CUSTOM" />
            <input
              type="date"
              name="dari"
              defaultValue={params.dari || ""}
              className="form-control"
              style={{ minHeight: "2.75rem", width: "auto", fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
              required
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>s/d</span>
            <input
              type="date"
              name="sampai"
              defaultValue={params.sampai || ""}
              className="form-control"
              style={{ minHeight: "2.75rem", width: "auto", fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
              required
            />
            <button
              type="submit"
              className={`btn ${period === "CUSTOM" ? "btn-primary" : "btn-secondary"}`}
              style={{ minHeight: "2.75rem", padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              {period === "CUSTOM" ? "✓ Kustom" : "Filter"}
            </button>
          </form>
        </div>
      </div>

      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" }}>
        <div className="summary-card">
          <div className="summary-icon total" style={{ background: "var(--emerald-bg)", color: "var(--emerald-fg)" }}>
            <Vault size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Total Aset</p>
            <p className="summary-val" style={{ color: "var(--primary-dark)" }}>{formatRupiah(report.totalAssets)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon total">
            <Wallet size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Saldo Total (Semua Akun)</p>
            <p className="summary-val" style={{ color: "var(--primary-dark)" }}>{formatRupiah(report.totalCashBalance)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon income">
            <ArrowDownLeft size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Pemasukan ({periodLabels[period]})</p>
            <p className="summary-val" style={{ color: "var(--primary-dark)" }}>{formatRupiah(report.totalIncome)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon expense">
            <ArrowUpRight size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Pengeluaran ({periodLabels[period]})</p>
            <p className="summary-val" style={{ color: "var(--danger)" }}>{formatRupiah(report.totalExpense)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon total" style={{ background: "var(--emerald-bg)", color: "var(--emerald-fg)" }}>
            <Coins size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Profit Bersih ({periodLabels[period]})</p>
            <p className="summary-val" style={{ color: report.totalProfit >= 0n ? "var(--primary-dark)" : "var(--danger)" }}>
              {report.totalProfit >= 0n ? "+" : ""}{formatRupiah(report.totalProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Account Balances: Kas, Bank, E-Wallet, QRIS */}
      <DashboardAccountBalances accounts={report.accountSummaries} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0 0 0.5rem" }}>Catat Transaksi Cepat</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
              Pilih menu pintas operasional untuk pencatatan langsung.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              <Link
                href="/transactions/new"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.625rem 0.75rem", gap: "0.625rem" }}
              >
                <span className="icon-box blue" style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem" }}>
                  <DeviceMobile size={18} weight="duotone" />
                </span>
                <span>Pulsa & Data</span>
              </Link>
              <Link
                href="/transactions/new"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.625rem 0.75rem", gap: "0.625rem" }}
              >
                <span className="icon-box blue" style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem" }}>
                  <Bank size={18} weight="duotone" />
                </span>
                <span>Transfer Bank</span>
              </Link>
              <Link
                href="/transactions/new"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.625rem 0.75rem", gap: "0.625rem" }}
              >
                <span className="icon-box emerald" style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem" }}>
                  <Money size={18} weight="duotone" />
                </span>
                <span>Tarik Tunai</span>
              </Link>
              <Link
                href="/transactions/new"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.625rem 0.75rem", gap: "0.625rem" }}
              >
                <span className="icon-box violet" style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem" }}>
                  <CreditCard size={18} weight="duotone" />
                </span>
                <span>Top Up E-Wallet</span>
              </Link>
              <Link
                href="/transactions/income"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.625rem 0.75rem", gap: "0.625rem" }}
              >
                <span className="icon-box emerald" style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem" }}>
                  <Plus size={18} weight="bold" />
                </span>
                <span>Pemasukan</span>
              </Link>
              <Link
                href="/transactions/expense"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.625rem 0.75rem", gap: "0.625rem" }}
              >
                <span className="icon-box red" style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem" }}>
                  <Minus size={18} weight="bold" />
                </span>
                <span>Pengeluaran</span>
              </Link>
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: 0 }}>Statistik {periodLabels[period]}</h2>
                <span className="eyebrow" style={{ color: "var(--primary-dark)" }}>{report.transactionCount} Transaksi</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
                Ringkasan perputaran transaksi periode yang dipilih.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1rem 0" }}>
              <div style={{ background: "var(--paper)", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--line)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Volume Transaksi</span>
                <strong style={{ fontSize: "1rem" }}>{formatRupiah(report.totalVolume)}</strong>
              </div>
              <div style={{ background: "var(--paper)", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--line)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Total Profit</span>
                <strong style={{ fontSize: "1rem", color: report.totalProfit >= 0n ? "var(--primary-dark)" : "var(--danger)" }}>
                  {formatRupiah(report.totalProfit)}
                </strong>
              </div>
            </div>

            <Link href="/reports" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
              Buka Laporan Rinci →
            </Link>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Transaksi {periodLabels[period]}</h2>
            <Link href="/transactions" style={{ fontSize: "0.8125rem", color: "var(--primary-dark)", textDecoration: "none", fontWeight: 700 }}>
              Riwayat Lengkap →
            </Link>
          </div>

          {report.transactions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              Tidak ada transaksi pada periode {periodLabels[period]}.
            </div>
          ) : (
            <div>
              {report.transactions.slice(0, 6).map((tx) => {
                const isIncome = tx.category === "INCOME" || tx.profitAmount > 0n

                return (
                  <Link key={tx.id} href={`/transactions/${tx.id}`} className="tx-item">
                    <span className={`tx-badge ${isIncome ? "in" : "out"}`}>
                      {isIncome ? "＋" : "−"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tx.description}
                        </strong>
                        <span style={{ fontWeight: 800, fontSize: "0.875rem", color: isIncome ? "var(--primary-dark)" : "var(--ink)" }}>
                          {isIncome ? "+" : "-"}{formatRupiah(tx.grossAmount)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        <span>{tx.category} · {tx.transactionNumber}</span>
                        <span>{dateFormatter.format(tx.occurredAt)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
