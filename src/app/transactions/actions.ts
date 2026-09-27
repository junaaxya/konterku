"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ZodError } from "zod"

import {
  cancelTransaction,
  createExpense,
  createIncome,
  TransactionAlreadyCancelledError,
  TransactionNotFoundError,
} from "@/features/transactions/transaction-service"
import { InactiveAccountError, AccountNotFoundError } from "@/features/accounts/account-ledger"

const failureMessage = "Gagal memproses transaksi. Periksa kembali data Anda."

export async function createIncomeAction(formData: FormData): Promise<void> {
  let createdId: string | null = null
  try {
    const tx = await createIncome({
      accountId: formData.get("accountId"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      occurredAt: formData.get("occurredAt") || undefined,
    })
    createdId = tx.id
    revalidatePath("/transactions")
    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError || error instanceof InactiveAccountError || error instanceof AccountNotFoundError) {
      throw new Error(failureMessage)
    }
    throw error
  }

  if (createdId) {
    redirect(`/transactions/${createdId}`)
  }
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  let createdId: string | null = null
  try {
    const tx = await createExpense({
      accountId: formData.get("accountId"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      occurredAt: formData.get("occurredAt") || undefined,
    })
    createdId = tx.id
    revalidatePath("/transactions")
    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError || error instanceof InactiveAccountError || error instanceof AccountNotFoundError) {
      throw new Error(failureMessage)
    }
    throw error
  }

  if (createdId) {
    redirect(`/transactions/${createdId}`)
  }
}

export async function cancelTransactionAction(formData: FormData): Promise<void> {
  const transactionId = formData.get("transactionId") as string
  try {
    await cancelTransaction({
      transactionId,
      reason: formData.get("reason"),
    })
    revalidatePath(`/transactions/${transactionId}`)
    revalidatePath("/transactions")
    revalidatePath("/accounts")
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof TransactionNotFoundError ||
      error instanceof TransactionAlreadyCancelledError
    ) {
      throw new Error("Gagal membatalkan transaksi: " + (error instanceof Error ? error.message : failureMessage))
    }
    throw error
  }
}
