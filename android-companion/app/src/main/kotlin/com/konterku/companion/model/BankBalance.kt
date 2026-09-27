package com.konterku.companion.model

data class BankBalance(
    val providerCode: String,
    val accountIdentifier: String,
    val balanceAmount: Long,
    val observedAtIso: String
) {
    fun isValid(): Boolean = balanceAmount >= 0L && accountIdentifier.isNotBlank()

    fun formatRupiah(): String {
        val s = balanceAmount.toString()
        val formatted = StringBuilder()
        var count = 0
        for (i in s.length - 1 downTo 0) {
            formatted.append(s[i])
            count++
            if (count % 3 == 0 && i != 0) {
                formatted.append('.')
            }
        }
        return "Rp ${formatted.reverse()}"
    }
}
