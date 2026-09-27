// Popup script handling pairing token storage, DOM scan request, and secure LAN transmission.

function showStatus(text, isError) {
  const box = document.getElementById("status-box")
  box.style.display = "block"
  box.className = isError ? "status error" : "status success"
  box.innerText = text
}

function formatRupiahDisplay(digits) {
  return "Rp " + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

let currentPayload = null

document.addEventListener("DOMContentLoaded", async () => {
  const serverInput = document.getElementById("server-url")
  const accountInput = document.getElementById("account-id")
  const tokenInput = document.getElementById("pairing-token")
  const saveBtn = document.getElementById("save-settings-btn")
  const scanBtn = document.getElementById("scan-btn")
  const syncBtn = document.getElementById("sync-btn")

  const stored = await browser.storage.local.get(["serverUrl", "accountId", "pairingToken"])
  if (stored.serverUrl) serverInput.value = stored.serverUrl
  if (stored.accountId) accountInput.value = stored.accountId
  if (stored.pairingToken) tokenInput.value = stored.pairingToken

  saveBtn.addEventListener("click", async () => {
    await browser.storage.local.set({
      serverUrl: serverInput.value.trim(),
      accountId: accountInput.value.trim(),
      pairingToken: tokenInput.value.trim(),
    })
    showStatus("Pengaturan konektor tersimpan.", false)
  })

  scanBtn.addEventListener("click", async () => {
    showStatus("Membaca halaman portal bank...", false)
    syncBtn.disabled = true

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      if (!tabs || tabs.length === 0) {
        showStatus("Tidak ada tab aktif.", true)
        return
      }

      const response = await browser.tabs.sendMessage(tabs[0].id, { action: "SCAN_BALANCE" })
      if (!response || response.error) {
        showStatus(response?.error || "Gagal membaca saldo tab aktif.", true)
        return
      }

      currentPayload = response
      document.getElementById("provider-code").innerText = response.providerCode
      document.getElementById("account-ident").innerText = response.accountIdentifier
      document.getElementById("detected-balance").innerText = formatRupiahDisplay(response.balance)

      syncBtn.disabled = false
      showStatus("Saldo terdeteksi. Silakan konfirmasi untuk mengirim.", false)
    } catch {
      showStatus("Pastikan tab aktif adalah halaman portal bank BCA atau BRI.", true)
    }
  })

  syncBtn.addEventListener("click", async () => {
    if (!currentPayload) return

    const serverUrl = serverInput.value.trim().replace(/\/$/, "")
    const accountId = accountInput.value.trim()
    const pairingToken = tokenInput.value.trim()

    if (!serverUrl || !accountId || !pairingToken) {
      showStatus("Isi Server URL, Account ID, dan Token Pairing terlebih dahulu.", true)
      return
    }

    syncBtn.disabled = true
    showStatus("Mengirim saldo ke server KONTERKU...", false)

    try {
      const payload = {
        accountId,
        providerCode: currentPayload.providerCode,
        accountIdentifier: currentPayload.accountIdentifier,
        balance: currentPayload.balance,
        observedAt: currentPayload.observedAt || new Date().toISOString(),
        bridgeMetadata: {
          clientDevice: "Firefox Android Extension",
        },
      }

      const res = await fetch(`${serverUrl}/api/connector/balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pairingToken}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showStatus("Saldo berhasil disinkronkan ke KONTERKU!", false)
      } else {
        showStatus(data.error || "Gagal sinkronisasi ke server.", true)
        syncBtn.disabled = false
      }
    } catch {
      showStatus("Gagal menghubungi server KONTERKU via LAN. Periksa Wi-Fi dan IP server.", true)
      syncBtn.disabled = false
    }
  })
})
