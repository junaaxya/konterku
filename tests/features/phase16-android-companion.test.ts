import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import { getAccountIntegrationInfo } from "../../src/features/accounts/provider-integration"
import {
  connectLocalBank,
  getLocalBankConnection,
  ingestMobileBridgeBalance,
} from "../../src/features/accounts/local-bank-connectors/connector-service"
import { getDatabase } from "../../src/lib/db"
import { formatRupiah } from "../../src/lib/money"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 16: KONTERKU Companion Android Foundation", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 16: KONTERKU Companion Android Foundation", () => {
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

    it("ingests normalized balance payload from Android companion and creates ExternalBalanceSnapshot", async () => {
      const account = await createAccount({
        name: "Bank Mandiri Companion",
        type: "BANK",
        openingBalance: "3500000",
      })
      createdAccountIds.add(account.id)

      const conn = await connectLocalBank({
        accountId: account.id,
        providerCode: "MANDIRI",
      })

      const beforeLedger = await getAccountBalance({ accountId: account.id })
      const beforeLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })
      const beforeTxCount = await database.transaction.count()

      const payload = {
        accountId: account.id,
        providerCode: "MANDIRI",
        accountIdentifier: "1400012345678",
        balance: "3850000",
        observedAt: new Date("2026-09-16T16:00:00Z"),
        bridgeMetadata: {
          clientDevice: "Google Pixel 8",
          clientType: "KONTERKU_COMPANION_ANDROID",
        },
      }

      const result = await ingestMobileBridgeBalance(payload, `Bearer ${conn.pairingToken}`)

      expect(result.success).toBe(true)
      expect(result.balance).toBe(3850000n)
      expect(result.snapshotId).toBeDefined()

      // Ledger must NOT be changed
      const afterLedger = await getAccountBalance({ accountId: account.id })
      const afterLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })
      const afterTxCount = await database.transaction.count()

      expect(afterLedger).toBe(beforeLedger)
      expect(afterLedgerCount).toBe(beforeLedgerCount)
      expect(afterTxCount).toBe(beforeTxCount)

      // Verified in external snapshot
      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(3850000n)
      expect(info.latestSource).toBe("LOCAL_SYNC")

      const diff = info.latestActualBalance! - afterLedger
      expect(diff).toBe(350000n)
      expect(formatRupiah(diff)).toBe("Rp 350.000")
    })

    it("rejects invalid balance formats and negative numbers", async () => {
      const account = await createAccount({
        name: "BCA Invalid Test",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(account.id)

      const conn = await connectLocalBank({
        accountId: account.id,
        providerCode: "BCA",
      })

      // 1. Negative balance
      await expect(
        ingestMobileBridgeBalance(
          {
            accountId: account.id,
            providerCode: "BCA",
            accountIdentifier: "0123456789",
            balance: "-50000",
            observedAt: new Date(),
          },
          `Bearer ${conn.pairingToken}`,
        ),
      ).rejects.toThrow()

      // 2. Floating point currency
      await expect(
        ingestMobileBridgeBalance(
          {
            accountId: account.id,
            providerCode: "BCA",
            accountIdentifier: "0123456789",
            balance: "1500000.50",
            observedAt: new Date(),
          },
          `Bearer ${conn.pairingToken}`,
        ),
      ).rejects.toThrow()
    })

    it("enforces pairing token security and rejects unauthorized LAN requests", async () => {
      const account = await createAccount({
        name: "BRI Token Security",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(account.id)

      await connectLocalBank({
        accountId: account.id,
        providerCode: "BRI",
      })

      const payload = {
        accountId: account.id,
        providerCode: "BRI",
        accountIdentifier: "9876543210",
        balance: "2200000",
        observedAt: new Date(),
      }

      // Missing token
      const resNoToken = await ingestMobileBridgeBalance(payload, null)
      expect(resNoToken.success).toBe(false)
      expect(resNoToken.error).toContain("Token pairing tidak valid")

      // Wrong token
      const resWrongToken = await ingestMobileBridgeBalance(payload, "Bearer ktk_invalid_token")
      expect(resWrongToken.success).toBe(false)
      expect(resWrongToken.error).toContain("Token pairing tidak valid")
    })

    it("supports all 5 configured providers in provider registry", async () => {
      const providers = ["BRI", "BCA", "MANDIRI", "BNI", "SEABANK"]

      for (const code of providers) {
        const acc = await createAccount({
          name: `${code} Test Account`,
          type: "BANK",
          openingBalance: "100000",
        })
        createdAccountIds.add(acc.id)

        const conn = await connectLocalBank({
          accountId: acc.id,
          providerCode: code,
        })

        const res = await ingestMobileBridgeBalance(
          {
            accountId: acc.id,
            providerCode: code,
            accountIdentifier: `ACC-${code}-001`,
            balance: "150000",
            observedAt: new Date(),
          },
          `Bearer ${conn.pairingToken}`,
        )

        expect(res.success).toBe(true)
        expect(res.balance).toBe(150000n)
      }
    })

    it("does not store any credentials or tokens in metadata", async () => {
      const account = await createAccount({
        name: "SeaBank Safety Check",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(account.id)

      const conn = await connectLocalBank({
        accountId: account.id,
        providerCode: "SEABANK",
      })

      await ingestMobileBridgeBalance(
        {
          accountId: account.id,
          providerCode: "SEABANK",
          accountIdentifier: "SEA-999000",
          balance: "750000",
          observedAt: new Date(),
          bridgeMetadata: {
            appVersion: "1.0.0",
          },
        },
        `Bearer ${conn.pairingToken}`,
      )

      const loaded = await getLocalBankConnection(account.id)
      const meta = loaded?.metadata as Record<string, unknown>

      expect(meta["password"]).toBeUndefined()
      expect(meta["pin"]).toBeUndefined()
      expect(meta["otp"]).toBeUndefined()
      expect(meta["cookie"]).toBeUndefined()
      expect(meta["token"]).toBeUndefined()
    })
  })
}
