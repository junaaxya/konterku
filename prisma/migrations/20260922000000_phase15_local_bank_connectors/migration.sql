-- AlterEnum
ALTER TYPE "SnapshotSource" ADD VALUE 'LOCAL_SYNC';

-- CreateTable
CREATE TABLE "LocalBankConnection" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalBankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalBankConnection_accountId_key" ON "LocalBankConnection"("accountId");

-- CreateIndex
CREATE INDEX "LocalBankConnection_providerCode_status_idx" ON "LocalBankConnection"("providerCode", "status");

-- AddForeignKey
ALTER TABLE "LocalBankConnection" ADD CONSTRAINT "LocalBankConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
