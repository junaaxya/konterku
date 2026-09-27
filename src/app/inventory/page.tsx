import { listProducts } from "@/features/inventory/inventory-service"
import { InventoryView } from "./inventory-view"

export const dynamic = "force-dynamic"

export default async function InventoryPage() {
  const products = await listProducts(false)

  const serializedProducts = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    stockQuantity: p.stockQuantity,
    inventoryValue: p.inventoryValue.toString(),
    averageCost: p.averageCost.toString(),
    sellingPrice: p.sellingPrice.toString(),
    isActive: p.isActive,
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <main className="container">
      <InventoryView products={serializedProducts} />
    </main>
  )
}
