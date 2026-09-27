"use client"

import { useState } from "react"
import Link from "next/link"
import { createExpenseAction } from "../actions"

type AccountOption = {
  readonly id: string
  readonly name: string
  readonly type: string
}

type Props = {
  readonly accounts: readonly AccountOption[]
}

export function ExpenseForm({ accounts }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      action={async (formData) => {
        if (isSubmitting) return
        setIsSubmitting(true)
        try {
          await createExpenseAction(formData)
        } catch (err) {
          setIsSubmitting(false)
          throw err
        }
      }}
    >
      <div className="form-group">
        <label htmlFor="expense-account">Akun Sumber (Uang Berkurang)</label>
        <select id="expense-account" name="accountId" className="form-control" required>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.type})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="expense-amount">Nominal (Rupiah)</label>
        <input
          id="expense-amount"
          name="amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={19}
          className="form-control"
          placeholder="Contoh: 25000"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="expense-desc">Keterangan</label>
        <input
          id="expense-desc"
          name="description"
          type="text"
          maxLength={500}
          className="form-control"
          placeholder="Contoh: Beli token listrik toko / perlengkapan"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="expense-date">Waktu Transaksi (Opsional)</label>
        <input
          id="expense-date"
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
          {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
        </button>
      </div>
    </form>
  )
}
