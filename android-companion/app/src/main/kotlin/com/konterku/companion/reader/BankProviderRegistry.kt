package com.konterku.companion.reader

import com.konterku.companion.model.ProviderCategory
import com.konterku.companion.model.ProviderDefinition

@Deprecated("Non-production: bank provider registry discontinued")
object BankProviderRegistry {

    val BRI = ProviderDefinition(
        providerCode = "BRI",
        displayName = "BRI (BRImo)",
        category = ProviderCategory.BANK,
        supportedPackageNames = listOf("id.co.bri.brimo"),
        calibrationStatus = com.konterku.companion.model.CalibrationStatus.BELUM_DIKALIBRASI
    )

    val BCA = ProviderDefinition(
        providerCode = "BCA",
        displayName = "BCA (myBCA / BCA mobile)",
        category = ProviderCategory.BANK,
        supportedPackageNames = listOf("com.bca.mybca", "com.bca"),
        calibrationStatus = com.konterku.companion.model.CalibrationStatus.BELUM_DIKALIBRASI
    )

    val MANDIRI = ProviderDefinition(
        providerCode = "MANDIRI",
        displayName = "Bank Mandiri (Livin')",
        category = ProviderCategory.BANK,
        supportedPackageNames = listOf("id.bmri.livin"),
        calibrationStatus = com.konterku.companion.model.CalibrationStatus.BELUM_DIKALIBRASI
    )

    val BNI = ProviderDefinition(
        providerCode = "BNI",
        displayName = "BNI (wondr / BNI Mobile)",
        category = ProviderCategory.BANK,
        supportedPackageNames = listOf("id.co.bni.wondr", "id.co.bni.mobilebanking"),
        calibrationStatus = com.konterku.companion.model.CalibrationStatus.BELUM_DIKALIBRASI
    )

    val SEABANK = ProviderDefinition(
        providerCode = "SEABANK",
        displayName = "SeaBank Indonesia",
        category = ProviderCategory.BANK,
        supportedPackageNames = listOf("com.seabank.mobile"),
        calibrationStatus = com.konterku.companion.model.CalibrationStatus.BELUM_DIKALIBRASI
    )

    val ALL_PROVIDERS = listOf(BRI, BCA, MANDIRI, BNI, SEABANK)

    private val packageToProviderMap: Map<String, ProviderDefinition> = buildMap {
        for (provider in ALL_PROVIDERS) {
            for (pkg in provider.supportedPackageNames) {
                put(pkg, provider)
            }
        }
    }

    fun findProviderByPackage(packageName: String): ProviderDefinition? {
        return packageToProviderMap[packageName]
    }

    fun isSupportedPackage(packageName: String): Boolean {
        return packageToProviderMap.containsKey(packageName)
    }

    fun getAllSupportedPackages(): Set<String> {
        return packageToProviderMap.keys
    }
}
