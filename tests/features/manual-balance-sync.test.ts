import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  recordBalanceSnapshot,
  getAccountIntegrationInfo,
  listBalanceSnapshots,
} from "../../src/features/accounts/provider-integration"
import { getDatabase } from "../../src/lib/db"
import { formatRupiah } from "../../src/lib/money"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Manual External Balance Sync UX", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Manual External Balance Sync UX", () => {
    const database = getDatabase()
    const createdAccountIds = new Set<string>()

    afterEach(async () => {
      const accIds = [...createdAccountIds]

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
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("saving manual balance creates snapshot with source MANUAL and leaves ledger unchanged", async () => {
      const bca = await createAccount({
        name: "BCA Tabungan Operasional",
        type: "BANK",
        openingBalance: "2500000",
      })
      createdAccountIds.add(bca.id)

      const initialLedger = await getAccountBalance({ accountId: bca.id })
      const initialTxCount = await database.transaction.count()
      const initialLedgerCount = await database.ledgerEntry.count({
        where: { accountId: bca.id },
      })

      expect(initialLedger).toBe(2500000n)

      // Record manual balance from m-Banking
      const snapshot = await recordBalanceSnapshot({
        accountId: bca.id,
        balance: "2650000",
        source: "MANUAL",
        note: "Dicek langsung di aplikasi myBCA",
        snapshotAt: new Date("2026-09-16T14:15:00Z"),
      })

      expect(snapshot.balance).toBe(2650000n)
      expect(snapshot.source).toBe("MANUAL")
      expect(snapshot.note).toBe("Dicek langsung di aplikasi myBCA")

      // Ledger must be completely untouched
      const finalLedger = await getAccountBalance({ accountId: bca.id })
      const finalTxCount = await database.transaction.count()
      const finalLedgerCount = await database.ledgerEntry.count({
        where: { accountId: bca.id },
      })

      expect(finalLedger).toBe(2500000n)
      expect(finalTxCount).toBe(initialTxCount)
      expect(finalLedgerCount).toBe(initialLedgerCount)

      // Integration info & difference
      const info = await getAccountIntegrationInfo(bca.id)
      expect(info.latestActualBalance).toBe(2650000n)
      expect(info.latestSource).toBe("MANUAL")

      const diff = info.latestActualBalance! - finalLedger
      expect(diff).toBe(150000n)
      expect(formatRupiah(diff)).toBe("Rp 150.000")
    })

    it("preserves previous snapshots and returns the latest snapshot as current external balance", async () => {
      const gopay = await createAccount({
        name: "GoPay Toko",
        type: "EWALLET",
        openingBalance: "500000",
      })
      createdAccountIds.add(gopay.id)

      // Snap 1: morning
      await recordBalanceSnapshot({
        accountId: gopay.id,
        balance: "520000",
        source: "MANUAL",
        snapshotAt: new Date("2026-09-16T08:00:00Z"),
      })

      // Snap 2: afternoon
      await recordBalanceSnapshot({
        accountId: gopay.id,
        balance: "535000",
        source: "MANUAL",
        snapshotAt: new Date("2026-09-16T14:00:00Z"),
      })

      const allSnapshots = await listBalanceSnapshots(gopay.id)
      expect(allSnapshots).toHaveLength(2)
      expect(allSnapshots[0]?.balance).toBe(535000n)
      expect(allSnapshots[1]?.balance).toBe(520000n)

      const latestInfo = await getAccountIntegrationInfo(gopay.id)
      expect(latestInfo.latestActualBalance).toBe(535000n)
    })

    it("works for BANK, EWALLET, and QRIS accounts and rejects invalid amounts", async () => {
      const qris = await createAccount({
        name: "QRIS Dinamis Toko",
        type: "QRIS",
        openingBalance: "100000",
      })
      createdAccountIds.add(qris.id)

      const snapQris = await recordBalanceSnapshot({
        accountId: qris.id,
        balance: "125000",
        source: "MANUAL",
      })
      expect(snapQris.balance).toBe(125000n)

      // Empty / invalid amount rejection
      await expect(
        recordBalanceSnapshot({
          accountId: qris.id,
          balance: "abc",
          source: "MANUAL",
        }),
      ).rejects.toThrow()

      await expect(
        recordBalanceSnapshot({
          accountId: qris.id,
          balance: "-5000",
          source: "MANUAL",
        }),
      ).rejects.toThrow()
    })
  })
}
