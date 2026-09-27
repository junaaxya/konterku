import { getDatabase } from "../../lib/db"
import { getFinancialReport } from "./report-service"
import {
  ReceivableStatus,
  PayableStatus,
  RefundLiabilityStatus,
} from "../../generated/prisma/client"

export type AssetLiabilitySummary = {
  readonly totalCashBalance: bigint
  readonly outstandingReceivables: bigint
  readonly inventoryValuation: bigint
  readonly totalAssets: bigint
  readonly supplierPayables: bigint
  readonly customerRefundLiabilities: bigint
  readonly totalLiabilities: bigint
  readonly netAssets: bigint
}

export async function getAssetLiabilitySummary(): Promise<AssetLiabilitySummary> {
  const database = getDatabase()

  // 1. Reuse existing canonical report cash balance aggregation (CASH, BANK, EWALLET, QRIS, OTHER)
  const report = await getFinancialReport({ period: "TODAY" })
  const totalCashBalance = report.totalCashBalance

  // 2. Outstanding receivables (OPEN or PARTIAL)
  const openReceivables = await database.receivable.findMany({
    where: {
      status: { in: [ReceivableStatus.OPEN, ReceivableStatus.PARTIAL] },
    },
    select: { remainingAmount: true },
  })
  const outstandingReceivables = openReceivables.reduce(
    (acc, curr) => acc + curr.remainingAmount,
    0n,
  )

  // 3. Inventory valuation: sum inventoryValue of all products with stockQuantity > 0 (regardless of isActive)
  const inStockProducts = await database.product.findMany({
    where: {
      stockQuantity: { gt: 0 },
    },
    select: { inventoryValue: true },
  })
  const inventoryValuation = inStockProducts.reduce(
    (acc, curr) => acc + curr.inventoryValue,
    0n,
  )

  // 4. Total assets
  const totalAssets = totalCashBalance + outstandingReceivables + inventoryValuation

  // 5. Supplier payables (OPEN or PARTIAL)
  const openPayables = await database.payable.findMany({
    where: {
      status: { in: [PayableStatus.OPEN, PayableStatus.PARTIAL] },
    },
    select: { remainingAmount: true },
  })
  const supplierPayables = openPayables.reduce(
    (acc, curr) => acc + curr.remainingAmount,
    0n,
  )

  // 6. Customer refund liabilities (OPEN or PARTIAL)
  const openRefundLiabilities = await database.customerRefundLiability.findMany({
    where: {
      status: { in: [RefundLiabilityStatus.OPEN, RefundLiabilityStatus.PARTIAL] },
    },
    select: { remainingAmount: true },
  })
  const customerRefundLiabilities = openRefundLiabilities.reduce(
    (acc, curr) => acc + curr.remainingAmount,
    0n,
  )

  // 7. Total liabilities
  const totalLiabilities = supplierPayables + customerRefundLiabilities

  // 8. Net assets
  const netAssets = totalAssets - totalLiabilities

  return {
    totalCashBalance,
    outstandingReceivables,
    inventoryValuation,
    totalAssets,
    supplierPayables,
    customerRefundLiabilities,
    totalLiabilities,
    netAssets,
  }
}
