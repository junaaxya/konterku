"use client"

import { useState } from "react"
import { Printer, ArrowLeft, GearSix, CheckCircle, Warning, Code } from "@phosphor-icons/react"
import Link from "next/link"

import type { ReceiptData } from "@/features/receipts/receipt-domain"
import {
  BrowserPrintAdapter,
  RawbtPrintAdapter,
  getTestReceiptData,
  type PrintAdapter,
} from "@/features/receipts/print-adapter"
import { buildEscPosPlainText } from "@/features/receipts/escpos"

const STORAGE_KEY = "konterku_print_method"

type PrintMethod = "RAWBT" | "BROWSER"

type Props = {
  readonly transactionId: string
  readonly receipt: ReceiptData
}

function getInitialPrintMethod(): PrintMethod {
  if (typeof window === "undefined") {
    return "BROWSER"
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "RAWBT" || saved === "BROWSER") {
      return saved
    }
    const isAndroid = /Android/i.test(navigator.userAgent)
    return isAndroid ? "RAWBT" : "BROWSER"
  } catch {
    return "BROWSER"
  }
}

export function ReceiptPrintActions({ transactionId, receipt }: Props) {
  const [method, setMethod] = useState<PrintMethod>(getInitialPrintMethod)
  const [showSettings, setShowSettings] = useState(false)
  const [showDebugPreview, setShowDebugPreview] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const handleSelectMethod = (selected: PrintMethod) => {
    setMethod(selected)
    try {
      localStorage.setItem(STORAGE_KEY, selected)
    } catch {
      // Ignore localStorage errors
    }
  }

  const getAdapter = (m: PrintMethod): PrintAdapter => {
    return m === "RAWBT" ? new RawbtPrintAdapter() : new BrowserPrintAdapter()
  }

  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const adapter = getAdapter(method)
      const res = await adapter.print(receipt)
      if (!res.success && res.error) {
        setTestMessage(`Gagal mencetak: ${res.error}`)
      }
    } finally {
      setIsPrinting(false)
    }
  }

  const handleTestPrint = async () => {
    setIsPrinting(true)
    setTestMessage(null)
    try {
      const adapter = getAdapter(method)
      const testData = getTestReceiptData()
      const res = await adapter.print(testData)
      if (res.success) {
        setTestMessage("Perintah tes cetak berhasil dikirim.")
      } else {
        setTestMessage(`Tes cetak gagal: ${res.error || "Terjadi kesalahan"}`)
      }
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="no-print" style={{ maxWidth: "26rem", margin: "0 auto 1.5rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", alignItems: "center" }}>
        <Link href={`/transactions/${transactionId}`} className="btn btn-secondary" style={{ flexShrink: 0 }}>
          <ArrowLeft size={16} weight="bold" /> Kembali
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          <Printer size={16} weight="bold" />
          {method === "RAWBT" ? "Cetak Struk (Bluetooth)" : "Cetak Struk"}
        </button>
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          title="Pengaturan Printer"
          className="btn btn-secondary"
          style={{ padding: "0.625rem 0.75rem", flexShrink: 0 }}
        >
          <GearSix size={18} weight="bold" />
        </button>
      </div>

      {showSettings && (
        <div
          className="card"
          style={{
            marginTop: "1rem",
            padding: "1rem",
            fontSize: "0.8125rem",
            border: "1.5px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <strong style={{ fontSize: "0.875rem" }}>Metode Pencetakan</strong>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-button"
              style={{ fontSize: "0.75rem" }}
            >
              Tutup
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                background: method === "RAWBT" ? "var(--primary-light)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="printMethod"
                value="RAWBT"
                checked={method === "RAWBT"}
                onChange={() => handleSelectMethod("RAWBT")}
              />
              <div>
                <strong>RawBT Bluetooth Thermal (Android)</strong>
                <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--muted)" }}>
                  Direkomendasikan untuk tablet/HP via Bluetooth ke printer EPPOS EPX583-V2
                </span>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                background: method === "BROWSER" ? "var(--primary-light)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="printMethod"
                value="BROWSER"
                checked={method === "BROWSER"}
                onChange={() => handleSelectMethod("BROWSER")}
              />
              <div>
                <strong>Browser Print (Standar / Preview)</strong>
                <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--muted)" }}>
                  Dialog cetak sistem bawaan browser (PC desktop / printer sistem)
                </span>
              </div>
            </label>
          </div>

          {method === "RAWBT" && (
            <div
              style={{
                background: "var(--paper)",
                padding: "0.625rem",
                borderRadius: "0.375rem",
                marginBottom: "0.75rem",
                fontSize: "0.75rem",
                borderLeft: "3px solid var(--primary)",
              }}
            >
              <p style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>Petunjuk RawBT Android:</p>
              <ol style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.4 }}>
                <li>Pasang aplikasi <strong>RawBT Print Service</strong> dari Play Store.</li>
                <li>Sambungkan Bluetooth HP/tablet ke printer <strong>EPPOS EPX583-V2</strong> (PIN: 0000 / 1234).</li>
                <li>Di aplikasi RawBT, pilih koneksi <strong>Bluetooth</strong> dan model <strong>ESC/POS (58mm)</strong>.</li>
              </ol>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={isPrinting}
                className="btn btn-secondary"
                style={{ minHeight: "2.25rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
              >
                Tes Cetak
              </button>
              <button
                type="button"
                onClick={() => setShowDebugPreview((prev) => !prev)}
                className="btn btn-secondary"
                style={{ minHeight: "2.25rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
              >
                <Code size={14} /> {showDebugPreview ? "Tutup Debug" : "Debug 32-Col"}
              </button>
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
              Profil: EPPOS 58mm (32 Kolom)
            </span>
          </div>

          {testMessage && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                background: testMessage.includes("Gagal") ? "var(--danger-light)" : "var(--primary-light)",
                color: testMessage.includes("Gagal") ? "var(--danger)" : "var(--primary-dark)",
              }}
            >
              {testMessage.includes("Gagal") ? <Warning size={14} /> : <CheckCircle size={14} />}
              <span>{testMessage}</span>
            </div>
          )}

          {showDebugPreview && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#0f172a",
                color: "#f8fafc",
                borderRadius: "0.5rem",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                overflowX: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "0.375rem", marginBottom: "0.5rem", color: "#94a3b8" }}>
                <span>Pratinjau ESC/POS (Tepat 32 Kolom)</span>
                <span>58mm</span>
              </div>
              <pre style={{ margin: 0, whiteSpace: "pre", lineHeight: 1.25 }}>
                {buildEscPosPlainText(receipt, 32)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
