import type { ProviderConnection } from "@/generated/prisma/client"

export type NormalizedBalanceResponse = {
  readonly balance: bigint
  readonly observedAt: Date
  readonly rawPayload?: Record<string, unknown>
}

export interface OfficialBankAdapter {
  readonly providerCode: string
  readonly providerName: string
  isConfigured(): boolean
  getBalance(connection: ProviderConnection): Promise<NormalizedBalanceResponse>
}

export class ProviderApiNotConfiguredError extends Error {
  readonly name = "ProviderApiNotConfiguredError"

  constructor(readonly providerCode: string) {
    super(`Konfigurasi API untuk provider ${providerCode} belum tersedia atau belum lengkap.`)
  }
}

export class ProviderApiResponseError extends Error {
  readonly name = "ProviderApiResponseError"

  constructor(readonly providerCode: string, message: string) {
    super(`Respon API ${providerCode} tidak valid: ${message}`)
  }
}
