import { z } from "zod"
import { getDatabase } from "@/lib/db"
import type {
  ExternalMatchStatus,
  ExternalReconcileAction,
  LedgerDirection,
  Transaction,
} from "@/generated/prisma/client"
import { createIncome, createExpense } from "@/features/transactions/transaction-service"
import { getAccountBalance } from "@/features/accounts/account-ledger"
import { getAccountIntegrationInfo } from "@/features/accounts/provider-integration"

export class ExternalTransactionAlreadyReconciledError extends Error {
  readonly name = "ExternalTransactionAlreadyReconciledError"

  constructor(readonly externalTransactionId: string) {
    super(`External transaction ${externalTransactionId} has already been reconciled or ignored.`)
  }
}

export type AccountReconciliationState = "MATCHED" | "DIFFERENCE" | "NOT_SYNCED"

export type AccountReconciliationSummary = {
  readonly accountId: string
  readonly state: AccountReconciliationState
  readonly bookBalance: bigint
  readonly actualBalance: bigint | null
  readonly difference: bigint | null
  readonly source: string | null
  readonly lastSyncedAt: Date | null
  readonly unmatchedCount: number
  readonly matchedCount: number
  readonly ignoredCount: number
}

export type MatchCandidate = {
  readonly transaction: Transaction
  readonly isExactAmount: boolean
  readonly dateDiffDays: number
}

export type ExternalTransactionWithCandidate = {
  readonly id: string
  readonly accountId: string
  readonly date: Date
  readonly description: string
  readonly amount: bigint
  readonly direction: LedgerDirection | null
  readonly runningBalance: bigint | null
  readonly matchStatus: ExternalMatchStatus
  readonly matchedTransactionId: string | null
  readonly matchedTransaction?: Transaction | null
  readonly reconcileAction: ExternalReconcileAction
  readonly note: string | null
  readonly reconciledAt: Date | null
  readonly candidates: readonly MatchCandidate[]
  readonly isAmbiguous: boolean
}

export async function getAccountReconciliationSummary(
  accountId: string,
): Promise<AccountReconciliationSummary> {
  const database = getDatabase()

  const [bookBalance, integrationInfo, counts] = await Promise.all([
    getAccountBalance({ accountId }),
    getAccountIntegrationInfo(accountId),
    database.externalTransaction.groupBy({
      by: ["matchStatus"],
      where: { accountId },
      _count: true,
    }),
  ])

  const actualBalance = integrationInfo.latestActualBalance ?? null
  const difference = actualBalance !== null ? actualBalance - bookBalance : null

  let state: AccountReconciliationState = "NOT_SYNCED"
  if (actualBalance !== null) {
    state = difference === 0n ? "MATCHED" : "DIFFERENCE"
  }

  let unmatchedCount = 0
  let matchedCount = 0
  let ignoredCount = 0

  for (const c of counts) {
    if (c.matchStatus === "UNMATCHED") unmatchedCount = c._count
    else if (c.matchStatus === "MATCHED") matchedCount = c._count
    else if (c.matchStatus === "IGNORED") ignoredCount = c._count
  }

  return {
    accountId,
    state,
    bookBalance,
    actualBalance,
    difference,
    source: integrationInfo.latestSource ?? null,
    lastSyncedAt: integrationInfo.latestSnapshotAt ?? null,
    unmatchedCount,
    matchedCount,
    ignoredCount,
  }
}

export async function storeImportedExternalTransactions(input: {
  readonly accountId: string
  readonly rows: readonly {
    readonly date: Date
    readonly description: string
    readonly amount: bigint
    readonly direction?: "IN" | "OUT" | undefined
    readonly runningBalance?: bigint | undefined
  }[]
}) {
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const created = []
    for (const r of input.rows) {
      const item = await tx.externalTransaction.create({
        data: {
          accountId: input.accountId,
          date: r.date,
          description: r.description,
          amount: r.amount,
          direction: r.direction ? (r.direction as LedgerDirection) : null,
          runningBalance: r.runningBalance ?? null,
          matchStatus: "UNMATCHED",
          reconcileAction: "NONE",
        },
      })
      created.push(item)
    }
    return created
  })
}

