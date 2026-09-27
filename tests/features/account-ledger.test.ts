import { afterAll, afterEach, describe, expect, it } from "vitest"

import {
  AccountNotFoundError,
  InactiveAccountError,
  createAccount,
  getAccountBalance,
  getAccountById,
  listAccountLedgerEntries,
  listAccounts,
  recordLedgerEntry,
  renameAccount,
  setAccountActive,
} from "../../src/features/accounts/account-ledger"
import { getDatabase } from "../../src/lib/db"

const databaseUrl = process.env["DATABASE_URL"]

if (databaseUrl === undefined) {
  describe.skip("account ledger database commands", () => {
    it("requires DATABASE_URL", () => {})
  })
} else {
  describe("account ledger database commands", () => {
    const database = getDatabase()
    const openedAt = new Date("2026-09-14T10:00:00.000Z")
    const accountTypes = ["CASH", "BANK", "EWALLET", "QRIS", "OTHER"] as const
    const createdAccountIds = new Set<string>()

    async function createTestAccount(input: unknown) {
      const account = await createAccount(input)
      createdAccountIds.add(account.id)
      return account
    }

    afterEach(async () => {
      const accountIds = [...createdAccountIds]
      await database.ledgerEntry.deleteMany({ where: { accountId: { in: accountIds } } })
      await database.account.deleteMany({ where: { id: { in: accountIds } } })
      createdAccountIds.clear()
    })

    afterAll(async () => {
      await database.$disconnect()
    })

    it("creates an active account and Saldo awal IN entry for a positive opening balance", async () => {
      // Given: a valid cash account with an opening balance.
      const input = {
        name: "Kas Utama",
        type: "CASH",
        openingBalance: "125000",
        occurredAt: openedAt,
      }

      // When: account creation runs.
      const account = await createTestAccount(input)

      // Then: account and opening ledger entry persist together.
      expect(account).toMatchObject({ name: "Kas Utama", type: "CASH", isActive: true })
      await expect(
        database.ledgerEntry.findMany({ where: { accountId: account.id } }),
      ).resolves.toEqual([
        expect.objectContaining({
          accountId: account.id,
          direction: "IN",
          amount: 125_000n,
          description: "Saldo awal",
          occurredAt: openedAt,
        }),
      ])
      await expect(getAccountBalance({ accountId: account.id })).resolves.toBe(125_000n)
    })

    it("creates no opening entry when opening balance is zero", async () => {
      // Given: an account with no opening balance.
      const input = { name: "BCA", type: "BANK" }

      // When: account creation runs.
      const account = await createTestAccount(input)

      // Then: zero balance comes only from an empty ledger history.
      await expect(
        database.ledgerEntry.count({ where: { accountId: account.id } }),
      ).resolves.toBe(0)
      await expect(getAccountBalance({ accountId: account.id })).resolves.toBe(0n)
    })

    it.each(accountTypes)("persists %s as an account type", async (type) => {
      // Given: each supported account type.
      const input = { name: `Akun ${type}`, type, openingBalance: "0" }

      // When: account creation runs.
      const account = await createTestAccount(input)

      // Then: Prisma enum value persists unchanged.
      expect(account.type).toBe(type)
    })

    it("rejects non-canonical and oversized Rupiah opening balances before persistence", async () => {
      // Given: invalid Rupiah opening balances.
      const negativeInput = { name: "DANA", type: "EWALLET", openingBalance: "-1" }
      const fractionalInput = { name: "QRIS Toko", type: "QRIS", openingBalance: "1.5" }
      const leadingZeroInput = { name: "Kas Cadangan", type: "CASH", openingBalance: "01" }
      const numericInput = { name: "Kas Angka", type: "CASH", openingBalance: 1 }
      const oversizedInput = {
        name: "Kas Terlalu Besar",
        type: "CASH",
        openingBalance: "9223372036854775808",
      }

      // When / Then: boundary parsing rejects every invalid value.
      await expect(createAccount(negativeInput)).rejects.toThrow()
      await expect(createAccount(fractionalInput)).rejects.toThrow()
      await expect(createAccount(leadingZeroInput)).rejects.toThrow()
      await expect(createAccount(numericInput)).rejects.toThrow()
      await expect(createAccount(oversizedInput)).rejects.toThrow()
    })

    it("derives balance from IN and OUT ledger sums", async () => {
      // Given: an active account with no opening entry.
      const account = await createTestAccount({ name: "BRI", type: "BANK", openingBalance: "0" })

      // When: ledger movements are recorded.
      await recordLedgerEntry({
        accountId: account.id,
        direction: "IN",
        amount: "90000",
        description: "Setoran",
        occurredAt: openedAt,
      })
      await recordLedgerEntry({
        accountId: account.id,
        direction: "OUT",
        amount: "25000",
        description: "Pengambilan",
        occurredAt: openedAt,
      })

      // Then: balance is IN minus OUT from ledger history.
      await expect(getAccountBalance({ accountId: account.id })).resolves.toBe(65_000n)
    })

    it("derives an exact bigint balance above PostgreSQL INTEGER range", async () => {
      // Given: an amount beyond JavaScript's safe number range and PostgreSQL INTEGER range.
      const account = await createTestAccount({
        name: "Kas Nilai Besar",
        type: "CASH",
        openingBalance: "9007199254740993",
      })

      // When: one Rupiah leaves the account.
      await recordLedgerEntry({
        accountId: account.id,
        direction: "OUT",
        amount: "1",
        description: "Pengambilan satu Rupiah",
      })

      // Then: balance retains every Rupiah exactly.
      await expect(getAccountBalance({ accountId: account.id })).resolves.toBe(9_007_199_254_740_992n)
    })

    it("accepts PostgreSQL signed BIGINT maximum as a ledger movement", async () => {
      // Given: an active account with no opening ledger entry.
      const account = await createTestAccount({ name: "Kas Maksimum", type: "CASH", openingBalance: "0" })

      // When: the largest supported positive Rupiah amount is recorded.
      await expect(
        recordLedgerEntry({
          accountId: account.id,
          direction: "IN",
          amount: "9223372036854775807",
          description: "Nilai maksimum",
        }),
      ).resolves.toMatchObject({ amount: 9_223_372_036_854_775_807n })

      // Then: the exact maximum is retained in ledger-derived balance.
      await expect(getAccountBalance({ accountId: account.id })).resolves.toBe(9_223_372_036_854_775_807n)
    })

    it("rejects non-canonical, non-positive, oversized, and invalid-direction ledger entries", async () => {
      // Given: an active account and malformed account-moving inputs.
      const account = await createTestAccount({ name: "Mandiri", type: "BANK", openingBalance: "0" })
      const invalidInputs = [
        { direction: "IN", amount: "0", description: "Nol" },
        { direction: "OUT", amount: "1.5", description: "Pecahan" },
        { direction: "OUT", amount: "01", description: "Nol depan" },
        { direction: "OUT", amount: 1n, description: "BigInt mentah" },
        { direction: "OUT", amount: "9223372036854775808", description: "Terlalu besar" },
        { direction: "SIDEWAYS", amount: "1000", description: "Arah salah" },
      ] as const

      // When / Then: Zod rejects every non-ledger movement before persistence.
      for (const input of invalidInputs) {
        await expect(recordLedgerEntry({ accountId: account.id, ...input })).rejects.toThrow()
      }
      await expect(
        database.ledgerEntry.count({ where: { accountId: account.id } }),
      ).resolves.toBe(0)
    })

    it("returns account history by newest occurrence first", async () => {
      // Given: two dated account movements.
      const account = await createTestAccount({ name: "QRIS Toko", type: "QRIS", openingBalance: "0" })
      await recordLedgerEntry({
        accountId: account.id,
        direction: "IN",
        amount: "10000",
        description: "Lebih lama",
        occurredAt: new Date("2026-09-14T09:00:00.000Z"),
      })
      await recordLedgerEntry({
        accountId: account.id,
        direction: "OUT",
        amount: "2000",
        description: "Lebih baru",
        occurredAt: new Date("2026-09-14T11:00:00.000Z"),
      })

      // When: account ledger history is queried.
      const entries = await listAccountLedgerEntries({ accountId: account.id })

      // Then: newest movement leads history.
      expect(entries.map((entry) => entry.description)).toEqual(["Lebih baru", "Lebih lama"])
    })

    it("keeps inactive accounts queryable but blocks new ledger movements", async () => {
      // Given: an account with ledger history.
      const account = await createTestAccount({ name: "GoPay", type: "EWALLET", openingBalance: "10000" })
      await renameAccount({ accountId: account.id, name: "GoPay Merchant" })
      await setAccountActive({ accountId: account.id, isActive: false })

      // When: inactive account is queried and receives a new movement request.
      const queriedAccount = await getAccountById({ accountId: account.id })
      const accounts = await listAccounts({})
      const activeAccounts = await listAccounts({ activeOnly: true })
      const entries = await listAccountLedgerEntries({ accountId: account.id })

      // Then: history remains available, but movement is rejected without a new entry.
      expect(queriedAccount).toMatchObject({ name: "GoPay Merchant", isActive: false })
      expect(accounts).toContainEqual(expect.objectContaining({ id: account.id, isActive: false }))
      expect(activeAccounts).not.toContainEqual(expect.objectContaining({ id: account.id }))
      expect(entries).toHaveLength(1)
      await expect(
        recordLedgerEntry({
          accountId: account.id,
          direction: "IN",
          amount: "1000",
          description: "Tidak boleh tercatat",
        }),
      ).rejects.toBeInstanceOf(InactiveAccountError)
      await expect(
        database.ledgerEntry.count({ where: { accountId: account.id } }),
      ).resolves.toBe(1)

      await setAccountActive({ accountId: account.id, isActive: true })
      await expect(
        recordLedgerEntry({
          accountId: account.id,
          direction: "IN",
          amount: "1000",
          description: "Akun aktif kembali",
        }),
      ).resolves.toEqual(expect.objectContaining({ accountId: account.id }))
    })

    it("restricts deletion of an account with ledger history", async () => {
      // Given: an account whose opening balance created ledger history.
      const account = await createTestAccount({
        name: "Kas Terkunci",
        type: "CASH",
        openingBalance: "1000",
      })

      // When / Then: database history protection rejects account deletion.
      await expect(database.account.delete({ where: { id: account.id } })).rejects.toThrow()
    })

    it("rejects a movement for an unknown account", async () => {
      // Given: a valid-shaped account ID without a database row.
      const missingAccountId = "cmf0000000000000000000000"

      // When / Then: no account-moving command accepts it.
      await expect(
        recordLedgerEntry({
          accountId: missingAccountId,
          direction: "OUT",
          amount: "1000",
          description: "Akun tidak ada",
        }),
      ).rejects.toBeInstanceOf(AccountNotFoundError)
      await expect(
        database.ledgerEntry.count({ where: { accountId: missingAccountId } }),
      ).resolves.toBe(0)
    })
  })
}
