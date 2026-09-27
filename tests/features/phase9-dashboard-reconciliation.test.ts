import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  recordCashReconciliation,
  listAccountReconciliations,
} from "../../src/features/accounts/cash-reconciliation"
import {
  createProvider,
  connectAccountProvider,
  recordBalanceSnapshot,
  getAccountIntegrationInfo,
} from "../../src/features/accounts/provider-integration"
import { getFinancialReport } from "../../src/features/reports/report-service"
import { getDatabase } from "../../src/lib/db"
import { formatRupiah } from "../../src/lib/money"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 9: Dashboard Account Sections & Cash Reconciliation", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 9: Dashboard Account Sections & Cash Reconciliation", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdProviderIds = new Set<string>()

    afterEach(async () => {
      const accIds = [...createdAccountIds]
      const provIds = [...createdProviderIds]

      if (accIds.length > 0) {
        await database.cashReconciliation.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.externalBalanceSnapshot.deleteMany({
          where: { providerConnection: { accountId: { in: accIds } } },
        })
        await database.providerConnection.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.ledgerEntry.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.account.deleteMany({
          where: { id: { in: accIds } },
        })
        createdAccountIds.clear()
      }

      if (provIds.length > 0) {
        await database.provider.deleteMany({
          where: { id: { in: provIds } },
        })
        createdProviderIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("dashboard groups active accounts correctly and computes total balance from ledger", async () => {
      const cash = await createAccount({
        name: "Kas Laci Toko",
        type: "CASH",
        openingBalance: "250000",
      })
      createdAccountIds.add(cash.id)

      const bca = await createAccount({
        name: "BCA Konter",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bca.id)

      const dana = await createAccount({
        name: "DANA Merchant",
        type: "EWALLET",
        openingBalance: "300000",
      })
      createdAccountIds.add(dana.id)

      const report = await getFinancialReport({ period: "TODAY" })

      const cashAccs = report.accountSummaries.filter((a) => a.type === "CASH" && a.isActive)
      const bankAccs = report.accountSummaries.filter((a) => a.type === "BANK" && a.isActive)
      const ewalletAccs = report.accountSummaries.filter((a) => a.type === "EWALLET" && a.isActive)
      const qrisAccs = report.accountSummaries.filter((a) => a.type === "QRIS" && a.isActive)

      expect(cashAccs.some((a) => a.id === cash.id)).toBe(true)
      expect(bankAccs.some((a) => a.id === bca.id)).toBe(true)
      expect(ewalletAccs.some((a) => a.id === dana.id)).toBe(true)
      expect(qrisAccs).toHaveLength(0)

      expect(report.totalCashBalance).toBeGreaterThanOrEqual(1550000n)
    })

    it("cash reconciliation calculates exact difference without creating LedgerEntry", async () => {
      const cash = await createAccount({
        name: "Kas Uji Rekonsiliasi",
        type: "CASH",
        openingBalance: "500000",
      })
      createdAccountIds.add(cash.id)

      const beforeLedgerCount = await database.ledgerEntry.count({
        where: { accountId: cash.id },
      })
      const beforeBalance = await getAccountBalance({ accountId: cash.id })
      expect(beforeBalance).toBe(500000n)

      // 1. Physical amount is less (shortage: 490000 vs 500000 = -10000)
      const recShortage = await recordCashReconciliation({
        accountId: cash.id,
        physicalAmount: "490000",
        note: "Uang kembalian kurang 10rb",
      })

      expect(recShortage.systemBalance).toBe(500000n)
      expect(recShortage.physicalAmount).toBe(490000n)
      expect(recShortage.difference).toBe(-10000n)
      expect(recShortage.note).toBe("Uang kembalian kurang 10rb")

      // 2. Physical amount matches exactly (0 selisih)
      const recExact = await recordCashReconciliation({
        accountId: cash.id,
        physicalAmount: "500000",
      })

      expect(recExact.difference).toBe(0n)

      // 3. LedgerEntry count & balance must be strictly identical (no silent changes!)
      const afterLedgerCount = await database.ledgerEntry.count({
        where: { accountId: cash.id },
      })
      const afterBalance = await getAccountBalance({ accountId: cash.id })

      expect(afterLedgerCount).toBe(beforeLedgerCount)
      expect(afterBalance).toBe(beforeBalance)

      const history = await listAccountReconciliations(cash.id)
      expect(history).toHaveLength(2)
      expect(history[0]?.difference).toBe(0n)
      expect(history[1]?.difference).toBe(-10000n)
    })

    it("provider snapshot display computes difference between actual and book balance", async () => {
      const provider = await createProvider({
        code: "MANDIRI_P9",
        name: "Bank Mandiri",
        category: "BANK",
      })
      createdProviderIds.add(provider.id)

      const mandiri = await createAccount({
        name: "Mandiri Bisnis",
        type: "BANK",
        openingBalance: "750000",
      })
      createdAccountIds.add(mandiri.id)

      const conn = await connectAccountProvider({
        accountId: mandiri.id,
        providerId: provider.id,
        externalAccountId: "1400012345678",
      })

      await recordBalanceSnapshot({
        providerConnectionId: conn.id,
        balance: "800000",
      })

      const info = await getAccountIntegrationInfo(mandiri.id)
      const bookBalance = await getAccountBalance({ accountId: mandiri.id })

      expect(info.isConnected).toBe(true)
      expect(info.latestActualBalance).toBe(800000n)
      expect(bookBalance).toBe(750000n)

      const diff = info.latestActualBalance! - bookBalance
      expect(diff).toBe(50000n)
      expect(formatRupiah(diff)).toBe("Rp 50.000")
    })
  })
}
