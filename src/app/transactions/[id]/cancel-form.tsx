"use client"

import { useState } from "react"
import { Warning, XCircle } from "@phosphor-icons/react"
import { cancelTransactionAction } from "../actions"

type Props = {
  readonly transactionId: string
  readonly transactionNumber: string
}

export function CancelTransactionForm({ transactionId, transactionNumber }: Props) {
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Warning size={20} weight="bold" color="var(--danger)" />
        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: 0 }}>Batalkan Transaksi</h2>
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
        Pembatalan akan membuat mutasi pembalik otomatis pada buku besar akun kas. Riwayat asli tetap tersimpan.
      </p>

      {!showConfirm ? (
        <div>
          <div className="form-group">
            <label htmlFor="cancel-reason">Alasan Pembatalan</label>
            <input
              id="cancel-reason"
              type="text"
              required
              maxLength={500}
              className="form-control"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Salah nominal / pembatalan pelanggan"
            />
          </div>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => setShowConfirm(true)}
            className="btn btn-danger"
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            <XCircle size={16} weight="bold" /> Lanjutkan Pembatalan
          </button>
        </div>
      ) : (
        <form
          action={async (formData) => {
            if (isSubmitting) return
            setIsSubmitting(true)
            try {
              await cancelTransactionAction(formData)
            } catch (err) {
              setIsSubmitting(false)
              throw err
            }
          }}
          style={{ background: "var(--paper)", padding: "1rem", borderRadius: "0.5rem", border: "1.5px dashed var(--danger)" }}
        >
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="reason" value={reason} />

          <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 700, color: "var(--danger)" }}>
            Yakin batalkan transaksi {transactionNumber}?
          </p>
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            Alasan: <em>&quot;{reason}&quot;</em>
          </p>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowConfirm(false)}
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: "2.25rem", fontSize: "0.8125rem" }}
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-danger"
              style={{ flex: 1, minHeight: "2.25rem", fontSize: "0.8125rem" }}
            >
              {isSubmitting ? "Memproses..." : "Ya, Batalkan"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
