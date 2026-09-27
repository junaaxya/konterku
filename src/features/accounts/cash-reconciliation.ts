import { z } from "zod"
import { getDatabase } from "@/lib/db"
import { getAccountBalance, AccountNotFoundError, accountIdSchema } from "./account-ledger"

const maxRupiahAmount = 9_223_372_036_854_775_807n

export const createReconciliationSchema = z.object({
  accountId: accountIdSchema,
  physicalAmount: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((amount) => BigInt(amount))
    .pipe(z.bigint().min(0n).max(maxRupiahAmount)),
  note: z.string().trim().max(500).optional(),
})

export type ReconciliationResult = {
  readonly id: string
  readonly accountId: string
  readonly systemBalance: bigint
  readonly physicalAmount: bigint
  readonly difference: bigint
  readonly note?: string | null
  readonly reconciledAt: Date
}

export async function recordCashReconciliation(input: {
  readonly accountId: string
  readonly physicalAmount: string
  readonly note?: string | undefined
}): Promise<ReconciliationResult> {
  const parsed = createReconciliationSchema.parse(input)
  const database = getDatabase()

  const account = await database.account.findUnique({
    where: { id: parsed["accountId"] },
  })

  if (!account) {
    throw new AccountNotFoundError(parsed["accountId"])
  }

  const systemBalance = await getAccountBalance({ accountId: parsed["accountId"] })
  const difference = parsed.physicalAmount - systemBalance

  const record = await database.cashReconciliation.create({
    data: {
      accountId: parsed["accountId"],
      systemBalance,
      physicalAmount: parsed.physicalAmount,
      difference,
      note: parsed.note || null,
    },
  })

  return {
    id: record.id,
    accountId: record.accountId,
    systemBalance: record.systemBalance,
    physicalAmount: record.physicalAmount,
    difference: record.difference,
    note: record.note,
    reconciledAt: record.reconciledAt,
  }
}

export async function listAccountReconciliations(
  accountId: string,
  limit = 20,
): Promise<readonly ReconciliationResult[]> {
  const database = getDatabase()
  const list = await database.cashReconciliation.findMany({
    where: { accountId },
    orderBy: { reconciledAt: "desc" },
    take: limit,
  })

  return list.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    systemBalance: r.systemBalance,
    physicalAmount: r.physicalAmount,
    difference: r.difference,
    note: r.note,
    reconciledAt: r.reconciledAt,
  }))
}
