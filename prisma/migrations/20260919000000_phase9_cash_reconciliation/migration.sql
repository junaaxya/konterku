-- CreateTable
CREATE TABLE "CashReconciliation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "systemBalance" BIGINT NOT NULL,
    "physicalAmount" BIGINT NOT NULL,
    "difference" BIGINT NOT NULL,
    "note" TEXT,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashReconciliation_accountId_reconciledAt_idx" ON "CashReconciliation"("accountId", "reconciledAt");

-- AddForeignKey
ALTER TABLE "CashReconciliation" ADD CONSTRAINT "CashReconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
