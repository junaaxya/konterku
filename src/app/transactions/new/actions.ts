"use server"

import { safeRevalidatePath } from "@/lib/revalidate"
import { redirect } from "next/navigation"
import { ZodError } from "zod"

import {
  createBankTransferTransaction,
  createCashWithdrawalTransaction,
  createEwalletTopupTransaction,
  createProductTransaction,
} from "@/features/transactions/counter-transaction-service"
import { InactiveAccountError, AccountNotFoundError } from "@/features/accounts/account-ledger"

const failureMessage = "Gagal memproses transaksi. Periksa kembali data Anda."

export async function createCounterTransactionAction(formData: FormData): Promise<void> {
  const type = formData.get("categoryType") as string
  let createdId: string | null = null

  try {
    if (type === "BANK_TRANSFER") {
      const tx = await createBankTransferTransaction({
        sourceAccountId: formData.get("sourceAccountId"),
        customerPaymentAccountId: formData.get("customerPaymentAccountId"),
        transferAmount: formData.get("transferAmount"),
        adminFee: formData.get("adminFee") || "0",
        description: formData.get("description"),
      })
      createdId = tx.id
    } else if (type === "CASH_WITHDRAWAL") {
      const tx = await createCashWithdrawalTransaction({
        sourceCashAccountId: formData.get("sourceCashAccountId"),
        customerSettlementAccountId: formData.get("customerSettlementAccountId"),
        cashAmount: formData.get("cashAmount"),
        adminFee: formData.get("adminFee") || "0",
        description: formData.get("description"),
      })
      createdId = tx.id
    } else if (type === "EWALLET_TOPUP") {
      const tx = await createEwalletTopupTransaction({
        shopSourceAccountId: formData.get("shopSourceAccountId"),
        customerPaymentAccountId: formData.get("customerPaymentAccountId"),
        topupAmount: formData.get("topupAmount"),
        adminFee: formData.get("adminFee") || "0",
        description: formData.get("description"),
      })
      createdId = tx.id
    } else {
      const categoryVal = formData.get("category")
      const isCreditRaw = formData.get("isCredit") === "true"
      const customerId = formData.get("customerId")?.toString()
      const productId = formData.get("productId")?.toString()
      const rawQuantity = parseInt(formData.get("quantity")?.toString() || "1", 10)
      const dueDateRaw = formData.get("dueDate")?.toString()

      const tx = await createProductTransaction({
        category: categoryVal,
        customerAccountId: isCreditRaw ? undefined : formData.get("customerAccountId"),
        costAccountId: formData.get("costAccountId"),
        costAmount: formData.get("costAmount") || "0",
        sellingPrice: formData.get("sellingPrice"),
        description: formData.get("description"),
        isCredit: isCreditRaw,
        customerId: isCreditRaw && customerId ? customerId : undefined,
        productId: productId && productId.length > 0 ? productId : undefined,
        quantity: Number.isNaN(rawQuantity) || rawQuantity <= 0 ? 1 : rawQuantity,
        dueDate: dueDateRaw && dueDateRaw.length > 0 ? new Date(dueDateRaw) : undefined,
      })
      createdId = tx.id
    }

    safeRevalidatePath("/transactions")
    safeRevalidatePath("/accounts")
    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/inventory")
    safeRevalidatePath("/reports")
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof InactiveAccountError ||
      error instanceof AccountNotFoundError
    ) {
      throw new Error(error instanceof Error ? error.message : failureMessage)
    }
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    throw error
  }

  if (createdId) {
    redirect(`/transactions/${createdId}`)
  }
}
