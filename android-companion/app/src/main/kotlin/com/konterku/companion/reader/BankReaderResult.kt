package com.konterku.companion.reader

import com.konterku.companion.model.BankBalance

sealed class BankReaderResult {
    data class Success(val balance: BankBalance) : BankReaderResult()
    data class Error(
        val message: String,
        val isSessionExpired: Boolean = false,
        val isStructureChanged: Boolean = false
    ) : BankReaderResult()
    data class UnsupportedApp(val packageName: String) : BankReaderResult()
    object BalanceNotFound : BankReaderResult()
}
