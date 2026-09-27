// Content script injected ONLY on configured bank domains (*.klikbca.com, *.bri.co.id)
// Reads DOM, parses balance using isolated rules, responds to extension popup.

function extractBcaBalance(documentBody) {
  const text = documentBody.innerText || ""
  const lower = text.toLowerCase()

  if (
    lower.includes("session expired") ||
    lower.includes("silakan login kembali") ||
    lower.includes("login kembali")
  ) {
    return { error: "Sesi KlikBCA telah berakhir. Silakan login kembali." }
  }

  // Look for account number & balance in tables
  const rowMatch = text.match(
    /(?:saldo\s*(?:efektif|akhir|tersedia|rekening)?[:\s\t]*)(?:IDR|Rp\.?)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i,
  )

  if (rowMatch && rowMatch[1]) {
    const rawVal = rowMatch[1].replace(/,.*$/, "").replace(/[^0-9]/g, "")
    const accMatch = text.match(/\b\d{10}\b/)
    return {
      providerCode: "BCA",
      accountIdentifier: accMatch ? accMatch[0] : "BCA-ACCOUNT",
      balance: rawVal,
      observedAt: new Date().toISOString(),
    }
  }

  return { error: "Struktur halaman bank berubah atau saldo tidak ditemukan." }
}

function extractBriBalance(documentBody) {
  const text = documentBody.innerText || ""
  const lower = text.toLowerCase()

  if (
    lower.includes("session timeout") ||
    lower.includes("sesi anda telah berakhir") ||
    lower.includes("silakan masuk kembali")
  ) {
    return { error: "Sesi IB BRI telah berakhir. Silakan login kembali." }
  }

  const rowMatch = text.match(
    /(?:saldo\s*(?:efektif|akhir|tersedia|rekening)?[:\s\t]*)(?:IDR|Rp\.?)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i,
  )

  if (rowMatch && rowMatch[1]) {
    const rawVal = rowMatch[1].replace(/,.*$/, "").replace(/[^0-9]/g, "")
    const accMatch = text.match(/\b\d{10,15}\b/)
    return {
      providerCode: "BRI",
      accountIdentifier: accMatch ? accMatch[0] : "BRI-ACCOUNT",
      balance: rawVal,
      observedAt: new Date().toISOString(),
    }
  }

  return { error: "Struktur halaman bank berubah atau saldo tidak ditemukan." }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCAN_BALANCE") {
    const host = window.location.hostname
    let result = null

    if (host.includes("klikbca.com")) {
      result = extractBcaBalance(document.body)
    } else if (host.includes("bri.co.id")) {
      result = extractBriBalance(document.body)
    } else {
      result = { error: "Bukan domain portal bank yang didukung." }
    }

    sendResponse(result)
  }
  return true
})
