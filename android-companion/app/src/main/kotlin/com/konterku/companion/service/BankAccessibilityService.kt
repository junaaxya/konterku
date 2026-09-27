package com.konterku.companion.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.konterku.companion.model.BankBalance
import com.konterku.companion.reader.BankProviderRegistry
import java.time.Instant

@Deprecated("Non-production: bank reading via accessibility discontinued")
class BankAccessibilityService : AccessibilityService() {

    companion object {
        var isServiceEnabled: Boolean = false
            private set

        var activePackageName: String? = null
            private set

        var latestDetectedBalance: BankBalance? = null
            private set

        const val ACTION_BALANCE_DETECTED = "com.konterku.companion.BALANCE_DETECTED"
        const val ACTION_SERVICE_STATUS_CHANGED = "com.konterku.companion.SERVICE_STATUS_CHANGED"
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceEnabled = true
        broadcastStatus()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        isServiceEnabled = false
        broadcastStatus()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceEnabled = false
        broadcastStatus()
    }

    @Suppress("DEPRECATION")
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val pkgName = event.packageName?.toString() ?: return

        if (!BankProviderRegistry.isSupportedPackage(pkgName)) {
            return
        }

        activePackageName = pkgName
        val providerDef = BankProviderRegistry.findProviderByPackage(pkgName) ?: return

        val rootNode = rootInActiveWindow ?: return
        try {
            scanVisibleBalanceSafely(rootNode, providerDef.providerCode)
        } finally {
            rootNode.recycle()
        }
    }

    override fun onInterrupt() {
        // Accessibility service interrupted by system
    }

    @Suppress("DEPRECATION")
    private fun scanVisibleBalanceSafely(node: AccessibilityNodeInfo, providerCode: String) {
        if (node.isPassword) {
            return
        }

        val text = node.text?.toString()?.trim()
        if (!text.isNullOrBlank()) {
            val parsed = extractBalanceFromText(text)
            if (parsed != null && parsed >= 0L) {
                val balance = BankBalance(
                    providerCode = providerCode,
                    accountIdentifier = "REK-${providerCode}",
                    balanceAmount = parsed,
                    observedAtIso = Instant.now().toString()
                )
                latestDetectedBalance = balance
                broadcastBalance(balance)
                return
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            try {
                if (!child.isPassword) {
                    scanVisibleBalanceSafely(child, providerCode)
                }
            } finally {
                child.recycle()
            }
        }
    }

    private fun extractBalanceFromText(text: String): Long? {
        val regex = Regex("""(?:Rp\.?|IDR)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)""", RegexOption.IGNORE_CASE)
        val match = regex.find(text) ?: return null

        val rawDigits = match.groupValues[1]
            .substringBefore(",")
            .replace(".", "")
            .trim()

        return rawDigits.toLongOrNull()
    }

    private fun broadcastBalance(balance: BankBalance) {
        val intent = Intent(ACTION_BALANCE_DETECTED).apply {
            putExtra("providerCode", balance.providerCode)
            putExtra("accountIdentifier", balance.accountIdentifier)
            putExtra("balanceAmount", balance.balanceAmount)
            putExtra("observedAt", balance.observedAtIso)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun broadcastStatus() {
        val intent = Intent(ACTION_SERVICE_STATUS_CHANGED).apply {
            putExtra("isEnabled", isServiceEnabled)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }
}
