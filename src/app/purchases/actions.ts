"use server"

import { safeRevalidatePath } from "@/lib/revalidate"
import { ZodError } from "zod"
import {
  createSupplierPurchase,
  cancelSupplierPurchase,
  PurchasePayableHasPaymentsError,
  SupplierNotFoundError,
} from "@/features/suppliers/supplier-purchase-service"
import {
  InsufficientStockError,
  PurchaseAlreadyConsumedError,
  MovementAlreadyReversedError,
  BackdatedInventoryMovementRejectedError,
} from "@/features/inventory/inventory-service"
import {
  AccountNotFoundError,
  InactiveAccountError,
} from "@/features/accounts/account-ledger"

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

export type PurchaseItemInput = {
  readonly productId: string
  readonly quantity: number
  readonly unitCost: string
}

export type CreatePurchaseInput = {
  readonly supplierId: string
  readonly isCredit: boolean
  readonly accountId?: string | undefined
  readonly dueDate?: string | undefined
  readonly notes?: string | undefined
  readonly items: readonly PurchaseItemInput[]
}

export async function createPurchaseAction(
  input: CreatePurchaseInput,
): Promise<ActionResult<{ id: string; purchaseNumber: string }>> {
  try {
    const purchase = await createSupplierPurchase({
      supplierId: input.supplierId,
      isCredit: input.isCredit,
      accountId: input.accountId,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      notes: input.notes,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
    })

    safeRevalidatePath("/purchases")
    safeRevalidatePath("/suppliers")
    safeRevalidatePath("/inventory")
    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/reports")

    return {
      success: true,
      data: { id: purchase.id, purchaseNumber: purchase.purchaseNumber },
    }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data pembelian tidak valid." }
    }
    if (
      error instanceof SupplierNotFoundError ||
      error instanceof AccountNotFoundError ||
      error instanceof InactiveAccountError ||
      error instanceof BackdatedInventoryMovementRejectedError
    ) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal memproses pembelian supplier." }
  }
}

export async function cancelPurchaseAction(
  purchaseId: string,
  reason?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const purchase = await cancelSupplierPurchase({
      purchaseId,
      reason,
    })

    safeRevalidatePath("/purchases")
    safeRevalidatePath(`/purchases/${purchaseId}`)
    safeRevalidatePath("/suppliers")
    safeRevalidatePath("/inventory")
    safeRevalidatePath("/debts-receivables")
    safeRevalidatePath("/reports")

    return { success: true, data: { id: purchase.id } }
  } catch (error: unknown) {
    if (
      error instanceof PurchasePayableHasPaymentsError ||
      error instanceof PurchaseAlreadyConsumedError ||
      error instanceof MovementAlreadyReversedError ||
      error instanceof InsufficientStockError ||
      error instanceof BackdatedInventoryMovementRejectedError
    ) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal membatalkan pembelian supplier." }
  }
}
