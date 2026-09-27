package com.konterku.companion.model

enum class ProviderCategory {
    BANK,
    EWALLET
}

enum class CalibrationStatus(val displayLabel: String) {
    BELUM_DIKALIBRASI("Belum dikalibrasi pada perangkat nyata"),
    TERKALIBRASI("Terkalibrasi")
}

data class ProviderDefinition(
    val providerCode: String,
    val displayName: String,
    val category: ProviderCategory,
    val supportedPackageNames: List<String>,
    val defaultAccountIdentifierPrefix: String = "",
    val calibrationStatus: CalibrationStatus = CalibrationStatus.BELUM_DIKALIBRASI
)
