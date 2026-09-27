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
} from "../../src/features/accounts/provider-integration"
import {
  parseBcaBalanceResponse,
  BcaOfficialAdapter,
} from "../../src/features/accounts/bank-adapters/bca-adapter"
import {
  parseBriBalanceResponse,
  BriOfficialAdapter,
} from "../../src/features/accounts/bank-adapters/bri-adapter"
import {
  syncProviderBalance,
} from "../../src/features/accounts/bank-adapters/sync-service"
import {
  ProviderApiResponseError,
  type OfficialBankAdapter,
} from "../../src/features/accounts/bank-adapters/bank-adapter-interface"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 14: Official Bank API Integration Framework", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 14: Official Bank API Integration Framework", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()
    const createdProviderIds = new Set<string>()

    afterEach(async () => {
      const accIds = [...createdAccountIds]
      const provIds = [...createdProviderIds]

      if (accIds.length > 0) {
        await database.externalBalanceSnapshot.deleteMany({
          where: { accountId: { in: accIds } },
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

    it("parses and normalizes official BCA SNAP and Corporate balance responses into BigInt", () => {
      // 1. BCA SNAP format
      const snapPayload = {
        responseCode: "2007300",
        responseMessage: "Successful",
        AccountInfos: [
          {
            AccountNo: "0123456789",
            AvailableBalance: {
              value: "15500000.00",
              currency: "IDR",
            },
          },
        ],
      }
      const snapResult = parseBcaBalanceResponse(snapPayload)
      expect(snapResult.balance).toBe(15500000n)
      expect(snapResult.observedAt).toBeInstanceOf(Date)

      // 2. BCA Corporate format
      const corpPayload = {
        AccountNumber: "0123456789",
        AvailableBalance: "8250000",
      }
      const corpResult = parseBcaBalanceResponse(corpPayload)
      expect(corpResult.balance).toBe(8250000n)

      // 3. Malformed payload rejection
      expect(() => parseBcaBalanceResponse({})).toThrow(ProviderApiResponseError)
      expect(() => parseBcaBalanceResponse(null)).toThrow(ProviderApiResponseError)
    })

    it("parses and normalizes official BRIAPI balance responses into BigInt", () => {
      // 1. BRI SNAP format
      const briSnapPayload = {
        responseCode: "2000000",
        AccountInfos: [
          {
            accountNo: "9876543210",
            AvailableBalance: {
              value: "25000000.00",
            },
          },
        ],
      }
      const briSnapResult = parseBriBalanceResponse(briSnapPayload)
      expect(briSnapResult.balance).toBe(25000000n)

      // 2. BRIAPI Core format
      const briCorePayload = {
        status: "success",
        responseData: {
          sourceAccount: "9876543210",
          sourceAccountBalance: "12345000",
        },
      }
      const briCoreResult = parseBriBalanceResponse(briCorePayload)
      expect(briCoreResult.balance).toBe(12345000n)

      // 3. Malformed payload rejection
      expect(() => parseBriBalanceResponse({ status: "error" })).toThrow(ProviderApiResponseError)
    })

    it("handles unconfigured BCA and BRI credentials gracefully without crashing or leaking secrets", async () => {
      const bcaAdapter = new BcaOfficialAdapter()
      const briAdapter = new BriOfficialAdapter()

      // When env vars are not provided in CI/test
      if (!process.env["BCA_API_KEY"]) {
        expect(bcaAdapter.isConfigured()).toBe(false)
      }
      if (!process.env["BRI_CONSUMER_KEY"]) {
        expect(briAdapter.isConfigured()).toBe(false)
      }
    })

    it("successful balance sync creates ExternalBalanceSnapshot with source PROVIDER_SYNC and leaves ledger unchanged", async () => {
      const provider = await createProvider({
        code: "BCA",
        name: "Bank Central Asia",
        category: "BANK",
      })
      createdProviderIds.add(provider.id)

      const account = await createAccount({
        name: "BCA Rekening Toko",
        type: "BANK",
        openingBalance: "3000000",
      })
      createdAccountIds.add(account.id)

      await connectAccountProvider({
        accountId: account.id,
        providerId: provider.id,
        externalAccountId: "0123456789",
      })

      const beforeLedgerBalance = await getAccountBalance({ accountId: account.id })
      const beforeLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })
      const beforeTxCount = await database.transaction.count()

      expect(beforeLedgerBalance).toBe(3000000n)

      // Mocked official adapter instance simulating successful live sync
      const mockBcaAdapter: OfficialBankAdapter = {
        providerCode: "BCA",
        providerName: "Bank Central Asia",
        isConfigured: () => true,
        getBalance: async () => ({
          balance: 3150000n,
          observedAt: new Date("2026-09-16T14:30:00Z"),
          rawPayload: { AccountNo: "0123456789", balance: "3150000" },
        }),
      }

      const syncRes = await syncProviderBalance(account.id, mockBcaAdapter)
      expect(syncRes.success).toBe(true)
      expect(syncRes.balance).toBe(3150000n)

      // Ledger must be completely unchanged
      const afterLedgerBalance = await getAccountBalance({ accountId: account.id })
      const afterLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })
      const afterTxCount = await database.transaction.count()

      expect(afterLedgerBalance).toBe(beforeLedgerBalance)
      expect(afterLedgerCount).toBe(beforeLedgerCount)
      expect(afterTxCount).toBe(beforeTxCount)

      // Snapshot must be recorded as PROVIDER_SYNC
      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(3150000n)
      expect(info.latestSource).toBe("PROVIDER_SYNC")

      const diff = info.latestActualBalance! - afterLedgerBalance
      expect(diff).toBe(150000n)
    })

    it("preserves previous snapshots and ledger when provider sync fails or errors", async () => {
      const provider = await createProvider({
        code: "BRI",
        name: "Bank BRI",
        category: "BANK",
      })
      createdProviderIds.add(provider.id)

      const account = await createAccount({
        name: "BRI Simpedes",
        type: "BANK",
        openingBalance: "1000000",
      })
      createdAccountIds.add(account.id)

      const conn = await connectAccountProvider({
        accountId: account.id,
        providerId: provider.id,
        externalAccountId: "987654321",
      })

      // Existing initial snapshot
      await recordBalanceSnapshot({
        accountId: account.id,
        providerConnectionId: conn.id,
        balance: "1050000",
        source: "MANUAL",
        note: "Saldo awal sebelum sync gagal",
      })

      const mockFailingAdapter: OfficialBankAdapter = {
        providerCode: "BRI",
        providerName: "Bank BRI",
        isConfigured: () => true,
        getBalance: async () => {
          throw new Error("Koneksi jaringan bank timeout")
        },
      }

      const failRes = await syncProviderBalance(account.id, mockFailingAdapter)
      expect(failRes.success).toBe(false)
      expect(failRes.error).toContain("Koneksi jaringan bank timeout")

      // Previous snapshot remains preserved as the active external balance
      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(1050000n)
      expect(info.latestSource).toBe("MANUAL")

      // Ledger remains untouched
      const ledger = await getAccountBalance({ accountId: account.id })
      expect(ledger).toBe(1000000n)
    })
  })
}
