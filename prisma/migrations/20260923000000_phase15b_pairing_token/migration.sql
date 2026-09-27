-- AlterTable
ALTER TABLE "LocalBankConnection" ADD COLUMN "pairingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LocalBankConnection_pairingToken_key" ON "LocalBankConnection"("pairingToken");

-- CreateIndex
CREATE INDEX "LocalBankConnection_pairingToken_idx" ON "LocalBankConnection"("pairingToken");
