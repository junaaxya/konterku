"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"

import {
  AccountNotFoundError,
  InactiveAccountError,
  createAccount,
  renameAccount,
  setAccountActive,
} from "@/features/accounts/account-ledger"
import { recordCashReconciliation } from "@/features/accounts/cash-reconciliation"

const failureMessage = "Gagal menyimpan perubahan. Periksa data lalu coba lagi."

export async function createAccountAction(
  formData: FormData,
): Promise<void> {
  try {
    await createAccount({
      name: formData.get("name"),
      type: formData.get("type"),
      openingBalance: formData.get("openingBalance") ?? undefined,
    })
    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function renameAccountAction(
  formData: FormData,
): Promise<void> {
  try {
    await renameAccount({
      accountId: formData.get("accountId"),
      name: formData.get("name"),
    })
    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError || error instanceof AccountNotFoundError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function setAccountActiveAction(
  formData: FormData,
): Promise<void> {
  try {
    await setAccountActive({
      accountId: formData.get("accountId"),
      isActive: formData.get("isActive") === "true",
    })
    revalidatePath("/accounts")
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof AccountNotFoundError ||
      error instanceof InactiveAccountError
    ) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function reconcileCashAccountAction(
  formData: FormData,
): Promise<void> {
  try {
    const accountId = formData.get("accountId")
    const physicalAmount = formData.get("physicalAmount")
    const note = formData.get("note")

    if (typeof accountId !== "string" || typeof physicalAmount !== "string") {
      throw new Error(failureMessage)
    }

    await recordCashReconciliation({
      accountId,
      physicalAmount,
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined,
    })
    revalidatePath("/accounts")
  } catch (error) {
    if (error instanceof ZodError || error instanceof AccountNotFoundError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}
