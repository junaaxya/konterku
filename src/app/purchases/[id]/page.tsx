import { notFound } from "next/navigation"
import { getPurchaseById } from "@/features/suppliers/supplier-purchase-service"
import { PurchaseDetailView } from "./purchase-detail-view"

export const dynamic = "force-dynamic"

type PageProps = {
  readonly params: Promise<{ id: string }>
}

export default async function PurchaseDetailPage({ params }: PageProps) {
  const { id } = await params

  let purchase
  try {
    purchase = await getPurchaseById(id)
  } catch {
    notFound()
  }

  if (!purchase) {
    notFound()
  }

  const serialized = {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    supplierId: purchase.supplierId,
    supplierName: purchase.supplier.name,
    supplierPhone: purchase.supplier.phone,
    totalAmount: purchase.totalAmount.toString(),
    isCredit: purchase.isCredit,
    status: purchase.status,
    occurredAt: purchase.occurredAt.toISOString(),
    createdAt: purchase.createdAt.toISOString(),
    payable: purchase.payable
      ? {
          id: purchase.payable.id,
          payableNumber: purchase.payable.payableNumber,
          totalAmount: purchase.payable.totalAmount.toString(),
          paidAmount: purchase.payable.paidAmount.toString(),
          remainingAmount: purchase.payable.remainingAmount.toString(),
          status: purchase.payable.status,
          dueDate: purchase.payable.dueDate ? purchase.payable.dueDate.toISOString() : null,
          payments: purchase.payable.payments.map((pm) => ({
            id: pm.id,
            amount: pm.amount.toString(),
            paymentDate: pm.paymentDate.toISOString(),
            accountName: pm.account.name,
            notes: pm.notes,
          })),
        }
      : null,
    movements: purchase.movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product.name,
      productSku: m.product.sku,
      productUnit: m.product.unit,
      quantity: m.quantityChange,
      unitCost: m.unitCost.toString(),
      totalCost: m.totalCost.toString(),
    })),
  }

  return (
    <main className="container">
      <PurchaseDetailView purchase={serialized} />
    </main>
  )
}
