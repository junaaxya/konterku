package com.konterku.companion

import com.konterku.companion.model.BalanceSyncPayload
import com.konterku.companion.model.BankBalance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BalancePayloadTest {

    @Test
    fun `formats rupiah correctly with integer grouping`() {
        val balance1 = BankBalance("BCA", "0123456789", 2500000L, "2026-09-16T15:00:00Z")
        assertEquals("Rp 2.500.000", balance1.formatRupiah())
        assertTrue(balance1.isValid())

        val balanceZero = BankBalance("BRI", "9876543210", 0L, "2026-09-16T15:00:00Z")
        assertEquals("Rp 0", balanceZero.formatRupiah())
        assertTrue(balanceZero.isValid())

        val balanceNegative = BankBalance("BRI", "9876543210", -5000L, "2026-09-16T15:00:00Z")
        assertFalse(balanceNegative.isValid())
    }

    @Test
    fun `validates payload fields and non-negative integer representation`() {
        val validPayload = BalanceSyncPayload(
            accountId = "cmu1234567890",
            providerCode = "BCA",
            accountIdentifier = "0123456789",
            balance = "2500000",
            observedAt = "2026-09-16T15:00:00Z",
            bridgeMetadata = mapOf("client" to "Android")
        )
        assertTrue(validPayload.isValid())

        val json = validPayload.toJsonString()
        assertTrue(json.contains("\"accountId\": \"cmu1234567890\""))
        assertTrue(json.contains("\"providerCode\": \"BCA\""))
        assertTrue(json.contains("\"balance\": \"2500000\""))
        assertTrue(json.contains("\"client\":\"Android\""))

        // Invalid cases
        assertFalse(validPayload.copy(balance = "-1000").isValid())
        assertFalse(validPayload.copy(balance = "abc").isValid())
        assertFalse(validPayload.copy(balance = "1250000.50").isValid()) // Floating point not permitted
        assertFalse(validPayload.copy(accountId = "").isValid())
        assertFalse(validPayload.copy(providerCode = "").isValid())
    }
}
