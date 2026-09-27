import { afterEach, describe, expect, it } from "vitest"

import { isNavActive } from "../../src/components/navigation"
import { createAccount, getAccountBalance } from "../../src/features/accounts/account-ledger"
import {
  createProductAction,
  updateProductAction,
  toggleProductActiveAction,
  recordAdjustmentAction,
} from "../../src/app/inventory/actions"
import {
  createSupplierAction,
  updateSupplierAction,
} from "../../src/app/suppliers/actions"
import {
  createPurchaseAction,
  cancelPurchaseAction,
} from "../../src/app/purchases/actions"
import {
  createCustomerAction,
  payReceivableAction,
  payPayableAction,
  payRefundLiabilityAction,
} from "../../src/app/debts-receivables/actions"
import { createProductTransaction } from "../../src/features/transactions/counter-transaction-service"
import { cancelTransaction } from "../../src/features/transactions/transaction-service"
import { getProductById } from "../../src/features/inventory/inventory-service"
import { getPayableById, getPurchaseById } from "../../src/features/suppliers/supplier-purchase-service"
import { getReceivableById, getRefundLiabilityById } from "../../src/features/receivables/receivable-service"
import { getAssetLiabilitySummary } from "../../src/features/reports/asset-liability-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

describe("Phase 18C: Navigation active state unit tests", () => {
  it("determines correct active state for all navigation keys", () => {
    expect(isNavActive("dashboard", "/")).toBe(true)
    expect(isNavActive("dashboard", "/reports")).toBe(false)

    expect(isNavActive("transaksi", "/transactions/new")).toBe(true)
    expect(isNavActive("transaksi", "/transactions/income")).toBe(true)
    expect(isNavActive("transaksi", "/transactions/expense")).toBe(true)
    expect(isNavActive("transaksi", "/transactions")).toBe(false)

    expect(isNavActive("riwayat", "/transactions")).toBe(true)
    expect(isNavActive("riwayat", "/transactions/cmu12345")).toBe(true)
    expect(isNavActive("riwayat", "/transactions/new")).toBe(false)

    expect(isNavActive("inventaris", "/inventory")).toBe(true)
    expect(isNavActive("inventaris", "/inventory/prod-123")).toBe(true)
    expect(isNavActive("inventaris", "/purchases")).toBe(false)

    expect(isNavActive("pembelian", "/purchases")).toBe(true)
    expect(isNavActive("pembelian", "/purchases/new")).toBe(true)
    expect(isNavActive("pembelian", "/purchases/pur-123")).toBe(true)
    expect(isNavActive("pembelian", "/suppliers")).toBe(true)
    expect(isNavActive("pembelian", "/suppliers/sup-123")).toBe(true)
    expect(isNavActive("pembelian", "/inventory")).toBe(false)

    expect(isNavActive("hutang-piutang", "/debts-receivables")).toBe(true)
    expect(isNavActive("hutang-piutang", "/reports")).toBe(false)

    expect(isNavActive("laporan", "/reports")).toBe(true)
    expect(isNavActive("laporan", "/accounts")).toBe(false)

    expect(isNavActive("akun", "/accounts")).toBe(true)
    expect(isNavActive("akun", "/accounts/acc-123")).toBe(true)
    expect(isNavActive("akun", "/reports")).toBe(false)
  })
})

