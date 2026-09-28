import { z } from "zod"

import type { Transaction, Receivable, InventoryMovement } from "../../generated/prisma/client"
import { Prisma } from "../../generated/prisma/client"
import {
  LedgerDirection,
  TransactionCategory,
  TransactionStatus,
} from "../../generated/prisma/enums"
import { getDatabase } from "../../lib/db"
import { InactiveAccountError, AccountNotFoundError } from "../accounts/account-ledger"
import { generateTransactionNumber } from "./transaction-service"
import { createReceivableFromTransaction } from "../receivables/receivable-service"
import { recordStockOut } from "../inventory/inventory-service"

const maxRupiahAmount = 9_223_372_036_854_775_807n

const accountIdSchema = z.string().cuid().brand("AccountId")
const descriptionSchema = z.string().trim().min(1).max(500)
const occurredAtSchema = z.coerce.date().default(() => new Date())

const nonNegativeRupiahAmountSchema = z
  .string()
  .max(19)
  .regex(/^(0|[1-9]\d*)$/)
  .transform((amount) => BigInt(amount))
  .pipe(z.bigint().min(0n).max(maxRupiahAmount))

const positiveRupiahAmountSchema = nonNegativeRupiahAmountSchema.pipe(
  z.bigint().positive().max(maxRupiahAmount),
)

// 1. Pulsa, Paket Data, Token PLN, PPOB, Penjualan Barang, Lainnya
export const productLikeTransactionSchema = z
  .object({
    category: z.enum([
      TransactionCategory.PULSA,
      TransactionCategory.DATA_PACKAGE,
      TransactionCategory.PLN_TOKEN,
      TransactionCategory.PPOB,
      TransactionCategory.PRODUCT_SALE,
      TransactionCategory.OTHER,
    ]),
    customerAccountId: accountIdSchema.optional(),
    costAccountId: accountIdSchema.optional(),
    costAmount: nonNegativeRupiahAmountSchema.default(0n),
    sellingPrice: positiveRupiahAmountSchema,
    description: descriptionSchema,
    occurredAt: occurredAtSchema,
    isCredit: z.boolean().default(false),
    customerId: z.string().cuid().optional(),
    productId: z.string().cuid().optional(),
    quantity: z.number().int().positive().default(1),
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => data.isCredit || data.customerAccountId,
    {
      message: "customerAccountId wajib diisi untuk transaksi non-kredit.",
      path: ["customerAccountId"],
    },
  )
  .refine(
    (data) => !data.isCredit || data.customerId,
    {
      message: "customerId wajib diisi untuk transaksi kredit (piutang).",
      path: ["customerId"],
    },
  )
  .refine(
    (data) =>
      data.category === TransactionCategory.PRODUCT_SALE ||
      data.costAmount === 0n ||
      Boolean(data.productId) ||
      Boolean(data.costAccountId),
    {
      message: "costAccountId wajib diisi untuk transaksi digital non-stok.",
      path: ["costAccountId"],
    },
  )

// 2. Transfer Bank Pelanggan
// Customer wants to transfer nominalTransfer to an external bank.
// Shop sends nominalTransfer from sourceAccountId (e.g. BCA).
// Customer pays total (nominalTransfer + adminFee) to customerPaymentAccountId (e.g. Cash).
// Profit = adminFee
export const bankTransferTransactionSchema = z.object({
  sourceAccountId: accountIdSchema, // bank account where shop money is deducted
  customerPaymentAccountId: accountIdSchema, // cash / payment account received from customer
  transferAmount: positiveRupiahAmountSchema, // nominal transfer
  adminFee: nonNegativeRupiahAmountSchema, // biaya admin charged to customer
  description: descriptionSchema,
  occurredAt: occurredAtSchema,
})

// 3. Tarik Tunai
// Customer withdraws cashAmount from shop (sourceCashAccountId OUT).
// Customer pays / settles cashAmount + adminFee into customerSettlementAccountId (e.g. Transfer to shop BCA or QRIS) (IN).
// Profit = adminFee
export const cashWithdrawalTransactionSchema = z.object({
  sourceCashAccountId: accountIdSchema, // cash account given to customer (OUT)
  customerSettlementAccountId: accountIdSchema, // e.g. bank/QRIS where customer transferred (IN)
  cashAmount: positiveRupiahAmountSchema, // nominal uang tunai yang ditarik
  adminFee: nonNegativeRupiahAmountSchema, // biaya admin
  description: descriptionSchema,
  occurredAt: occurredAtSchema,
})

// 4. Top Up E-Wallet
// Shop sends ewalletAmount from shopSourceAccountId (e.g. BCA or Mitra Topup) (OUT).
// Customer pays ewalletAmount + adminFee to customerPaymentAccountId (e.g. Cash) (IN).
// Profit = adminFee
export const ewalletTopupTransactionSchema = z.object({
  shopSourceAccountId: accountIdSchema, // account where shop wallet/bank balance is deducted (OUT)
  customerPaymentAccountId: accountIdSchema, // account customer pays into (IN)
  topupAmount: positiveRupiahAmountSchema, // nominal topup
  adminFee: nonNegativeRupiahAmountSchema, // biaya admin
  description: descriptionSchema,
  occurredAt: occurredAtSchema,
})

// Helper to check account status
async function assertAccountActive(
  tx: Prisma.TransactionClient,
  accountId: z.infer<typeof accountIdSchema>,
): Promise<void> {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { id: true, isActive: true },
  })

  if (!account) {
    throw new AccountNotFoundError(accountId)
  }

  if (!account.isActive) {
    throw new InactiveAccountError(accountId)
  }
}

