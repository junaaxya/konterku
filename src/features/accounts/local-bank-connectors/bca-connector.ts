import {
  type BankConnector,
  BankSessionExpiredError,
  BankStructureChangedError,
} from "./connector-interface"

export function parseBcaWebPortalBalance(htmlOrText: string): bigint {
  if (!htmlOrText || typeof htmlOrText !== "string") {
    throw new BankStructureChangedError("BCA", "Konten kosong")
  }

  // Detect session timeout / login required
  const lower = htmlOrText.toLowerCase()
  if (
    lower.includes("session expired") ||
    lower.includes("silakan login kembali") ||
    lower.includes("login kembali") ||
    lower.includes("user id") && lower.includes("password")
  ) {
    if (!lower.includes("rekening") && !lower.includes("saldo")) {
      throw new BankSessionExpiredError("BCA")
    }
  }

  // 1. Table cell pattern: e.g. <td ...>IDR</td><td ...>25.450.000,00</td> or similar KlikBCA / KlikBCA Bisnis table
  // Matching Indonesian currency formats: e.g. 1.500.000,00 or 1500000.00 or 1.500.000
  const balanceRowMatch = htmlOrText.match(
    /(?:saldo\s*(?:efektif|akhir|tersedia|rekening)?[:\s<>/a-z0-9_="'-]*)(?:IDR|Rp\.?)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i,
  )

  if (balanceRowMatch?.[1]) {
    return cleanRupiahToBigInt(balanceRowMatch[1], "BCA")
  }

  // 2. Direct table data pattern: <td>0123456789</td><td>TABUNGAN</td><td>IDR</td><td align="right">2.500.000,00</td>
  const tdPattern =
    /<td[^>]*>(?:IDR|Rp\.?)<\/td>\s*<td[^>]*>\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\s*<\/td>/i
  const tdMatch = htmlOrText.match(tdPattern)
  if (tdMatch?.[1]) {
    return cleanRupiahToBigInt(tdMatch[1], "BCA")
  }

  // 3. JSON response payload if portal uses internal fetch
  if (htmlOrText.trim().startsWith("{") && htmlOrText.trim().endsWith("}")) {
    try {
      const json = JSON.parse(htmlOrText) as Record<string, unknown>
      const raw =
        json["availableBalance"] ??
        json["balance"] ??
        json["saldo"] ??
        json["effectiveBalance"]
      if (raw !== undefined && raw !== null) {
        return cleanRupiahToBigInt(String(raw), "BCA")
      }
    } catch {
      // Not json, continue
    }
  }

  throw new BankStructureChangedError(
    "BCA",
    "Gagal menemukan elemen saldo pada halaman portal BCA",
  )
}

function cleanRupiahToBigInt(val: string, provider: string): bigint {
  // Handles '2.500.000,00' -> '2500000' or '2500000.00' -> '2500000'
  let normalized = val.trim()
  if (normalized.includes(",")) {
    normalized = normalized.split(",")[0]!
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".")
    if (parts.length === 2 && parts[1]?.length === 2) {
      normalized = parts[0]!
    }
  }
  const digitsOnly = normalized.replace(/[^0-9]/g, "")
  if (!digitsOnly) {
    throw new BankStructureChangedError(provider, `Nominal tidak valid: ${val}`)
  }
  return BigInt(digitsOnly)
}

export class BcaLocalConnector implements BankConnector {
  readonly providerCode = "BCA"
  readonly providerName = "KlikBCA Mobile / Web Portal"
  readonly portalUrl = "https://www.klikbca.com"

  isConfigured(): boolean {
    return true
  }

  parseBalance(htmlOrContent: string): bigint {
    return parseBcaWebPortalBalance(htmlOrContent)
  }
}
