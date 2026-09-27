"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import {
  matchExternalToExistingTransaction,
  recordUnmatchedAsIncome,
  recordUnmatchedAsExpense,
  ignoreExternalTransaction,
} from "@/features/accounts/external-reconciliation"

const failureMessage = "Gagal memproses aksi rekonsiliasi. Coba lagi."

export async function matchToExistingAction(formData: FormData): Promise<void> {
  try {
    const externalTransactionId = formData.get("externalTransactionId")
    const transactionId = formData.get("transactionId")
    const note = formData.get("note")

    if (typeof externalTransactionId !== "string" || typeof transactionId !== "string") {
      throw new Error(failureMessage)
    }

    await matchExternalToExistingTransaction({
      externalTransactionId,
      transactionId,
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined,
    })

    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function recordAsIncomeAction(formData: FormData): Promise<void> {
  try {
    const externalTransactionId = formData.get("externalTransactionId")
    const description = formData.get("description")
    const note = formData.get("note")

    if (typeof externalTransactionId !== "string") {
      throw new Error(failureMessage)
    }

    await recordUnmatchedAsIncome({
      externalTransactionId,
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : undefined,
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined,
    })

    revalidatePath("/accounts")
    revalidatePath("/transactions")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function recordAsExpenseAction(formData: FormData): Promise<void> {
  try {
    const externalTransactionId = formData.get("externalTransactionId")
    const description = formData.get("description")
    const note = formData.get("note")

    if (typeof externalTransactionId !== "string") {
      throw new Error(failureMessage)
    }

    await recordUnmatchedAsExpense({
      externalTransactionId,
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : undefined,
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined,
    })

    revalidatePath("/accounts")
    revalidatePath("/transactions")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function ignoreExternalAction(formData: FormData): Promise<void> {
  try {
    const externalTransactionId = formData.get("externalTransactionId")
    const note = formData.get("note")

    if (typeof externalTransactionId !== "string") {
      throw new Error(failureMessage)
    }

    await ignoreExternalTransaction({
      externalTransactionId,
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined,
    })

    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}
