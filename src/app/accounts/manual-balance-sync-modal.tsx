"use client"

import { useState } from "react"
import { ArrowsClockwise, X } from "@phosphor-icons/react"
import { formatRupiah } from "@/lib/money"
import { recordManualBalanceAction } from "./external-balance-actions"

type Props = {
  readonly account: {
    readonly id: string
    readonly name: string
    readonly type: string
    readonly balance: bigint
  }
  readonly latestActualBalance?: bigint | null | undefined
  readonly lastSyncedAt?: Date | null | undefined
  readonly isOpen: boolean
  readonly onClose: () => void
}

export function ManualBalanceSyncModal({
  account,
  latestActualBalance,
  isOpen,
  onClose,
}: Props) {
  const [actualInput, setActualInput] = useState(
    latestActualBalance !== undefined && latestActualBalance !== null
      ? latestActualBalance.toString()
      : "",
  )
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const parsedActual =
    actualInput && /^\d+$/.test(actualInput) ? BigInt(actualInput) : null
  const difference =
    parsedActual !== null ? parsedActual - account.balance : null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        zIndex: 110,
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "26rem",
          width: "100%",
          padding: "1.5rem",
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ArrowsClockwise size={20} weight="bold" color="var(--primary-dark)" />
            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>
              Perbarui Saldo {account.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-button"
            style={{ padding: "0.25rem", color: "var(--muted)" }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
          Masukkan saldo riil yang Anda lihat di aplikasi bank atau e-wallet saat ini.
          Tidak akan mengubah atau membuat mutasi buku besar.
        </p>

        {/* Comparison card */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            fontSize: "0.8125rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
            <span style={{ color: "var(--muted)" }}>Saldo Buku (Sistem):</span>
            <strong style={{ fontWeight: 800 }}>{formatRupiah(account.balance)}</strong>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
            <span style={{ color: "var(--muted)" }}>Saldo Aktual (Baru):</span>
            <strong style={{ color: "var(--primary-dark)", fontWeight: 800 }}>
              {parsedActual !== null ? formatRupiah(parsedActual) : "-"}
            </strong>
          </div>

          {difference !== null && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "0.375rem",
                borderTop: "1px dashed var(--line)",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Selisih (Aktual - Buku):</span>
              <strong
                style={{
                  fontWeight: 800,
                  color:
                    difference === 0n
                      ? "var(--primary-dark)"
                      : difference > 0n
                      ? "var(--primary-dark)"
                      : "var(--danger)",
                }}
              >
                {difference > 0n ? "+" : ""}
                {formatRupiah(difference)}
                {difference === 0n ? " (Sesuai)" : difference > 0n ? " (Lebih)" : " (Kurang)"}
              </strong>
            </div>
          )}
        </div>

        <form
          action={async (formData) => {
            if (isSubmitting || parsedActual === null) return
            setIsSubmitting(true)
            try {
              await recordManualBalanceAction(formData)
              onClose()
            } finally {
              setIsSubmitting(false)
            }
          }}
        >
          <input type="hidden" name="accountId" value={account.id} />

          <div className="form-group" style={{ marginBottom: "0.875rem" }}>
            <label htmlFor="modal-actual-balance">Saldo Aktual (Rp)</label>
            <input
              id="modal-actual-balance"
              name="balance"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              autoFocus
              className="form-control"
              style={{ fontSize: "1.125rem", fontWeight: 800, padding: "0.625rem 0.75rem" }}
              value={actualInput}
              onChange={(e) => setActualInput(e.target.value)}
              placeholder="Contoh: 2650000"
            />
          </div>

          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label htmlFor="modal-sync-note">Catatan (Opsional)</label>
            <input
              id="modal-sync-note"
              name="note"
              type="text"
              className="form-control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Dicek dari m-Banking BCA"
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedActual === null}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Saldo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