// 1. Create Product-Like Counter Transaction
export async function createProductTransaction(input: unknown): Promise<Transaction & {
  receivable: Receivable | null
}> {
  const parsed = productLikeTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      if (!parsed.isCredit && parsed.customerAccountId) {
        await assertAccountActive(tx, parsed.customerAccountId)
      }
      if (parsed.costAccountId) {
        await assertAccountActive(tx, parsed.costAccountId)
      }

      const prefixMap: Record<string, string> = {
        PULSA: "PLS",
        DATA_PACKAGE: "DAT",
        PLN_TOKEN: "PLN",
        PPOB: "POB",
        PRODUCT_SALE: "SLS",
        OTHER: "OTH",
      }
      const prefix = prefixMap[parsed.category] ?? "CTR"
      const txNumber = generateTransactionNumber(prefix, parsed.occurredAt)

      let effectiveCost = parsed.costAmount
      let stockMovement: InventoryMovement | null = null

      if (parsed.productId) {
        stockMovement = await recordStockOut(
          {
            productId: parsed.productId,
            quantity: parsed.quantity,
            occurredAt: parsed.occurredAt,
            notes: `Penjualan ${txNumber}: ${parsed.description}`,
          },
          tx,
        )
        effectiveCost = stockMovement.totalCost
      }

      const profit = parsed.sellingPrice - effectiveCost

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          category: parsed.category,
          description: parsed.description,
          status: TransactionStatus.COMPLETED,
          grossAmount: parsed.sellingPrice,
          costAmount: effectiveCost,
          feeAmount: 0n,
          profitAmount: profit,
          occurredAt: parsed.occurredAt,
        },
      })

      if (parsed.costAccountId && effectiveCost > 0n && !parsed.productId) {
        await tx.ledgerEntry.create({
          data: {
            accountId: parsed.costAccountId,
            transactionId: transaction.id,
            direction: LedgerDirection.OUT,
            amount: effectiveCost,
            description: `Modal ${parsed.category}: ${parsed.description}`,
            occurredAt: parsed.occurredAt,
          },
        })
      }

      if (stockMovement) {
        await tx.inventoryMovement.update({
          where: { id: stockMovement.id },
          data: { transactionId: transaction.id },
        })
      }

      let createdReceivable: Receivable | null = null

      if (parsed.isCredit && parsed.customerId) {
        createdReceivable = await createReceivableFromTransaction(
          {
            customerId: parsed.customerId,
            transactionId: transaction.id,
            dueDate: parsed.dueDate,
            notes: parsed.notes,
          },
          tx,
        )
      } else if (parsed.customerAccountId) {
        await tx.ledgerEntry.create({
          data: {
            accountId: parsed.customerAccountId,
            transactionId: transaction.id,
            direction: LedgerDirection.IN,
            amount: parsed.sellingPrice,
            description: parsed.description,
            occurredAt: parsed.occurredAt,
          },
        })
      }

      return {
        ...transaction,
        receivable: createdReceivable,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

// 2. Create Bank Transfer Transaction
export async function createBankTransferTransaction(input: unknown): Promise<Transaction> {
  const parsed = bankTransferTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      await assertAccountActive(tx, parsed.sourceAccountId)
      await assertAccountActive(tx, parsed.customerPaymentAccountId)

      const txNumber = generateTransactionNumber("TRF", parsed.occurredAt)
      const totalCustomerPaid = parsed.transferAmount + parsed.adminFee
      const profit = parsed.adminFee

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          category: TransactionCategory.BANK_TRANSFER,
          description: parsed.description,
          status: TransactionStatus.COMPLETED,
          grossAmount: parsed.transferAmount,
          costAmount: parsed.transferAmount,
          feeAmount: parsed.adminFee,
          profitAmount: profit,
          occurredAt: parsed.occurredAt,
        },
      })

      // 1) Customer pays transfer + admin fee into customerPaymentAccountId (e.g. Cash IN)
      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.customerPaymentAccountId,
          transactionId: transaction.id,
          direction: LedgerDirection.IN,
          amount: totalCustomerPaid,
          description: `Terima dari pelanggan: ${parsed.description}`,
          occurredAt: parsed.occurredAt,
        },
      })

      // 2) Shop transfers amount out of sourceAccountId (e.g. BCA OUT)
      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.sourceAccountId,
          transactionId: transaction.id,
          direction: LedgerDirection.OUT,
          amount: parsed.transferAmount,
          description: `Transfer keluar: ${parsed.description}`,
          occurredAt: parsed.occurredAt,
        },
      })

      return transaction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

