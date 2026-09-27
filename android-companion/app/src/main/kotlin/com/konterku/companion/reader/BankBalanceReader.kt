package com.konterku.companion.reader

@Deprecated("Non-production: bank balance reading discontinued")
interface BankBalanceReader {
    val providerCode: String
    val supportedPackageNames: List<String>
    fun isAvailable(installedPackages: Set<String>): Boolean
    suspend fun readCurrentBalance(contextData: Any?): BankReaderResult
}
