import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
} from "../../src/features/accounts/account-ledger"
import {
  createIncome,
  createExpense,
  cancelTransaction,
} from "../../src/features/transactions/transaction-service"
import { createBankTransferTransaction } from "../../src/features/transactions/counter-transaction-service"
import { getFinancialReport } from "../../src/features/reports/report-service"
import {
  generateFinancialReportCsv,
  generateReportCsvFilename,
  escapeCsvField,
} from "../../src/features/reports/report-export"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Report Export Feature", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Report Export Feature", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdTransactionIds = new Set<string>()

    afterEach(async () => {
      const txIds = [...createdTransactionIds]
      const accIds = [...createdAccountIds]

      if (txIds.length > 0) {
        await database.ledgerEntry.deleteMany({
          where: { transactionId: { in: txIds } },
        })
        await database.transaction.deleteMany({
          where: { id: { in: txIds } },
        })
        createdTransactionIds.clear()
      }

      if (accIds.length > 0) {
        await database.ledgerEntry.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.account.deleteMany({
          where: { id: { in: accIds } },
        })
        createdAccountIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("properly quotes CSV fields containing commas, semicolons, quotes, and newlines", () => {
      expect(escapeCsvField("Normal Text")).toBe('"Normal Text"')
      expect(escapeCsvField("Text with, comma")).toBe('"Text with, comma"')
      expect(escapeCsvField("Text with; semicolon")).toBe('"Text with; semicolon"')
      expect(escapeCsvField('Text with "quotes"')).toBe('"Text with ""quotes"""')
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"')
      expect(escapeCsvField(12345)).toBe('"12345"')
      expect(escapeCsvField(9007199254740993n)).toBe('"9007199254740993"')
      expect(escapeCsvField(null)).toBe('""')
      expect(escapeCsvField(undefined)).toBe('""')
    })

    it("generates deterministic and readable report CSV filenames", () => {
      const fixedDate = new Date("2026-09-18T10:00:00Z")
      expect(generateReportCsvFilename("TODAY", fixedDate)).toBe("laporan-konterku-today-2026-09-18.csv")
      expect(generateReportCsvFilename("7DAYS", fixedDate)).toBe("laporan-konterku-7days-2026-09-18.csv")
      expect(generateReportCsvFilename("MONTH", fixedDate)).toBe("laporan-konterku-month-2026-09-18.csv")
      expect(generateReportCsvFilename("CUSTOM", fixedDate)).toBe("laporan-konterku-custom-2026-09-18.csv")
    })

    it("exports report CSV matching exact server-side calculations and excludes cancelled transactions", async () => {
      const cash = await createAccount({
        name: "Kas Ekspor CSV",
        type: "CASH",
        openingBalance: "500000",
      })
      createdAccountIds.add(cash.id)

      const bank = await createAccount({
        name: "BCA Ekspor CSV",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(bank.id)

      const inc = await createIncome({
        accountId: cash.id,
        amount: "150000",
        description: "Penjualan Aksesoris, Case & Kabel",
      })
      createdTransactionIds.add(inc.id)

      const exp = await createExpense({
        accountId: cash.id,
        amount: "50000",
        description: "Beli Perlengkapan Toko",
      })
      createdTransactionIds.add(exp.id)

      const tf = await createBankTransferTransaction({
        sourceAccountId: bank.id,
        customerPaymentAccountId: cash.id,
        transferAmount: "500000",
        adminFee: "5000",
        description: "Transfer Antar Bank BCA",
      })
      createdTransactionIds.add(tf.id)

      const cancelledTx = await createIncome({
        accountId: cash.id,
        amount: "999000",
        description: "Transaksi Salah Harus Batal",
      })
      createdTransactionIds.add(cancelledTx.id)

      await cancelTransaction({
        transactionId: cancelledTx.id,
        reason: "Batal uji ekspor",
      })

      const report = await getFinancialReport({ period: "TODAY" })
      const csv = generateFinancialReportCsv(report)

      expect(csv.startsWith("\uFEFF")).toBe(true)

      expect(csv).toContain('"LAPORAN KEUANGAN KONTERKU"')
      expect(csv).toContain('"Periode","Hari Ini"')
      expect(csv).toContain('"Total Aset",' + report.totalAssets.toString())
      expect(csv).toContain('"Saldo Total (Semua Akun)",' + report.totalCashBalance.toString())
      expect(csv).toContain('"Total Volume Transaksi",' + report.totalVolume.toString())
      expect(csv).toContain('"Total Profit Riil",' + report.totalProfit.toString())
      expect(csv).toContain('"Pemasukan Kas Umum",' + report.totalIncome.toString())
      expect(csv).toContain('"Pengeluaran Toko",' + report.totalExpense.toString())
      expect(csv).toContain('"Saldo Total (Semua Akun)",' + report.totalCashBalance.toString())
      expect(csv).toContain('"Jumlah Transaksi Selesai",' + report.transactionCount.toString())

      expect(csv).toContain('"Penjualan Aksesoris, Case & Kabel"')
      expect(csv).toContain('"Transfer Antar Bank BCA"')
      expect(csv).not.toContain('"Transaksi Salah Harus Batal"')

      expect(csv).toContain('"Kas Ekspor CSV"')
      expect(csv).toContain('"BCA Ekspor CSV"')
    })

    it("exports cleanly for TODAY, 7DAYS, MONTH, and CUSTOM periods", async () => {
      const cash = await createAccount({
        name: "Kas Period Check",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      const periods = ["TODAY", "7DAYS", "MONTH", "CUSTOM"] as const
      for (const p of periods) {
        const rep = await getFinancialReport({
          period: p,
          startDate: p === "CUSTOM" ? new Date("2026-09-01T00:00:00Z") : undefined,
          endDate: p === "CUSTOM" ? new Date("2026-09-18T23:59:59Z") : undefined,
        })
        const csv = generateFinancialReportCsv(rep)
        expect(csv).toContain('"LAPORAN KEUANGAN KONTERKU"')
        expect(csv).toContain('"RINGKASAN METRIK KEUANGAN"')
        expect(csv).toContain('"RINCIAN PER KATEGORI"')
        expect(csv).toContain('"SALDO AKUN TERKINI"')
        expect(csv).toContain('"DAFTAR TRANSAKSI SELESAI"')
      }
    })
  })
}
