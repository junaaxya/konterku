"use server"

import { revalidatePath } from "next/cache"
import { syncProviderBalance } from "@/features/accounts/bank-adapters/sync-service"

export async function syncProviderBalanceAction(formData: FormData): Promise<{
  success: boolean
  error?: string | undefined
}> {
  const accountId = formData.get("accountId")
  if (typeof accountId !== "string" || !accountId) {
    return {
      success: false,
      error: "ID akun tidak valid.",
    }
  }

  const res = await syncProviderBalance(accountId)

  revalidatePath("/accounts")
  revalidatePath("/")

  return {
    success: res.success,
    error: res.error,
  }
}
