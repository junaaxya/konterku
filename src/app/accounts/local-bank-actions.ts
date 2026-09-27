"use server"

import { revalidatePath } from "next/cache"
import {
  connectLocalBank,
  syncLocalBankBalance,
  regeneratePairingToken,
} from "@/features/accounts/local-bank-connectors/connector-service"

export async function connectLocalBankAction(formData: FormData): Promise<{
  success: boolean
  error?: string | undefined
}> {
  const accountId = formData.get("accountId")
  const providerCode = formData.get("providerCode")

  if (typeof accountId !== "string" || typeof providerCode !== "string") {
    return { success: false, error: "Data koneksi tidak valid." }
  }

  try {
    await connectLocalBank({
      accountId,
      providerCode,
    })
    revalidatePath("/accounts")
    revalidatePath("/")
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengaktifkan konektor bank lokal.",
    }
  }
}

export async function regeneratePairingTokenAction(formData: FormData): Promise<{
  success: boolean
  token?: string | undefined
  error?: string | undefined
}> {
  const accountId = formData.get("accountId")
  if (typeof accountId !== "string" || !accountId) {
    return { success: false, error: "ID akun tidak valid." }
  }

  try {
    const token = await regeneratePairingToken(accountId)
    revalidatePath("/accounts")
    return { success: true, token }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat token baru.",
    }
  }
}

export async function syncLocalBankBalanceAction(formData: FormData): Promise<{
  success: boolean
  error?: string | undefined
}> {
  const accountId = formData.get("accountId")

  if (typeof accountId !== "string" || !accountId) {
    return { success: false, error: "ID akun tidak valid." }
  }

  const res = await syncLocalBankBalance(accountId)

  revalidatePath("/accounts")
  revalidatePath("/")

  return {
    success: res.success,
    error: res.error,
  }
}
