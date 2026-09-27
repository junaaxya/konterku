import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import {
  recordBalanceSnapshot,
  getAccountIntegrationInfo,
  createProvider,
  connectAccountProvider,
} from "../../src/features/accounts/provider-integration"
import { parseStatementCsv } from "../../src/features/accounts/statement-parser"
import { getDatabase } from "../../src/lib/db"
import { formatRupiah } from "../../src/lib/money"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 12: External Balance Sources (Manual & CSV)", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 12: External Balance Sources (Manual & CSV)", () => {
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

    it("manual snapshot records external balance without altering ledger or creating transactions", async () => {
      const bank = await createAccount({
        name: "Bank Mandiri Manual Test",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(bank.id)

      const initialLedgerCount = await database.ledgerEntry.count({
        where: { accountId: bank.id },
      })
      const initialTxCount = await database.transaction.count()

      const snapshot = await recordBalanceSnapshot({
        accountId: bank.id,
        balance: "2150000",
        source: "MANUAL",
        note: "Dicek langsung dari aplikasi Livin",
      })

      expect(snapshot.balance).toBe(2150000n)
      expect(snapshot.source).toBe("MANUAL")
      expect(snapshot.note).toBe("Dicek langsung dari aplikasi Livin")

      // Invariants
      const currentLedgerCount = await database.ledgerEntry.count({
        where: { accountId: bank.id },
      })
      const currentTxCount = await database.transaction.count()
      const bookBalance = await getAccountBalance({ accountId: bank.id })

      expect(currentLedgerCount).toBe(initialLedgerCount)
      expect(currentTxCount).toBe(initialTxCount)
      expect(bookBalance).toBe(2000000n)

      const integration = await getAccountIntegrationInfo(bank.id)
      expect(integration.latestActualBalance).toBe(2150000n)
      expect(integration.latestSource).toBe("MANUAL")

      const diff = integration.latestActualBalance! - bookBalance
      expect(diff).toBe(150000n)
      expect(formatRupiah(diff)).toBe("Rp 150.000")
    })

    it("csv statement parsing detects running balance and rejects malformed rows", () => {
      const validCsv = `Tanggal,Keterangan,Mutasi,Tipe,Saldo
2026-09-15,Transfer Masuk,500000,CR,1500000
2026-09-16,Beli Pulsa,50000,DB,1450000
`
      const res = parseStatementCsv(validCsv)
      expect(res.success).toBe(true)
      expect(res.rows).toHaveLength(2)
      expect(res.detectedBalance).toBe(1450000n)
      expect(res.errors).toHaveLength(0)

      // Malformed / incomplete CSV
      const malformedCsv = `Nama,Alamat\nBudi,Jakarta`
      const badRes = parseStatementCsv(malformedCsv)
      expect(badRes.success).toBe(false)
      expect(badRes.errors[0]).toContain("Format kolom CSV tidak dikenali")

      // Empty CSV
      const emptyRes = parseStatementCsv("")
      expect(emptyRes.success).toBe(false)
    })

    it("imported snapshot from CSV does not create ledger entries or change book balance", async () => {
      const ewallet = await createAccount({
        name: "GoPay CSV Import",
        type: "EWALLET",
        openingBalance: "300000",
      })
      createdAccountIds.add(ewallet.id)

      const initialLedger = await getAccountBalance({ accountId: ewallet.id })
      expect(initialLedger).toBe(300000n)

      const csvData = `Tanggal;Keterangan;Nominal;Tipe;Saldo
16/09/2026;Top Up via BCA;200000;IN;500000
16/09/2026;Bayar Merchant;25000;OUT;475000
`
      const parseRes = parseStatementCsv(csvData)
      expect(parseRes.success).toBe(true)
      expect(parseRes.detectedBalance).toBe(475000n)

      const snapshot = await recordBalanceSnapshot({
        accountId: ewallet.id,
        balance: parseRes.detectedBalance!.toString(),
        source: "IMPORT",
        note: `Import CSV ${parseRes.rows.length} baris`,
      })

      expect(snapshot.balance).toBe(475000n)
      expect(snapshot.source).toBe("IMPORT")

      // Book balance must remain strictly ledger-derived
      const finalLedger = await getAccountBalance({ accountId: ewallet.id })
      expect(finalLedger).toBe(300000n)

      const info = await getAccountIntegrationInfo(ewallet.id)
      expect(info.latestActualBalance).toBe(475000n)
      expect(info.latestSource).toBe("IMPORT")
    })

    it("supports connected provider accounts as well as unconnected accounts", async () => {
      // Unconnected account
      const unconnected = await createAccount({
        name: "BCA Mandiri Non-Provider",
        type: "BANK",
        openingBalance: "100000",
      })
      createdAccountIds.add(unconnected.id)

      await recordBalanceSnapshot({
        accountId: unconnected.id,
        balance: "110000",
        source: "MANUAL",
      })

      const infoUnconnected = await getAccountIntegrationInfo(unconnected.id)
      expect(infoUnconnected.isConnected).toBe(false)
      expect(infoUnconnected.latestActualBalance).toBe(110000n)

      // Connected account
      const prov = await createProvider({
        code: "BRI_P12",
        name: "Bank BRI P12",
        category: "BANK",
      })
      createdProviderIds.add(prov.id)

      const connected = await createAccount({
        name: "BRI Terhubung P12",
        type: "BANK",
        openingBalance: "500000",
      })
      createdAccountIds.add(connected.id)

      const conn = await connectAccountProvider({
        accountId: connected.id,
        providerId: prov.id,
        externalAccountId: "0123456789",
      })

      await recordBalanceSnapshot({
        accountId: connected.id,
        providerConnectionId: conn.id,
        balance: "520000",
        source: "MANUAL",
      })

      const infoConnected = await getAccountIntegrationInfo(connected.id)
      expect(infoConnected.isConnected).toBe(true)
      expect(infoConnected.providerCode).toBe("BRI_P12")
      expect(infoConnected.latestActualBalance).toBe(520000n)
    })
  })
}
