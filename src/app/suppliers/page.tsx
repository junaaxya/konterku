import { listSuppliers } from "@/features/suppliers/supplier-purchase-service"
import { SuppliersView } from "./suppliers-view"

export const dynamic = "force-dynamic"

export default async function SuppliersPage() {
  const suppliers = await listSuppliers()

  const serializedSuppliers = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))

  return (
    <main className="container">
      <SuppliersView suppliers={serializedSuppliers} />
    </main>
  )
}
