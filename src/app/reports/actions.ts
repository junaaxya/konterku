"use server"

import { getFinancialReport, type ReportPeriod } from "@/features/reports/report-service"
import {
  generateFinancialReportCsv,
  generateReportCsvFilename,
} from "@/features/reports/report-export"

type ExportReportInput = {
  readonly period: ReportPeriod
  readonly startDate?: string | undefined
  readonly endDate?: string | undefined
}

export type ExportReportResult = {
  readonly success: boolean
  readonly csvContent?: string | undefined
  readonly filename?: string | undefined
  readonly error?: string | undefined
}

export async function exportReportCsvAction(
  input: ExportReportInput,
): Promise<ExportReportResult> {
  try {
    const startDate = input.startDate ? new Date(input.startDate) : undefined
    const endDate = input.endDate ? new Date(input.endDate) : undefined

    const report = await getFinancialReport({
      period: input.period,
      startDate,
      endDate,
    })

    const csvContent = generateFinancialReportCsv(report)
    const filename = generateReportCsvFilename(report.period)

    return {
      success: true,
      csvContent,
      filename,
    }
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menyiapkan berkas ekspor laporan.",
    }
  }
}