if (databaseUrl === undefined) {
  describe.skip("Phase 18C: UI Server Actions Integration", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 18C: UI Server Actions Integration", () => {
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

    it("inventory actions: create, update, toggle active, and record adjustment", async () => {
      const fd = new FormData()
      fd.set("name", "Kabel Type C Braided")
      fd.set("sku", "KBL-TC-01")
      fd.set("unit", "pcs")
      fd.set("sellingPrice", "35000")
      fd.set("initialStock", "10")
      fd.set("initialCost", "20000")

      const createRes = await createProductAction(fd)
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const prodId = createRes.data.id
      createdProductIds.add(prodId)

      let prod = await getProductById(prodId)
      expect(prod.name).toBe("Kabel Type C Braided")
      expect(prod.stockQuantity).toBe(10)
      expect(prod.inventoryValue).toBe(200000n)
      expect(prod.averageCost).toBe(20000n)

      const editFd = new FormData()
      editFd.set("name", "Kabel Type C Super")
      editFd.set("sku", "KBL-TC-01")
      editFd.set("unit", "pcs")
      editFd.set("sellingPrice", "40000")

      const editRes = await updateProductAction(prodId, editFd)
      expect(editRes.success).toBe(true)

      prod = await getProductById(prodId)
      expect(prod.name).toBe("Kabel Type C Super")
      expect(prod.sellingPrice).toBe(40000n)

      const toggleRes = await toggleProductActiveAction(prodId, false)
      expect(toggleRes.success).toBe(true)
      prod = await getProductById(prodId)
      expect(prod.isActive).toBe(false)

      const adjustFd = new FormData()
      adjustFd.set("direction", "INCREASE")
      adjustFd.set("quantity", "5")
      adjustFd.set("unitCost", "22000")
      adjustFd.set("notes", "Restok manual")

      const adjRes = await recordAdjustmentAction(prodId, adjustFd)
      expect(adjRes.success).toBe(true)

      prod = await getProductById(prodId)
      expect(prod.stockQuantity).toBe(15)
      expect(prod.inventoryValue).toBe(310000n)

      const negAdjFd = new FormData()
      negAdjFd.set("direction", "DECREASE")
      negAdjFd.set("quantity", "99")
      negAdjFd.set("notes", "Kelebihan pengurangan")

      const failAdj = await recordAdjustmentAction(prodId, negAdjFd)
      expect(failAdj.success).toBe(false)
    })

    it("supplier and purchase actions: multi-line cash vs credit, and cancellation with error surface", async () => {
      const suppFd = new FormData()
      suppFd.set("name", "CV Distributor Elektronik")
      suppFd.set("phone", "0811223344")
      suppFd.set("notes", "Vendor utama kabel")

      const suppRes = await createSupplierAction(suppFd)
      expect(suppRes.success).toBe(true)
      if (!suppRes.success) return
      const supplierId = suppRes.data.id
      createdSupplierIds.add(supplierId)

      const updateSuppFd = new FormData()
      updateSuppFd.set("name", "CV Distributor Elektronik Jaya")
      updateSuppFd.set("phone", "0811223344")
      const updateSuppRes = await updateSupplierAction(supplierId, updateSuppFd)
      expect(updateSuppRes.success).toBe(true)

      const bank = await createAccount({
        name: "Bank Beli",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bank.id)

      const p1Fd = new FormData()
      p1Fd.set("name", "Headset Bluetooth")
      p1Fd.set("sellingPrice", "75000")
      p1Fd.set("initialStock", "0")
      const p1Res = await createProductAction(p1Fd)
      expect(p1Res.success).toBe(true)
      if (!p1Res.success) return
      createdProductIds.add(p1Res.data.id)

      const p2Fd = new FormData()
      p2Fd.set("name", "Charger Fast 20W")
      p2Fd.set("sellingPrice", "50000")
      p2Fd.set("initialStock", "0")
      const p2Res = await createProductAction(p2Fd)
      expect(p2Res.success).toBe(true)
      if (!p2Res.success) return
      createdProductIds.add(p2Res.data.id)

      const cashPurRes = await createPurchaseAction({
        supplierId,
        isCredit: false,
        accountId: bank.id,
        items: [
          { productId: p1Res.data.id, quantity: 4, unitCost: "40000" },
          { productId: p2Res.data.id, quantity: 5, unitCost: "25000" },
        ],
      })
      expect(cashPurRes.success).toBe(true)
      if (!cashPurRes.success) return
      createdPurchaseIds.add(cashPurRes.data.id)

      const bankBal = await getAccountBalance({ accountId: bank.id })
      expect(bankBal).toBe(715000n)

      const prod1 = await getProductById(p1Res.data.id)
      expect(prod1.stockQuantity).toBe(4)
      expect(prod1.inventoryValue).toBe(160000n)

      const cancelCashRes = await cancelPurchaseAction(cashPurRes.data.id, "Salah order")
      expect(cancelCashRes.success).toBe(true)

      const bankBalRestored = await getAccountBalance({ accountId: bank.id })
      expect(bankBalRestored).toBe(1000000n)

      const prod1Restored = await getProductById(p1Res.data.id)
      expect(prod1Restored.stockQuantity).toBe(0)

      const creditPurRes = await createPurchaseAction({
        supplierId,
        isCredit: true,
        dueDate: "2026-10-15",
        items: [
          { productId: p1Res.data.id, quantity: 10, unitCost: "40000" },
        ],
      })
      expect(creditPurRes.success).toBe(true)
      if (!creditPurRes.success) return
      createdPurchaseIds.add(creditPurRes.data.id)

      const purchaseDetail = await getPurchaseById(creditPurRes.data.id)
      expect(purchaseDetail.payable).toBeDefined()
      expect(purchaseDetail.payable!.remainingAmount).toBe(400000n)

      const payPayableFd = new FormData()
      payPayableFd.set("payableId", purchaseDetail.payable!.id)
      payPayableFd.set("amount", "100000")
      payPayableFd.set("accountId", bank.id)

      const payPayRes = await payPayableAction(payPayableFd)
      expect(payPayRes.success).toBe(true)

      const payableAfterPay = await getPayableById(purchaseDetail.payable!.id)
      expect(payableAfterPay.paidAmount).toBe(100000n)
      expect(payableAfterPay.remainingAmount).toBe(300000n)
      expect(payableAfterPay.status).toBe("PARTIAL")

      const cancelBlockedRes = await cancelPurchaseAction(creditPurRes.data.id)
      expect(cancelBlockedRes.success).toBe(false)
      if (!cancelBlockedRes.success) {
        expect(cancelBlockedRes.error).toContain("telah memiliki pembayaran")
      }
    })

    it("credit transaction customer requirement, stock deduction, and receivable payment / refund liability", async () => {
      const cash = await createAccount({
        name: "Kas Konter 18C",
        type: "CASH",
        openingBalance: "500000",
      })
      createdAccountIds.add(cash.id)

      const custFd = new FormData()
      custFd.set("name", "Mas Anto")
      custFd.set("phone", "0877123456")
      const custRes = await createCustomerAction(custFd)
      expect(custRes.success).toBe(true)
      if (!custRes.success) return
      const customerId = custRes.data.id
      createdCustomerIds.add(customerId)

      const prodFd = new FormData()
      prodFd.set("name", "Headset Macaron")
      prodFd.set("sellingPrice", "30000")
      prodFd.set("initialStock", "5")
      prodFd.set("initialCost", "18000")
      const prodRes = await createProductAction(prodFd)
      expect(prodRes.success).toBe(true)
      if (!prodRes.success) return
      const productId = prodRes.data.id
      createdProductIds.add(productId)

      await expect(
        createProductTransaction({
          category: "PRODUCT_SALE",
          productId,
          quantity: 1,
          sellingPrice: "30000",
          description: "Tempo tanpa customer",
          isCredit: true,
        }),
      ).rejects.toThrow(/customerId/)

      const creditTx = await createProductTransaction({
        category: "PRODUCT_SALE",
        productId,
        quantity: 2,
        sellingPrice: "60000",
        description: "Headset tempo Mas Anto",
        isCredit: true,
        customerId,
      })
      createdTransactionIds.add(creditTx.id)

      const cashBalanceUnchanged = await getAccountBalance({ accountId: cash.id })
      expect(cashBalanceUnchanged).toBe(500000n)

      const prodAfterSale = await getProductById(productId)
      expect(prodAfterSale.stockQuantity).toBe(3)

      expect(creditTx.receivable).toBeDefined()
      const receivableId = creditTx.receivable!.id

      const payRecFd = new FormData()
      payRecFd.set("receivableId", receivableId)
      payRecFd.set("amount", "25000")
      payRecFd.set("accountId", cash.id)

      const payRecRes = await payReceivableAction(payRecFd)
      expect(payRecRes.success).toBe(true)

      const recAfterPay = await getReceivableById(receivableId)
      expect(recAfterPay.paidAmount).toBe(25000n)
      expect(recAfterPay.remainingAmount).toBe(35000n)
      expect(recAfterPay.status).toBe("PARTIAL")

      const cashAfterRecPay = await getAccountBalance({ accountId: cash.id })
      expect(cashAfterRecPay).toBe(525000n)

      await cancelTransaction({
        transactionId: creditTx.id,
        reason: "Pelanggan retur barang",
      })

      const prodRestored = await getProductById(productId)
      expect(prodRestored.stockQuantity).toBe(5)

      const refundLiability = await database.customerRefundLiability.findUnique({
        where: { receivableId },
      })
      expect(refundLiability).not.toBeNull()
      expect(refundLiability!.remainingAmount).toBe(25000n)

      const refundFd = new FormData()
      refundFd.set("liabilityId", refundLiability!.id)
      refundFd.set("amount", "25000")
      refundFd.set("accountId", cash.id)

      const refundRes = await payRefundLiabilityAction(refundFd)
      expect(refundRes.success).toBe(true)

      const refundAfterPay = await getRefundLiabilityById(refundLiability!.id)
      expect(refundAfterPay.remainingAmount).toBe(0n)
      expect(refundAfterPay.status).toBe("PAID")

      const cashAfterRefund = await getAccountBalance({ accountId: cash.id })
      expect(cashAfterRefund).toBe(500000n)
    })

    it("report asset/liability metrics integrates correctly with domain services", async () => {
      const summary = await getAssetLiabilitySummary()

      expect(typeof summary.totalCashBalance).toBe("bigint")
      expect(typeof summary.outstandingReceivables).toBe("bigint")
      expect(typeof summary.inventoryValuation).toBe("bigint")
      expect(typeof summary.totalAssets).toBe("bigint")
      expect(typeof summary.supplierPayables).toBe("bigint")
      expect(typeof summary.customerRefundLiabilities).toBe("bigint")
      expect(typeof summary.totalLiabilities).toBe("bigint")
      expect(typeof summary.netAssets).toBe("bigint")

      expect(summary.totalAssets).toBe(
        summary.totalCashBalance + summary.outstandingReceivables + summary.inventoryValuation,
      )
      expect(summary.totalLiabilities).toBe(
        summary.supplierPayables + summary.customerRefundLiabilities,
      )
      expect(summary.netAssets).toBe(summary.totalAssets - summary.totalLiabilities)
    })
  })
}
