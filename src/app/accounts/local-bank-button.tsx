"use client"

import { useState } from "react"
import { Globe, Lightning, Warning, CheckCircle } from "@phosphor-icons/react"
import {
  connectLocalBankAction,
  syncLocalBankBalanceAction,
} from "./local-bank-actions"

type Props = {
  readonly accountId: string
  readonly accountName: string
  readonly defaultProviderCode: string
  readonly isConnected: boolean
  readonly status?: string | undefined
}

export function LocalBankConnectorButton({
  accountId,
  accountName,
  defaultProviderCode,
  isConnected,
}: Props) {
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const portalUrls: Record<string, string> = {
    BCA: "https://www.klikbca.com",
    BRI: "https://ib.bri.co.id",
  }

  const handleOpenLogin = () => {
    const url = portalUrls[defaultProviderCode] || "https://www.klikbca.com"
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleConnect = async () => {
    setIsBusy(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append("accountId", accountId)
      formData.append("providerCode", defaultProviderCode)
      const res = await connectLocalBankAction(formData)
      if (res.success) {
        setMessage({
          text: `Konektor lokal ${defaultProviderCode} aktif. Silakan buka web portal bank untuk login lokal.`,
          isError: false,
        })
      } else {
        setMessage({ text: res.error || "Gagal mengaktifkan konektor.", isError: true })
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleSync = async () => {
    setIsBusy(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append("accountId", accountId)
      const res = await syncLocalBankBalanceAction(formData)
      if (res.success) {
        setMessage({
          text: `Saldo ${accountName} berhasil disinkronkan dari konektor lokal.`,
          isError: false,
        })
      } else {
        setMessage({ text: res.error || "Gagal membaca saldo portal.", isError: true })
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      {!isConnected ? (
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isBusy}
            className="btn btn-secondary"
            style={{
              flex: 1,
              minHeight: "2rem",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
            }}
          >
            <Globe size={14} weight="bold" /> Aktifkan Konektor Web Lokal
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <button
            type="button"
            onClick={handleSync}
            disabled={isBusy}
            className="btn btn-primary"
            style={{
              flex: 2,
              minHeight: "2rem",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
            }}
          >
            <Lightning size={14} weight="bold" />
            {isBusy ? "Membaca..." : `Sinkronkan Saldo (${defaultProviderCode})`}
          </button>
          <button
            type="button"
            onClick={handleOpenLogin}
            title="Buka Web Portal Bank di Tab Baru"
            className="btn btn-secondary"
            style={{
              flex: 1,
              minHeight: "2rem",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.25rem",
            }}
          >
            <Globe size={14} weight="bold" /> Buka Web Bank
          </button>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: "0.375rem",
            padding: "0.375rem 0.5rem",
            borderRadius: "0.25rem",
            fontSize: "0.6875rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.375rem",
            background: message.isError ? "#fef2f2" : "var(--primary-light)",
            color: message.isError ? "var(--danger)" : "var(--primary-dark)",
            lineHeight: 1.3,
          }}
        >
          {message.isError ? (
            <Warning size={13} weight="bold" style={{ flexShrink: 0, marginTop: "0.125rem" }} />
          ) : (
            <CheckCircle size={13} weight="bold" style={{ flexShrink: 0, marginTop: "0.125rem" }} />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  )
}
