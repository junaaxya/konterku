import { listSuppliers } from "@/features/suppliers/supplier-purchase-service"
import { listProducts } from "@/features/inventory/inventory-service"
import { listAccounts } from "@/features/accounts/account-ledger"
import { CreatePurchaseView } from "./create-purchase-view"

export const dynamic = "force-dynamic"

type PageProps = {
  readonly searchParams: Promise<{ supplierId?: string }>
}

export default async function NewPurchasePage({ searchParams }: PageProps) {
  const { supplierId } = await searchParams

  const [suppliers, products, accounts] = await Promise.all([
    listSuppliers(),
    listProducts(true),
    listAccounts({ activeOnly: true }),
  ])

  const serializedSuppliers = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
  }))

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    stockQuantity: p.stockQuantity,
    averageCost: p.averageCost.toString(),
  }))

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
  }))

  return (
    <main className="container">
      <CreatePurchaseView
        suppliers={serializedSuppliers}
        products={serializedProducts}
        accounts={serializedAccounts}
        initialSupplierId={supplierId}
      />
    </main>
  )
}
