import { describe, expect, it } from "vitest"
import { isNavActive, type NavItemKey } from "../../src/components/navigation"

describe("Navigation active route matching", () => {
  const allKeys: NavItemKey[] = ["dashboard", "transaksi", "riwayat", "laporan", "akun"]

  function getActiveKeys(pathname: string): NavItemKey[] {
    return allKeys.filter((key) => isNavActive(key, pathname))
  }

  it("activates only Transaksi on /transactions/new and never Riwayat", () => {
    expect(isNavActive("transaksi", "/transactions/new")).toBe(true)
    expect(isNavActive("riwayat", "/transactions/new")).toBe(false)
    expect(getActiveKeys("/transactions/new")).toEqual(["transaksi"])
  })

  it("activates only Transaksi on /transactions/income and /transactions/expense", () => {
    expect(isNavActive("transaksi", "/transactions/income")).toBe(true)
    expect(isNavActive("riwayat", "/transactions/income")).toBe(false)
    expect(getActiveKeys("/transactions/income")).toEqual(["transaksi"])

    expect(isNavActive("transaksi", "/transactions/expense")).toBe(true)
    expect(isNavActive("riwayat", "/transactions/expense")).toBe(false)
    expect(getActiveKeys("/transactions/expense")).toEqual(["transaksi"])
  })

  it("activates only Riwayat on /transactions list route", () => {
    expect(isNavActive("riwayat", "/transactions")).toBe(true)
    expect(isNavActive("transaksi", "/transactions")).toBe(false)
    expect(getActiveKeys("/transactions")).toEqual(["riwayat"])
  })

  it("activates only Riwayat on transaction detail and receipt routes", () => {
    const detailRoute = "/transactions/cmu3oswdf000001o416cn4cee"
    expect(isNavActive("riwayat", detailRoute)).toBe(true)
    expect(isNavActive("transaksi", detailRoute)).toBe(false)
    expect(getActiveKeys(detailRoute)).toEqual(["riwayat"])

    const receiptRoute = "/transactions/cmu3oswdf000001o416cn4cee/receipt"
    expect(isNavActive("riwayat", receiptRoute)).toBe(true)
    expect(isNavActive("transaksi", receiptRoute)).toBe(false)
    expect(getActiveKeys(receiptRoute)).toEqual(["riwayat"])
  })

  it("activates only Dashboard on root /", () => {
    expect(isNavActive("dashboard", "/")).toBe(true)
    expect(getActiveKeys("/")).toEqual(["dashboard"])
  })

  it("activates only Laporan on /reports", () => {
    expect(isNavActive("laporan", "/reports")).toBe(true)
    expect(getActiveKeys("/reports")).toEqual(["laporan"])
  })

  it("activates only Akun on /accounts", () => {
    expect(isNavActive("akun", "/accounts")).toBe(true)
    expect(getActiveKeys("/accounts")).toEqual(["akun"])
  })
})
