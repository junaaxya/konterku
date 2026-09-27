"use client"

import { useState } from "react"
import { renameAccountAction, setAccountActiveAction } from "./actions"

type Props = {
  readonly account: {
    readonly id: string
    readonly name: string
    readonly isActive: boolean
  }
}

export function ManageAccountForm({ account }: Props) {
  const [name, setName] = useState(account.name)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)

  return (
    <div>
      <form
        action={async (formData) => {
          if (isRenaming) return
          setIsRenaming(true)
          try {
            await renameAccountAction(formData)
          } finally {
            setIsRenaming(false)
          }
        }}
        style={{ marginBottom: "1rem" }}
      >
        <input type="hidden" name="accountId" value={account.id} />
        <div className="form-group">
          <label htmlFor="rename-account">Nama Akun</label>
          <input
            id="rename-account"
            name="name"
            type="text"
            className="form-control"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary"
          type="submit"
          disabled={isRenaming || !name.trim() || name === account.name}
          style={{ width: "100%" }}
        >
          {isRenaming ? "Menyimpan..." : "Simpan Nama"}
        </button>
      </form>

      {!account.isActive ? (
        <form
          action={async (formData) => {
            if (isToggling) return
            setIsToggling(true)
            try {
              await setAccountActiveAction(formData)
            } finally {
              setIsToggling(false)
            }
          }}
        >
          <input type="hidden" name="accountId" value={account.id} />
          <input type="hidden" name="isActive" value="true" />
          <button
            type="submit"
            disabled={isToggling}
            className="btn btn-secondary"
            style={{ width: "100%" }}
          >
            {isToggling ? "Mengaktifkan..." : "Aktifkan Akun"}
          </button>
        </form>
      ) : !showDisableConfirm ? (
        <button
          type="button"
          onClick={() => setShowDisableConfirm(true)}
          className="btn btn-danger"
          style={{ width: "100%" }}
        >
          Nonaktifkan Akun
        </button>
      ) : (
        <form
          action={async (formData) => {
            if (isToggling) return
            setIsToggling(true)
            try {
              await setAccountActiveAction(formData)
            } finally {
              setIsToggling(false)
              setShowDisableConfirm(false)
            }
          }}
          style={{
            background: "var(--paper)",
            padding: "0.875rem",
            borderRadius: "0.5rem",
            border: "1px dashed var(--danger)",
          }}
        >
          <input type="hidden" name="accountId" value={account.id} />
          <input type="hidden" name="isActive" value="false" />
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--danger)", fontWeight: 700 }}>
            Akun yang nonaktif tidak dapat menerima transaksi baru. Lanjutkan?
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setShowDisableConfirm(false)}
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: "2rem", fontSize: "0.75rem" }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isToggling}
              className="btn btn-danger"
              style={{ flex: 1, minHeight: "2rem", fontSize: "0.75rem" }}
            >
              {isToggling ? "Memproses..." : "Ya, Nonaktifkan"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
