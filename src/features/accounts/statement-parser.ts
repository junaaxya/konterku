export type ParsedStatementRow = {
  readonly date: Date
  readonly description: string
  readonly amount: bigint
  readonly direction?: "IN" | "OUT" | undefined
  readonly runningBalance?: bigint | undefined
}

export type StatementParseResult = {
  readonly success: boolean
  readonly rows: readonly ParsedStatementRow[]
  readonly detectedBalance?: bigint | undefined
  readonly detectedDate?: Date | undefined
  readonly errors: readonly string[]
}

function parseBigIntAmount(val: string): bigint | null {
  const cleaned = val.replace(/[^0-9]/g, "")
  if (!cleaned) return null
  try {
    return BigInt(cleaned)
  } catch {
    return null
  }
}

function parseCsvDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = trimmed.split(/[-/]/)
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(year, month, day)
      return isNaN(d.getTime()) ? null : d
    }
  }

  const generic = new Date(trimmed)
  return isNaN(generic.getTime()) ? null : generic
}

export function parseStatementCsv(csvContent: string): StatementParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return {
      success: false,
      rows: [],
      errors: ["File CSV kosong atau tidak memiliki baris data."],
    }
  }

  const rawHeader = lines[0]!.toLowerCase()
  const delimiter = rawHeader.includes(";") ? ";" : ","
  const headers = lines[0]!.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""))

  const dateIdx = headers.findIndex((h) => h.includes("tanggal") || h.includes("date") || h.includes("waktu"))
  const descIdx = headers.findIndex((h) => h.includes("keterangan") || h.includes("desc") || h.includes("uraian"))
  const amountIdx = headers.findIndex((h) => h.includes("nominal") || h.includes("jumlah") || h.includes("amount") || h.includes("mutasi"))
  const dirIdx = headers.findIndex((h) => h.includes("tipe") || h.includes("type") || h.includes("arah") || h.includes("direction") || h.includes("d/k"))
  const balanceIdx = headers.findIndex((h) => h.includes("saldo") || h.includes("balance"))

  if (dateIdx === -1 || (amountIdx === -1 && balanceIdx === -1)) {
    return {
      success: false,
      rows: [],
      errors: [
        "Format kolom CSV tidak dikenali. Wajib menyertakan kolom tanggal dan (nominal atau saldo).",
      ],
    }
  }

  const rows: ParsedStatementRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))

    if (cols.length < Math.min(dateIdx, amountIdx, balanceIdx) + 1) {
      errors.push(`Baris ${i + 1}: Jumlah kolom kurang (${line})`)
      continue
    }

    const dateVal = cols[dateIdx]
    const parsedDate = dateVal ? parseCsvDate(dateVal) : null
    if (!parsedDate) {
      errors.push(`Baris ${i + 1}: Format tanggal tidak valid (${dateVal})`)
      continue
    }

    const desc = descIdx !== -1 && cols[descIdx] ? cols[descIdx]! : `Mutasi baris ${i}`

    let amount = 0n
    if (amountIdx !== -1 && cols[amountIdx]) {
      const parsedAmount = parseBigIntAmount(cols[amountIdx]!)
      if (parsedAmount === null) {
        errors.push(`Baris ${i + 1}: Nominal tidak valid (${cols[amountIdx]})`)
        continue
      }
      amount = parsedAmount
    }

    let direction: "IN" | "OUT" | undefined = undefined
    if (dirIdx !== -1 && cols[dirIdx]) {
      const d = cols[dirIdx]!.toUpperCase()
      if (d.startsWith("IN") || d.startsWith("CR") || d.startsWith("K") || d.startsWith("MASUK")) {
        direction = "IN"
      } else if (d.startsWith("OUT") || d.startsWith("DB") || d.startsWith("D") || d.startsWith("KELUAR")) {
        direction = "OUT"
      }
    }

    let runningBalance: bigint | undefined = undefined
    if (balanceIdx !== -1 && cols[balanceIdx]) {
      const b = parseBigIntAmount(cols[balanceIdx]!)
      if (b !== null) {
        runningBalance = b
      }
    }

    rows.push({
      date: parsedDate,
      description: desc,
      amount,
      direction,
      runningBalance,
    })
  }

  if (errors.length > 0 && rows.length === 0) {
    return {
      success: false,
      rows: [],
      errors,
    }
  }

  // Determine detected latest balance
  // Prefer runningBalance of the latest row or the last row with a runningBalance
  let detectedBalance: bigint | undefined = undefined
  let detectedDate: Date | undefined = undefined

  // Scan from end to start for runningBalance
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!
    if (r.runningBalance !== undefined) {
      detectedBalance = r.runningBalance
      detectedDate = r.date
      break
    }
  }

  return {
    success: errors.length === 0,
    rows,
    detectedBalance,
    detectedDate,
    errors,
  }
}
