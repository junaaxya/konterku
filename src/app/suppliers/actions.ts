"use server"

import { safeRevalidatePath } from "@/lib/revalidate"
import { ZodError } from "zod"
import {
  createSupplier,
  updateSupplier,
  SupplierNotFoundError,
} from "@/features/suppliers/supplier-purchase-service"

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function createSupplierAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const name = formData.get("name")?.toString().trim() || ""
    const phone = formData.get("phone")?.toString().trim()
    const notes = formData.get("notes")?.toString().trim()

    const supplier = await createSupplier({
      name,
      phone: phone || undefined,
      notes: notes || undefined,
    })

    safeRevalidatePath("/suppliers")
    safeRevalidatePath("/purchases/new")

    return { success: true, data: { id: supplier.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data supplier tidak valid." }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal membuat supplier." }
  }
}

export async function updateSupplierAction(
  supplierId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const name = formData.get("name")?.toString().trim() || ""
    const phone = formData.get("phone")?.toString().trim()
    const notes = formData.get("notes")?.toString().trim()

    const supplier = await updateSupplier(supplierId, {
      name,
      phone: phone || null,
      notes: notes || null,
    })

    safeRevalidatePath("/suppliers")
    safeRevalidatePath(`/suppliers/${supplierId}`)

    return { success: true, data: { id: supplier.id } }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Data supplier tidak valid." }
    }
    if (error instanceof SupplierNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Gagal memperbarui supplier." }
  }
}
