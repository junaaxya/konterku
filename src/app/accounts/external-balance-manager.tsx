"use client"

import { useState } from "react"
import { ArrowsClockwise, UploadSimple, CheckCircle, Warning } from "@phosphor-icons/react"
import { formatRupiah } from "@/lib/money"
import {
  parseStatementCsvAction,
  confirmImportBalanceAction,
} from "./external-balance-actions"
import { ManualBalanceSyncModal } from "./manual-balance-sync-modal"

type Props = {
  readonly accountId: string
  readonly accountName: string
  readonly accountType: string
  readonly bookBalance: bigint
  readonly latestActualBalance?: bigint | null | undefined
  readonly lastSyncedAt?: Date | null | undefined
}

type TabMode = "NONE" | "IMPORT"

export function ExternalBalanceManager({
  accountId,
  accountName,
  accountType,
  bookBalance,
  latestActualBalance,
  lastSyncedAt,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabMode>("NONE")
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  // CSV Import states
  const [isParsingCsv, setIsParsingCsv] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parseResult, setParseResult] = useState<{
    success: boolean
    rowsCount: number
    detectedBalance: string | null
    detectedDate: string | null
    errors: readonly string[]
    sampleRows: readonly {
      date: string
      description: string
      amount: string
      direction?: string | undefined
      runningBalance?: string | undefined
    }[]
    rawRows?: readonly {
      date: string
      description: string
      amount: string
      direction?: string | undefined
      runningBalance?: string | undefined
    }[] | undefined
  } | null>(null)

  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsingCsv(true)
    setParseResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await parseStatementCsvAction(formData)
      setParseResult(res)
    } finally {
      setIsParsingCsv(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.detectedBalance) return
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append("accountId", accountId)
      formData.append("balance", parseResult.detectedBalance)
      if (parseResult.detectedDate) {
        formData.append("snapshotAt", parseResult.detectedDate)
      }
      formData.append("note", `Import ${parseResult.rowsCount} baris mutasi rekening`)
      if (parseResult.rawRows) {
        formData.append("rawRows", JSON.stringify(parseResult.rawRows))
      }
      await confirmImportBalanceAction(formData)
      setActiveTab("NONE")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div style={{ marginTop: "0.75rem", borderTop: "1px dashed var(--line)", paddingTop: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>
          Perbarui Saldo Aktual:
        </span>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="btn btn-primary"
            style={{ minHeight: "1.875rem", padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
          >
            <ArrowsClockwise size={13} weight="bold" /> Perbarui Saldo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab((prev) => (prev === "IMPORT" ? "NONE" : "IMPORT"))}
            className={`btn ${activeTab === "IMPORT" ? "btn-primary" : "btn-secondary"}`}
            style={{ minHeight: "1.875rem", padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
          >
            <UploadSimple size={13} weight="bold" /> Import Mutasi
          </button>
        </div>
      </div>

      {isSyncModalOpen && (
        <ManualBalanceSyncModal
          account={{
            id: accountId,
            name: accountName,
            type: accountType,
            balance: bookBalance,
          }}
          latestActualBalance={latestActualBalance}
          lastSyncedAt={lastSyncedAt}
          isOpen={true}
          onClose={() => setIsSyncModalOpen(false)}
        />
      )}

      {activeTab === "IMPORT" && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            background: "var(--paper)",
            borderRadius: "0.5rem",
            border: "1px solid var(--line)",
          }}
        >
          <strong style={{ fontSize: "0.8125rem", display: "block", marginBottom: "0.25rem" }}>
            Import Mutasi CSV ({accountName})
          </strong>
          <p style={{ fontSize: "0.6875rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
            Unggah file CSV mutasi rekening untuk mendeteksi saldo akhir. Tidak membuat transaksi buku besar baru.
          </p>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvChange}
            disabled={isParsingCsv}
            className="form-control"
            style={{ fontSize: "0.75rem", padding: "0.375rem" }}
          />

          {isParsingCsv && (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0" }}>
              Membaca dan memvalidasi file CSV...
            </p>
          )}

          {parseResult && (
            <div style={{ marginTop: "0.75rem" }}>
              {parseResult.errors.length > 0 && (
                <div
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.25rem",
                    background: "#fef2f2",
                    color: "var(--danger)",
                    fontSize: "0.75rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontWeight: 700 }}>
                    <Warning size={14} /> Ditemukan Masalah CSV:
                  </div>
                  <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                    {parseResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parseResult.rowsCount > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      padding: "0.375rem 0.5rem",
                      background: "var(--surface)",
                      borderRadius: "0.25rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span>Total Baris Valid:</span>
                    <strong>{parseResult.rowsCount} baris</strong>
                  </div>

                  {parseResult.detectedBalance ? (
                    <div
                      style={{
                        padding: "0.5rem",
                        background: "var(--primary-light)",
                        color: "var(--primary-dark)",
                        borderRadius: "0.375rem",
                        fontSize: "0.8125rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Saldo Terdeteksi:</span>
                        <strong style={{ fontSize: "0.9375rem" }}>
                          {formatRupiah(BigInt(parseResult.detectedBalance))}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", fontSize: "0.6875rem" }}>
                        <span>Selisih Buku Besar:</span>
                        <span>
                          {BigInt(parseResult.detectedBalance) - bookBalance > 0n ? "+" : ""}
                          {formatRupiah(BigInt(parseResult.detectedBalance) - bookBalance)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "0.5rem",
                        background: "#fffbeb",
                        color: "#d97706",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Tidak ditemukan kolom saldo akhir running-balance di file CSV ini.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setParseResult(null)
                        setActiveTab("NONE")
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1, minHeight: "2.125rem", fontSize: "0.75rem" }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isImporting || !parseResult.detectedBalance}
                      onClick={handleConfirmImport}
                      className="btn btn-primary"
                      style={{ flex: 1, minHeight: "2.125rem", fontSize: "0.75rem" }}
                    >
                      <CheckCircle size={14} weight="bold" />
                      {isImporting ? "Menyimpan..." : "Konfirmasi Saldo"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
