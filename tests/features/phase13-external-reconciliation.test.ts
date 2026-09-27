import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  createIncome,
} from "../../src/features/transactions/transaction-service"
import {
  getAccountReconciliationSummary,
  storeImportedExternalTransactions,
  listExternalTransactionsWithCandidates,
  matchExternalToExistingTransaction,
  recordUnmatchedAsIncome,
  recordUnmatchedAsExpense,
  ignoreExternalTransaction,
  ExternalTransactionAlreadyReconciledError,
} from "../../src/features/accounts/external-reconciliation"
import { recordBalanceSnapshot } from "../../src/features/accounts/provider-integration"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 13: External Balance Reconciliation", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 13: External Balance Reconciliation", () => {
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
        await database.externalTransaction.deleteMany({
          where: { matchedTransactionId: { in: txIds } },
        })
        await database.transaction.deleteMany({
          where: { id: { in: txIds } },
        })
        createdTransactionIds.clear()
      }

      if (accIds.length > 0) {
        await database.externalTransaction.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.externalBalanceSnapshot.deleteMany({
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
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("reconciliation summary shows NOT_SYNCED, DIFFERENCE, and MATCHED states with BigInt precision", async () => {
      const bank = await createAccount({
        name: "BCA Rekonsiliasi State",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bank.id)

      // 1. Initial: No external snapshot -> NOT_SYNCED
      const summaryInitial = await getAccountReconciliationSummary(bank.id)
      expect(summaryInitial.state).toBe("NOT_SYNCED")
      expect(summaryInitial.bookBalance).toBe(1000000n)
      expect(summaryInitial.actualBalance).toBeNull()
      expect(summaryInitial.difference).toBeNull()

      // 2. Snapshot with discrepancy -> DIFFERENCE (Aktual 1.050.000, Buku 1.000.000 -> Diff +50.000)
      await recordBalanceSnapshot({
        accountId: bank.id,
        balance: "1050000",
        source: "MANUAL",
      })

      const summaryDiff = await getAccountReconciliationSummary(bank.id)
      expect(summaryDiff.state).toBe("DIFFERENCE")
      expect(summaryDiff.actualBalance).toBe(1050000n)
      expect(summaryDiff.difference).toBe(50000n)

      // 3. Snapshot matches exactly -> MATCHED (1.000.000 == 1.000.000)
      await recordBalanceSnapshot({
        accountId: bank.id,
        balance: "1000000",
        source: "MANUAL",
      })

      const summaryMatched = await getAccountReconciliationSummary(bank.id)
      expect(summaryMatched.state).toBe("MATCHED")
      expect(summaryMatched.actualBalance).toBe(1000000n)
      expect(summaryMatched.difference).toBe(0n)
    })

    it("identifies matched, unmatched, and ambiguous candidates from imported rows", async () => {
      const bank = await createAccount({
        name: "Bank Mandiri Matching",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(bank.id)

      // Existing internal transactions
      const tx1 = await createIncome({
        accountId: bank.id,
        amount: "150000",
        description: "Transfer Masuk Budi",
        occurredAt: new Date("2026-09-15T10:00:00Z"),
      })
      createdTransactionIds.add(tx1.id)

      const tx2 = await createIncome({
        accountId: bank.id,
        amount: "150000",
        description: "Transfer Masuk Budi Duplicate",
        occurredAt: new Date("2026-09-16T10:00:00Z"),
      })
      createdTransactionIds.add(tx2.id)

      // Store external transactions from statement
      const [storedRow1, storedRow2] = await storeImportedExternalTransactions({
        accountId: bank.id,
        rows: [
          {
            date: new Date("2026-09-16T10:00:00Z"),
            description: "CR KREDIT BUDI",
            amount: 150000n,
            direction: "IN",
          },
          {
            date: new Date("2026-09-16T11:00:00Z"),
            description: "BIAYA ADM BULANAN",
            amount: 12500n,
            direction: "OUT",
          },
        ],
      })

      expect(storedRow1?.matchStatus).toBe("UNMATCHED")
      expect(storedRow2?.matchStatus).toBe("UNMATCHED")

      const items = await listExternalTransactionsWithCandidates(bank.id)
      const item1 = items.find((i) => i.id === storedRow1?.id)
      const item2 = items.find((i) => i.id === storedRow2?.id)

      // Row 1 matches two internal transactions of 150.000 -> isAmbiguous = true
      expect(item1?.isAmbiguous).toBe(true)
      expect(item1?.candidates.length).toBeGreaterThanOrEqual(2)

      // Row 2 has no internal transaction of 12.500 -> unmatched with 0 candidates
      expect(item2?.isAmbiguous).toBe(false)
      expect(item2?.candidates).toHaveLength(0)
    })

    it("manual user match updates status without creating duplicate transactions or changing ledger balance", async () => {
      const bank = await createAccount({
        name: "BRI Match Invariant",
        type: "BANK",
        openingBalance: "300000",
      })
      createdAccountIds.add(bank.id)

      const tx = await createIncome({
        accountId: bank.id,
        amount: "50000",
        description: "Setoran Tunai",
      })
      createdTransactionIds.add(tx.id)

      const [extRow] = await storeImportedExternalTransactions({
        accountId: bank.id,
        rows: [
          {
            date: new Date(),
            description: "SETORAN TUNAI CRM",
            amount: 50000n,
            direction: "IN",
          },
        ],
      })

      const beforeBalance = await getAccountBalance({ accountId: bank.id })
      const beforeTxCount = await database.transaction.count()
      const beforeLedgerCount = await database.ledgerEntry.count()

      // User explicitly matches
      await matchExternalToExistingTransaction({
        externalTransactionId: extRow!.id,
        transactionId: tx.id,
        note: "Cocok dengan transaksi setoran",
      })

      const afterBalance = await getAccountBalance({ accountId: bank.id })
      const afterTxCount = await database.transaction.count()
      const afterLedgerCount = await database.ledgerEntry.count()

      // INVARIANTS: no new transaction, no ledger changes
      expect(afterBalance).toBe(beforeBalance)
      expect(afterTxCount).toBe(beforeTxCount)
      expect(afterLedgerCount).toBe(beforeLedgerCount)

      const updated = await database.externalTransaction.findUnique({
        where: { id: extRow!.id },
      })
      expect(updated?.matchStatus).toBe("MATCHED")
      expect(updated?.reconcileAction).toBe("MATCHED_EXISTING")
      expect(updated?.matchedTransactionId).toBe(tx.id)
    })

    it("user action to record unmatched as income creates internal transaction and updates match status", async () => {
      const bank = await createAccount({
        name: "DANA Unmatched Income",
        type: "EWALLET",
        openingBalance: "100000",
      })
      createdAccountIds.add(bank.id)

      const [extRow] = await storeImportedExternalTransactions({
        accountId: bank.id,
        rows: [
          {
            date: new Date(),
            description: "CASHBACK PROMO DANA",
            amount: 25000n,
            direction: "IN",
          },
        ],
      })

      const beforeBalance = await getAccountBalance({ accountId: bank.id })

      const updatedExt = await recordUnmatchedAsIncome({
        externalTransactionId: extRow!.id,
        description: "Pendapatan Cashback Promo DANA",
      })

      createdTransactionIds.add(updatedExt.matchedTransactionId!)

      const afterBalance = await getAccountBalance({ accountId: bank.id })
      expect(afterBalance).toBe(beforeBalance + 25000n)

      expect(updatedExt.matchStatus).toBe("MATCHED")
      expect(updatedExt.reconcileAction).toBe("RECORDED_INCOME")
    })

    it("user action to record unmatched as expense creates internal transaction and updates match status", async () => {
      const bank = await createAccount({
        name: "BCA Unmatched Expense",
        type: "BANK",
        openingBalance: "200000",
      })
      createdAccountIds.add(bank.id)

      const [extRow] = await storeImportedExternalTransactions({
        accountId: bank.id,
        rows: [
          {
            date: new Date(),
            description: "BIAYA ADM KARTU",
            amount: 15000n,
            direction: "OUT",
          },
        ],
      })

      const beforeBalance = await getAccountBalance({ accountId: bank.id })

      const updatedExt = await recordUnmatchedAsExpense({
        externalTransactionId: extRow!.id,
        description: "Biaya Administrasi Kartu Debit BCA",
      })

      createdTransactionIds.add(updatedExt.matchedTransactionId!)

      const afterBalance = await getAccountBalance({ accountId: bank.id })
      expect(afterBalance).toBe(beforeBalance - 15000n)

      expect(updatedExt.matchStatus).toBe("MATCHED")
      expect(updatedExt.reconcileAction).toBe("RECORDED_EXPENSE")
    })

    it("ignore action marks item as ignored without changing ledger or creating transactions", async () => {
      const bank = await createAccount({
        name: "Bank Ignore Test",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(bank.id)

      const [extRow] = await storeImportedExternalTransactions({
        accountId: bank.id,
        rows: [
          {
            date: new Date(),
            description: "TRANSFER DARI REKENING PRIBADI",
            amount: 1000000n,
          },
        ],
      })

      const beforeBalance = await getAccountBalance({ accountId: bank.id })
      const beforeTxCount = await database.transaction.count()

      const ignored = await ignoreExternalTransaction({
        externalTransactionId: extRow!.id,
        note: "Bukan transaksi operasional konter",
      })

      const afterBalance = await getAccountBalance({ accountId: bank.id })
      const afterTxCount = await database.transaction.count()

      expect(afterBalance).toBe(beforeBalance)
      expect(afterTxCount).toBe(beforeTxCount)
      expect(ignored.matchStatus).toBe("IGNORED")
      expect(ignored.reconcileAction).toBe("IGNORED")
      expect(ignored.note).toBe("Bukan transaksi operasional konter")
      expect(ignored.reconciledAt).toBeInstanceOf(Date)
    })

    it("prevents repeated actions and duplicate transactions on already reconciled/ignored external transactions", async () => {
      const bank = await createAccount({
        name: "Idempotency Hardening Bank",
        type: "BANK",
        openingBalance: "100000",
      })
      createdAccountIds.add(bank.id)

      const [incomeRow, expenseRow, ignoreRow] = await storeImportedExternalTransactions({
        accountId: bank.id,
        rows: [
          {
            date: new Date(),
            description: "TRANSFER MASUK 50K",
            amount: 50000n,
            direction: "IN",
          },
          {
            date: new Date(),
            description: "BIAYA ADMIN 10K",
            amount: 10000n,
            direction: "OUT",
          },
          {
            date: new Date(),
            description: "MUTASI ABAIKAN 5K",
            amount: 5000n,
          },
        ],
      })

      const firstIncome = await recordUnmatchedAsIncome({
        externalTransactionId: incomeRow!.id,
      })
      createdTransactionIds.add(firstIncome.matchedTransactionId!)

      const txCountAfterFirst = await database.transaction.count()
      const ledgerCountAfterFirst = await database.ledgerEntry.count()

      await expect(
        recordUnmatchedAsIncome({
          externalTransactionId: incomeRow!.id,
        }),
      ).rejects.toThrow(ExternalTransactionAlreadyReconciledError)

      expect(await database.transaction.count()).toBe(txCountAfterFirst)
      expect(await database.ledgerEntry.count()).toBe(ledgerCountAfterFirst)

      const firstExpense = await recordUnmatchedAsExpense({
        externalTransactionId: expenseRow!.id,
      })
      createdTransactionIds.add(firstExpense.matchedTransactionId!)

      const txCountAfterExpense = await database.transaction.count()
      const ledgerCountAfterExpense = await database.ledgerEntry.count()

      await expect(
        recordUnmatchedAsExpense({
          externalTransactionId: expenseRow!.id,
        }),
      ).rejects.toThrow(ExternalTransactionAlreadyReconciledError)

      expect(await database.transaction.count()).toBe(txCountAfterExpense)
      expect(await database.ledgerEntry.count()).toBe(ledgerCountAfterExpense)

      await ignoreExternalTransaction({
        externalTransactionId: ignoreRow!.id,
        note: "Review catatan audit",
      })

      await expect(
        ignoreExternalTransaction({
          externalTransactionId: ignoreRow!.id,
        }),
      ).rejects.toThrow(ExternalTransactionAlreadyReconciledError)

      await expect(
        matchExternalToExistingTransaction({
          externalTransactionId: ignoreRow!.id,
          transactionId: firstIncome.matchedTransactionId!,
        }),
      ).rejects.toThrow(ExternalTransactionAlreadyReconciledError)
    })
  })
}
