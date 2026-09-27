import { formatRupiah } from "@/lib/money"
import type { getTransactionById } from "@/features/transactions/transaction-service"

export type TransactionDetail = Awaited<ReturnType<typeof getTransactionById>>

export type PaperProfile = "58mm" | "80mm"

export type PrinterConfig = {
  readonly model: string
  readonly connectionType: "BROWSER_PRINT" | "BLUETOOTH" | "NETWORK"
  readonly paperProfile: PaperProfile
  readonly maxColumns: number
  readonly feedLines: number
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  model: "EPPOS EPX583-V2",
  connectionType: "BROWSER_PRINT",
  paperProfile: "58mm",
  maxColumns: 32,
  feedLines: 3,
}

export type ReceiptLineItem = {
  readonly label: string
  readonly value: string
  readonly isBold?: boolean
}

export type ReceiptPaymentAccount = {
  readonly accountName: string
  readonly amount: string
}

export type ReceiptData = {
  readonly storeName: string
  readonly storeSubtitle: string
  readonly networkNotice: string
  readonly transactionId: string
  readonly transactionNumber: string
  readonly formattedDate: string
  readonly category: string
  readonly description: string
  readonly isCancelled: boolean
  readonly cancelReason?: string | null | undefined
  readonly statusText: string
  readonly grossAmount: string
  readonly feeAmount?: string | undefined
  readonly totalPaid: string
  readonly paymentAccounts: readonly ReceiptPaymentAccount[]
  readonly footerThankYou: string
  readonly footerNotice: string
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function buildReceiptData(
  transaction: TransactionDetail,
  config: PrinterConfig = DEFAULT_PRINTER_CONFIG,
): ReceiptData {
  const isCancelled = transaction.status === "CANCELLED"
  const isServiceWithFee =
    transaction.category === "BANK_TRANSFER" ||
    transaction.category === "CASH_WITHDRAWAL" ||
    transaction.category === "EWALLET_TOPUP"

  const totalPaidBig = isServiceWithFee
    ? transaction.grossAmount + transaction.feeAmount
    : transaction.grossAmount

  const paymentAccounts: ReceiptPaymentAccount[] = transaction.ledgerEntries
    .filter((e) => e.direction === "IN" && !e.description.startsWith("[BATAL]"))
    .map((e) => ({
      accountName: e.account.name,
      amount: formatRupiah(e.amount),
    }))

  const storeSubtitle =
    config.paperProfile === "58mm"
      ? "Solusi Layanan & Pulsa"
      : "Solusi Layanan & Pulsa Konter"

  return {
    storeName: "KONTERKU",
    storeSubtitle,
    networkNotice: "Jaringan Lokal",
    transactionId: transaction.id,
    transactionNumber: transaction.transactionNumber,
    formattedDate: dateFormatter.format(transaction.occurredAt),
    category: transaction.category,
    description: transaction.description,
    isCancelled,
    cancelReason: transaction.cancelReason,
    statusText: isCancelled ? "DIBATALKAN" : "LUNAS / SELESAI",
    grossAmount: formatRupiah(transaction.grossAmount),
    feeAmount: transaction.feeAmount > 0n ? formatRupiah(transaction.feeAmount) : undefined,
    totalPaid: formatRupiah(totalPaidBig),
    paymentAccounts,
    footerThankYou: "Terima Kasih Atas Kunjungan Anda",
    footerNotice: "Simpan struk ini sebagai bukti pembayaran yang sah.",
  }
}
