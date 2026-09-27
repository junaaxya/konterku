package com.konterku.companion.reader

import com.konterku.companion.model.BankBalance
import java.time.Instant

class MockBankBalanceReader(
    override val providerCode: String = "BCA",
    override val supportedPackageNames: List<String> = listOf("com.bca.mybca", "com.bca"),
    private val mockBalanceAmount: Long = 2500000L,
    private val mockAccountIdentifier: String = "0123456789",
    private val shouldFail: Boolean = false,
    private val failureMessage: String = "Saldo tidak ditemukan pada tampilan saat ini."
) : BankBalanceReader {

    override fun isAvailable(installedPackages: Set<String>): Boolean {
        return supportedPackageNames.any { installedPackages.contains(it) }
    }

    override suspend fun readCurrentBalance(contextData: Any?): BankReaderResult {
        if (shouldFail) {
            return BankReaderResult.Error(failureMessage)
        }

        val balance = BankBalance(
            providerCode = providerCode,
            accountIdentifier = mockAccountIdentifier,
            balanceAmount = mockBalanceAmount,
            observedAtIso = Instant.now().toString()
        )

        return BankReaderResult.Success(balance)
    }
}
