import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
  setAccountActive,
} from "../../src/features/accounts/account-ledger"
import { createCustomer } from "../../src/features/receivables/receivable-service"
import {
  createBankTransferTransaction,
  createCashWithdrawalTransaction,
  createEwalletTopupTransaction,
  createProductTransaction,
} from "../../src/features/transactions/counter-transaction-service"
import {
  cancelTransaction,
  getTransactionById,
} from "../../src/features/transactions/transaction-service"
import { InactiveAccountError } from "../../src/features/accounts/account-ledger"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("counter transactions", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("counter transactions", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdTransactionIds = new Set<string>()

    async function createTestAccount(name: string, type: "CASH" | "BANK" | "EWALLET" = "CASH", openingBalance = "0") {
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
        await database.receivable.deleteMany({ where: { transactionId: { in: txIds } } })
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

    // 1. Pulsa / Paket Data / Token / PPOB / Penjualan
    it("records Pulsa transaction with modal, selling price, customer payment IN, and correct profit", async () => {
      // Given: Cash account with 0 balance
      const cash = await createTestAccount("Kas Konter", "CASH", "0")
      const source = await createTestAccount("Modal Pulsa", "BANK", "100000")

      // When: Pulsa 50k sold for 52k, modal 48.5k
      const tx = await createProductTransaction({
          category: "PULSA",
          customerAccountId: cash.id,
          costAccountId: source.id,
        costAmount: "48500",
        sellingPrice: "52000",
        description: "Pulsa Telkomsel 50k (08123456789)",
      })
      createdTransactionIds.add(tx.id)

      // Then: Profit = 52.000 - 48.500 = 3.500
      expect(tx.status).toBe("COMPLETED")
      expect(tx.category).toBe("PULSA")
      expect(tx.grossAmount).toBe(52_000n)
      expect(tx.costAmount).toBe(48_500n)
      expect(tx.profitAmount).toBe(3_500n)

      const balance = await getAccountBalance({ accountId: cash.id })
      expect(balance).toBe(52_000n)
      expect(await getAccountBalance({ accountId: source.id })).toBe(51_500n)

      const entries = await database.ledgerEntry.findMany({ where: { transactionId: tx.id } })
      expect(entries).toHaveLength(2)
      expect(entries.find((entry) => entry.accountId === source.id)?.direction).toBe("OUT")
      expect(entries.find((entry) => entry.accountId === source.id)?.amount).toBe(48_500n)
      expect(entries.find((entry) => entry.accountId === cash.id)?.direction).toBe("IN")
      expect(entries.find((entry) => entry.accountId === cash.id)?.amount).toBe(52_000n)
    })

    // 2. Transfer Bank Pelanggan
    it("records Transfer Bank with Cash IN total, Bank OUT transfer amount, and Admin profit", async () => {
      // Given: Cash (0), BCA (1.000.000)
      const cash = await createTestAccount("Kas Tunai", "CASH", "0")
      const bca = await createTestAccount("BCA Toko", "BANK", "1000000")

      // When: Transfer 500k + Admin 5k paid via Cash
      const tx = await createBankTransferTransaction({
        sourceAccountId: bca.id,
        customerPaymentAccountId: cash.id,
        transferAmount: "500000",
        adminFee: "5000",
        description: "Transfer ke BRI 123456 an Budi",
      })
      createdTransactionIds.add(tx.id)

      // Then:
      // Gross = 500.000 (volume transfer)
      // Profit = 5.000 (bukan 505.000!)
      expect(tx.grossAmount).toBe(500_000n)
      expect(tx.feeAmount).toBe(5_000n)
      expect(tx.profitAmount).toBe(5_000n)

      // Cash receives +505.000
      const cashBalance = await getAccountBalance({ accountId: cash.id })
      expect(cashBalance).toBe(505_000n)

      // BCA is deducted -500.000 (1.000.000 - 500.000 = 500.000)
      const bcaBalance = await getAccountBalance({ accountId: bca.id })
      expect(bcaBalance).toBe(500_000n)

      // Total ledger entries = 2
      const entries = await database.ledgerEntry.findMany({
        where: { transactionId: tx.id },
        orderBy: { direction: "asc" },
      })
      expect(entries).toHaveLength(2)
      const inEntry = entries.find((e) => e.direction === "IN")
      const outEntry = entries.find((e) => e.direction === "OUT")

      expect(inEntry?.accountId).toBe(cash.id)
      expect(inEntry?.amount).toBe(505_000n)

      expect(outEntry?.accountId).toBe(bca.id)
      expect(outEntry?.amount).toBe(500_000n)
    })

    // 3. Tarik Tunai
    it("records Tarik Tunai with Cash OUT, Bank/QRIS IN + fee, and admin profit", async () => {
      // Given: Cash (1.000.000), BCA (0)
      const cash = await createTestAccount("Laci Kas", "CASH", "1000000")
      const bca = await createTestAccount("BCA Penerima", "BANK", "0")

      // When: Tarik tunai 200k + admin 5k (customer transfers 205k to BCA)
      const tx = await createCashWithdrawalTransaction({
        sourceCashAccountId: cash.id,
        customerSettlementAccountId: bca.id,
        cashAmount: "200000",
        adminFee: "5000",
        description: "Tarik Tunai Kartu BCA",
      })
      createdTransactionIds.add(tx.id)

      // Then:
      // Profit = 5.000
      expect(tx.profitAmount).toBe(5_000n)

      // Cash: 1.000.000 - 200.000 = 800.000
      const cashBal = await getAccountBalance({ accountId: cash.id })
      expect(cashBal).toBe(800_000n)

      // BCA: 0 + 205.000 = 205.000
      const bcaBal = await getAccountBalance({ accountId: bca.id })
      expect(bcaBal).toBe(205_000n)
    })

    // 4. Top Up E-Wallet
    it("records Top Up E-Wallet correctly with source OUT and payment IN", async () => {
      // Given: Cash (0), DANA Master (500.000)
      const cash = await createTestAccount("Uang Kas", "CASH", "0")
      const masterWallet = await createTestAccount("DANA Merchant", "EWALLET", "500000")

      // When: Top up DANA 100k + admin 2k, customer pays Cash
      const tx = await createEwalletTopupTransaction({
        shopSourceAccountId: masterWallet.id,
        customerPaymentAccountId: cash.id,
        topupAmount: "100000",
        adminFee: "2000",
        description: "Topup DANA 085712345678",
      })
      createdTransactionIds.add(tx.id)

      // Then:
      expect(tx.profitAmount).toBe(2_000n)

      // Cash = +102.000
      expect(await getAccountBalance({ accountId: cash.id })).toBe(102_000n)

      // Master wallet = 500.000 - 100.000 = 400.000
      expect(await getAccountBalance({ accountId: masterWallet.id })).toBe(400_000n)
    })

    // 5. Inactive Account Rejection
    it("rejects counter transactions when any involved account is inactive", async () => {
      const activeAcc = await createTestAccount("Aktif", "CASH")
      const inactiveAcc = await createTestAccount("Nonaktif", "BANK")
      await setAccountActive({ accountId: inactiveAcc.id, isActive: false })

      // Product transaction on inactive
      await expect(
        createProductTransaction({
          category: "PULSA",
          customerAccountId: inactiveAcc.id,
          costAmount: "10000",
          sellingPrice: "12000",
          description: "Gagal pulsa",
        }),
      ).rejects.toBeInstanceOf(InactiveAccountError)

      // Bank transfer where source is inactive
      await expect(
        createBankTransferTransaction({
          sourceAccountId: inactiveAcc.id,
          customerPaymentAccountId: activeAcc.id,
          transferAmount: "50000",
          adminFee: "5000",
          description: "Gagal transfer",
        }),
      ).rejects.toBeInstanceOf(InactiveAccountError)

      // Bank transfer where payment is inactive
      await expect(
        createBankTransferTransaction({
          sourceAccountId: activeAcc.id,
          customerPaymentAccountId: inactiveAcc.id,
          transferAmount: "50000",
          adminFee: "5000",
          description: "Gagal transfer 2",
        }),
      ).rejects.toBeInstanceOf(InactiveAccountError)
    })

    // 6. Cancellation & Reversal of multi-ledger transaction
    it("reverses all ledger movements when a multi-account counter transaction is cancelled", async () => {
      const cash = await createTestAccount("Kas Batal", "CASH", "0")
      const bca = await createTestAccount("BCA Batal", "BANK", "1000000")

      const tx = await createBankTransferTransaction({
        sourceAccountId: bca.id,
        customerPaymentAccountId: cash.id,
        transferAmount: "300000",
        adminFee: "5000",
        description: "Transfer salah rekening",
      })
      createdTransactionIds.add(tx.id)

      expect(await getAccountBalance({ accountId: cash.id })).toBe(305_000n)
      expect(await getAccountBalance({ accountId: bca.id })).toBe(700_000n)

      // Cancel
      const cancelled = await cancelTransaction({
        transactionId: tx.id,
        reason: "Salah nomor rekening tujuan",
      })

      expect(cancelled.status).toBe("CANCELLED")

      // Both balances must return exactly to opening balance
      expect(await getAccountBalance({ accountId: cash.id })).toBe(0n)
      expect(await getAccountBalance({ accountId: bca.id })).toBe(1_000_000n)

      // Ledger has 4 entries (2 original + 2 reversals)
      const detail = await getTransactionById({ transactionId: tx.id })
      expect(detail.ledgerEntries).toHaveLength(4)
    })

      it.each([
      { category: "DATA_PACKAGE", name: "Paket Data 10GB", cost: "35000", sell: "40000", profit: 5_000n },
      { category: "PLN_TOKEN", name: "Token Listrik 20k", cost: "20500", sell: "23000", profit: 2_500n },
      { category: "PPOB", name: "Bayar Tagihan PDAM", cost: "75000", sell: "77500", profit: 2_500n },
      { category: "PRODUCT_SALE", name: "Kabel Data Type-C", cost: "15000", sell: "25000", profit: 10_000n },
      { category: "OTHER", name: "Jasa Ketik Dokumen", cost: "0", sell: "10000", profit: 10_000n },
    ] as const)(
      "correctly records $category transaction and supports cancellation",
      async ({ category, name, cost, sell, profit }) => {
        const cash = await createTestAccount(`Kas ${category}`, "CASH", "0")
        const source = await createTestAccount(`Modal ${category}`, "BANK", "100000")

        const tx = await createProductTransaction({
          category,
          customerAccountId: cash.id,
          costAccountId: source.id,
          costAmount: cost,
          sellingPrice: sell,
          description: name,
        })
        createdTransactionIds.add(tx.id)

        expect(tx.status).toBe("COMPLETED")
        expect(tx.category).toBe(category)
        expect(tx.profitAmount).toBe(profit)
        expect(await getAccountBalance({ accountId: cash.id })).toBe(BigInt(sell))
        expect(await getAccountBalance({ accountId: source.id })).toBe(100_000n - BigInt(cost))

        const cancelled = await cancelTransaction({
          transactionId: tx.id,
          reason: `Batal ${category}`,
        })
        expect(cancelled.status).toBe("CANCELLED")
        expect(await getAccountBalance({ accountId: cash.id })).toBe(0n)
        expect(await getAccountBalance({ accountId: source.id })).toBe(100_000n)
      },
    )

    it("correctly records negative profit when product is sold below cost and reverses on cancellation", async () => {
      const cash = await createTestAccount("Kas Rugi", "CASH", "0")
      const source = await createTestAccount("Modal Rugi", "BANK", "100000")

      const tx = await createProductTransaction({
        category: "PRODUCT_SALE",
        customerAccountId: cash.id,
        costAccountId: source.id,
        costAmount: "50000",
        sellingPrice: "45000",
        description: "Obral Cuci Gudang Rugi",
      })
      createdTransactionIds.add(tx.id)

      expect(tx.status).toBe("COMPLETED")
      expect(tx.profitAmount).toBe(-5_000n)
      expect(await getAccountBalance({ accountId: cash.id })).toBe(45_000n)
      expect(await getAccountBalance({ accountId: source.id })).toBe(50_000n)

      await cancelTransaction({
        transactionId: tx.id,
        reason: "Batal transaksi obral rugi",
      })
      expect(await getAccountBalance({ accountId: cash.id })).toBe(0n)
      expect(await getAccountBalance({ accountId: source.id })).toBe(100_000n)
    })

    it("records digital tempo with source OUT and receivable without payment IN", async () => {
      const source = await createTestAccount("Modal Tempo", "BANK", "100000")
      const customer = await createCustomer({ name: "Pelanggan Tempo" })

      const tx = await createProductTransaction({
        category: "OTHER",
        costAccountId: source.id,
        costAmount: "30000",
        sellingPrice: "40000",
        description: "Jasa tempo",
        isCredit: true,
        customerId: customer.id,
      })
      createdTransactionIds.add(tx.id)

      expect(tx.receivable?.totalAmount).toBe(40_000n)
      expect(await getAccountBalance({ accountId: source.id })).toBe(70_000n)
      const entries = await database.ledgerEntry.findMany({ where: { transactionId: tx.id } })
      expect(entries).toHaveLength(1)
      expect(entries[0]?.direction).toBe("OUT")
      expect(entries[0]?.amount).toBe(30_000n)

      await cancelTransaction({ transactionId: tx.id, reason: "Batal tempo" })
      expect(await getAccountBalance({ accountId: source.id })).toBe(100_000n)
      const receivable = await database.receivable.findUnique({ where: { transactionId: tx.id } })
      expect(receivable?.status).toBe("CANCELLED")
    })
  })
}
