import { listReceivables, listCustomerRefundLiabilities, listCustomers } from "@/features/receivables/receivable-service"
import { listPayables } from "@/features/suppliers/supplier-purchase-service"
import { listAccounts } from "@/features/accounts/account-ledger"
import { DebtsReceivablesView } from "./debts-receivables-view"

export const dynamic = "force-dynamic"

export default async function DebtsReceivablesPage() {
  const [receivables, payables, refunds, accounts, customers] = await Promise.all([
    listReceivables(),
    listPayables(),
    listCustomerRefundLiabilities(),
    listAccounts({ activeOnly: true }),
    listCustomers(),
  ])

  const serializedReceivables = receivables.map((r) => ({
    id: r.id,
    receivableNumber: r.receivableNumber,
    customerId: r.customerId,
    customerName: r.customer.name,
    customerPhone: r.customer.phone,
    transactionId: r.transactionId,
    transactionNumber: r.transaction.transactionNumber,
    totalAmount: r.totalAmount.toString(),
    paidAmount: r.paidAmount.toString(),
    remainingAmount: r.remainingAmount.toString(),
    status: r.status,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      paymentDate: p.paymentDate.toISOString(),
      accountName: p.account.name,
      notes: p.notes,
    })),
  }))

  const serializedPayables = payables.map((py) => ({
    id: py.id,
    payableNumber: py.payableNumber,
    supplierId: py.supplierId,
    supplierName: py.supplier.name,
    supplierPurchaseId: py.supplierPurchaseId,
    purchaseNumber: py.supplierPurchase?.purchaseNumber ?? null,
    totalAmount: py.totalAmount.toString(),
    paidAmount: py.paidAmount.toString(),
    remainingAmount: py.remainingAmount.toString(),
    status: py.status,
    dueDate: py.dueDate ? py.dueDate.toISOString() : null,
    createdAt: py.createdAt.toISOString(),
    payments: py.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      paymentDate: p.paymentDate.toISOString(),
      accountName: p.account.name,
      notes: p.notes,
    })),
  }))

  const serializedRefunds = refunds.map((rf) => ({
    id: rf.id,
    liabilityNumber: rf.liabilityNumber,
    customerId: rf.customerId,
    customerName: rf.customer.name,
    receivableId: rf.receivableId,
    totalAmount: rf.totalAmount.toString(),
    refundedAmount: rf.refundedAmount.toString(),
    remainingAmount: rf.remainingAmount.toString(),
    status: rf.status,
    reason: rf.reason,
    createdAt: rf.createdAt.toISOString(),
    refundPayments: rf.refundPayments.map((rp) => ({
      id: rp.id,
      amount: rp.amount.toString(),
      paymentDate: rp.paymentDate.toISOString(),
      accountName: rp.account.name,
      notes: rp.notes,
    })),
  }))

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
  }))

  const serializedCustomers = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
  }))

  return (
    <main className="container">
      <DebtsReceivablesView
        receivables={serializedReceivables}
        payables={serializedPayables}
        refunds={serializedRefunds}
        accounts={serializedAccounts}
        customers={serializedCustomers}
      />
    </main>
  )
}
