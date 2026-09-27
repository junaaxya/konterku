-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "grossAmount" BIGINT NOT NULL,
    "costAmount" BIGINT NOT NULL DEFAULT 0,
    "feeAmount" BIGINT NOT NULL DEFAULT 0,
    "profitAmount" BIGINT NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionNumber_key" ON "Transaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "Transaction_category_status_idx" ON "Transaction"("category", "status");

-- CreateIndex
CREATE INDEX "Transaction_occurredAt_idx" ON "Transaction"("occurredAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
