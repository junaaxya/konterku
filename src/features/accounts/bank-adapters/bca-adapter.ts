import type { ProviderConnection } from "@/generated/prisma/client"
import {
  type OfficialBankAdapter,
  type NormalizedBalanceResponse,
  ProviderApiNotConfiguredError,
  ProviderApiResponseError,
} from "./bank-adapter-interface"

export function parseBcaBalanceResponse(payload: unknown): NormalizedBalanceResponse {
  if (!payload || typeof payload !== "object") {
    throw new ProviderApiResponseError("BCA", "Payload respon kosong atau bukan objek.")
  }

  const p = payload as Record<string, unknown>

  // 1. SNAP Standard format: AccountInfos[0].AvailableBalance.value
  if (Array.isArray(p["AccountInfos"]) && p["AccountInfos"].length > 0) {
    const info = p["AccountInfos"][0] as Record<string, unknown>
    const avail = info["AvailableBalance"] as Record<string, unknown> | undefined
    const val = avail?.["value"] ?? info["AvailableBalance"]
    if (typeof val === "string" || typeof val === "number") {
      const cleanNum = String(val).split(".")[0]!.replace(/[^0-9]/g, "")
      if (cleanNum) {
        return {
          balance: BigInt(cleanNum),
          observedAt: new Date(),
          rawPayload: p,
        }
      }
    }
  }

  // 2. BCA Corporate API format: AvailableBalance string
  if (p["AvailableBalance"] !== undefined) {
    const rawVal = String(p["AvailableBalance"]).split(".")[0]!.replace(/[^0-9]/g, "")
    if (rawVal) {
      return {
        balance: BigInt(rawVal),
        observedAt: new Date(),
        rawPayload: p,
      }
    }
  }

  // 3. Simple normalized amount / balance key
  if (p["balance"] !== undefined) {
    const rawVal = String(p["balance"]).split(".")[0]!.replace(/[^0-9]/g, "")
    if (rawVal) {
      return {
        balance: BigInt(rawVal),
        observedAt: new Date(),
        rawPayload: p,
      }
    }
  }

  throw new ProviderApiResponseError("BCA", "Tidak dapat mengekstrak nominal saldo dari respon BCA API.")
}

export class BcaOfficialAdapter implements OfficialBankAdapter {
  readonly providerCode = "BCA"
  readonly providerName = "Bank Central Asia (BCA API)"

  isConfigured(): boolean {
    const clientId = process.env["BCA_CLIENT_ID"]
    const clientSecret = process.env["BCA_CLIENT_SECRET"]
    const apiKey = process.env["BCA_API_KEY"]
    return Boolean(clientId && clientSecret && apiKey)
  }

  async getBalance(connection: ProviderConnection): Promise<NormalizedBalanceResponse> {
    if (!this.isConfigured()) {
      throw new ProviderApiNotConfiguredError("BCA")
    }

    if (!connection.externalAccountId) {
      throw new ProviderApiResponseError("BCA", "Nomor rekening tidak ditemukan pada koneksi.")
    }

    throw new ProviderApiNotConfiguredError("BCA")
  }
}
