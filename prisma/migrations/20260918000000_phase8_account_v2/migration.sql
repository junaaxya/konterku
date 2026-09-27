-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "providerConnectionId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_code_key" ON "Provider"("code");

-- CreateIndex
CREATE INDEX "Provider_category_isActive_idx" ON "Provider"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_accountId_key" ON "ProviderConnection"("accountId");

-- CreateIndex
CREATE INDEX "ProviderConnection_providerId_status_idx" ON "ProviderConnection"("providerId", "status");

-- CreateIndex
CREATE INDEX "ExternalBalanceSnapshot_providerConnectionId_snapshotAt_idx" ON "ExternalBalanceSnapshot"("providerConnectionId", "snapshotAt");

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBalanceSnapshot" ADD CONSTRAINT "ExternalBalanceSnapshot_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
