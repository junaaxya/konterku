"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import { recordBalanceSnapshot } from "@/features/accounts/provider-integration"
import { parseStatementCsv } from "@/features/accounts/statement-parser"
import { storeImportedExternalTransactions } from "@/features/accounts/external-reconciliation"

const failureMessage = "Gagal memproses data saldo aktual. Periksa kembali input Anda."

export async function recordManualBalanceAction(formData: FormData): Promise<void> {
  try {
    const accountId = formData.get("accountId")
    const balance = formData.get("balance")
    const snapshotAtRaw = formData.get("snapshotAt")
    const note = formData.get("note")

    if (typeof accountId !== "string" || typeof balance !== "string") {
      throw new Error(failureMessage)
    }

    await recordBalanceSnapshot({
      accountId,
      balance,
      source: "MANUAL",
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined,
      snapshotAt: typeof snapshotAtRaw === "string" && snapshotAtRaw ? new Date(snapshotAtRaw) : undefined,
    })

    revalidatePath("/accounts")
    revalidatePath("/")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}

export async function parseStatementCsvAction(formData: FormData): Promise<{
  success: boolean
  rowsCount: number
  detectedBalance: string | null
  detectedDate: string | null
  errors: readonly string[]
  sampleRows: readonly {
    date: string
    description: string
    amount: string
    direction?: string | undefined
    runningBalance?: string | undefined
  }[]
  rawRows?: readonly {
    date: string
    description: string
    amount: string
    direction?: string | undefined
    runningBalance?: string | undefined
  }[] | undefined
}> {
  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return {
      success: false,
      rowsCount: 0,
      detectedBalance: null,
      detectedDate: null,
      errors: ["File CSV belum dipilih."],
      sampleRows: [],
    }
  }

  const text = await file.text()
  const res = parseStatementCsv(text)

  return {
    success: res.success,
    rowsCount: res.rows.length,
    detectedBalance: res.detectedBalance !== undefined ? res.detectedBalance.toString() : null,
    detectedDate: res.detectedDate ? res.detectedDate.toISOString() : null,
    errors: res.errors,
    sampleRows: res.rows.slice(-5).map((r) => ({
      date: r.date.toLocaleDateString("id-ID"),
      description: r.description,
      amount: r.amount.toString(),
      direction: r.direction,
      runningBalance: r.runningBalance !== undefined ? r.runningBalance.toString() : undefined,
    })),
    rawRows: res.rows.map((r) => ({
      date: r.date.toISOString(),
      description: r.description,
      amount: r.amount.toString(),
      direction: r.direction,
      runningBalance: r.runningBalance !== undefined ? r.runningBalance.toString() : undefined,
    })),
  }
}

export async function confirmImportBalanceAction(formData: FormData): Promise<void> {
  try {
    const accountId = formData.get("accountId")
    const balance = formData.get("balance")
    const note = formData.get("note")
    const snapshotAtRaw = formData.get("snapshotAt")

    if (typeof accountId !== "string" || typeof balance !== "string") {
      throw new Error(failureMessage)
    }

    await recordBalanceSnapshot({
      accountId,
      balance,
      source: "IMPORT",
      note: typeof note === "string" && note.trim().length > 0 ? note.trim() : "Import CSV mutasi rekening",
      snapshotAt: typeof snapshotAtRaw === "string" && snapshotAtRaw ? new Date(snapshotAtRaw) : undefined,
    })

    const rawRowsJson = formData.get("rawRows")
    if (typeof rawRowsJson === "string" && rawRowsJson) {
      try {
        const parsedRows = JSON.parse(rawRowsJson) as {
          date: string
          description: string
          amount: string
          direction?: "IN" | "OUT"
          runningBalance?: string
        }[]
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          await storeImportedExternalTransactions({
            accountId,
            rows: parsedRows.map((r) => ({
              date: new Date(r.date),
              description: r.description,
              amount: BigInt(r.amount),
              direction: r.direction,
              runningBalance: r.runningBalance ? BigInt(r.runningBalance) : undefined,
            })),
          })
        }
      } catch {
        void 0
      }
    }

    revalidatePath("/accounts")
    revalidatePath("/")
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(failureMessage)
    }
    throw error
  }
}
