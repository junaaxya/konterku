import type { FinancialMetrics, ReportPeriod } from "./report-service"

const periodLabels: Record<ReportPeriod, string> = {
  TODAY: "Hari Ini",
  "7DAYS": "7 Hari Terakhir",
  MONTH: "Bulan Ini",
  CUSTOM: "Kustom",
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }
  const str = String(value)
  if (
    str.includes('"') ||
    str.includes(",") ||
    str.includes(";") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

export function generateReportCsvFilename(
  period: ReportPeriod,
  date: Date = new Date(),
): string {
  const datePart = date.toISOString().split("T")[0]
  return `laporan-konterku-${period.toLowerCase()}-${datePart}.csv`
}

export function generateFinancialReportCsv(report: FinancialMetrics): string {
  const BOM = "\uFEFF"
  const lines: string[] = []

  // 1. Header & Period Metadata
  lines.push(escapeCsvField("LAPORAN KEUANGAN KONTERKU"))
  lines.push(
    [
      escapeCsvField("Periode"),
      escapeCsvField(periodLabels[report.period] || report.period),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Rentang Waktu"),
      escapeCsvField(
        `${dateFormatter.format(report.startDate)} s/d ${dateFormatter.format(report.endDate)}`,
      ),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Waktu Ekspor"),
      escapeCsvField(dateFormatter.format(new Date())),
    ].join(","),
  )
  lines.push("")

  // 2. Financial Summary
  lines.push(escapeCsvField("RINGKASAN METRIK KEUANGAN"))
  lines.push(
    [escapeCsvField("Indikator"), escapeCsvField("Nilai (Rp)")].join(","),
  )
  lines.push(
    [
      escapeCsvField("Total Aset"),
      report.totalAssets.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Saldo Total (Semua Akun)"),
      report.totalCashBalance.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Total Volume Transaksi"),
      report.totalVolume.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Total Profit Riil"),
      report.totalProfit.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Pemasukan Kas Umum"),
      report.totalIncome.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Pengeluaran Toko"),
      report.totalExpense.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Saldo Total (Semua Akun)"),
      report.totalCashBalance.toString(),
    ].join(","),
  )
  lines.push(
    [
      escapeCsvField("Jumlah Transaksi Selesai"),
      report.transactionCount.toString(),
    ].join(","),
  )
  lines.push("")

  // 3. Category Summaries
  lines.push(escapeCsvField("RINCIAN PER KATEGORI"))
  lines.push(
    [
      escapeCsvField("Kategori"),
      escapeCsvField("Jumlah Transaksi"),
      escapeCsvField("Volume Transaksi (Rp)"),
      escapeCsvField("Profit Riil (Rp)"),
    ].join(","),
  )

  if (report.categorySummaries.length === 0) {
    lines.push(
      [
        escapeCsvField("Tidak ada transaksi pada periode ini"),
        "0",
        "0",
        "0",
      ].join(","),
    )
  } else {
    for (const cat of report.categorySummaries) {
      lines.push(
        [
          escapeCsvField(cat.category),
          cat.count.toString(),
          cat.volume.toString(),
          cat.profit.toString(),
        ].join(","),
      )
    }
  }
  lines.push("")

  // 4. Account Balance Summaries
  lines.push(escapeCsvField("SALDO AKUN TERKINI"))
  lines.push(
    [
      escapeCsvField("Nama Akun"),
      escapeCsvField("Jenis Akun"),
      escapeCsvField("Status"),
      escapeCsvField("Saldo Buku Besar (Rp)"),
    ].join(","),
  )

  for (const acc of report.accountSummaries) {
    lines.push(
      [
        escapeCsvField(acc.name),
        escapeCsvField(acc.type),
        escapeCsvField(acc.isActive ? "Aktif" : "Nonaktif"),
        acc.balance.toString(),
      ].join(","),
    )
  }
  lines.push("")

  // 5. Transaction Detail Rows
  lines.push(escapeCsvField("DAFTAR TRANSAKSI SELESAI"))
  lines.push(
    [
      escapeCsvField("No. Transaksi"),
      escapeCsvField("Waktu"),
      escapeCsvField("Kategori"),
      escapeCsvField("Keterangan"),
      escapeCsvField("Nominal Transaksi (Rp)"),
      escapeCsvField("Modal / Biaya (Rp)"),
      escapeCsvField("Biaya Admin (Rp)"),
      escapeCsvField("Profit Riil (Rp)"),
    ].join(","),
  )

  for (const tx of report.transactions) {
    lines.push(
      [
        escapeCsvField(tx.transactionNumber),
        escapeCsvField(dateFormatter.format(tx.occurredAt)),
        escapeCsvField(tx.category),
        escapeCsvField(tx.description),
        tx.grossAmount.toString(),
        tx.costAmount.toString(),
        tx.feeAmount.toString(),
        tx.profitAmount.toString(),
      ].join(","),
    )
  }

  return BOM + lines.join("\r\n")
}
