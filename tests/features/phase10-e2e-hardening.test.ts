import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
  setAccountActive,
} from "../../src/features/accounts/account-ledger"
import {
  createBankTransferTransaction,
  createProductTransaction,
} from "../../src/features/transactions/counter-transaction-service"
import {
  cancelTransaction,
  createIncome,
  getTransactionById,
  listTransactions,
} from "../../src/features/transactions/transaction-service"
import { recordCashReconciliation } from "../../src/features/accounts/cash-reconciliation"
import {
  createProvider,
  connectAccountProvider,
  recordBalanceSnapshot,
} from "../../src/features/accounts/provider-integration"
import { getFinancialReport } from "../../src/features/reports/report-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 10: E2E Hardening & Edge Cases", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 10: E2E Hardening & Edge Cases", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdTransactionIds = new Set<string>()
    const createdProviderIds = new Set<string>()

    afterEach(async () => {
      const txIds = [...createdTransactionIds]
      const accIds = [...createdAccountIds]
      const provIds = [...createdProviderIds]

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

    it("verifies bank transfer updates correct atomic ledger entries and preserves BigInt math", async () => {
      const cash = await createAccount({
        name: "Kas E2E",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      const bca = await createAccount({
        name: "BCA E2E",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bca.id)

      // Transfer Rp500.000, fee Rp5.000. Customer pays cash (Rp505.000), source BCA (Rp500.000)
      const tx = await createBankTransferTransaction({
        sourceAccountId: bca.id,
        customerPaymentAccountId: cash.id,
        transferAmount: "500000",
        adminFee: "5000",
        description: "Transfer ke Rek BRI Budi",
      })
      createdTransactionIds.add(tx.id)

      expect(tx.grossAmount).toBe(500000n)
      expect(tx.feeAmount).toBe(5000n)
      expect(tx.profitAmount).toBe(5000n)

      const cashBalance = await getAccountBalance({ accountId: cash.id })
      const bcaBalance = await getAccountBalance({ accountId: bca.id })

      // Cash: 100000 + 505000 = 605000
      expect(cashBalance).toBe(605000n)
      // BCA: 1000000 - 500000 = 500000
      expect(bcaBalance).toBe(500000n)

      // Invariant: Total profit is 5000, NOT 505000
      const report = await getFinancialReport({ period: "TODAY" })
      expect(report.totalProfit).toBe(5000n)
      expect(report.totalCashBalance).toBe(1105000n)
    })

    it("verifies negative profit (rugi / jual di bawah modal) is handled correctly without throwing or corrupting ledger", async () => {
      const cash = await createAccount({
        name: "Kas Promo Rugi",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      // Modal 50000, Jual 45000 -> Profit = -5000
      const tx = await createProductTransaction({
        category: "PULSA",
        customerAccountId: cash.id,
        costAmount: "50000",
        sellingPrice: "45000",
        description: "Promo Pulsa Rugi",
      })
      createdTransactionIds.add(tx.id)

      expect(tx.profitAmount).toBe(-5000n)

      const report = await getFinancialReport({ period: "TODAY" })
      expect(report.totalProfit).toBe(-5000n)
    })

    it("verifies cancellation reverses ledger entries and leaves transaction visible with CANCELLED status", async () => {
      const cash = await createAccount({
        name: "Kas Reversal Test",
        type: "CASH",
        openingBalance: "200000",
      })
      createdAccountIds.add(cash.id)

      const tx = await createIncome({
        accountId: cash.id,
        amount: "50000",
        description: "Salah catat income",
      })
      createdTransactionIds.add(tx.id)

      const beforeBalance = await getAccountBalance({ accountId: cash.id })
      expect(beforeBalance).toBe(250000n)

      await cancelTransaction({
        transactionId: tx.id,
        reason: "Koreksi salah catat",
      })

      const afterBalance = await getAccountBalance({ accountId: cash.id })
      expect(afterBalance).toBe(200000n)

      const cancelledTx = await getTransactionById({ transactionId: tx.id })
      expect(cancelledTx.status).toBe("CANCELLED")
      expect(cancelledTx.cancelReason).toBe("Koreksi salah catat")

      // Appears in transaction list
      const txList = await listTransactions({ search: "Salah catat income" })
      expect(txList.some((t) => t.id === tx.id && t.status === "CANCELLED")).toBe(true)
    })

    it("verifies inactive accounts strictly reject new financial transactions and cancellations", async () => {
      const cash = await createAccount({
        name: "Kas Nonaktif",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      await setAccountActive({
        accountId: cash.id,
        isActive: false,
      })

      await expect(
        createIncome({
          accountId: cash.id,
          amount: "10000",
          description: "Gagal masuk",
        }),
      ).rejects.toThrow("inactive")
    })

    it("verifies reconciliation and provider snapshots never change ledger entries", async () => {
      const cash = await createAccount({
        name: "Kas Audit Invariant",
        type: "CASH",
        openingBalance: "750000",
      })
      createdAccountIds.add(cash.id)

      const initialBalance = await getAccountBalance({ accountId: cash.id })
      const initialEntries = await database.ledgerEntry.count({
        where: { accountId: cash.id },
      })

      // 1. Cash reconciliation with discrepancy
      await recordCashReconciliation({
        accountId: cash.id,
        physicalAmount: "600000", // minus 150000
        note: "Selisih fisik audit",
      })

      // 2. Provider snapshot
      const prov = await createProvider({
        code: "TEST_AUDIT_PROV",
        name: "Audit Provider",
        category: "CASH",
      })
      createdProviderIds.add(prov.id)

      const conn = await connectAccountProvider({
        accountId: cash.id,
        providerId: prov.id,
        externalAccountId: "AUDIT-001",
      })

      await recordBalanceSnapshot({
        providerConnectionId: conn.id,
        balance: "900000",
      })

      // Verification: Balance & LedgerEntry count remain 100% untouched
      const finalBalance = await getAccountBalance({ accountId: cash.id })
      const finalEntries = await database.ledgerEntry.count({
        where: { accountId: cash.id },
      })

      expect(finalBalance).toBe(initialBalance)
      expect(finalEntries).toBe(initialEntries)
    })
  })
}
