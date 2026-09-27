import { afterAll, afterEach, describe, expect, it } from "vitest"

import { createAccount } from "../../src/features/accounts/account-ledger"
import { getFinancialReport } from "../../src/features/reports/report-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Total Aset Financial Metric", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Total Aset Financial Metric", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()

    afterEach(async () => {
      const accIds = [...createdAccountIds]
      if (accIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { accountId: { in: accIds } } })
        await database.account.deleteMany({ where: { id: { in: accIds } } })
        createdAccountIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("verifies Total Aset equals canonical total account balance across CASH, BANK, EWALLET, QRIS, OTHER", async () => {
      const cash = await createAccount({ name: "Kas Toko Aset", type: "CASH", openingBalance: "150000" })
      const bank = await createAccount({ name: "BCA Aset", type: "BANK", openingBalance: "500000" })
      const ewallet = await createAccount({ name: "DANA Aset", type: "EWALLET", openingBalance: "200000" })
      const qris = await createAccount({ name: "QRIS Aset", type: "QRIS", openingBalance: "100000" })
      const other = await createAccount({ name: "Voucher Aset", type: "OTHER", openingBalance: "50000" })

      createdAccountIds.add(cash.id)
      createdAccountIds.add(bank.id)
      createdAccountIds.add(ewallet.id)
      createdAccountIds.add(qris.id)
      createdAccountIds.add(other.id)

      const report = await getFinancialReport({ period: "TODAY" })

      // Exact canonical derivation: totalAssets must be strictly equal to totalCashBalance
      expect(report.totalAssets).toBe(report.totalCashBalance)
      expect(report.totalAssets).toBeGreaterThanOrEqual(1_000_000n)

      // Verify all 5 account types are included in account summaries
      expect(report.accountSummaries.some((a) => a.id === cash.id && a.balance === 150_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === bank.id && a.balance === 500_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === ewallet.id && a.balance === 200_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === qris.id && a.balance === 100_000n)).toBe(true)
      expect(report.accountSummaries.some((a) => a.id === other.id && a.balance === 50_000n)).toBe(true)

      // Verify other metrics remain intact
      expect(typeof report.totalVolume).toBe("bigint")
      expect(typeof report.totalProfit).toBe("bigint")
      expect(typeof report.totalIncome).toBe("bigint")
      expect(typeof report.totalExpense).toBe("bigint")
    })
  })
}
