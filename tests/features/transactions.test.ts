import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
  setAccountActive,
} from "../../src/features/accounts/account-ledger"
import {
  cancelTransaction,
  createExpense,
  createIncome,
  listTransactions,
  TransactionAlreadyCancelledError,
} from "../../src/features/transactions/transaction-service"
import { InactiveAccountError } from "../../src/features/accounts/account-ledger"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("generic financial transactions", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("generic financial transactions", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdTransactionIds = new Set<string>()

    async function createTestAccount(name: string, openingBalance = "0") {
      const account = await createAccount({
        name,
        type: "CASH",
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

    it("records generic income atomically and increases account balance", async () => {
      // Given: an active account with 10.000 opening balance
      const account = await createTestAccount("Kas Masuk", "10000")

      // When: income transaction of 50.000 is recorded
      const tx = await createIncome({
        accountId: account.id,
        amount: "50000",
        description: "Komisi Penjualan",
      })
      createdTransactionIds.add(tx.id)

      // Then: transaction is COMPLETED, ledger has IN entry, balance is 60.000
      expect(tx.status).toBe("COMPLETED")
      expect(tx.category).toBe("INCOME")
      expect(tx.grossAmount).toBe(50_000n)
      expect(tx.profitAmount).toBe(50_000n)

      const balance = await getAccountBalance({ accountId: account.id })
      expect(balance).toBe(60_000n)

      const entries = await database.ledgerEntry.findMany({ where: { transactionId: tx.id } })
      expect(entries).toHaveLength(1)
      expect(entries[0]?.direction).toBe("IN")
      expect(entries[0]?.amount).toBe(50_000n)
    })

    it("records generic expense atomically and decreases account balance", async () => {
      // Given: an active account with 100.000 opening balance
      const account = await createTestAccount("Kas Keluar", "100000")

      // When: expense transaction of 40.000 is recorded
      const tx = await createExpense({
        accountId: account.id,
        amount: "40000",
        description: "Beli Kertas Struk",
      })
      createdTransactionIds.add(tx.id)

      // Then: transaction is COMPLETED, ledger has OUT entry, balance is 60.000
      expect(tx.status).toBe("COMPLETED")
      expect(tx.category).toBe("EXPENSE")
      expect(tx.grossAmount).toBe(40_000n)
      expect(tx.profitAmount).toBe(-40_000n)

      const balance = await getAccountBalance({ accountId: account.id })
      expect(balance).toBe(60_000n)

      const entries = await database.ledgerEntry.findMany({ where: { transactionId: tx.id } })
      expect(entries).toHaveLength(1)
      expect(entries[0]?.direction).toBe("OUT")
      expect(entries[0]?.amount).toBe(40_000n)
    })

    it("rejects income or expense on inactive accounts", async () => {
      // Given: an inactive account
      const account = await createTestAccount("Akun Pasif")
      await setAccountActive({ accountId: account.id, isActive: false })

      // When / Then: creating income or expense fails with InactiveAccountError
      await expect(
        createIncome({
          accountId: account.id,
          amount: "10000",
          description: "Pendapatan Ditolak",
        }),
      ).rejects.toBeInstanceOf(InactiveAccountError)

      await expect(
        createExpense({
          accountId: account.id,
          amount: "10000",
          description: "Pengeluaran Ditolak",
        }),
      ).rejects.toBeInstanceOf(InactiveAccountError)
    })

    it("cancels transaction by creating reversal ledger entries and preserving original data", async () => {
      // Given: an account with an income transaction
      const account = await createTestAccount("Kas Batal", "50000")
      const tx = await createIncome({
        accountId: account.id,
        amount: "20000",
        description: "Salah Catat",
      })
      createdTransactionIds.add(tx.id)

      // When: transaction is cancelled
      const cancelled = await cancelTransaction({
        transactionId: tx.id,
        reason: "Pelanggan membatalkan pesanan",
      })

      // Then: transaction is CANCELLED with reason & timestamp, balance is reverted to 50.000
      expect(cancelled.status).toBe("CANCELLED")
      expect(cancelled.cancelReason).toBe("Pelanggan membatalkan pesanan")
      expect(cancelled.cancelledAt).toBeInstanceOf(Date)

      const balance = await getAccountBalance({ accountId: account.id })
      expect(balance).toBe(50_000n)

      // Ledger has both original IN and reversal OUT
      const entries = await database.ledgerEntry.findMany({
        where: { transactionId: tx.id },
        orderBy: { occurredAt: "asc" },
      })
      expect(entries).toHaveLength(2)
      expect(entries[0]?.direction).toBe("IN")
      expect(entries[1]?.direction).toBe("OUT")
      expect(entries[1]?.description).toBe("[BATAL] Salah Catat")
    })

    it("prevents cancelling a transaction twice", async () => {
      // Given: a cancelled transaction
      const account = await createTestAccount("Kas Double Cancel")
      const tx = await createIncome({
        accountId: account.id,
        amount: "10000",
        description: "Uji Double Cancel",
      })
      createdTransactionIds.add(tx.id)

      await cancelTransaction({
        transactionId: tx.id,
        reason: "Batal pertama",
      })

      // When / Then: cancelling again throws TransactionAlreadyCancelledError
      await expect(
        cancelTransaction({
          transactionId: tx.id,
          reason: "Batal kedua",
        }),
      ).rejects.toBeInstanceOf(TransactionAlreadyCancelledError)
    })

    it("supports search and filtering in listTransactions", async () => {
      // Given: multiple transactions
      const account = await createTestAccount("Kas Filter")
      const tx1 = await createIncome({
        accountId: account.id,
        amount: "15000",
        description: "Setoran Modal",
      })
      createdTransactionIds.add(tx1.id)

      const tx2 = await createExpense({
        accountId: account.id,
        amount: "5000",
        description: "Beli Spidol",
      })
      createdTransactionIds.add(tx2.id)

      // When: filtering by category
      const incomeOnly = await listTransactions({ category: "INCOME" })
      expect(incomeOnly.some((t) => t.id === tx1.id)).toBe(true)
      expect(incomeOnly.some((t) => t.id === tx2.id)).toBe(false)

      // When: searching description
      const searchRes = await listTransactions({ search: "Spidol" })
      expect(searchRes.some((t) => t.id === tx2.id)).toBe(true)
      expect(searchRes.some((t) => t.id === tx1.id)).toBe(false)
    })
  })
}
