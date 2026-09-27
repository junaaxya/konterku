"use client"

import { useState } from "react"
import {
  DeviceMobile,
  Copy,
  Check,
  Key,
  Warning,
  X,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import { regeneratePairingTokenAction } from "./local-bank-actions"

type Props = {
  readonly account: {
    readonly id: string
    readonly name: string
    readonly type: string
  }
  readonly hasPairingToken: boolean
}

export function AndroidCompanionPairingCard({ account, hasPairingToken }: Props) {
  const [copiedId, setCopiedId] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasTokenState, setHasTokenState] = useState(hasPairingToken)
  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCopyAccountId = async () => {
    if (typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(account.id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleCopyToken = async () => {
    if (newlyGeneratedToken && typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(newlyGeneratedToken)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const handleGenerateToken = async () => {
    setIsGenerating(true)
    setErrorMessage(null)
    try {
      const formData = new FormData()
      formData.append("accountId", account.id)
      const res = await regeneratePairingTokenAction(formData)
      if (res.success && res.token) {
        setNewlyGeneratedToken(res.token)
        setHasTokenState(true)
      } else {
        setErrorMessage(res.error || "Gagal membuat token pairing.")
      }
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan saat membuat token.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCloseModal = () => {
    setNewlyGeneratedToken(null)
    setCopiedToken(false)
  }

  return (
    <div
      className="card"
      style={{
        marginTop: "1.25rem",
        padding: "1.25rem",
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
        <span
          className="icon-box emerald"
          style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.5rem" }}
        >
          <DeviceMobile size={20} weight="duotone" />
        </span>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>
            Pairing KONTERKU Companion
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Sinkronisasi saldo otomatis via aplikasi Android di HP / Tablet
          </span>
        </div>
      </div>

      {/* Account ID display */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "0.5rem",
          padding: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <label
          htmlFor="display-account-id"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "block",
            marginBottom: "0.375rem",
          }}
        >
          ID Akun (Account ID)
        </label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            id="display-account-id"
            type="text"
            readOnly
            value={account.id}
            className="form-control"
            style={{
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              padding: "0.375rem 0.625rem",
              minHeight: "2.25rem",
              background: "var(--surface)",
              color: "var(--ink)",
              fontWeight: 700,
            }}
          />
          <button
            type="button"
            onClick={handleCopyAccountId}
            className="btn btn-secondary"
            style={{ minHeight: "2.25rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem", flexShrink: 0 }}
          >
            {copiedId ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
            <span>{copiedId ? "Tersalin!" : "Salin ID"}</span>
          </button>
        </div>
      </div>

      {/* Token status & generation */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "0.5rem",
          padding: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>
            Status Token Pairing:
          </span>
          <span
            className="badge-online"
            style={{
              fontSize: "0.6875rem",
              padding: "0.125rem 0.5rem",
              background: hasTokenState ? "var(--primary-light)" : "var(--slate-bg)",
              color: hasTokenState ? "var(--primary-dark)" : "var(--muted)",
            }}
          >
            {hasTokenState ? "● Token Aktif" : "○ Belum Ada Token"}
          </span>
        </div>

        <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
          {hasTokenState
            ? "Token sudah terkonfigurasi. Jika perlu memasang ulang di HP/tablet Android baru, buat token baru."
            : "Buat token pairing sekali pakai untuk menghubungkan aplikasi KONTERKU Companion di Android."}
        </p>

        <button
          type="button"
          onClick={handleGenerateToken}
          disabled={isGenerating}
          className="btn btn-primary"
          style={{ width: "100%", minHeight: "2.25rem", fontSize: "0.8125rem" }}
        >
          {isGenerating ? (
            <>
              <ArrowsClockwise size={15} weight="bold" /> Membuat Token...
            </>
          ) : (
            <>
              <Key size={15} weight="bold" />
              {hasTokenState ? "Buat Ulang Token Pairing" : "Generate Token Pairing"}
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
            background: "#fef2f2",
            color: "var(--danger)",
            fontSize: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Operator guidance */}
      <div
        style={{
          borderTop: "1px dashed var(--line)",
          paddingTop: "0.75rem",
          fontSize: "0.75rem",
          color: "var(--muted)",
        }}
      >
        <strong style={{ color: "var(--ink)", display: "block", marginBottom: "0.375rem" }}>
          Panduan Operator (3 Langkah):
        </strong>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.5 }}>
          <li>
            <strong>Salin ID Akun</strong> di atas.
          </li>
          <li>
            Klik tombol <strong>Generate Token Pairing</strong> dan salin token yang muncul.
          </li>
          <li>
            Buka aplikasi <strong>KONTERKU Companion</strong> di Android, masukkan Server LAN URL, ID Akun, dan Token Pairing.
          </li>
        </ol>
      </div>

      {/* Ephemeral Plaintext Token Modal */}
      {newlyGeneratedToken && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 120,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "28rem",
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
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
                <Key size={20} weight="bold" color="var(--primary-dark)" />
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>
                  Token Pairing Baru Dibuat
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-button"
                style={{ padding: "0.25rem", color: "var(--muted)" }}
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <label
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "0.375rem",
                }}
              >
                Token Pairing (Hanya Ditampilkan Sekali)
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={newlyGeneratedToken}
                  className="form-control"
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    padding: "0.5rem 0.625rem",
                    minHeight: "2.5rem",
                    background: "var(--surface)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="btn btn-primary"
                  style={{ minHeight: "2.5rem", padding: "0.375rem 0.875rem", fontSize: "0.8125rem", flexShrink: 0 }}
                >
                  {copiedToken ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                  <span>{copiedToken ? "Tersalin!" : "Salin Token"}</span>
                </button>
              </div>
            </div>

            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fef3c7",
                borderRadius: "0.375rem",
                padding: "0.625rem 0.75rem",
                fontSize: "0.75rem",
                color: "#92400e",
                marginBottom: "1.25rem",
                display: "flex",
                gap: "0.5rem",
                lineHeight: 1.4,
              }}
            >
              <Warning size={18} weight="bold" style={{ flexShrink: 0, marginTop: "0.125rem" }} />
              <div>
                <strong>Penting:</strong> Salin token ini sekarang ke aplikasi KONTERKU Companion di HP/tablet Android Anda.
                Demi keamanan, token plaintext ini <strong>tidak akan pernah ditampilkan lagi</strong> setelah jendela ini ditutup.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="btn btn-secondary"
              style={{ width: "100%", minHeight: "2.5rem", fontWeight: 700 }}
            >
              Saya Sudah Menyalin Token (Tutup)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
