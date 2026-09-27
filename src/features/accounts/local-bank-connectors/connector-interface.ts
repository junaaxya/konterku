import { z } from "zod"

export const maxRupiahAmount = 9_223_372_036_854_775_807n

export const mobileBridgePayloadSchema = z.object({
  accountId: z.string().cuid(),
  providerCode: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_]+$/),
  accountIdentifier: z.string().trim().min(1).max(100),
  balance: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((val) => BigInt(val))
    .pipe(z.bigint().min(0n).max(maxRupiahAmount)),
  observedAt: z.coerce.date().default(() => new Date()),
  bridgeMetadata: z.record(z.string(), z.unknown()).optional(),
})

export type MobileBridgePayload = z.infer<typeof mobileBridgePayloadSchema>

export type MobileBridgeIngestResult = {
  readonly success: boolean
  readonly snapshotId?: string
  readonly balance?: bigint
  readonly observedAt?: Date
  readonly error?: string
}

export type LocalBalanceResult = {
  readonly balance: bigint
  readonly observedAt: Date
  readonly rawPayload?: Record<string, unknown>
}

export interface BankConnector {
  readonly providerCode: string
  readonly providerName: string
  readonly portalUrl: string
  isConfigured(): boolean
  parseBalance(htmlOrContent: string): bigint
}

export class BankConnectorError extends Error {
  override readonly name: string = "BankConnectorError"
  constructor(readonly providerCode: string, message: string) {
    super(`[${providerCode}] ${message}`)
  }
}

export class BankSessionExpiredError extends BankConnectorError {
  override readonly name: string = "BankSessionExpiredError"
  constructor(providerCode: string) {
    super(
      providerCode,
      "Sesi web portal bank di perangkat Android telah berakhir. Silakan buka tab/portal bank dan login kembali.",
    )
  }
}

export class BankStructureChangedError extends BankConnectorError {
  override readonly name: string = "BankStructureChangedError"
  constructor(providerCode: string, detail?: string) {
    super(
      providerCode,
      `Format atau struktur halaman portal bank berubah / tidak dikenali.${detail ? ` (${detail})` : ""}`,
    )
  }
}
