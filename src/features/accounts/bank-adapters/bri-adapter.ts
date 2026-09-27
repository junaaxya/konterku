import type { ProviderConnection } from "@/generated/prisma/client"
import {
  type OfficialBankAdapter,
  type NormalizedBalanceResponse,
  ProviderApiNotConfiguredError,
  ProviderApiResponseError,
} from "./bank-adapter-interface"

export function parseBriBalanceResponse(payload: unknown): NormalizedBalanceResponse {
  if (!payload || typeof payload !== "object") {
    throw new ProviderApiResponseError("BRI", "Payload respon kosong atau bukan objek.")
  }

  const p = payload as Record<string, unknown>

  // 1. BRI SNAP Format: AccountInfos[0].AvailableBalance.value or amount.value
  if (Array.isArray(p["AccountInfos"]) && p["AccountInfos"].length > 0) {
    const info = p["AccountInfos"][0] as Record<string, unknown>
    const avail = (info["AvailableBalance"] ?? info["amount"]) as Record<string, unknown> | undefined
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

  // 2. BRIAPI Core format: responseData.sourceAccountBalance or data.balance
  const respData = (p["responseData"] ?? p["data"]) as Record<string, unknown> | undefined
  if (respData) {
    const rawVal =
      respData["sourceAccountBalance"] ??
      respData["balance"] ??
      respData["availableBalance"]
    if (rawVal !== undefined) {
      const cleanNum = String(rawVal).split(".")[0]!.replace(/[^0-9]/g, "")
      if (cleanNum) {
        return {
          balance: BigInt(cleanNum),
          observedAt: new Date(),
          rawPayload: p,
        }
      }
    }
  }

  // 3. Simple balance key
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

  throw new ProviderApiResponseError("BRI", "Tidak dapat mengekstrak nominal saldo dari respon BRIAPI.")
}

export class BriOfficialAdapter implements OfficialBankAdapter {
  readonly providerCode = "BRI"
  readonly providerName = "Bank Rakyat Indonesia (BRIAPI)"

  isConfigured(): boolean {
    const consumerKey = process.env["BRI_CONSUMER_KEY"]
    const consumerSecret = process.env["BRI_CONSUMER_SECRET"]
    return Boolean(consumerKey && consumerSecret)
  }

  async getBalance(connection: ProviderConnection): Promise<NormalizedBalanceResponse> {
    if (!this.isConfigured()) {
      throw new ProviderApiNotConfiguredError("BRI")
    }

    if (!connection.externalAccountId) {
      throw new ProviderApiResponseError("BRI", "Nomor rekening tidak ditemukan pada koneksi.")
    }

    throw new ProviderApiNotConfiguredError("BRI")
  }
}
