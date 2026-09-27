import { z } from "zod"
import { getDatabase } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import type {
  AccountType,
  ConnectionStatus,
  SnapshotSource,
} from "@/generated/prisma/client"

export const maxRupiahAmount = 9_223_372_036_854_775_807n

export const providerCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Z0-9_]+$/, "Code must be uppercase alphanumeric/underscore")

export const createProviderSchema = z.object({
  code: providerCodeSchema,
  name: z.string().trim().min(2).max(100),
  category: z.enum(["CASH", "BANK", "EWALLET", "QRIS", "OTHER"] as const),
})

export const connectProviderSchema = z.object({
  accountId: z.string().cuid(),
  providerId: z.string().cuid(),
  externalAccountId: z.string().trim().min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const recordSnapshotSchema = z.object({
  accountId: z.string().cuid(),
  providerConnectionId: z.string().cuid().optional(),
  balance: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((amount) => BigInt(amount))
    .pipe(z.bigint().min(0n).max(maxRupiahAmount)),
  source: z.enum(["MANUAL", "IMPORT", "PROVIDER_SYNC", "LOCAL_SYNC"] as const).default("MANUAL"),
  note: z.string().trim().max(500).optional(),
  snapshotAt: z.coerce.date().default(() => new Date()),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
})

export type ProviderRecord = {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly category: AccountType
  readonly isActive: boolean
}

export type AccountIntegrationInfo = {
  readonly isConnected: boolean
  readonly connectionId?: string
  readonly providerCode?: string
  readonly providerName?: string
  readonly externalAccountId?: string
  readonly status?: ConnectionStatus
  readonly lastSyncedAt?: Date | null
  readonly latestActualBalance?: bigint | null
  readonly latestSnapshotAt?: Date | null
  readonly latestSource?: SnapshotSource | null
  readonly latestNote?: string | null
}

export async function createProvider(input: z.infer<typeof createProviderSchema>) {
  const parsed = createProviderSchema.parse(input)
  const database = getDatabase()

  return database.provider.upsert({
    where: { code: parsed.code },
    update: {
      name: parsed.name,
      category: parsed.category,
      isActive: true,
    },
    create: {
      code: parsed.code,
      name: parsed.name,
      category: parsed.category,
      isActive: true,
    },
  })
}

export async function listProviders(category?: AccountType) {
  const database = getDatabase()
  return database.provider.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: { name: "asc" },
  })
}

export async function connectAccountProvider(input: {
  readonly accountId: string
  readonly providerId: string
  readonly externalAccountId: string
  readonly metadata?: Record<string, unknown>
}) {
  const parsed = connectProviderSchema.parse(input)
  const database = getDatabase()

  return database.providerConnection.upsert({
    where: { accountId: parsed.accountId },
    update: {
      providerId: parsed.providerId,
      externalAccountId: parsed.externalAccountId,
      status: "ACTIVE",
      metadata: (parsed.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
    create: {
      accountId: parsed.accountId,
      providerId: parsed.providerId,
      externalAccountId: parsed.externalAccountId,
      status: "ACTIVE",
      metadata: (parsed.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  })
}

export async function recordBalanceSnapshot(input: {
  readonly accountId?: string | undefined
  readonly providerConnectionId?: string | undefined
  readonly balance: string
  readonly source?: "MANUAL" | "IMPORT" | "PROVIDER_SYNC" | "LOCAL_SYNC" | undefined
  readonly note?: string | undefined
  readonly snapshotAt?: Date | undefined
  readonly rawPayload?: Record<string, unknown> | undefined
}) {
  const database = getDatabase()

  // If accountId is omitted but providerConnectionId is supplied, resolve accountId
  let resolvedAccountId = input.accountId
  if (!resolvedAccountId && input.providerConnectionId) {
    const conn = await database.providerConnection.findUnique({
      where: { id: input.providerConnectionId },
    })
    if (conn) {
      resolvedAccountId = conn.accountId
    }
  }

  if (!resolvedAccountId) {
    throw new Error("accountId is required to record a balance snapshot.")
  }

  const parsed = recordSnapshotSchema.parse({
    ...input,
    accountId: resolvedAccountId,
  })

  return database.$transaction(async (tx) => {
    const snapshot = await tx.externalBalanceSnapshot.create({
      data: {
        accountId: parsed.accountId,
        providerConnectionId: parsed.providerConnectionId ?? null,
        balance: parsed.balance,
        source: parsed.source,
        note: parsed.note ?? null,
        snapshotAt: parsed.snapshotAt,
        rawPayload: (parsed.rawPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    })

    if (parsed.providerConnectionId) {
      await tx.providerConnection.update({
        where: { id: parsed.providerConnectionId },
        data: {
          lastSyncedAt: parsed.snapshotAt,
        },
      })
    }

    return snapshot
  })
}

export async function getAccountIntegrationInfo(
  accountId: string,
): Promise<AccountIntegrationInfo> {
  const database = getDatabase()

  const [connection, latestSnapshot] = await Promise.all([
    database.providerConnection.findUnique({
      where: { accountId },
      include: {
        provider: true,
      },
    }),
    database.externalBalanceSnapshot.findFirst({
      where: { accountId },
      orderBy: { snapshotAt: "desc" },
    }),
  ])

  if (!connection) {
    return {
      isConnected: false,
      latestActualBalance: latestSnapshot ? latestSnapshot.balance : null,
      latestSnapshotAt: latestSnapshot ? latestSnapshot.snapshotAt : null,
      latestSource: latestSnapshot ? latestSnapshot.source : null,
      latestNote: latestSnapshot ? latestSnapshot.note : null,
    }
  }

  return {
    isConnected: true,
    connectionId: connection.id,
    providerCode: connection.provider.code,
    providerName: connection.provider.name,
    externalAccountId: connection.externalAccountId,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt,
    latestActualBalance: latestSnapshot ? latestSnapshot.balance : null,
    latestSnapshotAt: latestSnapshot ? latestSnapshot.snapshotAt : null,
    latestSource: latestSnapshot ? latestSnapshot.source : null,
    latestNote: latestSnapshot ? latestSnapshot.note : null,
  }
}

export async function listBalanceSnapshots(accountIdOrConnectionId: string, limit = 20) {
  const database = getDatabase()
  return database.externalBalanceSnapshot.findMany({
    where: {
      OR: [
        { accountId: accountIdOrConnectionId },
        { providerConnectionId: accountIdOrConnectionId },
      ],
    },
    orderBy: { snapshotAt: "desc" },
    take: limit,
  })
}
