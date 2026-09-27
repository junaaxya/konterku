"use server"

import { safeRevalidatePath } from "@/lib/revalidate"
import { ZodError } from "zod"
import {
  createCustomer,
  payReceivable,
  payCustomerRefund,
  ReceivableNotFoundError,
  CustomerRefundLiabilityNotFoundError,
} from "@/features/receivables/receivable-service"
import {
  paySupplierPayable,
  PayableNotFoundError,
} from "@/features/suppliers/supplier-purchase-service"
import {
  AccountNotFoundError,
  InactiveAccountError,
} from "@/features/accounts/account-ledger"

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function createCustomerAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const name = formData.get("name")?.toString().trim() || ""
    const phone = formData.get("phone")?.toString().trim()
    const notes = formData.get("notes")?.toString().trim()

    const customer = await createCustomer({
      name,
      phone: phone || undefined,
      notes: notes || undefined,
    })

    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/transactions/new")

    return { success: true, data: { id: customer.id, name: customer.name } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data pelanggan tidak valid." }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal mendaftarkan pelanggan." }
  }
}

export async function payReceivableAction(
  formData: FormData,
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const receivableId = formData.get("receivableId")?.toString() || ""
    const amount = formData.get("amount")?.toString().trim() || "0"
    const accountId = formData.get("accountId")?.toString() || ""
    const notes = formData.get("notes")?.toString().trim()

    const res = await payReceivable({
      receivableId,
      amount,
      accountId,
      notes: notes || undefined,
    })

    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/accounts")
    safeRevalidatePath("/reports")

    return { success: true, data: { paymentId: res.payment.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data pembayaran tidak valid." }
    }
    if (
      error instanceof ReceivableNotFoundError ||
      error instanceof AccountNotFoundError ||
      error instanceof InactiveAccountError
    ) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal mencatat pembayaran piutang." }
  }
}

export async function payPayableAction(
  formData: FormData,
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const payableId = formData.get("payableId")?.toString() || ""
    const amount = formData.get("amount")?.toString().trim() || "0"
    const accountId = formData.get("accountId")?.toString() || ""
    const notes = formData.get("notes")?.toString().trim()

    const res = await paySupplierPayable({
      payableId,
      amount,
      accountId,
      notes: notes || undefined,
    })

    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/suppliers")
    safeRevalidatePath("/purchases")
    safeRevalidatePath("/accounts")
    safeRevalidatePath("/reports")

    return { success: true, data: { paymentId: res.payment.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data pembayaran tidak valid." }
    }
    if (
      error instanceof PayableNotFoundError ||
      error instanceof AccountNotFoundError ||
      error instanceof InactiveAccountError
    ) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal mencatat pembayaran hutang supplier." }
  }
}

export async function payRefundLiabilityAction(
  formData: FormData,
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const refundLiabilityId =
      formData.get("refundLiabilityId")?.toString() ||
      formData.get("liabilityId")?.toString() ||
      ""
    const amount = formData.get("amount")?.toString().trim() || "0"
    const accountId = formData.get("accountId")?.toString() || ""
    const notes = formData.get("notes")?.toString().trim()

    const res = await payCustomerRefund({
      refundLiabilityId,
      amount,
      accountId,
      notes: notes || undefined,
    })

    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/accounts")
    safeRevalidatePath("/reports")

    return { success: true, data: { paymentId: res.payment.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data refund tidak valid." }
    }
    if (
      error instanceof CustomerRefundLiabilityNotFoundError ||
      error instanceof AccountNotFoundError ||
      error instanceof InactiveAccountError
    ) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal memproses refund pelanggan." }
  }
}
