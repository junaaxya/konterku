import { z } from "zod"

import type { Transaction, Account } from "../../generated/prisma/client"
import { TransactionCategory, TransactionStatus } from "../../generated/prisma/enums"
import { getDatabase } from "../../lib/db"
import { getAccountBalance, listAccounts } from "../accounts/account-ledger"

export const reportPeriodSchema = z.enum(["TODAY", "7DAYS", "MONTH", "CUSTOM"])
export type ReportPeriod = z.infer<typeof reportPeriodSchema>

export const reportQueryInputSchema = z.object({
  period: reportPeriodSchema.default("TODAY"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

export type CategorySummary = {
  readonly category: TransactionCategory
  readonly count: number
  readonly volume: bigint
  readonly profit: bigint
}

export type AccountSummary = Account & { readonly balance: bigint }

export type FinancialMetrics = {
  readonly period: ReportPeriod
  readonly startDate: Date
  readonly endDate: Date
  readonly totalCashBalance: bigint
  readonly totalAssets: bigint
  readonly totalIncome: bigint
  readonly totalExpense: bigint
  readonly totalProfit: bigint
  readonly totalVolume: bigint
  readonly transactionCount: number
  readonly categorySummaries: readonly CategorySummary[]
  readonly accountSummaries: readonly AccountSummary[]
  readonly transactions: readonly Transaction[]
}

export function getDateRangeForPeriod(
  period: ReportPeriod,
  customStart?: Date,
  customEnd?: Date,
): { startDate: Date; endDate: Date } {
  const now = new Date()

  if (period === "CUSTOM" && customStart) {
    const start = new Date(customStart)
    start.setHours(0, 0, 0, 0)
    const end = customEnd ? new Date(customEnd) : new Date(now)
    end.setHours(23, 59, 59, 999)
    return { startDate: start, endDate: end }
  }

  if (period === "7DAYS") {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { startDate: start, endDate: end }
  }

  if (period === "MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { startDate: start, endDate: end }
  }

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { startDate: start, endDate: end }
}

export async function getFinancialReport(input: unknown = {}): Promise<FinancialMetrics> {
  const parsed = reportQueryInputSchema.parse(input)
  const { startDate, endDate } = getDateRangeForPeriod(
    parsed.period,
    parsed.startDate,
    parsed.endDate,
  )

  const database = getDatabase()

  const [accounts, transactions] = await Promise.all([
    listAccounts(),
    database.transaction.findMany({
      where: {
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
        status: TransactionStatus.COMPLETED,
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    }),
  ])

  const accountSummaries = await Promise.all(
    accounts.map(async (acc) => ({
      ...acc,
      balance: await getAccountBalance({ accountId: acc.id }),
    })),
  )

  const totalCashBalance = accountSummaries.reduce((acc, curr) => acc + curr.balance, 0n)
  const totalAssets = totalCashBalance

  let totalIncome = 0n
  let totalExpense = 0n
  let totalProfit = 0n
  let totalVolume = 0n

  const categoryMap = new Map<
    TransactionCategory,
    { count: number; volume: bigint; profit: bigint }
  >()

  for (const cat of Object.values(TransactionCategory)) {
    categoryMap.set(cat, { count: 0, volume: 0n, profit: 0n })
  }

  for (const tx of transactions) {
    totalProfit += tx.profitAmount
    totalVolume += tx.grossAmount

    if (tx.category === TransactionCategory.INCOME) {
      totalIncome += tx.grossAmount
    } else if (tx.category === TransactionCategory.EXPENSE) {
      totalExpense += tx.grossAmount
    }

    const current = categoryMap.get(tx.category)
    if (current) {
      current.count += 1
      current.volume += tx.grossAmount
      current.profit += tx.profitAmount
    }
  }

  const categorySummaries: CategorySummary[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      volume: data.volume,
      profit: data.profit,
    }))
    .filter((item) => item.count > 0)

  return {
    period: parsed.period,
    startDate,
    endDate,
    totalCashBalance,
    totalAssets,
    totalIncome,
    totalExpense,
    totalProfit,
    totalVolume,
    transactionCount: transactions.length,
    categorySummaries,
    accountSummaries,
    transactions,
  }
}
