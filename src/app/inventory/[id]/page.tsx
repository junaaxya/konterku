import { notFound } from "next/navigation"
import { getProductWithMovements } from "@/features/inventory/inventory-service"
import { ProductDetailView } from "./product-detail-view"

export const dynamic = "force-dynamic"

type PageProps = {
  readonly params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params

  let product
  try {
    product = await getProductWithMovements(id)
  } catch {
    notFound()
  }

  if (!product) {
    notFound()
  }

  const serializedProduct = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    stockQuantity: product.stockQuantity,
    inventoryValue: product.inventoryValue.toString(),
    averageCost: product.averageCost.toString(),
    sellingPrice: product.sellingPrice.toString(),
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    movements: product.movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantityChange: m.quantityChange,
      unitCost: m.unitCost.toString(),
      totalCost: m.totalCost.toString(),
      occurredAt: m.occurredAt.toISOString(),
      notes: m.notes,
      transactionId: m.transactionId,
      supplierPurchaseNumber: m.supplierPurchase?.purchaseNumber ?? null,
    })),
  }

  return (
    <main className="container">
      <ProductDetailView product={serializedProduct} />
    </main>
  )
}
