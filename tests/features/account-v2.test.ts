import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  createProvider,
  connectAccountProvider,
  recordBalanceSnapshot,
  getAccountIntegrationInfo,
  listBalanceSnapshots,
} from "../../src/features/accounts/provider-integration"
import { getDatabase } from "../../src/lib/db"
import { formatRupiah } from "../../src/lib/money"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Account V2 foundation", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Account V2 foundation", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdProviderIds = new Set<string>()

    afterEach(async () => {
      const accIds = [...createdAccountIds]
      const provIds = [...createdProviderIds]

      if (accIds.length > 0) {
        await database.externalBalanceSnapshot.deleteMany({
          where: { providerConnection: { accountId: { in: accIds } } },
        })
        await database.providerConnection.deleteMany({
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

      if (provIds.length > 0) {
        await database.provider.deleteMany({
          where: { id: { in: provIds } },
        })
        createdProviderIds.clear()
      }
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("account without provider still works with pure ledger balance", async () => {
      const account = await createAccount({
        name: "Kas Mandiri Tanpa Provider",
        type: "CASH",
        openingBalance: "150000",
      })
      createdAccountIds.add(account.id)

      const balance = await getAccountBalance({ accountId: account.id })
      expect(balance).toBe(150000n)

      const integration = await getAccountIntegrationInfo(account.id)
      expect(integration.isConnected).toBe(false)
      expect(integration.providerCode).toBeUndefined()
      expect(integration.latestActualBalance).toBeNull()
    })

    it("connected account stores provider metadata and preserves ledger source of truth", async () => {
      const provider = await createProvider({
        code: "BCA_TEST",
        name: "Bank Central Asia",
        category: "BANK",
      })
      createdProviderIds.add(provider.id)

      const account = await createAccount({
        name: "BCA Operasional",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(account.id)

      const connection = await connectAccountProvider({
        accountId: account.id,
        providerId: provider.id,
        externalAccountId: "1234567890",
        metadata: { accountHolder: "Budi Santoso", branch: "Jakarta" },
      })

      expect(connection.externalAccountId).toBe("1234567890")
      expect(connection.status).toBe("ACTIVE")

      const internalBalance = await getAccountBalance({ accountId: account.id })
      expect(internalBalance).toBe(500000n)

      const integration = await getAccountIntegrationInfo(account.id)
      expect(integration.isConnected).toBe(true)
      expect(integration.providerCode).toBe("BCA_TEST")
      expect(integration.providerName).toBe("Bank Central Asia")
      expect(integration.externalAccountId).toBe("1234567890")
      expect(integration.latestActualBalance).toBeNull()
    })

    it("multiple balance snapshots preserve history and latest snapshot can be retrieved", async () => {
      const provider = await createProvider({
        code: "BRI_TEST",
        name: "Bank Rakyat Indonesia",
        category: "BANK",
      })
      createdProviderIds.add(provider.id)

      const account = await createAccount({
        name: "BRI Toko",
        type: "BANK",
        openingBalance: "100000",
      })
      createdAccountIds.add(account.id)

      const connection = await connectAccountProvider({
        accountId: account.id,
        providerId: provider.id,
        externalAccountId: "987654321",
      })

      const snap1 = await recordBalanceSnapshot({
        providerConnectionId: connection.id,
        balance: "105000",
        snapshotAt: new Date("2026-09-16T10:00:00Z"),
      })

      const snap2 = await recordBalanceSnapshot({
        providerConnectionId: connection.id,
        balance: "120000",
        snapshotAt: new Date("2026-09-16T12:00:00Z"),
      })

      expect(snap1.balance).toBe(105000n)
      expect(snap2.balance).toBe(120000n)

      const snapshots = await listBalanceSnapshots(connection.id)
      expect(snapshots).toHaveLength(2)
      expect(snapshots[0]?.balance).toBe(120000n)
      expect(snapshots[1]?.balance).toBe(105000n)

      const integration = await getAccountIntegrationInfo(account.id)
      expect(integration.latestActualBalance).toBe(120000n)
      expect(formatRupiah(integration.latestActualBalance!)).toBe("Rp 120.000")
    })

    it("provider integration cannot change ledger balance automatically", async () => {
      const provider = await createProvider({
        code: "DANA_TEST",
        name: "DANA E-Wallet",
        category: "EWALLET",
      })
      createdProviderIds.add(provider.id)

      const account = await createAccount({
        name: "DANA Kasir",
        type: "EWALLET",
        openingBalance: "300000",
      })
      createdAccountIds.add(account.id)

      const connection = await connectAccountProvider({
        accountId: account.id,
        providerId: provider.id,
        externalAccountId: "08123456789",
      })

      await recordBalanceSnapshot({
        providerConnectionId: connection.id,
        balance: "999999999",
      })

      const ledgerBalance = await getAccountBalance({ accountId: account.id })
      expect(ledgerBalance).toBe(300000n)

      const integration = await getAccountIntegrationInfo(account.id)
      expect(integration.latestActualBalance).toBe(999999999n)
      expect(ledgerBalance).not.toBe(integration.latestActualBalance)
    })
  })
}
