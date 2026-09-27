import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  createAccount,
  getAccountBalance,
} from "../../src/features/accounts/account-ledger"
import { getAccountIntegrationInfo } from "../../src/features/accounts/provider-integration"
import {
  parseBcaWebPortalBalance,
  BcaLocalConnector,
} from "../../src/features/accounts/local-bank-connectors/bca-connector"
import {
  parseBriWebPortalBalance,
  BriLocalConnector,
} from "../../src/features/accounts/local-bank-connectors/bri-connector"
import {
  connectLocalBank,
  syncLocalBankBalance,
  getLocalBankConnection,
  ingestMobileBridgeBalance,
} from "../../src/features/accounts/local-bank-connectors/connector-service"
import {
  BankSessionExpiredError,
  BankStructureChangedError,
} from "../../src/features/accounts/local-bank-connectors/connector-interface"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("Phase 15: Local Bank Balance Connectors", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("Phase 15: Local Bank Balance Connectors", () => {
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

    it("BCA web portal parser extracts exact BigInt balance from sanitized HTML fixtures", () => {
      const sanitizedBcaHtml = `
        <html>
          <body>
            <table class="table-info">
              <tr>
                <td>No. Rekening</td>
                <td>0123456789</td>
              </tr>
              <tr>
                <td>Mata Uang</td>
                <td>IDR</td>
              </tr>
              <tr>
                <td>Saldo Efektif</td>
                <td>IDR 24.500.000,00</td>
              </tr>
            </table>
          </body>
        </html>
      `

      const balance = parseBcaWebPortalBalance(sanitizedBcaHtml)
      expect(balance).toBe(24500000n)

      // Session expired detection
      const expiredHtml = "<html><body>Your session expired. Silakan login kembali.</body></html>"
      expect(() => parseBcaWebPortalBalance(expiredHtml)).toThrow(BankSessionExpiredError)

      // Malformed HTML without balance
      const brokenHtml = "<html><body><div>Halaman Utama Tanpa Tabel Saldo</div></body></html>"
      expect(() => parseBcaWebPortalBalance(brokenHtml)).toThrow(BankStructureChangedError)
    })

    it("BRI web portal parser extracts exact BigInt balance from sanitized HTML fixtures", () => {
      const sanitizedBriHtml = `
        <div class="account-card">
          <span class="acc-num">9876543210</span>
          <span class="saldo-label">Saldo Tersedia:</span>
          <span class="saldo">Rp 18.250.000,00</span>
        </div>
      `

      const balance = parseBriWebPortalBalance(sanitizedBriHtml)
      expect(balance).toBe(18250000n)

      // Session timeout detection
      const timeoutHtml = "<div>Session timeout. Silakan masuk kembali ke IB BRI.</div>"
      expect(() => parseBriWebPortalBalance(timeoutHtml)).toThrow(BankSessionExpiredError)

      // Malformed page structure
      const malformedHtml = "<div>Selamat Datang Nasabah</div>"
      expect(() => parseBriWebPortalBalance(malformedHtml)).toThrow(BankStructureChangedError)
    })

    it("connects account to local bank connection without storing bank passwords or PINs", async () => {
      const account = await createAccount({
        name: "BCA Tabungan Konter",
        type: "BANK",
        openingBalance: "1500000",
      })
      createdAccountIds.add(account.id)

      const connection = await connectLocalBank({
        accountId: account.id,
        providerCode: "BCA",
        metadata: { portalName: "KlikBCA Individu", browserProfile: "local-shop-default" },
      })

      expect(connection.providerCode).toBe("BCA")
      expect(connection.enabled).toBe(true)
      expect(connection.status).toBe("ACTIVE")
      expect(connection.pairingToken).toBeDefined()
      expect(connection.pairingToken?.startsWith("ktk_")).toBe(true)

      const loaded = await getLocalBankConnection(account.id)
      expect(loaded?.id).toBe(connection.id)
      expect(loaded?.pairingToken).toBe(connection.pairingToken)
      expect(loaded?.metadata).not.toBeNull()
      const meta = loaded?.metadata as Record<string, unknown>
      expect(meta["password"]).toBeUndefined()
      expect(meta["pin"]).toBeUndefined()
    })

    it("enforces pairing token authentication on mobile bridge balance ingestion", async () => {
      const account = await createAccount({
        name: "BCA Auth Security Test",
        type: "BANK",
        openingBalance: "3000000",
      })
      createdAccountIds.add(account.id)

      const connection = await connectLocalBank({
        accountId: account.id,
        providerCode: "BCA",
      })

      const validToken = connection.pairingToken!

      const payload = {
        accountId: account.id,
        providerCode: "BCA",
        accountIdentifier: "0123456789",
        balance: "3500000",
        observedAt: new Date(),
      }

      const unauthResult = await ingestMobileBridgeBalance(payload, "Bearer wrong_token")
      expect(unauthResult.success).toBe(false)
      expect(unauthResult.error).toContain("Token pairing tidak valid")

      const noHeaderResult = await ingestMobileBridgeBalance(payload, null)
      expect(noHeaderResult.success).toBe(false)
      expect(noHeaderResult.error).toContain("Token pairing tidak valid")

      const authResult = await ingestMobileBridgeBalance(payload, `Bearer ${validToken}`)
      expect(authResult.success).toBe(true)
      expect(authResult.balance).toBe(3500000n)
    })

    it("mobile connector payload over LAN ingests normalized balance without exposing credentials", async () => {
      const account = await createAccount({
        name: "BCA Android Bridge",
        type: "BANK",
        openingBalance: "4000000",
      })
      createdAccountIds.add(account.id)

      const beforeLedger = await getAccountBalance({ accountId: account.id })
      expect(beforeLedger).toBe(4000000n)

      const conn = await connectLocalBank({
        accountId: account.id,
        providerCode: "BCA",
      })

      const result = await ingestMobileBridgeBalance(
        {
          accountId: account.id,
          providerCode: "BCA",
          accountIdentifier: "0123456789",
          balance: "4350000",
          observedAt: new Date("2026-09-16T15:00:00Z"),
          bridgeMetadata: {
            clientDevice: "Samsung Galaxy Tab A9",
            clientIp: "192.168.1.105",
          },
        },
        `Bearer ${conn.pairingToken}`,
      )

      expect(result.success).toBe(true)
      expect(result.balance).toBe(4350000n)

      const afterLedger = await getAccountBalance({ accountId: account.id })
      expect(afterLedger).toBe(4000000n)

      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(4350000n)
      expect(info.latestSource).toBe("LOCAL_SYNC")

      const diff = info.latestActualBalance! - afterLedger
      expect(diff).toBe(350000n)

      const loadedConn = await getLocalBankConnection(account.id)
      const meta = loadedConn?.metadata as Record<string, unknown>
      expect(meta["password"]).toBeUndefined()
      expect(meta["cookie"]).toBeUndefined()
      expect(meta["cookies"]).toBeUndefined()
      expect(meta["token"]).toBeUndefined()
    })

    it("sync creates ExternalBalanceSnapshot with LOCAL_SYNC and leaves internal ledger unchanged", async () => {
      const account = await createAccount({
        name: "BRI Bisnis Konter",
        type: "BANK",
        openingBalance: "5000000",
      })
      createdAccountIds.add(account.id)

      await connectLocalBank({
        accountId: account.id,
        providerCode: "BRI",
        metadata: {
          isMockConnected: true,
          mockBalance: "5350000",
        },
      })

      const beforeLedger = await getAccountBalance({ accountId: account.id })
      const beforeLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })
      const beforeTxCount = await database.transaction.count()
      expect(beforeLedger).toBe(5000000n)

      const connector = new BriLocalConnector()
      const syncRes = await syncLocalBankBalance(account.id, connector)

      expect(syncRes.success).toBe(true)
      expect(syncRes.balance).toBe(5350000n)

      // Ledger must remain strictly unchanged
      const afterLedger = await getAccountBalance({ accountId: account.id })
      const afterLedgerCount = await database.ledgerEntry.count({
        where: { accountId: account.id },
      })
      const afterTxCount = await database.transaction.count()

      expect(afterLedger).toBe(beforeLedger)
      expect(afterLedgerCount).toBe(beforeLedgerCount)
      expect(afterTxCount).toBe(beforeTxCount)

      // External snapshot created with source LOCAL_SYNC
      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(5350000n)
      expect(info.latestSource).toBe("LOCAL_SYNC")

      const diff = info.latestActualBalance! - afterLedger
      expect(diff).toBe(350000n)
    })

    it("failed sync preserves previous external snapshot and keeps internal ledger unchanged", async () => {
      const account = await createAccount({
        name: "BCA Gagal Sync Test",
        type: "BANK",
        openingBalance: "2000000",
      })
      createdAccountIds.add(account.id)

      await connectLocalBank({
        accountId: account.id,
        providerCode: "BCA",
        metadata: {
          mockHtml: "<html><body>Session expired. Silakan login kembali.</body></html>",
        },
      })

      // Initial successful snapshot from prior session
      await database.externalBalanceSnapshot.create({
        data: {
          accountId: account.id,
          balance: 2100000n,
          source: "LOCAL_SYNC",
          note: "Saldo kemarin",
          snapshotAt: new Date("2026-09-15T12:00:00Z"),
        },
      })

      const connector = new BcaLocalConnector()
      const failRes = await syncLocalBankBalance(account.id, connector)

      expect(failRes.success).toBe(false)
      expect(failRes.error).toContain("Sesi web portal bank di perangkat Android telah berakhir")

      // Prior snapshot remains preserved
      const info = await getAccountIntegrationInfo(account.id)
      expect(info.latestActualBalance).toBe(2100000n)
      expect(info.latestSource).toBe("LOCAL_SYNC")

      // Ledger balance remains untouched
      const ledger = await getAccountBalance({ accountId: account.id })
      expect(ledger).toBe(2000000n)

      // Connection status updated to INACTIVE upon session expiry
      const conn = await getLocalBankConnection(account.id)
      expect(conn?.status).toBe("INACTIVE")
    })
  })
}
