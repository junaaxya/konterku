import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
  listAccounts,
  AccountNotFoundError,
} from "../../src/features/accounts/account-ledger"
import { getAccountIntegrationInfo } from "../../src/features/accounts/provider-integration"
import {
  generatePairingToken,
  regeneratePairingToken,
  getLocalBankConnection,
  ingestMobileBridgeBalance,
} from "../../src/features/accounts/local-bank-connectors/connector-service"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Pairing Token & Account ID UX Flow", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Pairing Token & Account ID UX Flow", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()

    afterEach(async () => {
      const accIds = [...createdAccountIds]

      if (accIds.length > 0) {
        await database.externalBalanceSnapshot.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.localBankConnection.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.ledgerEntry.deleteMany({
          where: { accountId: { in: accIds } },
        })
        await database.account.deleteMany({
          where: { id: { in: accIds } },
        })
        createdAccountIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("validates account ID existence and rejects invalid format or non-existent accounts", async () => {
      await expect(regeneratePairingToken("invalid-id-format")).rejects.toThrow()

      await expect(
        regeneratePairingToken("cmu9999999999999999999999"),
      ).rejects.toThrow(AccountNotFoundError)
    })

    it("generates pairing token with expected ktk_ prefix format", () => {
      const token1 = generatePairingToken()
      const token2 = generatePairingToken()

      expect(token1).toMatch(/^ktk_[a-f0-9]{32}$/)
      expect(token2).toMatch(/^ktk_[a-f0-9]{32}$/)
      expect(token1).not.toBe(token2)
    })

    it("supports BANK, EWALLET, and QRIS accounts without schema changes", async () => {
      const bank = await createAccount({
        name: "BCA Tabungan Pairing",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(bank.id)

      const ewallet = await createAccount({
        name: "DANA Merchant Pairing",
        type: "EWALLET",
        openingBalance: "500000",
      })
      createdAccountIds.add(ewallet.id)

      const qris = await createAccount({
        name: "QRIS Toko Pairing",
        type: "QRIS",
        openingBalance: "250000",
      })
      createdAccountIds.add(qris.id)

      const bankToken = await regeneratePairingToken(bank.id)
      const ewalletToken = await regeneratePairingToken(ewallet.id)
      const qrisToken = await regeneratePairingToken(qris.id)

      expect(bankToken).toMatch(/^ktk_[a-f0-9]{32}$/)
      expect(ewalletToken).toMatch(/^ktk_[a-f0-9]{32}$/)
      expect(qrisToken).toMatch(/^ktk_[a-f0-9]{32}$/)

      const bankConn = await getLocalBankConnection(bank.id)
      const ewalletConn = await getLocalBankConnection(ewallet.id)
      const qrisConn = await getLocalBankConnection(qris.id)

      expect(bankConn?.pairingToken).toBe(bankToken)
      expect(ewalletConn?.pairingToken).toBe(ewalletToken)
      expect(qrisConn?.pairingToken).toBe(qrisToken)
    })

    it("regeneration invalidates previous token and denies access to old token", async () => {
      const account = await createAccount({
        name: "BCA Invalidation Test",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(account.id)

      const tokenA = await regeneratePairingToken(account.id)

      // Ingest with Token A succeeds
      const successWithA = await ingestMobileBridgeBalance(
        {
          accountId: account.id,
          providerCode: "BCA",
          accountIdentifier: "0123456789",
          balance: "2100000",
          observedAt: new Date(),
        },
        `Bearer ${tokenA}`,
      )
      expect(successWithA.success).toBe(true)

      // Regenerate to Token B
      const tokenB = await regeneratePairingToken(account.id)
      expect(tokenB).not.toBe(tokenA)

      // Old Token A is now rejected
      const failWithOldA = await ingestMobileBridgeBalance(
        {
          accountId: account.id,
          providerCode: "BCA",
          accountIdentifier: "0123456789",
          balance: "2200000",
          observedAt: new Date(),
        },
        `Bearer ${tokenA}`,
      )
      expect(failWithOldA.success).toBe(false)
      expect(failWithOldA.error).toContain("Token pairing tidak valid")

      // New Token B succeeds
      const successWithB = await ingestMobileBridgeBalance(
        {
          accountId: account.id,
          providerCode: "BCA",
          accountIdentifier: "0123456789",
          balance: "2250000",
          observedAt: new Date(),
        },
        `Bearer ${tokenB}`,
      )
      expect(successWithB.success).toBe(true)
      expect(successWithB.balance).toBe(2250000n)
    })

    it("pairing token is not exposed in normal account list or integration queries", async () => {
      const account = await createAccount({
        name: "BCA Privacy Test",
        type: "BANK",
        openingBalance: "1500000",
      })
      createdAccountIds.add(account.id)

      const secretToken = await regeneratePairingToken(account.id)

      // listAccounts returns Account records without pairingToken
      const allAccounts = await listAccounts()
      const foundAccount = allAccounts.find((a) => a.id === account.id)
      expect(foundAccount).toBeDefined()
      expect((foundAccount as unknown as Record<string, unknown>)["pairingToken"]).toBeUndefined()

      // getAccountIntegrationInfo does not leak pairingToken
      const integration = await getAccountIntegrationInfo(account.id)
      expect(
        (integration as unknown as Record<string, unknown>)["pairingToken"],
      ).toBeUndefined()

      // Verify token is truly secret and not leaked in serialized account object
      const jsonStr = JSON.stringify(foundAccount)
      expect(jsonStr).not.toContain(secretToken)
    })

    it("ingestion preserves LOCAL_SYNC source and strictly leaves LedgerEntry and Transaction untouched", async () => {
      const account = await createAccount({
        name: "EWALLET Non-Mutation Test",
        type: "EWALLET",
        openingBalance: "750000",
      })
      createdAccountIds.add(account.id)

      const token = await regeneratePairingToken(account.id)

      const initialLedger = await getAccountBalance({ accountId: account.id })
      const initialTxCount = await database.transaction.count()
      const initialLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })

      const res = await ingestMobileBridgeBalance(
        {
          accountId: account.id,
          providerCode: "DANA",
          accountIdentifier: "081234567890",
          balance: "850000",
          observedAt: new Date(),
        },
        `Bearer ${token}`,
      )

      expect(res.success).toBe(true)

      // Ledger and Transaction must remain strictly untouched
      const finalLedger = await getAccountBalance({ accountId: account.id })
      const finalTxCount = await database.transaction.count()
      const finalLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })

      expect(finalLedger).toBe(initialLedger)
      expect(finalTxCount).toBe(initialTxCount)
      expect(finalLedgerCount).toBe(initialLedgerCount)

      // Snapshot recorded with LOCAL_SYNC
      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(850000n)
      expect(info.latestSource).toBe("LOCAL_SYNC")
    })
  })
}
