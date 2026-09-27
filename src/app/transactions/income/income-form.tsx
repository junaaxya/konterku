"use client"

import { useState } from "react"
import Link from "next/link"
import { createIncomeAction } from "../actions"

type AccountOption = {
  readonly id: string
  readonly name: string
  readonly type: string
}

type Props = {
  readonly accounts: readonly AccountOption[]
}

export function IncomeForm({ accounts }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      action={async (formData) => {
        if (isSubmitting) return
        setIsSubmitting(true)
        try {
          await createIncomeAction(formData)
        } catch (err) {
          setIsSubmitting(false)
          throw err
        }
      }}
    >
      <div className="form-group">
        <label htmlFor="income-account">Akun Penerima</label>
        <select id="income-account" name="accountId" className="form-control" required>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.type})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="income-amount">Nominal (Rupiah)</label>
        <input
          id="income-amount"
          name="amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={19}
          className="form-control"
          placeholder="Contoh: 50000"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="income-desc">Keterangan</label>
        <input
          id="income-desc"
          name="description"
          type="text"
          maxLength={500}
          className="form-control"
          placeholder="Contoh: Komisi provider / Pendapatan lain"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="income-date">Waktu Transaksi (Opsional)</label>
        <input
          id="income-date"
          name="occurredAt"
          type="datetime-local"
          className="form-control"
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
        <Link href="/transactions" className="btn btn-secondary" style={{ flex: 1 }}>
          Batal
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Pemasukan"}
        </button>
      </div>
    </form>
  )
}
