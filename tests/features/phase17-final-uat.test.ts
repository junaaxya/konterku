import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
  setAccountActive,
  renameAccount,
} from "../../src/features/accounts/account-ledger"
import {
  createIncome,
  createExpense,
  cancelTransaction,
  getTransactionById,
  listTransactions,
} from "../../src/features/transactions/transaction-service"
import {
  createBankTransferTransaction,
  createProductTransaction,
  createCashWithdrawalTransaction,
  createEwalletTopupTransaction,
} from "../../src/features/transactions/counter-transaction-service"
import { recordCashReconciliation } from "../../src/features/accounts/cash-reconciliation"
import {
  recordBalanceSnapshot,
  getAccountIntegrationInfo,
} from "../../src/features/accounts/provider-integration"
import { getFinancialReport } from "../../src/features/reports/report-service"
import { buildReceiptData } from "../../src/features/receipts/receipt-domain"
import { buildEscPosPayload, buildEscPosPlainText } from "../../src/features/receipts/escpos"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 17: Final MVP End-to-End UAT", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 17: Final MVP End-to-End UAT", () => {
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
        await database.cashReconciliation.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.externalBalanceSnapshot.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.localBankConnection.deleteMany({
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

    it("Flow 1 & 8: Account lifecycle (create, edit, deactivate, reactivate, balance)", async () => {
      // Create
      const account = await createAccount({
        name: "Kas Laci Utama",
        type: "CASH",
        openingBalance: "500000",
      })
      createdAccountIds.add(account.id)

      let balance = await getAccountBalance({ accountId: account.id })
      expect(balance).toBe(500000n)

      // Rename
      const renamed = await renameAccount({
        accountId: account.id,
        name: "Kas Laci Utama Toko",
      })
      expect(renamed.name).toBe("Kas Laci Utama Toko")

      // Deactivate
      await setAccountActive({ accountId: account.id, isActive: false })
      await expect(
        createIncome({
          accountId: account.id,
          amount: "100000",
          description: "Gagal karena nonaktif",
        }),
      ).rejects.toThrow("inactive")

      // Reactivate
      await setAccountActive({ accountId: account.id, isActive: true })
      const inc = await createIncome({
        accountId: account.id,
        amount: "100000",
        description: "Berhasil setelah aktif",
      })
      createdTransactionIds.add(inc.id)

      balance = await getAccountBalance({ accountId: account.id })
      expect(balance).toBe(600000n)
    })

    it("Flow 2 & 3: Generic & Counter transactions with exact ledger movement and negative profit", async () => {
      const cash = await createAccount({
        name: "Kas UAT",
        type: "CASH",
        openingBalance: "200000",
      })
      createdAccountIds.add(cash.id)

      const bca = await createAccount({
        name: "BCA UAT",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(bca.id)

      // Generic Income: Cash +150.000
      const inc = await createIncome({
        accountId: cash.id,
        amount: "150000",
        description: "Bonus Penjualan",
      })
      createdTransactionIds.add(inc.id)

      // Generic Expense: Cash -50.000
      const exp = await createExpense({
        accountId: cash.id,
        amount: "50000",
        description: "Beli Perlengkapan",
      })
      createdTransactionIds.add(exp.id)

      // Counter Bank Transfer: Rp500.000, fee Rp5.000
      const tf = await createBankTransferTransaction({
        sourceAccountId: bca.id,
        customerPaymentAccountId: cash.id,
        transferAmount: "500000",
        adminFee: "5000",
        description: "Transfer ke Mandiri Pelanggan",
      })
      createdTransactionIds.add(tf.id)

      // Counter Tarik Tunai: Rp200.000, fee Rp5.000
      const tt = await createCashWithdrawalTransaction({
        sourceCashAccountId: cash.id,
        customerSettlementAccountId: bca.id,
        cashAmount: "200000",
        adminFee: "5000",
        description: "Tarik Tunai Kartu BCA",
      })
      createdTransactionIds.add(tt.id)

      // Counter Top Up E-Wallet: Rp100.000, fee Rp2.000
      const tu = await createEwalletTopupTransaction({
        shopSourceAccountId: bca.id,
        customerPaymentAccountId: cash.id,
        topupAmount: "100000",
        adminFee: "2000",
        description: "Top Up DANA 08123456789",
      })
      createdTransactionIds.add(tu.id)

      // Product Sale with Negative Profit (Promo Rugi)
      const pr = await createProductTransaction({
        category: "PULSA",
        customerAccountId: cash.id,
        costAmount: "50000",
        sellingPrice: "47000", // Loss -3.000
        description: "Pulsa Promo Rugi",
      })
      createdTransactionIds.add(pr.id)
      expect(pr.profitAmount).toBe(-3000n)

      // Verify Ledger Balances
      const finalCash = await getAccountBalance({ accountId: cash.id })
      const finalBca = await getAccountBalance({ accountId: bca.id })

      // Cash: 200000 + 150000 (inc) - 50000 (exp) + 505000 (tf in) - 200000 (tt cash out) + 102000 (tu in) + 47000 (pr in) = 754000
      expect(finalCash).toBe(754000n)

      // BCA: 2000000 - 500000 (tf out) + 205000 (tt in) - 100000 (tu out) = 1605000
      expect(finalBca).toBe(1605000n)

      // Profit Check: 150000 (inc) - 50000 (exp) + 5000 (tf fee) + 5000 (tt fee) + 2000 (tu fee) - 3000 (pr loss) = 109000
      const report = await getFinancialReport({ period: "TODAY" })
      expect(report.totalProfit).toBe(109000n)
      expect(report.totalCashBalance).toBe(754000n + 1605000n)
    })

    it("Flow 4 & 6: Cancellation reverses ledger and excludes transaction from reports", async () => {
      const bank = await createAccount({
        name: "Bank Reversal UAT",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bank.id)

      const tx = await createIncome({
        accountId: bank.id,
        amount: "250000",
        description: "Transaksi UAT Batal",
      })
      createdTransactionIds.add(tx.id)

      const repBefore = await getFinancialReport({ period: "TODAY" })
      expect(repBefore.totalIncome).toBeGreaterThanOrEqual(250000n)

      // Cancel
      await cancelTransaction({
        transactionId: tx.id,
        reason: "Pembatalan UAT Terverifikasi",
      })

      // Ledger restored
      const balanceAfter = await getAccountBalance({ accountId: bank.id })
      expect(balanceAfter).toBe(1000000n)

      // Excluded from report income
      const repAfter = await getFinancialReport({ period: "TODAY" })
      expect(repAfter.transactions.some((t) => t.id === tx.id)).toBe(false)

      // But visible in listTransactions with CANCELLED status
      const txs = await listTransactions({ search: "Transaksi UAT Batal" })
      expect(txs.some((t) => t.id === tx.id && t.status === "CANCELLED")).toBe(true)
    })

    it("Flow 5: Manual Balance Sync creates snapshot without mutating ledger", async () => {
      const ewallet = await createAccount({
        name: "ShopeePay UAT",
        type: "EWALLET",
        openingBalance: "400000",
      })
      createdAccountIds.add(ewallet.id)

      const beforeLedger = await getAccountBalance({ accountId: ewallet.id })
      const beforeEntries = await database.ledgerEntry.count({ where: { accountId: ewallet.id } })

      // Record observed actual balance
      const snap = await recordBalanceSnapshot({
        accountId: ewallet.id,
        balance: "425000",
        source: "MANUAL",
        note: "Dicek dari aplikasi Shopee",
      })

      expect(snap.balance).toBe(425000n)
      expect(snap.source).toBe("MANUAL")

      // Ledger must remain untouched
      const afterLedger = await getAccountBalance({ accountId: ewallet.id })
      const afterEntries = await database.ledgerEntry.count({ where: { accountId: ewallet.id } })
      expect(afterLedger).toBe(beforeLedger)
      expect(afterEntries).toBe(beforeEntries)

      const info = await getAccountIntegrationInfo(ewallet.id)
      expect(info.latestActualBalance).toBe(425000n)
      expect(info.latestActualBalance! - afterLedger).toBe(25000n)
    })

    it("Flow 7: Receipt generation and reprint remain read-only with 58mm ESC/POS layout", async () => {
      const cash = await createAccount({
        name: "Kas Struk UAT",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      const tx = await createIncome({
        accountId: cash.id,
        amount: "50000",
        description: "Penjualan Struk UAT",
      })
      createdTransactionIds.add(tx.id)

      const txDetail = await getTransactionById({ transactionId: tx.id })
      const receiptData = buildReceiptData(txDetail)

      expect(receiptData.storeName).toBe("KONTERKU")
      expect(receiptData.totalPaid).toBe("Rp 50.000")
      expect(receiptData.isCancelled).toBe(false)

      const plainText = buildEscPosPlainText(receiptData, 32)
      expect(plainText).toContain("KONTERKU")
      expect(plainText).toContain("50.000")

      const payload = buildEscPosPayload(receiptData, 32)
      expect(payload[0]).toBe(0x1B) // ESC
      expect(payload[1]).toBe(0x40) // @

      // Reprint read-only test
      const beforeTxCount = await database.transaction.count()
      const beforeLedgerCount = await database.ledgerEntry.count()

      const reprintDetail = await getTransactionById({ transactionId: tx.id })
      expect(reprintDetail.id).toBe(tx.id)

      expect(await database.transaction.count()).toBe(beforeTxCount)
      expect(await database.ledgerEntry.count()).toBe(beforeLedgerCount)
    })

    it("Flow 8: Cash reconciliation records audit discrepancy without mutating ledger", async () => {
      const cash = await createAccount({
        name: "Kas Fisik Laci UAT",
        type: "CASH",
        openingBalance: "300000",
      })
      createdAccountIds.add(cash.id)

      const beforeBalance = await getAccountBalance({ accountId: cash.id })
      expect(beforeBalance).toBe(300000n)

      // Physical cash count: Rp295.000 (shortage -5.000)
      const rec = await recordCashReconciliation({
        accountId: cash.id,
        physicalAmount: "295000",
        note: "Selisih uang koin",
      })

      expect(rec.systemBalance).toBe(300000n)
      expect(rec.physicalAmount).toBe(295000n)
      expect(rec.difference).toBe(-5000n)

      // Invariant: Balance in ledger MUST NOT change
      const afterBalance = await getAccountBalance({ accountId: cash.id })
      expect(afterBalance).toBe(300000n)
    })
  })
}
