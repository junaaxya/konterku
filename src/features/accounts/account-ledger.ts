import { z } from "zod"

import type { Account, LedgerEntry } from "../../generated/prisma/client"
import { Prisma } from "../../generated/prisma/client"
import { AccountType, LedgerDirection } from "../../generated/prisma/enums"
import { getDatabase } from "../../lib/db"

const maxRupiahAmount = 9_223_372_036_854_775_807n

export const accountIdSchema = z.string().cuid().brand("AccountId")
const accountNameSchema = z.string().trim().min(1).max(120)
const rupiahAmountSchema = z
  .string()
  .max(19)
  .regex(/^(0|[1-9]\d*)$/)
  .transform((amount) => BigInt(amount))
  .pipe(z.bigint().min(0n).max(maxRupiahAmount))
const positiveRupiahAmountSchema = rupiahAmountSchema.pipe(z.bigint().positive())
const occurredAtSchema = z.coerce.date().default(() => new Date())

const createAccountInputSchema = z.object({
  name: accountNameSchema,
  type: z.enum(AccountType),
  openingBalance: rupiahAmountSchema.default(0n),
  occurredAt: occurredAtSchema,
})

const accountIdInputSchema = z.object({
  accountId: accountIdSchema,
})

const renameAccountInputSchema = accountIdInputSchema.extend({
  name: accountNameSchema,
})

const setAccountActiveInputSchema = accountIdInputSchema.extend({
  isActive: z.boolean(),
})

const recordLedgerEntryInputSchema = accountIdInputSchema.extend({
  direction: z.enum(LedgerDirection),
  amount: positiveRupiahAmountSchema,
  description: z.string().trim().min(1).max(500),
  occurredAt: occurredAtSchema,
})

const listAccountsInputSchema = z.object({
  activeOnly: z.boolean().default(false),
})

const listAccountLedgerEntriesInputSchema = accountIdInputSchema.extend({
  limit: z.number().int().min(1).max(100).default(100),
})

type AccountId = z.infer<typeof accountIdSchema>

export class AccountNotFoundError extends Error {
  readonly name = "AccountNotFoundError"

  constructor(readonly accountId: AccountId) {
    super(`Account ${accountId} does not exist`)
  }
}

export class InactiveAccountError extends Error {
  readonly name = "InactiveAccountError"

  constructor(readonly accountId: AccountId) {
    super(`Account ${accountId} is inactive`)
  }
}

export async function createAccount(input: unknown): Promise<Account> {
  const parsed = createAccountInputSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (transaction) => {
      const account = await transaction.account.create({
        data: {
          name: parsed.name,
          type: parsed.type,
        },
      })

      if (parsed.openingBalance > 0n) {
        await transaction.ledgerEntry.create({
          data: {
            accountId: account.id,
            direction: LedgerDirection.IN,
            amount: parsed.openingBalance,
            description: "Saldo awal",
            occurredAt: parsed.occurredAt,
          },
        })
      }

      return account
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function renameAccount(input: unknown): Promise<Account> {
  const parsed = renameAccountInputSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (transaction) => {
      const account = await transaction.account.findUnique({
        where: { id: parsed.accountId },
        select: { id: true },
      })

      if (account === null) {
        throw new AccountNotFoundError(parsed.accountId)
      }

      return transaction.account.update({
        where: { id: parsed.accountId },
        data: { name: parsed.name },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function setAccountActive(input: unknown): Promise<Account> {
  const parsed = setAccountActiveInputSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (transaction) => {
      const account = await transaction.account.findUnique({
        where: { id: parsed.accountId },
        select: { id: true },
      })

      if (account === null) {
        throw new AccountNotFoundError(parsed.accountId)
      }

      return transaction.account.update({
        where: { id: parsed.accountId },
        data: { isActive: parsed.isActive },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function recordLedgerEntry(input: unknown): Promise<LedgerEntry> {
  const parsed = recordLedgerEntryInputSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(
    async (transaction) => {
      const account = await transaction.account.findUnique({
        where: { id: parsed.accountId },
        select: { isActive: true },
      })

      if (account === null) {
        throw new AccountNotFoundError(parsed.accountId)
      }

      if (!account.isActive) {
        throw new InactiveAccountError(parsed.accountId)
      }

      return transaction.ledgerEntry.create({
        data: {
          accountId: parsed.accountId,
          direction: parsed.direction,
          amount: parsed.amount,
          description: parsed.description,
          occurredAt: parsed.occurredAt,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function getAccountById(input: unknown): Promise<Account> {
  const parsed = accountIdInputSchema.parse(input)
  const account = await getDatabase().account.findUnique({
    where: { id: parsed.accountId },
  })

  if (account === null) {
    throw new AccountNotFoundError(parsed.accountId)
  }

  return account
}

export async function listAccounts(input: unknown = {}): Promise<readonly Account[]> {
  const parsed = listAccountsInputSchema.parse(input)

  if (parsed.activeOnly) {
    return getDatabase().account.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    })
  }

  return getDatabase().account.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
}

export async function getAccountBalance(input: unknown): Promise<bigint> {
  const parsed = accountIdInputSchema.parse(input)
  const database = getDatabase()
  const account = await database.account.findUnique({
    where: { id: parsed.accountId },
    select: { id: true },
  })

  if (account === null) {
    throw new AccountNotFoundError(parsed.accountId)
  }

  const [incoming, outgoing] = await database.$transaction([
    database.ledgerEntry.aggregate({
      where: { accountId: parsed.accountId, direction: LedgerDirection.IN },
      _sum: { amount: true },
    }),
    database.ledgerEntry.aggregate({
      where: { accountId: parsed.accountId, direction: LedgerDirection.OUT },
      _sum: { amount: true },
    }),
  ])

  return (incoming._sum.amount ?? 0n) - (outgoing._sum.amount ?? 0n)
}

export async function listAccountLedgerEntries(
  input: unknown,
): Promise<readonly LedgerEntry[]> {
  const parsed = listAccountLedgerEntriesInputSchema.parse(input)
  await getAccountById({ accountId: parsed.accountId })

  return getDatabase().ledgerEntry.findMany({
    where: { accountId: parsed.accountId },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: parsed.limit,
  })
}
