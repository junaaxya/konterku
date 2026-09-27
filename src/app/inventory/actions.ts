"use server"

import { safeRevalidatePath } from "@/lib/revalidate"
import { ZodError } from "zod"
import {
  createProduct,
  updateProduct,
  setProductActive,
  recordAdjustment,
  ProductNotFoundError,
  InsufficientStockError,
  BackdatedInventoryMovementRejectedError,
} from "@/features/inventory/inventory-service"

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function createProductAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const rawSku = formData.get("sku")?.toString().trim()
    const name = formData.get("name")?.toString().trim() || ""
    const unit = formData.get("unit")?.toString().trim() || "pcs"
    const sellingPrice = formData.get("sellingPrice")?.toString().trim() || "0"
    const initialStock = parseInt(formData.get("initialStock")?.toString() || "0", 10)
    const initialCost = formData.get("initialCost")?.toString().trim() || "0"

    const product = await createProduct({
      sku: rawSku || undefined,
      name,
      unit,
      sellingPrice,
      initialStock: Number.isNaN(initialStock) ? 0 : initialStock,
      initialCost,
    })

    safeRevalidatePath("/inventory")
    safeRevalidatePath("/transactions/new")
    safeRevalidatePath("/reports")

    return { success: true, data: { id: product.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data produk tidak valid." }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal membuat produk." }
  }
}

export async function updateProductAction(
  productId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const rawSku = formData.get("sku")?.toString().trim()
    const name = formData.get("name")?.toString().trim() || ""
    const unit = formData.get("unit")?.toString().trim() || "pcs"
    const sellingPrice = formData.get("sellingPrice")?.toString().trim() || "0"

    const product = await updateProduct(productId, {
      sku: rawSku || null,
      name,
      unit,
      sellingPrice,
    })

    safeRevalidatePath("/inventory")
    safeRevalidatePath(`/inventory/${productId}`)
    safeRevalidatePath("/transactions/new")

    return { success: true, data: { id: product.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data produk tidak valid." }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal memperbarui produk." }
  }
}

export async function toggleProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    const product = await setProductActive(productId, isActive)

    safeRevalidatePath("/inventory")
    safeRevalidatePath(`/inventory/${productId}`)
    safeRevalidatePath("/transactions/new")

    return { success: true, data: { id: product.id, isActive: product.isActive } }
  } catch (error: unknown) {
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal mengubah status produk." }
  }
}

export async function recordAdjustmentAction(
  productId: string,
  formData: FormData,
): Promise<ActionResult<{ movementId: string }>> {
  try {
    const direction = formData.get("direction")?.toString()
    const rawQty = parseInt(formData.get("quantity")?.toString() || "0", 10)
    const unitCost = formData.get("unitCost")?.toString().trim()
    const notes = formData.get("notes")?.toString().trim()

    if (Number.isNaN(rawQty) || rawQty <= 0) {
      return { success: false, error: "Jumlah penyesuaian harus angka bulat lebih besar dari 0." }
    }

    const quantityChange = direction === "DECREASE" ? -rawQty : rawQty

    const movement = await recordAdjustment({
      productId,
      quantityChange,
      unitCost: unitCost && unitCost.length > 0 ? BigInt(unitCost) : undefined,
      notes: notes || undefined,
    })

    safeRevalidatePath("/inventory")
    safeRevalidatePath(`/inventory/${productId}`)
    safeRevalidatePath("/reports")

    return { success: true, data: { movementId: movement.id } }
  } catch (error: unknown) {
    if (
      error instanceof InsufficientStockError ||
      error instanceof BackdatedInventoryMovementRejectedError ||
      error instanceof ProductNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal mencatat penyesuaian stok." }
  }
}
