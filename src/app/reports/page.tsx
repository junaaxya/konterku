import Link from "next/link"
import {
  Vault,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Receipt,
} from "@phosphor-icons/react/dist/ssr"

import { getFinancialReport, type ReportPeriod } from "@/features/reports/report-service"
import { getAssetLiabilitySummary } from "@/features/reports/asset-liability-service"
import { formatRupiah } from "@/lib/money"
import { ReportExportButton } from "./export-button"

export const dynamic = "force-dynamic"

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

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams
  const period: ReportPeriod =
    params.periode === "TODAY" ||
    params.periode === "7DAYS" ||
    params.periode === "MONTH" ||
    params.periode === "CUSTOM"
      ? params.periode
      : "MONTH"

  const startDate = params.dari ? new Date(params.dari) : undefined
  const endDate = params.sampai ? new Date(params.sampai) : undefined

  const [report, assetLiability] = await Promise.all([
    getFinancialReport({
      period,
      startDate,
      endDate,
    }),
    getAssetLiabilitySummary(),
  ])

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">LAPORAN KEUANGAN</p>
          <h1 className="page-title">Laporan & Rekonsiliasi</h1>
          <p className="page-desc">Rekapitulasi omzet, biaya, laba bersih, aset riil, dan rincian per kategori.</p>
        </div>
        <div>
          <ReportExportButton
            period={period}
            startDate={params.dari}
            endDate={params.sampai}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem", padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--primary-dark)" }}>NERACA POSISI KEUANGAN RIIL</span>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0.25rem 0 0" }}>Posisi Aset & Kewajiban</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
              Mencerminkan nilai seluruh saldo kas, piutang tempo, stok inventaris fisik, dan kewajiban saat ini. Aset bukan merupakan laba periode tertentu.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Aset Bersih (Net Assets)</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--primary-dark)" }}>
              {formatRupiah(assetLiability.netAssets)}
            </strong>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))", gap: "1rem" }}>
          <div style={{ background: "var(--paper)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <strong style={{ fontSize: "0.9375rem", color: "var(--emerald)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Vault size={18} weight="duotone" />
                Komposisi Aset
              </strong>
              <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>
                Total: {formatRupiah(assetLiability.totalAssets)}
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Saldo Total (Semua Akun)</span>
                <strong>{formatRupiah(assetLiability.totalCashBalance)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Total Piutang</span>
                <strong>{formatRupiah(assetLiability.outstandingReceivables)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Valuasi Inventaris</span>
                <strong>{formatRupiah(assetLiability.inventoryValuation)}</strong>
              </div>
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Total Aset</span>
                <span style={{ color: "var(--primary-dark)" }}>{formatRupiah(assetLiability.totalAssets)}</span>
              </div>
            </div>
          </div>

          <div style={{ background: "var(--paper)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <strong style={{ fontSize: "0.9375rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ArrowUpRight size={18} weight="bold" />
                Kewajiban & Liabilitas
              </strong>
              <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>
                Total: {formatRupiah(assetLiability.totalLiabilities)}
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Hutang Supplier</span>
                <strong style={{ color: assetLiability.supplierPayables > 0n ? "var(--rose)" : "inherit" }}>
                  {formatRupiah(assetLiability.supplierPayables)}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Kewajiban Refund Pelanggan</span>
                <strong style={{ color: assetLiability.customerRefundLiabilities > 0n ? "var(--amber)" : "inherit" }}>
                  {formatRupiah(assetLiability.customerRefundLiabilities)}
                </strong>
              </div>
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Total Kewajiban</span>
                <span style={{ color: assetLiability.totalLiabilities > 0n ? "var(--rose)" : "inherit" }}>
                  {formatRupiah(assetLiability.totalLiabilities)}
                </span>
              </div>
            </div>
          </div>
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
                  href={`/reports?periode=${p}`}
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
              {period === "CUSTOM" ? "✓ Kustom" : "Terapkan"}
            </button>
          </form>
        </div>
      </div>

      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", marginBottom: "1.5rem" }}>
        <div className="summary-card">
          <div className="summary-icon total" style={{ background: "var(--emerald-bg)", color: "var(--emerald-fg)" }}>
            <Vault size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Total Aset</p>
            <p className="summary-val" style={{ color: "var(--primary-dark)" }}>{formatRupiah(assetLiability.totalAssets)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon total" style={{ background: "var(--blue-bg)", color: "var(--blue-fg)" }}>
            <Receipt size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Total Volume Transaksi</p>
            <p className="summary-val">{formatRupiah(report.totalVolume)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon total" style={{ background: "var(--emerald-bg)", color: "var(--emerald-fg)" }}>
            <Coins size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Total Profit Riil</p>
            <p className="summary-val" style={{ color: report.totalProfit >= 0n ? "var(--primary-dark)" : "var(--danger)" }}>
              {report.totalProfit >= 0n ? "+" : ""}{formatRupiah(report.totalProfit)}
            </p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon income">
            <ArrowDownLeft size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Pemasukan Kas Umum</p>
            <p className="summary-val" style={{ color: "var(--primary-dark)" }}>{formatRupiah(report.totalIncome)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon expense">
            <ArrowUpRight size={26} weight="duotone" />
          </div>
          <div>
            <p className="summary-label">Pengeluaran Toko</p>
            <p className="summary-val" style={{ color: "var(--danger)" }}>{formatRupiah(report.totalExpense)}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Rincian Per Kategori ({periodLabels[period]})</h2>
            <span className="eyebrow">{report.categorySummaries.length} Kategori</span>
          </div>

          {report.categorySummaries.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              Tidak ada transaksi selesai pada periode ini.
            </div>
          ) : (
            <div>
              {report.categorySummaries.map((cat) => (
                <div key={cat.category} className="tx-item" style={{ cursor: "default" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.875rem" }}>{cat.category}</strong>
                      <span style={{ fontWeight: 800, fontSize: "0.875rem", color: cat.profit >= 0n ? "var(--primary-dark)" : "var(--danger)" }}>
                        Profit: {cat.profit >= 0n ? "+" : ""}{formatRupiah(cat.profit)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      <span>{cat.count} transaksi</span>
                      <span>Volume: {formatRupiah(cat.volume)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Saldo Akun Terkini</h2>
            <span className="eyebrow">Total: {formatRupiah(report.totalCashBalance)}</span>
          </div>

          <div>
            {report.accountSummaries.map((acc) => (
              <div key={acc.id} className="tx-item" style={{ cursor: "default" }}>
                <span className="summary-icon total" style={{ width: "2rem", height: "2rem", fontSize: "0.875rem" }}>
                  <Wallet size={16} weight="duotone" />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.875rem" }}>{acc.name}</strong>
                    <span style={{ fontWeight: 800, fontSize: "0.875rem" }}>{formatRupiah(acc.balance)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    <span>{acc.type}</span>
                    <span style={{ color: acc.isActive ? "var(--primary-dark)" : "var(--muted)" }}>
                      {acc.isActive ? "● Aktif" : "○ Nonaktif"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
