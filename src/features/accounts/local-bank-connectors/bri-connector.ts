import {
  type BankConnector,
  BankSessionExpiredError,
  BankStructureChangedError,
} from "./connector-interface"

export function parseBriWebPortalBalance(htmlOrText: string): bigint {
  if (!htmlOrText || typeof htmlOrText !== "string") {
    throw new BankStructureChangedError("BRI", "Konten kosong")
  }

  const lower = htmlOrText.toLowerCase()
  if (
    lower.includes("session timeout") ||
    lower.includes("sesi anda telah berakhir") ||
    lower.includes("silakan masuk kembali") ||
    lower.includes("login ib bri")
  ) {
    if (!lower.includes("rekening") && !lower.includes("saldo")) {
      throw new BankSessionExpiredError("BRI")
    }
  }

  // 1. Table cell pattern: e.g. <td>Saldo Efektif</td><td>IDR</td><td>12.500.000,00</td>
  const briRowMatch = htmlOrText.match(
    /(?:saldo\s*(?:efektif|akhir|tersedia|rekening)?[:\s<>/a-z0-9_="'-]*)(?:IDR|Rp\.?)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i,
  )

  if (briRowMatch?.[1]) {
    return cleanRupiahToBigInt(briRowMatch[1], "BRI")
  }

  // 2. Class-based or span pattern: <span class="saldo">Rp 12.500.000,00</span>
  const spanPattern =
    /<(?:span|div|td)[^>]*class="[^"]*(?:balance|saldo|amount)[^"]*"[^>]*>\s*(?:IDR|Rp\.?)?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\s*<\/(?:span|div|td)>/i
  const spanMatch = htmlOrText.match(spanPattern)
  if (spanMatch?.[1]) {
    return cleanRupiahToBigInt(spanMatch[1], "BRI")
  }

  // 3. JSON response payload
  if (htmlOrText.trim().startsWith("{") && htmlOrText.trim().endsWith("}")) {
    try {
      const json = JSON.parse(htmlOrText) as Record<string, unknown>
      const raw =
        json["saldo"] ??
        json["availableBalance"] ??
        json["effectiveBalance"] ??
        json["balance"]
      if (raw !== undefined && raw !== null) {
        return cleanRupiahToBigInt(String(raw), "BRI")
      }
    } catch {
      // Not json
    }
  }

  throw new BankStructureChangedError(
    "BRI",
    "Gagal menemukan elemen saldo pada halaman portal BRI",
  )
}

function cleanRupiahToBigInt(val: string, provider: string): bigint {
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

export class BriLocalConnector implements BankConnector {
  readonly providerCode = "BRI"
  readonly providerName = "Internet Banking BRI Mobile / Web Portal"
  readonly portalUrl = "https://ib.bri.co.id"

  isConfigured(): boolean {
    return true
  }

  parseBalance(htmlOrContent: string): bigint {
    return parseBriWebPortalBalance(htmlOrContent)
  }
}
