-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundLiabilityStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'SALE_CANCELLED', 'PURCHASE_CANCELLED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPurchase" (
    "id" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'COMPLETED',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "receivableNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "remainingAmount" BIGINT NOT NULL,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivablePayment" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRefundLiability" (
    "id" TEXT NOT NULL,
    "liabilityNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "refundedAmount" BIGINT NOT NULL DEFAULT 0,
    "remainingAmount" BIGINT NOT NULL,
    "status" "RefundLiabilityStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRefundLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRefundPayment" (
    "id" TEXT NOT NULL,
    "refundLiabilityId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRefundPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "payableNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierPurchaseId" TEXT,
    "description" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "remainingAmount" BIGINT NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayablePayment" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "inventoryValue" BIGINT NOT NULL DEFAULT 0,
    "averageCost" BIGINT NOT NULL DEFAULT 0,
    "sellingPrice" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "unitCost" BIGINT NOT NULL,
    "totalCost" BIGINT NOT NULL,
    "transactionId" TEXT,
    "supplierPurchaseId" TEXT,
    "reversesMovementId" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPurchase_purchaseNumber_key" ON "SupplierPurchase"("purchaseNumber");

-- CreateIndex
CREATE INDEX "SupplierPurchase_supplierId_status_idx" ON "SupplierPurchase"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierPurchase_occurredAt_idx" ON "SupplierPurchase"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_receivableNumber_key" ON "Receivable"("receivableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_transactionId_key" ON "Receivable"("transactionId");

-- CreateIndex
CREATE INDEX "Receivable_customerId_status_idx" ON "Receivable"("customerId", "status");

-- CreateIndex
CREATE INDEX "Receivable_status_idx" ON "Receivable"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReceivablePayment_ledgerEntryId_key" ON "ReceivablePayment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "ReceivablePayment_receivableId_idx" ON "ReceivablePayment"("receivableId");

-- CreateIndex
CREATE INDEX "ReceivablePayment_accountId_idx" ON "ReceivablePayment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefundLiability_liabilityNumber_key" ON "CustomerRefundLiability"("liabilityNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefundLiability_receivableId_key" ON "CustomerRefundLiability"("receivableId");

-- CreateIndex
CREATE INDEX "CustomerRefundLiability_customerId_status_idx" ON "CustomerRefundLiability"("customerId", "status");

-- CreateIndex
CREATE INDEX "CustomerRefundLiability_status_idx" ON "CustomerRefundLiability"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefundPayment_ledgerEntryId_key" ON "CustomerRefundPayment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "CustomerRefundPayment_refundLiabilityId_idx" ON "CustomerRefundPayment"("refundLiabilityId");

-- CreateIndex
CREATE INDEX "CustomerRefundPayment_accountId_idx" ON "CustomerRefundPayment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payable_payableNumber_key" ON "Payable"("payableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payable_supplierPurchaseId_key" ON "Payable"("supplierPurchaseId");

-- CreateIndex
CREATE INDEX "Payable_supplierId_status_idx" ON "Payable"("supplierId", "status");

-- CreateIndex
CREATE INDEX "Payable_status_idx" ON "Payable"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayablePayment_ledgerEntryId_key" ON "PayablePayment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "PayablePayment_payableId_idx" ON "PayablePayment"("payableId");

-- CreateIndex
CREATE INDEX "PayablePayment_accountId_idx" ON "PayablePayment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_reversesMovementId_key" ON "InventoryMovement"("reversesMovementId");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_occurredAt_idx" ON "InventoryMovement"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_supplierPurchaseId_idx" ON "InventoryMovement"("supplierPurchaseId");

-- AddForeignKey
ALTER TABLE "SupplierPurchase" ADD CONSTRAINT "SupplierPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefundLiability" ADD CONSTRAINT "CustomerRefundLiability_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefundLiability" ADD CONSTRAINT "CustomerRefundLiability_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefundPayment" ADD CONSTRAINT "CustomerRefundPayment_refundLiabilityId_fkey" FOREIGN KEY ("refundLiabilityId") REFERENCES "CustomerRefundLiability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefundPayment" ADD CONSTRAINT "CustomerRefundPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefundPayment" ADD CONSTRAINT "CustomerRefundPayment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierPurchaseId_fkey" FOREIGN KEY ("supplierPurchaseId") REFERENCES "SupplierPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_supplierPurchaseId_fkey" FOREIGN KEY ("supplierPurchaseId") REFERENCES "SupplierPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reversesMovementId_fkey" FOREIGN KEY ("reversesMovementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
