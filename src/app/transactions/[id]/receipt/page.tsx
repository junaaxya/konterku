import { notFound } from "next/navigation"

import {
  getTransactionById,
  TransactionNotFoundError,
} from "@/features/transactions/transaction-service"
import { buildReceiptData } from "@/features/receipts/receipt-domain"
import { ThermalReceiptView } from "@/features/receipts/thermal-receipt-view"
import { ReceiptPrintActions } from "./print-actions"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ id: string }>
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params
  let transaction

  try {
    transaction = await getTransactionById({ transactionId: id })
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      notFound()
    }
    throw error
  }

  const receipt = buildReceiptData(transaction)

  return (
    <main className="container" style={{ paddingTop: "1rem" }}>
      <ReceiptPrintActions transactionId={transaction.id} receipt={receipt} />
      <ThermalReceiptView receipt={receipt} />
    </main>
  )
}
