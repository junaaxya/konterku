import { afterAll, afterEach, describe, expect, it } from "vitest"

import { createAccount } from "../../src/features/accounts/account-ledger"
import {
  createBankTransferTransaction,
  createProductTransaction,
} from "../../src/features/transactions/counter-transaction-service"
import {
  cancelTransaction,
  createExpense,
  createIncome,
} from "../../src/features/transactions/transaction-service"
import {
  getFinancialReport,
  getDateRangeForPeriod,
} from "../../src/features/reports/report-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("reports and financial metrics", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("reports and financial metrics", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdTransactionIds = new Set<string>()

    async function createTestAccount(
      name: string,
      type: "CASH" | "BANK" | "EWALLET" | "QRIS" | "OTHER" = "CASH",
      openingBalance = "0",
    ) {
      const account = await createAccount({
        name,
        type,
        openingBalance,
      })
      createdAccountIds.add(account.id)
      return account
    }

    afterEach(async () => {
      const txIds = [...createdTransactionIds]
      const accIds = [...createdAccountIds]

      if (txIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { transactionId: { in: txIds } } })
        await database.transaction.deleteMany({ where: { id: { in: txIds } } })
        createdTransactionIds.clear()
      }

      if (accIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { accountId: { in: accIds } } })
        await database.account.deleteMany({ where: { id: { in: accIds } } })
        createdAccountIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("correctly separates cash movement from income, expense, and profit", async () => {
      const cash = await createTestAccount("Kas Laporan", "CASH", "0")
      const bca = await createTestAccount("BCA Laporan", "BANK", "1000000")

      // 1. Generic income 50.000
      const tx1 = await createIncome({
        accountId: cash.id,
        amount: "50000",
        description: "Komisi",
      })
      createdTransactionIds.add(tx1.id)

      // 2. Generic expense 20.000
      const tx2 = await createExpense({
        accountId: cash.id,
        amount: "20000",
        description: "Beli Alat",
      })
      createdTransactionIds.add(tx2.id)

      // 3. Bank transfer volume 500.000 + fee 5.000 (total cash in 505.000, bank out 500.000)
      // Must NOT be counted as 505.000 income! Income = 50.000, Profit = 50.000 - 20.000 + 5.000 = 35.000
      const tx3 = await createBankTransferTransaction({
        sourceAccountId: bca.id,
        customerPaymentAccountId: cash.id,
        transferAmount: "500000",
        adminFee: "5000",
        description: "Transfer Pelanggan",
      })
      createdTransactionIds.add(tx3.id)

      const report = await getFinancialReport({ period: "TODAY" })

      expect(report.totalIncome).toBe(50_000n)
      expect(report.totalExpense).toBe(20_000n)
      expect(report.totalProfit).toBe(35_000n) // 50.000 - 20.000 + 5.000
      expect(report.totalVolume).toBe(570_000n) // 50k + 20k + 500k
    })

    it("excludes cancelled transactions from financial metrics", async () => {
      const cash = await createTestAccount("Kas Cancel", "CASH", "0")

      const tx = await createIncome({
        accountId: cash.id,
        amount: "100000",
        description: "Salah Catat Besar",
      })
      createdTransactionIds.add(tx.id)

      await cancelTransaction({
        transactionId: tx.id,
        reason: "Batal transaksi",
      })

      const report = await getFinancialReport({ period: "TODAY" })

      expect(report.totalIncome).toBe(0n)
      expect(report.totalProfit).toBe(0n)
      expect(report.transactionCount).toBe(0)
    })

    it("aggregates volume and profit correctly by category", async () => {
      const cash = await createTestAccount("Kas Kategori", "CASH", "0")

      const tx1 = await createProductTransaction({
        category: "PULSA",
        customerAccountId: cash.id,
        costAmount: "48000",
        sellingPrice: "50000",
        description: "Pulsa 50k",
      })
      createdTransactionIds.add(tx1.id)

      const tx2 = await createProductTransaction({
        category: "PLN_TOKEN",
        customerAccountId: cash.id,
        costAmount: "20500",
        sellingPrice: "23000",
        description: "Token 20k",
      })
      createdTransactionIds.add(tx2.id)

      const report = await getFinancialReport({ period: "TODAY" })

      const pulsaSummary = report.categorySummaries.find((c) => c.category === "PULSA")
      expect(pulsaSummary).toBeDefined()
      expect(pulsaSummary?.count).toBe(1)
      expect(pulsaSummary?.volume).toBe(50_000n)
      expect(pulsaSummary?.profit).toBe(2_000n)

      const plnSummary = report.categorySummaries.find((c) => c.category === "PLN_TOKEN")
      expect(plnSummary).toBeDefined()
      expect(plnSummary?.count).toBe(1)
      expect(plnSummary?.volume).toBe(23_000n)
      expect(plnSummary?.profit).toBe(2_500n)
    })

    it("calculates accurate date range filters", () => {
      const todayRange = getDateRangeForPeriod("TODAY")
      expect(todayRange.startDate.getHours()).toBe(0)
      expect(todayRange.endDate.getHours()).toBe(23)

      const customStart = new Date("2026-01-01")
      const customEnd = new Date("2026-01-10")
      const customRange = getDateRangeForPeriod("CUSTOM", customStart, customEnd)
      expect(customRange.startDate.getDate()).toBe(1)
      expect(customRange.endDate.getDate()).toBe(10)
    })

    it("includes all store-held Account types (CASH, BANK, EWALLET, QRIS, OTHER) in totalCashBalance", async () => {
      const accCash = await createTestAccount("Laci Tunai", "CASH", "100000")
      const accBank = await createTestAccount("Rekening BCA", "BANK", "250000")
      const accEwallet = await createTestAccount("Saldo DANA", "EWALLET", "50000")
      const accQris = await createTestAccount("QRIS Toko", "QRIS", "75000")
      const accOther = await createTestAccount("Titipan Voucher", "OTHER", "25000")

      const report = await getFinancialReport({ period: "TODAY" })

      expect(report.accountSummaries.some((a) => a.id === accCash.id && a.balance === 100_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === accBank.id && a.balance === 250_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === accEwallet.id && a.balance === 50_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === accQris.id && a.balance === 75_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === accOther.id && a.balance === 25_000n)).toBe(true)

      expect(report.totalCashBalance).toBeGreaterThanOrEqual(500_000n)
      expect(report.totalAssets).toBe(report.totalCashBalance)
      expect(report.totalAssets).toBeGreaterThanOrEqual(500_000n)
    })

    it("correctly resolves report period and date range for TODAY, 7DAYS, MONTH, and CUSTOM", async () => {
      const validPeriods = ["TODAY", "7DAYS", "MONTH", "CUSTOM"] as const
      for (const p of validPeriods) {
        const range = getDateRangeForPeriod(p)
        expect(range.startDate).toBeInstanceOf(Date)
        expect(range.endDate).toBeInstanceOf(Date)
        expect(range.startDate.getTime()).toBeLessThanOrEqual(range.endDate.getTime())
      }

      const reportToday = await getFinancialReport({ period: "TODAY" })
      expect(reportToday.period).toBe("TODAY")

      const report7Days = await getFinancialReport({ period: "7DAYS" })
      expect(report7Days.period).toBe("7DAYS")

      const reportMonth = await getFinancialReport({ period: "MONTH" })
      expect(reportMonth.period).toBe("MONTH")

      const reportCustom = await getFinancialReport({
        period: "CUSTOM",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-09-18"),
      })
      expect(reportCustom.period).toBe("CUSTOM")
    })
  })
}
