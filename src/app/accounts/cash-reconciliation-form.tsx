"use client"

import { useState } from "react"
import { formatRupiah } from "@/lib/money"
import { reconcileCashAccountAction } from "./actions"

type Props = {
  readonly accountId: string
  readonly systemBalance: bigint
}

export function CashReconciliationForm({ accountId, systemBalance }: Props) {
  const [physicalInput, setPhysicalInput] = useState("")
  const [note, setNote] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const physicalAmount = physicalInput && /^\d+$/.test(physicalInput) ? BigInt(physicalInput) : null
  const difference = physicalAmount !== null ? physicalAmount - systemBalance : null

  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "0.5rem",
        padding: "0.875rem",
        marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ fontSize: "0.875rem", display: "block" }}>Rekonsiliasi Kas Fisik</strong>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Cocokkan saldo sistem dengan uang tunai riil di laci.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="btn btn-secondary"
          style={{ minHeight: "2rem", padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
        >
          {isOpen ? "Tutup" : "Hitung Fisik"}
        </button>
      </div>

      {isOpen && (
        <form action={reconcileCashAccountAction} style={{ marginTop: "0.875rem" }}>
          <input type="hidden" name="accountId" value={accountId} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem", marginBottom: "0.75rem", fontSize: "0.8125rem" }}>
            <span style={{ color: "var(--muted)" }}>Saldo Menurut Sistem:</span>
            <strong style={{ fontWeight: 800 }}>{formatRupiah(systemBalance)}</strong>
          </div>

          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="physical-cash-amount">Jumlah Kas Fisik (Rp)</label>
            <input
              id="physical-cash-amount"
              name="physicalAmount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="form-control"
              required
              value={physicalInput}
              onChange={(e) => setPhysicalInput(e.target.value)}
              placeholder="Contoh: 150000"
            />
          </div>

          {difference !== null && (
            <div
              style={{
                padding: "0.625rem",
                borderRadius: "0.375rem",
                marginBottom: "0.75rem",
                fontSize: "0.8125rem",
                background: difference === 0n ? "var(--primary-light)" : "#fef2f2",
                color: difference === 0n ? "var(--primary-dark)" : "var(--danger)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Selisih (Fisik - Sistem):</span>
              <strong style={{ fontWeight: 800 }}>
                {difference > 0n ? "+" : ""}
                {formatRupiah(difference)}
                {difference === 0n ? " (Sesuai)" : difference > 0n ? " (Lebih)" : " (Kurang)"}
              </strong>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="reconciliation-note">Catatan / Keterangan (Opsional)</label>
            <input
              id="reconciliation-note"
              name="note"
              type="text"
              className="form-control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Selisih uang receh kembalian"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={physicalAmount === null}
              style={{ minHeight: "2.25rem", padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
            >
              Simpan Hasil Rekonsiliasi
            </button>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
              Tidak mengubah buku besar
            </span>
          </div>
        </form>
      )}
    </div>
  )
}
