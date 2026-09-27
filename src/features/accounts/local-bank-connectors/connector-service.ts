import crypto from "crypto"
import { getDatabase } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { recordBalanceSnapshot } from "@/features/accounts/provider-integration"
import { AccountNotFoundError, accountIdSchema } from "@/features/accounts/account-ledger"
import type {
  BankConnector,
  MobileBridgePayload,
  MobileBridgeIngestResult,
} from "./connector-interface"
import {
  mobileBridgePayloadSchema,
  BankConnectorError,
  BankSessionExpiredError,
} from "./connector-interface"
import { BcaLocalConnector } from "./bca-connector"
import { BriLocalConnector } from "./bri-connector"

const connectors = new Map<string, BankConnector>()

export function registerLocalConnector(connector: BankConnector) {
  connectors.set(connector.providerCode.toUpperCase(), connector)
}

registerLocalConnector(new BcaLocalConnector())
registerLocalConnector(new BriLocalConnector())

export function getLocalConnector(providerCode: string): BankConnector | undefined {
  return connectors.get(providerCode.toUpperCase())
}

export type LocalSyncResult = {
  readonly success: boolean
  readonly balance?: bigint
  readonly lastSyncAt?: Date
  readonly error?: string
}

export function generatePairingToken(): string {
  return `ktk_${crypto.randomBytes(16).toString("hex")}`
}