export async function listExternalTransactionsWithCandidates(
  accountId: string,
  limit = 50,
): Promise<readonly ExternalTransactionWithCandidate[]> {
  const database = getDatabase()

  const externalTxs = await database.externalTransaction.findMany({
    where: { accountId },
    include: {
      matchedTransaction: true,
    },
    orderBy: { date: "desc" },
    take: limit,
  })

  // Preload potential internal transactions for this account around matching amounts
  const internalTxs = await database.transaction.findMany({
    where: {
      ledgerEntries: {
        some: { accountId },
      },
      status: "COMPLETED",
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  })

  return externalTxs.map((et) => {
    if (et.matchStatus === "MATCHED") {
      return {
        id: et.id,
        accountId: et.accountId,
        date: et.date,
        description: et.description,
        amount: et.amount,
        direction: et.direction,
        runningBalance: et.runningBalance,
        matchStatus: et.matchStatus,
        matchedTransactionId: et.matchedTransactionId,
        matchedTransaction: et.matchedTransaction,
        reconcileAction: et.reconcileAction,
        note: et.note,
        reconciledAt: et.reconciledAt,
        candidates: [],
        isAmbiguous: false,
      }
    }

    // Find candidates
    const candidates: MatchCandidate[] = []
    for (const itx of internalTxs) {
      const isExactAmount = itx.grossAmount === et.amount
      const timeDiff = Math.abs(itx.occurredAt.getTime() - et.date.getTime())
      const dateDiffDays = Math.round(timeDiff / (1000 * 60 * 60 * 24))

      // Candidate if exact amount within 7 days
      if (isExactAmount && dateDiffDays <= 7) {
        candidates.push({
          transaction: itx,
          isExactAmount,
          dateDiffDays,
        })
      }
    }

    const isAmbiguous = candidates.length > 1

    return {
      id: et.id,
      accountId: et.accountId,
      date: et.date,
      description: et.description,
      amount: et.amount,
      direction: et.direction,
      runningBalance: et.runningBalance,
      matchStatus: et.matchStatus,
      matchedTransactionId: et.matchedTransactionId,
      matchedTransaction: et.matchedTransaction,
      reconcileAction: et.reconcileAction,
      note: et.note,
      reconciledAt: et.reconciledAt,
      candidates,
      isAmbiguous,
    }
  })
}

// Actions with strict idempotency and duplicate prevention
export const matchToExistingSchema = z.object({
  externalTransactionId: z.string().cuid(),
  transactionId: z.string().cuid(),
  note: z.string().trim().max(500).optional(),
})

export async function matchExternalToExistingTransaction(input: {
  readonly externalTransactionId: string
  readonly transactionId: string
  readonly note?: string | undefined
}) {
  const parsed = matchToExistingSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const externalTx = await tx.externalTransaction.findUnique({
      where: { id: parsed.externalTransactionId },
    })

    if (!externalTx) {
      throw new Error("External transaction not found.")
    }

    if (externalTx.matchStatus !== "UNMATCHED") {
      throw new ExternalTransactionAlreadyReconciledError(externalTx.id)
    }

    return tx.externalTransaction.update({
      where: { id: parsed.externalTransactionId },
      data: {
        matchedTransactionId: parsed.transactionId,
        matchStatus: "MATCHED",
        reconcileAction: "MATCHED_EXISTING",
        reconciledAt: new Date(),
        note: parsed.note || "Dicocokkan dengan transaksi internal",
      },
    })
  })
}

export const recordUnmatchedAsIncomeSchema = z.object({
  externalTransactionId: z.string().cuid(),
  description: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().max(500).optional(),
})

export async function recordUnmatchedAsIncome(input: {
  readonly externalTransactionId: string
  readonly description?: string | undefined
  readonly note?: string | undefined
}) {
  const parsed = recordUnmatchedAsIncomeSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const externalTx = await tx.externalTransaction.findUnique({
      where: { id: parsed.externalTransactionId },
    })

    if (!externalTx) {
      throw new Error("External transaction not found.")
    }

    if (externalTx.matchStatus !== "UNMATCHED") {
      throw new ExternalTransactionAlreadyReconciledError(externalTx.id)
    }

    const desc = parsed.description || externalTx.description

    // Explicit creation of Income Transaction
    const newTx = await createIncome({
      accountId: externalTx.accountId,
      amount: externalTx.amount.toString(),
      description: desc,
      occurredAt: externalTx.date,
    })

    return tx.externalTransaction.update({
      where: { id: externalTx.id },
      data: {
        matchedTransactionId: newTx.id,
        matchStatus: "MATCHED",
        reconcileAction: "RECORDED_INCOME",
        reconciledAt: new Date(),
        note: parsed.note || "Dicatat manual dari rekonsiliasi mutasi masuk",
      },
    })
  })
}

export const recordUnmatchedAsExpenseSchema = z.object({
  externalTransactionId: z.string().cuid(),
  description: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().max(500).optional(),
})

export async function recordUnmatchedAsExpense(input: {
  readonly externalTransactionId: string
  readonly description?: string | undefined
  readonly note?: string | undefined
}) {
  const parsed = recordUnmatchedAsExpenseSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const externalTx = await tx.externalTransaction.findUnique({
      where: { id: parsed.externalTransactionId },
    })

    if (!externalTx) {
      throw new Error("External transaction not found.")
    }

    if (externalTx.matchStatus !== "UNMATCHED") {
      throw new ExternalTransactionAlreadyReconciledError(externalTx.id)
    }

    const desc = parsed.description || externalTx.description

    // Explicit creation of Expense Transaction
    const newTx = await createExpense({
      accountId: externalTx.accountId,
      amount: externalTx.amount.toString(),
      description: desc,
      occurredAt: externalTx.date,
    })

    return tx.externalTransaction.update({
      where: { id: externalTx.id },
      data: {
        matchedTransactionId: newTx.id,
        matchStatus: "MATCHED",
        reconcileAction: "RECORDED_EXPENSE",
        reconciledAt: new Date(),
        note: parsed.note || "Dicatat manual dari rekonsiliasi mutasi keluar",
      },
    })
  })
}

export const ignoreExternalTransactionSchema = z.object({
  externalTransactionId: z.string().cuid(),
  note: z.string().trim().max(500).optional(),
})

export async function ignoreExternalTransaction(input: {
  readonly externalTransactionId: string
  readonly note?: string | undefined
}) {
  const parsed = ignoreExternalTransactionSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const externalTx = await tx.externalTransaction.findUnique({
      where: { id: parsed.externalTransactionId },
    })

    if (!externalTx) {
      throw new Error("External transaction not found.")
    }

    if (externalTx.matchStatus !== "UNMATCHED") {
      throw new ExternalTransactionAlreadyReconciledError(externalTx.id)
    }

    const auditTimestamp = new Date()
    const auditNote = parsed.note || "Ditinjau dan diabaikan"

    return tx.externalTransaction.update({
      where: { id: parsed.externalTransactionId },
      data: {
        matchStatus: "IGNORED",
        reconcileAction: "IGNORED",
        reconciledAt: auditTimestamp,
        note: auditNote,
      },
    })
  })
}
