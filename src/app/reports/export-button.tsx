"use client"

import { useState } from "react"
import { DownloadSimple, CheckCircle, Warning, ArrowsClockwise } from "@phosphor-icons/react"
import type { ReportPeriod } from "@/features/reports/report-service"
import { exportReportCsvAction } from "./actions"

type Props = {
  readonly period: ReportPeriod
  readonly startDate?: string | undefined
  readonly endDate?: string | undefined
}

export function ReportExportButton({ period, startDate, endDate }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setFeedback(null)

    try {
      const res = await exportReportCsvAction({
        period,
        startDate,
        endDate,
      })

      if (res.success && res.csvContent && res.filename) {
        // Trigger browser download via client-side Blob without navigating away
        const blob = new Blob([res.csvContent], {
          type: "text/csv;charset=utf-8;",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", res.filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        setFeedback({
          text: `Laporan CSV berhasil diunduh (${res.filename}).`,
          isError: false,
        })
        setTimeout(() => setFeedback(null), 4000)
      } else {
        setFeedback({
          text: res.error || "Gagal mengunduh laporan CSV.",
          isError: true,
        })
      }
    } catch {
      setFeedback({
        text: "Terjadi kesalahan jaringan saat mengekspor laporan.",
        isError: true,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="btn btn-secondary"
        style={{
          minHeight: "2.75rem",
          padding: "0.625rem 1rem",
          fontSize: "0.875rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          cursor: isExporting ? "wait" : "pointer",
        }}
      >
        {isExporting ? (
          <>
            <ArrowsClockwise size={16} weight="bold" /> Menyiapkan CSV...
          </>
        ) : (
          <>
            <DownloadSimple size={16} weight="bold" /> Ekspor CSV
          </>
        )}
      </button>

      {feedback && (
        <div
          style={{
            position: "absolute",
            marginTop: "3.25rem",
            zIndex: 30,
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            boxShadow: "var(--card-shadow)",
            background: feedback.isError ? "#fef2f2" : "var(--primary-light)",
            color: feedback.isError ? "var(--danger)" : "var(--primary-dark)",
            border: `1px solid ${feedback.isError ? "#fecaca" : "#a7f3d0"}`,
          }}
        >
          {feedback.isError ? <Warning size={14} weight="bold" /> : <CheckCircle size={14} weight="bold" />}
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  )
}
