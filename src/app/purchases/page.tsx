import { listPurchases } from "@/features/suppliers/supplier-purchase-service"
import { PurchasesView } from "./purchases-view"

export const dynamic = "force-dynamic"

export default async function PurchasesPage() {
  const purchases = await listPurchases()

  const serialized = purchases.map((p) => ({
    id: p.id,
    purchaseNumber: p.purchaseNumber,
    supplierId: p.supplierId,
    supplierName: p.supplier.name,
    totalAmount: p.totalAmount.toString(),
    isCredit: p.isCredit,
    status: p.status,
    occurredAt: p.occurredAt.toISOString(),
    payable: p.payable
      ? {
          id: p.payable.id,
          status: p.payable.status,
          remainingAmount: p.payable.remainingAmount.toString(),
          dueDate: p.payable.dueDate ? p.payable.dueDate.toISOString() : null,
        }
      : null,
    itemCount: p.movements.length,
  }))

  return (
    <main className="container">
      <PurchasesView purchases={serialized} />
    </main>
  )
}
