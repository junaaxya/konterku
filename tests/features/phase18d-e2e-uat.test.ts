import { afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  createProduct,
  getProductById,
  recordAdjustment,
  rebuildProductInventory,
  recordStockOut,
  recordStockIn,
  InsufficientStockError,
  BackdatedInventoryMovementRejectedError,
} from "../../src/features/inventory/inventory-service"
import {
  createSupplier,
  createSupplierPurchase,
  cancelSupplierPurchase,
  paySupplierPayable,
  getPayableById,
  PurchasePayableHasPaymentsError,
} from "../../src/features/suppliers/supplier-purchase-service"
import {
  createCustomer,
  payReceivable,
  getReceivableById,
  payCustomerRefund,
} from "../../src/features/receivables/receivable-service"
import {
  createProductTransaction,
} from "../../src/features/transactions/counter-transaction-service"
import {
  cancelTransaction,
  getTransactionById,
} from "../../src/features/transactions/transaction-service"
import { getAssetLiabilitySummary } from "../../src/features/reports/asset-liability-service"
import { getFinancialReport } from "../../src/features/reports/report-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 18D: End-to-End UAT & Accounting Reconciliation", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 18D: End-to-End UAT & Accounting Reconciliation", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdProductIds = new Set<string>()
    const createdSupplierIds = new Set<string>()
    const createdCustomerIds = new Set<string>()
    const createdTransactionIds = new Set<string>()
    const createdPurchaseIds = new Set<string>()

    afterEach(async () => {
      const txIds = [...createdTransactionIds]
      const purIds = [...createdPurchaseIds]
      const accIds = [...createdAccountIds]
      const prodIds = [...createdProductIds]
      const suppIds = [...createdSupplierIds]
      const custIds = [...createdCustomerIds]

      if (txIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { transactionId: { in: txIds } } })
        await database.receivablePayment.deleteMany({ where: { receivable: { transactionId: { in: txIds } } } })
        await database.customerRefundPayment.deleteMany({ where: { refundLiability: { receivable: { transactionId: { in: txIds } } } } })
        await database.customerRefundLiability.deleteMany({ where: { receivable: { transactionId: { in: txIds } } } })
        await database.receivable.deleteMany({ where: { transactionId: { in: txIds } } })
        await database.inventoryMovement.deleteMany({ where: { transactionId: { in: txIds } } })
        await database.transaction.deleteMany({ where: { id: { in: txIds } } })
        createdTransactionIds.clear()
      }

      if (purIds.length > 0) {
        await database.ledgerEntry.deleteMany({
          where: { description: { contains: "Pembelian" } },
        })
        await database.payablePayment.deleteMany({ where: { payable: { supplierPurchaseId: { in: purIds } } } })
        await database.payable.deleteMany({ where: { supplierPurchaseId: { in: purIds } } })
        await database.inventoryMovement.deleteMany({ where: { supplierPurchaseId: { in: purIds } } })
        await database.supplierPurchase.deleteMany({ where: { id: { in: purIds } } })
        createdPurchaseIds.clear()
      }

      if (prodIds.length > 0) {
        await database.inventoryMovement.deleteMany({ where: { productId: { in: prodIds } } })
        await database.product.deleteMany({ where: { id: { in: prodIds } } })
        createdProductIds.clear()
      }

      if (suppIds.length > 0) {
        await database.supplier.deleteMany({ where: { id: { in: suppIds } } })
        createdSupplierIds.clear()
      }

      if (custIds.length > 0) {
        await database.customer.deleteMany({ where: { id: { in: custIds } } })
        createdCustomerIds.clear()
      }

      if (accIds.length > 0) {
        await database.ledgerEntry.deleteMany({ where: { accountId: { in: accIds } } })
        await database.account.deleteMany({ where: { id: { in: accIds } } })
        createdAccountIds.clear()
      }
    })

    it("UAT 1: Inventory lifecycle (create, stock in, positive & negative adjustments, guard negative)", async () => {
      const product = await createProduct({
        name: "Kabel Data",
        sku: "KD-UAT-01",
        unit: "pcs",
        sellingPrice: "25000",
        initialStock: 10,
        initialCost: "15000",
      })
      createdProductIds.add(product.id)

      expect(product.stockQuantity).toBe(10)
      expect(product.inventoryValue).toBe(150000n)
      expect(product.averageCost).toBe(15000n)

      const initialMovements = await database.inventoryMovement.findMany({
        where: { productId: product.id },
      })
      expect(initialMovements).toHaveLength(1)
      expect(initialMovements[0]!.type).toBe("STOCK_IN")
      expect(initialMovements[0]!.quantityChange).toBe(10)

      const rebuiltInitial = await rebuildProductInventory(product.id)
      expect(rebuiltInitial.stockQuantity).toBe(10)
      expect(rebuiltInitial.inventoryValue).toBe(150000n)
      expect(rebuiltInitial.averageCost).toBe(15000n)

      await recordAdjustment({
        productId: product.id,
        quantityChange: 2,
        unitCost: 15000n,
        notes: "+2 pcs restok",
      })

      let currentProduct = await getProductById(product.id)
      expect(currentProduct.stockQuantity).toBe(12)
      expect(currentProduct.inventoryValue).toBe(180000n)
      expect(currentProduct.averageCost).toBe(15000n)

      await recordAdjustment({
        productId: product.id,
        quantityChange: -1,
        notes: "-1 pcs sampel",
      })

      currentProduct = await getProductById(product.id)
      expect(currentProduct.stockQuantity).toBe(11)
      expect(currentProduct.inventoryValue).toBe(165000n)
      expect(currentProduct.averageCost).toBe(15000n)

      await expect(
        recordAdjustment({
          productId: product.id,
          quantityChange: -50,
          notes: "Kelebihan pengurangan",
        }),
      ).rejects.toThrow(InsufficientStockError)
    })

    it("UAT 2: Cash product sale reconciliation (cash IN, stock OUT, cost/profit, Total Asset change = profit)", async () => {
      const cash = await createAccount({
        name: "Kas UAT Cash Sale",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      const product = await createProduct({
        name: "Kabel Data Cash",
        sellingPrice: "25000",
        initialStock: 10,
        initialCost: "15000",
      })
      createdProductIds.add(product.id)

      const preSummary = await getAssetLiabilitySummary()

      const tx = await createProductTransaction({
        category: "PRODUCT_SALE",
        productId: product.id,
        quantity: 1,
        sellingPrice: "25000",
        customerAccountId: cash.id,
        description: "Beli kabel data tunai",
      })
      createdTransactionIds.add(tx.id)

      expect(tx.status).toBe("COMPLETED")
      expect(tx.costAmount).toBe(15000n)
      expect(tx.profitAmount).toBe(10000n)
      expect(tx.receivable).toBeFalsy()

      const postCash = await getAccountBalance({ accountId: cash.id })
      expect(postCash).toBe(125000n)

      const postProduct = await getProductById(product.id)
      expect(postProduct.stockQuantity).toBe(9)
      expect(postProduct.inventoryValue).toBe(135000n)

      const postSummary = await getAssetLiabilitySummary()

      const cashDiff = postSummary.totalCashBalance - preSummary.totalCashBalance
      const invDiff = postSummary.inventoryValuation - preSummary.inventoryValuation
      const assetDiff = postSummary.totalAssets - preSummary.totalAssets

      expect(cashDiff).toBe(25000n)
      expect(invDiff).toBe(-15000n)
      expect(assetDiff).toBe(10000n)
      expect(assetDiff).toBe(tx.profitAmount)
    })

    it("UAT 3: Credit product sale lifecycle (receivable created, partial cash, full bank, no duplicate profit)", async () => {
      const cash = await createAccount({
        name: "Kas Toko Kredit",
        type: "CASH",
        openingBalance: "100000",
      })
      const bca = await createAccount({
        name: "BCA Toko Kredit",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(cash.id)
      createdAccountIds.add(bca.id)

      const customer = await createCustomer({
        name: "Budi",
        phone: "0812345678",
      })
      createdCustomerIds.add(customer.id)

      const product = await createProduct({
        name: "Kabel Data Kredit",
        sellingPrice: "25000",
        initialStock: 10,
        initialCost: "15000",
      })
      createdProductIds.add(product.id)

      const preSummary = await getAssetLiabilitySummary()

      const tx = await createProductTransaction({
        category: "PRODUCT_SALE",
        productId: product.id,
        quantity: 1,
        sellingPrice: "25000",
        isCredit: true,
        customerId: customer.id,
        dueDate: new Date("2026-10-01"),
        description: "Beli kabel data tempo Budi",
      })
      createdTransactionIds.add(tx.id)

      expect(tx.receivable).toBeDefined()
      expect(tx.profitAmount).toBe(10000n)

      const cashUnchanged = await getAccountBalance({ accountId: cash.id })
      expect(cashUnchanged).toBe(100000n)

      const productAfterSale = await getProductById(product.id)
      expect(productAfterSale.stockQuantity).toBe(9)
      expect(productAfterSale.inventoryValue).toBe(135000n)

      const midSummary = await getAssetLiabilitySummary()
      expect(midSummary.totalCashBalance - preSummary.totalCashBalance).toBe(0n)
      expect(midSummary.outstandingReceivables - preSummary.outstandingReceivables).toBe(25000n)
      expect(midSummary.inventoryValuation - preSummary.inventoryValuation).toBe(-15000n)
      expect(midSummary.totalAssets - preSummary.totalAssets).toBe(10000n)

      const txCountBeforePay = await database.transaction.count()

      await payReceivable({
        receivableId: tx.receivable!.id,
        amount: "10000",
        accountId: cash.id,
        notes: "Cicilan pertama tunai",
      })

      const cashAfterPart = await getAccountBalance({ accountId: cash.id })
      expect(cashAfterPart).toBe(110000n)

      const recPart = await getReceivableById(tx.receivable!.id)
      expect(recPart.paidAmount).toBe(10000n)
      expect(recPart.remainingAmount).toBe(15000n)
      expect(recPart.status).toBe("PARTIAL")

      const txCountAfterPart = await database.transaction.count()
      expect(txCountAfterPart).toBe(txCountBeforePay)

      const summaryAfterPart = await getAssetLiabilitySummary()
      expect(summaryAfterPart.totalAssets).toBe(midSummary.totalAssets)

      await payReceivable({
        receivableId: tx.receivable!.id,
        amount: "15000",
        accountId: bca.id,
        notes: "Pelunasan via transfer BCA",
      })

      const bcaAfterFull = await getAccountBalance({ accountId: bca.id })
      expect(bcaAfterFull).toBe(515000n)

      const recFull = await getReceivableById(tx.receivable!.id)
      expect(recFull.paidAmount).toBe(25000n)
      expect(recFull.remainingAmount).toBe(0n)
      expect(recFull.status).toBe("PAID")

      const txCountAfterFull = await database.transaction.count()
      expect(txCountAfterFull).toBe(txCountBeforePay)
    })

    it("UAT 4: Credit cancellation + refund liability (partial payment preserved, liability created, explicit refund moves cash)", async () => {
      const cash = await createAccount({
        name: "Kas Refund UAT",
        type: "CASH",
        openingBalance: "300000",
      })
      const providerWallet = await createAccount({
        name: "Saldo Digipos Provider",
        type: "EWALLET",
        openingBalance: "500000",
      })
      createdAccountIds.add(cash.id)
      createdAccountIds.add(providerWallet.id)

      const customer = await createCustomer({ name: "Pelanggan Refund" })
      createdCustomerIds.add(customer.id)

      const preSummary = await getAssetLiabilitySummary()

      const tx = await createProductTransaction({
        category: "PLN_TOKEN",
        sellingPrice: "52000",
        costAccountId: providerWallet.id,
        costAmount: "50000",
        isCredit: true,
        customerId: customer.id,
        description: "Token PLN Tempo",
      })
      createdTransactionIds.add(tx.id)

      const providerWalletAfterTx = await getAccountBalance({ accountId: providerWallet.id })
      expect(providerWalletAfterTx).toBe(450000n)

      await payReceivable({
        receivableId: tx.receivable!.id,
        amount: "20000",
        accountId: cash.id,
        notes: "Cicilan token PLN",
      })

      const cashAfterPartial = await getAccountBalance({ accountId: cash.id })
      expect(cashAfterPartial).toBe(320000n)

      const recBeforeCancel = await getReceivableById(tx.receivable!.id)
      expect(recBeforeCancel.paidAmount).toBe(20000n)
      expect(recBeforeCancel.remainingAmount).toBe(32000n)
      expect(recBeforeCancel.status).toBe("PARTIAL")

      await cancelTransaction({
        transactionId: tx.id,
        reason: "Token salah meteran listrik",
      })

      const cancelledTx = await getTransactionById({ transactionId: tx.id })
      expect(cancelledTx.status).toBe("CANCELLED")

      const providerWalletAfterCancel = await getAccountBalance({ accountId: providerWallet.id })
      expect(providerWalletAfterCancel).toBe(500000n)

      const reversalEntries = cancelledTx.ledgerEntries.filter((e) =>
        e.description.startsWith("[BATAL]"),
      )
      expect(reversalEntries).toHaveLength(1)
      expect(reversalEntries[0]!.accountId).toBe(providerWallet.id)
      expect(reversalEntries[0]!.direction).toBe("IN")
      expect(reversalEntries[0]!.amount).toBe(50000n)

      const postCancelRec = await getReceivableById(tx.receivable!.id)
      expect(postCancelRec.status).toBe("CANCELLED")
      expect(postCancelRec.paidAmount).toBe(20000n)

      const cashAfterCancel = await getAccountBalance({ accountId: cash.id })
      expect(cashAfterCancel).toBe(320000n)

      const refundLiability = await database.customerRefundLiability.findUnique({
        where: { receivableId: tx.receivable!.id },
      })
      expect(refundLiability).not.toBeNull()
      expect(refundLiability!.totalAmount).toBe(20000n)
      expect(refundLiability!.remainingAmount).toBe(20000n)
      expect(refundLiability!.status).toBe("OPEN")

      const midSummary = await getAssetLiabilitySummary()
      expect(midSummary.customerRefundLiabilities - preSummary.customerRefundLiabilities).toBe(20000n)
      expect(midSummary.outstandingReceivables - preSummary.outstandingReceivables).toBe(0n)
      expect(midSummary.totalCashBalance - preSummary.totalCashBalance).toBe(20000n)
      expect(midSummary.totalAssets - preSummary.totalAssets).toBe(20000n)
      expect(midSummary.totalLiabilities - preSummary.totalLiabilities).toBe(20000n)
      expect(midSummary.netAssets).toBe(preSummary.netAssets)

      const refundPayment = await payCustomerRefund({
        refundLiabilityId: refundLiability!.id,
        amount: "20000",
        accountId: cash.id,
        notes: "Pengembalian uang tunai ke pelanggan",
      })

      expect(refundPayment.liability.status).toBe("PAID")
      expect(refundPayment.liability.remainingAmount).toBe(0n)

      const cashAfterRefund = await getAccountBalance({ accountId: cash.id })
      expect(cashAfterRefund).toBe(300000n)

      const finalSummary = await getAssetLiabilitySummary()
      expect(finalSummary.customerRefundLiabilities).toBe(preSummary.customerRefundLiabilities)
      expect(finalSummary.totalCashBalance).toBe(preSummary.totalCashBalance)
      expect(finalSummary.totalAssets).toBe(preSummary.totalAssets)
      expect(finalSummary.totalLiabilities).toBe(preSummary.totalLiabilities)
      expect(finalSummary.netAssets).toBe(preSummary.netAssets)
    })

    it("UAT 5: Supplier purchase cash vs credit (multi-line, payable creation, partial/full payment, cancellation guard)", async () => {
      const bank = await createAccount({
        name: "Bank Beli Supplier",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(bank.id)

      const supplierJaya = await createSupplier({ name: "Jaya Distribusi" })
      createdSupplierIds.add(supplierJaya.id)

      const pKabel = await createProduct({
        name: "Kabel Data Jaya",
        sellingPrice: "25000",
        initialStock: 0,
      })
      const pCharger = await createProduct({
        name: "Charger Jaya",
        sellingPrice: "60000",
        initialStock: 0,
      })
      createdProductIds.add(pKabel.id)
      createdProductIds.add(pCharger.id)

      const preSummary = await getAssetLiabilitySummary()

      const cashPur = await createSupplierPurchase({
        supplierId: supplierJaya.id,
        isCredit: false,
        accountId: bank.id,
        items: [
          { productId: pKabel.id, quantity: 10, unitCost: "15000" },
        ],
      })
      createdPurchaseIds.add(cashPur.id)

      expect(cashPur.totalAmount).toBe(150000n)
      expect(cashPur.payable).toBeNull()

      const bankAfterCashPur = await getAccountBalance({ accountId: bank.id })
      expect(bankAfterCashPur).toBe(1850000n)

      const pKabelAfterCash = await getProductById(pKabel.id)
      expect(pKabelAfterCash.stockQuantity).toBe(10)
      expect(pKabelAfterCash.inventoryValue).toBe(150000n)

      const summaryAfterCash = await getAssetLiabilitySummary()
      expect(summaryAfterCash.totalAssets).toBe(preSummary.totalAssets)

      const creditPur = await createSupplierPurchase({
        supplierId: supplierJaya.id,
        isCredit: true,
        dueDate: new Date("2026-10-20"),
        items: [
          { productId: pKabel.id, quantity: 10, unitCost: "15000" },
          { productId: pCharger.id, quantity: 5, unitCost: "35000" },
        ],
      })
      createdPurchaseIds.add(creditPur.id)

      expect(creditPur.totalAmount).toBe(325000n)
      expect(creditPur.payable).not.toBeNull()
      expect(creditPur.payable!.remainingAmount).toBe(325000n)

      const bankUnchanged = await getAccountBalance({ accountId: bank.id })
      expect(bankUnchanged).toBe(1850000n)

      const summaryAfterCredit = await getAssetLiabilitySummary()
      expect(summaryAfterCredit.totalAssets - summaryAfterCash.totalAssets).toBe(325000n)
      expect(summaryAfterCredit.totalLiabilities - summaryAfterCash.totalLiabilities).toBe(325000n)
      expect(summaryAfterCredit.netAssets).toBe(summaryAfterCash.netAssets)

      const payPayablePart = await paySupplierPayable({
        payableId: creditPur.payable!.id,
        amount: "125000",
        accountId: bank.id,
        notes: "Cicilan 1 pembelian",
      })

      expect(payPayablePart.payable.paidAmount).toBe(125000n)
      expect(payPayablePart.payable.remainingAmount).toBe(200000n)
      expect(payPayablePart.payable.status).toBe("PARTIAL")

      const bankAfterPartPay = await getAccountBalance({ accountId: bank.id })
      expect(bankAfterPartPay).toBe(1725000n)

      await expect(
        cancelSupplierPurchase({ purchaseId: creditPur.id }),
      ).rejects.toThrow(PurchasePayableHasPaymentsError)

      await paySupplierPayable({
        payableId: creditPur.payable!.id,
        amount: "200000",
        accountId: bank.id,
        notes: "Pelunasan sisa hutang",
      })

      const payableFull = await getPayableById(creditPur.payable!.id)
      expect(payableFull.status).toBe("PAID")
      expect(payableFull.remainingAmount).toBe(0n)

      const cancelCashPur = await cancelSupplierPurchase({ purchaseId: cashPur.id })
      expect(cancelCashPur.status).toBe("CANCELLED")

      const bankRestored = await getAccountBalance({ accountId: bank.id })
      expect(bankRestored).toBe(1675000n)
    })

    it("UAT 6: Purchase cancellation case A (unpaid credit cancels cleanly) and double cancel rejected", async () => {
      const supplier = await createSupplier({ name: "Supplier Batal" })
      createdSupplierIds.add(supplier.id)

      const prod = await createProduct({
        name: "Case Batal",
        sellingPrice: "30000",
        initialStock: 0,
      })
      createdProductIds.add(prod.id)

      const purchase = await createSupplierPurchase({
        supplierId: supplier.id,
        isCredit: true,
        items: [{ productId: prod.id, quantity: 4, unitCost: "20000" }],
      })
      createdPurchaseIds.add(purchase.id)

      let p = await getProductById(prod.id)
      expect(p.stockQuantity).toBe(4)

      const cancelled = await cancelSupplierPurchase({ purchaseId: purchase.id })
      expect(cancelled.status).toBe("CANCELLED")

      p = await getProductById(prod.id)
      expect(p.stockQuantity).toBe(0)
      expect(p.inventoryValue).toBe(0n)

      const payable = await getPayableById(purchase.payable!.id)
      expect(payable.status).toBe("CANCELLED")

      await expect(
        cancelSupplierPurchase({ purchaseId: purchase.id }),
      ).rejects.toThrow(/sudah pernah dibatalkan/)
    })

    it("UAT 7: Backdated mutations & concurrency guards", async () => {
      const prod = await createProduct({
        name: "Produk Concurrency",
        sellingPrice: "50000",
        initialStock: 10,
        initialCost: "30000",
      })
      createdProductIds.add(prod.id)

      const t2 = new Date("2026-09-02T10:00:00Z")
      const tEarlier = new Date("2026-08-30T10:00:00Z")

      await recordStockOut({
        productId: prod.id,
        quantity: 2,
        occurredAt: t2,
      })

      await expect(
        recordStockIn({
          productId: prod.id,
          quantity: 5,
          unitCost: 30000n,
          occurredAt: tEarlier,
        }),
      ).rejects.toThrow(BackdatedInventoryMovementRejectedError)

      await expect(
        recordAdjustment({
          productId: prod.id,
          quantityChange: -1,
          occurredAt: tEarlier,
        }),
      ).rejects.toThrow(BackdatedInventoryMovementRejectedError)

      const mutations = [
        () => recordStockIn({ productId: prod.id, quantity: 1, unitCost: 30000n }),
        () => recordStockOut({ productId: prod.id, quantity: 1 }),
        () => recordStockIn({ productId: prod.id, quantity: 2, unitCost: 30000n }),
        () => recordStockOut({ productId: prod.id, quantity: 2 }),
      ]

      await Promise.all(mutations.map((m) => m()))

      const afterConcurrent = await getProductById(prod.id)
      const rebuilt = await rebuildProductInventory(prod.id)

      expect(afterConcurrent.stockQuantity).toBe(rebuilt.stockQuantity)
      expect(afterConcurrent.inventoryValue).toBe(rebuilt.inventoryValue)
      expect(afterConcurrent.averageCost).toBe(rebuilt.averageCost)
    })

    it("UAT 8: Historical compatibility with pre-Phase-18 transactions", async () => {
      const cash = await createAccount({
        name: "Kas Legacy",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      const legacyTx = await createProductTransaction({
        category: "PRODUCT_SALE",
        customerAccountId: cash.id,
        costAmount: "40000",
        sellingPrice: "60000",
        description: "Penjualan manual tanpa relasi Product",
      })
      createdTransactionIds.add(legacyTx.id)

      expect(legacyTx.costAmount).toBe(40000n)
      expect(legacyTx.profitAmount).toBe(20000n)

      const dbTx = await database.transaction.findUnique({
        where: { id: legacyTx.id },
        include: { inventoryMovements: true, receivable: true },
      })
      expect(dbTx).not.toBeNull()
      expect(dbTx!.inventoryMovements).toHaveLength(0)
      expect(dbTx!.receivable).toBeNull()

      const report = await getFinancialReport({ period: "TODAY" })
      expect(report.totalProfit).toBeGreaterThanOrEqual(20000n)
    })
  })
}
