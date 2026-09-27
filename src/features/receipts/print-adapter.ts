import type { ReceiptData } from "./receipt-domain"
import { buildEscPosPayload } from "./escpos"

export type PrintResult = {
  readonly success: boolean
  readonly error?: string
}

export interface PrintAdapter {
  readonly id: string
  readonly name: string
  print(receipt: ReceiptData): Promise<PrintResult>
}

export class BrowserPrintAdapter implements PrintAdapter {
  readonly id = "browser-print"
  readonly name = "Browser Print (Standar / Preview)"

  async print(receipt: ReceiptData): Promise<PrintResult> {
    if (typeof window === "undefined") {
      return { success: false, error: "window is undefined" }
    }
    if (!receipt.transactionId) {
      return { success: false, error: "invalid receipt" }
    }
    window.print()
    return { success: true }
  }
}

export function generateRawbtUrl(receipt: ReceiptData, maxColumns = 32): string {
  const bytes = buildEscPosPayload(receipt, maxColumns)
  let binary = ""
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 = typeof window !== "undefined" ? window.btoa(binary) : Buffer.from(binary, "binary").toString("base64")
  return `rawbt:base64,${base64}`
}

export class RawbtPrintAdapter implements PrintAdapter {
  readonly id = "rawbt-print"
  readonly name = "RawBT Bluetooth Thermal (Android)"

  async print(receipt: ReceiptData): Promise<PrintResult> {
    if (typeof window === "undefined") {
      return { success: false, error: "window is undefined" }
    }
    try {
      const rawbtUrl = generateRawbtUrl(receipt, 32)
      window.location.href = rawbtUrl
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memicu RawBT print bridge.",
      }
    }
  }
}

export class BluetoothPrintBridgeStub implements PrintAdapter {
  readonly id = "bluetooth-bridge"
  readonly name = "EPPOS Bluetooth Thermal Bridge (Future)"

  async print(receipt: ReceiptData): Promise<PrintResult> {
    if (!receipt.transactionId) {
      return { success: false, error: "invalid receipt" }
    }
    return {
      success: false,
      error: "Bluetooth adapter not connected. Please use browser print adapter or RawBT bridge.",
    }
  }
}

export function getTestReceiptData(): ReceiptData {
  return {
    storeName: "KONTERKU",
    storeSubtitle: "Solusi Layanan & Pulsa",
    networkNotice: "Jaringan Lokal (Uji Cetak)",
    transactionId: "test-print-receipt",
    transactionNumber: "TEST-PRINT-001",
    formattedDate: new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date()),
    category: "PULSA",
    description: "Uji coba printer thermal EPPOS 58mm",
    isCancelled: false,
    statusText: "LUNAS / SELESAI",
    grossAmount: "Rp 10.000",
    totalPaid: "Rp 10.000",
    paymentAccounts: [
      {
        accountName: "Kas Tunai",
        amount: "Rp 10.000",
      },
    ],
    footerThankYou: "Tes Cetak Thermal Berhasil",
    footerNotice: "EPPOS EPX583-V2 siap digunakan.",
  }
}