export async function connectLocalBank(input: {
  readonly accountId: string
  readonly providerCode: string
  readonly metadata?: Record<string, unknown>
}) {
  const database = getDatabase()

  const existing = await database.localBankConnection.findUnique({
    where: { accountId: input.accountId },
  })

  const pairingToken = existing?.pairingToken || generatePairingToken()

  return database.localBankConnection.upsert({
    where: { accountId: input.accountId },
    update: {
      providerCode: input.providerCode.toUpperCase(),
      enabled: true,
      status: "ACTIVE",
      pairingToken,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
    create: {
      accountId: input.accountId,
      providerCode: input.providerCode.toUpperCase(),
      enabled: true,
      status: "ACTIVE",
      pairingToken,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  })
}

export async function regeneratePairingToken(accountId: string): Promise<string> {
  const parsedId = accountIdSchema.parse(accountId)
  const database = getDatabase()
  const account = await database.account.findUnique({
    where: { id: parsedId },
  })

  if (!account) {
    throw new AccountNotFoundError(parsedId)
  }

  const newToken = generatePairingToken()
  const defaultProviderCode = account.name.toUpperCase().includes("BRI")
    ? "BRI"
    : account.name.toUpperCase().includes("BCA")
    ? "BCA"
    : account.type

  await database.localBankConnection.upsert({
    where: { accountId: parsedId },
    update: {
      pairingToken: newToken,
      enabled: true,
      status: "ACTIVE",
    },
    create: {
      accountId: parsedId,
      providerCode: defaultProviderCode,
      pairingToken: newToken,
      enabled: true,
      status: "ACTIVE",
    },
  })

  return newToken
}

export async function getLocalBankConnection(accountId: string) {
  const database = getDatabase()
  return database.localBankConnection.findUnique({
    where: { accountId },
  })
}

export async function ingestMobileBridgeBalance(
  rawInput: unknown,
  authHeader?: string | null,
): Promise<MobileBridgeIngestResult> {
  const parsed: MobileBridgePayload = mobileBridgePayloadSchema.parse(rawInput)
  const database = getDatabase()

  // Authenticate token: check Bearer token or pairingToken in payload
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader?.trim()

  const connection = await database.localBankConnection.findUnique({
    where: { accountId: parsed.accountId },
    include: { account: true },
  })

  if (!connection || !connection.enabled) {
    return {
      success: false,
      error: "Koneksi bank lokal tidak ditemukan atau belum aktif untuk akun ini.",
    }
  }

  // If connection has a pairing token configured, require match
  if (connection.pairingToken) {
    if (!tokenFromHeader || tokenFromHeader !== connection.pairingToken) {
      return {
        success: false,
        error: "Token pairing tidak valid atau tidak disertakan.",
      }
    }
  }

  // Update local bank connection status and sync timestamps
  await database.localBankConnection.update({
    where: { id: connection.id },
    data: {
      providerCode: parsed.providerCode,
      status: "ACTIVE",
      lastSyncAt: parsed.observedAt,
      lastSuccessAt: parsed.observedAt,
      metadata: {
        ...((connection.metadata as Record<string, unknown>) || {}),
        accountIdentifier: parsed.accountIdentifier,
        ...(parsed.bridgeMetadata || {}),
        lastError: null,
      } as Prisma.InputJsonValue,
    },
  })

  // Write external snapshot with source LOCAL_SYNC
  const snapshot = await recordBalanceSnapshot({
    accountId: parsed.accountId,
    balance: parsed.balance.toString(),
    source: "LOCAL_SYNC",
    note: `Ekstensi Android Firefox (${parsed.providerCode} - ${parsed.accountIdentifier})`,
    snapshotAt: parsed.observedAt,
    rawPayload: {
      providerCode: parsed.providerCode,
      accountIdentifier: parsed.accountIdentifier,
      ...(parsed.bridgeMetadata || {}),
    },
  })

  return {
    success: true,
    snapshotId: snapshot.id,
    balance: snapshot.balance,
    observedAt: snapshot.snapshotAt,
  }
}

export async function syncLocalBankBalance(
  accountId: string,
  injectedConnector?: BankConnector,
): Promise<LocalSyncResult> {
  const database = getDatabase()

  const connection = await database.localBankConnection.findUnique({
    where: { accountId },
  })

  if (!connection || !connection.enabled) {
    return {
      success: false,
      error: "Konektor bank lokal belum diaktifkan untuk akun ini.",
    }
  }

  const connector = injectedConnector || getLocalConnector(connection.providerCode)

  if (!connector) {
    return {
      success: false,
      error: `Konektor untuk ${connection.providerCode} belum tersedia.`,
    }
  }

  const now = new Date()
  const meta = (connection.metadata as Record<string, unknown>) || {}

  try {
    let balance: bigint | null = null

    // 1. If mock fixture provided in dev / test
    if (typeof meta["mockHtml"] === "string") {
      balance = connector.parseBalance(meta["mockHtml"])
    } else if (meta["isMockConnected"] === true && typeof meta["mockBalance"] === "string") {
      balance = BigInt(meta["mockBalance"])
    }

    if (balance === null) {
      return {
        success: false,
        error:
          "Sesi perbankan belum disinkronkan dari perangkat Android. Silakan buka web portal bank di Android dan klik 'Sinkronkan Saldo'.",
      }
    }

    // Save as ExternalBalanceSnapshot with source = LOCAL_SYNC
    const snapshot = await recordBalanceSnapshot({
      accountId: connection.accountId,
      balance: balance.toString(),
      source: "LOCAL_SYNC",
      note: `Sinkronisasi konektor lokal ${connector.providerName}`,
      snapshotAt: now,
      rawPayload: { provider: connector.providerCode, source: "mobile_session_bridge" },
    })

    await database.localBankConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: now,
        lastSuccessAt: now,
        status: "ACTIVE",
        metadata: {
          ...meta,
          lastError: null,
        } as Prisma.InputJsonValue,
      },
    })

    return {
      success: true,
      balance: snapshot.balance,
      lastSyncAt: now,
    }
  } catch (err) {
    const isSessionExpired = err instanceof BankSessionExpiredError
    const safeError =
      err instanceof BankConnectorError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Terjadi kesalahan pada konektor bank lokal."

    await database.localBankConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: now,
        lastErrorAt: now,
        status: isSessionExpired ? "INACTIVE" : "ERROR",
        metadata: {
          ...meta,
          lastError: safeError,
        } as Prisma.InputJsonValue,
      },
    })

    return {
      success: false,
      error: safeError,
    }
  }
}
