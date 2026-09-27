-- CreateEnum
CREATE TYPE "SnapshotSource" AS ENUM ('MANUAL', 'IMPORT', 'PROVIDER_SYNC');

-- Drop existing foreign key on ExternalBalanceSnapshot
ALTER TABLE "ExternalBalanceSnapshot" DROP CONSTRAINT IF EXISTS "ExternalBalanceSnapshot_providerConnectionId_fkey";

-- Add accountId, source, note to ExternalBalanceSnapshot
ALTER TABLE "ExternalBalanceSnapshot" ADD COLUMN "accountId" TEXT;
ALTER TABLE "ExternalBalanceSnapshot" ADD COLUMN "source" "SnapshotSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ExternalBalanceSnapshot" ADD COLUMN "note" TEXT;

-- Backfill accountId from ProviderConnection if any exist
UPDATE "ExternalBalanceSnapshot" s
SET "accountId" = c."accountId"
FROM "ProviderConnection" c
WHERE s."providerConnectionId" = c."id";

-- Fallback for any orphaned rows (in tests/dev)
DELETE FROM "ExternalBalanceSnapshot" WHERE "accountId" IS NULL;

-- Make accountId NOT NULL
ALTER TABLE "ExternalBalanceSnapshot" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "ExternalBalanceSnapshot" ALTER COLUMN "providerConnectionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ExternalBalanceSnapshot_accountId_snapshotAt_idx" ON "ExternalBalanceSnapshot"("accountId", "snapshotAt");

-- AddForeignKey
ALTER TABLE "ExternalBalanceSnapshot" ADD CONSTRAINT "ExternalBalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBalanceSnapshot" ADD CONSTRAINT "ExternalBalanceSnapshot_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
