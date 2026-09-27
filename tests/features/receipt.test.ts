import { afterAll, afterEach, describe, expect, it } from "vitest"

import { createAccount } from "../../src/features/accounts/account-ledger"
import { getDatabase } from "../../src/lib/db"
import { formatRupiah } from "../../src/lib/money"
import {
  cancelTransaction,
  createIncome,
  getTransactionById,
} from "../../src/features/transactions/transaction-service"
import { buildReceiptData, DEFAULT_PRINTER_CONFIG } from "../../src/features/receipts/receipt-domain"
import {
  BrowserPrintAdapter,
  BluetoothPrintBridgeStub,
  RawbtPrintAdapter,
  generateRawbtUrl,
} from "../../src/features/receipts/print-adapter"
import { buildEscPosPayload, formatTwoColumns, buildEscPosPlainText } from "../../src/features/receipts/escpos"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("receipt workflow", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("receipt workflow", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdTransactionIds = new Set<string>()

    async function createTestAccount() {
      const account = await createAccount({
        name: "Kas Struk",
        type: "CASH",
        openingBalance: "0",
      })
      createdAccountIds.add(account.id)
      return account
    }

    afterEach(async () => {
      const transactionIds = [...createdTransactionIds]
      const accountIds = [...createdAccountIds]

      if (transactionIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { transactionId: { in: transactionIds } } })
        await database.transaction.deleteMany({ where: { id: { in: transactionIds } } })
        createdTransactionIds.clear()
      }

      if (accountIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { accountId: { in: accountIds } } })
        await database.account.deleteMany({ where: { id: { in: accountIds } } })
        createdAccountIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("loads original transaction data for receipt rendering with BigInt-safe formatting", async () => {
      const cash = await createTestAccount()
      const transaction = await createIncome({
        accountId: cash.id,
        amount: "9007199254740993",
        description: "Komisi Struk Nilai Besar",
      })
      createdTransactionIds.add(transaction.id)

      const receipt = await getTransactionById({ transactionId: transaction.id })

      expect(receipt.transactionNumber).toBe(transaction.transactionNumber)
      expect(receipt.description).toBe("Komisi Struk Nilai Besar")
      expect(receipt.status).toBe("COMPLETED")
      expect(formatRupiah(receipt.grossAmount)).toBe("Rp 9.007.199.254.740.993")
    })

    it("reprint reads existing receipt without creating a transaction or ledger entry", async () => {
      const cash = await createTestAccount()
      const transaction = await createIncome({
        accountId: cash.id,
        amount: "50000",
        description: "Struk Cetak Ulang",
      })
      createdTransactionIds.add(transaction.id)

      const beforeTransactions = await database.transaction.count()
      const beforeEntries = await database.ledgerEntry.count({ where: { transactionId: transaction.id } })

      const firstReceipt = await getTransactionById({ transactionId: transaction.id })
      const reprintReceipt = await getTransactionById({ transactionId: transaction.id })

      const afterTransactions = await database.transaction.count()
      const afterEntries = await database.ledgerEntry.count({ where: { transactionId: transaction.id } })

      expect(firstReceipt.id).toBe(reprintReceipt.id)
      expect(afterTransactions).toBe(beforeTransactions)
      expect(afterEntries).toBe(beforeEntries)
    })

    it("keeps cancelled receipt visibly marked with original cancellation audit data and cannot be recreated", async () => {
      const cash = await createTestAccount()
      const transaction = await createIncome({
        accountId: cash.id,
        amount: "20000",
        description: "Struk Batal",
      })
      createdTransactionIds.add(transaction.id)

      await cancelTransaction({
        transactionId: transaction.id,
        reason: "Pelanggan membatalkan layanan",
      })

      const beforeTxCount = await database.transaction.count()
      const beforeEntryCount = await database.ledgerEntry.count()

      const receipt = await getTransactionById({ transactionId: transaction.id })

      expect(receipt.status).toBe("CANCELLED")
      expect(receipt.cancelReason).toBe("Pelanggan membatalkan layanan")
      expect(receipt.cancelledAt).toBeInstanceOf(Date)
      expect(receipt.ledgerEntries).toHaveLength(2)

      const afterTxCount = await database.transaction.count()
      const afterEntryCount = await database.ledgerEntry.count()
      expect(afterTxCount).toBe(beforeTxCount)
      expect(afterEntryCount).toBe(beforeEntryCount)
    })

    it("builds consistent receipt data for 58mm EPPOS thermal profile without side-effects", async () => {
      const cash = await createTestAccount()
      const transaction = await createIncome({
        accountId: cash.id,
        amount: "75000",
        description: "Voucher Game 58mm",
      })
      createdTransactionIds.add(transaction.id)

      const txDetail = await getTransactionById({ transactionId: transaction.id })
      const receiptData = buildReceiptData(txDetail)

      expect(DEFAULT_PRINTER_CONFIG.model).toBe("EPPOS EPX583-V2")
      expect(DEFAULT_PRINTER_CONFIG.paperProfile).toBe("58mm")
      expect(receiptData.storeName).toBe("KONTERKU")
      expect(receiptData.transactionNumber).toBe(transaction.transactionNumber)
      expect(receiptData.grossAmount).toBe("Rp 75.000")
      expect(receiptData.totalPaid).toBe("Rp 75.000")
      expect(receiptData.isCancelled).toBe(false)
      expect(receiptData.statusText).toBe("LUNAS / SELESAI")

      const browserAdapter = new BrowserPrintAdapter()
      expect(browserAdapter.id).toBe("browser-print")

      const bluetoothStub = new BluetoothPrintBridgeStub()
      const stubRes = await bluetoothStub.print(receiptData)
      expect(stubRes.success).toBe(false)
      expect(stubRes.error).toContain("Bluetooth adapter not connected")

      const txCountBeforeTest = await database.transaction.count()
      const entryCountBeforeTest = await database.ledgerEntry.count()

      const rawbtAdapter = new RawbtPrintAdapter()
      expect(rawbtAdapter.id).toBe("rawbt-print")

      const rawbtUrl = generateRawbtUrl(receiptData, 32)
      expect(rawbtUrl.startsWith("rawbt:base64,")).toBe(true)

      const colLine = formatTwoColumns("Item:", "Rp 50.000", 32)
      expect(colLine.length).toBe(32)

      const payload = buildEscPosPayload(receiptData, 32)
      expect(payload).toBeInstanceOf(Uint8Array)
      expect(payload.length).toBeGreaterThan(50)

      expect(payload[0]).toBe(0x1b)
      expect(payload[1]).toBe(0x40)

      const beforeRecheckTx = await database.transaction.count()
      const beforeRecheckEntry = await database.ledgerEntry.count()
      expect(beforeRecheckTx).toBe(txCountBeforeTest)
      expect(beforeRecheckEntry).toBe(entryCountBeforeTest)
    })

    it("formats 32-column plain text and cancelled receipt correctly for debug preview", async () => {
      const cash = await createTestAccount()
      const transaction = await createIncome({
        accountId: cash.id,
        amount: "15000",
        description: "Pulsa Telkomsel 10k",
      })
      createdTransactionIds.add(transaction.id)

      await cancelTransaction({
        transactionId: transaction.id,
        reason: "Nomor salah diinput pelanggan",
      })

      const cancelledTx = await getTransactionById({ transactionId: transaction.id })
      const receiptData = buildReceiptData(cancelledTx)

      const plainText = buildEscPosPlainText(receiptData, 32)

      expect(plainText).toContain("KONTERKU")
      expect(plainText).toContain("*** TRANSAKSI DIBATALKAN ***")
      expect(plainText).toContain("Alasan: Nomor salah diinput")
      expect(plainText).toContain("pelanggan")
      expect(plainText).toContain("15.000")

      const lines = plainText.split("\n")
      for (const line of lines) {
        if (!line.includes("\n")) {
          expect(line.length).toBeLessThanOrEqual(32)
        }
      }

      const payload = buildEscPosPayload(receiptData, 32)
      expect(payload).toBeInstanceOf(Uint8Array)
    })
  })
}
