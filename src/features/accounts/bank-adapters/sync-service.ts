import { getDatabase } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { recordBalanceSnapshot } from "@/features/accounts/provider-integration"
import type { OfficialBankAdapter } from "./bank-adapter-interface"
import { ProviderApiNotConfiguredError } from "./bank-adapter-interface"
import { BcaOfficialAdapter } from "./bca-adapter"
import { BriOfficialAdapter } from "./bri-adapter"

const adapters = new Map<string, OfficialBankAdapter>()

export function registerBankAdapter(adapter: OfficialBankAdapter) {
  adapters.set(adapter.providerCode.toUpperCase(), adapter)
}

// Register default official adapters
registerBankAdapter(new BcaOfficialAdapter())
registerBankAdapter(new BriOfficialAdapter())

export function getBankAdapter(providerCode: string): OfficialBankAdapter | undefined {
  return adapters.get(providerCode.toUpperCase())
}

export type SyncResult = {
  readonly success: boolean
  readonly balance?: bigint
  readonly lastSyncedAt?: Date
  readonly error?: string
}

export async function syncProviderBalance(
  accountId: string,
  injectedAdapter?: OfficialBankAdapter,
): Promise<SyncResult> {
  const database = getDatabase()

  const connection = await database.providerConnection.findUnique({
    where: { accountId },
    include: { provider: true },
  })

  if (!connection) {
    return {
      success: false,
      error: "Akun ini belum terhubung ke provider bank resmi manapun.",
    }
  }

  const adapter = injectedAdapter || getBankAdapter(connection.provider.code)

  if (!adapter) {
    return {
      success: false,
      error: `Adapter resmi untuk provider ${connection.provider.name} (${connection.provider.code}) belum tersedia.`,
    }
  }

  if (!adapter.isConfigured()) {
    // Record safe unconfigured metadata without leaking secrets
    await database.providerConnection.update({
      where: { id: connection.id },
      data: {
        metadata: {
          ...((connection.metadata as Record<string, unknown>) || {}),
          lastError: "Konfigurasi API belum lengkap",
          lastAttemptAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })

    return {
      success: false,
      error: `Konfigurasi API untuk ${connection.provider.name} belum tersedia di server. Gunakan Input Manual atau Import Mutasi.`,
    }
  }

  try {
    const res = await adapter.getBalance(connection)

    // Save snapshot with source = PROVIDER_SYNC
    const snapshot = await recordBalanceSnapshot({
      accountId: connection.accountId,
      providerConnectionId: connection.id,
      balance: res.balance.toString(),
      source: "PROVIDER_SYNC",
      note: `Sinkronisasi resmi API ${adapter.providerCode}`,
      snapshotAt: res.observedAt,
      rawPayload: res.rawPayload,
    })

    // Update connection status
    await database.providerConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncedAt: res.observedAt,
        status: "ACTIVE",
        metadata: {
          ...((connection.metadata as Record<string, unknown>) || {}),
          lastSuccessfulSync: res.observedAt.toISOString(),
          lastError: null,
        } as Prisma.InputJsonValue,
      },
    })

    return {
      success: true,
      balance: snapshot.balance,
      lastSyncedAt: snapshot.snapshotAt,
    }
  } catch (err) {
    const safeErrorMessage =
      err instanceof ProviderApiNotConfiguredError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyinkronkan saldo bank."

    await database.providerConnection.update({
      where: { id: connection.id },
      data: {
        metadata: {
          ...((connection.metadata as Record<string, unknown>) || {}),
          lastError: safeErrorMessage,
          lastAttemptAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })

    return {
      success: false,
      error: safeErrorMessage,
    }
  }
}
