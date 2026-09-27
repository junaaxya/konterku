"use client"

import { useState } from "react"
import { Lightning, Warning, CheckCircle } from "@phosphor-icons/react"
import { syncProviderBalanceAction } from "./bank-sync-actions"

type Props = {
  readonly accountId: string
  readonly providerName?: string | undefined
  readonly providerCode: string
}

export function BankSyncButton({ accountId, providerCode }: Props) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append("accountId", accountId)
      const res = await syncProviderBalanceAction(formData)
      if (res.success) {
        setMessage({ text: `Saldo ${providerCode} berhasil disinkronkan.`, isError: false })
      } else {
        setMessage({ text: res.error || "Gagal sinkronisasi API.", isError: true })
      }
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        className="btn btn-primary"
        style={{
          width: "100%",
          minHeight: "2.125rem",
          padding: "0.375rem 0.75rem",
          fontSize: "0.8125rem",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.375rem",
        }}
      >
        <Lightning size={15} weight="bold" />
        {isSyncing ? "Menyinkronkan..." : `Sinkronkan Saldo (${providerCode} API)`}
      </button>

      {message && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.375rem",
            background: message.isError ? "#fef2f2" : "var(--primary-light)",
            color: message.isError ? "var(--danger)" : "var(--primary-dark)",
            lineHeight: 1.35,
          }}
        >
          {message.isError ? (
            <Warning size={15} weight="bold" style={{ flexShrink: 0, marginTop: "0.125rem" }} />
          ) : (
            <CheckCircle size={15} weight="bold" style={{ flexShrink: 0, marginTop: "0.125rem" }} />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  )
}
