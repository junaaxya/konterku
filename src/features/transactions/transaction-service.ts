import { z } from "zod"

import type { Transaction, LedgerEntry } from "../../generated/prisma/client"
import { Prisma } from "../../generated/prisma/client"
import {
  LedgerDirection,
  TransactionCategory,
  TransactionStatus,
  InventoryMovementType,
} from "../../generated/prisma/enums"
import { getDatabase } from "../../lib/db"
import { InactiveAccountError, AccountNotFoundError } from "../accounts/account-ledger"
import { cancelReceivableForTransaction } from "../receivables/receivable-service"
import { reverseSaleMovement } from "../inventory/inventory-service"

const maxRupiahAmount = 9_223_372_036_854_775_807n

const accountIdSchema = z.string().cuid().brand("AccountId")
const transactionIdSchema = z.string().cuid().brand("TransactionId")
const descriptionSchema = z.string().trim().min(1).max(500)
const cancelReasonSchema = z.string().trim().min(1).max(500)
const occurredAtSchema = z.coerce.date().default(() => new Date())

const rupiahAmountSchema = z
  .string()
  .max(19)
  .regex(/^(0|[1-9]\d*)$/)
  .transform((amount) => BigInt(amount))
  .pipe(z.bigint().positive().max(maxRupiahAmount))

const createGenericTransactionSchema = z.object({
  accountId: accountIdSchema,
  amount: rupiahAmountSchema,
  description: descriptionSchema,
  occurredAt: occurredAtSchema,
})

const cancelTransactionSchema = z.object({
  transactionId: transactionIdSchema,
  reason: cancelReasonSchema,
})

const getTransactionByIdSchema = z.object({
  transactionId: transactionIdSchema,
})

const listTransactionsFilterSchema = z.object({
  category: z.enum(TransactionCategory).optional(),
  status: z.enum(TransactionStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

export class TransactionNotFoundError extends Error {
  readonly name = "TransactionNotFoundError"

  constructor(readonly transactionId: string) {
    super(`Transaction ${transactionId} does not exist`)
  }
}

export class TransactionAlreadyCancelledError extends Error {
  readonly name = "TransactionAlreadyCancelledError"

  constructor(readonly transactionId: string) {
    super(`Transaction ${transactionId} is already cancelled`)
  }
}

export function generateTransactionNumber(prefix: string, date: Date): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "")
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${prefix}-${yyyymmdd}-${randomSuffix}`
}

export async function createIncome(input: unknown): Promise<Transaction> {
  const parsed = createGenericTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: parsed.accountId },
        select: { id: true, isActive: true },
      })

      if (!account) {
        throw new AccountNotFoundError(parsed.accountId)
      }

      if (!account.isActive) {
        throw new InactiveAccountError(parsed.accountId)
      }

      const txNumber = generateTransactionNumber("INC", parsed.occurredAt)

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          category: TransactionCategory.INCOME,
          description: parsed.description,
          status: TransactionStatus.COMPLETED,
          grossAmount: parsed.amount,
          costAmount: 0n,
          feeAmount: 0n,
          profitAmount: parsed.amount,
          occurredAt: parsed.occurredAt,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.accountId,
          transactionId: transaction.id,
          direction: LedgerDirection.IN,
          amount: parsed.amount,
          description: parsed.description,
          occurredAt: parsed.occurredAt,
        },
      })

      return transaction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function createExpense(input: unknown): Promise<Transaction> {
  const parsed = createGenericTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: parsed.accountId },
        select: { id: true, isActive: true },
      })

      if (!account) {
        throw new AccountNotFoundError(parsed.accountId)
      }

      if (!account.isActive) {
        throw new InactiveAccountError(parsed.accountId)
      }

      const txNumber = generateTransactionNumber("EXP", parsed.occurredAt)

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          category: TransactionCategory.EXPENSE,
          description: parsed.description,
          status: TransactionStatus.COMPLETED,
          grossAmount: parsed.amount,
          costAmount: parsed.amount,
          feeAmount: 0n,
          profitAmount: -parsed.amount,
          occurredAt: parsed.occurredAt,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          accountId: parsed.accountId,
          transactionId: transaction.id,
          direction: LedgerDirection.OUT,
          amount: parsed.amount,
          description: parsed.description,
          occurredAt: parsed.occurredAt,
        },
      })

      return transaction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function cancelTransaction(input: unknown): Promise<Transaction> {
  const parsed = cancelTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: parsed.transactionId },
        include: { ledgerEntries: true },
      })

      if (!transaction) {
        throw new TransactionNotFoundError(parsed.transactionId)
      }

      if (transaction.status === TransactionStatus.CANCELLED) {
        throw new TransactionAlreadyCancelledError(parsed.transactionId)
      }

      const cancelledAt = new Date()

      // Create reversal ledger entries for every existing ledger entry
      for (const entry of transaction.ledgerEntries) {
        const reverseDirection =
          entry.direction === LedgerDirection.IN ? LedgerDirection.OUT : LedgerDirection.IN

        await tx.ledgerEntry.create({
          data: {
            accountId: entry.accountId,
            transactionId: transaction.id,
            direction: reverseDirection,
            amount: entry.amount,
            description: `[BATAL] ${entry.description}`,
            occurredAt: cancelledAt,
          },
        })
      }

      await cancelReceivableForTransaction(transaction.id, parsed.reason, tx)

      const stockOutMovements = await tx.inventoryMovement.findMany({
        where: { transactionId: transaction.id, type: InventoryMovementType.STOCK_OUT },
      })
      for (const m of stockOutMovements) {
        await reverseSaleMovement({ movementId: m.id, notes: parsed.reason }, tx)
      }

      return tx.transaction.update({
        where: { id: parsed.transactionId },
        data: {
          status: TransactionStatus.CANCELLED,
          cancelledAt,
          cancelReason: parsed.reason,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export type TransactionWithLedger = Transaction & {
  readonly ledgerEntries: readonly (LedgerEntry & {
    readonly account: { readonly name: string; readonly type: string }
  })[]
}

export async function getTransactionById(input: unknown): Promise<TransactionWithLedger> {
  const parsed = getTransactionByIdSchema.parse(input)
  const transaction = await getDatabase().transaction.findUnique({
    where: { id: parsed.transactionId },
    include: {
      ledgerEntries: {
        include: {
          account: {
            select: { name: true, type: true },
          },
        },
        orderBy: { occurredAt: "asc" },
      },
    },
  })

  if (!transaction) {
    throw new TransactionNotFoundError(parsed.transactionId)
  }

  return transaction
}

export async function listTransactions(input: unknown = {}): Promise<readonly Transaction[]> {
  const parsed = listTransactionsFilterSchema.parse(input)
  const where: Prisma.TransactionWhereInput = {}

  if (parsed.category) {
    where.category = parsed.category
  }

  if (parsed.status) {
    where.status = parsed.status
  }

  if (parsed.startDate || parsed.endDate) {
    where.occurredAt = {}
    if (parsed.startDate) {
      where.occurredAt.gte = parsed.startDate
    }
    if (parsed.endDate) {
      where.occurredAt.lte = parsed.endDate
    }
  }

  if (parsed.search) {
    where.OR = [
      { description: { contains: parsed.search, mode: "insensitive" } },
      { transactionNumber: { contains: parsed.search, mode: "insensitive" } },
    ]
  }

  return getDatabase().transaction.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: parsed.limit,
  })
}