// 3. Create Cash Withdrawal Transaction
export async function createCashWithdrawalTransaction(input: unknown): Promise<Transaction> {
  const parsed = cashWithdrawalTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      await assertAccountActive(tx, parsed.sourceCashAccountId)
      await assertAccountActive(tx, parsed.customerSettlementAccountId)

      const txNumber = generateTransactionNumber("WDL", parsed.occurredAt)
      const totalSettled = parsed.cashAmount + parsed.adminFee
      const profit = parsed.adminFee

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          category: TransactionCategory.CASH_WITHDRAWAL,
          description: parsed.description,
          status: TransactionStatus.COMPLETED,
          grossAmount: parsed.cashAmount,
          costAmount: parsed.cashAmount,
          feeAmount: parsed.adminFee,
          profitAmount: profit,
          occurredAt: parsed.occurredAt,
        },
      })

      // 1) Cash leaves shop sourceCashAccountId (OUT)
      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.sourceCashAccountId,
          transactionId: transaction.id,
          direction: LedgerDirection.OUT,
          amount: parsed.cashAmount,
          description: `Tarik tunai keluar: ${parsed.description}`,
          occurredAt: parsed.occurredAt,
        },
      })

      // 2) Customer settlement (transfer/QRIS) enters customerSettlementAccountId (IN)
      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.customerSettlementAccountId,
          transactionId: transaction.id,
          direction: LedgerDirection.IN,
          amount: totalSettled,
          description: `Terima transfer tarik tunai: ${parsed.description}`,
          occurredAt: parsed.occurredAt,
        },
      })

      return transaction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

// 4. Create E-Wallet Top Up Transaction
export async function createEwalletTopupTransaction(input: unknown): Promise<Transaction> {
  const parsed = ewalletTopupTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      await assertAccountActive(tx, parsed.shopSourceAccountId)
      await assertAccountActive(tx, parsed.customerPaymentAccountId)

      const txNumber = generateTransactionNumber("TOP", parsed.occurredAt)
      const totalCustomerPaid = parsed.topupAmount + parsed.adminFee
      const profit = parsed.adminFee

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          category: TransactionCategory.EWALLET_TOPUP,
          description: parsed.description,
          status: TransactionStatus.COMPLETED,
          grossAmount: parsed.topupAmount,
          costAmount: parsed.topupAmount,
          feeAmount: parsed.adminFee,
          profitAmount: profit,
          occurredAt: parsed.occurredAt,
        },
      })

      // 1) Customer pays topup + admin fee into customerPaymentAccountId (IN)
      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.customerPaymentAccountId,
          transactionId: transaction.id,
          direction: LedgerDirection.IN,
          amount: totalCustomerPaid,
          description: `Terima bayar top-up: ${parsed.description}`,
          occurredAt: parsed.occurredAt,
        },
      })

      // 2) Top-up balance deducted from shopSourceAccountId (OUT)
      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.shopSourceAccountId,
          transactionId: transaction.id,
          direction: LedgerDirection.OUT,
          amount: parsed.topupAmount,
          description: `Saldo keluar top-up: ${parsed.description}`,
          occurredAt: parsed.occurredAt,
        },
      })

      return transaction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
