import { notFound } from "next/navigation"
import { getSupplierWithHistory } from "@/features/suppliers/supplier-purchase-service"
import { SupplierDetailView } from "./supplier-detail-view"

export const dynamic = "force-dynamic"

type PageProps = {
  readonly params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params

  let supplier
  try {
    supplier = await getSupplierWithHistory(id)
  } catch {
    notFound()
  }

  if (!supplier) {
    notFound()
  }

  const serialized = {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    notes: supplier.notes,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    purchases: supplier.purchases.map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      totalAmount: p.totalAmount.toString(),
      isCredit: p.isCredit,
      status: p.status,
      occurredAt: p.occurredAt.toISOString(),
      itemCount: p.movements.length,
    })),
    payables: supplier.payables.map((py) => ({
      id: py.id,
      payableNumber: py.payableNumber,
      totalAmount: py.totalAmount.toString(),
      paidAmount: py.paidAmount.toString(),
      remainingAmount: py.remainingAmount.toString(),
      status: py.status,
      dueDate: py.dueDate ? py.dueDate.toISOString() : null,
    })),
  }

  return (
    <main className="container">
      <SupplierDetailView supplier={serialized} />
    </main>
  )
}
