import type { ReceiptData } from "./receipt-domain"

export function wrapText(text: string, maxColumns = 32): string[] {
  if (text.length <= maxColumns) return [text]
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    if (!current) {
      if (word.length > maxColumns) {
        for (let i = 0; i < word.length; i += maxColumns) {
          lines.push(word.slice(i, i + maxColumns))
        }
      } else {
        current = word
      }
    } else if (`${current} ${word}`.length <= maxColumns) {
      current += ` ${word}`
    } else {
      lines.push(current)
      if (word.length > maxColumns) {
        for (let i = 0; i < word.length; i += maxColumns) {
          lines.push(word.slice(i, i + maxColumns))
        }
        current = ""
      } else {
        current = word
      }
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

export function formatTwoColumns(left: string, right: string, maxColumns = 32): string {
  const spaceNeeded = maxColumns - left.length - right.length
  if (spaceNeeded <= 0) {
    return `${left}\n${" ".repeat(Math.max(0, maxColumns - right.length))}${right}`
  }
  return `${left}${" ".repeat(spaceNeeded)}${right}`
}

export function centerText(text: string, maxColumns = 32): string {
  if (text.length >= maxColumns) return text
  const totalPadding = maxColumns - text.length
  const leftPad = Math.floor(totalPadding / 2)
  return " ".repeat(leftPad) + text
}

export function buildEscPosPlainText(receipt: ReceiptData, maxColumns = 32): string {
  const divider = "-".repeat(maxColumns)
  const lines: string[] = []

  lines.push(centerText(receipt.storeName, maxColumns))
  lines.push(centerText(receipt.storeSubtitle, maxColumns))
  lines.push(centerText(receipt.networkNotice, maxColumns))

  if (receipt.isCancelled) {
    lines.push("")
    lines.push(centerText("*** TRANSAKSI DIBATALKAN ***", maxColumns))
    if (receipt.cancelReason) {
      lines.push(...wrapText(`Alasan: ${receipt.cancelReason}`, maxColumns))
    }
  }

  lines.push(divider)
  lines.push(formatTwoColumns("No. Tx:", receipt.transactionNumber, maxColumns))
  lines.push(formatTwoColumns("Waktu:", receipt.formattedDate, maxColumns))
  lines.push(formatTwoColumns("Status:", receipt.statusText, maxColumns))
  lines.push(divider)

  lines.push(formatTwoColumns("Layanan:", receipt.category, maxColumns))
  lines.push(...wrapText(receipt.description, maxColumns))
  lines.push(divider)

  lines.push(formatTwoColumns("Nominal:", receipt.grossAmount, maxColumns))
  if (receipt.feeAmount) {
    lines.push(formatTwoColumns("Biaya Admin:", receipt.feeAmount, maxColumns))
  }
  lines.push(divider)

  lines.push(formatTwoColumns("TOTAL DIBAYAR:", receipt.totalPaid, maxColumns))

  if (receipt.paymentAccounts.length > 0) {
    lines.push("Akun Pembayaran:")
    for (const acc of receipt.paymentAccounts) {
      lines.push(formatTwoColumns(`- ${acc.accountName}`, acc.amount, maxColumns))
    }
  }

  lines.push(divider)
  lines.push(...wrapText(receipt.footerThankYou, maxColumns).map((l) => centerText(l, maxColumns)))
  lines.push(...wrapText(receipt.footerNotice, maxColumns).map((l) => centerText(l, maxColumns)))

  return lines.join("\n")
}

export function buildEscPosPayload(receipt: ReceiptData, maxColumns = 32): Uint8Array {
  const ESC = "\x1B"
  const GS = "\x1D"

  const CMD = {
    INIT: `${ESC}@`,
    ALIGN_LEFT: `${ESC}a\x00`,
    ALIGN_CENTER: `${ESC}a\x01`,
    BOLD_ON: `${ESC}E\x01`,
    BOLD_OFF: `${ESC}E\x00`,
    DOUBLE_ON: `${GS}!\x11`,
    DOUBLE_OFF: `${GS}!\x00`,
    FEED_AND_CUT: `${ESC}d\x03`,
  }

  const divider = "-".repeat(maxColumns)

  let text = ""
  text += CMD.INIT
  text += CMD.ALIGN_CENTER
  text += `${CMD.DOUBLE_ON}${receipt.storeName}${CMD.DOUBLE_OFF}\n`
  text += `${receipt.storeSubtitle}\n`
  text += `${receipt.networkNotice}\n`

  if (receipt.isCancelled) {
    text += "\n"
    text += `${CMD.BOLD_ON}*** TRANSAKSI DIBATALKAN ***${CMD.BOLD_OFF}\n`
    if (receipt.cancelReason) {
      const reasonLines = wrapText(`Alasan: ${receipt.cancelReason}`, maxColumns)
      text += `${reasonLines.join("\n")}\n`
    }
  }

  text += `${divider}\n`
  text += CMD.ALIGN_LEFT
  text += formatTwoColumns("No. Tx:", receipt.transactionNumber, maxColumns) + "\n"
  text += formatTwoColumns("Waktu:", receipt.formattedDate, maxColumns) + "\n"
  text += formatTwoColumns("Status:", receipt.statusText, maxColumns) + "\n"
  text += `${divider}\n`

  text += formatTwoColumns("Layanan:", receipt.category, maxColumns) + "\n"
  const descLines = wrapText(receipt.description, maxColumns)
  text += `${descLines.join("\n")}\n`
  text += `${divider}\n`

  text += formatTwoColumns("Nominal:", receipt.grossAmount, maxColumns) + "\n"
  if (receipt.feeAmount) {
    text += formatTwoColumns("Biaya Admin:", receipt.feeAmount, maxColumns) + "\n"
  }
  text += `${divider}\n`

  text += `${CMD.BOLD_ON}${formatTwoColumns("TOTAL DIBAYAR:", receipt.totalPaid, maxColumns)}${CMD.BOLD_OFF}\n`

  if (receipt.paymentAccounts.length > 0) {
    text += "Akun Pembayaran:\n"
    for (const acc of receipt.paymentAccounts) {
      text += formatTwoColumns(`- ${acc.accountName}`, acc.amount, maxColumns) + "\n"
    }
  }

  text += `${divider}\n`
  text += CMD.ALIGN_CENTER
  text += `${receipt.footerThankYou}\n`
  const footerLines = wrapText(receipt.footerNotice, maxColumns)
  text += `${footerLines.join("\n")}\n`
  text += "\n\n"
  text += CMD.FEED_AND_CUT

  return new TextEncoder().encode(text)
}
