import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  createProduct,
  getProductById,
  recordStockIn,
  recordStockOut,
  recordAdjustment,
  reverseSaleMovement,
  reversePurchaseMovement,
  rebuildProductInventory,
  InsufficientStockError,
  BackdatedInventoryMovementRejectedError,
  PurchaseAlreadyConsumedError,
  MovementAlreadyReversedError,
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
} from "../../src/features/transactions/transaction-service"
import { getAssetLiabilitySummary } from "../../src/features/reports/asset-liability-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 18B: Domain Services (Receivables, Payables, Inventory, Assets & Liabilities)", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 18B: Domain Services (Receivables, Payables, Inventory, Assets & Liabilities)", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdProductIds = new Set<string>()
    const createdSupplierIds = new Set<string>()
    const createdCustomerIds = new Set<string>()
    const createdTransactionIds = new Set<string>()

    afterEach(async () => {
      const txIds = [...createdTransactionIds]
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

      if (prodIds.length > 0) {
        await database.inventoryMovement.deleteMany({ where: { productId: { in: prodIds } } })
        await database.product.deleteMany({ where: { id: { in: prodIds } } })
        createdProductIds.clear()
      }

      if (suppIds.length > 0) {
        await database.payablePayment.deleteMany({ where: { payable: { supplierId: { in: suppIds } } } })
        await database.payable.deleteMany({ where: { supplierId: { in: suppIds } } })
        await database.inventoryMovement.deleteMany({ where: { supplierPurchase: { supplierId: { in: suppIds } } } })
        await database.supplierPurchase.deleteMany({ where: { supplierId: { in: suppIds } } })
        await database.supplier.deleteMany({ where: { id: { in: suppIds } } })
        createdSupplierIds.clear()
      }

      if (custIds.length > 0) {
        await database.customerRefundPayment.deleteMany({ where: { refundLiability: { customerId: { in: custIds } } } })
        await database.customerRefundLiability.deleteMany({ where: { customerId: { in: custIds } } })
        await database.receivablePayment.deleteMany({ where: { receivable: { customerId: { in: custIds } } } })
        await database.receivable.deleteMany({ where: { customerId: { in: custIds } } })
        await database.customer.deleteMany({ where: { id: { in: custIds } } })
        createdCustomerIds.clear()
      }

      if (accIds.length > 0) {
        await database.cashReconciliation.deleteMany({ where: { accountId: { in: accIds } } })
        await database.externalBalanceSnapshot.deleteMany({ where: { accountId: { in: accIds } } })
        await database.localBankConnection.deleteMany({ where: { accountId: { in: accIds } } })
        await database.payablePayment.deleteMany({ where: { accountId: { in: accIds } } })
        await database.customerRefundPayment.deleteMany({ where: { accountId: { in: accIds } } })
        await database.receivablePayment.deleteMany({ where: { accountId: { in: accIds } } })
        await database.ledgerEntry.deleteMany({ where: { accountId: { in: accIds } } })
        await database.account.deleteMany({ where: { id: { in: accIds } } })
        createdAccountIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("enforces inventory locked mutations, updates integer moving-average & inventoryValue, and handles concurrent stock mutations safely", async () => {
      const product = await createProduct({
        sku: "KBL-TYPE-C",
        name: "Kabel Data Type C",
        sellingPrice: "25000",
        initialStock: 10,
        initialCost: "15000", // initial value = 150.000
      })
      createdProductIds.add(product.id)

      let p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(10)
      expect(p.inventoryValue).toBe(150000n)
      expect(p.averageCost).toBe(15000n)

      // Stock in 10 @ 16.000 -> value = 150.000 + 160.000 = 310.000, stock = 20, avg = floor(310.000 / 20) = 15.500
      await recordStockIn({
        productId: product.id,
        quantity: 10,
        unitCost: 16000n,
      })

      p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(20)
      expect(p.inventoryValue).toBe(310000n)
      expect(p.averageCost).toBe(15500n)

      // Partial stock out: 5 units @ 15.500 = 77.500
      const outMov = await recordStockOut({
        productId: product.id,
        quantity: 5,
      })
      expect(outMov.totalCost).toBe(77500n)
      expect(outMov.quantityChange).toBe(-5)

      p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(15)
      expect(p.inventoryValue).toBe(232500n)

      // Concurrent stock out test: 3 parallel tasks trying to take 5 each (total 15 available)
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          recordStockOut({
            productId: product.id,
            quantity: 5,
          }),
        ),
      )
      expect(results).toHaveLength(3)

      p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(0)
      expect(p.inventoryValue).toBe(0n)
      expect(p.averageCost).toBe(0n)

      // Subsequent stock out must fail with InsufficientStockError
      await expect(
        recordStockOut({
          productId: product.id,
          quantity: 1,
        }),
      ).rejects.toThrow(InsufficientStockError)

      // Rebuild inventory must match deterministically
      const rebuilt = await rebuildProductInventory(product.id)
      expect(rebuilt.stockQuantity).toBe(0)
      expect(rebuilt.inventoryValue).toBe(0n)
    })

    it("rejects duplicate reversal of SALE_CANCELLED and PURCHASE_CANCELLED (idempotent reversal guard)", async () => {
      const product = await createProduct({
        sku: "TG-SP",
        name: "Tempered Glass",
        sellingPrice: "35000",
        initialStock: 5,
        initialCost: "10000",
      })
      createdProductIds.add(product.id)

      // Sale 2 units
      const saleMovement = await recordStockOut({
        productId: product.id,
        quantity: 2,
      })

      // First reversal of sale succeeds
      const saleReversal1 = await reverseSaleMovement({
        movementId: saleMovement.id,
      })
      expect(saleReversal1.type).toBe("SALE_CANCELLED")
      expect(saleReversal1.reversesMovementId).toBe(saleMovement.id)

      let p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(5)

      // Duplicate reversal of the same sale movement must throw MovementAlreadyReversedError
      await expect(
        reverseSaleMovement({
          movementId: saleMovement.id,
        }),
      ).rejects.toThrow(MovementAlreadyReversedError)

      // Purchase stock in
      const purchaseMov = await recordStockIn({
        productId: product.id,
        quantity: 4,
        unitCost: 12000n,
      })

      // First reversal of purchase succeeds
      const purchaseReversal1 = await reversePurchaseMovement({
        movementId: purchaseMov.id,
      })
      expect(purchaseReversal1.type).toBe("PURCHASE_CANCELLED")

      p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(5)

      // Duplicate reversal of the same purchase movement must throw MovementAlreadyReversedError
      await expect(
        reversePurchaseMovement({
          movementId: purchaseMov.id,
        }),
      ).rejects.toThrow(MovementAlreadyReversedError)
    })

    it("global backdated guard rejects ordinary mutations earlier than latest STOCK_OUT but permits official reversals", async () => {
      const product = await createProduct({
        name: "Casing Polos",
        sellingPrice: "20000",
        initialStock: 10,
        initialCost: "8000",
      })
      createdProductIds.add(product.id)

      const stockOutDate = new Date("2026-09-18T10:00:00Z")
      const saleMovement = await recordStockOut({
        productId: product.id,
        quantity: 2,
        occurredAt: stockOutDate,
      })

      // Attempting ordinary STOCK_IN earlier than stockOutDate is rejected
      const earlierDate = new Date("2026-09-18T08:00:00Z")
      await expect(
        recordStockIn({
          productId: product.id,
          quantity: 5,
          unitCost: 8500n,
          occurredAt: earlierDate,
        }),
      ).rejects.toThrow(BackdatedInventoryMovementRejectedError)

      // Attempting ordinary positive ADJUSTMENT earlier than stockOutDate is rejected
      await expect(
        recordAdjustment({
          productId: product.id,
          quantityChange: 1,
          occurredAt: earlierDate,
        }),
      ).rejects.toThrow(BackdatedInventoryMovementRejectedError)

      // Official reversal SALE_CANCELLED is EXEMPT from backdated guard and uses current timestamp
      const reversal = await reverseSaleMovement({
        movementId: saleMovement.id,
      })
      expect(reversal.type).toBe("SALE_CANCELLED")
      expect(reversal.occurredAt.getTime()).toBeGreaterThan(stockOutDate.getTime())
    })

    it("supplier purchase: cash purchase records ledger OUT, credit purchase creates payable, and cancelling unpaid purchase reverses stock & cancels payable", async () => {
      const cash = await createAccount({
        name: "Kas Pembelian",
        type: "CASH",
        openingBalance: "1000000",
      })
      createdAccountIds.add(cash.id)

      const supplier = await createSupplier({
        name: "CV Maju Aksesoris",
        phone: "08123456789",
      })
      createdSupplierIds.add(supplier.id)

      const product = await createProduct({
        name: "Headset Bluetooth",
        sellingPrice: "75000",
        initialStock: 0,
        initialCost: "0",
      })
      createdProductIds.add(product.id)

      // 1. Cash Purchase: Rp100.000 -> Ledger OUT Rp100.000, no payable created
      const cashPurchase = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 2, unitCost: "50000" }],
        isCredit: false,
        accountId: cash.id,
      })

      expect(cashPurchase.payable).toBeNull()
      expect(cashPurchase.totalAmount).toBe(100000n)

      let cashBalance = await getAccountBalance({ accountId: cash.id })
      expect(cashBalance).toBe(900000n)

      let p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(2)
      expect(p.inventoryValue).toBe(100000n)

      // 2. Credit Purchase: 4 units @ 45.000 = 180.000 -> Payable created, cash untouched
      const creditPurchase = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 4, unitCost: "45000" }],
        isCredit: true,
      })

      expect(creditPurchase.payable).toBeDefined()
      expect(creditPurchase.payable?.totalAmount).toBe(180000n)
      expect(creditPurchase.payable?.remainingAmount).toBe(180000n)
      expect(creditPurchase.payable?.status).toBe("OPEN")

      // Cash balance remains 900.000
      cashBalance = await getAccountBalance({ accountId: cash.id })
      expect(cashBalance).toBe(900000n)

      p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(6)

      // 3. Cancel unpaid credit purchase -> stock reversed and payable cancelled
      const cancelledPurchase = await cancelSupplierPurchase({
        purchaseId: creditPurchase.id,
        reason: "Salah pesan barang",
      })
      expect(cancelledPurchase.status).toBe("CANCELLED")

      const payableAfterCancel = await getPayableById(creditPurchase.payable!.id)
      expect(payableAfterCancel.status).toBe("CANCELLED")

      p = await getProductById(product.id)
      expect(p.stockQuantity).toBe(2) // 4 units removed
      expect(p.inventoryValue).toBe(100000n)
    })

    it("rejects purchase cancellation when payable has payments or when purchase was consumed by later reducing movements", async () => {
      const cash = await createAccount({
        name: "Kas Uji Rejection",
        type: "CASH",
        openingBalance: "500000",
      })
      createdAccountIds.add(cash.id)

      const supplier = await createSupplier({
        name: "Grosir Sparepart",
      })
      createdSupplierIds.add(supplier.id)

      const productA = await createProduct({
        name: "Charger Fast 20W",
        sellingPrice: "60000",
        initialStock: 0,
        initialCost: "0",
      })
      createdProductIds.add(productA.id)

      // Case A: Credit purchase with partial payment
      const purchaseCredit = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [{ productId: productA.id, quantity: 5, unitCost: "30000" }], // total 150.000
        isCredit: true,
      })

      // Pay 50.000 towards payable
      await paySupplierPayable({
        payableId: purchaseCredit.payable!.id,
        accountId: cash.id,
        amount: "50000",
      })

      // Attempting to cancel purchase must throw PurchasePayableHasPaymentsError
      await expect(
        cancelSupplierPurchase({
          purchaseId: purchaseCredit.id,
        }),
      ).rejects.toThrow(PurchasePayableHasPaymentsError)

      // Case B: Cash purchase followed by later stock-out consumption
      const productB = await createProduct({
        name: "Adaptor OTG",
        sellingPrice: "15000",
        initialStock: 0,
        initialCost: "0",
      })
      createdProductIds.add(productB.id)

      const purchaseDate = new Date("2026-09-17T09:00:00Z")
      const purchaseCash = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [{ productId: productB.id, quantity: 10, unitCost: "8000" }],
        isCredit: false,
        accountId: cash.id,
        occurredAt: purchaseDate,
      })

      // Consumer buys 2 units later
      const laterDate = new Date("2026-09-17T11:00:00Z")
      await recordStockOut({
        productId: productB.id,
        quantity: 2,
        occurredAt: laterDate,
      })

      // Attempting to cancel purchaseCash must throw PurchaseAlreadyConsumedError
      await expect(
        cancelSupplierPurchase({
          purchaseId: purchaseCash.id,
        }),
      ).rejects.toThrow(PurchaseAlreadyConsumedError)
    })

    it("receivable lifecycle: creates receivable from transaction, supports partial and full payments without creating revenue/profit/transactions", async () => {
      const cash = await createAccount({
        name: "Kas Piutang",
        type: "CASH",
        openingBalance: "100000",
      })
      createdAccountIds.add(cash.id)

      const bank = await createAccount({
        name: "BCA Piutang",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(bank.id)

      const customer = await createCustomer({
        name: "Pak Bambang",
        phone: "08567890123",
      })
      createdCustomerIds.add(customer.id)

      const tx = await createProductTransaction({
        category: "PULSA",
        costAmount: "48000",
        sellingPrice: "52000",
        description: "Pulsa Indosat 50k Pak Bambang",
        isCredit: true,
        customerId: customer.id,
        notes: "Janji bayar akhir pekan",
      })
      createdTransactionIds.add(tx.id)

      const receivable = tx.receivable!

      expect(receivable.totalAmount).toBe(52000n)
      expect(receivable.paidAmount).toBe(0n)
      expect(receivable.remainingAmount).toBe(52000n)
      expect(receivable.status).toBe("OPEN")

      const beforeTxCount = await database.transaction.count()

      // Partial payment: 20.000 cash
      const partialRes = await payReceivable({
        receivableId: receivable.id,
        accountId: cash.id,
        amount: "20000",
      })

      expect(partialRes.receivable.paidAmount).toBe(20000n)
      expect(partialRes.receivable.remainingAmount).toBe(32000n)
      expect(partialRes.receivable.status).toBe("PARTIAL")

      const cashBal = await getAccountBalance({ accountId: cash.id })
      expect(cashBal).toBe(120000n)

      // Full payment: 32.000 via BCA
      const fullRes = await payReceivable({
        receivableId: receivable.id,
        accountId: bank.id,
        amount: "32000",
      })

      expect(fullRes.receivable.paidAmount).toBe(52000n)
      expect(fullRes.receivable.remainingAmount).toBe(0n)
      expect(fullRes.receivable.status).toBe("PAID")

      const bankBal = await getAccountBalance({ accountId: bank.id })
      expect(bankBal).toBe(532000n) // 500.000 + 32.000

      // INVARIANT: Transactions table count must be unchanged (NO new Transaction, NO new revenue/profit)
      const afterTxCount = await database.transaction.count()
      expect(afterTxCount).toBe(beforeTxCount)
    })

    it("transaction cancellation after partial credit payment forms CustomerRefundLiability without auto-refunding cash, and explicit refund reduces liability and moves cash OUT", async () => {
      const cash = await createAccount({
        name: "Kas Refund UAT",
        type: "CASH",
        openingBalance: "300000",
      })
      createdAccountIds.add(cash.id)

      const customer = await createCustomer({
        name: "Ibu Rahma",
      })
      createdCustomerIds.add(customer.id)

      const tx = await createProductTransaction({
        category: "PLN_TOKEN",
        costAmount: "97000",
        sellingPrice: "100000",
        description: "Token PLN 100k Ibu Rahma",
        isCredit: true,
        customerId: customer.id,
      })
      createdTransactionIds.add(tx.id)

      const receivable = tx.receivable!

      await payReceivable({
        receivableId: receivable.id,
        accountId: cash.id,
        amount: "40000",
      })

      let cashBal = await getAccountBalance({ accountId: cash.id })
      expect(cashBal).toBe(340000n) // 300.000 + 40.000

      // Now cancel the transaction
      await cancelTransaction({
        transactionId: tx.id,
        reason: "Salah nomor meter pelanggan",
      })

      // Receivable is cancelled
      const rec = await getReceivableById(receivable.id)
      expect(rec.status).toBe("CANCELLED")

      // CustomerRefundLiability is formed for 40.000
      expect(rec.refundLiability).toBeDefined()
      expect(rec.refundLiability?.totalAmount).toBe(40000n)
      expect(rec.refundLiability?.remainingAmount).toBe(40000n)
      expect(rec.refundLiability?.status).toBe("OPEN")

      // Cash in shop has NOT been deducted automatically
      cashBal = await getAccountBalance({ accountId: cash.id })
      expect(cashBal).toBe(340000n)

      // Explicit customer refund payment: 40.000 cash handed back
      const refundResult = await payCustomerRefund({
        refundLiabilityId: rec.refundLiability!.id,
        accountId: cash.id,
        amount: "40000",
      })

      expect(refundResult.liability.remainingAmount).toBe(0n)
      expect(refundResult.liability.status).toBe("PAID")

      // Now cash is properly deducted
      cashBal = await getAccountBalance({ accountId: cash.id })
      expect(cashBal).toBe(300000n)
    })

    it("payable payment lifecycle: supports partial and full supplier payments without creating expense/profit/transactions", async () => {
      const bank = await createAccount({
        name: "BCA Supplier Pay",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bank.id)

      const supplier = await createSupplier({
        name: "Distributor Voucher",
      })
      createdSupplierIds.add(supplier.id)

      const product = await createProduct({
        name: "Perdana Kuota 10GB",
        sellingPrice: "40000",
        initialStock: 0,
        initialCost: "0",
      })
      createdProductIds.add(product.id)

      const purchase = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 10, unitCost: "25000" }], // total 250.000
        isCredit: true,
      })

      const payableId = purchase.payable!.id
      const beforeTxCount = await database.transaction.count()

      // 1. Partial payment 100.000
      const part1 = await paySupplierPayable({
        payableId,
        accountId: bank.id,
        amount: "100000",
      })
      expect(part1.payable.paidAmount).toBe(100000n)
      expect(part1.payable.remainingAmount).toBe(150000n)
      expect(part1.payable.status).toBe("PARTIAL")

      // 2. Full payment remaining 150.000
      const part2 = await paySupplierPayable({
        payableId,
        accountId: bank.id,
        amount: "150000",
      })
      expect(part2.payable.paidAmount).toBe(250000n)
      expect(part2.payable.remainingAmount).toBe(0n)
      expect(part2.payable.status).toBe("PAID")

      const finalBank = await getAccountBalance({ accountId: bank.id })
      expect(finalBank).toBe(750000n) // 1.000.000 - 250.000

      // INVARIANT: Transactions table count is unchanged
      const afterTxCount = await database.transaction.count()
      expect(afterTxCount).toBe(beforeTxCount)
    })

    it("financial aggregation calculates Total Piutang, Valuasi Inventaris, Total Kewajiban, Total Aset, and Aset Bersih accurately using canonical existing cash balance", async () => {
      const initialSummary = await getAssetLiabilitySummary()

      const cash = await createAccount({
        name: "Kas Aset Bersih",
        type: "CASH",
        openingBalance: "1000000",
      })
      createdAccountIds.add(cash.id)

      const supplier = await createSupplier({
        name: "Supplier Utama",
      })
      createdSupplierIds.add(supplier.id)

      const product = await createProduct({
        name: "Powerbank 10000mAh",
        sellingPrice: "120000",
        initialStock: 10,
        initialCost: "80000",
      })
      createdProductIds.add(product.id)

      const purchase = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 2, unitCost: "100000" }],
        isCredit: true,
      })
      expect(purchase.totalAmount).toBe(200000n)

      const customer = await createCustomer({ name: "Pelanggan VIP" })
      createdCustomerIds.add(customer.id)

      const tx = await createProductTransaction({
        category: "PRODUCT_SALE",
        productId: product.id,
        quantity: 1,
        sellingPrice: "120000",
        description: "Powerbank tempo",
        isCredit: true,
        customerId: customer.id,
      })
      createdTransactionIds.add(tx.id)

      expect(tx.receivable).toBeDefined()
      expect(tx.costAmount).toBe(83333n)
      expect(tx.profitAmount).toBe(36667n)

      const summary = await getAssetLiabilitySummary()

      expect(summary.totalCashBalance).toBe(initialSummary.totalCashBalance + 1000000n)
      expect(summary.outstandingReceivables).toBe(initialSummary.outstandingReceivables + 120000n)
      expect(summary.inventoryValuation).toBe(initialSummary.inventoryValuation + 916667n)
      expect(summary.supplierPayables).toBe(initialSummary.supplierPayables + 200000n)
      expect(summary.customerRefundLiabilities).toBe(initialSummary.customerRefundLiabilities + 0n)
      expect(summary.totalAssets).toBe(summary.totalCashBalance + summary.outstandingReceivables + summary.inventoryValuation)
      expect(summary.totalLiabilities).toBe(summary.supplierPayables + summary.customerRefundLiabilities)
      expect(summary.netAssets).toBe(summary.totalAssets - summary.totalLiabilities)
    })

    it("initial stock on product creation creates InventoryMovement and rebuild matches exactly", async () => {
      const product = await createProduct({
        name: "Kabel Type C Init",
        sellingPrice: "25000",
        initialStock: 5,
        initialCost: "15000",
      })
      createdProductIds.add(product.id)

      expect(product.stockQuantity).toBe(5)
      expect(product.inventoryValue).toBe(75000n)
      expect(product.averageCost).toBe(15000n)

      const movements = await database.inventoryMovement.findMany({
        where: { productId: product.id },
      })
      expect(movements).toHaveLength(1)
      expect(movements[0]!.type).toBe("STOCK_IN")
      expect(movements[0]!.quantityChange).toBe(5)
      expect(movements[0]!.unitCost).toBe(15000n)
      expect(movements[0]!.totalCost).toBe(75000n)

      const rebuilt = await rebuildProductInventory(product.id)
      expect(rebuilt.stockQuantity).toBe(5)
      expect(rebuilt.inventoryValue).toBe(75000n)
      expect(rebuilt.averageCost).toBe(15000n)
    })

    it("multi-product supplier purchase locks in order, validates total cost, and cancels cleanly", async () => {
      const supplier = await createSupplier({ name: "Distributor Multi" })
      createdSupplierIds.add(supplier.id)

      const p1 = await createProduct({
        name: "Barang Alpha",
        sellingPrice: "50000",
        initialStock: 0,
      })
      const p2 = await createProduct({
        name: "Barang Beta",
        sellingPrice: "30000",
        initialStock: 0,
      })
      createdProductIds.add(p1.id)
      createdProductIds.add(p2.id)

      const purchase = await createSupplierPurchase({
        supplierId: supplier.id,
        items: [
          { productId: p1.id, quantity: 4, unitCost: "25000" },
          { productId: p2.id, quantity: 5, unitCost: "10000" },
        ],
        isCredit: true,
      })
      expect(purchase.totalAmount).toBe(150000n)

      const p1Updated = await getProductById(p1.id)
      const p2Updated = await getProductById(p2.id)
      expect(p1Updated.stockQuantity).toBe(4)
      expect(p1Updated.inventoryValue).toBe(100000n)
      expect(p2Updated.stockQuantity).toBe(5)
      expect(p2Updated.inventoryValue).toBe(50000n)

      await cancelSupplierPurchase({ purchaseId: purchase.id })

      const p1Cancelled = await getProductById(p1.id)
      const p2Cancelled = await getProductById(p2.id)
      expect(p1Cancelled.stockQuantity).toBe(0)
      expect(p1Cancelled.inventoryValue).toBe(0n)
      expect(p2Cancelled.stockQuantity).toBe(0)
      expect(p2Cancelled.inventoryValue).toBe(0n)
    })
  })
}
