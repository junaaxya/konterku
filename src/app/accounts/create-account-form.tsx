"use client"

import { useState } from "react"
import { createAccountAction } from "./actions"

const accountTypeLabels = {
  CASH: "Kas Tunai",
  BANK: "Bank",
  EWALLET: "E-Wallet",
  QRIS: "QRIS",
  OTHER: "Lainnya",
} as const

type AccountType = keyof typeof accountTypeLabels

const BANK_PRESETS = [
  "BCA",
  "BRI",
  "BNI",
  "Mandiri",
  "SeaBank",
  "CIMB Niaga",
  "Permata",
  "BTN",
  "Lainnya",
]

const EWALLET_PRESETS = [
  "DANA",
  "GoPay",
  "OVO",
  "ShopeePay",
  "LinkAja",
  "Lainnya",
]

export function CreateAccountForm() {
  const [type, setType] = useState<AccountType>("CASH")
  const [name, setName] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string>("")

  const handleTypeChange = (newType: AccountType) => {
    setType(newType)
    setSelectedPreset("")
    if (newType === "CASH" && (!name || BANK_PRESETS.includes(name) || EWALLET_PRESETS.includes(name))) {
      setName("Kas Utama")
    } else if (newType === "QRIS" && (!name || BANK_PRESETS.includes(name) || EWALLET_PRESETS.includes(name))) {
      setName("QRIS Toko")
    }
  }

  const handlePresetClick = (preset: string) => {
    setSelectedPreset(preset)
    if (preset === "Lainnya") {
      setName("")
    } else {
      setName(preset)
    }
  }

  return (
    <form action={createAccountAction}>
      <div className="form-group">
        <label htmlFor="account-type">Jenis Akun</label>
        <select
          id="account-type"
          name="type"
          className="form-control"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as AccountType)}
        >
          {Object.entries(accountTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {type === "BANK" && (
        <div className="form-group" style={{ marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.375rem", display: "block" }}>
            Pilihan Bank Populer:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {BANK_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    minHeight: "1.875rem",
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.75rem",
                    borderRadius: "0.375rem",
                  }}
                >
                  {preset}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {type === "EWALLET" && (
        <div className="form-group" style={{ marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.375rem", display: "block" }}>
            Pilihan E-Wallet Populer:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {EWALLET_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    minHeight: "1.875rem",
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.75rem",
                    borderRadius: "0.375rem",
                  }}
                >
                  {preset}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="account-name">Nama Akun</label>
        <input
          id="account-name"
          name="name"
          type="text"
          className="form-control"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            type === "BANK"
              ? "Contoh: BCA / Rekening Operasional"
              : type === "EWALLET"
              ? "Contoh: DANA / OVO Merchant"
              : type === "QRIS"
              ? "Contoh: QRIS Statis Toko"
              : "Contoh: Kas Laci / Kas Toko"
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="opening-balance">Saldo Awal (Rp, opsional)</label>
        <input
          id="opening-balance"
          name="openingBalance"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={19}
          className="form-control"
          defaultValue="0"
        />
      </div>

      <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: "0.5rem" }}>
        Simpan Akun
      </button>
    </form>
  )
}
