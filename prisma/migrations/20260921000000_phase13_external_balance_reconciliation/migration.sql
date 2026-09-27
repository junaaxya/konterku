-- CreateEnum
CREATE TYPE "ExternalMatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ExternalReconcileAction" AS ENUM ('NONE', 'MATCHED_EXISTING', 'RECORDED_INCOME', 'RECORDED_EXPENSE', 'IGNORED');

-- CreateTable
CREATE TABLE "ExternalTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "direction" "LedgerDirection",
    "runningBalance" BIGINT,
    "matchStatus" "ExternalMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedTransactionId" TEXT,
    "reconcileAction" "ExternalReconcileAction" NOT NULL DEFAULT 'NONE',
    "note" TEXT,
    "rawPayload" JSONB,
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalTransaction_accountId_date_idx" ON "ExternalTransaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "ExternalTransaction_accountId_matchStatus_idx" ON "ExternalTransaction"("accountId", "matchStatus");

-- CreateIndex
CREATE INDEX "ExternalTransaction_matchedTransactionId_idx" ON "ExternalTransaction"("matchedTransactionId");

-- AddForeignKey
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
