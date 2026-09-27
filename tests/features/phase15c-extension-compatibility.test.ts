import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import { parseBcaWebPortalBalance } from "../../src/features/accounts/local-bank-connectors/bca-connector"
import { parseBriWebPortalBalance } from "../../src/features/accounts/local-bank-connectors/bri-connector"
import {
  BankSessionExpiredError,
  BankStructureChangedError,
} from "../../src/features/accounts/local-bank-connectors/connector-interface"

describe("Phase 15C: Firefox Android Bank Connector Extension Validation", () => {
  const extensionDir = path.resolve(__dirname, "../../extension-android-bank")

  it("manifest.json has required Firefox Android browser_specific_settings and scoped permissions", () => {
    const manifestPath = path.join(extensionDir, "manifest.json")
    expect(fs.existsSync(manifestPath)).toBe(true)

    const raw = fs.readFileSync(manifestPath, "utf-8")
    const manifest = JSON.parse(raw)

    expect(manifest.manifest_version).toBe(2)
    expect(manifest.browser_specific_settings?.gecko?.id).toBe("bank-connector@konterku.local")
    expect(manifest.browser_specific_settings?.gecko_android?.strict_min_version).toBe("115.0")

    // Must NOT have wildcard <all_urls> or arbitrary http
    expect(manifest.permissions).not.toContain("<all_urls>")
    expect(manifest.permissions).not.toContain("http://*/*")
    expect(manifest.permissions).not.toContain("https://*/*")

    // Must strictly include BCA, BRI, and private LAN ranges
    expect(manifest.permissions).toContain("https://*.klikbca.com/*")
    expect(manifest.permissions).toContain("https://*.bri.co.id/*")
    expect(manifest.permissions).toContain("http://192.168.*.*/*")

    // Content scripts only match bank domains
    const contentMatches = manifest.content_scripts?.[0]?.matches || []
    expect(contentMatches).toContain("https://*.klikbca.com/*")
    expect(contentMatches).toContain("https://*.bri.co.id/*")
    expect(contentMatches).not.toContain("http://*/*")
  })

  it("extracts exact BCA balance from sanitized KlikBCA mobile portal HTML fixture", () => {
    const sanitizedHtml = `
      <div class="main-content">
        <h2>Informasi Saldo Rekening</h2>
        <table border="1" cellpadding="4">
          <tr><th>No. Rekening</th><th>Mata Uang</th><th>Saldo Efektif</th></tr>
          <tr><td>0123456789</td><td>IDR</td><td>27.850.000,00</td></tr>
        </table>
      </div>
    `
    const balance = parseBcaWebPortalBalance(sanitizedHtml)
    expect(balance).toBe(27850000n)
  })

  it("extracts exact BRI balance from sanitized IB BRI portal HTML fixture", () => {
    const sanitizedHtml = `
      <div class="card-body">
        <h3>Daftar Rekening</h3>
        <p>Nomor Rekening: 987654321012345</p>
        <div class="balance-info">
          <span>Saldo Tersedia:</span>
          <strong>Rp 14.120.000,00</strong>
        </div>
      </div>
    `
    const balance = parseBriWebPortalBalance(sanitizedHtml)
    expect(balance).toBe(14120000n)
  })

  it("safely rejects session expiration and malformed structures without guessing", () => {
    const expiredBca = "<div>Sesi Anda Telah Berakhir. Silakan Login Kembali.</div>"
    expect(() => parseBcaWebPortalBalance(expiredBca)).toThrow(BankSessionExpiredError)

    const malformedBca = "<div>Tidak ada tabel saldo disini</div>"
    expect(() => parseBcaWebPortalBalance(malformedBca)).toThrow(BankStructureChangedError)

    const expiredBri = "<div>Session timeout. Silakan masuk kembali ke akun BRI Anda.</div>"
    expect(() => parseBriWebPortalBalance(expiredBri)).toThrow(BankSessionExpiredError)

    const malformedBri = "<div>Halaman beranda promosi bank</div>"
    expect(() => parseBriWebPortalBalance(malformedBri)).toThrow(BankStructureChangedError)
  })
})
