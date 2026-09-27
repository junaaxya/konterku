package com.konterku.companion.model

data class BalanceSyncPayload(
    val accountId: String,
    val providerCode: String,
    val accountIdentifier: String,
    val balance: String,
    val observedAt: String,
    val bridgeMetadata: Map<String, String> = emptyMap()
) {
    fun isValid(): Boolean {
        if (accountId.isBlank() || providerCode.isBlank() || accountIdentifier.isBlank()) {
            return false
        }
        if (!balance.matches(Regex("^(0|[1-9]\\d*)$"))) {
            return false
        }
        return true
    }

    fun toJsonString(): String {
        val metaEntries = bridgeMetadata.entries.joinToString(",") { (k, v) ->
            "\"${escapeJson(k)}\":\"${escapeJson(v)}\""
        }
        val metaJson = if (metaEntries.isNotBlank()) "{$metaEntries}" else "{}"

        return """
        {
          "accountId": "${escapeJson(accountId)}",
          "providerCode": "${escapeJson(providerCode)}",
          "accountIdentifier": "${escapeJson(accountIdentifier)}",
          "balance": "${escapeJson(balance)}",
          "observedAt": "${escapeJson(observedAt)}",
          "bridgeMetadata": $metaJson
        }
        """.trimIndent()
    }

    private fun escapeJson(input: String): String {
        return input.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    }
}
